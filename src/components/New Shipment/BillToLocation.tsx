import React, { useRef, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, Select, AutoComplete, Spin } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from '../../config/apiConfig';

interface BillToLocationProps {
  clientCode?: string;
}

const BillToLocation: React.FC<BillToLocationProps> = ({ clientCode }) => {
  const [form] = Form.useForm();
  const { searchPostals, lookupPostal, loadingPostal } = usePostalLookup();
  const [loading, setLoading] = useState(false);
  const [locationsList, setLocationsList] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFocusedRef = useRef(false);
  const postalRef = useRef("");

  const fetchLocationsByZip = async (zip: string) => {
    if (!zip || zip.trim().length < 3) return;
    const cleanZip = zip.split(' - ')[0].trim();
    const country = form.getFieldValue("country") || "USA";
    const clientCodeToUse = clientCode || sessionStorage.getItem("customerLocation_selectedClientCode") || sessionStorage.getItem("quotes_selectedClientCode") || DEFAULT_CLIENT_CODE || "Devts";

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Call SearchLocations API
      const response = await axios.post(
        `${API_BASE_URL}/Location/SearchLocations`,
        {
          clientCode: clientCodeToUse,
          searchText: cleanZip,
          pageNumber: 1,
          pageSize: 20,
        },
        { headers }
      );

      let foundLocations: any[] = [];
      if (response.data?.isSuccess && response.data?.data) {
        let rawData = response.data.data;
        if (!Array.isArray(rawData) && rawData.items) rawData = rawData.items;
        if (Array.isArray(rawData) && rawData.length > 0) {
          foundLocations = rawData;
        }
      }

      if (foundLocations.length > 0) {
        setLocationsList(foundLocations);
        const matched = foundLocations.find(
          (loc: any) => String(loc.zipCode || "").trim() === cleanZip
        ) || foundLocations[0];

        setSelectedLocationId(String(matched.locationId));
        form.setFieldsValue({
          companyName: matched.locationName || "",
          address1: matched.address1 || "",
          address2: matched.address2 || "",
          country: matched.countryCode || country || "USA",
          postal: matched.zipCode || cleanZip,
          city: matched.city || "",
          state: matched.stateCode || "",
          fax: matched.fax || "",
        });
      } else {
        // Fallback to usePostalLookup if no master location was found
        setLocationsList([]);
        setSelectedLocationId(undefined);
        const postalResult = await lookupPostal(cleanZip, country);
        if (postalResult) {
          form.setFieldsValue({
            city: postalResult.city,
            state: postalResult.state,
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch bill to locations:", err);
      const postalResult = await lookupPostal(cleanZip, country);
      if (postalResult) {
        form.setFieldsValue({
          city: postalResult.city,
          state: postalResult.state,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle postal code search with debounce starting at 3 digits
  const handleSearchPostal = (value: string) => {
    form.setFieldsValue({ postal: value });
    postalRef.current = value;
    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }

    const cleanZip = value.split(' - ')[0].trim();
    if (cleanZip.length >= 3) {
      zipTimeoutRef.current = setTimeout(async () => {
        const country = form.getFieldValue("country") || "USA";
        const results = await searchPostals(cleanZip, country);

        if (results && results.length === 1) {
          const fullPostal = `${results[0].postalCode || cleanZip} - ${results[0].city}, ${results[0].state}`;
          form.setFieldsValue({
            postal: fullPostal,
            city: results[0].city,
            state: results[0].state,
          });
          postalRef.current = fullPostal;
          setPostalOptions([]);
          setDropdownOpen(false);
          fetchLocationsByZip(results[0].postalCode || cleanZip);
        } else if (results && results.length > 1) {
          const uniqueResults = Array.from(
            new Set(results.map((r) => `${r.postalCode || cleanZip}|${r.city}|${r.state}`))
          ).map((str) => {
            const [p, c, s] = str.split('|');
            return { postalCode: p, city: c, state: s };
          });

          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: `${r.postalCode} - ${r.city}, ${r.state}`,
              label: `${r.postalCode} - ${r.city}, ${r.state}`,
              city: r.city,
              state: r.state,
              key: `postal-${idx}`,
            }))
          );
          if (isFocusedRef.current) {
            setDropdownOpen(true);
          }
        } else {
          setPostalOptions([]);
          setDropdownOpen(false);
        }
      }, 500);
    } else {
      setPostalOptions([]);
      setDropdownOpen(false);
    }
  };

  const handleSelectPostal = (value: string, option: any) => {
    form.setFieldsValue({
      postal: value,
      city: option.city,
      state: option.state,
    });
    postalRef.current = value;
    setPostalOptions([]);
    setDropdownOpen(false);
    const cleanZip = value.split(' - ')[0].trim();
    fetchLocationsByZip(cleanZip);
  };

  const handlePostalBlur = async () => {
    isFocusedRef.current = false;
    const postal = postalRef.current || form.getFieldValue("postal") || "";
    if (!postal || postal.trim().length < 3) return;

    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }

    const country = form.getFieldValue("country");
    const cleanZip = postal.split(' - ')[0].trim();

    const results = await searchPostals(cleanZip, country);
    if (results && results.length === 1) {
      const fullPostal = `${results[0].postalCode || cleanZip} - ${results[0].city}, ${results[0].state}`;
      form.setFieldsValue({
        postal: fullPostal,
        city: results[0].city,
        state: results[0].state,
      });
      postalRef.current = fullPostal;
      setPostalOptions([]);
      setDropdownOpen(false);
      fetchLocationsByZip(results[0].postalCode || cleanZip);
    } else if (results && results.length > 1) {
      const uniqueResults = Array.from(
        new Set(results.map((r) => `${r.postalCode || cleanZip}|${r.city}|${r.state}`))
      ).map((str) => {
        const [p, c, s] = str.split('|');
        return { postalCode: p, city: c, state: s };
      });

      setPostalOptions(
        uniqueResults.map((r, idx) => ({
          value: `${r.postalCode} - ${r.city}, ${r.state}`,
          label: `${r.postalCode} - ${r.city}, ${r.state}`,
          city: r.city,
          state: r.state,
          key: `postal-${idx}`,
        }))
      );
    }
  };

  const handleLocationSelect = (locId: string) => {
    setSelectedLocationId(locId);
    const selectedLoc = locationsList.find((loc) => String(loc.locationId) === locId);
    if (selectedLoc) {
      form.setFieldsValue({
        companyName: selectedLoc.locationName,
        address1: selectedLoc.address1 || "",
        address2: selectedLoc.address2 || "",
        country: selectedLoc.countryCode || form.getFieldValue("country") || "USA",
        postal: selectedLoc.zipCode || form.getFieldValue("postal") || "",
        city: selectedLoc.city || "",
        state: selectedLoc.stateCode || "",
        fax: selectedLoc.fax || "",
      });
    }
  };

  return (
    <Card 
      title="Bill To Location" 
      extra={<Button type="link" className="add-master-btn">+ Add to Master</Button>}
    >
      <Form layout="vertical" form={form} initialValues={{ country: "USA" }}>
        {locationsList && locationsList.length > 0 ? (
          <Form.Item label="Company Name">
            <Select
              showSearch
              placeholder="Select company name"
              value={selectedLocationId}
              onChange={handleLocationSelect}
              optionLabelProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {locationsList.map((loc: any) => (
                <Select.Option
                  key={loc.locationId}
                  value={String(loc.locationId)}
                  label={loc.locationName}
                >
                  <div className="loc-select-option">
                    <span className="loc-select-name">{loc.locationName}</span>
                    <span className="loc-select-subtext">
                      {[loc.address1, loc.city, loc.stateCode, loc.zipCode].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </Select.Option>
              ))}
            </Select>
            <Form.Item name="companyName" noStyle>
              <Input type="hidden" />
            </Form.Item>
          </Form.Item>
        ) : (
          <Form.Item label="Company Name" name="companyName">
            <Input placeholder='Company Name' />
          </Form.Item>
        )}
        <Form.Item label="Address Line 1" name="address1">
          <Input placeholder="Address Line 1" />
        </Form.Item>
        <Form.Item label="Address Line 2" name="address2">
          <Input placeholder="Address Line 2" />
        </Form.Item>
        <Form.Item label="Country" name="country">
          <CountrySelect />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Form.Item label="Postal / ZIP" name="postal">
              <AutoComplete
                options={postalOptions}
                onSearch={handleSearchPostal}
                onSelect={handleSelectPostal}
                onChange={(val) => {
                  form.setFieldsValue({ postal: val });
                  postalRef.current = val;
                }}
                onFocus={() => {
                  isFocusedRef.current = true;
                  if (postalOptions.length > 0) {
                    setDropdownOpen(true);
                  }
                }}
                onBlur={handlePostalBlur}
                placeholder="ZIP / Postal"
                disabled={loading || loadingPostal}
                notFoundContent={loadingPostal ? <Spin size="small" /> : null}
                open={dropdownOpen}
                onDropdownVisibleChange={(visible) => setDropdownOpen(visible)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="City" name="city">
              <Input placeholder="City" readOnly disabled />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="State" name="state">
              <Input placeholder="ST" readOnly disabled />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Fax No" name="fax">
          <Input placeholder="Fax No" />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default BillToLocation;

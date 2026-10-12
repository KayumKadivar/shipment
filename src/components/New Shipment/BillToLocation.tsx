import React, { useEffect, useRef, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, AutoComplete, Spin } from 'antd';
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
  const [, setSelectedLocationId] = useState<string | undefined>(undefined);
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFocusedRef = useRef(false);
  const postalRef = useRef("");

  // Company Name Search State
  const [companyOptions, setCompanyOptions] = useState<{ value: string; label: React.ReactNode; location: any; key: string }[]>([]);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const searchCompanyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync companyOptions with locationsList when zip search updates it
  useEffect(() => {
    if (locationsList && locationsList.length > 0) {
      setCompanyOptions(
        locationsList.map((loc: any, idx: number) => ({
          value: loc.locationName || `Location-${idx + 1}`,
          key: `prop-bill-loc-${loc.locationId || idx}`,
          location: loc,
          label: (
            <div className="loc-select-option" key={`prop-bill-lbl-${loc.locationId || idx}`}>
              <span className="loc-select-name">{loc.locationName || "Unnamed Location"}</span>
              <span className="loc-select-subtext">
                {[loc.address1, loc.city, loc.stateCode, loc.zipCode]
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </div>
          ),
        }))
      );
    }
  }, [locationsList]);

  // Handle SearchLocations API for Company Name
  const handleSearchCompany = (searchText: string) => {
    if (searchCompanyTimeoutRef.current) {
      clearTimeout(searchCompanyTimeoutRef.current);
    }

    const trimmed = (searchText || "").trim();
    if (!trimmed) {
      if (locationsList && locationsList.length > 0) {
        setCompanyOptions(
          locationsList.map((loc: any, idx: number) => ({
            value: loc.locationName || `Location-${idx + 1}`,
            key: `prop-bill-loc-${loc.locationId || idx}`,
            location: loc,
            label: (
              <div className="loc-select-option" key={`prop-bill-lbl-${loc.locationId || idx}`}>
                <span className="loc-select-name">{loc.locationName || "Unnamed Location"}</span>
                <span className="loc-select-subtext">
                  {[loc.address1, loc.city, loc.stateCode, loc.zipCode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            ),
          }))
        );
      } else {
        setCompanyOptions([]);
      }
      return;
    }

    searchCompanyTimeoutRef.current = setTimeout(async () => {
      setLoadingCompany(true);
      try {
        const token = localStorage.getItem("authToken");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const clientCodeToUse =
          clientCode ||
          sessionStorage.getItem("customerLocation_selectedClientCode") ||
          sessionStorage.getItem("quotes_selectedClientCode") ||
          DEFAULT_CLIENT_CODE ||
          "DEVTS";

        const response = await axios.post(
          `${API_BASE_URL}/Location/SearchLocations`,
          {
            clientCode: clientCodeToUse,
            searchText: trimmed,
            pageNumber: 1,
            pageSize: 20,
          },
          { headers }
        );

        let dataList: any[] = [];
        if (response.data?.isSuccess && response.data?.data) {
          const raw = response.data.data;
          dataList = Array.isArray(raw) ? raw : (raw.items || []);
        }

        if (dataList.length > 0) {
          setCompanyOptions(
            dataList.map((loc: any, idx: number) => ({
              value: loc.locationName || trimmed,
              key: `search-bill-${loc.locationId || idx}-${idx}`,
              location: loc,
              label: (
                <div className="loc-select-option" key={`search-bill-lbl-${loc.locationId || idx}`}>
                  <span className="loc-select-name">{loc.locationName || "Unnamed Location"}</span>
                  <span className="loc-select-subtext">
                    {[loc.address1, loc.city, loc.stateCode, loc.zipCode]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              ),
            }))
          );
        } else {
          setCompanyOptions([]);
        }
      } catch (error) {
        console.error("Error searching locations for bill to company name:", error);
        setCompanyOptions([]);
      } finally {
        setLoadingCompany(false);
      }
    }, 400);
  };

  const handleSelectCompany = (value: string, option: any) => {
    const loc = option?.location;
    if (!loc) return;

    setSelectedLocationId(String(loc.locationId));
    const fullPostal = loc.zipCode && loc.city && loc.stateCode
      ? `${loc.zipCode} - ${loc.city}, ${loc.stateCode}`
      : (loc.zipCode || form.getFieldValue("postal") || "");

    form.setFieldsValue({
      companyName: loc.locationName || value,
      address1: loc.address1 || "",
      address2: loc.address2 || "",
      country: loc.countryCode || form.getFieldValue("country") || "USA",
      postal: fullPostal,
      city: loc.city || "",
      state: loc.stateCode || "",
      fax: loc.fax || "",
    });
  };

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
          country: matched.countryCode || country || "",
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

  return (
    <Card 
      title="Bill To Location" 
      extra={<Button type="link" className="add-master-btn">+ Add to Master</Button>}
    >
      <Form layout="vertical" form={form} initialValues={{ country: "USA" }}>
        <Form.Item label="Company Name" name="companyName">
          <AutoComplete
            options={companyOptions}
            onSearch={handleSearchCompany}
            onSelect={handleSelectCompany}
            placeholder="Company Name"
            allowClear
          >
            <Input
              placeholder="Company Name"
              suffix={loadingCompany ? <Spin size="small" /> : null}
            />
          </AutoComplete>
        </Form.Item>
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

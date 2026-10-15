import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, Select, AutoComplete, Spin } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from '../../config/apiConfig';

export interface OriginLocationProps {
  initialData?: {
    locationId?: number | string;
    companyName?: string;
    address1?: string;
    address2?: string;
    postal?: string;
    city?: string;
    state?: string;
    country?: string;
    contactName?: string;
    phone?: string;
    ext?: string;
    email?: string;
    fax?: string;
    openTime?: string;
    closeTime?: string;
    pickupDate?: string;
    expPickupDate?: string;
  };
  locationsList?: any[];
  loading?: boolean;
  clientCode?: string;
  onLocationSelect?: (location: any) => void;
}

export const formatDisplayTime = (timeStr?: string): string => {
  if (!timeStr) return "";
  const trimmed = timeStr.trim();
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = hours >= 12 ? "PM" : "AM";
    const h12 = hours % 12 || 12;
    return `${String(h12).padStart(2, "0")}:${mins} ${period}`;
  }
  return trimmed;
};

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";
  const label = `${String(displayHour).padStart(2, "0")}:${minutes} ${period}`;
  return { value: label, label };
});

const OriginLocation: React.FC<OriginLocationProps> = ({
  initialData,
  locationsList,
  clientCode,
  onLocationSelect,
}) => {
  const [form] = Form.useForm();
  const { searchPostals, loadingPostal } = usePostalLookup();
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

  const timeOptions = useMemo(() => {
    const opts = [...TIME_OPTIONS];
    const ot = formatDisplayTime(initialData?.openTime);
    const ct = formatDisplayTime(initialData?.closeTime);
    if (ot && !opts.some((o) => o.value === ot)) {
      opts.unshift({ value: ot, label: ot });
    }
    if (ct && !opts.some((o) => o.value === ct)) {
      opts.push({ value: ct, label: ct });
    }
    return opts;
  }, [initialData?.openTime, initialData?.closeTime]);

  useEffect(() => {
    if (initialData?.locationId) {
      setSelectedLocationId(String(initialData.locationId));
    } else if (locationsList && locationsList.length > 0 && (initialData?.companyName || initialData?.locationId)) {
      const matched = locationsList.find(
        (loc) =>
          (initialData?.companyName && loc.locationName === initialData.companyName) ||
          (initialData?.locationId && String(loc.locationId) === String(initialData.locationId))
      );
      if (matched) {
        setSelectedLocationId(String(matched.locationId));
      }
    }
  }, [initialData?.locationId, initialData?.companyName, locationsList]);

  // Populate company options from locationsList if passed
  useEffect(() => {
    if (locationsList && locationsList.length > 0) {
      setCompanyOptions(
        locationsList.map((loc: any, idx: number) => ({
          value: loc.locationName || `Location-${idx + 1}`,
          key: `prop-loc-${loc.locationId || idx}`,
          location: loc,
          label: (
            <div className="loc-select-option" key={`prop-loc-lbl-${loc.locationId || idx}`}>
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

  useEffect(() => {
    if (initialData) {
      const openTimeFormatted = formatDisplayTime(initialData.openTime) || undefined;
      const closeTimeFormatted = formatDisplayTime(initialData.closeTime) || undefined;
      form.setFieldsValue({
        companyName: initialData.companyName || "",
        address1: initialData.address1 || "",
        address2: initialData.address2 || "",
        postal: (initialData.postal || "").split(' - ')[0].trim(),
        city: initialData.city || "",
        state: initialData.state || "",
        country: initialData.country || "USA",
        contactName: initialData.contactName || "",
        phone: formatPhoneNumber(initialData.phone) || "",
        ext: initialData.ext || "",
        email: initialData.email || "",
        fax: initialData.fax || "",
        openTime: openTimeFormatted,
        closeTime: closeTimeFormatted,
        pickupOpenTime: openTimeFormatted,
        pickupCloseTime: closeTimeFormatted,
        pickupDate: initialData.pickupDate || "",
        expPickupDate: initialData.expPickupDate || initialData.pickupDate || "",
      });
    }
  }, [initialData, form]);

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
            key: `prop-loc-${loc.locationId || idx}`,
            location: loc,
            label: (
              <div className="loc-select-option" key={`prop-loc-lbl-${loc.locationId || idx}`}>
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
              key: `search-loc-${loc.locationId || idx}-${idx}`,
              location: loc,
              label: (
                <div className="loc-select-option" key={`search-loc-lbl-${loc.locationId || idx}`}>
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
        console.error("Error searching locations for company name:", error);
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
    const openTimeFormatted = formatDisplayTime(loc.openTime) || "08:00 AM";
    const closeTimeFormatted = formatDisplayTime(loc.closeTime) || "05:00 PM";
    const onlyZip = String(loc.zipCode || form.getFieldValue("postal") || "").split(' - ')[0].trim();

    form.setFieldsValue({
      companyName: loc.locationName || value,
      address1: loc.address1 || "",
      address2: loc.address2 || "",
      country: loc.countryCode || "USA",
      postal: onlyZip,
      city: loc.city || "",
      state: loc.stateCode || "",
      contactName: loc.contactName || "",
      phone: formatPhoneNumber(loc.contactPhone) || "",
      email: loc.contactEmail || "",
      openTime: openTimeFormatted,
      closeTime: closeTimeFormatted,
      pickupOpenTime: openTimeFormatted,
      pickupCloseTime: closeTimeFormatted,
    });

    if (onLocationSelect) {
      onLocationSelect(loc);
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
          const onlyZip = String(results[0].postalCode || cleanZip).split(' - ')[0].trim();
          form.setFieldsValue({
            postal: onlyZip,
            city: results[0].city,
            state: results[0].state,
          });
          postalRef.current = onlyZip;
          setPostalOptions([]);
          setDropdownOpen(false);
        } else if (results && results.length > 1) {
          const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || cleanZip}|${r.city}|${r.state}`)))
            .map(str => {
              const [p, c, s] = str.split('|');
              return { postalCode: p, city: c, state: s };
            });

          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: String(r.postalCode || cleanZip).split(' - ')[0].trim(),
              label: `${r.postalCode} - ${r.city}, ${r.state}`,
              city: r.city,
              state: r.state,
              key: `postal-${idx}`
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
    const onlyZip = String(value || "").split(' - ')[0].trim();
    form.setFieldsValue({
      postal: onlyZip,
      city: option.city,
      state: option.state,
    });
    postalRef.current = onlyZip;
    setPostalOptions([]);
    setDropdownOpen(false);
  };

  const handlePostalBlur = async () => {
    isFocusedRef.current = false;
    const postal = postalRef.current || form.getFieldValue("postal") || "";
    if (!postal || postal.trim().length < 3) return;

    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }

    const country = form.getFieldValue("country") || "USA";
    const cleanZip = postal.split(' - ')[0].trim();
    const results = await searchPostals(cleanZip, country);
    if (results && results.length === 1) {
      const onlyZip = String(results[0].postalCode || cleanZip).split(' - ')[0].trim();
      form.setFieldsValue({
        postal: onlyZip,
        city: results[0].city,
        state: results[0].state,
      });
      postalRef.current = onlyZip;
      setPostalOptions([]);
      setDropdownOpen(false);
    } else if (results && results.length > 1) {
      const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || cleanZip}|${r.city}|${r.state}`)))
        .map(str => {
          const [p, c, s] = str.split('|');
          return { postalCode: p, city: c, state: s };
        });

      setPostalOptions(
        uniqueResults.map((r, idx) => ({
          value: String(r.postalCode || cleanZip).split(' - ')[0].trim(),
          label: `${r.postalCode} - ${r.city}, ${r.state}`,
          city: r.city,
          state: r.state,
          key: `postal-${idx}`
        }))
      );
    }
  };

  return (
    <Card 
      title="Origin Location" 
      extra={<Button type="link" className="add-master-btn">+ Add to Master</Button>}
    >
      <Form layout="vertical" form={form} initialValues={{ country: "USA" }}>
        <Form.Item label="Company Name" name="companyName">
          <AutoComplete
            options={companyOptions}
            onSearch={handleSearchCompany}
            onSelect={handleSelectCompany}
            placeholder="Company name"
            allowClear
          >
            <Input
              placeholder="Company name"
              suffix={loadingCompany ? <Spin size="small" /> : null}
            />
          </AutoComplete>
        </Form.Item>
        <Form.Item label="Address Line 1" name="address1">
          <Input placeholder="Street address" />
        </Form.Item>
        <Form.Item label="Address Line 2" name="address2">
          <Input placeholder="Suite, dock, etc." />
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
                disabled={loadingPostal}
                notFoundContent={loadingPostal ? <Spin size="small" /> : null}
                open={dropdownOpen}
                onDropdownVisibleChange={(visible) => setDropdownOpen(visible)}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="City" name="city">
              <Input placeholder="City" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="State" name="state">
              <Input placeholder="ST" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Contact Name" name="contactName">
          <Input placeholder="Contact" />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={16}>
            <Form.Item label="Phone" name="phone" normalize={formatPhoneNumber}>
              <Input placeholder="(___) ___-____" maxLength={14} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item label="Ext" name="ext">
              <Input placeholder="Ext" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Email" name="email">
              <Input type="email" placeholder="email@company.com" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Fax" name="fax">
              <Input placeholder="Fax No" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Exp. Pickup Date" name="expPickupDate">
              <Input placeholder="mm/dd/yyyy" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="From" name="openTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="To" name="closeTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Form.Item label="Pickup Date" name="pickupDate">
              <Input placeholder="mm/dd/yyyy"/>
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="From" name="pickupOpenTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="To" name="pickupCloseTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default OriginLocation;

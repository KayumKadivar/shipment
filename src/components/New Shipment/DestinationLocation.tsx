import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, Select, AutoComplete, Spin } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';
import { formatDisplayTime, TIME_OPTIONS } from './OriginLocation';

export interface DestinationLocationProps {
  initialData?: {
    locationId?: number | string;
    companyName?: string;
    address1?: string;
    address2?: string;
    postal?: string;
    city?: string;
    state?: string;
    country?: string;
    port?: string;
    contactName?: string;
    phone?: string;
    ext?: string;
    email?: string;
    fax?: string;
    openTime?: string;
    closeTime?: string;
    deliveryDate?: string;
    expDeliveryDate?: string;
  };
  locationsList?: any[];
  loading?: boolean;
}

const DestinationLocation: React.FC<DestinationLocationProps> = ({ initialData, locationsList }) => {
  const [form] = Form.useForm();
  const { searchPostals, loadingPostal } = usePostalLookup();
  const [selectedLocationId, setSelectedLocationId] = useState<string | undefined>(undefined);
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFocusedRef = useRef(false);
  const postalRef = useRef("");

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
    } else if (locationsList && locationsList.length > 0) {
      const matched = locationsList.find(
        (loc) => loc.locationName === initialData?.companyName || String(loc.locationId) === String(initialData?.locationId)
      ) || locationsList[0];
      if (matched) {
        setSelectedLocationId(String(matched.locationId));
      }
    }
  }, [initialData?.locationId, initialData?.companyName, locationsList]);

  useEffect(() => {
    if (initialData) {
      const openTimeFormatted = formatDisplayTime(initialData.openTime) || undefined;
      const closeTimeFormatted = formatDisplayTime(initialData.closeTime) || undefined;
      form.setFieldsValue({
        companyName: initialData.companyName || "",
        address1: initialData.address1 || "",
        address2: initialData.address2 || "",
        postal: initialData.postal || "",
        city: initialData.city || "",
        state: initialData.state || "",
        country: initialData.country || "USA",
        port: initialData.port || "",
        contactName: initialData.contactName || "",
        phone: initialData.phone || "",
        ext: initialData.ext || "",
        email: initialData.email || "",
        fax: initialData.fax || "",
        openTime: openTimeFormatted,
        closeTime: closeTimeFormatted,
        delOpenTime: openTimeFormatted,
        delCloseTime: closeTimeFormatted,
        deliveryDate: initialData.deliveryDate || "",
        expDeliveryDate: initialData.expDeliveryDate || initialData.deliveryDate || "",
      });
    }
  }, [initialData, form]);

  const handleLocationSelect = (locId: string) => {
    setSelectedLocationId(locId);
    const selectedLoc = locationsList?.find((loc) => String(loc.locationId) === locId);
    if (selectedLoc) {
      const openTimeFormatted = formatDisplayTime(selectedLoc.openTime) || "08:00 AM";
      const closeTimeFormatted = formatDisplayTime(selectedLoc.closeTime) || "05:00 PM";
      form.setFieldsValue({
        companyName: selectedLoc.locationName,
        address1: selectedLoc.address1 || "",
        address2: selectedLoc.address2 || "",
        country: selectedLoc.countryCode || "USA",
        postal: selectedLoc.zipCode || form.getFieldValue("postal") || "",
        city: selectedLoc.city || "",
        state: selectedLoc.stateCode || "",
        contactName: selectedLoc.contactName || "",
        phone: selectedLoc.contactPhone || "",
        email: selectedLoc.contactEmail || "",
        openTime: openTimeFormatted,
        closeTime: closeTimeFormatted,
        delOpenTime: openTimeFormatted,
        delCloseTime: closeTimeFormatted,
      });
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
        } else if (results && results.length > 1) {
          const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || cleanZip}|${r.city}|${r.state}`)))
            .map(str => {
              const [p, c, s] = str.split('|');
              return { postalCode: p, city: c, state: s };
            });

          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: `${r.postalCode} - ${r.city}, ${r.state}`,
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
    form.setFieldsValue({
      postal: value,
      city: option.city,
      state: option.state,
    });
    postalRef.current = value;
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
      const fullPostal = `${results[0].postalCode || cleanZip} - ${results[0].city}, ${results[0].state}`;
      form.setFieldsValue({
        postal: fullPostal,
        city: results[0].city,
        state: results[0].state,
      });
      postalRef.current = fullPostal;
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
          value: `${r.postalCode} - ${r.city}, ${r.state}`,
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
      title="Destination Location" 
      extra={<Button type="link" className="add-master-btn add-line-btn">+ Add to Master</Button>}
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
            <Input placeholder="Company name" />
          </Form.Item>
        )}
        <Form.Item label="Address Line 1" name="address1">
          <Input placeholder="Street address" />
        </Form.Item>
        <Form.Item label="Address Line 2" name="address2">
          <Input placeholder="Suite, dock, etc." />
        </Form.Item>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={16}>
            <Form.Item label="Country" name="country">
              <CountrySelect />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Port" name="port">
              <Input placeholder="Port" />
            </Form.Item>
          </Col>
        </Row>
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
            <Form.Item label="Phone" name="phone">
              <Input placeholder="(___) ___-____" />
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
            <Form.Item label="Exp. Delivery Date" name="expDeliveryDate">
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
            <Form.Item label="Delivery Date" name="deliveryDate">
              <Input placeholder="mm/dd/yyyy" />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="From" name="delOpenTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="To" name="delCloseTime">
              <Select allowClear showSearch options={timeOptions} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );
};

export default DestinationLocation;

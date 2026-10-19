import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Form, Input, Row, Col, Button, Select, AutoComplete, Spin } from 'antd';
import type { FormInstance } from 'antd';
import CountrySelect from '../../components/CountrySelect';
import { usePostalLookup } from '../../hooks/usePostalLookup';
import { formatDisplayTime, TIME_OPTIONS } from './OriginLocation';
import { formatPhoneNumber } from '../../utils/formatPhoneNumber';
import axios from 'axios';
import { API_BASE_URL, DEFAULT_CLIENT_CODE } from '../../config/apiConfig';

export interface DestinationLocationProps {
  form?: FormInstance;
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
    deliveryDate?: string;
    expDeliveryDate?: string;
    consigneeNotes?: string;
  };
  locationsList?: any[];
  loading?: boolean;
  clientCode?: string;
  onLocationSelect?: (location: any) => void;
  onChange?: (values: any) => void;
}

const DestinationLocation: React.FC<DestinationLocationProps> = ({
  form: externalForm,
  initialData,
  locationsList,
  clientCode,
  onLocationSelect,
  onChange,
}) => {
  const [internalForm] = Form.useForm();
  const form = externalForm || internalForm;
  const { searchPostals, loadingPostal } = usePostalLookup();
  const [, setSelectedLocationId] = useState<string | undefined>(undefined);
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isFocusedRef = useRef(false);
  const postalRef = useRef("");
  const locationsMapRef = useRef<Map<string, any>>(new Map());
  const postalRowRef = useRef<HTMLDivElement>(null);
  const [postalDropdownWidth, setPostalDropdownWidth] = useState<number | undefined>(undefined);

  const updateDropdownWidth = useCallback(() => {
    if (!postalRowRef.current) return;
    const inputs = postalRowRef.current.querySelectorAll('input');
    if (inputs.length >= 2) {
      const postalRect = inputs[0].getBoundingClientRect();
      const cityRect = inputs[1].getBoundingClientRect();
      if (cityRect.top < postalRect.bottom && cityRect.right > postalRect.left) {
        const width = Math.round(cityRect.right - postalRect.left);
        if (width > 0) {
          setPostalDropdownWidth(width);
        }
      } else {
        setPostalDropdownWidth(Math.round(postalRect.width));
      }
    }
  }, []);

  useEffect(() => {
    updateDropdownWidth();
    window.addEventListener('resize', updateDropdownWidth);
    return () => window.removeEventListener('resize', updateDropdownWidth);
  }, [updateDropdownWidth]);

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
      locationsList.forEach((loc: any, idx: number) => {
        const id = loc.locationId ?? loc.locationID ?? idx;
        locationsMapRef.current.set(String(id), loc);
        const name = (loc.locationName || "").trim().toLowerCase();
        if (name) locationsMapRef.current.set(name, loc);
      });
      setCompanyOptions(
        locationsList.map((loc: any, idx: number) => ({
          value: loc.locationName || `Location-${idx + 1}`,
          key: `prop-dest-loc-${loc.locationId || idx}`,
          location: loc,
          label: (
            <div className="loc-select-option" key={`prop-dest-lbl-${loc.locationId || idx}`}>
              <span className="loc-select-name">{loc.locationName || "Unnamed Location"}</span>
              <span className="loc-select-subtext">
                {[loc.address1 || loc.address, loc.city, loc.stateCode, loc.zipCode]
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
      const openTimeFormatted =
        formatDisplayTime(initialData.openTime) ||
        form.getFieldValue("openTime");
      const closeTimeFormatted =
        formatDisplayTime(initialData.closeTime) ||
        form.getFieldValue("closeTime");
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
        delOpenTime: openTimeFormatted,
        delCloseTime: closeTimeFormatted,
        deliveryDate: initialData.deliveryDate || "",
        expDeliveryDate: initialData.expDeliveryDate || initialData.deliveryDate || "",
        consigneeNotes: initialData.consigneeNotes || "",
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
            key: `prop-dest-loc-${loc.locationId || idx}`,
            location: loc,
            label: (
              <div className="loc-select-option" key={`prop-dest-lbl-${loc.locationId || idx}`}>
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
          dataList.forEach((loc: any, idx: number) => {
            const id = loc.locationId ?? loc.locationID ?? idx;
            locationsMapRef.current.set(String(id), loc);
            const name = (loc.locationName || "").trim().toLowerCase();
            if (name) locationsMapRef.current.set(name, loc);
          });
          setCompanyOptions(
            dataList.map((loc: any, idx: number) => ({
              value: loc.locationName || trimmed,
              key: `search-dest-${loc.locationId || idx}-${idx}`,
              location: loc,
              label: (
                <div className="loc-select-option" key={`search-dest-lbl-${loc.locationId || idx}`}>
                  <span className="loc-select-name">{loc.locationName || "Unnamed Location"}</span>
                  <span className="loc-select-subtext">
                    {[loc.address1 || loc.address, loc.city, loc.stateCode, loc.zipCode]
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
    const valKey = String(value || "").trim().toLowerCase();
    const optKey = String(option?.key || "").replace(/^(prop-dest-loc-|search-dest-)/, "").split("-")[0];

    const loc =
      option?.location ||
      option?.data?.location ||
      locationsMapRef.current.get(valKey) ||
      locationsMapRef.current.get(optKey) ||
      companyOptions.find((o) => o.value === value || o.key === option?.key)?.location ||
      (locationsList || []).find((l: any) =>
        (l.locationName && l.locationName.trim().toLowerCase() === valKey) ||
        String(l.locationId ?? l.locationID) === optKey
      );

    if (!loc) {
      form.setFieldsValue({ companyName: value });
      return;
    }

    const locId = loc.locationId ?? loc.locationID;
    if (locId) setSelectedLocationId(String(locId));

    const openTimeFormatted = formatDisplayTime(loc.openTime || loc.OpenTime) || "08:00 AM";
    const closeTimeFormatted = formatDisplayTime(loc.closeTime || loc.CloseTime) || "05:00 PM";
    const onlyZip = String(loc.zipCode || loc.ZipCode || loc.postal || loc.Postal || form.getFieldValue("postal") || "").split(' - ')[0].trim();

    const locName = loc.locationName || loc.LocationName || value;
    const addr1 = loc.address1 || loc.Address1 || loc.address || loc.Address || "";
    const addr2 = loc.address2 || loc.Address2 || "";
    const ctry = loc.countryCode || loc.CountryCode || loc.country || loc.Country || "USA";
    const cty = loc.city || loc.City || "";
    const st = loc.stateCode || loc.StateCode || loc.state || loc.State || "";
    const contact = loc.contactName || loc.ContactName || loc.contactPerson || loc.ContactPerson || "";
    const ph = formatPhoneNumber(loc.contactPhone || loc.ContactPhone || loc.phone || loc.Phone || "") || "";
    const em = loc.contactEmail || loc.ContactEmail || loc.email || loc.Email || "";

    form.setFieldsValue({
      companyName: locName,
      address1: addr1,
      address2: addr2,
      country: ctry,
      postal: onlyZip,
      city: cty,
      state: st,
      contactName: contact,
      phone: ph,
      email: em,
      openTime: openTimeFormatted,
      closeTime: closeTimeFormatted,
      delOpenTime: openTimeFormatted,
      delCloseTime: closeTimeFormatted,
    });

    if (onChange) {
      onChange(form.getFieldsValue());
    }

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
            updateDropdownWidth();
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
      title="Destination Location" 
      extra={<Button type="link" className="add-master-btn add-line-btn">+ Add to Master</Button>}
    >
      <Form
        layout="vertical"
        form={form}
        initialValues={{
          country: "USA",
          openTime: "08:00 AM",
          closeTime: "05:00 PM",
          delOpenTime: "08:00 AM",
          delCloseTime: "05:00 PM",
        }}
        onValuesChange={(_, all) => {
          if (onChange) onChange(all);
        }}
      >
        <Form.Item 
          label="Company Name" 
          name="companyName"
          rules={[{ required: true, message: "Destination Company Name is required" }]}
        >
          <AutoComplete
            options={companyOptions}
            onSearch={handleSearchCompany}
            onSelect={handleSelectCompany}
            onChange={(val) => {
              form.setFieldsValue({ companyName: val });
              const valKey = String(val || "").trim().toLowerCase();
              const matchedLoc = locationsMapRef.current.get(valKey);
              if (matchedLoc) {
                handleSelectCompany(val, { location: matchedLoc });
              } else if (onChange) {
                onChange(form.getFieldsValue());
              }
            }}
            placeholder="Company name"
            allowClear
          >
            <Input
              placeholder="Company name"
              suffix={loadingCompany ? <Spin size="small" /> : null}
            />
          </AutoComplete>
        </Form.Item>
        <Form.Item 
          label="Address Line 1" 
          name="address1"
          rules={[{ required: true, message: "Destination Address Line 1 is required" }]}
        >
          <Input placeholder="Street address" />
        </Form.Item>
        <Form.Item label="Address Line 2" name="address2">
          <Input placeholder="Suite, dock, etc." />
        </Form.Item>
        <Form.Item label="Country" name="country">
          <CountrySelect />
        </Form.Item>
        <div ref={postalRowRef}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Form.Item 
                label="Postal / ZIP" 
                name="postal"
                rules={[{ required: true, message: "Postal / ZIP is required" }]}
              >
                <AutoComplete
                  options={postalOptions}
                  onSearch={handleSearchPostal}
                  onSelect={handleSelectPostal}
                  onChange={(val) => {
                    form.setFieldsValue({ postal: val });
                    postalRef.current = val;
                    if (onChange) onChange(form.getFieldsValue());
                  }}
                  onFocus={() => {
                    isFocusedRef.current = true;
                    updateDropdownWidth();
                    if (postalOptions.length > 0) {
                      setDropdownOpen(true);
                    }
                  }}
                  onBlur={handlePostalBlur}
                  placeholder="ZIP / Postal"
                  disabled={loadingPostal}
                  notFoundContent={loadingPostal ? <Spin size="small" /> : null}
                  open={dropdownOpen}
                  onDropdownVisibleChange={(visible) => {
                    if (visible) updateDropdownWidth();
                    setDropdownOpen(visible);
                  }}
                  popupMatchSelectWidth={postalDropdownWidth || false}
                  popupStyle={{ minWidth: postalDropdownWidth || 360, width: postalDropdownWidth }}
                  dropdownStyle={{ minWidth: postalDropdownWidth || 360, width: postalDropdownWidth }}
                  popupClassName="postal-autocomplete-popup"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item 
                label="City" 
                name="city"
                rules={[{ required: true, message: "City is required" }]}
              >
                <Input placeholder="City" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item 
                label="State" 
                name="state"
                rules={[{ required: true, message: "State is required" }]}
              >
                <Input placeholder="ST" />
              </Form.Item>
            </Col>
          </Row>
        </div>
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
        <Form.Item label="Consignee Notes" name="consigneeNotes">
          <Input.TextArea placeholder="Consignee Notes" rows={3} />
        </Form.Item>
      </Form>
    </Card>
  );
};

export default DestinationLocation;

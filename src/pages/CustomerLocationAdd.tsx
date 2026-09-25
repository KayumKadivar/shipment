import { SaveOutlined } from "@ant-design/icons";
import {
  Button,
  // Checkbox,
  Form,
  Input,
  Select,
  Switch,
  message,
  AutoComplete,
  Spin,
} from "antd";
import { useNavigate, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import CountrySelect from "../components/CountrySelect";
import { usePostalLookup } from "../hooks/usePostalLookup";
// import { useAppSelector } from "../app/hooks";
import type {
  CustomerLocation,
  // LocationType,
} from "../types/customerLocation.types";

type LocationFormValues = Omit<CustomerLocation, "key">;

interface CustomerLocationAddProps {
  onCreate: (values: LocationFormValues) => void;
}

// const LOCATION_TYPES: LocationType[] = [
//   "All",
//   "Origin",
//   "Destination",
//   "Bill to",
// ];

// const GROUP_OPTIONS = [
//   "STANDARD",
//   "COLD CHAIN",
//   "DISTRIBUTION",
//   "INTERNAL",
//   "MIDWEST",
//   "PORTS",
//   "SOUTHEAST",
//   "WEST COAST",
// ];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? "00" : "30";
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";

  return {
    value: `${String(hour).padStart(2, "0")}:${minutes}`,
    label: `${displayHour}:${minutes} ${period}`,
  };
});

function getToday() {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
}

function CustomerLocationAdd({ onCreate }: CustomerLocationAddProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const clientName = location.state?.clientName || "";
  const [form] = Form.useForm<LocationFormValues>();
  const [, contextHolder] = message.useMessage();
  const { searchPostals, loadingPostal } = usePostalLookup();
  const zipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [postalOptions, setPostalOptions] = useState<{ value: string; label: string; city: string; state: string; key: string }[]>([]);

  // Handle postal code search with debounce
  const handleSearchPostal = (value: string) => {
    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }

    if (value.length >= 3) {
      zipTimeoutRef.current = setTimeout(async () => {
        const country = form.getFieldValue("countryCode") || "USA";
        const results = await searchPostals(value, country);
        
        if (results && results.length === 1) {
          // Exactly 1 result -> auto-fill immediately
          form.setFieldsValue({
            postal: results[0].postalCode || value,
            city: results[0].city,
            state: results[0].state,
          });
          setPostalOptions([]);
        } else if (results && results.length > 1) {
          // Multiple results -> show dropdown
          const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || value}|${r.city}|${r.state}`)))
            .map(str => {
              const [p, c, s] = str.split('|');
              return { postalCode: p, city: c, state: s };
            });

          setPostalOptions(
            uniqueResults.map((r, idx) => ({
              value: r.postalCode,
              label: `${r.postalCode} - ${r.city}, ${r.state}`,
              city: r.city,
              state: r.state,
              key: `postal-${idx}`
            }))
          );
        } else {
          setPostalOptions([]);
        }
      }, 600); // 600ms debounce
    } else {
      setPostalOptions([]);
    }
  };

  const handleSelectPostal = (value: string, option: any) => {
    form.setFieldsValue({
      postal: value,
      city: option.city,
      state: option.state,
    });
  };

  const handlePostalBlur = async () => {
    const postal = form.getFieldValue("postal");
    if (!postal || postal.length < 3) return;

    // Optional: if you want to avoid a duplicate call if debounce is pending
    if (zipTimeoutRef.current) {
      clearTimeout(zipTimeoutRef.current);
    }

    const country = form.getFieldValue("countryCode") || "USA";
    const results = await searchPostals(postal, country);
    
    if (results && results.length === 1) {
      form.setFieldsValue({
        postal: results[0].postalCode || postal,
        city: results[0].city,
        state: results[0].state,
      });
      // Clear options since we auto-selected
      setPostalOptions([]);
    } else if (results && results.length > 1) {
      // If there are multiple, update the options in case they come back to it
      const uniqueResults = Array.from(new Set(results.map(r => `${r.postalCode || postal}|${r.city}|${r.state}`)))
        .map(str => {
          const [p, c, s] = str.split('|');
          return { postalCode: p, city: c, state: s };
        });

      setPostalOptions(
        uniqueResults.map((r, idx) => ({
          value: r.postalCode,
          label: `${r.postalCode} - ${r.city}, ${r.state}`,
          city: r.city,
          state: r.state,
          key: `postal-${idx}`
        }))
      );
    }
  };

  // const accessorialsList = useAppSelector((state) => state.accessorials.data);

  const initialValues: Partial<LocationFormValues> = {
    locationName: "",
    shortName: "",
    isActive: true,
    address1: "",
    address2: "",
    countryCode: "USA",
    state: "",
    city: "",
    postal: "",
    port: "",
    contactName: "",
    phone: "",
    phoneExtension: "",
    email: "",
    faxNumber: "",
    activateDate: getToday(),
    deactivateDate: "",
    group: "STANDARD",
    locationType: "All",
    locationRef: "",
    inboundAccount: "",
    outboundAccount: "",
    notes: "",
    openTime: undefined,
    closeTime: undefined,
    accessorials: [],
  };

  const cancel = () => navigate("/customer-location");

  const actions = (placement: "top" | "bottom") => (
    <div className={`add-location-actions add-location-actions--${placement}`}>
      <Button onClick={cancel}>Cancel</Button>
      <Button type='primary' htmlType='submit' icon={<SaveOutlined />}>
        Save Location
      </Button>
    </div>
  );

  return (
    <section className='add-location-page'>
      {contextHolder}
      <Form<LocationFormValues>
        form={form}
        className='add-location-form'
        initialValues={initialValues}
        colon={false}
        labelAlign='left'
        labelWrap
        scrollToFirstError
        onFinish={onCreate}>
        {actions("top")}

        <div className='add-location-panels'>
          <section className='add-location-card' aria-labelledby='location-information-title'>
            <h1 id='location-information-title'>Location Information</h1>
            <div className='add-location-card__body'>
              <Form.Item label='Client'>
                <Input value={clientName} readOnly />
              </Form.Item>

              {/* <Form.Item label='Short Name' name='shortName'>
                <Input placeholder='Short name or alias' />
              </Form.Item> */}

              <Form.Item
                label='Location Name'
                name='locationName'
                required
                rules={[{ required: true, message: "Enter the location name" }]}>
                <Input placeholder='Full location name' />
              </Form.Item>

              <Form.Item
                label='Address 1'
                name='address1'
                required
                rules={[{ required: true, message: "Enter the street address" }]}>
                <Input placeholder='Street address' />
              </Form.Item>

              <Form.Item
                label='Address 2'
                name='address2'
                required
                rules={[{ required: true, message: "Enter the address 2" }]}>
                <Input placeholder='Suite, dock, unit...' />
              </Form.Item>

              <Form.Item
                name='countryCode'
                label='Country'
                rules={[{ required: true, message: "Country is required" }]}>
                <CountrySelect />
              </Form.Item>

              <Form.Item
                className='add-location-field--compact'
                label='Postal'
                name='postal'
                required
                rules={[{ required: true, message: "Enter the ZIP or postal code" }]}>
                <AutoComplete
                  options={postalOptions}
                  onSearch={handleSearchPostal}
                  onSelect={handleSelectPostal}
                  onBlur={handlePostalBlur}
                  placeholder='ZIP / Postal'
                  notFoundContent={loadingPostal ? <Spin size="small" /> : null}
                />
              </Form.Item>

              <Form.Item className='add-location-field--compact' label='State' name='state'>
                <Input placeholder='State / Province' />
              </Form.Item>

              <Form.Item
                label='City'
                name='city'
                required
                rules={[{ required: true, message: "Enter the city" }]}>
                <Input placeholder='City' />
              </Form.Item>

              {/* <Form.Item className='add-location-field--compact' label='Port' name='port'>
                <Input placeholder='Port (optional)' />
              </Form.Item> */}

              <Form.Item label='Contact Name' name='contactName'>
                <Input placeholder='Contact person' />
              </Form.Item>

              <Form.Item label='Contact Phone'>
                <div className='add-location-phone-row'>
                  <Form.Item name='phone' noStyle>
                    <Input placeholder='(___) ___-____' aria-label='Contact phone' />
                  </Form.Item>
                  <Form.Item name='phoneExtension' noStyle>
                    <Input placeholder='Ext' aria-label='Contact phone extension' />
                  </Form.Item>
                </div>
              </Form.Item>

              <Form.Item
                label='Contact Email'
                name='email'
                rules={[{ type: "email", message: "Enter a valid email address" }]}>
                <Input placeholder='email@company.com' />
              </Form.Item>

              {/* <Form.Item className='add-location-field--medium' label='Fax Number' name='faxNumber'>
                <Input placeholder='Fax number' />
              </Form.Item> */}
            </div>
          </section>

          <section className='add-location-card' aria-labelledby='location-settings-title'>
            <h1 id='location-settings-title'>Location Settings</h1>
            <div className='add-location-card__body'>
              {/* <Form.Item
                label='Location Type'
                name='locationType'
                required
                rules={[{ required: true, message: "Choose a location type" }]}>
                <Select
                  options={LOCATION_TYPES.map((value) => ({ value, label: value }))}
                />
              </Form.Item>

              <Form.Item label='Group' name='group'>
                <Select
                  options={GROUP_OPTIONS.map((value) => ({ value, label: value }))}
                />
              </Form.Item>

              <Form.Item className='add-location-field--medium' label='Activate Date' name='activateDate'>
                <Input placeholder='MM / DD / YYYY' inputMode='numeric' />
              </Form.Item>

              <Form.Item className='add-location-field--medium' label='Deactivate Date' name='deactivateDate'>
                <Input placeholder='MM / DD / YYYY' inputMode='numeric' />
              </Form.Item> */}

              <Form.Item label='Is Active' name='isActive' valuePropName='checked'>
                <Switch checkedChildren='Active' unCheckedChildren='Inactive' />
              </Form.Item>

              {/* <Form.Item label='Location Ref.' name='locationRef'>
                <Input placeholder='Reference code' />
              </Form.Item>

              <Form.Item label='Inbound Account' name='inboundAccount'>
                <Input placeholder='Inbound account #' />
              </Form.Item>

              <Form.Item label='Outbound Account' name='outboundAccount'>
                <Input placeholder='Outbound account #' />
              </Form.Item>

              <Form.Item label='Notes' name='notes'>
                <Input.TextArea
                  rows={3}
                  placeholder='Location notes or special instructions...'
                />
              </Form.Item> */}

              <Form.Item className='add-location-field--medium' label='Open Time' name='openTime'>
                <Select placeholder='-- Select --' allowClear options={TIME_OPTIONS} />
              </Form.Item>

              <Form.Item className='add-location-field--medium' label='Close Time' name='closeTime'>
                <Select placeholder='-- Select --' allowClear options={TIME_OPTIONS} />
              </Form.Item>
            </div>
          </section>
        </div>

        {/* <section className='add-location-card add-location-accessorials' aria-labelledby='accessorials-title'>
          <h1 id='accessorials-title'>Accessorials</h1>
          <div className='add-location-card__body'>
            <Form.Item name='accessorials' noStyle>
              <Checkbox.Group className='add-location-accessorial-grid'>
                {accessorialsList.map((accessorial) => (
                  <Checkbox key={accessorial.accessorialID} value={accessorial.accessorialName}>
                    {accessorial.accessorialName}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          </div>
        </section> */}

        {actions("bottom")}
      </Form>
    </section>
  );
}

export default CustomerLocationAdd;

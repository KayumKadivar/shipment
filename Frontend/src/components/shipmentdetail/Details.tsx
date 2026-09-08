import { EditOutlined } from "@ant-design/icons";
import { DatePicker, Input, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { ReactNode } from "react";
import carrierLogo from "../../assets/inland1.png";
import type { ShipmentRecord } from "../../pages/shipmentData";
import type { ShipmentDetailEditValues } from "./detailEditValues";

function cleanText(value: string) {
  return value.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function buildAddress(primary: string, meta: string) {
  return cleanText(`${primary} ${meta}`);
}

function DetailField({
  label,
  value,
  isEditing = false,
  onChange,
}: {
  label: string;
  value: string;
  isEditing?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <div className='shipment-detail-field'>
      <span>{label}</span>
      {isEditing && onChange ? (
        <Input
          className='shipment-detail-field__input'
          size='small'
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <strong>{value || "—"}</strong>
      )}
    </div>
  );
}

function parseScheduleDate(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, monthText, dayText, yearText] = match;
  const month = Number(monthText);
  const day = Number(dayText);
  const yearNumber = Number(yearText);
  const year = yearText.length === 2 ? 2000 + yearNumber : yearNumber;
  const parsed = dayjs(new Date(year, month - 1, day));

  return parsed.year() === year &&
    parsed.month() === month - 1 &&
    parsed.date() === day
    ? parsed
    : null;
}

function parseScheduleTime(value: string) {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;

  const [, hourText, minuteText, periodText] = match;
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  const normalizedHour =
    (hour % 12) + (periodText.toUpperCase() === "PM" ? 12 : 0);
  return dayjs()
    .hour(normalizedHour)
    .minute(minute)
    .second(0)
    .millisecond(0);
}

function parseScheduleTimeRange(value: string): [Dayjs, Dayjs] | null {
  const [startText, endText] = value.split(/[—–]/);
  if (!startText || !endText) return null;

  const start = parseScheduleTime(startText);
  const end = parseScheduleTime(endText);
  return start && end ? [start, end] : null;
}

function ScheduleField({
  label,
  value,
  type,
  isEditing,
  onChange,
}: {
  label: string;
  value: string;
  type: "date" | "time-range";
  isEditing: boolean;
  onChange: (value: string) => void;
}) {
  if (!isEditing) return <DetailField label={label} value={value} />;

  return (
    <div className='shipment-detail-field'>
      <span>{label}</span>
      {type === "date" ? (
        <DatePicker
          className='shipment-detail-field__picker'
          size='small'
          value={parseScheduleDate(value)}
          format='M/D/YY'
          placeholder='M/D/YY'
          onChange={(_, dateString) =>
            onChange(Array.isArray(dateString) ? dateString[0] ?? "" : dateString)
          }
        />
      ) : (
        <TimePicker.RangePicker
          className='shipment-detail-field__picker shipment-detail-field__picker--time-range'
          size='small'
          value={parseScheduleTimeRange(value)}
          format='h:mm A'
          use12Hours
          placeholder={['Start time', 'End time']}
          onChange={(_, timeStrings) =>
            onChange(
              timeStrings[0] && timeStrings[1]
                ? `${timeStrings[0]}—${timeStrings[1]}`
                : "",
            )
          }
        />
      )}
    </div>
  );
}

function DetailCard({
  title,
  children,
  editable = true,
}: {
  title: string;
  children: ReactNode;
  editable?: boolean;
}) {
  return (
    <article className='shipment-detail-card'>
      <div className='shipment-detail-card__head'>
        <h3>{title}</h3>
        {editable ? <EditOutlined /> : null}
      </div>
      <div className='shipment-detail-card__body'>{children}</div>
    </article>
  );
}

type DetailsProps = {
  shipment: ShipmentRecord;
  isEditing: boolean;
  values: ShipmentDetailEditValues;
  onFieldChange: (
    field: keyof ShipmentDetailEditValues,
    value: string,
  ) => void;
};

function Details({
  shipment,
  isEditing,
  values,
  onFieldChange,
}: DetailsProps) {
  const originAddress = buildAddress(shipment.origin, shipment.originMeta);
  const destinationAddress = buildAddress(
    shipment.destination,
    shipment.destinationMeta,
  );

  const editableField = (
    label: string,
    field: keyof ShipmentDetailEditValues,
  ) => (
    <DetailField
      label={label}
      value={values[field]}
      isEditing={isEditing}
      onChange={(value) => onFieldChange(field, value)}
    />
  );

  return (
    <section aria-label={`Details for shipment ${shipment.bol}`}>
      <div className='shipment-detail-grid'>
        <DetailCard title='Pickup'>
          {editableField("Company name", "pickupCompanyName")}
          {editableField("Address Line 1", "pickupAddressLine1")}
          {editableField("Address Line 2", "pickupAddressLine2")}
          {editableField("City/state/zip", "pickupCityStateZip")}
          {editableField("Contact phone", "pickupContactPhone")}
        </DetailCard>

        <DetailCard title='Delivery'>
          {editableField("Company name", "deliveryCompanyName")}
          {editableField("Address Line 1", "deliveryAddressLine1")}
          {editableField("Address Line 2", "deliveryAddressLine2")}
          {editableField("City/state/zip", "deliveryCityStateZip")}
          {editableField("Contact phone", "deliveryContactPhone")}
        </DetailCard>

        <DetailCard title='Schedule'>
          <ScheduleField
            label='Pickup date'
            value={values.schedulePickupDate}
            type='date'
            isEditing={isEditing}
            onChange={(value) => onFieldChange("schedulePickupDate", value)}
          />
          <ScheduleField
            label='Pickup time'
            value={values.schedulePickupTime}
            type='time-range'
            isEditing={isEditing}
            onChange={(value) => onFieldChange("schedulePickupTime", value)}
          />
          <ScheduleField
            label='Delivery date'
            value={values.scheduleDeliveryDate}
            type='date'
            isEditing={isEditing}
            onChange={(value) => onFieldChange("scheduleDeliveryDate", value)}
          />
          <ScheduleField
            label='Delivery time'
            value={values.scheduleDeliveryTime}
            type='time-range'
            isEditing={isEditing}
            onChange={(value) => onFieldChange("scheduleDeliveryTime", value)}
          />
          <ScheduleField
            label='Actual delivery date'
            value={values.scheduleActualDeliveryDate}
            type='date'
            isEditing={isEditing}
            onChange={(value) =>
              onFieldChange("scheduleActualDeliveryDate", value)
            }
          />
          <ScheduleField
            label='Actual pickup date'
            value={values.scheduleActualPickupDate}
            type='date'
            isEditing={isEditing}
            onChange={(value) =>
              onFieldChange("scheduleActualPickupDate", value)
            }
          />
        </DetailCard>

        <DetailCard title='Booking Info'>
          <DetailField label='Created By' value='Chuck Hachemeister' />
          <DetailField label='Tendered By' value='Chuck Hachemeister' />
        </DetailCard>
      </div>

      <h2 className='shipment-detail-section-title'>Carrier Information</h2>

      <div className='shipment-detail-grid'>
        <DetailCard title='Origin Terminal' editable={false}>
          <DetailField label='Address Line 1' value={originAddress} />
          <DetailField
            label='City/state/zip'
            value={cleanText(shipment.originMeta)}
          />
          <DetailField label='Contact phone' value='+1 (800) 716-6787' />
        </DetailCard>

        <DetailCard title='Destination Terminal' editable={false}>
          <DetailField label='Address Line 1' value={destinationAddress} />
          <DetailField
            label='City/state/zip'
            value={cleanText(shipment.destinationMeta)}
          />
          <DetailField label='Contact phone' value='+1 (614) 921-2121' />
        </DetailCard>

        <article className='shipment-detail-card shipment-detail-carrier-card'>
          <img src={carrierLogo} alt='Carrier logo' />
          <DetailField label='Mode' value='LTL' />
        </article>

        <DetailCard title='Note'>
          <DetailField
            label='Pickup Note'
            value={shipment.carrierNote || "Kowa Ref 20154"}
          />
          <DetailField
            label='Delivery Note'
            value={`PO# ${shipment.customerNo}`}
          />
        </DetailCard>
      </div>
    </section>
  );
}

export default Details;

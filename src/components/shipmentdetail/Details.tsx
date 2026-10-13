import { DatePicker, Input, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type { ReactNode } from "react";
import carrierLogo from "../../assets/inland1.png";
import type { ShipmentDetails } from "../../types/shipment.types";
import DetailEditActions from "./DetailEditActions";
import {
  text,
  type ShipmentDetailEditSection,
  type ShipmentDetailEditValues,
} from "./detailEditValues";

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
    <div
      className={`shipment-detail-field${
        isEditing && onChange ? " shipment-detail-field--editing" : ""
      }`}
    >
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
        <strong>{value}</strong>
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
    <div className='shipment-detail-field shipment-detail-field--editing'>
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
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className='shipment-detail-card'>
      <div className='shipment-detail-card__head'>
        <h3>{title}</h3>
        {actions}
      </div>
      <div className='shipment-detail-card__body'>{children}</div>
    </article>
  );
}

type DetailsProps = {
  shipment: ShipmentDetails;
  activeEditor: ShipmentDetailEditSection | null;
  values: ShipmentDetailEditValues;
  onFieldChange: (
    field: keyof ShipmentDetailEditValues,
    value: string,
  ) => void;
  onBeginEditing: (section: ShipmentDetailEditSection) => void;
  onSaveEditing: () => void;
  onCancelEditing: () => void;
};

function Details({
  shipment,
  activeEditor,
  values,
  onFieldChange,
  onBeginEditing,
  onSaveEditing,
  onCancelEditing,
}: DetailsProps) {
  const editableField = (
    label: string,
    field: keyof ShipmentDetailEditValues,
    section: ShipmentDetailEditSection,
  ) => (
    <DetailField
      label={label}
      value={values[field]}
      isEditing={activeEditor === section}
      onChange={(value) => onFieldChange(field, value)}
    />
  );

  const editActions = (
    label: string,
    section: ShipmentDetailEditSection,
  ) => (
    <DetailEditActions
      label={label}
      isEditing={activeEditor === section}
      disabled={activeEditor !== null && activeEditor !== section}
      onEdit={() => onBeginEditing(section)}
      onSave={onSaveEditing}
      onCancel={onCancelEditing}
    />
  );

  return (
    <section aria-label={`Details for shipment ${shipment.loadNumber}`}>
      <div className='shipment-detail-grid'>
        <DetailCard title='Pickup' actions={editActions("Pickup", "pickup")}>
          {editableField("Company name", "pickupCompanyName", "pickup")}
          {editableField("Address Line 1", "pickupAddressLine1", "pickup")}
          {editableField("Address Line 2", "pickupAddressLine2", "pickup")}
          {editableField("City/state/zip", "pickupCityStateZip", "pickup")}
          {editableField("Contact phone", "pickupContactPhone", "pickup")}
          {editableField("Origin Email", "originEmail", "pickup")}
        </DetailCard>

        <DetailCard
          title='Delivery'
          actions={editActions("Delivery", "delivery")}>
          {editableField("Company name", "deliveryCompanyName", "delivery")}
          {editableField("Address Line 1", "deliveryAddressLine1", "delivery")}
          {editableField("Address Line 2", "deliveryAddressLine2", "delivery")}
          {editableField("City/state/zip", "deliveryCityStateZip", "delivery")}
          {editableField("Contact phone", "deliveryContactPhone", "delivery")}
          {editableField("Destination Email", "destinationEmail", "delivery")}
        </DetailCard>

        <DetailCard
          title='Schedule'
          actions={editActions("Schedule", "schedule")}>
          <ScheduleField
            label='Pickup date'
            value={values.schedulePickupDate}
            type='date'
            isEditing={activeEditor === "schedule"}
            onChange={(value) => onFieldChange("schedulePickupDate", value)}
          />
          <ScheduleField
            label='Pickup time'
            value={values.schedulePickupTime}
            type='time-range'
            isEditing={activeEditor === "schedule"}
            onChange={(value) => onFieldChange("schedulePickupTime", value)}
          />
          <ScheduleField
            label='Delivery date'
            value={values.scheduleDeliveryDate}
            type='date'
            isEditing={activeEditor === "schedule"}
            onChange={(value) => onFieldChange("scheduleDeliveryDate", value)}
          />
          <ScheduleField
            label='Delivery time'
            value={values.scheduleDeliveryTime}
            type='time-range'
            isEditing={activeEditor === "schedule"}
            onChange={(value) => onFieldChange("scheduleDeliveryTime", value)}
          />
          <ScheduleField
            label='Actual delivery date'
            value={values.scheduleActualDeliveryDate}
            type='date'
            isEditing={activeEditor === "schedule"}
            onChange={(value) =>
              onFieldChange("scheduleActualDeliveryDate", value)
            }
          />
          <ScheduleField
            label='Actual pickup date'
            value={values.scheduleActualPickupDate}
            type='date'
            isEditing={activeEditor === "schedule"}
            onChange={(value) =>
              onFieldChange("scheduleActualPickupDate", value)
            }
          />
        </DetailCard>

        <DetailCard title='Bill To' actions={editActions("Bill To", "billTo")}>
          {editableField("Company name", "billToName", "billTo")}
          {editableField("Address Line 1", "billToAddress1", "billTo")}
          {editableField("Address Line 2", "billToAddress2", "billTo")}
          {editableField("City", "billToCityName", "billTo")}
          {editableField("State", "billToStateCode", "billTo")}
          {editableField("Postal code", "billToPostalCode", "billTo")}
          {editableField("Country", "billToCountryCode", "billTo")}
          {editableField("Fax", "billToFaxNo", "billTo")}
        </DetailCard>
      </div>

      <h2 className='shipment-detail-section-title'>Carrier Information</h2>

      <div className='shipment-detail-grid'>
        <DetailCard title='Origin Terminal'>
          <DetailField label='Address Line 1' value='' />
          <DetailField label='City/state/zip' value='' />
          <DetailField label='Contact phone' value='' />
        </DetailCard>

        <DetailCard title='Destination Terminal'>
          <DetailField label='Address Line 1' value='' />
          <DetailField label='City/state/zip' value='' />
          <DetailField label='Contact phone' value='' />
        </DetailCard>

        <article className='shipment-detail-card shipment-detail-carrier-card'>
          <img src={carrierLogo} alt='Carrier logo' />
          <DetailField
            label='Mode'
            value={text(shipment.equipment || shipment.shipmentMode)}
          />
        </article>

        <DetailCard title='Note' actions={editActions("Note", "note")}>
          {editableField("Pickup Note", "pickupNote", "note")}
          {editableField("Delivery Note", "deliveryNote", "note")}
        </DetailCard>
      </div>
    </section>
  );
}

export default Details;

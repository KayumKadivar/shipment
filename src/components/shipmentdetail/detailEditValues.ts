import dayjs from "dayjs";
import type { ShipmentDetails } from "../../types/shipment.types";

export type ShipmentDetailEditSection =
  | "referenceNumbers"
  | "pickup"
  | "delivery"
  | "schedule"
  | "billTo"
  | "note";

export type ShipmentDetailEditValues = {
  referenceBol: string;
  referenceCarrierPickup: string;
  referenceCarrierQuoteNumber: string;
  referenceTrackingNumber: string;
  referenceLoad: string;
  pickupCompanyName: string;
  pickupAddressLine1: string;
  pickupAddressLine2: string;
  pickupCityStateZip: string;
  pickupContactPhone: string;
  originEmail: string;
  deliveryCompanyName: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string;
  deliveryCityStateZip: string;
  deliveryContactPhone: string;
  destinationEmail: string;
  billToName: string;
  billToAddress1: string;
  billToAddress2: string;
  billToCountryCode: string;
  billToPostalCode: string;
  billToStateCode: string;
  billToCityName: string;
  billToFaxNo: string;
  clientEmail: string;
  schedulePickupDate: string;
  schedulePickupTime: string;
  scheduleDeliveryDate: string;
  scheduleDeliveryTime: string;
  scheduleActualDeliveryDate: string;
  scheduleActualPickupDate: string;
  pickupNote: string;
  deliveryNote: string;
};

export function text(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function joinNonEmpty(
  values: Array<string | null | undefined>,
  separator = " ",
) {
  return values.map(text).filter(Boolean).join(separator);
}

export function formatApiDate(value: string | null | undefined) {
  const normalized = text(value);
  if (!normalized) return "";

  const parsed = dayjs(normalized);
  return parsed.isValid() ? parsed.format("M/D/YYYY") : normalized;
}

function timeRange(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  const values = [text(start), text(end)].filter(Boolean);
  return values.join("—");
}

export function createShipmentDetailEditValues(
  shipment: ShipmentDetails,
): ShipmentDetailEditValues {
  return {
    referenceBol: text(shipment.carrierBolNo),
    referenceCarrierPickup: text(shipment.pickupNo),
    referenceCarrierQuoteNumber: text(shipment.saasQuoteNumber),
    referenceTrackingNumber: text(shipment.proNumber),
    referenceLoad: text(shipment.loadNumber),
    pickupCompanyName: text(shipment.originName),
    pickupAddressLine1: text(shipment.originAddress1),
    pickupAddressLine2: text(shipment.originAddress2),
    pickupCityStateZip: joinNonEmpty(
      [shipment.orgCityName, shipment.orgStateCode, shipment.orgPostalCode],
      ", ",
    ),
    pickupContactPhone: text(shipment.orgPhoneNumber),
    originEmail: text(shipment.originEmail),
    deliveryCompanyName: text(shipment.destName),
    deliveryAddressLine1: text(shipment.destAddress1),
    deliveryAddressLine2: text(shipment.destAddress2),
    deliveryCityStateZip: joinNonEmpty(
      [shipment.destCityName, shipment.destStateCode, shipment.destPostalCode],
      ", ",
    ),
    deliveryContactPhone: text(shipment.destPhoneNo),
    destinationEmail: text(shipment.destEmail),
    billToName: text(shipment.billToName),
    billToAddress1: text(shipment.billToAddress1),
    billToAddress2: text(shipment.billToAddress2),
    billToCountryCode: text(shipment.billToCountryCode),
    billToPostalCode: text(shipment.billToPostalCode),
    billToStateCode: text(shipment.billToStateCode),
    billToCityName: text(shipment.billToCityName),
    billToFaxNo: text(shipment.billToFaxNo),
    clientEmail: text(shipment.clientEmail),
    schedulePickupDate: formatApiDate(
      shipment.pickupdate || shipment.expectedShipDate,
    ),
    schedulePickupTime: timeRange(
      shipment.pickUpReadyTime || shipment.pickupTime,
      shipment.pickUpCloseTime,
    ),
    scheduleDeliveryDate: formatApiDate(shipment.requestedDeliveryDate),
    scheduleDeliveryTime: timeRange(
      shipment.requestedDeliveryTime,
      shipment.requestedDeliveryTimeTo,
    ),
    scheduleActualDeliveryDate: formatApiDate(shipment.deliveryDate),
    scheduleActualPickupDate: "",
    pickupNote: text(shipment.originNote || shipment.carrierNote),
    deliveryNote: text(shipment.destNote),
  };
}

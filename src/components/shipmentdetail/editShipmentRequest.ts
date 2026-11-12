import { SRV_TOKEN } from "../../config/apiConfig";
import type { EditShipmentRequest, EditShipmentRateRequest } from "../../types/editShipment.types";
import type { ShipmentDetails, ShipmentRate } from "../../types/shipment.types";
import { createShipmentDetailEditValues, type ShipmentDetailEditValues } from "./detailEditValues";

/** Converts optional API numbers without accepting NaN or infinity. */
function amount(value: number | null | undefined): number {
  if (value == null) return 0;
  if (!Number.isFinite(value)) throw new Error("Shipment amounts must be finite numbers.");
  return value;
}

/** Creates a detached rate body using the edit endpoint's non-null numeric contract. */
function rateRequest(rate: ShipmentRate | null): EditShipmentRateRequest {
  return {
    freight: amount(rate?.freight), fuel: amount(rate?.fuel), discount: amount(rate?.discount),
    accesorialCostDetails: (rate?.accesorialCostDetails ?? []).map((detail) => ({
      accCode: detail.accCode ?? "", description: detail.description ?? "",
      ratedCost: amount(detail.ratedCost), billedCost: amount(detail.billedCost),
    })),
  };
}

/** Parses a displayed calendar date without applying the browser's timezone. */
function calendarDate(value: string, label: string): string | null {
  if (!value.trim()) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`${label} must be a valid calendar date.`);
  const [, month, day, yearText] = match;
  const year = yearText.length === 2 ? `20${yearText}` : yearText;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`${label} must be a valid calendar date.`);
  }
  return date.toISOString();
}

/** Converts one edited time range to the start/end fields expected by the API. */
function timeRange(value: string): [string, string] {
  if (!value.trim()) return ["", ""];
  const parts = value.replaceAll("\u00e2\u20ac\u201d", "\u2014")
    .split(/[\u2014\u2013-]/).map((part) => part.trim());
  if (parts.length > 2 || parts.some((part) => !/^(?:([01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?|(0?[1-9]|1[0-2]):[0-5]\d\s*(AM|PM))$/i.test(part))) {
    throw new Error("Schedule times must contain valid times or a start/end range.");
  }
  return [parts[0], parts[1] ?? ""];
}

/** Splits the page's location editor into three API fields. */
function locationParts(value: string): [string, string, string] {
  const parts = value.split(",").map((part) => part.trim());
  const postal = parts.pop() ?? "";
  const state = parts.pop() ?? "";
  const city = parts.join(", ");
  if (!city || !state || !postal) throw new Error("Locations must use the City, State, ZIP format.");
  return [city, state, postal];
}

/** Builds a whitelisted edit body from accepted UI values, retaining undisplayed data. */
export function createEditShipmentRequest({ shipment, detailValues, username }: {
  shipment: ShipmentDetails;
  detailValues: ShipmentDetailEditValues;
  username: string | null | undefined;
}): EditShipmentRequest {
  const initial = createShipmentDetailEditValues(shipment);
  const request: EditShipmentRequest = {
    createLoadInTms: shipment.createLoadInTms,
    sendCarrierPickupReq: shipment.sendCarrierPickupReq,
    originName: shipment.originName ?? "",
    originAddress1: shipment.originAddress1 ?? "",
    originAddress2: shipment.originAddress2 ?? "",
    orgCountryCode: shipment.orgCountryCode ?? "",
    orgStateCode: shipment.orgStateCode ?? "",
    orgPostalCode: shipment.orgPostalCode ?? "",
    orgCityName: shipment.orgCityName ?? "",
    destName: shipment.destName ?? "",
    destAddress1: shipment.destAddress1 ?? "",
    destAddress2: shipment.destAddress2 ?? "",
    destCountryCode: shipment.destCountryCode ?? "",
    destStateCode: shipment.destStateCode ?? "",
    destPostalCode: shipment.destPostalCode ?? "",
    destCityName: shipment.destCityName ?? "",
    pickupdate: shipment.pickupdate ?? "",
    loadNumber: shipment.loadNumber ?? "",
    proNumber: shipment.proNumber ?? "",
    scac: shipment.scac ?? "",
    sellSCAC: shipment.sellSCAC ?? "",
    clientCode: shipment.clientCode ?? "",
    ladingID: amount(shipment.ladingID),
    srvToken: SRV_TOKEN,
    products: shipment.products.map((product) => ({
      productDescription: product.productDescription ?? "",
      productClass: product.productClass ?? "",
      productWeight: amount(product.productWeight),
      pallets: amount(product.pallets),
      pieces: amount(product.pieces),
      nmfc: product.nmfc ?? "",
      hazMat: product.hazMat ?? false,
      length: amount(product.length),
      width: amount(product.width),
      height: amount(product.height),
      pcf: amount(product.pcf),
      packageType: product.packageType ?? "",
      skuNumber: product.skuNumber ?? "",
      accountNumber: product.accountNumber ?? "",
      linearFeet: amount(product.linearFeet),
      hazmatProperShippingName: product.hazmatProperShippingName ?? "",
      hazmatClass: product.hazmatClass ?? "",
      hazmatUnNaNumber: product.hazmatUnNaNumber ?? "",
      hazmatPhone: product.hazmatPhone ?? "",
      hazmatGroup: product.hazmatGroup ?? "",
      hazmatContact: product.hazmatContact ?? "",
      stackable: product.stackable ?? false,
    })),
    orgCompanyName: shipment.orgCompanyName ?? "",
    orgContactFirstName: shipment.orgContactFirstName ?? "",
    orgContactLastName: shipment.orgContactLastName ?? "",
    orgPhoneAreaCode: shipment.orgPhoneAreaCode ?? "",
    orgPhoneNumber: shipment.orgPhoneNumber ?? "",
    orgWhoEntered: shipment.orgWhoEntered ?? "",
    orgWhoPhoneNumber: shipment.orgWhoPhoneNumber ?? "",
    pickUpReadyTime: shipment.pickUpReadyTime ?? "",
    pickUpCloseTime: shipment.pickUpCloseTime ?? "",
    isTestMode: shipment.isTestMode,
    brokerCode: shipment.brokerCode ?? "",
    clientAddress1: shipment.clientAddress1 ?? "",
    clientAddress2: shipment.clientAddress2 ?? "",
    clientCountryCode: shipment.clientCountryCode ?? "",
    clientCityName: shipment.clientCityName ?? "",
    clientEmail: shipment.clientEmail ?? "",
    clientName: shipment.clientName ?? "",
    clientPhone: shipment.clientPhone ?? "",
    clientStateCode: shipment.clientStateCode ?? "",
    clientZipCode: shipment.clientZipCode ?? "",
    pickupTime: shipment.pickupTime ?? "",
    originFax: shipment.originFax ?? "",
    originEmail: shipment.originEmail ?? "",
    originNote: shipment.originNote ?? "",
    destContact: shipment.destContact ?? "",
    destPhoneNo: shipment.destPhoneNo ?? "",
    destEmail: shipment.destEmail ?? "",
    destFaxNo: shipment.destFaxNo ?? "",
    destNote: shipment.destNote ?? "",
    ref1Value: shipment.ref1Value ?? "",
    ref2Value: shipment.ref2Value ?? "",
    ref3Value: shipment.ref3Value ?? "",
    pickupNo: shipment.pickupNo ?? "",
    poNumber: shipment.poNumber ?? "",
    brokerRefNo: shipment.brokerRefNo ?? "",
    expectedShipDate: shipment.expectedShipDate ?? null,
    requestedDeliveryDate: shipment.requestedDeliveryDate ?? null,
    requestedDeliveryTime: shipment.requestedDeliveryTime ?? "",
    shipmentValue: shipment.shipmentValue ?? null,
    valuePerPound: shipment.valuePerPound ?? null,
    specialNotes: shipment.specialNotes ?? "",
    carrierNote: shipment.carrierNote ?? "",
    billToName: shipment.billToName ?? "",
    billToAddress1: shipment.billToAddress1 ?? "",
    billToAddress2: shipment.billToAddress2 ?? "",
    billToCountryCode: shipment.billToCountryCode ?? "",
    billToPostalCode: shipment.billToPostalCode ?? "",
    billToStateCode: shipment.billToStateCode ?? "",
    billToCityName: shipment.billToCityName ?? "",
    billToFaxNo: shipment.billToFaxNo ?? "",
    bolDispatchNotes: [...(shipment.bolDispatchNotes ?? [])],
    accessorials: [...(shipment.accessorials ?? [])],
    paymentTerms: shipment.paymentTerms ?? "",
    orgContactPerson: shipment.orgContactPerson ?? "",
    deliveryDate: shipment.deliveryDate ?? null,
    deliveryTime: shipment.deliveryTime ?? "",
    carrierBolNo: shipment.carrierBolNo ?? "",
    buyRate: rateRequest(shipment.buyRate),
    sellRate: rateRequest(shipment.sellRate),
    shipmentMode: shipment.shipmentMode ?? "",
    equipment: shipment.equipment ?? "",
    totalLength: amount(shipment.totalLength),
    totalWidth: amount(shipment.totalWidth),
    totalHeight: amount(shipment.totalHeight),
    wiseTechTransactionNo: shipment.wiseTechTransactionNo ?? "",
    userName: username?.trim() || shipment.userName || "",
    originPortCode: shipment.originPortCode ?? "",
    destinationPortCode: shipment.destinationPortCode ?? "",
    requestedDeliveryTimeTo: shipment.requestedDeliveryTimeTo ?? "",
    codAmount: shipment.codAmount ?? null,
    totalLinearFeet: shipment.totalLinearFeet ?? null,
    sellCarrierName: shipment.sellCarrierName ?? "",
    bolStatus: shipment.bolStatus ?? "",
  };
  if (detailValues.referenceBol !== initial.referenceBol) request.carrierBolNo = detailValues.referenceBol.trim();
  if (detailValues.referenceCarrierPickup !== initial.referenceCarrierPickup) request.pickupNo = detailValues.referenceCarrierPickup.trim();
  if (detailValues.referenceTrackingNumber !== initial.referenceTrackingNumber) request.proNumber = detailValues.referenceTrackingNumber.trim();
  if (detailValues.pickupCompanyName !== initial.pickupCompanyName) request.originName = detailValues.pickupCompanyName.trim();
  if (detailValues.pickupAddressLine1 !== initial.pickupAddressLine1) request.originAddress1 = detailValues.pickupAddressLine1.trim();
  if (detailValues.pickupAddressLine2 !== initial.pickupAddressLine2) request.originAddress2 = detailValues.pickupAddressLine2.trim();
  if (detailValues.pickupContactPhone !== initial.pickupContactPhone) request.orgPhoneNumber = detailValues.pickupContactPhone.trim();
  if (detailValues.originEmail !== initial.originEmail) request.originEmail = detailValues.originEmail.trim();
  if (detailValues.deliveryCompanyName !== initial.deliveryCompanyName) request.destName = detailValues.deliveryCompanyName.trim();
  if (detailValues.deliveryAddressLine1 !== initial.deliveryAddressLine1) request.destAddress1 = detailValues.deliveryAddressLine1.trim();
  if (detailValues.deliveryAddressLine2 !== initial.deliveryAddressLine2) request.destAddress2 = detailValues.deliveryAddressLine2.trim();
  if (detailValues.deliveryContactPhone !== initial.deliveryContactPhone) request.destPhoneNo = detailValues.deliveryContactPhone.trim();
  if (detailValues.destinationEmail !== initial.destinationEmail) request.destEmail = detailValues.destinationEmail.trim();
  if (detailValues.pickupNote !== initial.pickupNote) request.originNote = detailValues.pickupNote.trim();
  if (detailValues.deliveryNote !== initial.deliveryNote) request.destNote = detailValues.deliveryNote.trim();
  if (detailValues.billToName !== initial.billToName) request.billToName = detailValues.billToName.trim();
  if (detailValues.billToAddress1 !== initial.billToAddress1) request.billToAddress1 = detailValues.billToAddress1.trim();
  if (detailValues.billToAddress2 !== initial.billToAddress2) request.billToAddress2 = detailValues.billToAddress2.trim();
  if (detailValues.billToCountryCode !== initial.billToCountryCode) request.billToCountryCode = detailValues.billToCountryCode.trim();
  if (detailValues.billToPostalCode !== initial.billToPostalCode) request.billToPostalCode = detailValues.billToPostalCode.trim();
  if (detailValues.billToStateCode !== initial.billToStateCode) request.billToStateCode = detailValues.billToStateCode.trim();
  if (detailValues.billToCityName !== initial.billToCityName) request.billToCityName = detailValues.billToCityName.trim();
  if (detailValues.billToFaxNo !== initial.billToFaxNo) request.billToFaxNo = detailValues.billToFaxNo.trim();
  if (detailValues.clientEmail !== initial.clientEmail) request.clientEmail = detailValues.clientEmail.trim();
  if (detailValues.pickupCityStateZip !== initial.pickupCityStateZip) {
    [request.orgCityName, request.orgStateCode, request.orgPostalCode] = locationParts(detailValues.pickupCityStateZip);
  }
  if (detailValues.deliveryCityStateZip !== initial.deliveryCityStateZip) {
    [request.destCityName, request.destStateCode, request.destPostalCode] = locationParts(detailValues.deliveryCityStateZip);
  }
  if (detailValues.schedulePickupDate !== initial.schedulePickupDate) {
    request.pickupdate = calendarDate(detailValues.schedulePickupDate, "Pickup date") ?? "";
  }
  if (detailValues.scheduleDeliveryDate !== initial.scheduleDeliveryDate) {
    request.requestedDeliveryDate = calendarDate(detailValues.scheduleDeliveryDate, "Delivery date");
  }
  if (detailValues.scheduleActualDeliveryDate !== initial.scheduleActualDeliveryDate) {
    request.deliveryDate = calendarDate(detailValues.scheduleActualDeliveryDate, "Actual delivery date");
  }
  if (detailValues.schedulePickupTime !== initial.schedulePickupTime) {
    [request.pickUpReadyTime, request.pickUpCloseTime] = timeRange(detailValues.schedulePickupTime);
    request.pickupTime = request.pickUpReadyTime;
  }
  if (detailValues.scheduleDeliveryTime !== initial.scheduleDeliveryTime) {
    [request.requestedDeliveryTime, request.requestedDeliveryTimeTo] = timeRange(detailValues.scheduleDeliveryTime);
  }
  if (!request.loadNumber.trim() || !request.clientCode.trim()) throw new Error("Shipment load number and client code are required.");
  if (!request.products.length || request.products.some((product) => !product.productDescription.trim() || product.productWeight <= 0)) {
    throw new Error("At least one product with a description and positive weight is required.");
  }
  return request;
}

import type { ShipmentRecord } from "../../pages/shipmentData";

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
  deliveryCompanyName: string;
  deliveryAddressLine1: string;
  deliveryAddressLine2: string;
  deliveryCityStateZip: string;
  deliveryContactPhone: string;
  schedulePickupDate: string;
  schedulePickupTime: string;
  scheduleDeliveryDate: string;
  scheduleDeliveryTime: string;
  scheduleActualDeliveryDate: string;
  scheduleActualPickupDate: string;
};

function cleanText(value: string) {
  return value.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

function getDeliveryDate(shipment: ShipmentRecord) {
  const lines = shipment.delivery
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines[lines.length - 1] ?? "Pending";
}

export function createShipmentDetailEditValues(
  shipment: ShipmentRecord,
): ShipmentDetailEditValues {
  const customer = cleanText(shipment.customer);

  return {
    referenceBol: shipment.bol,
    referenceCarrierPickup: shipment.pro,
    referenceCarrierQuoteNumber: shipment.customerNo,
    referenceTrackingNumber: shipment.pro,
    referenceLoad: `${shipment.pallets} pallets · ${shipment.weight}`,
    pickupCompanyName: `${customer} Warehouse`,
    pickupAddressLine1: cleanText(shipment.origin),
    pickupAddressLine2: "Dock Door #9 for PMC Others #10-15",
    pickupCityStateZip: cleanText(shipment.originMeta),
    pickupContactPhone: "+1 (847) 952-1289",
    deliveryCompanyName: `${customer} Company`,
    deliveryAddressLine1: cleanText(shipment.destination),
    deliveryAddressLine2: "Receiving Dock",
    deliveryCityStateZip: cleanText(shipment.destinationMeta),
    deliveryContactPhone: "+1 (937) 262-6243",
    schedulePickupDate: shipment.pickupDate,
    schedulePickupTime: "8:00 AM—3:00 PM",
    scheduleDeliveryDate: getDeliveryDate(shipment),
    scheduleDeliveryTime: "8:00 AM—5:00 PM",
    scheduleActualDeliveryDate: "",
    scheduleActualPickupDate: "",
  };
}

import { createGetRatesRequest } from "../../lib/createGetRatesRequest";
import dayjs from "dayjs";
import { SRV_TOKEN } from "../../config/apiConfig";
import type {
  ShipmentDetails,
  ShipmentRerateLoadValues,
  ShipmentRerateProduct,
  ShipmentRerateRequest,
} from "../../types/shipment.types";
import type { ShipmentDetailEditValues } from "./detailEditValues";

type CreateShipmentRerateRequestArgs = {
  shipment: ShipmentDetails;
  detailValues: ShipmentDetailEditValues;
  loadValues: ShipmentRerateLoadValues;
  ratingProfileCode: string;
  ratingClientCode: string;
};

type ParsedLocation = {
  city: string;
  state: string;
  postalCode: string;
};

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function parseLocation(value: string, label: string): ParsedLocation {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 3) {
    throw new Error(`${label} must use the City, State, ZIP format.`);
  }

  const postalCode = parts.pop() ?? "";
  const state = parts.pop() ?? "";
  const city = parts.join(", ");

  if (!city || !state || !postalCode) {
    throw new Error(`${label} must use the City, State, ZIP format.`);
  }

  return { city, state, postalCode };
}

function resolveInitialAccessorialCodes(shipment: ShipmentDetails) {
  const details = [
    ...(shipment.buyRate?.accesorialCostDetails ?? []),
    ...(shipment.sellRate?.accesorialCostDetails ?? []),
  ];
  const sourceValues =
    shipment.accessorials?.filter((value) => value.trim()) ?? [];
  const values = sourceValues.length
    ? sourceValues
    : details.map((detail) => detail.accCode || detail.description || "");

  return [...new Set(values.map((value) => {
    const normalizedValue = value.trim().toLocaleLowerCase();
    const matchingDetail = details.find((detail) =>
      [detail.accCode, detail.description].some(
        (candidate) => candidate?.trim().toLocaleLowerCase() === normalizedValue,
      ),
    );

    return cleanText(matchingDetail?.accCode) || value.trim();
  }).filter(Boolean))];
}

/** Maps the API-loaded shipment into the initial editable rating values. */
export function createShipmentRerateLoadValues(
  shipment: ShipmentDetails,
): ShipmentRerateLoadValues {
  return {
    shipments: shipment.products.map(
      (product): ShipmentRerateProduct => ({
        class: cleanText(product.productClass),
        weight: finiteNumber(product.productWeight),
        weightUnit: "Lbs",
        units: finiteNumber(product.pallets ?? product.pieces) || 1,
        cubicFeet: 0,
        hazMat: product.hazMat,
        hazMatClass: cleanText(product.hazmatClass) || undefined,
        hazMatUN: cleanText(product.hazmatUnNaNumber) || undefined,
        hazMatProperShippingName:
          cleanText(product.hazmatProperShippingName) || undefined,
        hazMatPackingGroup: cleanText(product.hazmatGroup) || undefined,
        hazMatPhone: cleanText(product.hazmatPhone) || undefined,
        hazMatContact: cleanText(product.hazmatContact) || undefined,
        nmfc: cleanText(product.nmfc) || undefined,
        description: cleanText(product.productDescription) || undefined,
        pallets: finiteNumber(product.pallets),
        pieces: finiteNumber(product.pieces) || 1,
        length: finiteNumber(product.length),
        width: finiteNumber(product.width),
        height: finiteNumber(product.height),
        packageType: cleanText(product.packageType) || undefined,
        linearFeet: finiteNumber(product.linearFeet),
        stackable: product.stackable ?? false,
      }),
    ),
    accessorialCodes: resolveInitialAccessorialCodes(shipment),
  };
}

/** Creates and validates the request body for rerating the displayed shipment. */
export function createShipmentRerateRequest({
  shipment,
  detailValues,
  loadValues,
  ratingProfileCode,
  ratingClientCode,
}: CreateShipmentRerateRequestArgs): ShipmentRerateRequest {
  const origin = parseLocation(detailValues.pickupCityStateZip, "Pickup location");
  const destination = parseLocation(
    detailValues.deliveryCityStateZip,
    "Delivery location",
  );
  const shipmentDate = dayjs(detailValues.schedulePickupDate);
  const scac = cleanText(shipment.scac) || cleanText(shipment.sellSCAC);

  if (!shipmentDate.isValid()) {
    throw new Error("A valid pickup date is required to re-rate the shipment.");
  }

  if (!scac) {
    throw new Error("A carrier SCAC is required to re-rate the shipment.");
  }

  if (!loadValues.shipments.length) {
    throw new Error("At least one product line is required to re-rate the shipment.");
  }

  loadValues.shipments.forEach((product, index) => {
    if (!product.class || product.weight <= 0 || product.units <= 0) {
      throw new Error(
        `Product line ${index + 1} requires class, weight, and units to re-rate the shipment.`,
      );
    }
  });

  const clientCode = cleanText(shipment.clientCode);
  if (!clientCode) {
    throw new Error("A shipment client code is required to re-rate the shipment.");
  }
  if (!cleanText(ratingClientCode) || !cleanText(ratingProfileCode)) {
    throw new Error(`Rating client and profile codes are unavailable for client ${clientCode}.`);
  }
  const now = dayjs();
  const effectiveShipmentDate = shipmentDate.isAfter(now, "day")
    ? `${shipmentDate.format("YYYY-MM-DD")}T00:00:00.000Z`
    : now.toISOString();

  return createGetRatesRequest({
    serviceToken: SRV_TOKEN,
    clientCode,
    clientName: cleanText(shipment.clientName),
    ratingProfileCode: cleanText(ratingProfileCode),
    ratingClientCode: cleanText(ratingClientCode),
    originPortCode: cleanText(shipment.originPortCode),
    destPortCode: cleanText(shipment.destinationPortCode),
    equipment: cleanText(shipment.equipment),
    mode: "LTL",
    scac,
    shipmentDate: effectiveShipmentDate,
    origZip: origin.postalCode,
    origCity: origin.city,
    origState: origin.state,
    origCountry: cleanText(shipment.orgCountryCode) || "USA",
    destZip: destination.postalCode,
    destCity: destination.city,
    destState: destination.state,
    destCountry: cleanText(shipment.destCountryCode) || "USA",
    accessorialCodes: [...loadValues.accessorialCodes],
    miles: 0,
    resultCount: 0,
    shipmentValue: finiteNumber(shipment.shipmentValue),
    shipments: loadValues.shipments.map((product) => ({ ...product })),
    totalHeight: finiteNumber(shipment.totalHeight),
    totalLength: finiteNumber(shipment.totalLength),
    totalLinearFeet: finiteNumber(shipment.totalLinearFeet),
    totalWidth: finiteNumber(shipment.totalWidth),
  });
}

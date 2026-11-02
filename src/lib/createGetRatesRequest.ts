import type { GetRatesRequest } from "../types/GetRatesRequest";
import type { GetRatesShipment } from "../types/GetRatesShipment";

/** Optional internal values; numeric form strings are accepted before serialization. */
type RatingValues<T> = {
  readonly [K in keyof T]?: T[K] extends number ? number | string | null : T[K] | null;
};

/** Internal request data can retain metadata that is excluded from the wire body. */
type GetRatesInput = RatingValues<Omit<GetRatesRequest, "shipments">> & {
  readonly shipments?: readonly RatingValues<GetRatesShipment>[] | null;
  readonly [key: string]: unknown;
};

/** Converts missing or non-finite numeric form values to zero. */
function ratingNumber(value: number | string | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

/** Creates a fresh DTO snapshot containing only fields accepted by GetRates. */
export function createGetRatesRequest(payload: GetRatesInput): GetRatesRequest {
  return {
    serviceToken: payload.serviceToken ?? "",
    origZip: payload.origZip ?? "",
    origCity: payload.origCity ?? "",
    origState: payload.origState ?? "",
    origCountry: payload.origCountry ?? "",
    destZip: payload.destZip ?? "",
    destCity: payload.destCity ?? "",
    destState: payload.destState ?? "",
    destCountry: payload.destCountry ?? "",
    clientCode: payload.clientCode ?? "",
    scac: payload.scac ?? "",
    shipmentDate: payload.shipmentDate ?? "",
    serviceLevelCode: payload.serviceLevelCode ?? "",
    mode: payload.mode ?? "",
    originPortCode: payload.originPortCode ?? "",
    destPortCode: payload.destPortCode ?? "",
    equipment: payload.equipment ?? "",
    ratingProfileCode: payload.ratingProfileCode ?? "",
    ratingClientCode: payload.ratingClientCode ?? "",
    clientName: payload.clientName ?? "",
    miles: ratingNumber(payload.miles),
    resultCount: ratingNumber(payload.resultCount),
    totalLength: ratingNumber(payload.totalLength),
    totalWidth: ratingNumber(payload.totalWidth),
    totalHeight: ratingNumber(payload.totalHeight),
    shipmentValue: ratingNumber(payload.shipmentValue),
    totalLinearFeet: ratingNumber(payload.totalLinearFeet),
    accessorialCodes: [...(payload.accessorialCodes ?? [])],
    shipments: (payload.shipments ?? []).map((product) => ({
      class: product.class ?? "",
      nmfc: product.nmfc ?? "",
      packageType: product.packageType ?? "",
      description: product.description ?? "",
      weight: ratingNumber(product.weight),
      units: ratingNumber(product.units),
      cubicFeet: ratingNumber(product.cubicFeet),
      pallets: ratingNumber(product.pallets),
      pieces: ratingNumber(product.pieces),
      length: ratingNumber(product.length),
      width: ratingNumber(product.width),
      height: ratingNumber(product.height),
      linearFeet: ratingNumber(product.linearFeet),
      hazMat: product.hazMat ?? false,
      stackable: product.stackable ?? false,
    })),
  };
}

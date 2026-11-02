import type { GetRatesShipment } from "./GetRatesShipment";

/** Immutable JSON contract accepted by GetRates. */
export type GetRatesRequest = Readonly<{
  /** Service credential supplied by the existing application configuration. */
  serviceToken: string;
  /** Origin postal code. */
  origZip: string;
  /** Origin city. */
  origCity: string;
  /** Origin state or province code. */
  origState: string;
  /** Origin country code. */
  origCountry: string;
  /** Destination postal code. */
  destZip: string;
  /** Destination city. */
  destCity: string;
  /** Destination state or province code. */
  destState: string;
  /** Destination country code. */
  destCountry: string;
  /** Client owning the quote or shipment. */
  clientCode: string;
  /** Carrier filter; empty when requesting all carriers. */
  scac: string;
  /** Pickup date or timestamp supplied by the existing rating flow. */
  shipmentDate: string;
  /** Requested service level; empty when unspecified. */
  serviceLevelCode: string;
  /** Requested transport mode. */
  mode: string;
  /** Origin port code; empty when unspecified. */
  originPortCode: string;
  /** Destination port code; empty when unspecified. */
  destPortCode: string;
  /** Requested equipment; empty when unspecified. */
  equipment: string;
  /** Profile used for carrier rating. */
  ratingProfileCode: string;
  /** Client used for carrier rating. */
  ratingClientCode: string;
  /** Display name of the owning client. */
  clientName: string;
  /** Route distance in miles. */
  miles: number;
  /** Requested result limit using the service convention. */
  resultCount: number;
  /** Aggregate load length supplied by the rating flow. */
  totalLength: number;
  /** Aggregate load width supplied by the rating flow. */
  totalWidth: number;
  /** Aggregate load height supplied by the rating flow. */
  totalHeight: number;
  /** Declared shipment value. */
  shipmentValue: number;
  /** Total trailer length occupied in feet. */
  totalLinearFeet: number;
  /** Independent immutable snapshots of the freight lines. */
  shipments: readonly GetRatesShipment[];
  /** Independent snapshot of requested accessorial codes. */
  accessorialCodes: readonly string[];
}>;

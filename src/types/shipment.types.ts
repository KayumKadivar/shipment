import type { GetRatesRequest } from "./GetRatesRequest";

export type ShipmentProduct = {
  productDescription: string | null;
  productClass: string | null;
  productWeight: number | null;
  pallets: number | null;
  pieces: number | null;
  nmfc: string | null;
  hazMat: boolean;
  length: number | null;
  width: number | null;
  height: number | null;
  pcf: number | null;
  packageType: string | null;
  skuNumber: string | null;
  accountNumber: string | null;
  linearFeet: number | null;
  hazmatProperShippingName: string | null;
  hazmatClass: string | null;
  hazmatUnNaNumber: string | null;
  hazmatPhone: string | null;
  hazmatGroup: string | null;
  hazmatContact: string | null;
  stackable: boolean | null;
};

export type ShipmentAccessorialCostDetail = {
  accCode: string | null;
  ratedCost: number | null;
  description: string | null;
  billedCost: number | null;
};

export type ShipmentRate = {
  freight: number | null;
  fuel: number | null;
  discount: number | null;
  accesorialCostDetails: ShipmentAccessorialCostDetail[] | null;
};

export type ShipmentDetails = {
  createLoadInTms: boolean;
  sendCarrierPickupReq: boolean;
  loadNumber: string;
  proNumber: string | null;
  bolStatus: string | null;
  pickupStatus: string | null;
  scac: string | null;
  sellSCAC: string | null;
  shipmentMode: string | null;
  equipment: string | null;
  pickupdate: string | null;
  expectedShipDate: string | null;
  requestedDeliveryDate: string | null;
  requestedDeliveryTime: string | null;
  requestedDeliveryTimeTo: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  pickUpReadyTime: string | null;
  pickUpCloseTime: string | null;
  pickupTime: string | null;
  clientCode: string | null;
  ladingID: number;
  clientName: string | null;
  clientEmail: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientCountryCode: string | null;
  clientCityName: string | null;
  clientPhone: string | null;
  clientStateCode: string | null;
  clientZipCode: string | null;
  originName: string | null;
  originAddress1: string | null;
  originAddress2: string | null;
  orgCompanyName: string | null;
  orgContactFirstName: string | null;
  orgContactLastName: string | null;
  orgCityName: string | null;
  orgStateCode: string | null;
  orgPostalCode: string | null;
  orgCountryCode: string | null;
  orgPhoneAreaCode: string | null;
  orgPhoneNumber: string | null;
  orgWhoPhoneNumber: string | null;
  originFax: string | null;
  originEmail: string | null;
  orgContactPerson: string | null;
  orgWhoEntered: string | null;
  originNote: string | null;
  destName: string | null;
  destAddress1: string | null;
  destAddress2: string | null;
  destCityName: string | null;
  destStateCode: string | null;
  destPostalCode: string | null;
  destCountryCode: string | null;
  destPhoneNo: string | null;
  destEmail: string | null;
  destFaxNo: string | null;
  destContact: string | null;
  destNote: string | null;
  billToName: string | null;
  billToAddress1: string | null;
  billToAddress2: string | null;
  billToCountryCode: string | null;
  billToPostalCode: string | null;
  billToStateCode: string | null;
  billToCityName: string | null;
  billToFaxNo: string | null;
  carrierBolNo: string | null;
  pickupNo: string | null;
  poNumber: string | null;
  saasQuoteNumber: string | null;
  brokerRefNo: string | null;
  ref1Name: string | null;
  ref1Value: string | null;
  ref2Name: string | null;
  ref2Value: string | null;
  ref3Name: string | null;
  ref3Value: string | null;
  userName: string | null;
  specialNotes: string | null;
  carrierNote: string | null;
  shipmentValue: number | null;
  valuePerPound: number | null;
  isTestMode: boolean;
  brokerCode: string | null;
  bolDispatchNotes: string[] | null;
  paymentTerms: string | null;
  totalLength: number | null;
  totalWidth: number | null;
  totalHeight: number | null;
  wiseTechTransactionNo: string | null;
  originPortCode: string | null;
  destinationPortCode: string | null;
  codAmount: number | null;
  totalLinearFeet: number | null;
  tariffType: number | null;
  products: ShipmentProduct[];
  accessorials: string[] | null;
  buyRate: ShipmentRate | null;
  sellRate: ShipmentRate | null;
};

export type ShipmentApiResponse = {
  isSuccess: boolean;
  message: string;
  data: ShipmentDetails | null;
};

/** A product line formatted for the shipment rating API. */
export type ShipmentRerateProduct = {
  class: string;
  weight: number;
  weightUnit: string;
  units: number;
  cubicFeet: number;
  hazMat: boolean;
  hazMatClass?: string;
  hazMatUN?: string;
  hazMatProperShippingName?: string;
  hazMatPackingGroup?: string;
  hazMatPhone?: string;
  hazMatContact?: string;
  nmfc?: string;
  description?: string;
  pallets: number;
  pieces: number;
  length: number;
  width: number;
  height: number;
  packageType?: string;
  linearFeet: number;
  stackable: boolean;
};

/** The latest accepted Load-tab values used to request a new shipment rate. */
export type ShipmentRerateLoadValues = {
  shipments: ShipmentRerateProduct[];
  accessorialCodes: string[];
};

/** Request body accepted by the shipment rating endpoint. */
export type ShipmentRerateRequest = GetRatesRequest;

export type ShipmentListItem = {
  bolNo: string | null;
  customerName: string | null;
  clientCode: string | null;
  statusId: number;
  shipmentStatus?: string | null;
  isPickupSuccess: boolean;
  aljexProNumber: string | null;
  pickupDate: string | null;
  scac: string | null;
  carrierName: string | null;
  originName: string | null;
  originAddress1: string | null;
  originCity: string | null;
  originStateCode: string | null;
  originZipCode: string | null;
  destinationName: string | null;
  destinationAddress1: string | null;
  destinationCity: string | null;
  destinationStateCode: string | null;
  destinationZipCode: string | null;
  pallets: number;
  weight: number;
  originTerminalCode: string | null;
  originTerminalName: string | null;
  originTerminalZip: string | null;
  originTerminalPhone: string | null;
  destinationTerminalCode: string | null;
  destinationTerminalName: string | null;
  destinationTerminalZip: string | null;
  destinationTerminalPhone: string | null;
};

export type ShipmentListApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: ShipmentListItem[] | null;
};

export type FetchShipmentsArgs = {
  pageNumber: number;
  pageSize: number;
  clientCode?: string;
};

export type ShipmentRecord = {
  /** Raw owning client code from the shipment list API, before display formatting. */
  clientCode?: string | null;
  key: string;
  customer: string;
  status: string;
  customerNo: string;
  loadNumber: string;
  pro: string;
  pickupDate: string;
  delivery: string;
  carrier: string;
  carrierNote: string;
  origin: string;
  originMeta: string;
  destination: string;
  destinationMeta: string;
  pallets: number;
  weight: string;
  selected?: boolean;
};

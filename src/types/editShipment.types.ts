import type { ShipmentListItem } from "./shipment.types";

/** EditShipmentRequest contract for the shipment edit endpoint. */
export type EditShipmentRequest = {
  createLoadInTms: boolean;
  sendCarrierPickupReq: boolean;
  originName: string;
  originAddress1: string;
  originAddress2: string;
  orgCountryCode: string;
  orgStateCode: string;
  orgPostalCode: string;
  orgCityName: string;
  destName: string;
  destAddress1: string;
  destAddress2: string;
  destCountryCode: string;
  destStateCode: string;
  destPostalCode: string;
  destCityName: string;
  pickupdate: string;
  loadNumber: string;
  proNumber: string;
  scac: string;
  sellSCAC: string;
  clientCode: string;
  ladingID: number;
  srvToken: string;
  products: EditShipmentProductRequest[];
  orgCompanyName: string;
  orgContactFirstName: string;
  orgContactLastName: string;
  orgPhoneAreaCode: string;
  orgPhoneNumber: string;
  orgWhoEntered: string;
  orgWhoPhoneNumber: string;
  pickUpReadyTime: string;
  pickUpCloseTime: string;
  isTestMode: boolean;
  brokerCode: string;
  clientAddress1: string;
  clientAddress2: string;
  clientCountryCode: string;
  clientCityName: string;
  clientEmail: string;
  clientName: string;
  clientPhone: string;
  clientStateCode: string;
  clientZipCode: string;
  pickupTime: string;
  originFax: string;
  originEmail: string;
  originNote: string;
  destContact: string;
  destPhoneNo: string;
  destEmail: string;
  destFaxNo: string;
  destNote: string;
  ref1Value: string;
  ref2Value: string;
  ref3Value: string;
  pickupNo: string;
  poNumber: string;
  brokerRefNo: string;
  expectedShipDate: string | null;
  requestedDeliveryDate: string | null;
  requestedDeliveryTime: string;
  shipmentValue: number | null;
  valuePerPound: number | null;
  specialNotes: string;
  carrierNote: string;
  billToName: string;
  billToAddress1: string;
  billToAddress2: string;
  billToCountryCode: string;
  billToPostalCode: string;
  billToStateCode: string;
  billToCityName: string;
  billToFaxNo: string;
  bolDispatchNotes: string[];
  accessorials: string[];
  paymentTerms: string;
  orgContactPerson: string;
  deliveryDate: string | null;
  deliveryTime: string;
  carrierBolNo: string;
  buyRate: EditShipmentRateRequest;
  sellRate: EditShipmentRateRequest;
  shipmentMode: string;
  equipment: string;
  totalLength: number;
  totalWidth: number;
  totalHeight: number;
  wiseTechTransactionNo: string;
  userName: string;
  originPortCode: string;
  destinationPortCode: string;
  requestedDeliveryTimeTo: string;
  codAmount: number | null;
  totalLinearFeet: number | null;
  sellCarrierName: string;
  bolStatus: string;
};

/** EditShipmentProductRequest contract for the shipment edit endpoint. */
export type EditShipmentProductRequest = {
  productDescription: string;
  productClass: string;
  productWeight: number;
  pallets: number;
  pieces: number;
  nmfc: string;
  hazMat: boolean;
  length: number;
  width: number;
  height: number;
  pcf: number;
  packageType: string;
  skuNumber: string;
  accountNumber: string;
  linearFeet: number;
  hazmatProperShippingName: string;
  hazmatClass: string;
  hazmatUnNaNumber: string;
  hazmatPhone: string;
  hazmatGroup: string;
  hazmatContact: string;
  stackable: boolean;
};

/** EditShipmentRateRequest contract for the shipment edit endpoint. */
export type EditShipmentRateRequest = {
  freight: number;
  fuel: number;
  discount: number;
  accesorialCostDetails: EditShipmentAccessorialRequest[];
};

/** EditShipmentAccessorialRequest contract for the shipment edit endpoint. */
export type EditShipmentAccessorialRequest = {
  accCode: string;
  ratedCost: number;
  description: string;
  billedCost: number;
};

/** Summary returned after the server accepts a shipment edit. */
export type EditShipmentResponseData = ShipmentListItem & { proNumber: string | null };

/** Result envelope returned by the shipment edit endpoint. */
export type EditShipmentApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: EditShipmentResponseData | null;
};

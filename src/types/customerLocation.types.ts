export type LocationType = "All" | "Origin" | "Destination" | "Bill to";

export type LocationAccessorial =
  | "Blind Shipment"
  | "Call Before Delivery"
  | "Call Before Pickup"
  | "Delivery Appointment"
  | "Guaranteed By 5PM"
  | "Inside Delivery"
  | "Inside Pick Up"
  | "Liftgate Delivery"
  | "Liftgate Pickup"
  | "Limited Access Delivery"
  | "Limited Access Pickup"
  | "Notify Before Delivery"
  | "Protect From Freeze"
  | "Residential Delivery"
  | "Residential Pick Up"
  | "Sort and Segregate"
  | "Trade Show Delivery"
  | "Trade Show Pickup"
  | "Hazmat"
  | "White Glove Service";

export interface CustomerLocation {
  key: string;
  locationID?: number;
  locationName: string;
  shortName?: string;
  isActive: boolean;
  address1: string;
  address2: string;
  country: string;
  state: string;
  city: string;
  postal: string;
  contactName: string;
  phone: string;
  phoneExtension?: string;
  email: string;
  faxNumber?: string;
  activateDate: string;
  deactivateDate: string;
  group: string;
  locationType: LocationType;
  port?: string;
  locationRef?: string;
  inboundAccount?: string;
  outboundAccount?: string;
  notes?: string;
  openTime?: string;
  closeTime?: string;
  accessorials?: LocationAccessorial[];
}

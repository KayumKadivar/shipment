export type LocationType = "All" | "Origin" | "Destination" | "Bill to";

export interface LocationAccessorial {
  accessorialID: number;
  accessorialName: string;
}

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
  accessorials?: any;
}

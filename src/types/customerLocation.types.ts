export type LocationType = "All" | "Origin" | "Destination" | "Bill to";

export interface LocationAccessorial {
  accessorialID: number;
  accessorialName: string;
  clientID?: number;
  accesorialCode?: string;
  description?: string;
  status?: boolean;
  accesorialGroupID?: number;
  isSystem?: boolean;
  isSelect?: boolean;
}

export interface CustomerLocation {
  key: string;
  locationId?: number;
  locationID?: number;
  locationName: string;
  shortName?: string;
  isActive: boolean;
  address1: string;
  address2: string;
  country: string;
  countryCode?: string;
  state: string;
  stateCode?: string;
  city: string;
  postal: string;
  zipCode?: string;
  clientCode?: string;
  createdBy?: string;
  createdDate?: string;
  modifiedBy?: string;
  modifiedDate?: string;
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

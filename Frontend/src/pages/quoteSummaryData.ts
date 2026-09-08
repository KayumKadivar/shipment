export type QuoteLoad = {
  freightClass: string;
  weight: string;
};

export type QuoteSummaryRecord = {
  key: string;
  customer: string;
  customerCode: string;
  createdAgo: string;
  createdDate: string;
  reference: string;
  pickupDate: string;
  pickupTimestamp: number;
  origin: string;
  originPostal: string;
  destination: string;
  destinationPostal: string;
  loads: QuoteLoad[];
  carrierCode: string;
  carrierName: string;
  createdBy: string;
  profile: string;
  totalWeight: string;
  pallets: number;
  pieces: number;
};

export const quoteSummaryData: QuoteSummaryRecord[] = [
  {
    key: "quote-60115508390",
    customer: "Inland Transport Relocation Services",
    customerCode: "294064-P1",
    createdAgo: "Created 14 minutes ago on",
    createdDate: "8/20/2026",
    reference: "60115508390",
    pickupDate: "8/20/2026",
    pickupTimestamp: new Date("2026-08-20").getTime(),
    origin: "Seattle, WA",
    originPostal: "98188",
    destination: "Fort Myers, FL",
    destinationPostal: "33905",
    loads: [{ freightClass: "150", weight: "5,063 lbs" }],
    carrierCode: "FXNL",
    carrierName: "FedEx Economy",
    createdBy: "Pete Jones",
    profile: "TEST API",
    totalWeight: "5,063 lbs",
    pallets: 2,
    pieces: 2,
  },
  {
    key: "quote-60115504668",
    customer: "Edge Elevator Products, LLC",
    customerCode: "230978-P1",
    createdAgo: "Created 16 hours ago on",
    createdDate: "8/19/2026",
    reference: "60115504668",
    pickupDate: "8/20/2026",
    pickupTimestamp: new Date("2026-08-20").getTime(),
    origin: "Franklin Park, IL",
    originPostal: "60131",
    destination: "Groveland, FL",
    destinationPostal: "34736",
    loads: [
      { freightClass: "70", weight: "1,240 lbs" },
      { freightClass: "175", weight: "860 lbs" },
      { freightClass: "70", weight: "415 lbs" },
    ],
    carrierCode: "FXFE",
    carrierName: "FedEx Priority",
    createdBy: "Nicole Keener",
    profile: "TEST API",
    totalWeight: "2,515 lbs",
    pallets: 3,
    pieces: 4,
  },
  {
    key: "quote-60115499821",
    customer: "Atlantic Food Equipment",
    customerCode: "184225-P2",
    createdAgo: "Created yesterday on",
    createdDate: "8/18/2026",
    reference: "60115499821",
    pickupDate: "8/21/2026",
    pickupTimestamp: new Date("2026-08-21").getTime(),
    origin: "Savannah, GA",
    originPostal: "31408",
    destination: "Raleigh, NC",
    destinationPostal: "27617",
    loads: [{ freightClass: "85", weight: "2,180 lbs" }],
    carrierCode: "ODFL",
    carrierName: "Old Dominion Freight",
    createdBy: "Brian Young",
    profile: "STANDARD LTL",
    totalWeight: "2,180 lbs",
    pallets: 2,
    pieces: 3,
  },
  {
    key: "quote-60115491207",
    customer: "Metro Supply Company",
    customerCode: "309447-P1",
    createdAgo: "Created 2 days ago on",
    createdDate: "8/17/2026",
    reference: "60115491207",
    pickupDate: "8/22/2026",
    pickupTimestamp: new Date("2026-08-22").getTime(),
    origin: "Nashville, TN",
    originPostal: "37210",
    destination: "Columbus, OH",
    destinationPostal: "43228",
    loads: [{ freightClass: "92.5", weight: "3,640 lbs" }],
    carrierCode: "SAIA",
    carrierName: "Saia LTL Freight",
    createdBy: "Amanda Clark",
    profile: "NATIONAL API",
    totalWeight: "3,640 lbs",
    pallets: 3,
    pieces: 3,
  },
  {
    key: "quote-60115487342",
    customer: "Jupiter Packaging",
    customerCode: "417530-P3",
    createdAgo: "Created 3 days ago on",
    createdDate: "8/16/2026",
    reference: "60115487342",
    pickupDate: "8/24/2026",
    pickupTimestamp: new Date("2026-08-24").getTime(),
    origin: "Aurora, IL",
    originPostal: "60502",
    destination: "Newark, NJ",
    destinationPostal: "07114",
    loads: [
      { freightClass: "55", weight: "1,975 lbs" },
      { freightClass: "100", weight: "720 lbs" },
    ],
    carrierCode: "XPO",
    carrierName: "XPO LTL",
    createdBy: "Pete Jones",
    profile: "STANDARD LTL",
    totalWeight: "2,695 lbs",
    pallets: 2,
    pieces: 5,
  },
  {
    key: "quote-60115480619",
    customer: "Liberty Cold Storage",
    customerCode: "521886-P1",
    createdAgo: "Created 4 days ago on",
    createdDate: "8/15/2026",
    reference: "60115480619",
    pickupDate: "8/25/2026",
    pickupTimestamp: new Date("2026-08-25").getTime(),
    origin: "Philadelphia, PA",
    originPostal: "19148",
    destination: "Jacksonville, FL",
    destinationPostal: "32218",
    loads: [{ freightClass: "125", weight: "4,320 lbs" }],
    carrierCode: "RLCA",
    carrierName: "R+L Carriers",
    createdBy: "Nicole Keener",
    profile: "COLD CHAIN API",
    totalWeight: "4,320 lbs",
    pallets: 4,
    pieces: 4,
  },
];

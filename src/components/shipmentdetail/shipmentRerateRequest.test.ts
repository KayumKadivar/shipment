import { afterEach, describe, expect, it, vi } from "vitest";
import { SRV_TOKEN } from "../../config/apiConfig";
import type {
  ShipmentDetails,
  ShipmentRerateLoadValues,
} from "../../types/shipment.types";
import { createShipmentDetailEditValues } from "./detailEditValues";
import {
  createShipmentRerateLoadValues,
  createShipmentRerateRequest,
} from "./shipmentRerateRequest";

const shipment = {
  loadNumber: "LOAD-100",
  clientCode: "CLIENT",
  clientName: "Test Client",
  scac: "FXFE",
  shipmentMode: "T",
  pickupdate: "2026-10-17",
  orgCityName: "Atlanta",
  orgStateCode: "GA",
  orgPostalCode: "30303",
  orgCountryCode: "USA",
  destCityName: "Chicago",
  destStateCode: "IL",
  destPostalCode: "60606",
  destCountryCode: "USA",
  totalLength: 48,
  totalWidth: 48,
  totalHeight: 48,
  totalLinearFeet: 12,
  shipmentValue: 500,
  codAmount: 25,
  accessorials: ["Inside delivery"],
  products: [
    {
      productDescription: "Freight",
      productClass: "65",
      productWeight: 1200,
      pallets: 1,
      pieces: 2,
      nmfc: "987654-41",
      hazMat: true,
      hazmatClass: "3",
      hazmatUnNaNumber: "UN1993",
      length: 48,
      width: 48,
      height: 48,
      packageType: "Pallet",
      linearFeet: 4,
      stackable: false,
    },
  ],
  buyRate: {
    freight: 100,
    fuel: 10,
    discount: -5,
    accesorialCostDetails: [
      {
        accCode: "INS",
        description: "Inside delivery",
        ratedCost: 10,
        billedCost: null,
      },
    ],
  },
  sellRate: null,
} as unknown as ShipmentDetails;

describe("shipment rerate request mapping", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("createShipmentRerateLoadValues_whenShipmentIsLoaded_mapsProductsAndAccessorialCodes", () => {
    expect(createShipmentRerateLoadValues(shipment)).toEqual({
      shipments: [
        expect.objectContaining({
          class: "65",
          weight: 1200,
          weightUnit: "Lbs",
          units: 1,
          hazMat: true,
          hazMatClass: "3",
          hazMatUN: "UN1993",
          nmfc: "987654-41",
          pallets: 1,
          pieces: 2,
          length: 48,
          width: 48,
          height: 48,
        }),
      ],
      accessorialCodes: ["INS"],
    });
  });

  it("createShipmentRerateRequest_whenUiValuesWereAccepted_usesTheLatestValuesAndDefaults", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T06:30:00.000Z"));
    const detailValues = {
      ...createShipmentDetailEditValues(shipment),
      pickupCityStateZip: "Denver, CO, 80202",
      deliveryCityStateZip: "Austin, TX, 78701",
      schedulePickupDate: "10/20/2026",
    };
    const loadValues: ShipmentRerateLoadValues = {
      shipments: [
        {
          ...createShipmentRerateLoadValues(shipment).shipments[0],
          class: "70",
          weight: 1500,
        },
      ],
      accessorialCodes: ["RES"],
    };

    const request = createShipmentRerateRequest({
      shipment,
      detailValues,
      loadValues,
      ratingClientCode: "BUY-CLIENT",
      ratingProfileCode: "BUY-PROFILE",
    });

    expect(request).toMatchObject({
      serviceToken: SRV_TOKEN,
      clientCode: "CLIENT",
      ratingProfileCode: "BUY-PROFILE",
      ratingClientCode: "BUY-CLIENT",
      mode: "LTL",
      scac: "FXFE",
      origCity: "Denver",
      origState: "CO",
      origZip: "80202",
      destCity: "Austin",
      destState: "TX",
      destZip: "78701",
      accessorialCodes: ["RES"],
      shipmentValue: 500,
      totalLinearFeet: 12,
      shipments: [expect.objectContaining({ class: "70", weight: 1500 })],
    });
    expect(request.shipmentDate).toContain("2026-10-20");
  });

  it("createShipmentRerateRequest_whenRatingAndPortValuesExist_mapsThemToTheDto", () => {
    const request = createShipmentRerateRequest({
      shipment: { ...shipment, originPortCode: "ORIGIN", destinationPortCode: "DEST", equipment: "TRAILER" },
      detailValues: createShipmentDetailEditValues(shipment),
      loadValues: createShipmentRerateLoadValues(shipment),
      ratingProfileCode: "BUY", ratingClientCode: "RATING-CLIENT",
    });
    expect(request).toMatchObject({
      ratingProfileCode: "BUY", ratingClientCode: "RATING-CLIENT",
      originPortCode: "ORIGIN", destPortCode: "DEST", equipment: "TRAILER",
    });
    expect(request).not.toHaveProperty("profileCode");
    expect(request.shipments[0]).not.toHaveProperty("weightUnit");
  });

  it("createShipmentRerateRequest_whenShipmentClientIsBlank_rejectsInsteadOfUsingDefault", () => {
    expect(() => createShipmentRerateRequest({
      shipment: { ...shipment, clientCode: " " },
      detailValues: createShipmentDetailEditValues(shipment),
      loadValues: createShipmentRerateLoadValues(shipment),
      ratingClientCode: "BUY", ratingProfileCode: "PROFILE",
    })).toThrow("A shipment client code is required to re-rate the shipment.");
  });

  it.each(["ratingClientCode", "ratingProfileCode"])("createShipmentRerateRequest_whenRatingCodeIsBlank_rejects (%s)", (field) => {
    expect(() => createShipmentRerateRequest({
      shipment, detailValues: createShipmentDetailEditValues(shipment),
      loadValues: createShipmentRerateLoadValues(shipment),
      ratingClientCode: "BUY", ratingProfileCode: "PROFILE", [field]: " ",
    })).toThrow("Rating client and profile codes are unavailable for client CLIENT.");
  });

  it("createShipmentRerateRequest_whenLocationIsMalformed_rejectsBeforeCallingTheApi", () => {
    const detailValues = {
      ...createShipmentDetailEditValues(shipment),
      pickupCityStateZip: "Denver CO 80202",
    };

    expect(() =>
      createShipmentRerateRequest({
        shipment,
        detailValues,
        loadValues: createShipmentRerateLoadValues(shipment),
        ratingProfileCode: "PROFILE", ratingClientCode: "BUY-CLIENT",
      }),
    ).toThrow("Pickup location must use the City, State, ZIP format.");
  });

  it("createShipmentRerateRequest_whenPickupDateIsPast_usesTheCurrentTimestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T06:30:00.000Z"));
    const detailValues = {
      ...createShipmentDetailEditValues(shipment),
      schedulePickupDate: "10/15/2026",
    };

    const request = createShipmentRerateRequest({
      shipment,
      detailValues,
      loadValues: createShipmentRerateLoadValues(shipment),
      ratingProfileCode: "PROFILE", ratingClientCode: "BUY-CLIENT",
    });

    expect(request.shipmentDate).toBe("2026-10-17T06:30:00.000Z");
  });
});

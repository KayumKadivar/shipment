import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import type { ShipmentRerateRequest } from "../types/shipment.types";
import reducer, {
  clearShipmentRerate,
  rerateShipment,
  selectShipmentRerateRate,
  type ShipmentRerateRate,
  type ShipmentRerateState,
} from "./shipmentRerateSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const request: ShipmentRerateRequest = {
  serviceToken: "service-token",
  clientCode: "CLIENT",
  clientName: "Client",
  ratingProfileCode: "PROFILE",
  ratingClientCode: "CLIENT",
  serviceLevelCode: "",
  originPortCode: "",
  destPortCode: "",
  equipment: "",
  mode: "LTL",
  scac: "FXFE",
  shipmentDate: "2026-10-17T00:00:00.000Z",
  origZip: "30303",
  origCity: "Atlanta",
  origState: "GA",
  origCountry: "USA",
  destZip: "60606",
  destCity: "Chicago",
  destState: "IL",
  destCountry: "USA",
  accessorialCodes: ["INS"],
  miles: 0,
  resultCount: 0,
  shipmentValue: 0,
  shipments: [
    {
      class: "65",
      weight: 1200,
      units: 1,
      cubicFeet: 0,
      hazMat: false,
      nmfc: "",
      description: "",
      packageType: "",
      pallets: 1,
      pieces: 1,
      length: 48,
      width: 48,
      height: 48,
      linearFeet: 0,
      stackable: false,
    },
  ],
  totalHeight: 48,
  totalLength: 48,
  totalLinearFeet: 0,
  totalWidth: 48,
};

const matchingRate = {
  carrierName: "FEDEX FREIGHT-PRIORITY",
  scac: "fxfe",
  rateType: "Flat",
  statusCode: 1,
  errorMessage: " ",
  totalShipmentCost: 122,
  transitDays: 2,
  deliveryDate: "0001-01-01T00:00:00",
  quoteExpirationDate: "2026-10-26T00:00:00",
  saasQuoteNumber: "52246240",
  grossCharge: 100,
  fuelSurcharge: 20,
  discount: 10,
  accessorialCharges: [
    {
      accessorialCode: "INS",
      accessorialDescription: "INSIDE DELIVERY",
      accessorialCharge: 12,
    },
  ],
};

const normalizedMatchingRate: ShipmentRerateRate = {
  id: "fxfe-0-52246240",
  carrierName: "FEDEX FREIGHT-PRIORITY",
  scac: "fxfe",
  rateType: "Flat",
  statusCode: 1,
  errorMessage: null,
  totalShipmentCost: 122,
  transitDays: 2,
  deliveryDate: "0001-01-01T00:00:00",
  quoteExpirationDate: "2026-10-26T00:00:00",
  grossCharge: 100,
  fuelSurcharge: 20,
  discount: 10,
  accessorialCharges: [
    {
      accessorialCode: "INS",
      accessorialDescription: "INSIDE DELIVERY",
      accessorialCharge: 12,
    },
  ],
};

/** Distinct buy and sell amounts reproduce the SAIA rerate response. */
const sellRate = {
  ...matchingRate,
  carrierName: "SAIA LTL FREIGHT",
  scac: "SAIA",
  grossCharge: 3474.72,
  discount: 3320.09,
  fuelSurcharge: 148.02,
  totalShipmentCost: 407.15,
  sellGrossCharge: 3513.38,
  sellDiscount: 3320.09,
  sellFuelSurcharge: 185.03,
  sellTotalShipmentCost: 482.81,
};

/** Optional sell fields normalized independently of buy amounts. */
const sellFields = [
  "sellGrossCharge", "sellDiscount", "sellFuelSurcharge", "sellTotalShipmentCost",
] as const;

describe("shipment rerate API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rerateShipment_whenSellAmountsAreReturned_preservesSellAmounts", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({
      isSuccess: true, data: { leastCostCarriers: [sellRate] },
    }));
    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);
    expect(action.payload).toEqual([expect.objectContaining({
      grossCharge: 3474.72, discount: 3320.09, fuelSurcharge: 148.02, totalShipmentCost: 407.15,
      sellGrossCharge: 3513.38, sellDiscount: 3320.09, sellFuelSurcharge: 185.03,
      sellTotalShipmentCost: 482.81, transitDays: 2,
    })]);
  });

  it.each(sellFields)("rerateShipment_when%sIsZero_preservesZeroValue", async (field) => {
    vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({
      isSuccess: true, data: { leastCostCarriers: [{ ...sellRate, [field]: 0 }] },
    }));
    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);
    expect(action.payload).toEqual([expect.objectContaining({ [field]: 0 })]);
  });

  it.each([null, undefined])("rerateShipment_whenSellAmountsAre%j_preservesBuyOnlySupport", async (value) => {
    const sellAmounts = Object.fromEntries(sellFields.map((field) => [field, value]));
    vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({
      isSuccess: true, data: { leastCostCarriers: [{ ...matchingRate, ...sellAmounts }] },
    }));
    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);
    expect(action.type).toBe("shipmentRerate/rerateShipment/fulfilled");
    expect(action.payload).toEqual([normalizedMatchingRate]);
  });

  it.each(sellFields)("rerateShipment_when%sIsNumericText_normalizesTheAmount", async (field) => {
    vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({
      isSuccess: true, data: { leastCostCarriers: [{ ...sellRate, [field]: "12.34" }] },
    }));
    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);
    expect(action.payload).toEqual([expect.objectContaining({ [field]: 12.34 })]);
  });

  it.each(sellFields)("rerateShipment_when%sIsInvalid_rejectsTheResponse", async (field) => {
    vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({
      isSuccess: true, data: { leastCostCarriers: [{ ...sellRate, [field]: "invalid" }] },
    }));
    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);
    expect(action.type).toBe("shipmentRerate/rerateShipment/rejected");
    expect(action.payload).toMatch(/The rating response contains an invalid sell/);
  });

  it("rerateShipment_whenInputHasExtraMetadata_postsOnlyTheWireDto", async () => {
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, data: { leastCostCarriers: [] } }),
    );
    const payload = { ...request, profileCode: "LEGACY", codAmount: 25 };
    await rerateShipment(payload)(vi.fn(), vi.fn(), undefined);
    expect(postRequest.mock.calls[0][1]).toEqual(request);
  });

  it("rerateShipment_whenRequested_postsTheExpectedPayloadAndHeaders", async () => {
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: { leastCostCarriers: [matchingRate] },
      }),
    );

    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("shipmentRerate/rerateShipment/fulfilled");
    expect(postRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/Rating/GetRates`,
      request,
      {
        headers: {
          Accept: "text/plain",
          "Content-Type": "application/json",
        },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("rerateShipment_whenMultipleSuccessfulRatesAreReturned_preservesEveryModalAndChargeField", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          leastCostCarriers: [
            {
              ...matchingRate,
              carrierName: "OTHER CARRIER",
              scac: "OTHER",
              totalShipmentCost: 75,
              grossCharge: 50,
              saasQuoteNumber: "OTHER-QUOTE",
            },
            matchingRate,
          ],
        },
      }),
    );

    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);

    expect(action.payload).toEqual([
      expect.objectContaining({
        id: "OTHER-0-OTHER-QUOTE",
        carrierName: "OTHER CARRIER",
        scac: "OTHER",
        totalShipmentCost: 75,
        grossCharge: 50,
      }),
      {
        ...normalizedMatchingRate,
        id: "fxfe-1-52246240",
      },
    ]);
  });

  it("rerateShipment_whenErrorAndSuccessfulRatesAreReturned_excludesTheErrorRate", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          leastCostCarriers: [
            { ...matchingRate, scac: "FAILED", errorMessage: "No rate" },
            { ...matchingRate, scac: "ABCD", grossCharge: 75 },
          ],
        },
      }),
    );

    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);

    expect(action.payload).toEqual([
      expect.objectContaining({ scac: "ABCD", grossCharge: 75 }),
    ]);
  });

  it("rerateShipment_whenOnlyErrorRatesAreReturned_rejectsWithoutResults", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          leastCostCarriers: [
            { ...matchingRate, errorMessage: "Carrier unavailable" },
          ],
        },
      }),
    );

    const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("shipmentRerate/rerateShipment/rejected");
    expect(action.payload).toBe("No successful carrier rate was returned.");
  });

  it.each([
    [
      "unsuccessful envelope",
      { isSuccess: false, message: "Rating failed", data: null },
      "Rating failed",
    ],
    [
      "missing rates",
      { isSuccess: true, data: { leastCostCarriers: [] } },
      "No successful carrier rate was returned.",
    ],
    [
      "malformed amount",
      {
        isSuccess: true,
        data: {
          leastCostCarriers: [{ ...matchingRate, grossCharge: "invalid" }],
        },
      },
      "The rating response contains an invalid gross charge.",
    ],
  ])(
    "rerateShipment_whenResponseHas%s_rejectsWithoutARate",
    async (_scenario, responseData, expectedMessage) => {
      vi.spyOn(axios, "post").mockResolvedValue(
        createAxiosResponse(responseData),
      );

      const action = await rerateShipment(request)(vi.fn(), vi.fn(), undefined);

      expect(action.type).toBe("shipmentRerate/rerateShipment/rejected");
      expect(action.payload).toBe(expectedMessage);
    },
  );
});

describe("shipment rerate state", () => {
  it("shipmentRerate_whenOlderRequestFinishes_ignoresTheStaleRate", () => {
    let state = reducer(undefined, { type: "initial" });
    state = reducer(state, rerateShipment.pending("older", request));
    state = reducer(state, rerateShipment.pending("newer", request));

    state = reducer(
      state,
      rerateShipment.fulfilled(
        [normalizedMatchingRate],
        "older",
        request,
      ),
    );

    expect(state).toMatchObject({
      rates: [],
      rate: null,
      loading: true,
      error: null,
      currentRequestId: "newer",
    });
  });

  it("shipmentRerate_whenRateIdIsSelected_setsTheMatchingChargeRate", () => {
    let state = reducer(undefined, { type: "initial" });
    state = reducer(state, rerateShipment.pending("request-id", request));
    state = reducer(
      state,
      rerateShipment.fulfilled(
        [normalizedMatchingRate],
        "request-id",
        request,
      ),
    );

    state = reducer(
      state,
      selectShipmentRerateRate(normalizedMatchingRate.id),
    );

    expect(state.rate).toEqual(normalizedMatchingRate);
  });

  it("shipmentRerate_whenUnknownRateIdIsSelected_doesNotSetARate", () => {
    let state = reducer(undefined, { type: "initial" });
    state = reducer(state, rerateShipment.pending("request-id", request));
    state = reducer(
      state,
      rerateShipment.fulfilled(
        [normalizedMatchingRate],
        "request-id",
        request,
      ),
    );

    state = reducer(state, selectShipmentRerateRate("missing-rate"));

    expect(state.rate).toBeNull();
  });

  it("clearShipmentRerate_whenCalled_clearsResultLoadingAndError", () => {
    const populatedState: ShipmentRerateState = {
      rates: [normalizedMatchingRate],
      rate: normalizedMatchingRate,
      loading: true,
      error: "Previous error",
      currentRequestId: "request-id",
    };

    expect(reducer(populatedState, clearShipmentRerate())).toEqual({
      rates: [],
      rate: null,
      loading: false,
      error: null,
      currentRequestId: null,
    });
  });
});

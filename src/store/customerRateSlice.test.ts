import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import reducer, { fetchCarrierRates } from "./customerRateSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("customer rate API behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

//   it("fetchCarrierRates_whenApiReturnsLeastCostCarriers_returnsTheNestedRates", async () => {
//     const apiRate = {
//       scac: "TEST",
//       carrierName: "Test Carrier",
//       totalShipmentCost: 125.5,
//     };
//     vi.spyOn(axios, "post").mockResolvedValue(
//       createAxiosResponse({
//         data: { leastCostCarriers: [apiRate] },
//       }),
//     );

//     const action = await fetchCarrierRates({ origZip: "60601" })(
//       vi.fn(),
//       vi.fn(),
//       undefined,
//     );

//     expect(action.type).toBe("customerRate/fetchCarrierRates/fulfilled");
//     expect(action.payload).toEqual([apiRate]);
//   });


  it("fetchCarrierRates_whenRatingCodesAreExplicit_postsThemWithoutLegacyFields", async () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => "stored-value") });
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({ data: [] }),
    );
    await fetchCarrierRates({
      ratingProfileCode: "BUY-PROFILE", ratingClientCode: "BUY-CLIENT",
      profileCode: "SELL-PROFILE", clientCode: "CLIENT", isAudit: true,
    })(vi.fn(), vi.fn(() => ({ app: { token: "redux-token", ratingProfileCode: "REDUX-PROFILE", ratingClientCode: "REDUX-CLIENT" } })), undefined);
    const body = postRequest.mock.calls[0][1];
    expect(body).toMatchObject({ ratingProfileCode: "BUY-PROFILE", ratingClientCode: "BUY-CLIENT", clientCode: "CLIENT" });
    expect(body).not.toHaveProperty("profileCode");
    expect(body).not.toHaveProperty("isAudit");
  });

  it("fetchCarrierRates_whenRatingCodesAreStored_usesThemBeforeLegacyCodes", async () => {
    vi.stubGlobal("localStorage", { getItem: vi.fn((key: string) => ({
      ratingProfileCode: "STORED-PROFILE", ratingClientCode: "STORED-CLIENT",
    })[key as "ratingProfileCode" | "ratingClientCode"] ?? null) });
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({ data: [] }));
    await fetchCarrierRates({ profileCode: "LEGACY", clientCode: "CLIENT" })(vi.fn(), vi.fn(() => ({ app: { ratingProfileCode: "STORED-PROFILE", ratingClientCode: "STORED-CLIENT" } })), undefined);
    expect(postRequest.mock.calls[0][1]).toMatchObject({ ratingProfileCode: "STORED-PROFILE", ratingClientCode: "STORED-CLIENT" });
  });

  it("fetchCarrierRates_whenRatingCodesAreAbsent_usesLegacyCodes", async () => {
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(createAxiosResponse({ data: [] }));
    await fetchCarrierRates({ profileCode: "LEGACY", clientCode: "CLIENT" })(vi.fn(), vi.fn(), undefined);
    expect(postRequest.mock.calls[0][1]).toMatchObject({ ratingProfileCode: "LEGACY", ratingClientCode: "CLIENT" });
  });

  it("fetchCarrierRates_whenServerFails_preservesTheServerMessage", async () => {
    vi.spyOn(axios, "post").mockRejectedValue({
      isAxiosError: true,
      message: "Request failed",
      response: { data: { message: "Rating service unavailable" } },
    });

    const action = await fetchCarrierRates({ origZip: "60601" })(
      vi.fn(),
      vi.fn(),
      undefined,
    );
    const state = reducer(undefined, action);

    expect(action.type).toBe("customerRate/fetchCarrierRates/rejected");
    expect(action.payload).toBe("Rating service unavailable");
    expect(state.error).toBe("Rating service unavailable");
  });

  
//   it("saveCustomerQuote_whenStateContainsQuote_mapsShipmentsRatesAndCostDetails", async () => {
//     const postRequest = vi.spyOn(axios, "post").mockResolvedValue(
//       createAxiosResponse({ isSuccess: true, message: "Saved", data: 44 }),
//     );
//     const getState = () => ({
//       customerRate: {
//         rates: [
//           {
//             id: "rate-1",
//             name: "Test Carrier",
//             code: "TEST",
//             service: "Standard",
//             price: 125,
//             transitDays: 2,
//             estimatedDelivery: "2026-10-12",
//             grossCharge: 150,
//             discount: 25,
//             fuelSurcharge: 10,
//             accessorialCharges: [
//               {
//                 accessorialCode: "LIFT",
//                 accessorialDescription: "Liftgate",
//                 accessorialCharge: 15,
//               },
//             ],
//           },
//         ],
//         loading: false,
//         error: null,
//         quoteRequest: {
//           shipmentDate: "2026-10-10",
//           origCity: "Chicago",
//           origState: "IL",
//           origZip: "60601",
//           destCity: "Dallas",
//           destState: "TX",
//           destZip: "75201",
//           clientName: "Client",
//           clientCode: "CLIENT",
//           profileCode: "PROFILE",
//           shipments: [
//             {
//               class: "70",
//               weight: 500,
//               pallets: 2,
//               pieces: 4,
//               packageType: "Pallet",
//               description: "Widgets",
//             },
//           ],
//           accessorialCodes: ["LIFT"],
//         },
//         quoteFormData: null,
//         carrierSearchResults: [],
//         carrierSearchLoading: false,
//       },
//     });

//     const action = await saveCustomerQuote()(vi.fn(), getState, undefined);

//     expect(action.type).toBe("customerRate/saveCustomerQuote/fulfilled");
//     expect(postRequest).toHaveBeenCalledWith(
//       expect.stringContaining("/Quote"),
//       expect.objectContaining({
//         quoteProducts: [
//           expect.objectContaining({
//             productClass: "70",
//             weight: 500,
//             pallets: 2,
//             description: "Widgets",
//           }),
//         ],
//         quoteResults: [
//           expect.objectContaining({
//             scac: "TEST",
//             quoteCostDetails: expect.arrayContaining([
//               expect.objectContaining({ accCode: "GROSS", amount: 150 }),
//               expect.objectContaining({ accCode: "LIFT", amount: 15 }),
//             ]),
//           }),
//         ],
//       }),
//     );
//   });

//   it("fetchCarrierLogo_whenApiReturnsRawBase64_prefixesTheDataUrl", async () => {
//     vi.spyOn(axios, "get").mockResolvedValue(
//       createAxiosResponse({ isSuccess: true, data: "raw-base64" }),
//     );

//     const action = await fetchCarrierLogo("TEST")(
//       vi.fn(),
//       vi.fn(),
//       undefined,
//     );

//     expect(action.type).toBe("customerRate/fetchCarrierLogo/fulfilled");
//     expect(action.payload).toEqual({
//       scac: "TEST",
//       logo: "data:image/png;base64,raw-base64",
//     });
//   });
});

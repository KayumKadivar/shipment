import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import reducer, {
  clearShipmentProductSearch,
  searchShipmentProducts,
  type SearchShipmentProductsArgs,
  type ShipmentProductSearchResult,
  type ShipmentProductSearchState,
} from "./shipmentProductSearchSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const searchArgs: SearchShipmentProductsArgs = {
  clientCode: "CLIENT-42",
  searchText: " DO ",
};

const product: ShipmentProductSearchResult = {
  productId: 14,
  description: "DO NOT SHIP",
  freightClass: "50",
  nmfc: "123456-00",
  weight: 1200,
  pallets: 2,
  packageType: "Carton",
  length: 48,
  width: 48,
  height: 48,
  isHazmat: false,
  hazmatClass: "",
  hazmatUn: "",
  isActive: true,
};

describe("shipment product search API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("searchShipmentProducts_whenRequested_postsTheExpectedEndpointPayloadAndHeaders", async () => {
    const postRequest = vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await searchShipmentProducts(searchArgs)(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "shipmentProductSearch/searchShipmentProducts/fulfilled",
    );
    expect(postRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/Product/SearchProducts`,
      {
        clientCode: "CLIENT-42",
        searchText: "DO",
        pageNumber: 1,
        pageSize: 10,
      },
      {
        headers: {
          Accept: "text/plain",
          "Content-Type": "application/json",
        },
        signal: expect.any(AbortSignal),
      },
    );
  });

  it("searchShipmentProducts_whenApiSucceeds_mapsEveryLoadFieldIncludingZeroValues", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: [
          {
            productId: 16,
            productDescription: "DO NOT SHIP 1",
            productClass: "85",
            productNMFC: "987465-41",
            weight: 0,
            pallets: 0,
            isHazmat: true,
            hazmatClass: "3",
            hazmatUN: "UN1993",
            packagingGroup: "Bag",
            length: 0,
            height: 0,
            width: 0,
            isActive: true,
          },
        ],
      }),
    );

    const action = await searchShipmentProducts(searchArgs)(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.payload).toEqual([
      {
        productId: 16,
        description: "DO NOT SHIP 1",
        freightClass: "85",
        nmfc: "987465-41",
        weight: 0,
        pallets: 0,
        packageType: "Bag",
        length: 0,
        width: 0,
        height: 0,
        isHazmat: true,
        hazmatClass: "3",
        hazmatUn: "UN1993",
        isActive: true,
      },
    ]);
  });

  it("searchShipmentProducts_whenApiReportsFailure_rejectsWithTheApiMessage", async () => {
    vi.spyOn(axios, "post").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Product lookup failed",
        data: null,
      }),
    );

    const action = await searchShipmentProducts(searchArgs)(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "shipmentProductSearch/searchShipmentProducts/rejected",
    );
    expect(action.payload).toBe("Product lookup failed");
  });
});

describe("shipment product search state", () => {
  it("shipmentProductSearch_whenAnOlderRequestFinishes_doesNotReplaceNewerResults", () => {
    let state = reducer(undefined, { type: "initial" });
    state = reducer(state, searchShipmentProducts.pending("older", searchArgs));
    state = reducer(state, searchShipmentProducts.pending("newer", searchArgs));

    state = reducer(
      state,
      searchShipmentProducts.fulfilled([product], "older", searchArgs),
    );

    expect(state).toMatchObject({
      data: [],
      loading: true,
      error: null,
      currentRequestId: "newer",
    });
  });

  it("clearShipmentProductSearch_whenCalled_clearsResultsLoadingAndError", () => {
    const populatedState: ShipmentProductSearchState = {
      data: [product],
      loading: true,
      error: "Previous failure",
      currentRequestId: "request-id",
    };

    const state = reducer(populatedState, clearShipmentProductSearch());

    expect(state).toEqual({
      data: [],
      loading: false,
      error: null,
      currentRequestId: null,
    });
  });
});

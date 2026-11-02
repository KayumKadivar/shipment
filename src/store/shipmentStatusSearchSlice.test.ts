import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { logout } from "./appSlice";
import reducer, { resetShipmentStatusSearch, searchShipmentsByStatus } from "./shipmentStatusSearchSlice";

const args = { statusCodes: ["Booked"], pageNumber: 1, pageSize: 20 };
const item = {
  bolNo: " DEW08878 ", customerName: " TESTING SUBCLIENT ", clientCode: "TSTSB", statusId: 2,
  shipmentStatus: " Booked ", aljexProNumber: "PRO-1", pickupDate: "2026-10-22T00:00:00",
  carrierName: "AAA COOPER TRANSPORTATION", scac: "AACT", originCity: "ATLANTA   ",
  originStateCode: "GA ", originZipCode: "30303", pallets: 1, weight: 1500,
};

/** Creates isolated search state for deterministic reducer and HTTP tests. */
function createStore() {
  return configureStore({ reducer: { shipmentStatusSearch: reducer } });
}

describe("shipmentStatusSearchSlice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("searchShipmentsByStatus_whenSuccessful_postsExactCriteriaAndMapsResponse", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [item] } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus(args));
    expect(post).toHaveBeenCalledWith(`${API_BASE_URL}/Shipment/SearchShipmentByStatus`, args, {
      headers: { Accept: "text/plain", "Content-Type": "application/json" }, signal: expect.any(AbortSignal),
    });
    expect(store.getState().shipmentStatusSearch.shipments[0]).toMatchObject({
      key: "DEW08878", loadNumber: "DEW08878", customer: "TESTING SUBCLIENT", status: "Booked",
      pro: "PRO-1", originMeta: "ATLANTA, GA 30303", weight: "1,500 lbs",
    });
    expect(store.getState().shipmentStatusSearch).toMatchObject({ loading: false, error: null, hasNextPage: false });
  });

  it("searchShipmentsByStatus_whenEmpty_returnsSuccessfulEmptyPage", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [] } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus(args));
    expect(store.getState().shipmentStatusSearch).toMatchObject({ shipments: [], hasNextPage: false, error: null, knownLastPage: 1 });
  });

  it("searchShipmentsByStatus_whenPageIsFull_enablesNextPage", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: Array(20).fill(item) } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus(args));
    expect(store.getState().shipmentStatusSearch.hasNextPage).toBe(true);
  });

  it("searchShipmentsByStatus_whenLaterPageIsEmpty_remembersPreviousPageAsLast", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [] } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus({ ...args, pageNumber: 2 }));
    post.mockResolvedValue({ data: { isSuccess: true, data: Array(20).fill(item) } });
    await store.dispatch(searchShipmentsByStatus(args));
    expect(store.getState().shipmentStatusSearch).toMatchObject({ pageNumber: 1, knownLastPage: 1, hasNextPage: false });
  });

  it("searchShipmentsByStatus_whenStatusChanges_resetsPreviousPaginationBoundary", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: [] } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus(args));
    post.mockResolvedValue({ data: { isSuccess: true, data: Array(20).fill(item) } });
    await store.dispatch(searchShipmentsByStatus({ ...args, statusCodes: ["In Transit"] }));
    expect(store.getState().shipmentStatusSearch).toMatchObject({ knownLastPage: null, hasNextPage: true });
  });

  it.each(["api", "http", "network", "malformed"])("searchShipmentsByStatus_whenRequestFails_reportsError (%s)", async (failure) => {
    const post = vi.spyOn(axios, "post");
    if (failure === "api") post.mockResolvedValue({ data: { isSuccess: false, message: "Search rejected", data: [] } });
    else if (failure === "http") post.mockRejectedValue({ isAxiosError: true, response: { data: { message: "Search rejected" } } });
    else if (failure === "network") post.mockRejectedValue(new Error("Search rejected"));
    else post.mockResolvedValue({ data: { isSuccess: true, data: null } });
    const store = createStore();
    await store.dispatch(searchShipmentsByStatus(args));
    expect(store.getState().shipmentStatusSearch).toMatchObject({
      loading: false, shipments: [], error: failure === "malformed" ? "Unable to search shipments by status." : "Search rejected",
    });
  });

  it("searchShipmentsByStatus_whenAborted_cancelsSignalWithoutError", async () => {
    const post = vi.spyOn(axios, "post").mockImplementation(() => new Promise(() => {}));
    const store = createStore();
    const request = store.dispatch(searchShipmentsByStatus(args));
    request.abort();
    await request;
    expect(post.mock.calls[0][2]?.signal?.aborted).toBe(true);
    expect(store.getState().shipmentStatusSearch).toMatchObject({ loading: false, error: null });
  });

  it.each(["fulfilled", "rejected"])("searchShipmentsByStatus_whenResultIsStale_preservesCurrentRequest (%s)", (outcome) => {
    const store = createStore();
    store.dispatch(searchShipmentsByStatus.pending("old", args));
    store.dispatch(searchShipmentsByStatus.pending("new", { ...args, statusCodes: ["Delivered"] }));
    store.dispatch(outcome === "fulfilled"
      ? searchShipmentsByStatus.fulfilled({ shipments: [], pageNumber: 1, pageSize: 20 }, "old", args)
      : searchShipmentsByStatus.rejected(new Error("Old error"), "old", args));
    expect(store.getState().shipmentStatusSearch).toMatchObject({ currentRequestId: "new", loading: true, error: null });
  });

  it.each([logout, resetShipmentStatusSearch])("reset_whenRequestIsPending_clearsStateAndIgnoresLateResult (%#)", (reset) => {
    const store = createStore();
    store.dispatch(searchShipmentsByStatus.pending("old", args));
    store.dispatch(reset());
    store.dispatch(searchShipmentsByStatus.fulfilled({ shipments: [], pageNumber: 1, pageSize: 20 }, "old", args));
    expect(store.getState().shipmentStatusSearch).toEqual({
      shipments: [], loading: false, error: null, currentRequestId: null, queryKey: null,
      pageNumber: 1, hasNextPage: false, knownLastPage: null,
    });
  });
});

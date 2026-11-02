import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { logout } from "./appSlice";
import reducer, { fetchShipmentStatusCounts } from "./shipmentStatusCountsSlice";

/** Creates isolated count state without network or browser dependencies. */
function createStore() {
  return configureStore({ reducer: { shipmentStatusCounts: reducer } });
}

describe("shipmentStatusCountsSlice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetchShipmentStatusCounts_whenSuccessful_storesCountsAndUsesConfiguredEndpoint", async () => {
    const data = [{ shipmentStatus: "Booked", shipmentCount: 20 }];
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data } });
    const store = createStore();
    await store.dispatch(fetchShipmentStatusCounts());
    expect(get).toHaveBeenCalledWith(`${API_BASE_URL}/Shipment/GetShipmentStatusCounts`, {
      headers: { Accept: "text/plain" }, signal: expect.any(AbortSignal),
    });
    expect(store.getState().shipmentStatusCounts).toMatchObject({ data, loading: false, error: null });
  });

  it.each([
    { scenario: "zero counts", data: [{ shipmentStatus: "Expired", shipmentCount: 0 }] },
    { scenario: "empty results", data: [] },
  ])("fetchShipmentStatusCounts_whenReturning$scenario_preservesSuccessfulData", async ({ data }) => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data } });
    const store = createStore();
    await store.dispatch(fetchShipmentStatusCounts());
    expect(store.getState().shipmentStatusCounts).toMatchObject({ data, error: null });
  });

  it.each(["api", "http", "network", "invalid data"])(
    "fetchShipmentStatusCounts_whenFailureOccurs_exposesError (%s)", async (failure) => {
      const get = vi.spyOn(axios, "get");
      if (failure === "api") get.mockResolvedValue({ data: { isSuccess: false, message: "Counts rejected", data: [] } });
      else if (failure === "http") get.mockRejectedValue({ isAxiosError: true, response: { data: { message: "Counts rejected" } } });
      else if (failure === "network") get.mockRejectedValue(new Error("Counts rejected"));
      else get.mockResolvedValue({ data: { isSuccess: true, data: null } });
      const store = createStore();
      await store.dispatch(fetchShipmentStatusCounts());
      expect(store.getState().shipmentStatusCounts).toMatchObject({
        data: null, loading: false,
        error: failure === "invalid data" ? "Unable to load shipment status counts." : "Counts rejected",
      });
    },
  );

  it("fetchShipmentStatusCounts_whenPending_clearsPreviousCounts", () => {
    const store = createStore();
    store.dispatch(fetchShipmentStatusCounts.pending("first", undefined));
    store.dispatch(fetchShipmentStatusCounts.fulfilled([{ shipmentStatus: "Booked", shipmentCount: 20 }], "first", undefined));
    store.dispatch(fetchShipmentStatusCounts.pending("refresh", undefined));
    expect(store.getState().shipmentStatusCounts).toMatchObject({ data: null, loading: true, error: null });
  });

  it("fetchShipmentStatusCounts_whenAborted_cancelsSignalWithoutShowingError", async () => {
    const get = vi.spyOn(axios, "get").mockImplementation(() => new Promise(() => {}));
    const store = createStore();
    const request = store.dispatch(fetchShipmentStatusCounts());
    request.abort();
    await request;
    expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(store.getState().shipmentStatusCounts).toMatchObject({ data: null, loading: false, error: null });
  });

  it.each(["fulfilled", "rejected"])("fetchShipmentStatusCounts_whenResponseIsStale_preservesLatestRequest (%s)", (outcome) => {
    const store = createStore();
    store.dispatch(fetchShipmentStatusCounts.pending("old", undefined));
    store.dispatch(fetchShipmentStatusCounts.pending("new", undefined));
    store.dispatch(outcome === "fulfilled"
      ? fetchShipmentStatusCounts.fulfilled([], "old", undefined)
      : fetchShipmentStatusCounts.rejected(new Error("Old failure"), "old", undefined));
    expect(store.getState().shipmentStatusCounts).toMatchObject({ loading: true, currentRequestId: "new", data: null, error: null });
  });

  it("logout_whenCountsExist_clearsCountsAndIgnoresPendingResults", () => {
    const store = createStore();
    store.dispatch(fetchShipmentStatusCounts.pending("saved", undefined));
    store.dispatch(fetchShipmentStatusCounts.fulfilled([{ shipmentStatus: "Booked", shipmentCount: 20 }], "saved", undefined));
    store.dispatch(logout());
    expect(store.getState().shipmentStatusCounts).toEqual({ data: null, loading: false, error: null, currentRequestId: null });
    store.dispatch(fetchShipmentStatusCounts.fulfilled([{ shipmentStatus: "Booked", shipmentCount: 99 }], "saved", undefined));
    expect(store.getState().shipmentStatusCounts.data).toBeNull();
  });
});

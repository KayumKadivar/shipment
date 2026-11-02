import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import reducer, { fetchShipmentTrackingNotification, saveShipmentTrackingNotification, type SaveShipmentTrackingNotificationArgs } from "./shipmentTrackingNotificationSlice";

/** Creates an isolated store for notification lookup lifecycle tests. */
function createStore() {
  return configureStore({ reducer });
}

const preferences = {
  shipmentTrackingNotificationId: 1,
  bolNo: "BOL-1",
  email: "notify@example.com",
  isNotifyOnPickupRequest: true,
  isNotifyOnInTransit: false,
  isNotifyOnOutForDelivery: null,
  isNotifyOnDelivered: true,
};

describe("shipmentTrackingNotificationSlice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetchShipmentTrackingNotification_whenLookupSucceeds_storesPreferencesForTrimmedBol", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: preferences } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingNotification(" BOL-1 "));
    expect(store.getState()).toMatchObject({ data: preferences, loadedBolNo: "BOL-1", loading: false, error: null });
  });

  it("fetchShipmentTrackingNotification_whenNoRecordExists_storesSuccessfulEmptyResult", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: null } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingNotification("BOL-1"));
    expect(store.getState()).toMatchObject({ data: null, loadedBolNo: "BOL-1", loading: false, error: null });
  });

  it("fetchShipmentTrackingNotification_whenApiReportsMissingRecord_storesSuccessfulEmptyResult", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: {
        isSuccess: false,
        message: "Error: ShipmentTrackingNotification with BolNo DEW08626 not found.",
        data: null,
      } },
    });
    const store = createStore();
    const action = await store.dispatch(fetchShipmentTrackingNotification(" DEW08626  "));
    expect(fetchShipmentTrackingNotification.fulfilled.match(action)).toBe(true);
    expect(store.getState()).toMatchObject({ data: null, loadedBolNo: "DEW08626", loading: false, error: null });
  });

  it("fetchShipmentTrackingNotification_whenFailureEnvelopeReportsMissingRecord_storesSuccessfulEmptyResult", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: {
      isSuccess: false,
      message: "Error: ShipmentTrackingNotification with BolNo DEW08626 not found.",
      data: null,
    } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingNotification("DEW08626"));
    expect(store.getState()).toMatchObject({ data: null, loadedBolNo: "DEW08626", loading: false, error: null });
  });

  it.each([
    [400, "Error: ShipmentTrackingNotification with BolNo OTHER not found."],
    [400, "Error: Database unavailable."],
    [401, "Error: ShipmentTrackingNotification with BolNo DEW08626 not found."],
    [500, "Error: ShipmentTrackingNotification with BolNo DEW08626 not found."],
  ])("fetchShipmentTrackingNotification_whenErrorIsNotMissingCurrentRecord_preservesError (%s, %s)", async (status, message) => {
    vi.spyOn(axios, "get").mockRejectedValue({ isAxiosError: true, response: {
      status, data: { isSuccess: false, message, data: null },
    } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingNotification("DEW08626"));
    expect(store.getState().error).toBe(message);
  });

  it("fetchShipmentTrackingNotification_whenHttpErrorIncludesMessage_exposesApiMessage", async () => {
    vi.spyOn(axios, "get").mockRejectedValue({ isAxiosError: true, response: { data: { message: "Access denied" } } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingNotification("BOL-1"));
    expect(store.getState().error).toBe("Access denied");
  });

  it("reducer_whenNewLookupStarts_clearsPreviousPreferences", () => {
    let state = reducer(undefined, fetchShipmentTrackingNotification.pending("first", "BOL-1"));
    state = reducer(state, fetchShipmentTrackingNotification.fulfilled(preferences, "first", "BOL-1"));
    state = reducer(state, fetchShipmentTrackingNotification.pending("second", "BOL-2"));
    expect(state).toMatchObject({ data: null, loadedBolNo: null, requestedBolNo: "BOL-2", loading: true, error: null });
  });

  it("reducer_whenStaleLookupCompletes_preservesCurrentRequest", () => {
    let state = reducer(undefined, fetchShipmentTrackingNotification.pending("first", "BOL-1"));
    state = reducer(state, fetchShipmentTrackingNotification.pending("second", "BOL-2"));
    expect(reducer(state, fetchShipmentTrackingNotification.fulfilled(preferences, "first", "BOL-1"))).toEqual(state);
    expect(reducer(state, fetchShipmentTrackingNotification.rejected(new Error("Stale error"), "first", "BOL-1"))).toEqual(state);
  });

  it("fetchShipmentTrackingNotification_whenAborted_cancelsHttpWithoutDisplayingError", async () => {
    const getRequest = vi.spyOn(axios, "get").mockImplementation(() => new Promise(() => {}));
    const store = createStore();
    const request = store.dispatch(fetchShipmentTrackingNotification("BOL-1"));
    request.abort();
    await request;
    expect(getRequest.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(store.getState()).toMatchObject({ loading: false, error: null, currentRequestId: null });
  });
});

/** Creates a loaded notification store for write tests. */
function createSaveStore(existing = true) {
  const store = configureStore({ reducer: { shipmentTrackingNotification: reducer } });
  store.dispatch(fetchShipmentTrackingNotification.pending("lookup", "BOL-1"));
  store.dispatch(fetchShipmentTrackingNotification.fulfilled(existing ? preferences : null, "lookup", "BOL-1"));
  return store;
}

const saveArgs: SaveShipmentTrackingNotificationArgs = {
  ...preferences,
  email: "notify@example.com",
  isNotifyOnOutForDelivery: false,
};

describe("saveShipmentTrackingNotification", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saveShipmentTrackingNotification_whenRecordIsMissing_postsZeroIdAndStoresReturnedIdentity", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: preferences } });
    const store = createSaveStore(false);
    await store.dispatch(saveShipmentTrackingNotification({ ...saveArgs, shipmentTrackingNotificationId: 0 }));
    expect(post).toHaveBeenCalledWith(expect.stringContaining("AddShipmentTrackingNotification"), expect.objectContaining({ shipmentTrackingNotificationId: 0 }), expect.any(Object));
    expect(store.getState().shipmentTrackingNotification).toMatchObject({ data: preferences, saveSuccess: "Notification created.", saving: false });
  });

  it("saveShipmentTrackingNotification_whenRecordExists_putsSavedIdentity", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true, data: preferences } });
    const store = createSaveStore();
    await store.dispatch(saveShipmentTrackingNotification(saveArgs));
    expect(put).toHaveBeenCalledWith(expect.stringContaining("UpdateShipmentTrackingNotification"), saveArgs, expect.any(Object));
    expect(store.getState().shipmentTrackingNotification.saveSuccess).toBe("Notification updated.");
  });

  it.each([
    { isSuccess: false, message: "Rejected", data: null },
    { isSuccess: true, message: "", data: null },
  ])("saveShipmentTrackingNotification_whenEnvelopeIsInvalid_preservesSavedData ($isSuccess)", async (data) => {
    vi.spyOn(axios, "put").mockResolvedValue({ data });
    const store = createSaveStore();
    await store.dispatch(saveShipmentTrackingNotification(saveArgs));
    expect(store.getState().shipmentTrackingNotification).toMatchObject({ data: preferences, saving: false, saveSuccess: null });
    expect(store.getState().shipmentTrackingNotification.saveError).toBeTruthy();
  });

  it("saveShipmentTrackingNotification_whenUpdateReportsMissingRecord_preservesSaveError", async () => {
    const message = "Error: ShipmentTrackingNotification with BolNo BOL-1 not found.";
    vi.spyOn(axios, "put").mockRejectedValue({ isAxiosError: true, response: { status: 400, data: { isSuccess: false, message } } });
    const store = createSaveStore();
    await store.dispatch(saveShipmentTrackingNotification(saveArgs));
    expect(store.getState().shipmentTrackingNotification.saveError).toBe(message);
  });

  it("saveShipmentTrackingNotification_whenSaveIsPending_skipsDuplicateRequest", async () => {
    let resolveSave!: (response: unknown) => void;
    const put = vi.spyOn(axios, "put").mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const store = createSaveStore();
    const request = store.dispatch(saveShipmentTrackingNotification(saveArgs));
    await store.dispatch(saveShipmentTrackingNotification(saveArgs));
    expect(put).toHaveBeenCalledTimes(1);
    resolveSave({ data: { isSuccess: true, data: preferences } });
    await request;
  });

  it("saveShipmentTrackingNotification_whenAnotherShipmentLoads_ignoresOldResult", () => {
    const store = createSaveStore();
    store.dispatch(saveShipmentTrackingNotification.pending("save", saveArgs));
    store.dispatch(fetchShipmentTrackingNotification.pending("next", "BOL-2"));
    const before = store.getState();
    store.dispatch(saveShipmentTrackingNotification.fulfilled(preferences, "save", saveArgs));
    expect(store.getState()).toEqual(before);
    store.dispatch(saveShipmentTrackingNotification.rejected(new Error("Old failure"), "save", saveArgs));
    expect(store.getState()).toEqual(before);
  });

  it("saveShipmentTrackingNotification_whenExistingIdentityIsLost_skipsAccidentalCreate", async () => {
    const post = vi.spyOn(axios, "post");
    const store = createSaveStore();
    await store.dispatch(saveShipmentTrackingNotification({ ...saveArgs, shipmentTrackingNotificationId: 0 }));
    expect(post).not.toHaveBeenCalled();
  });
});

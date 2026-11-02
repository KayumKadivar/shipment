import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import reducer, { fetchShipmentTrackingReminder, saveShipmentTrackingReminder } from "./shipmentTrackingReminderSlice";

const reminder = {
  shipmentTrackingReminderId: 6, bolNo: "BOL-1", email: "first@example.com,second@example.com",
  fromDate: "2026-10-15T00:00:00", toDate: "2026-10-24T00:00:00", utcTime: "07:45 AM", timeZone: "CT",
};

/** Creates a deterministic store, optionally initialized by a completed lookup. */
function createStore(existing: boolean | null = null) {
  const store = configureStore({ reducer: { shipmentTrackingReminder: reducer } });
  if (existing !== null) {
    store.dispatch(fetchShipmentTrackingReminder.pending("lookup", "BOL-1"));
    store.dispatch(fetchShipmentTrackingReminder.fulfilled(existing ? reminder : null, "lookup", "BOL-1"));
  }
  return store;
}

describe("shipmentTrackingReminderSlice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetchShipmentTrackingReminder_whenLookupSucceeds_requestsTrimmedBolAndStoresData", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: reminder } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingReminder(" BOL-1  "));
    expect(get).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingReminder/GetByBolNo`, {
      params: { bolNo: "BOL-1" }, headers: { Accept: "text/plain" }, signal: expect.any(AbortSignal),
    });
    expect(store.getState().shipmentTrackingReminder).toMatchObject({ data: reminder, loadedBolNo: "BOL-1", loading: false, error: null });
  });

  it("fetchShipmentTrackingReminder_whenNoRecordExists_storesSuccessfulEmptyResult", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { isSuccess: true, data: null } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingReminder("BOL-1"));
    expect(store.getState().shipmentTrackingReminder).toMatchObject({ data: null, loadedBolNo: "BOL-1", error: null });
  });

  it.each(["envelope", "http"])("fetchShipmentTrackingReminder_whenLookupFails_exposesMessage (%s)", async (failure) => {
    const get = vi.spyOn(axios, "get");
    if (failure === "envelope") get.mockResolvedValue({ data: { isSuccess: false, message: "Lookup rejected", data: null } });
    else get.mockRejectedValue({ isAxiosError: true, response: { data: { message: "Lookup rejected" } } });
    const store = createStore();
    await store.dispatch(fetchShipmentTrackingReminder("BOL-1"));
    expect(store.getState().shipmentTrackingReminder.error).toBe("Lookup rejected");
  });

  it("fetchShipmentTrackingReminder_whenAborted_cancelsHttpWithoutError", async () => {
    const get = vi.spyOn(axios, "get").mockImplementation(() => new Promise(() => {}));
    const store = createStore();
    const request = store.dispatch(fetchShipmentTrackingReminder("BOL-1"));
    request.abort();
    await request;
    expect(get.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(store.getState().shipmentTrackingReminder).toMatchObject({ loading: false, error: null });
  });

  it("reducer_whenOldLookupCompletes_preservesNewRequest", () => {
    const store = createStore();
    store.dispatch(fetchShipmentTrackingReminder.pending("old", "BOL-1"));
    store.dispatch(fetchShipmentTrackingReminder.pending("new", "BOL-2"));
    const before = store.getState();
    store.dispatch(fetchShipmentTrackingReminder.fulfilled(reminder, "old", "BOL-1"));
    store.dispatch(fetchShipmentTrackingReminder.rejected(new Error("Old failure"), "old", "BOL-1"));
    expect(store.getState()).toEqual(before);
  });

  it("saveShipmentTrackingReminder_whenMissing_postsZeroIdAndStoresReturnedId", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { isSuccess: true, data: reminder } });
    const store = createStore(false);
    const payload = { ...reminder, shipmentTrackingReminderId: 0 };
    await store.dispatch(saveShipmentTrackingReminder(payload));
    expect(post).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingReminder`, payload, { headers: { Accept: "text/plain" } });
    expect(store.getState().shipmentTrackingReminder).toMatchObject({ data: reminder, saving: false, saveSuccess: "Reminder created." });
  });

  it("saveShipmentTrackingReminder_whenExisting_putsPersistedId", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ data: { isSuccess: true, data: reminder } });
    const store = createStore(true);
    await store.dispatch(saveShipmentTrackingReminder(reminder));
    expect(put).toHaveBeenCalledWith(`${API_BASE_URL}/ShipmentTrackingReminder`, reminder, { headers: { Accept: "text/plain" } });
    expect(store.getState().shipmentTrackingReminder.saveSuccess).toBe("Reminder updated.");
  });

  it.each([
    { isSuccess: false, message: "Rejected", data: null },
    { isSuccess: true, message: "", data: null },
    { isSuccess: true, message: "", data: { ...reminder, shipmentTrackingReminderId: 0 } },
  ])("saveShipmentTrackingReminder_whenEnvelopeIsInvalid_preservesSavedData ($isSuccess, $data)", async (data) => {
    vi.spyOn(axios, "put").mockResolvedValue({ data });
    const store = createStore(true);
    await store.dispatch(saveShipmentTrackingReminder(reminder));
    expect(store.getState().shipmentTrackingReminder.data).toEqual(reminder);
    expect(store.getState().shipmentTrackingReminder.saveError).toBeTruthy();
  });

  it("saveShipmentTrackingReminder_whenHttpFails_exposesApiMessage", async () => {
    vi.spyOn(axios, "put").mockRejectedValue({ isAxiosError: true, response: { data: { message: "Email must be a valid email address." } } });
    const store = createStore(true);
    await store.dispatch(saveShipmentTrackingReminder(reminder));
    expect(store.getState().shipmentTrackingReminder.saveError).toBe("Email must be a valid email address.");
  });

  it("saveShipmentTrackingReminder_whenSaveIsPending_preventsDuplicateRequest", async () => {
    let resolveSave!: (value: unknown) => void;
    const put = vi.spyOn(axios, "put").mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const store = createStore(true);
    const first = store.dispatch(saveShipmentTrackingReminder(reminder));
    await store.dispatch(saveShipmentTrackingReminder(reminder));
    expect(put).toHaveBeenCalledTimes(1);
    resolveSave({ data: { isSuccess: true, data: reminder } });
    await first;
  });

  it("saveShipmentTrackingReminder_whenLookupIsNotReady_doesNotSendWrite", async () => {
    const post = vi.spyOn(axios, "post");
    const store = createStore();
    await store.dispatch(saveShipmentTrackingReminder({ ...reminder, shipmentTrackingReminderId: 0 }));
    expect(post).not.toHaveBeenCalled();
  });

  it("reducer_whenOldSaveCompletes_preservesCurrentShipment", () => {
    const store = createStore(true);
    store.dispatch(saveShipmentTrackingReminder.pending("save", reminder));
    store.dispatch(fetchShipmentTrackingReminder.pending("next", "BOL-2"));
    const before = store.getState();
    store.dispatch(saveShipmentTrackingReminder.fulfilled(reminder, "save", reminder));
    store.dispatch(saveShipmentTrackingReminder.rejected(new Error("Old failure"), "save", reminder));
    expect(store.getState()).toEqual(before);
  });
});

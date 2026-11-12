import { configureStore } from "@reduxjs/toolkit";
import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "../app/store";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import type { EditShipmentApiResponse, EditShipmentRequest } from "../types/editShipment.types";
import reducer, { editShipment, resetEditShipment } from "./editShipmentSlice";

vi.mock("axios");
const payload = { loadNumber: "LOAD-100", srvToken: "" } as EditShipmentRequest;
const success = { isSuccess: true, message: "Updated", data: { bolNo: "LOAD-100", proNumber: "PRO-2" } } as EditShipmentApiResponse;

/** Executes the real thunk/reducer pair with a controlled authenticated session. */
function createSession(token: string | null = "test-login-token") {
  const store = configureStore({ reducer: { editShipment: reducer, app: () => ({ token }) } });
  return {
    store,
    save: () => editShipment(payload)(store.dispatch, () => store.getState() as RootState, undefined),
  };
}

describe("editShipment", () => {
  beforeEach(() => vi.resetAllMocks());

  it("editShipment_AuthenticatedSave_PostsConfiguredEndpointAndTokens", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: success });
    const session = createSession();
    await session.save();
    expect(axios.post).toHaveBeenCalledWith(`${API_BASE_URL}/EditShipment/EditShipment`, { ...payload, srvToken: SRV_TOKEN }, {
      headers: { Accept: "text/plain", "Content-Type": "application/json", Authorization: "Bearer test-login-token" },
    });
  });

  it("editShipment_Success_StoresSummaryAndMessage", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: success });
    const session = createSession();
    await session.save();
    expect(session.store.getState().editShipment).toMatchObject({ saving: false, data: success.data, successMessage: "Updated", error: null });
  });

  it("editShipment_MissingAuthentication_RejectsWithoutPosting", async () => {
    const session = createSession(null);
    await session.save();
    expect(axios.post).not.toHaveBeenCalled();
    expect(session.store.getState().editShipment.error).toContain("sign in");
  });

  it.each([
    { isSuccess: false, message: "Validation failed", data: null },
    { isSuccess: true, message: "Missing shipment", data: null },
  ])("editShipment_InvalidApiResult_RetainsError_$message", async (data) => {
    vi.mocked(axios.post).mockResolvedValue({ data });
    const session = createSession();
    await session.save();
    expect(session.store.getState().editShipment).toMatchObject({ error: data.message, successMessage: null, saving: false });
  });

  it("editShipment_HttpValidationError_ReportsServerMessage", async () => {
    vi.mocked(axios.isAxiosError).mockReturnValue(true);
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: "Product weight is required" } } });
    const session = createSession();
    await session.save();
    expect(session.store.getState().editShipment.error).toBe("Product weight is required");
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it("editShipment_DuplicateWhilePending_SendsOnlyOnePost", async () => {
    let resolve!: (value: { data: EditShipmentApiResponse }) => void;
    vi.mocked(axios.post).mockImplementation(() => new Promise((complete) => { resolve = complete; }));
    const session = createSession();
    const pending = session.save();
    await session.save();
    expect(axios.post).toHaveBeenCalledTimes(1);
    resolve({ data: success });
    await pending;
  });

  it("editShipment_ResultAfterPageReset_DoesNotRestoreOldShipmentState", async () => {
    let resolve!: (value: { data: EditShipmentApiResponse }) => void;
    vi.mocked(axios.post).mockImplementation(() => new Promise((complete) => { resolve = complete; }));
    const session = createSession();
    const pending = session.save();
    session.store.dispatch(resetEditShipment());
    resolve({ data: success });
    await pending;
    expect(session.store.getState().editShipment).toMatchObject({ data: null, successMessage: null, loadNumber: null });
  });
});

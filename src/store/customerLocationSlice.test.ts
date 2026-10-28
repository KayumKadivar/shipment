import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchClientsAndSubclients,
  updateCustomerLocation,
} from "./customerLocationSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("customer location API behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("updateCustomerLocation_whenApiReportsFailure_rejectsWithApiMessage", async () => {
    vi.spyOn(axios, "put").mockResolvedValue(
      createAxiosResponse({ isSuccess: false, message: "Update denied" }),
    );

    const action = await updateCustomerLocation({ locationId: 42 })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("customerLocation/updateCustomerLocation/rejected");
    expect(action.payload).toBe("Update denied");
  });

  it("fetchClientsAndSubclients_whenApiReturnsWrappedProfiles_mapsClientOptions", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          clientName: "Main Client",
          clientCode: "MAIN",
          profiles: [{ profileCode: "PROFILE-1" }],
        },
      }),
    );

    const action = await fetchClientsAndSubclients()(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "customerLocation/fetchClientsAndSubclients/fulfilled",
    );
    expect(action.payload).toEqual([
      expect.objectContaining({ clientName: "Main Client", clientCode: "MAIN" }),
      expect.objectContaining({ clientName: "PROFILE-1", clientCode: "PROFILE-1" }),
    ]);
  });

  it("fetchClientsAndSubclients_whenApiReturnsClientAndProfileDetails_mapsAllClients", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        data: {
          isCorporate: true,
          clientAndProfileDetails: [
            {
              clientCode: "DEVTS",
              clientName: "DEV TESTING",
              profileCode: "DEVTS",
              isLoggedClient: true,
            },
            {
              clientCode: "TS158",
              clientName: "TESTING SUBCLIENT",
              profileCode: "TS158",
              isLoggedClient: false,
            },
          ],
        },
      }),
    );

    const action = await fetchClientsAndSubclients()(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe(
      "customerLocation/fetchClientsAndSubclients/fulfilled",
    );
    expect(action.payload).toHaveLength(2);
    expect(action.payload).toEqual([
      expect.objectContaining({ clientCode: "DEVTS", clientName: "DEV TESTING", isLoggedClient: true }),
      expect.objectContaining({ clientCode: "TS158", clientName: "TESTING SUBCLIENT", isLoggedClient: false }),
    ]);
  });
});

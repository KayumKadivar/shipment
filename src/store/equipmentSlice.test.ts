import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { fetchEquipment } from "./equipmentSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const createGetState = (loaded = false) => () => ({
  equipment: {
    data: loaded ? ["Van", "Flatbed"] : [],
    loading: false,
    loaded,
    error: null,
    currentRequestId: null,
  },
});

describe("equipment API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchEquipment_whenRequested_usesEquipmentEndpoint", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await fetchEquipment()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("equipment/fetchEquipment/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/Equipment`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json, text/plain, */*",
        }),
      }),
    );
  });

  it("fetchEquipment_whenApiSucceeds_trimsAndDeduplicatesEquipmentNames", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: [" Van ", "Flatbed", "Van", "Reefer"],
      }),
    );

    const action = await fetchEquipment()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("equipment/fetchEquipment/fulfilled");
    expect(action.payload).toEqual(["Van", "Flatbed", "Reefer"]);
  });

  it("fetchEquipment_whenApiReportsFailure_returnsTheApiMessage", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Equipment lookup failed",
        data: null,
      }),
    );

    const action = await fetchEquipment()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("equipment/fetchEquipment/rejected");
    expect(action.payload).toBe("Equipment lookup failed");
  });

  it("fetchEquipment_whenLookupIsAlreadyLoaded_doesNotIssueAnotherRequest", async () => {
    const getRequest = vi.spyOn(axios, "get");
    const dispatch = vi.fn();

    const action = await fetchEquipment()(
      dispatch,
      createGetState(true),
      undefined,
    );

    expect(action).toMatchObject({
      type: "equipment/fetchEquipment/rejected",
      meta: { condition: true },
    });
    expect(getRequest).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

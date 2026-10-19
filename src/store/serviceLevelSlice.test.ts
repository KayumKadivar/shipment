import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { fetchServiceLevel, type ServiceLevelItem } from "./serviceLevelSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const createGetState = (loaded = false) => () => ({
  serviceLevel: {
    data: loaded
      ? [
          {
            serviceLevelId: 1,
            serviceLevelCode: "STD",
            description: "Standard",
          },
        ]
      : [],
    loading: false,
    loaded,
    error: null,
    currentRequestId: null,
  },
});

describe("serviceLevel API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchServiceLevel_whenRequested_usesServiceLevelEndpoint", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await fetchServiceLevel()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("serviceLevel/fetchServiceLevel/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/ServiceLevel`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/json, text/plain, */*",
        }),
      }),
    );
  });

  it("fetchServiceLevel_whenApiSucceeds_trimsAndMapsServiceLevelItems", async () => {
    const mockData: ServiceLevelItem[] = [
      {
        serviceLevelId: 1,
        serviceLevelCode: " STD ",
        description: " Standard ",
      },
      {
        serviceLevelId: 2,
        serviceLevelCode: "EXP",
        description: "Expedited",
      },
    ];

    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: mockData,
      }),
    );

    const action = await fetchServiceLevel()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("serviceLevel/fetchServiceLevel/fulfilled");
    expect(action.payload).toEqual([
      {
        serviceLevelId: 1,
        serviceLevelCode: "STD",
        description: "Standard",
      },
      {
        serviceLevelId: 2,
        serviceLevelCode: "EXP",
        description: "Expedited",
      },
    ]);
  });

  it("fetchServiceLevel_whenApiReportsFailure_returnsTheApiMessage", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Service level lookup failed",
        data: null,
      }),
    );

    const action = await fetchServiceLevel()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("serviceLevel/fetchServiceLevel/rejected");
    expect(action.payload).toBe("Service level lookup failed");
  });

  it("fetchServiceLevel_whenLookupIsAlreadyLoaded_doesNotIssueAnotherRequest", async () => {
    const getRequest = vi.spyOn(axios, "get");
    const dispatch = vi.fn();

    const action = await fetchServiceLevel()(
      dispatch,
      createGetState(true),
      undefined,
    );

    expect(action).toMatchObject({
      type: "serviceLevel/fetchServiceLevel/rejected",
      meta: { condition: true },
    });
    expect(getRequest).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL } from "../config/apiConfig";
import { fetchPackageTypes } from "./packageTypesSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const createGetState = (loaded = false) => () => ({
  packageTypes: {
    data: loaded ? [{ packageTypeId: 1, packageType: "Bag" }] : [],
    loading: false,
    loaded,
    error: null,
    currentRequestId: null,
  },
});

describe("package type API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchPackageTypes_whenRequested_usesProductPackageTypeEndpointAndTextResponseContract", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await fetchPackageTypes()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("packageTypes/fetchPackageTypes/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/ProductPackageType`,
      { headers: { Accept: "text/plain" } },
    );
  });

  it("fetchPackageTypes_whenApiSucceeds_trimsAndReturnsPackageTypeNames", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: [
          { packageTypeId: 1, packageType: " Bag " },
          { packageTypeId: 2, packageType: "Drum" },
        ],
      }),
    );

    const action = await fetchPackageTypes()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("packageTypes/fetchPackageTypes/fulfilled");
    expect(action.payload).toEqual([
      { packageTypeId: 1, packageType: "Bag" },
      { packageTypeId: 2, packageType: "Drum" },
    ]);
  });

  it("fetchPackageTypes_whenApiReportsFailure_returnsTheApiMessage", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Package type lookup failed",
        data: null,
      }),
    );

    const action = await fetchPackageTypes()(
      vi.fn(),
      createGetState(),
      undefined,
    );

    expect(action.type).toBe("packageTypes/fetchPackageTypes/rejected");
    expect(action.payload).toBe("Package type lookup failed");
  });

  it("fetchPackageTypes_whenLookupIsAlreadyLoaded_doesNotIssueAnotherRequest", async () => {
    const getRequest = vi.spyOn(axios, "get");
    const dispatch = vi.fn();

    const action = await fetchPackageTypes()(
      dispatch,
      createGetState(true),
      undefined,
    );

    expect(action).toMatchObject({
      type: "packageTypes/fetchPackageTypes/rejected",
      meta: { condition: true },
    });
    expect(getRequest).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

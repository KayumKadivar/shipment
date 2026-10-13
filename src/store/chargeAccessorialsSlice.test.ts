import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_BASE_URL,
  DEFAULT_CLIENT_CODE,
  SRV_TOKEN,
} from "../config/apiConfig";
import { fetchChargeAccessorials } from "./chargeAccessorialsSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

const accessorial = {
  clientID: 1132,
  accessorialID: 3980,
  accesorialCode: " DEI ",
  description: " DETENTION UNLOADING ",
  status: true,
  accesorialGroupID: 63,
  isSystem: false,
  isSelect: false,
};

describe("charge accessorial API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchChargeAccessorials_whenClientCodeIsProvided_usesShipmentClientCodeAndExpectedRequestContract", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    const action = await fetchChargeAccessorials(" CLIENT-42 ")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("chargeAccessorials/fetchChargeAccessorials/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/GetAccessorials`,
      {
        params: {
          srvToken: SRV_TOKEN,
          clientCode: "CLIENT-42",
        },
        headers: { Accept: "text/plain" },
      },
    );
  });

  it("fetchChargeAccessorials_whenClientCodeIsEmpty_usesDefaultClientCode", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({ isSuccess: true, message: "", data: [] }),
    );

    await fetchChargeAccessorials("  ")(vi.fn(), vi.fn(), undefined);

    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/GetAccessorials`,
      expect.objectContaining({
        params: {
          srvToken: SRV_TOKEN,
          clientCode: DEFAULT_CLIENT_CODE,
        },
      }),
    );
  });

  it("fetchChargeAccessorials_whenApiSucceeds_trimsDescriptionsAndCodes", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: true,
        message: "",
        data: [accessorial],
      }),
    );

    const action = await fetchChargeAccessorials("DEVTS")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("chargeAccessorials/fetchChargeAccessorials/fulfilled");
    expect(action.payload).toEqual({
      clientCode: "DEVTS",
      data: [
        {
          ...accessorial,
          accesorialCode: "DEI",
          description: "DETENTION UNLOADING",
        },
      ],
    });
  });

  it("fetchChargeAccessorials_whenApiReportsFailure_returnsRejectedAction", async () => {
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse({
        isSuccess: false,
        message: "Accessorial lookup failed",
        data: null,
      }),
    );

    const action = await fetchChargeAccessorials("DEVTS")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("chargeAccessorials/fetchChargeAccessorials/rejected");
    expect(action.payload).toBe("Accessorial lookup failed");
  });
});

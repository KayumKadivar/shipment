import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, DEFAULT_CLIENT_CODE, SRV_TOKEN } from "../config/apiConfig";
import {
  fetchCarrierTracking,
  type CarrierTrackingData,
} from "./carrierTrackingSlice";

type CarrierTrackingApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: CarrierTrackingData | null;
};

const trackingData = {
  statusDate: "2026-09-25",
  statusDescription: "In transit",
} as CarrierTrackingData;

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("carrier tracking API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchCarrierTracking_whenClientCodeIsMissing_usesDefaultClientCode", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse<CarrierTrackingApiResponse>({
        isSuccess: true,
        message: null,
        data: trackingData,
      }),
    );

    const action = await fetchCarrierTracking({ loadNumber: "LOAD-200" })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("carrierTracking/fetchCarrierTracking/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/CarrierTrackingLite`,
      {
        params: {
          loadNumber: "LOAD-200",
          srvToken: SRV_TOKEN,
          clientCode: DEFAULT_CLIENT_CODE,
        },
        headers: { Accept: "text/plain" },
      },
    );
  });

  it("fetchCarrierTracking_whenClientCodeIsProvided_usesTrimmedClientCode", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse<CarrierTrackingApiResponse>({
        isSuccess: true,
        message: null,
        data: trackingData,
      }),
    );

    const action = await fetchCarrierTracking({
      loadNumber: "LOAD-300",
      clientCode: "  CUSTOMER  ",
    })(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("carrierTracking/fetchCarrierTracking/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/CarrierTrackingLite`,
      {
        params: {
          loadNumber: "LOAD-300",
          srvToken: SRV_TOKEN,
          clientCode: "CUSTOMER",
        },
        headers: { Accept: "text/plain" },
      },
    );
  });
});

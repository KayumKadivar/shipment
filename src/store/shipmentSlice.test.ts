import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, DEFAULT_CLIENT_CODE, SRV_TOKEN } from "../config/apiConfig";
import type {
  ShipmentApiResponse,
  ShipmentDetails,
  ShipmentListApiResponse,
} from "../types/shipment.types";
import {
  fetchShipmentByLoadNumber,
  fetchShipments,
} from "./shipmentSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("shipment API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchShipments_whenShipmentEnvIsAbsent_usesSharedApiConfiguration", async () => {
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse<ShipmentListApiResponse>({
        isSuccess: true,
        message: null,
        data: [],
      }),
    );

    const action = await fetchShipments({ pageNumber: 2, pageSize: 25 })(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("shipment/fetchShipments/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/Shipment/GetShipmentsByClientCode/${encodeURIComponent(DEFAULT_CLIENT_CODE)}`,
      {
        params: { pageNumber: 2, pageSize: 25 },
        headers: { Accept: "text/plain" },
      },
    );
  });

  it("fetchShipmentByLoadNumber_whenShipmentEnvIsAbsent_usesSharedServiceToken", async () => {
    const shipment = { loadNumber: "LOAD-100" } as ShipmentDetails;
    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse<ShipmentApiResponse>({
        isSuccess: true,
        message: "",
        data: shipment,
      }),
    );

    const action = await fetchShipmentByLoadNumber("LOAD-100")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(action.type).toBe("shipment/fetchByLoadNumber/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/GetShipmentByLoadNumber`,
      {
        params: { srvToken: SRV_TOKEN, loadNumber: "LOAD-100" },
        headers: { Accept: "application/json" },
      },
    );
  });
});

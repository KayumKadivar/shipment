import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import {
  fetchShipmentDocuments,
  clearShipmentDocuments,
  default as shipmentDocumentReducer,
} from "./shipmentDocumentSlice";

const createAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: "OK",
  headers: new AxiosHeaders(),
  config: { headers: new AxiosHeaders() },
});

describe("shipmentDocumentSlice", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchShipmentDocuments calls /GetDocumentsByLoadNumberAndClientCode with parameters", async () => {
    const mockApiResponse = {
      isSuccess: true,
      message: "OK",
      data: {
        statusCode: 0,
        message: "Found",
        bolImage: "https://example.com/bol.pdf",
        dateRetrival: "2026-11-16T04:12:57.641Z",
      },
    };

    const getRequest = vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse(mockApiResponse)
    );

    const action = await fetchShipmentDocuments({
      loadNumber: "DEW08964",
      clientCode: "CLI-01",
    })(vi.fn(), vi.fn(), undefined);

    expect(action.type).toBe("shipmentDocument/fetchShipmentDocuments/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/GetDocumentsByLoadNumberAndClientCode`,
      {
        params: {
          loadNumber: "DEW08964",
          clientCode: "CLI-01",
          srvToken: SRV_TOKEN,
        },
        headers: { Accept: "*/*" },
      }
    );
  });

  it("handles state changes during fetchShipmentDocuments lifecycle", () => {
    const initialState = {
      data: null,
      loading: false,
      error: null,
      requestedLoadNumber: null,
      loadedLoadNumber: null,
    };

    const pendingState = shipmentDocumentReducer(
      initialState,
      fetchShipmentDocuments.pending("", { loadNumber: "DEW08964", clientCode: "CLI-01" })
    );
    expect(pendingState.loading).toBe(true);
    expect(pendingState.requestedLoadNumber).toBe("DEW08964");

    const payload = { isSuccess: true, data: { bolImage: "img" } };
    const fulfilledState = shipmentDocumentReducer(
      pendingState,
      fetchShipmentDocuments.fulfilled(payload, "", { loadNumber: "DEW08964", clientCode: "CLI-01" })
    );
    expect(fulfilledState.loading).toBe(false);
    expect(fulfilledState.data).toEqual(payload);
    expect(fulfilledState.loadedLoadNumber).toBe("DEW08964");

    const clearedState = shipmentDocumentReducer(fulfilledState, clearShipmentDocuments());
    expect(clearedState.data).toBeNull();
  });
});

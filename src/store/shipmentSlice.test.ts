import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import type {
  ShipmentApiResponse,
  ShipmentDetails,
  ShipmentListApiResponse,
  ShipmentListItem,
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

/** Maps one mocked list response through the public thunk and returns its displayed status. */
async function fetchMappedStatusAsync(shipmentStatus: string | null | undefined) {
  const item: ShipmentListItem = {
    bolNo: "BOL-100",
    customerName: null,
    clientCode: null,
    statusId: 2,
    ...(shipmentStatus === undefined ? {} : { shipmentStatus }),
    isPickupSuccess: false,
    aljexProNumber: null,
    pickupDate: null,
    scac: null,
    carrierName: null,
    originName: null,
    originAddress1: null,
    originCity: null,
    originStateCode: null,
    originZipCode: null,
    destinationName: null,
    destinationAddress1: null,
    destinationCity: null,
    destinationStateCode: null,
    destinationZipCode: null,
    pallets: 0,
    weight: 0,
    originTerminalCode: null,
    originTerminalName: null,
    originTerminalZip: null,
    originTerminalPhone: null,
    destinationTerminalCode: null,
    destinationTerminalName: null,
    destinationTerminalZip: null,
    destinationTerminalPhone: null,
  };
  vi.spyOn(axios, "get").mockResolvedValue(createAxiosResponse<ShipmentListApiResponse>({
    isSuccess: true, message: "", data: [item],
  }));
  const action = await fetchShipments({ pageNumber: 1, pageSize: 20 })(vi.fn(), vi.fn(), undefined);
  if (!fetchShipments.fulfilled.match(action)) throw new Error("Expected the shipment list request to be fulfilled.");
  return action.payload.shipments[0]?.status;
}

describe("shipment API configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchShipments_whenShipmentStatusIsProvided_mapsApiStatusText", async () => {
    expect(await fetchMappedStatusAsync("Booked")).toBe("Booked");
  });

  it("fetchShipments_whenShipmentStatusHasWhitespace_trimsStatusText", async () => {
    expect(await fetchMappedStatusAsync("  Booked  ")).toBe("Booked");
  });

  it.each([undefined, null, "", "   "])(
    "fetchShipments_whenShipmentStatusIsUnavailable_preservesNumericFallback (%s)",
    async (shipmentStatus) => {
      expect(await fetchMappedStatusAsync(shipmentStatus)).toBe("Status 2");
    },
  );

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

    const targetCode = "DEVTS";
    expect(action.type).toBe("shipment/fetchShipments/fulfilled");
    expect(getRequest).toHaveBeenCalledWith(
      `${API_BASE_URL}/Shipment/GetShipmentsByClientCode/${encodeURIComponent(targetCode)}`,
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

  it("fetchShipmentByLoadNumber_whenResponseContainsExpandedContract_preservesAndNormalizesNewFields", async () => {
    const expandedContractFields = {
      createLoadInTms: true,
      sendCarrierPickupReq: false,
      ladingID: 42,
      orgCompanyName: " Origin Company ",
      orgContactFirstName: " Casey ",
      orgContactLastName: null,
      orgPhoneAreaCode: " 312 ",
      orgWhoPhoneNumber: null,
      isTestMode: false,
      brokerCode: " BRK-1 ",
      clientAddress1: " 100 Client Road ",
      clientAddress2: null,
      clientCountryCode: " US ",
      clientCityName: " Chicago ",
      clientPhone: null,
      clientStateCode: " IL ",
      clientZipCode: " 60601 ",
      originFax: null,
      destFaxNo: " 555-0100 ",
      poNumber: " PO-200 ",
      bolDispatchNotes: [" Call before arrival ", " Use dock 3 "],
      paymentTerms: " Prepaid ",
      totalLength: 48,
      totalWidth: null,
      totalHeight: 40,
      wiseTechTransactionNo: " WT-100 ",
      originPortCode: " ORD ",
      destinationPortCode: " LAX ",
      codAmount: null,
      totalLinearFeet: 12.5,
      tariffType: null,
      products: [
        {
          productDescription: " Paint ",
          productClass: " 70 ",
          productWeight: 500,
          pallets: 1,
          pieces: 10,
          nmfc: " 12345 ",
          hazMat: true,
          length: 48,
          width: 40,
          height: 36,
          pcf: 8.5,
          packageType: " Pallet ",
          skuNumber: " SKU-100 ",
          accountNumber: null,
          linearFeet: 4,
          hazmatProperShippingName: " Flammable liquid ",
          hazmatClass: " 3 ",
          hazmatUnNaNumber: " UN1993 ",
          hazmatPhone: null,
          hazmatGroup: " II ",
          hazmatContact: " Safety Desk ",
          stackable: true,
        },
      ],
    } satisfies Pick<
      ShipmentDetails,
      | "createLoadInTms"
      | "sendCarrierPickupReq"
      | "ladingID"
      | "orgCompanyName"
      | "orgContactFirstName"
      | "orgContactLastName"
      | "orgPhoneAreaCode"
      | "orgWhoPhoneNumber"
      | "isTestMode"
      | "brokerCode"
      | "clientAddress1"
      | "clientAddress2"
      | "clientCountryCode"
      | "clientCityName"
      | "clientPhone"
      | "clientStateCode"
      | "clientZipCode"
      | "originFax"
      | "destFaxNo"
      | "poNumber"
      | "bolDispatchNotes"
      | "paymentTerms"
      | "totalLength"
      | "totalWidth"
      | "totalHeight"
      | "wiseTechTransactionNo"
      | "originPortCode"
      | "destinationPortCode"
      | "codAmount"
      | "totalLinearFeet"
      | "tariffType"
      | "products"
    >;
    const shipment = {
      loadNumber: " LOAD-200 ",
      ...expandedContractFields,
    } as ShipmentDetails;
    vi.spyOn(axios, "get").mockResolvedValue(
      createAxiosResponse<ShipmentApiResponse>({
        isSuccess: true,
        message: "",
        data: shipment,
      }),
    );

    const action = await fetchShipmentByLoadNumber("LOAD-200")(
      vi.fn(),
      vi.fn(),
      undefined,
    );

    expect(fetchShipmentByLoadNumber.fulfilled.match(action)).toBe(true);
    if (!fetchShipmentByLoadNumber.fulfilled.match(action)) {
      throw new Error("Expected the shipment request to be fulfilled.");
    }

    expect(action.payload.createLoadInTms).toBe(true);
    expect(action.payload.sendCarrierPickupReq).toBe(false);
    expect(action.payload.totalLinearFeet).toBe(12.5);
    expect(action.payload.tariffType).toBeNull();
    expect(action.payload.bolDispatchNotes).toEqual([
      "Call before arrival",
      "Use dock 3",
    ]);
    expect(action.payload.products[0]?.skuNumber).toBe("SKU-100");
    expect(action.payload.products[0]?.hazmatProperShippingName).toBe(
      "Flammable liquid",
    );
  });
});

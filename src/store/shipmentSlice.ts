import { mapShipmentListItem, trimApiStrings } from "../lib/shipmentListMapping";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import {
  API_BASE_URL,
    SRV_TOKEN,
} from "../config/apiConfig";
import type { RootState } from "../app/store";
import type {
  FetchShipmentsArgs,
  ShipmentApiResponse,
  ShipmentDetails,
  ShipmentListApiResponse,
  ShipmentRecord,
} from "../types/shipment.types";

type ShipmentState = {
  currentShipment: ShipmentDetails | null;
  loading: boolean;
  error: string | null;
  requestedLoadNumber: string | null;
  currentRequestId: string | null;
  shipments: ShipmentRecord[];
  shipmentsLoading: boolean;
  shipmentsError: string | null;
  shipmentsPage: number;
  hasNextShipmentsPage: boolean;
  shipmentsRequestId: string | null;
  knownLastShipmentsPage: number | null;
};

const initialState: ShipmentState = {
  currentShipment: null,
  loading: false,
  error: null,
  requestedLoadNumber: null,
  currentRequestId: null,
  shipments: [],
  shipmentsLoading: false,
  shipmentsError: null,
  shipmentsPage: 1,
  hasNextShipmentsPage: false,
  shipmentsRequestId: null,
  knownLastShipmentsPage: null,
};

export const fetchShipments = createAsyncThunk<
  { shipments: ShipmentRecord[]; pageNumber: number; pageSize: number },
  FetchShipmentsArgs,
  { state: RootState; rejectValue: string }
>(
  "shipment/fetchShipments",
  async ({ pageNumber, pageSize, clientCode }, { getState, rejectWithValue }) => {
    try {
      const state = typeof getState === "function" ? (getState() as RootState) : undefined;
      let targetCode = (typeof clientCode === "string" && clientCode.trim()) || "";

      if (!targetCode && state) {
        targetCode =
          state.app?.ratingProfileCode?.trim() ||
          state.customerLocation?.clients?.[0]?.ratingProfileCode?.trim() ||
          state.app?.clientCode?.trim() ||
          "";
      }

      if (!targetCode) {
        try {
          const token = state?.app?.token;
          const profileRes = await axios.get(
            `${API_BASE_URL}/GetClientAndSubclientWithProfiles?srvToken=${SRV_TOKEN}`,
            {
              headers: {
                accept: "*/*",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          );
          const rawData = profileRes.data?.data;
          const list = Array.isArray(rawData)
            ? rawData
            : Array.isArray(rawData?.clientAndProfileDetails)
              ? rawData.clientAndProfileDetails
              : Array.isArray(rawData?.ClientAndProfileDetails)
                ? rawData.ClientAndProfileDetails
                : null;

          if (Array.isArray(list) && list.length > 0) {
            targetCode =
              list[0]?.ratingProfileCode?.trim() ||
              list[0]?.RatingProfileCode?.trim() ||
              list[0]?.clientCode?.trim() ||
              list[0]?.ClientCode?.trim() ||
              "";
          }
        } catch {
        }
      }

      const url = targetCode
        ? `${API_BASE_URL}/Shipment/GetShipmentsByClientCode/${encodeURIComponent(targetCode)}`
        : `${API_BASE_URL}/Shipment/GetShipmentsByClientCode`;

      const response = await axios.get<ShipmentListApiResponse>(
        url,
        {
          params: { pageNumber, pageSize },
          headers: {
            Accept: "text/plain",
          },
        },
      );

      if (!response.data.isSuccess) {
        return rejectWithValue(
          response.data.message || "Shipments could not be retrieved.",
        );
      }

      const items = trimApiStrings(response.data.data ?? []);
      return {
        shipments: items.map(mapShipmentListItem),
        pageNumber,
        pageSize,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError<ShipmentListApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Unable to load shipments.",
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Unable to load shipments.",
      );
    }
  },
);

export const fetchShipmentByLoadNumber = createAsyncThunk<
  ShipmentDetails,
  string,
  { rejectValue: string }
>("shipment/fetchByLoadNumber", async (loadNumber, { rejectWithValue }) => {
  try {
    const response = await axios.get<ShipmentApiResponse>(
      `${API_BASE_URL}/GetShipmentByLoadNumber`,
      {
        params: { srvToken: SRV_TOKEN, loadNumber },
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.data.isSuccess || !response.data.data) {
      return rejectWithValue(
        response.data.message || `Shipment ${loadNumber} was not found.`,
      );
    }

    return trimApiStrings(response.data.data);
  } catch (error: unknown) {
    if (axios.isAxiosError<ShipmentApiResponse>(error)) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.message ||
          `Unable to load shipment ${loadNumber}.`,
      );
    }

    return rejectWithValue(
      error instanceof Error
        ? error.message
        : `Unable to load shipment ${loadNumber}.`,
    );
  }
});

export const copyShipment = createAsyncThunk<
  { message: string; data?: any },
  string,
  { state: RootState; rejectValue: string }
>("shipment/copyShipment", async (bolNo: string, { getState, rejectWithValue }) => {
  try {
    const state = typeof getState === "function" ? (getState() as RootState) : undefined;
    const token = state?.app?.token;
    const headers: Record<string, string> = {
      Accept: "application/json, text/plain, */*",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const trimmedBolNo = bolNo.trim();
    const response = await axios.post(
      `${API_BASE_URL}/CopyShipment/CopyShipment`,
      { bolNo: trimmedBolNo },
      {
        params: { bolNo: trimmedBolNo },
        headers,
      }
    );

    if (response.data && response.data.isSuccess === false) {
      return rejectWithValue(
        response.data.message || `Failed to copy shipment ${bolNo}.`
      );
    }

    return {
      message:
        (typeof response.data === "string" ? response.data : response.data?.message) ||
        "Shipment copied successfully!",
      data: response.data?.data ?? response.data,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data?.title ||
          error.message ||
          `Failed to copy shipment ${bolNo}.`
      );
    }
    return rejectWithValue(
      error instanceof Error ? error.message : `Failed to copy shipment ${bolNo}.`
    );
  }
});

const shipmentSlice = createSlice({
  name: "shipment",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShipments.pending, (state, action) => {
        state.shipmentsLoading = true;
        state.shipmentsError = null;
        state.shipmentsRequestId = action.meta.requestId;
      })
      .addCase(fetchShipments.fulfilled, (state, action) => {
        if (state.shipmentsRequestId !== action.meta.requestId) return;

        const { shipments, pageNumber, pageSize } = action.payload;
        if (shipments.length < pageSize) {
          state.knownLastShipmentsPage =
            shipments.length === 0 && pageNumber > 1
              ? pageNumber - 1
              : pageNumber;
        }

        state.shipments = shipments;
        state.shipmentsPage = pageNumber;
        state.shipmentsLoading = false;
        state.shipmentsRequestId = null;
        state.hasNextShipmentsPage =
          shipments.length === pageSize &&
          (state.knownLastShipmentsPage === null ||
            pageNumber < state.knownLastShipmentsPage);
      })
      .addCase(fetchShipments.rejected, (state, action) => {
        if (state.shipmentsRequestId !== action.meta.requestId) return;
        state.shipmentsLoading = false;
        state.shipmentsRequestId = null;

        if (action.meta.aborted) return;
        state.shipmentsError =
          action.payload || action.error.message || "Unable to load shipments.";
      })
      .addCase(fetchShipmentByLoadNumber.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.currentShipment = null;
        state.requestedLoadNumber = action.meta.arg;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchShipmentByLoadNumber.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.currentShipment = action.payload;
        state.currentRequestId = null;
      })
      .addCase(fetchShipmentByLoadNumber.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.currentShipment = null;
        state.currentRequestId = null;
        state.error =
          action.payload || action.error.message || "Unable to load shipment.";
      });
  },
});

export default shipmentSlice.reducer;

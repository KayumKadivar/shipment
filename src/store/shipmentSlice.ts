import { mapShipmentListItem, trimApiStrings } from "../lib/shipmentListMapping";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import {
  API_BASE_URL,
  DEFAULT_CLIENT_CODE,
  SRV_TOKEN,
} from "../config/apiConfig";
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
  { rejectValue: string }
>(
  "shipment/fetchShipments",
  async ({ pageNumber, pageSize }, { rejectWithValue }) => {
    try {
      const response = await axios.get<ShipmentListApiResponse>(
        `${API_BASE_URL}/Shipment/GetShipmentsByClientCode/${encodeURIComponent(DEFAULT_CLIENT_CODE)}`,
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

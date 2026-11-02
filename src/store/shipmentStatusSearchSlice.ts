import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import { mapShipmentListItem, trimApiStrings } from "../lib/shipmentListMapping";
import type { ShipmentListApiResponse, ShipmentRecord } from "../types/shipment.types";
import { logout } from "./appSlice";

/** Status criteria and pagination accepted by the search endpoint. */
export type SearchShipmentsByStatusArgs = {
  statusCodes: string[];
  pageNumber: number;
  pageSize: number;
};

/** Tracks the current status query and its pagination boundaries. */
type ShipmentStatusSearchState = {
  shipments: ShipmentRecord[];
  loading: boolean;
  error: string | null;
  currentRequestId: string | null;
  queryKey: string | null;
  pageNumber: number;
  hasNextPage: boolean;
  knownLastPage: number | null;
};

const initialState: ShipmentStatusSearchState = {
  shipments: [], loading: false, error: null, currentRequestId: null,
  queryKey: null, pageNumber: 1, hasNextPage: false, knownLastPage: null,
};

/** Searches authenticated shipments and maps rows using the shared list mapper. */
export const searchShipmentsByStatus = createAsyncThunk<
  { shipments: ShipmentRecord[]; pageNumber: number; pageSize: number },
  SearchShipmentsByStatusArgs,
  { rejectValue: string }
>("shipmentStatusSearch/searchShipmentsByStatus", async ({ statusCodes, pageNumber, pageSize }, { rejectWithValue, signal }) => {
  try {
    const response = await axios.post<ShipmentListApiResponse>(
      `${API_BASE_URL}/Shipment/SearchShipmentByStatus`,
      { statusCodes, pageNumber, pageSize },
      { headers: { Accept: "text/plain", "Content-Type": "application/json" }, signal },
    );
    if (!response.data?.isSuccess || !Array.isArray(response.data.data)) {
      return rejectWithValue(response.data?.message || "Unable to search shipments by status.");
    }
    return { shipments: trimApiStrings(response.data.data).map(mapShipmentListItem), pageNumber, pageSize };
  } catch (error: unknown) {
    const message = axios.isAxiosError<ShipmentListApiResponse>(error)
      ? error.response?.data?.message || error.message
      : error instanceof Error ? error.message : null;
    return rejectWithValue(message || "Unable to search shipments by status.");
  }
});

const shipmentStatusSearchSlice = createSlice({
  name: "shipmentStatusSearch",
  initialState,
  reducers: {
    /** Invalidates the previous filter and its pagination knowledge. */
    resetShipmentStatusSearch: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(searchShipmentsByStatus.pending, (state, action) => {
        const queryKey = JSON.stringify([action.meta.arg.statusCodes, action.meta.arg.pageSize]);
        if (queryKey !== state.queryKey) state.knownLastPage = null;
        state.queryKey = queryKey;
        state.shipments = [];
        state.loading = true;
        state.error = null;
        state.hasNextPage = false;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(searchShipmentsByStatus.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        const { shipments, pageNumber, pageSize } = action.payload;
        if (shipments.length < pageSize) {
          state.knownLastPage = shipments.length === 0 && pageNumber > 1 ? pageNumber - 1 : pageNumber;
        }
        state.shipments = shipments;
        state.pageNumber = pageNumber;
        state.loading = false;
        state.error = null;
        state.currentRequestId = null;
        state.hasNextPage = shipments.length === pageSize && (state.knownLastPage === null || pageNumber < state.knownLastPage);
      })
      .addCase(searchShipmentsByStatus.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.currentRequestId = null;
        state.error = action.meta.aborted ? null : action.payload || "Unable to search shipments by status.";
      });
  },
});

export const { resetShipmentStatusSearch } = shipmentStatusSearchSlice.actions;
export default shipmentStatusSearchSlice.reducer;

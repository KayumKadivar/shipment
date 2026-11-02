import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import { logout } from "./appSlice";

/** Count returned for one shipment status. */
export type ShipmentStatusCount = {
  shipmentStatus: string;
  shipmentCount: number;
};

/** Response envelope for shipment status counts. */
type ShipmentStatusCountsApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: ShipmentStatusCount[] | null;
};

/** Current lookup state; null data means counts are unavailable. */
type ShipmentStatusCountsState = {
  data: ShipmentStatusCount[] | null;
  loading: boolean;
  error: string | null;
  currentRequestId: string | null;
};

const initialState: ShipmentStatusCountsState = {
  data: null,
  loading: false,
  error: null,
  currentRequestId: null,
};

/** Loads counts for the authenticated user with support for cancellation. */
export const fetchShipmentStatusCounts = createAsyncThunk<
  ShipmentStatusCount[],
  void,
  { rejectValue: string }
>("shipmentStatusCounts/fetchShipmentStatusCounts", async (_, { rejectWithValue, signal }) => {
  try {
    const response = await axios.get<ShipmentStatusCountsApiResponse>(
      `${API_BASE_URL}/Shipment/GetShipmentStatusCounts`,
      { headers: { Accept: "text/plain" }, signal },
    );
    if (!response.data?.isSuccess || !Array.isArray(response.data.data)) {
      return rejectWithValue(response.data?.message || "Unable to load shipment status counts.");
    }
    return response.data.data;
  } catch (error: unknown) {
    const message = axios.isAxiosError<ShipmentStatusCountsApiResponse>(error)
      ? error.response?.data?.message || error.message
      : error instanceof Error ? error.message : null;
    return rejectWithValue(message || "Unable to load shipment status counts.");
  }
});

const shipmentStatusCountsSlice = createSlice({
  name: "shipmentStatusCounts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => initialState)
      .addCase(fetchShipmentStatusCounts.pending, (state, action) => {
        state.data = null;
        state.loading = true;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchShipmentStatusCounts.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.data = action.payload;
        state.loading = false;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(fetchShipmentStatusCounts.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.data = null;
        state.loading = false;
        state.currentRequestId = null;
        state.error = action.meta.aborted ? null : action.payload || "Unable to load shipment status counts.";
      });
  },
});

export default shipmentStatusCountsSlice.reducer;

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

/** Saved notification recipients and nullable event preferences for a BOL. */
export type ShipmentTrackingNotificationData = {
  shipmentTrackingNotificationId: number;
  bolNo: string;
  email: string | null;
  isNotifyOnPickupRequest: boolean | null;
  isNotifyOnInTransit: boolean | null;
  isNotifyOnOutForDelivery: boolean | null;
  isNotifyOnDelivered: boolean | null;
};

/** Complete recipient and event snapshot sent to the create or update endpoint. */
export type SaveShipmentTrackingNotificationArgs = {
  shipmentTrackingNotificationId: number;
  bolNo: string;
  email: string;
  isNotifyOnPickupRequest: boolean;
  isNotifyOnInTransit: boolean;
  isNotifyOnOutForDelivery: boolean;
  isNotifyOnDelivered: boolean;
};

/** Notification lookup envelope; null data means no saved preferences. */
type ShipmentTrackingNotificationApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: ShipmentTrackingNotificationData | null;
};

/** Tracks the current BOL lookup and prevents stale requests from replacing it. */
type ShipmentTrackingNotificationState = {
  data: ShipmentTrackingNotificationData | null;
  loading: boolean;
  error: string | null;
  requestedBolNo: string | null;
  loadedBolNo: string | null;
  currentRequestId: string | null;
  saving: boolean;
  saveRequestId: string | null;
  saveBolNo: string | null;
  saveError: string | null;
  saveSuccess: string | null;
};

const initialState: ShipmentTrackingNotificationState = {
  data: null,
  loading: false,
  error: null,
  requestedBolNo: null,
  loadedBolNo: null,
  currentRequestId: null,
  saving: false,
  saveRequestId: null,
  saveBolNo: null,
  saveError: null,
  saveSuccess: null,
};

/** Fetches preferences using the configured authentication interceptor and cancellation signal. */
export const fetchShipmentTrackingNotification = createAsyncThunk<
  ShipmentTrackingNotificationData | null,
  string,
  { rejectValue: string }
>(
  "shipmentTrackingNotification/fetchShipmentTrackingNotification",
  async (bolNo, { rejectWithValue, signal }) => {
    const notFoundMessage = `Error: ShipmentTrackingNotification with BolNo ${bolNo.trim()} not found.`;
    try {
      const response = await axios.get<ShipmentTrackingNotificationApiResponse>(
        `${API_BASE_URL}/ShipmentTrackingNotification/GetShipmentTrackingNotificationByBolNo`,
        {
          params: { bolNo: bolNo.trim() },
          headers: { Accept: "text/plain" },
          signal,
        },
      );
      if (!response.data.isSuccess) {
        if (response.data.message === notFoundMessage) return null;
        return rejectWithValue(response.data.message || "Unable to load notification preferences.");
      }
      return response.data.data;
    } catch (error: unknown) {
      // The existing API reports an absent optional record as a bad request.
      if (
        axios.isAxiosError<ShipmentTrackingNotificationApiResponse>(error) &&
        error.response?.status === 400 &&
        error.response.data?.isSuccess === false &&
        error.response.data.message === notFoundMessage
      ) {
        return null;
      }
      const message = axios.isAxiosError<ShipmentTrackingNotificationApiResponse>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : null;
      return rejectWithValue(message || "Unable to load notification preferences.");
    }
  },
);

/** Persists a loaded shipment's preferences once and returns its server-assigned identity. */
export const saveShipmentTrackingNotification = createAsyncThunk<
  ShipmentTrackingNotificationData,
  SaveShipmentTrackingNotificationArgs,
  { state: { shipmentTrackingNotification: ShipmentTrackingNotificationState }; rejectValue: string }
>(
  "shipmentTrackingNotification/saveShipmentTrackingNotification",
  async (args, { rejectWithValue }) => {
    try {
      const payload = { ...args, bolNo: args.bolNo.trim(), email: args.email.split(",").map((email) => email.trim()).join(",") };
      const config = { headers: { Accept: "text/plain" } };
      const response = args.shipmentTrackingNotificationId > 0
        ? await axios.put<ShipmentTrackingNotificationApiResponse>(
            `${API_BASE_URL}/ShipmentTrackingNotification/UpdateShipmentTrackingNotification`, payload, config,
          )
        : await axios.post<ShipmentTrackingNotificationApiResponse>(
            `${API_BASE_URL}/ShipmentTrackingNotification/AddShipmentTrackingNotification`, payload, config,
          );
      if (!response.data.isSuccess || !response.data.data || response.data.data.shipmentTrackingNotificationId <= 0) {
        return rejectWithValue(response.data.message || "Unable to save notification preferences.");
      }
      return response.data.data;
    } catch (error: unknown) {
      const message = axios.isAxiosError<ShipmentTrackingNotificationApiResponse>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : null;
      return rejectWithValue(message || "Unable to save notification preferences.");
    }
  },
  {
    condition: (args, { getState }) => {
      const state = getState().shipmentTrackingNotification;
      return !state.saving && !state.loading && !state.error &&
        state.loadedBolNo === args.bolNo.trim() &&
        args.shipmentTrackingNotificationId === (state.data?.shipmentTrackingNotificationId ?? 0);
    },
  },
);

const shipmentTrackingNotificationSlice = createSlice({
  name: "shipmentTrackingNotification",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShipmentTrackingNotification.pending, (state, action) => {
        state.saving = false;
        state.saveRequestId = null;
        state.saveBolNo = null;
        state.saveError = null;
        state.saveSuccess = null;
        state.loading = true;
        state.error = null;
        state.data = null;
        state.loadedBolNo = null;
        state.requestedBolNo = action.meta.arg.trim();
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchShipmentTrackingNotification.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.data = action.payload;
        state.loading = false;
        state.loadedBolNo = action.meta.arg.trim();
        state.currentRequestId = null;
      })
      .addCase(fetchShipmentTrackingNotification.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.currentRequestId = null;
        if (action.meta.aborted) return;
        state.error = action.payload || action.error.message || "Unable to load notification preferences.";
      })
      .addCase(saveShipmentTrackingNotification.pending, (state, action) => {
        state.saving = true;
        state.saveRequestId = action.meta.requestId;
        state.saveBolNo = action.meta.arg.bolNo.trim();
        state.saveError = null;
        state.saveSuccess = null;
      })
      .addCase(saveShipmentTrackingNotification.fulfilled, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId || state.loadedBolNo !== action.meta.arg.bolNo.trim()) return;
        state.data = action.payload;
        state.saving = false;
        state.saveRequestId = null;
        state.saveSuccess = action.meta.arg.shipmentTrackingNotificationId > 0 ? "Notification updated." : "Notification created.";
      })
      .addCase(saveShipmentTrackingNotification.rejected, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId || state.loadedBolNo !== action.meta.arg.bolNo.trim()) return;
        state.saving = false;
        state.saveRequestId = null;
        state.saveError = action.payload || action.error.message || "Unable to save notification preferences.";
      });
  },
});

export default shipmentTrackingNotificationSlice.reducer;

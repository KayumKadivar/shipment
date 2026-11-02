import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

/** Persisted reminder recipients, calendar dates, local reminder time, and timezone. */
export type ShipmentTrackingReminderData = {
  shipmentTrackingReminderId: number;
  bolNo: string;
  email: string;
  fromDate: string;
  toDate: string;
  utcTime: string;
  timeZone: string | null;
};

/** Complete snapshot accepted by the reminder create and update endpoints. */
export type SaveShipmentTrackingReminderArgs = ShipmentTrackingReminderData;

/** Reminder lookup envelope; null data means no saved reminder. */
type ShipmentTrackingReminderApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: ShipmentTrackingReminderData | null;
};

/** Tracks the current BOL lookup and prevents stale requests from replacing it. */
type ShipmentTrackingReminderState = {
  data: ShipmentTrackingReminderData | null;
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

const initialState: ShipmentTrackingReminderState = {
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
export const fetchShipmentTrackingReminder = createAsyncThunk<
  ShipmentTrackingReminderData | null,
  string,
  { rejectValue: string }
>(
  "shipmentTrackingReminder/fetchShipmentTrackingReminder",
  async (bolNo, { rejectWithValue, signal }) => {
    try {
      const response = await axios.get<ShipmentTrackingReminderApiResponse>(
        `${API_BASE_URL}/ShipmentTrackingReminder/GetByBolNo`,
        {
          params: { bolNo: bolNo.trim() },
          headers: { Accept: "text/plain" },
          signal,
        },
      );
      if (!response.data.isSuccess) {
        return rejectWithValue(response.data.message || "Unable to load tracking reminder.");
      }
      return response.data.data;
    } catch (error: unknown) {
      const message = axios.isAxiosError<ShipmentTrackingReminderApiResponse>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : null;
      return rejectWithValue(message || "Unable to load tracking reminder.");
    }
  },
);

/** Persists a loaded shipment's preferences once and returns its server-assigned identity. */
export const saveShipmentTrackingReminder = createAsyncThunk<
  ShipmentTrackingReminderData,
  SaveShipmentTrackingReminderArgs,
  { state: { shipmentTrackingReminder: ShipmentTrackingReminderState }; rejectValue: string }
>(
  "shipmentTrackingReminder/saveShipmentTrackingReminder",
  async (args, { rejectWithValue }) => {
    try {
      const payload = { ...args, bolNo: args.bolNo.trim(), email: args.email.split(",").map((email) => email.trim()).join(",") };
      const config = { headers: { Accept: "text/plain" } };
      const response = args.shipmentTrackingReminderId > 0
        ? await axios.put<ShipmentTrackingReminderApiResponse>(
            `${API_BASE_URL}/ShipmentTrackingReminder`, payload, config,
          )
        : await axios.post<ShipmentTrackingReminderApiResponse>(
            `${API_BASE_URL}/ShipmentTrackingReminder`, payload, config,
          );
      if (!response.data.isSuccess || !response.data.data || response.data.data.shipmentTrackingReminderId <= 0) {
        return rejectWithValue(response.data.message || "Unable to save tracking reminder.");
      }
      return response.data.data;
    } catch (error: unknown) {
      const message = axios.isAxiosError<ShipmentTrackingReminderApiResponse>(error)
        ? error.response?.data?.message || error.message
        : error instanceof Error ? error.message : null;
      return rejectWithValue(message || "Unable to save tracking reminder.");
    }
  },
  {
    condition: (args, { getState }) => {
      const state = getState().shipmentTrackingReminder;
      return !state.saving && !state.loading && !state.error &&
        state.loadedBolNo === args.bolNo.trim() &&
        args.shipmentTrackingReminderId === (state.data?.shipmentTrackingReminderId ?? 0);
    },
  },
);

const shipmentTrackingReminderSlice = createSlice({
  name: "shipmentTrackingReminder",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShipmentTrackingReminder.pending, (state, action) => {
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
      .addCase(fetchShipmentTrackingReminder.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.data = action.payload;
        state.loading = false;
        state.loadedBolNo = action.meta.arg.trim();
        state.currentRequestId = null;
      })
      .addCase(fetchShipmentTrackingReminder.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;
        state.loading = false;
        state.currentRequestId = null;
        if (action.meta.aborted) return;
        state.error = action.payload || action.error.message || "Unable to load tracking reminder.";
      })
      .addCase(saveShipmentTrackingReminder.pending, (state, action) => {
        state.saving = true;
        state.saveRequestId = action.meta.requestId;
        state.saveBolNo = action.meta.arg.bolNo.trim();
        state.saveError = null;
        state.saveSuccess = null;
      })
      .addCase(saveShipmentTrackingReminder.fulfilled, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId || state.loadedBolNo !== action.meta.arg.bolNo.trim()) return;
        state.data = action.payload;
        state.saving = false;
        state.saveRequestId = null;
        state.saveSuccess = action.meta.arg.shipmentTrackingReminderId > 0 ? "Reminder updated." : "Reminder created.";
      })
      .addCase(saveShipmentTrackingReminder.rejected, (state, action) => {
        if (state.saveRequestId !== action.meta.requestId || state.loadedBolNo !== action.meta.arg.bolNo.trim()) return;
        state.saving = false;
        state.saveRequestId = null;
        state.saveError = action.payload || action.error.message || "Unable to save tracking reminder.";
      });
  },
});

export default shipmentTrackingReminderSlice.reducer;

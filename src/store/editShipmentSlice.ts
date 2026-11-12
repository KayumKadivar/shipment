import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import type { RootState } from "../app/store";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import type { EditShipmentApiResponse, EditShipmentRequest, EditShipmentResponseData } from "../types/editShipment.types";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";

/** Save state scoped to one shipment and its latest submission. */
export type EditShipmentState = {
  saving: boolean;
  data: EditShipmentResponseData | null;
  error: string | null;
  successMessage: string | null;
  loadNumber: string | null;
  currentRequestId: string | null;
};

const initialState: EditShipmentState = {
  saving: false, data: null, error: null, successMessage: null,
  loadNumber: null, currentRequestId: null,
};

/** Submits one accepted shipment snapshot; failed writes are never retried automatically. */
export const editShipment = createAsyncThunk<
  EditShipmentApiResponse, EditShipmentRequest, { state: RootState; rejectValue: string }
>("editShipment/save", async (payload, { getState, rejectWithValue }) => {
  const token = getState().app.token;
  if (!token) return rejectWithValue("Please sign in before saving the shipment.");
  try {
    const response = await axios.post<EditShipmentApiResponse>(
      `${API_BASE_URL}/EditShipment/EditShipment`, { ...payload, srvToken: SRV_TOKEN },
      { headers: { Accept: "text/plain", "Content-Type": "application/json", Authorization: `Bearer ${token}` } },
    );
    if (!response.data.isSuccess || !response.data.data) {
      return rejectWithValue(response.data.message || "Unable to save shipment.");
    }
    return response.data;
  } catch (error: unknown) {
    return rejectWithValue(getApiErrorMessage(error, "Unable to save shipment."));
  }
}, {
  condition: (_, { getState }) => !getState().editShipment.saving,
});

const editShipmentSlice = createSlice({
  name: "editShipment", initialState,
  reducers: {
    /** Invalidates results belonging to a previously displayed shipment. */
    resetEditShipment: () => ({ ...initialState }),
  },
  extraReducers: (builder) => {
    builder.addCase(editShipment.pending, (state, action) => {
      state.saving = true;
      state.error = null;
      state.successMessage = null;
      state.data = null;
      state.loadNumber = action.meta.arg.loadNumber;
      state.currentRequestId = action.meta.requestId;
    }).addCase(editShipment.fulfilled, (state, action) => {
      if (state.currentRequestId !== action.meta.requestId) return;
      state.saving = false;
      state.currentRequestId = null;
      state.data = action.payload.data;
      state.successMessage = action.payload.message?.trim() || "Shipment saved.";
    }).addCase(editShipment.rejected, (state, action) => {
      if (state.currentRequestId !== action.meta.requestId) return;
      state.saving = false;
      state.currentRequestId = null;
      state.error = action.payload || action.error.message || "Unable to save shipment.";
    });
  },
});

export const { resetEditShipment } = editShipmentSlice.actions;
export default editShipmentSlice.reducer;

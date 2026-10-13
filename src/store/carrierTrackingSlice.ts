import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import {
  API_BASE_URL,
  DEFAULT_CLIENT_CODE,
  SRV_TOKEN,
} from "../config/apiConfig";

export type CarrierTrackingRecord = {
  statusDate: string;
  statusDescription: string;
  statusCode: string | null;
  city: string | null;
  state: string | null;
};

export type CarrierTrackingData = {
  statusDate: string;
  statusDescription: string;
  trackRecords: CarrierTrackingRecord[];
  proNumber: string | null;
  statusCode: number;
  message: string | null;
  shipmentStatus: string | null;
  equipmentNo: string | null;
  shipmentStatusCode: string | null;
  pickupNumber: string | null;
  brokerReferenceNo: string | null;
  pickupFailureMessage: string | null;
};

type CarrierTrackingApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: CarrierTrackingData | null;
};

export type FetchCarrierTrackingArgs = {
  loadNumber: string;
  clientCode?: string | null;
};

type CarrierTrackingState = {
  data: CarrierTrackingData | null;
  loading: boolean;
  error: string | null;
  requestedLoadNumber: string | null;
  loadedLoadNumber: string | null;
  currentRequestId: string | null;
};

const initialState: CarrierTrackingState = {
  data: null,
  loading: false,
  error: null,
  requestedLoadNumber: null,
  loadedLoadNumber: null,
  currentRequestId: null,
};

export const fetchCarrierTracking = createAsyncThunk<
  CarrierTrackingData,
  FetchCarrierTrackingArgs,
  { rejectValue: string }
>(
  "carrierTracking/fetchCarrierTracking",
  async ({ loadNumber, clientCode }, { rejectWithValue }) => {
    const resolvedClientCode = clientCode?.trim() || DEFAULT_CLIENT_CODE;

    try {
      const response = await axios.get<CarrierTrackingApiResponse>(
        `${API_BASE_URL}/CarrierTrackingLite`,
        {
          params: {
            loadNumber,
            srvToken: SRV_TOKEN,
            clientCode: resolvedClientCode,
          },
          headers: {
            Accept: "text/plain",
          },
        },
      );

      if (!response.data.isSuccess || !response.data.data) {
        return rejectWithValue(
          response.data.message ||
            `Tracking details for shipment ${loadNumber} were not found.`,
        );
      }

      return response.data.data;
    } catch (error: unknown) {
      if (axios.isAxiosError<CarrierTrackingApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            `Unable to load tracking details for shipment ${loadNumber}.`,
        );
      }

      return rejectWithValue(
        error instanceof Error
          ? error.message
          : `Unable to load tracking details for shipment ${loadNumber}.`,
      );
    }
  },
);

const carrierTrackingSlice = createSlice({
  name: "carrierTracking",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCarrierTracking.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestedLoadNumber = action.meta.arg.loadNumber;
        state.currentRequestId = action.meta.requestId;

        if (state.loadedLoadNumber !== action.meta.arg.loadNumber) {
          state.data = null;
        }
      })
      .addCase(fetchCarrierTracking.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.error = null;
        state.loadedLoadNumber = action.meta.arg.loadNumber;
        state.currentRequestId = null;
      })
      .addCase(fetchCarrierTracking.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.loading = false;
        state.currentRequestId = null;
        if (action.meta.aborted) return;

        state.error =
          action.payload ||
          action.error.message ||
          "Unable to load carrier tracking details.";
      });
  },
});

export default carrierTrackingSlice.reducer;

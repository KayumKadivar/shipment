import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export interface PaymentTermApiResponse {
  isSuccess: boolean;
  message?: string | null;
  data?: string[] | null;
}

export interface PaymentTermState {
  data: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  currentRequestId: string | null;
}

const initialState: PaymentTermState = {
  data: [],
  loading: false,
  loaded: false,
  error: null,
  currentRequestId: null,
};

export const fetchPaymentTerm = createAsyncThunk<
  string[],
  void,
  {
    rejectValue: string;
  }
>(
  "paymentTerm/fetchPaymentTerm",
  async (_, { rejectWithValue }) => {
    try {
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("authToken")
          : null;
      const headers: Record<string, string> = {
        Accept: "application/json, text/plain, */*",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await axios.get<PaymentTermApiResponse>(
        `${API_BASE_URL}/PaymentTerm`,
        { headers }
      );

      if (!response.data || !response.data.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to fetch payment terms"
        );
      }

      const raw = response.data.data ?? [];
      const list = raw
        .map((item: unknown) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return String(
              obj.name ?? obj.paymentTerm ?? obj.description ?? obj.code ?? ""
            ).trim();
          }
          return String(item ?? "").trim();
        })
        .filter(Boolean);

      return Array.from(new Set(list));
    } catch (error: unknown) {
      if (axios.isAxiosError<PaymentTermApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch payment terms"
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch payment terms"
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = (getState() as { paymentTerm?: PaymentTermState })
        ?.paymentTerm;
      return !state || (!state.loading && !state.loaded);
    },
  }
);

const paymentTermSlice = createSlice({
  name: "paymentTerm",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPaymentTerm.pending, (state, action) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchPaymentTerm.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(fetchPaymentTerm.rejected, (state, action) => {
        if (
          action.meta.condition ||
          state.currentRequestId !== action.meta.requestId
        ) {
          return;
        }

        state.loading = false;
        state.loaded = false;
        state.error = action.meta.aborted
          ? null
          : action.payload ||
            action.error.message ||
            "Failed to fetch payment terms";
        state.currentRequestId = null;
      });
  },
});

export default paymentTermSlice.reducer;

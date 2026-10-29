import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import {
  API_BASE_URL,
  DEFAULT_CLIENT_CODE,
  SRV_TOKEN,
} from "../config/apiConfig";

export type ChargeAccessorial = {
  clientID: number;
  accessorialID: number;
  accesorialCode: string;
  description: string;
  status: boolean;
  accesorialGroupID: number;
  isSystem: boolean;
  isSelect: boolean;
};

type ChargeAccessorialApiItem = Omit<
  ChargeAccessorial,
  "accesorialCode" | "description"
> & {
  accesorialCode?: string | null;
  description?: string | null;
};

type ChargeAccessorialApiResponse = {
  isSuccess: boolean;
  message?: string | null;
  data?: ChargeAccessorialApiItem[] | null;
};

type ChargeAccessorialsState = {
  data: ChargeAccessorial[];
  loading: boolean;
  error: string | null;
  requestedClientCode: string | null;
  currentRequestId: string | null;
};

const initialState: ChargeAccessorialsState = {
  data: [],
  loading: false,
  error: null,
  requestedClientCode: null,
  currentRequestId: null,
};

function resolveClientCode(clientCode: string | null | undefined) {
  return (
    clientCode?.trim() ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("clientCode") : null) ||
    DEFAULT_CLIENT_CODE
  );
}

export const fetchChargeAccessorials = createAsyncThunk<
  { clientCode: string; data: ChargeAccessorial[] },
  string | null | undefined,
  { rejectValue: string }
>(
  "chargeAccessorials/fetchChargeAccessorials",
  async (clientCode, { rejectWithValue }) => {
    const resolvedClientCode = resolveClientCode(clientCode);

    try {
      const response = await axios.get<ChargeAccessorialApiResponse>(
        `${API_BASE_URL}/GetAccessorials`,
        {
          params: {
            srvToken: SRV_TOKEN,
            clientCode: resolvedClientCode,
          },
          headers: { Accept: "text/plain" },
        },
      );

      if (!response.data.isSuccess) {
        return rejectWithValue(
          response.data.message || "Failed to fetch charge accessorials",
        );
      }

      return {
        clientCode: resolvedClientCode,
        data: (response.data.data ?? []).map((item) => ({
          ...item,
          description: item.description?.trim() ?? "",
          accesorialCode: item.accesorialCode?.trim() ?? "",
        })),
      };
    } catch (error: unknown) {
      if (axios.isAxiosError<ChargeAccessorialApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch charge accessorials",
        );
      }

      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to fetch charge accessorials",
      );
    }
  },
);

const chargeAccessorialsSlice = createSlice({
  name: "chargeAccessorials",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchChargeAccessorials.pending, (state, action) => {
        state.data = [];
        state.loading = true;
        state.error = null;
        state.requestedClientCode = resolveClientCode(action.meta.arg);
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchChargeAccessorials.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload.data;
        state.loading = false;
        state.error = null;
        state.requestedClientCode = action.payload.clientCode;
        state.currentRequestId = null;
      })
      .addCase(fetchChargeAccessorials.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = [];
        state.loading = false;
        state.error = action.meta.aborted
          ? null
          : action.payload ||
            action.error.message ||
            "Failed to fetch charge accessorials";
        state.currentRequestId = null;
      });
  },
});

export default chargeAccessorialsSlice.reducer;

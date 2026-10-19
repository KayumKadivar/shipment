import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export interface ServiceLevelItem {
  serviceLevelId: number;
  serviceLevelCode?: string | null;
  description?: string | null;
}

export interface ServiceLevelApiResponse {
  isSuccess: boolean;
  message?: string | null;
  data?: ServiceLevelItem[] | null;
}

export interface ServiceLevelState {
  data: ServiceLevelItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  currentRequestId: string | null;
}

const initialState: ServiceLevelState = {
  data: [],
  loading: false,
  loaded: false,
  error: null,
  currentRequestId: null,
};

export const fetchServiceLevel = createAsyncThunk<
  ServiceLevelItem[],
  void,
  {
    rejectValue: string;
  }
>(
  "serviceLevel/fetchServiceLevel",
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

      const response = await axios.get<ServiceLevelApiResponse>(
        `${API_BASE_URL}/ServiceLevel`,
        { headers }
      );

      if (!response.data || !response.data.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to fetch service levels"
        );
      }

      const raw = response.data.data ?? [];
      const list: ServiceLevelItem[] = raw.map((item) => ({
        serviceLevelId: item.serviceLevelId,
        serviceLevelCode: item.serviceLevelCode ? item.serviceLevelCode.trim() : null,
        description: item.description ? item.description.trim() : null,
      }));

      return list;
    } catch (error: unknown) {
      if (axios.isAxiosError<ServiceLevelApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch service levels"
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch service levels"
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = (getState() as { serviceLevel?: ServiceLevelState })
        ?.serviceLevel;
      return !state || (!state.loading && !state.loaded);
    },
  }
);

const serviceLevelSlice = createSlice({
  name: "serviceLevel",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchServiceLevel.pending, (state, action) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchServiceLevel.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(fetchServiceLevel.rejected, (state, action) => {
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
            "Failed to fetch service levels";
        state.currentRequestId = null;
      });
  },
});

export default serviceLevelSlice.reducer;

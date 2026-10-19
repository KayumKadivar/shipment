import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export interface EquipmentApiResponse {
  isSuccess: boolean;
  message?: string | null;
  data?: string[] | null;
}

export interface EquipmentState {
  data: string[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  currentRequestId: string | null;
}

const initialState: EquipmentState = {
  data: [],
  loading: false,
  loaded: false,
  error: null,
  currentRequestId: null,
};

export const fetchEquipment = createAsyncThunk<
  string[],
  void,
  {
    rejectValue: string;
  }
>(
  "equipment/fetchEquipment",
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

      const response = await axios.get<EquipmentApiResponse>(
        `${API_BASE_URL}/Equipment`,
        { headers }
      );

      if (!response.data || !response.data.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to fetch equipment"
        );
      }

      const raw = response.data.data ?? [];
      const list = raw
        .map((item: unknown) => {
          if (typeof item === "string") return item.trim();
          if (item && typeof item === "object") {
            const obj = item as Record<string, unknown>;
            return String(
              obj.name ?? obj.equipmentName ?? obj.equipment ?? obj.code ?? ""
            ).trim();
          }
          return String(item ?? "").trim();
        })
        .filter(Boolean);

      // Return deduplicated equipment list
      return Array.from(new Set(list));
    } catch (error: unknown) {
      if (axios.isAxiosError<EquipmentApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch equipment"
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch equipment"
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = (getState() as { equipment?: EquipmentState })?.equipment;
      return !state || (!state.loading && !state.loaded);
    },
  }
);

const equipmentSlice = createSlice({
  name: "equipment",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEquipment.pending, (state, action) => {
        state.loading = true;
        state.loaded = false;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchEquipment.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(fetchEquipment.rejected, (state, action) => {
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
            "Failed to fetch equipment";
        state.currentRequestId = null;
      });
  },
});

export default equipmentSlice.reducer;

import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { LocationAccessorial } from "../types/customerLocation.types";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN, DEFAULT_CLIENT_CODE } from "../config/apiConfig";

interface AccessorialApiItem
  extends Omit<LocationAccessorial, "accessorialName" | "description" | "accesorialCode"> {
  description?: string | null;
  accesorialCode?: string | null;
}

interface AccessorialApiResponse {
  isSuccess: boolean;
  message?: string | null;
  data?: AccessorialApiItem[] | null;
}

interface AccessorialsState {
  data: LocationAccessorial[];
  selectedAccessorialIds: number[];
  loading: boolean;
  error: string | null;
}

const initialState: AccessorialsState = {
  data: [],
  selectedAccessorialIds: [],
  loading: false,
  error: null,
};

export const fetchAccessorials = createAsyncThunk<
  LocationAccessorial[],
  string | void,
  {
    state: { accessorials: AccessorialsState };
    rejectValue: string;
  }
>(
  "accessorials/fetchAccessorials",
  async (clientCode: string | void, { rejectWithValue }) => {
    try {
      const code = clientCode || DEFAULT_CLIENT_CODE;
      const token = localStorage.getItem("authToken");

      const response = await axios.get<AccessorialApiResponse>(
        `${API_BASE_URL}/GetAccessorials?srvToken=${SRV_TOKEN}&clientCode=${code}`,
        {
          headers: {
            accept: "*/*",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.data.isSuccess) {
        const rawList = response.data.data || [];
        const mappedList: LocationAccessorial[] = rawList.map((item) => ({
          ...item,
          accessorialID: item.accessorialID,
          accessorialName: (item.description || item.accesorialCode || "").trim(),
          description: item.description ?? undefined,
          accesorialCode: item.accesorialCode ?? undefined,
        }));
        return mappedList;
      }
      return rejectWithValue(response.data?.message || "Failed to fetch accessorials");
    } catch (error: unknown) {
      if (axios.isAxiosError<AccessorialApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch accessorials",
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch accessorials",
      );
    }
  },
  {
    condition: (_, { getState }) => !getState().accessorials.loading,
  },
);

const accessorialsSlice = createSlice({
  name: "accessorials",
  initialState,
  reducers: {
    toggleAccessorial: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      if (state.selectedAccessorialIds.includes(id)) {
        state.selectedAccessorialIds = state.selectedAccessorialIds.filter(
          (item) => item !== id
        );
      } else {
        state.selectedAccessorialIds.push(id);
      }
    },
    setSelectedAccessorials: (state, action: PayloadAction<number[]>) => {
      state.selectedAccessorialIds = action.payload;
    },
    clearSelectedAccessorials: (state) => {
      state.selectedAccessorialIds = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccessorials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccessorials.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        // Keep pre-selected items if isSelect is true on any item and none were manually selected yet
        if (state.selectedAccessorialIds.length === 0) {
          const preselected = action.payload
            .filter((item) => item.isSelect === true)
            .map((item) => item.accessorialID);
          if (preselected.length > 0) {
            state.selectedAccessorialIds = preselected;
          }
        }
      })
      .addCase(fetchAccessorials.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || action.error.message || "Failed to fetch accessorials";
      });
  },
});

export const { toggleAccessorial, setSelectedAccessorials, clearSelectedAccessorials } = accessorialsSlice.actions;
export default accessorialsSlice.reducer;

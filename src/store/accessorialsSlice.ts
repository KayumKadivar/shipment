import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { LocationAccessorial } from "../types/customerLocation.types";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN, DEFAULT_CLIENT_CODE } from "../config/apiConfig";

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

export const fetchAccessorials = createAsyncThunk(
  "accessorials/fetchAccessorials",
  async (clientCode: string | void, { rejectWithValue }) => {
    try {
      const code = clientCode || DEFAULT_CLIENT_CODE;
      const token = localStorage.getItem("authToken");

      const response = await axios.get(
        `${API_BASE_URL}/GetAccessorials?srvToken=${SRV_TOKEN}&clientCode=${code}`,
        {
          headers: {
            accept: "*/*",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      console.log("GetAccessorials Response:", response.data);

      if (response.data && response.data.isSuccess) {
        const rawList = response.data.data || [];
        const mappedList: LocationAccessorial[] = rawList.map((item: any) => ({
          ...item,
          accessorialID: item.accessorialID,
          accessorialName: (item.description || item.accesorialCode || "").trim(),
        }));
        return mappedList;
      }
      return rejectWithValue(response.data?.message || "Failed to fetch accessorials");
    } catch (error: any) {
      console.error("GetAccessorials API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message || error.message || "Failed to fetch accessorials"
      );
    }
  }
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
        state.error = action.error.message || "Failed to fetch accessorials";
      });
  },
});

export const { toggleAccessorial, setSelectedAccessorials, clearSelectedAccessorials } = accessorialsSlice.actions;
export default accessorialsSlice.reducer;

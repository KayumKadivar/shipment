import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { LocationAccessorial } from "../types/customerLocation.types";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN, DEFAULT_CLIENT_CODE } from "../config/apiConfig";

interface AccessorialsState {
  data: LocationAccessorial[];
  loading: boolean;
  error: string | null;
}

const initialState: AccessorialsState = {
  data: [],
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
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccessorials.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAccessorials.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchAccessorials.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch accessorials";
      });
  },
});

export default accessorialsSlice.reducer;

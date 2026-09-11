import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { LocationAccessorial } from "../types/customerLocation.types";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

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
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/Accessorials/GetAccessorials?ClientID=ads`);
      if (response.data && response.data.isSuccess) {
        return response.data.data as LocationAccessorial[];
      }
      return rejectWithValue(response.data?.message || "Failed to fetch accessorials");
    } catch (error: any) {
      return rejectWithValue(error?.response?.data?.message || error.message || "Failed to fetch accessorials");
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

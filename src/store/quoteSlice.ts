import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export interface QuoteResult {
  quoteRequestId: number;
  pickupDate: string;
  requestedDate: string;
  originCity: string;
  originStateCode: string;
  originZip: string;
  destinationCity: string;
  destinationStateCode: string;
  destinationZip: string;
  clientName: string;
  clientCode: string;
  profileCode: string;
  isAgentQuote: boolean;
  marginType: string;
  marginPercent: number;
  quoteProducts: any[];
  quoteAccessorials: any[];
  quoteResults: any[];
}

interface QuoteState {
  quotes: QuoteResult[];
  currentQuote: QuoteResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: QuoteState = {
  quotes: [],
  currentQuote: null,
  loading: false,
  error: null,
};

export const fetchQuotes = createAsyncThunk(
  "quote/fetchQuotes",
  async ({ clientCode, pageNumber = 1, pageSize = 100 }: { clientCode: string; pageNumber?: number; pageSize?: number }, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/Quote/GetQuotesByClientCode/${clientCode}?pageNumber=${pageNumber}&pageSize=${pageSize}`
      );
      if (response.data && response.data.isSuccess) {
        return response.data.data || [];
      }
      return rejectWithValue(response.data?.message || "Failed to fetch quotes");
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch quotes");
    }
  }
);

export const fetchQuoteById = createAsyncThunk(
  "quote/fetchQuoteById",
  async (quoteId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/Quote/${quoteId}`);
      if (response.data && response.data.isSuccess) {
        return response.data.data;
      }
      return rejectWithValue(response.data?.message || "Failed to fetch quote by id");
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch quote by id");
    }
  }
);

const quoteSlice = createSlice({
  name: "quote",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchQuotes.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchQuotes.fulfilled, (state, action) => {
        state.loading = false;
        state.quotes = action.payload;
      })
      .addCase(fetchQuotes.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchQuoteById.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.currentQuote = null;
      })
      .addCase(fetchQuoteById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentQuote = action.payload;
      })
      .addCase(fetchQuoteById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default quoteSlice.reducer;

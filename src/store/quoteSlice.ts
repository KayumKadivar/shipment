import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";

type ApiResponse<T> = {
  isSuccess: boolean;
  message?: string | null;
  data?: T | null;
};

type FetchQuotesArgs = {
  clientCode: string;
  pageNumber?: number;
  pageSize?: number;
};

export interface QuoteProductResult {
  quoteProductId?: number;
  quoteRequestId?: number;
  productClass?: string | number;
  productNMFC?: string;
  weight?: string | number;
  pallets?: string | number;
  isHazmat?: boolean;
  hazmatClass?: string;
  hazmatUN?: string;
  packagingGroup?: string;
  pieces?: string | number;
  length?: string | number;
  height?: string | number;
  width?: string | number;
  description?: string;
  isStackable?: boolean;
  units?: string | number;
  packageType?: string;
  class?: string | number;
  nmfc?: string;
  stackable?: boolean;
  hazMat?: boolean;
}

export interface QuoteAccessorialResult {
  quoteAccessorialId?: number;
  quoteRequestId?: number;
  accCode?: string;
  accName?: string;
  accesorialCode?: string;
  accessorialName?: string;
  description?: string;
}

export interface QuoteCostDetailResult {
  quoteCostDetailsId?: number;
  quoteResultId?: number;
  accCode?: string;
  accName?: string;
  amount?: number;
}

export interface QuoteCarrierResult {
  quoteResultId?: number;
  quoteRequestId?: number;
  scac?: string;
  carrierName?: string;
  serviceLevel?: string;
  carrierQuoteNo?: string;
  brokerCode?: string;
  brokerName?: string;
  transitDays?: string;
  serviceType?: string;
  saasQuoteId?: string;
  originTerminalCode?: string;
  originTerminalName?: string;
  originTerminalZip?: string;
  originTerminalPhone?: string;
  destinationTerminalCode?: string;
  destinationTerminalName?: string;
  destinationTerminalZip?: string;
  destinationTerminalPhone?: string;
  quoteCostDetails?: QuoteCostDetailResult[] | null;
  grossCharge?: number;
  discount?: number;
  fuelSurcharge?: number;
  totalShipmentCost?: number;
  netCharge?: number;
  price?: number;
  estimatedDeliveryDate?: string;
  errorMessage?: string;
  warning?: string;
}

export interface SearchQuotePayload {
  referenceNumber?: string;
  clientName?: string;
  originZip?: string;
  destinationZip?: string;
  fromDate?: string | null;
  toDate?: string | null;
  createdBy?: string;
  pageNumber?: number;
  pageSize?: number;
}

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
  originCountry?: string;
  destinationCountry?: string;
  clientName: string;
  clientCode: string;
  profileCode: string;
  isAgentQuote: boolean;
  marginType: string;
  marginPercent: number;
  quoteProducts: QuoteProductResult[];
  quoteAccessorials: QuoteAccessorialResult[];
  quoteResults: QuoteCarrierResult[];
  createdBy?: string;
  createdDate?: string;
}

interface QuoteState {
  quotes: QuoteResult[];
  totalCount: number;
  currentQuote: QuoteResult | null;
  loading: boolean;
  error: string | null;
}

const initialState: QuoteState = {
  quotes: [],
  totalCount: 0,
  currentQuote: null,
  loading: false,
  error: null,
};

export const fetchQuotes = createAsyncThunk<
  { quotes: QuoteResult[]; totalCount: number },
  FetchQuotesArgs,
  { rejectValue: string }
>(
  "quote/fetchQuotes",
  async ({ clientCode, pageNumber = 1, pageSize = 10 }: { clientCode: string; pageNumber?: number; pageSize?: number }, { rejectWithValue }) => {
    try {
      const response = await axios.get<ApiResponse<QuoteResult[]>>(
        `${API_BASE_URL}/Quote/GetQuotesByClientCode/${clientCode}?pageNumber=${pageNumber}&pageSize=${pageSize}`
      );
      if (response.data && response.data.isSuccess) {
        const quotes = response.data.data || [];
        const totalCount =
          (response.data as any)?.totalCount ??
          (response.data as any)?.totalRecords ??
          (response.data as any)?.TotalCount ??
          quotes.length;
        return { quotes, totalCount };
      }
      return rejectWithValue(response.data?.message || "Failed to fetch quotes");
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, "Failed to fetch quotes"));
    }
  }
);

export const searchQuote = createAsyncThunk<
  { quotes: QuoteResult[]; totalCount: number },
  SearchQuotePayload,
  { rejectValue: string }
>(
  "quote/searchQuote",
  async (payload: SearchQuotePayload = {}, { rejectWithValue }) => {
    try {
      const response = await axios.post<ApiResponse<QuoteResult[]>>(
        `${API_BASE_URL}/Quote/SearchQuote`,
        {
          referenceNumber: payload.referenceNumber || "",
          clientName: payload.clientName || "",
          originZip: payload.originZip || "",
          destinationZip: payload.destinationZip || "",
          fromDate: payload.fromDate ?? null,
          toDate: payload.toDate ?? null,
          createdBy: payload.createdBy || "",
          pageNumber: payload.pageNumber ?? 1,
          pageSize: payload.pageSize ?? 10,
        }
      );
      if (response.data && (response.data.isSuccess || Array.isArray(response.data.data))) {
        const quotes = response.data.data || [];
        const totalCount =
          (response.data as any)?.totalCount ??
          (response.data as any)?.totalRecords ??
          (response.data as any)?.TotalCount ??
          quotes.length;
        return { quotes, totalCount };
      }
      if (Array.isArray(response.data)) {
        return { quotes: response.data, totalCount: response.data.length };
      }
      return rejectWithValue(response.data?.message || "Failed to search quotes");
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, "Failed to search quotes"));
    }
  }
);

export const fetchQuoteById = createAsyncThunk<
  QuoteResult,
  string,
  { rejectValue: string }
>(
  "quote/fetchQuoteById",
  async (quoteId: string, { rejectWithValue }) => {
    try {
      const response = await axios.get<ApiResponse<QuoteResult>>(
        `${API_BASE_URL}/Quote/${quoteId}`,
      );
      if (response.data && response.data.isSuccess && response.data.data) {
        return response.data.data;
      }
      return rejectWithValue(response.data?.message || "Failed to fetch quote by id");
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch quote by id"),
      );
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
        state.quotes = action.payload.quotes;
        state.totalCount = action.payload.totalCount;
      })
      .addCase(fetchQuotes.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || action.error.message || "Failed to fetch quotes";
      })
      .addCase(searchQuote.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(searchQuote.fulfilled, (state, action) => {
        state.loading = false;
        state.quotes = action.payload.quotes;
        state.totalCount = action.payload.totalCount;
      })
      .addCase(searchQuote.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || action.error.message || "Failed to search quotes";
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
        state.error =
          action.payload ||
          action.error.message ||
          "Failed to fetch quote by id";
      });
  },
});

export default quoteSlice.reducer;

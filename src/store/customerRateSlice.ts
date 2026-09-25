import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

// Interface for rate item
export interface RateItem {
  id: string;
  name: string;
  code: string;
  service: string;
  price: number;
  transitDays: number;
  estimatedDelivery: string;
  warning?: string;
  quoteExpiry?: string;
  liabilityNew?: string;
  liabilityUsed?: string;
  logo?: string;
  logoKind?: "image" | "fedex";
}

// Interface for API response rate
export interface ApiRate {
  scac?: string;
  carrierName?: string;
  serviceLevelDescription?: string;
  serviceLevelCode?: string;
  rateType?: string;
  totalShipmentCost?: number;
  netCharge?: number;
  grossCharge?: number;
  transitDays?: number;
  deliveryDate?: string;
  errorMessage?: string;
  quoteExpirationDate?: string;
  [key: string]: unknown;
}

// Interface for customer rate state
interface CustomerRateState {
  rates: RateItem[];
  loading: boolean;
  error: string | null;
}

// Initial state for customer rate
const initialState: CustomerRateState = {
  rates: [],
  loading: false,
  error: null,
};

// async thunk for fetching rates
export const fetchCarrierRates = createAsyncThunk(
  "customerRate/fetchCarrierRates",
  async (payload: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("authToken");
      const response = await axios.post(`${API_BASE_URL}/Rating/GetRates`, payload, {
        headers: {
          accept: "*/*",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    
      let apiRates: ApiRate[] = [];
      if (response.data && response.data.data) {
        if (response.data.data.leastCostCarriers) {
           apiRates = response.data.data.leastCostCarriers;
        } else if (Array.isArray(response.data.data)) {
           apiRates = response.data.data;
        }
      }
      console.log("Extracted apiRates:", apiRates);
      return apiRates;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || "Failed to fetch rates");
    }
  }
);

// slice for managing rate state
const customerRateSlice = createSlice({
  name: "customerRate",
  initialState,
  reducers: {
    clearRates: (state) => {
      state.rates = [];
    }
  },
  // extraReducers is used to handle extra reducers
  extraReducers: (builder) => {
    builder
      // fetchCarrierRates.pending: when request is started
      .addCase(fetchCarrierRates.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.rates = [];
      })
      // fetchCarrierRates.fulfilled: when request is successful
      .addCase(fetchCarrierRates.fulfilled, (state, action) => {
        state.loading = false;
        
        state.rates = action.payload.map((rate: ApiRate, index: number) => ({
          id: rate.scac || `rate-${index}`,
          name: rate.carrierName || rate.scac || "Unknown Carrier",
          code: rate.scac || "",
          service: rate.serviceLevelDescription || rate.serviceLevelCode || rate.rateType || "STANDARD RATE",
          price: (rate.totalShipmentCost as number) || (rate.netCharge as number) || (rate.grossCharge as number) || 0,
          transitDays: rate.transitDays || 0,
          estimatedDelivery: rate.deliveryDate || "",
          warning: rate.errorMessage?.trim() || "",
          quoteExpiry: rate.quoteExpirationDate || "",
          liabilityNew: "",
          liabilityUsed: "",
          logoKind: rate.scac?.toLowerCase() === "fxfe" ? "fedex" : undefined,
        }));
      })
      // fetchCarrierRates.rejected: when request is failed
      .addCase(fetchCarrierRates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch rates";
      });
  },
});

export const { clearRates } = customerRateSlice.actions;
// Export slice reducer
export default customerRateSlice.reducer;

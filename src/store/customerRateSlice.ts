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
  grossCharge?: number;
  discount?: number;
  fuelSurcharge?: number;
  accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number }[];
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
  discount?: number;
  fuelSurcharge?: number;
  transitDays?: number;
  deliveryDate?: string;
  errorMessage?: string;
  quoteExpirationDate?: string;
  accessorialCharges?: { accessorialDescription?: string; accessorialCharge?: number }[];
  [key: string]: unknown;
}

// Interface for customer rate state
interface CustomerRateState {
  rates: RateItem[];
  loading: boolean;
  error: string | null;
  quoteRequest: any | null;
}

// Initial state for customer rate
const initialState: CustomerRateState = {
  rates: [],
  loading: false,
  error: null,
  quoteRequest: null,
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

export const fetchCarrierLogo = createAsyncThunk(
  "customerRate/fetchCarrierLogo",
  async (scac: string, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/Carrier/GetCarrierLogoByCarrierId/${scac}`);
      if (response.data && response.data.isSuccess && response.data.data) {
        let data = response.data.data;
        if (typeof data === "string") {
          if (!data.startsWith("http") && !data.startsWith("data:")) {
            data = `data:image/png;base64,${data}`;
          }
          return { scac, logo: data };
        } else if (data.logo) {
          return { scac, logo: data.logo };
        }
      }
      return rejectWithValue("Logo not found");
    } catch (error) {
      return rejectWithValue("Failed to fetch logo");
    }
  }
);

export const saveCustomerQuote = createAsyncThunk(
  "customerRate/saveCustomerQuote",
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const { quoteRequest, rates } = state.customerRate;

      if (!quoteRequest) {
        return rejectWithValue("No quote request found to save.");
      }

      const payload = {
        quoteRequestId: 0,
        pickupDate: quoteRequest.shipmentDate || new Date().toISOString(),
        requestedDate: new Date().toISOString(),
        originCity: quoteRequest.origCity || "",
        originStateCode: quoteRequest.origState || "",
        originZip: quoteRequest.origZip || "",
        destinationCity: quoteRequest.destCity || "",
        destinationStateCode: quoteRequest.destState || "",
        destinationZip: quoteRequest.destZip || "",
        clientName: quoteRequest.clientName || "", 
        clientCode: quoteRequest.clientCode || "",
        profileCode: quoteRequest.profileCode || "",
        isAgentQuote: true,
        marginType: quoteRequest.shipments?.[0]?.weightUnit || "",
        marginPercent: 0,
        quoteProducts: (quoteRequest.shipments || []).map((s: any) => ({
          quoteProductId: 0,
          quoteRequestId: 0,
          productClass: s.class || "",
          productNMFC: s.nmfc || "",
          description: s.description || "",
          weight: s.weight || 0,
          pallets: s.pieces || 0,
          isHazmat: s.isHazmat || false,
          hazmatClass: "",
          hazmatUN: "",
          packagingGroup: ""
        })),
        quoteAccessorials: (quoteRequest.accessorialCodes || []).map((acc: string) => ({
          quoteAccessorialId: 0,
          quoteRequestId: 0,
          accCode: acc
        })),
        quoteResults: (rates || []).map((rate: any) => ({
          quoteResultId: 0,
          quoteRequestId: 0,
          scac: rate.code || "",
          carrierName: rate.name || "",
          serviceLevel: rate.service || "",
          carrierQuoteNo: "",
          brokerCode: "",
          brokerName: "",
          transitDays: String(rate.transitDays || ""),
          serviceType: rate.service || "",
          saasQuoteId: rate.id || "",
          originTerminalCode: "",
          originTerminalName: "",
          originTerminalZip: "",
          originTerminalPhone: "",
          destinationTerminalCode: "",
          destinationTerminalName: "",
          destinationTerminalZip: "",
          destinationTerminalPhone: "",
          quoteCostDetails: (rate.accessorialCharges || []).map((charge: any) => ({
            quoteCostDetailsId: 0,
            quoteResultId: 0,
            accCode: "",
            accName: charge.accessorialDescription || "",
            amount: charge.accessorialCharge || 0
          }))
        }))
      };

      const response = await axios.post(`${API_BASE_URL}/Quote`, payload);
      if (response.data && response.data.isSuccess) {
        return response.data;
      }
      return rejectWithValue(response.data?.message || "Failed to save quote");
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      return rejectWithValue(err.response?.data?.message || "Failed to save quote");
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
      .addCase(fetchCarrierRates.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.rates = [];
        state.quoteRequest = action.meta.arg;
      })
      // fetchCarrierRates.fulfilled: when request is successful
      .addCase(fetchCarrierRates.fulfilled, (state, action) => {
        state.loading = false;
        
        state.rates = action.payload.map((rate: ApiRate, index: number) => ({
          id: `${rate.scac}-${index}-${rate.saasQuoteNumber}`,
          name: rate.carrierName || "",
          code: rate.scac || "",
          service: rate.serviceLevelDescription || rate.rateType || "",
          price: rate.totalShipmentCost || 0,
          transitDays: rate.transitDays || 0,
          estimatedDelivery: rate.deliveryDate || "",
          warning: rate.errorMessage?.trim() || "",
          quoteExpiry: rate.quoteExpirationDate || "",
          liabilityNew: "",
          liabilityUsed: "",
          grossCharge: rate.grossCharge || 0,
          discount: rate.discount || 0,
          fuelSurcharge: rate.fuelSurcharge || 0,
          accessorialCharges: rate.accessorialCharges || [],
        }));
      })
      // fetchCarrierRates.rejected: when request is failed
      .addCase(fetchCarrierRates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Failed to fetch rates";
      })
      .addCase(fetchCarrierLogo.fulfilled, (state, action) => {
        const { scac, logo } = action.payload;
        state.rates = state.rates.map(rate => 
          rate.code === scac ? { ...rate, logo } : rate
        );
      });
  },
});

export const { clearRates } = customerRateSlice.actions;
// Export slice reducer
export default customerRateSlice.reducer;

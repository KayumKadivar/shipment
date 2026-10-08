import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

// Interface for rate item
export const COST_CODE_GROSS = "GROSS";
export const COST_CODE_DISC = "DISC";
export const COST_CODE_FUEL = "FUEL";

export const COST_NAME_GROSS = "Gross Charge";
export const COST_NAME_DISC = "Discount";
export const COST_NAME_FUEL = "Fuel Surcharge";

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

export interface QuoteFormData {
  origPostal: string;
  origCity: string;
  origState: string;
  origCountry: string;
  pickupDate: string | null;
  destPostal: string;
  destCity: string;
  destState: string;
  destCountry: string;
  packages: any[];
  selectedAccessorials: string[];
  selectedClientCode?: string;
}

// Interface for customer rate state
interface CustomerRateState {
  rates: RateItem[];
  loading: boolean;
  error: string | null;
  quoteRequest: any | null;
  quoteFormData: QuoteFormData | null;
}

// Initial state for customer rate
const initialState: CustomerRateState = {
  rates: [],
  loading: false,
  error: null,
  quoteRequest: null,
  quoteFormData: null,
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
          weight: Number(s.weight) || 0,
          pallets: Number(s.pallets) || Number(s.units) || 1,
          pieces: Number(s.pieces) || 1,
          length: Number(s.length) || 0,
          width: Number(s.width) || 0,
          height: Number(s.height) || 0,
          packagingGroup: s.packageType || s.packagingGroup || "",
          isHazmat: s.hazMat || s.isHazmat || false,
          hazmatClass: s.hazMatClass || s.hazmatClass || "",
          hazmatUN: s.hazMatUN || s.hazmatUN || "",
          isStackable: s.stackable ?? true,
        })),
        quoteAccessorials: (quoteRequest.accessorialCodes || []).map((acc: string) => ({
          quoteAccessorialId: 0,
          quoteRequestId: 0,
          accCode: acc
        })),
        quoteResults: (rates || []).map((rate: any) => {
          const existingAccessorials = (rate.accessorialCharges || []).filter((charge: any) => {
            const code = (charge.accessorialCode || charge.accCode || "").trim().toUpperCase();
            return (
              code !== COST_CODE_GROSS &&
              code !== COST_CODE_DISC &&
              code !== COST_CODE_FUEL
            );
          });

          const quoteCostDetails = [
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_GROSS,
              accName: COST_NAME_GROSS,
              amount: Number(rate.grossCharge) || 0,
            },
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_DISC,
              accName: COST_NAME_DISC,
              amount: Number(rate.discount) || 0,
            },
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_FUEL,
              accName: COST_NAME_FUEL,
              amount: Number(rate.fuelSurcharge) || 0,
            },
            ...existingAccessorials.map((charge: any) => ({
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: charge.accessorialCode || charge.accCode || "",
              accName: charge.accessorialDescription || charge.accName || "",
              amount: Number(charge.accessorialCharge ?? charge.amount) || 0,
            })),
          ];

          return {
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
            quoteCostDetails,
          };
        }),
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
    },
    setQuoteFormData: (state, action: PayloadAction<QuoteFormData>) => {
      state.quoteFormData = action.payload;
    },
    clearQuoteFormData: (state) => {
      state.quoteFormData = null;
    },
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
          warning: rate.errorMessage?.trim() || ((rate.totalShipmentCost ?? 0) <= 0 ? "Rate unavailable or capacity rules exceeded." : ""),
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

export const { clearRates, setQuoteFormData, clearQuoteFormData } = customerRateSlice.actions;
// Export slice reducer
export default customerRateSlice.reducer;

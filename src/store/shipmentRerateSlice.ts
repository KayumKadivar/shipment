import { createGetRatesRequest } from "../lib/createGetRatesRequest";
import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import type { ShipmentRerateRequest } from "../types/shipment.types";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";

/** An accessorial charge returned for a rerated shipment. */
export type ShipmentRerateAccessorialCharge = {
  accessorialCode: string;
  accessorialDescription: string;
  accessorialCharge: number;
};

/** A successful carrier rate that can be selected to refresh shipment charges. */
export type ShipmentRerateRate = {
  id: string;
  carrierName: string;
  scac: string | null;
  rateType: string;
  statusCode: number | null;
  errorMessage: string | null;
  totalShipmentCost: number;
  transitDays: number;
  deliveryDate: string | null;
  quoteExpirationDate: string | null;
  grossCharge: number;
  fuelSurcharge: number;
  discount: number;
  /** Sell-side gross freight charge returned by rating, when available. */
  sellGrossCharge?: number;
  /** Sell-side freight discount returned by rating, when available. */
  sellDiscount?: number;
  /** Sell-side fuel surcharge returned by rating, when available. */
  sellFuelSurcharge?: number;
  /** Sell-side shipment total returned by rating, when available. */
  sellTotalShipmentCost?: number;
  accessorialCharges: ShipmentRerateAccessorialCharge[];
};

type ShipmentRerateApiRate = {
  carrierName?: string | null;
  scac?: string | null;
  rateType?: string | null;
  statusCode?: number | null;
  errorMessage?: string | null;
  totalShipmentCost?: unknown;
  transitDays?: unknown;
  deliveryDate?: string | null;
  quoteExpirationDate?: string | null;
  saasQuoteNumber?: string | null;
  grossCharge?: unknown;
  fuelSurcharge?: unknown;
  discount?: unknown;
  /** Optional sell-side gross freight charge before numeric normalization. */
  sellGrossCharge?: unknown;
  /** Optional sell-side freight discount before numeric normalization. */
  sellDiscount?: unknown;
  /** Optional sell-side fuel surcharge before numeric normalization. */
  sellFuelSurcharge?: unknown;
  /** Optional sell-side shipment total before numeric normalization. */
  sellTotalShipmentCost?: unknown;
  accessorialCharges?: Array<{
    accessorialCode?: string | null;
    accessorialDescription?: string | null;
    accessorialCharge?: unknown;
  }> | null;
};

type ShipmentRerateApiResponse = {
  isSuccess: boolean;
  message?: string | null;
  data?: {
    errorMessage?: string | null;
    leastCostCarriers?: ShipmentRerateApiRate[] | null;
  } | null;
};

export type ShipmentRerateState = {
  rates: ShipmentRerateRate[];
  rate: ShipmentRerateRate | null;
  loading: boolean;
  error: string | null;
  currentRequestId: string | null;
};

const initialState: ShipmentRerateState = {
  rates: [],
  rate: null,
  loading: false,
  error: null,
  currentRequestId: null,
};

function requiredNumber(value: unknown, fieldName: string) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`The rating response contains an invalid ${fieldName}.`);
  }

  return numberValue;
}

function validateShipmentRerateRate(
  rate: ShipmentRerateApiRate,
  index: number,
): ShipmentRerateRate {
  const scac = rate.scac?.trim() || null;

  return {
    id: `${scac || "CARRIER"}-${index}-${rate.saasQuoteNumber?.trim() || index}`,
    carrierName: rate.carrierName?.trim() || scac || "Carrier",
    scac,
    rateType: rate.rateType?.trim() || "",
    statusCode:
      typeof rate.statusCode === "number" && Number.isFinite(rate.statusCode)
        ? rate.statusCode
        : null,
    errorMessage: rate.errorMessage?.trim() || null,
    totalShipmentCost: requiredNumber(
      rate.totalShipmentCost,
      "total shipment cost",
    ),
    transitDays: requiredNumber(rate.transitDays, "transit days"),
    deliveryDate: rate.deliveryDate?.trim() || null,
    quoteExpirationDate: rate.quoteExpirationDate?.trim() || null,
    grossCharge: requiredNumber(rate.grossCharge, "gross charge"),
    fuelSurcharge: requiredNumber(rate.fuelSurcharge, "fuel surcharge"),
    discount: requiredNumber(rate.discount, "discount"),
    sellGrossCharge: rate.sellGrossCharge == null
      ? undefined
      : requiredNumber(rate.sellGrossCharge, "sell gross charge"),
    sellDiscount: rate.sellDiscount == null
      ? undefined
      : requiredNumber(rate.sellDiscount, "sell discount"),
    sellFuelSurcharge: rate.sellFuelSurcharge == null
      ? undefined
      : requiredNumber(rate.sellFuelSurcharge, "sell fuel surcharge"),
    sellTotalShipmentCost: rate.sellTotalShipmentCost == null
      ? undefined
      : requiredNumber(rate.sellTotalShipmentCost, "sell total shipment cost"),
    accessorialCharges: (rate.accessorialCharges ?? []).map((charge, index) => ({
      accessorialCode: charge.accessorialCode?.trim() || "ACC",
      accessorialDescription:
        charge.accessorialDescription?.trim() || "Accessorial",
      accessorialCharge: requiredNumber(
        charge.accessorialCharge,
        `accessorial charge ${index + 1}`,
      ),
    })),
  };
}

/** Requests a fresh rate for the displayed shipment. */
export const rerateShipment = createAsyncThunk<
  ShipmentRerateRate[],
  ShipmentRerateRequest,
  { rejectValue: string }
>(
  "shipmentRerate/rerateShipment",
  async (payload, { rejectWithValue, signal }) => {
    try {
      const response = await axios.post<ShipmentRerateApiResponse>(
        `${API_BASE_URL}/Rating/GetRates`,
        createGetRatesRequest(payload),
        {
          headers: {
            Accept: "text/plain",
            "Content-Type": "application/json",
          },
          signal,
        },
      );

      if (!response.data.isSuccess) {
        return rejectWithValue(
          response.data.message || "Unable to re-rate shipment.",
        );
      }

      const successfulRates =
        response.data.data?.leastCostCarriers?.filter(
          (rate) => !rate.errorMessage?.trim(),
        ) ?? [];
      if (successfulRates.length === 0) {
        return rejectWithValue(
          response.data.data?.errorMessage ||
            "No successful carrier rate was returned.",
        );
      }

      return successfulRates.map((rate, index) =>
        validateShipmentRerateRate(rate, index),
      );
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Unable to re-rate shipment."),
      );
    }
  },
);

const shipmentRerateSlice = createSlice({
  name: "shipmentRerate",
  initialState,
  reducers: {
    clearShipmentRerate: (state) => {
      state.rates = [];
      state.rate = null;
      state.loading = false;
      state.error = null;
      state.currentRequestId = null;
    },
    selectShipmentRerateRate: (state, action: PayloadAction<string>) => {
      const selectedRate = state.rates.find(
        (rate) => rate.id === action.payload,
      );

      if (selectedRate) {
        state.rate = selectedRate;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(rerateShipment.pending, (state, action) => {
        state.rates = [];
        state.rate = null;
        state.loading = true;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(rerateShipment.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.rates = action.payload;
        state.rate = null;
        state.loading = false;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(rerateShipment.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.rates = [];
        state.rate = null;
        state.loading = false;
        state.error = action.meta.aborted
          ? null
          : action.payload ||
            action.error.message ||
            "Unable to re-rate shipment.";
        state.currentRequestId = null;
      });
  },
});

export const { clearShipmentRerate, selectShipmentRerateRate } =
  shipmentRerateSlice.actions;
export default shipmentRerateSlice.reducer;

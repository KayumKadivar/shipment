import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";

// Interface for rate item
export const COST_CODE_GROSS = "GROSS";
export const COST_CODE_DISC = "DISC";
export const COST_CODE_FUEL = "FUEL";

export const COST_NAME_GROSS = "Gross Charge";
export const COST_NAME_DISC = "Discount";
export const COST_NAME_FUEL = "Fuel Surcharge";

export interface RateAccessorialCharge {
  accessorialCode?: string;
  accCode?: string;
  accessorialDescription?: string;
  accName?: string;
  accessorialCharge?: number;
  amount?: number;
}

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
  accessorialCharges?: RateAccessorialCharge[];
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
  accessorialCharges?: RateAccessorialCharge[];
  saasQuoteNumber?: string;
  [key: string]: unknown;
}

export interface QuoteFormItem {
  id: string;
  units: string;
  handlingUnit: string;
  pieces: string;
  weight: string;
  weightUnit: string;
  freightClass: string;
  length: string;
  width: string;
  height: string;
  dimensionUnit: string;
  nmfc: string;
  description: string;
  stackable: boolean;
  hazMat: boolean;
  hazMatClass: string;
  hazMatUN: string;
  hazMatProperShippingName?: string;
  hazMatPackingGroup?: string;
  hazMatPhone?: string;
  hazMatContact?: string;
}

export interface QuoteFormPackage {
  id: string;
  items: QuoteFormItem[];
}

export interface RatingShipment {
  class?: string;
  weight?: string | number;
  weightUnit?: string;
  units?: string | number;
  pallets?: string | number;
  pieces?: string | number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  packageType?: string;
  packagingGroup?: string;
  nmfc?: string;
  description?: string;
  hazMat?: boolean;
  isHazmat?: boolean;
  hazMatClass?: string;
  hazmatClass?: string;
  hazMatUN?: string;
  hazmatUN?: string;
  hazMatProperShippingName?: string;
  hazmatProperShippingName?: string;
  hazMatPackingGroup?: string;
  hazmatPackingGroup?: string;
  hazmatGroup?: string;
  hazMatPhone?: string;
  hazmatPhone?: string;
  hazMatContact?: string;
  hazmatContact?: string;
  hazmatContactName?: string;
  stackable?: boolean;
}

export interface CarrierRateRequest extends Record<string, unknown> {
  shipmentDate?: string;
  origCity?: string;
  origState?: string;
  origZip?: string;
  origCountry?: string;
  destCity?: string;
  destState?: string;
  destZip?: string;
  destCountry?: string;
  clientName?: string;
  clientCode?: string;
  profileCode?: string | null;
  ratingProfileCode?: string | null;
  ratingClientCode?: string | null;
  shipments?: RatingShipment[];
  accessorialCodes?: string[];
  totalLinearFeet?: number;
  hazmatProperShippingName?: string;
  hazmatClass?: string;
  hazmatUN?: string;
  hazmatPhone?: string;
  hazmatContactName?: string;
  hazmatGroup?: string;
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
  packages: QuoteFormPackage[];
  selectedAccessorials: string[];
  selectedClientCode?: string;
}

export interface CarrierSearchResult {
  carrierId: string;
  carrierName: string;
}

export interface SearchCarriersApiResponse {
  isSuccess: boolean;
  message?: string;
  data: CarrierSearchResult[];
}

export interface CarrierSearchResult {
  carrierId: string;
  carrierName: string;
}

export interface SearchCarriersApiResponse {
  isSuccess: boolean;
  message?: string;
  data: CarrierSearchResult[];
}

// Interface for customer rate state
export interface CustomerRateState {
  rates: RateItem[];
  loading: boolean;
  error: string | null;
  quoteRequest: CarrierRateRequest | null;
  quoteFormData: QuoteFormData | null;
  carrierSearchResults: CarrierSearchResult[];
  carrierSearchLoading: boolean;
  rawQuote: any | null;
}

// Initial state for customer rate
const initialState: CustomerRateState = {
  rates: [],
  loading: false,
  error: null,
  quoteRequest: null,
  quoteFormData: null,
  carrierSearchResults: [],
  carrierSearchLoading: false,
  rawQuote: null,
};

type RateApiResponse = {
  isSuccess?: boolean;
  message?: string | null;
  errorMessage?: string | null;
  data?: ApiRate[] | { leastCostCarriers?: ApiRate[] } | null;
};

type CarrierLogoApiResponse = {
  isSuccess: boolean;
  data?: string | { logo?: string } | null;
};

export interface QuoteSaveApiResponse {
  isSuccess: boolean;
  message?: string | null;
  data?: unknown;
}

// async thunk for fetching rates
export const fetchCarrierRates = createAsyncThunk<
  ApiRate[],
  CarrierRateRequest,
  { rejectValue: string }
>(
  "customerRate/fetchCarrierRates",
  async (payload, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("authToken");

      const ratingClientCode =
        payload.ratingClientCode ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("ratingClientCode") : null) ||
        payload.clientCode ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("clientCode") : null) ||
        "";

      const ratingProfileCode =
        payload.ratingProfileCode ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("ratingProfileCode") : null) ||
        payload.profileCode ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("profileCode") : null) || "";

      const requestPayload = {
        ...payload,
        ratingProfileCode,
        ratingClientCode,
      };

      const response = await axios.post<RateApiResponse>(
        `${API_BASE_URL}/Rating/GetQuote`,
        requestPayload,
        {
          headers: {
            accept: "*/*",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      if (response.data && response.data.isSuccess === false) {
        let msg = response.data.message || response.data.errorMessage || "Failed to fetch rates";
        if (typeof msg === "string") {
          msg = msg
            .replace(/^[\s-]*Severity:\s*Error[\r\n\s-]*/gi, "")
            .split("\n")
            .map((line) => line.trim().replace(/^[-–—\s]+/, ""))
            .filter(Boolean)
            .join("\n");
        }
        return rejectWithValue(msg);
      }

      let apiRates: ApiRate[] = [];
      const responseData = response.data?.data as any;
      if (responseData) {
        if (Array.isArray(responseData)) {
          apiRates = responseData;
        } else if (Array.isArray(responseData.leastCostCarriers)) {
          apiRates = responseData.leastCostCarriers;
        } else if (Array.isArray(responseData.quoteResults)) {
          apiRates = responseData.quoteResults;
        } else if (Array.isArray(responseData.rates)) {
          apiRates = responseData.rates;
        } else if (Array.isArray(responseData.carrierRates)) {
          apiRates = responseData.carrierRates;
        } else if (Array.isArray(responseData.carriers)) {
          apiRates = responseData.carriers;
        }
      }
      if (responseData && typeof responseData === "object" && !Array.isArray(responseData)) {
        (apiRates as any).rawQuote = responseData;
      }
      console.log("Extracted apiRates:", apiRates);
      return apiRates;
    } catch (error: any) {
      console.error("fetchCarrierRates error:", error);
      let errMsg = "Failed to fetch rates";
      if (error?.response?.data) {
        const data = error.response.data;
        if (typeof data === "string") {
          errMsg = data;
        } else if (data.message) {
          errMsg = data.message;
        } else if (data.errorMessage) {
          errMsg = data.errorMessage;
        } else if (data.title) {
          errMsg = data.title;
          if (data.errors && typeof data.errors === "object") {
            const fieldMsgs = Object.values(data.errors).flat().filter(Boolean).join(", ");
            if (fieldMsgs) errMsg = `${data.title}: ${fieldMsgs}`;
          }
        } else if (data.errors) {
          if (Array.isArray(data.errors)) {
            errMsg = data.errors.join(", ");
          } else if (typeof data.errors === "object") {
            errMsg = Object.values(data.errors).flat().join(", ");
          }
        }
      } else if (error?.message) {
        errMsg = error.message;
      }
      if (typeof errMsg === "string") {
        errMsg = errMsg
          .replace(/^[\s-]*Severity:\s*Error[\r\n\s-]*/gi, "")
          .split("\n")
          .map((line) => line.trim().replace(/^[-–—\s]+/, ""))
          .filter(Boolean)
          .join("\n");
      }
      return rejectWithValue(errMsg);
    }
  }
);

export const fetchCarrierLogo = createAsyncThunk<
  { scac: string; logo: string },
  string,
  { rejectValue: string }
>(
  "customerRate/fetchCarrierLogo",
  async (scac: string, { rejectWithValue }) => {
    try {
      const response = await axios.get<CarrierLogoApiResponse>(
        `${API_BASE_URL}/Carrier/GetCarrierLogoByCarrierId/${scac}`,
      );
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
    } catch {
      return rejectWithValue("Failed to fetch logo");
    }
  }
);


export const searchCarriers = createAsyncThunk<
  CarrierSearchResult[],
  string | undefined,
  { rejectValue: string }
>(
  "customerRate/searchCarriers",
  async (searchText: string = "", { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await axios.get<SearchCarriersApiResponse>(
        `${API_BASE_URL}/Carrier/SearchCarriers`,
        {
          params: { searchText: searchText || "" },
          headers,
        }
      );

      if (response.data && response.data.isSuccess && Array.isArray(response.data.data)) {
        return response.data.data;
      }
      return [];
    } catch (error: any) {
      return rejectWithValue(getApiErrorMessage(error, "Failed to search carriers"));
    }
  }
);

export const saveCustomerQuote = createAsyncThunk<
  QuoteSaveApiResponse,
  {
    marginType?: string;
    marginPercent?: number | string;
    isNetSellRate?: boolean;
    calculatedRates?: any[];
    rawQuote?: any;
  } | void,
  {
    state: { customerRate: CustomerRateState };
    rejectValue: string;
  }
>(
  "customerRate/saveCustomerQuote",
  async (args, { getState, rejectWithValue }) => {
    try {
      const { rates, rawQuote } = getState().customerRate;
      const token = localStorage.getItem("authToken");

      const baseQuote = args?.rawQuote || rawQuote || {};
      const calculatedRates = args?.calculatedRates || rates || [];
      const isNetSell = Boolean(args?.isNetSellRate);

      let marginType = args?.marginType || baseQuote.marginType || "Flat";
      if (isNetSell) {
        marginType = "NetSell";
      }
      const marginPercent = Number(args?.marginPercent ?? baseQuote.marginPercent) || 0;

      const fallbackBrokerCode =
        (baseQuote.clientCode && String(baseQuote.clientCode).trim()) ||
        (baseQuote.profileCode && String(baseQuote.profileCode).trim()) ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("clientCode")?.trim() : null) ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("profileCode")?.trim() : null) ||
        "NICO";

      const fallbackBrokerName =
        (baseQuote.clientName && String(baseQuote.clientName).trim()) ||
        (typeof localStorage !== "undefined" ? localStorage.getItem("clientName")?.trim() : null) ||
        "NICO Logistics";

      let quoteResults = baseQuote.quoteResults;
      if (Array.isArray(quoteResults) && quoteResults.length > 0) {
        quoteResults = quoteResults.map((resultItem: any, idx: number) => {
          const matchingRate = calculatedRates.find(
            (r: any) =>
              (r.code && resultItem.scac && r.code.toUpperCase() === resultItem.scac.toUpperCase()) ||
              (r.name && resultItem.carrierName && r.name.toLowerCase() === resultItem.carrierName.toLowerCase()) ||
              (r.id && resultItem.saasQuoteId && String(r.id) === String(resultItem.saasQuoteId))
          );

          const buyGross = Number(matchingRate?.grossCharge ?? resultItem.grossCharge) || 0;
          const sellGross = Number(matchingRate?.grossSell ?? matchingRate?.grossSellAmount ?? matchingRate?.sellPrice ?? buyGross) || buyGross;

          let costDetails = resultItem.quoteCostDetails;
          if (Array.isArray(costDetails) && costDetails.length > 0) {
            costDetails = costDetails.map((cd: any) => {
              const accCode = (cd.accCode || "").trim().toUpperCase();
              let cdSellAmount = Number(cd.sellAmount ?? cd.amount) || 0;

              if (isNetSell) {
                if (accCode === COST_CODE_GROSS || accCode === "GROSS" || accCode === "FRT") {
                  cdSellAmount = sellGross;
                } else {
                  cdSellAmount = 0;
                }
              } else {
                if (accCode === COST_CODE_GROSS || accCode === "GROSS" || accCode === "FRT") {
                  cdSellAmount = sellGross;
                } else if (accCode === COST_CODE_FUEL || accCode === "FUEL") {
                  cdSellAmount = Number(matchingRate?.fuelSell ?? cd.amount) || 0;
                } else if (accCode === COST_CODE_DISC || accCode === "DISC" || accCode === "DISCOUNT") {
                  cdSellAmount = Number(matchingRate?.discountSell ?? cd.amount) || 0;
                } else {
                  cdSellAmount = Number(cd.sellAmount ?? cd.amount) || 0;
                }
              }

              return {
                ...cd,
                accCode: cd.accCode || COST_CODE_GROSS,
                accName: cd.accName || COST_NAME_GROSS,
                amount: Number(cd.amount) || 0,
                sellAmount: cdSellAmount,
              };
            });
          } else {
            costDetails = [
              {
                quoteCostDetailsId: 0,
                quoteResultId: resultItem.quoteResultId ?? 0,
                accCode: COST_CODE_GROSS,
                accName: COST_NAME_GROSS,
                amount: buyGross,
                sellAmount: sellGross,
              },
              {
                quoteCostDetailsId: 0,
                quoteResultId: resultItem.quoteResultId ?? 0,
                accCode: COST_CODE_DISC,
                accName: COST_NAME_DISC,
                amount: Number(matchingRate?.discount) || 0,
                sellAmount: isNetSell ? 0 : Number(matchingRate?.discount) || 0,
              },
              {
                quoteCostDetailsId: 0,
                quoteResultId: resultItem.quoteResultId ?? 0,
                accCode: COST_CODE_FUEL,
                accName: COST_NAME_FUEL,
                amount: Number(matchingRate?.fuelSurcharge) || 0,
                sellAmount: isNetSell ? 0 : Number(matchingRate?.fuelSurcharge) || 0,
              },
            ];
          }

          const brokerCode =
            (resultItem.brokerCode && String(resultItem.brokerCode).trim()) ||
            (matchingRate?.brokerCode && String(matchingRate.brokerCode).trim()) ||
            fallbackBrokerCode;

          const brokerName =
            (resultItem.brokerName && String(resultItem.brokerName).trim()) ||
            (matchingRate?.brokerName && String(matchingRate.brokerName).trim()) ||
            fallbackBrokerName;

          const serviceLevel =
            (resultItem.serviceLevel && String(resultItem.serviceLevel).trim()) ||
            (matchingRate?.serviceLevel && String(matchingRate.serviceLevel).trim()) ||
            (matchingRate?.service && String(matchingRate.service).trim()) ||
            "Standard";

          const serviceType =
            (resultItem.serviceType && String(resultItem.serviceType).trim()) ||
            (matchingRate?.serviceType && String(matchingRate.serviceType).trim()) ||
            (matchingRate?.service && String(matchingRate.service).trim()) ||
            "Standard";

          const carrierQuoteNo =
            (resultItem.carrierQuoteNo && String(resultItem.carrierQuoteNo).trim()) ||
            (matchingRate?.carrierQuoteNo && String(matchingRate.carrierQuoteNo).trim()) ||
            (matchingRate?.saasQuoteNumber && String(matchingRate.saasQuoteNumber).trim()) ||
            (matchingRate?.id ? String(matchingRate.id) : "") ||
            String(resultItem.quoteResultId || `${baseQuote.quoteRequestId || "Q"}-${idx + 1}`);

          return {
            ...resultItem,
            brokerCode,
            brokerName,
            serviceLevel,
            serviceType,
            carrierQuoteNo,
            scac: (resultItem.scac && String(resultItem.scac).trim()) || (matchingRate?.code && String(matchingRate.code).trim()) || "SCAC",
            carrierName: (resultItem.carrierName && String(resultItem.carrierName).trim()) || (matchingRate?.name && String(matchingRate.name).trim()) || "Carrier",
            transitDays: String(resultItem.transitDays ?? matchingRate?.transitDays ?? "0"),
            saasQuoteId: String(resultItem.saasQuoteId ?? matchingRate?.id ?? ""),
            originTerminalCode: resultItem.originTerminalCode || "",
            originTerminalName: resultItem.originTerminalName || "",
            originTerminalZip: resultItem.originTerminalZip || "",
            originTerminalPhone: resultItem.originTerminalPhone || "",
            destinationTerminalCode: resultItem.destinationTerminalCode || "",
            destinationTerminalName: resultItem.destinationTerminalName || "",
            destinationTerminalZip: resultItem.destinationTerminalZip || "",
            destinationTerminalPhone: resultItem.destinationTerminalPhone || "",
            quoteCostDetails: costDetails,
          };
        });
      } else {
        quoteResults = (calculatedRates || []).map((rate: any, idx: number) => {
          const buyGross = Number(rate.grossCharge) || 0;
          const sellGross = Number(rate.grossSell ?? rate.grossSellAmount ?? rate.sellPrice ?? buyGross) || buyGross;

          const existingAccessorials = (rate.accessorialCharges || []).filter((charge: any) => {
            const code = (charge.accessorialCode || charge.accCode || "").trim().toUpperCase();
            return code !== COST_CODE_GROSS && code !== COST_CODE_DISC && code !== COST_CODE_FUEL;
          });

          const quoteCostDetails = [
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_GROSS,
              accName: COST_NAME_GROSS,
              amount: buyGross,
              sellAmount: sellGross,
            },
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_DISC,
              accName: COST_NAME_DISC,
              amount: Number(rate.discount) || 0,
              sellAmount: isNetSell ? 0 : Number(rate.discount) || 0,
            },
            {
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: COST_CODE_FUEL,
              accName: COST_NAME_FUEL,
              amount: Number(rate.fuelSurcharge) || 0,
              sellAmount: isNetSell ? 0 : Number(rate.fuelSurcharge) || 0,
            },
            ...existingAccessorials.map((charge: any) => ({
              quoteCostDetailsId: 0,
              quoteResultId: 0,
              accCode: charge.accessorialCode || charge.accCode || "ACC",
              accName: charge.accessorialDescription || charge.accName || "ACCESSORIAL",
              amount: Number(charge.accessorialCharge ?? charge.amount) || 0,
              sellAmount: isNetSell ? 0 : Number(charge.accessorialCharge ?? charge.amount) || 0,
            })),
          ];

          return {
            quoteResultId: 0,
            quoteRequestId: baseQuote.quoteRequestId ?? 0,
            scac: rate.code || "SCAC",
            carrierName: rate.name || "Carrier",
            serviceLevel: rate.serviceLevel || rate.service || "Standard",
            carrierQuoteNo: rate.carrierQuoteNo || rate.saasQuoteNumber || (rate.id ? String(rate.id) : `Q-${idx + 1}`),
            brokerCode: fallbackBrokerCode,
            brokerName: fallbackBrokerName,
            transitDays: String(rate.transitDays || "0"),
            serviceType: rate.serviceType || rate.service || "Standard",
            saasQuoteId: String(rate.id || ""),
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
        });
      }

      const payload = {
        ...baseQuote,
        clientCode: baseQuote.clientCode || fallbackBrokerCode,
        clientName: baseQuote.clientName || fallbackBrokerName,
        marginType,
        marginPercent,
        quoteResults,
      };

      const response = await axios.put<QuoteSaveApiResponse>(
        `${API_BASE_URL}/Quote`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            accept: "*/*",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (response.data && response.data.isSuccess) {
        return response.data;
      }
      return rejectWithValue(response.data?.message || "Failed to save quote");
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, "Failed to save quote"));
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
    clearRateError: (state) => {
      state.error = null;
    },
    clearCarrierSearchResults: (state) => {
      state.carrierSearchResults = [];
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
        state.rawQuote = (action.payload as any)?.rawQuote || null;
        state.loading = false;

        state.rates = action.payload.map((rate: any, index: number) => {
          let grossCharge = Number(rate.grossCharge) || 0;
          let grossSellAmount = (rate as any).grossSellAmount != null
            ? Number((rate as any).grossSellAmount)
            : (rate as any).sellAmount != null
            ? Number((rate as any).sellAmount)
            : undefined;
          let discount = Number(rate.discount) || 0;
          let fuelSurcharge = Number(rate.fuelSurcharge) || 0;
          const otherAccessorials: { accessorialDescription?: string; accessorialCharge?: number; code?: string }[] = [];

          const costDetails = rate.quoteCostDetails || rate.costDetails;
          if (Array.isArray(costDetails) && costDetails.length > 0) {
            costDetails.forEach((cd: any) => {
              const code = (cd.accCode || cd.code || "").trim().toUpperCase();
              const name = (cd.accName || cd.name || cd.description || "").trim().toLowerCase();
              const amount = Number(cd.amount ?? cd.charge) || 0;

              if (
                code === COST_CODE_GROSS ||
                code === "FRT" ||
                code === "FREIGHT" ||
                code === "BASE" ||
                name === COST_NAME_GROSS.toLowerCase() ||
                name.includes("gross") ||
                name.includes("freight")
              ) {
                grossCharge = amount;
                if (cd.sellAmount != null) {
                  grossSellAmount = Number(cd.sellAmount);
                }
              } else if (
                code === COST_CODE_DISC ||
                code === "DSC" ||
                code === "DISCOUNT" ||
                name === COST_NAME_DISC.toLowerCase() ||
                name.includes("discount")
              ) {
                discount = Math.abs(amount);
              } else if (
                code === COST_CODE_FUEL ||
                code === "FSC" ||
                code === "FUEL SURCHARGE" ||
                name === COST_NAME_FUEL.toLowerCase() ||
                name.includes("fuel")
              ) {
                fuelSurcharge = amount;
              } else {
                otherAccessorials.push({
                  code: cd.accCode || cd.code || "ACC",
                  accessorialDescription: cd.accName || cd.name || cd.description || "Accessorial",
                  accessorialCharge: amount,
                });
              }
            });
          } else if (Array.isArray(rate.accessorialCharges)) {
            rate.accessorialCharges.forEach((ac: any) => {
              otherAccessorials.push({
                code: ac.code || ac.accessorialCode || "ACC",
                accessorialDescription: ac.accessorialDescription || ac.description || ac.accName || "Accessorial",
                accessorialCharge: Number(ac.accessorialCharge ?? ac.amount) || 0,
              });
            });
          }

          const price = Number(rate.totalShipmentCost) || Number(rate.netCharge) || Number(rate.price) || 0;
          if (!grossCharge && price > 0) {
            grossCharge = price;
          }

          return {
            id: `${rate.scac || rate.carrierCode || "CARRIER"}-${index}-${rate.saasQuoteNumber || index}`,
            name: rate.carrierName || rate.name || "",
            code: rate.scac || rate.carrierCode || "",
            service: rate.serviceLevelDescription || rate.rateType || rate.service || "",
            price: price > 0 ? price : (grossCharge - discount + fuelSurcharge),
            transitDays: Number(rate.transitDays) || 0,
            estimatedDelivery: rate.deliveryDate || rate.estimatedDeliveryDate || "",
            warning: rate.errorMessage?.trim() || (price <= 0 ? "Rate unavailable or capacity rules exceeded." : ""),
            quoteExpiry: rate.quoteExpirationDate || "",
            liabilityNew: "",
            liabilityUsed: "",
            grossCharge,
            grossSellAmount,
            discount,
            fuelSurcharge,
            accessorialCharges: otherAccessorials,
            quoteCostDetails: costDetails,
            rawQuoteResult: rate,
          };
        });
      })
      // fetchCarrierRates.rejected: when request is failed
      .addCase(fetchCarrierRates.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || action.error.message || "Failed to fetch rates";
      })
      .addCase(fetchCarrierLogo.fulfilled, (state, action) => {
        const { scac, logo } = action.payload;
        state.rates = state.rates.map(rate =>
          rate.code === scac ? { ...rate, logo } : rate
        );
      })
      .addCase(searchCarriers.pending, (state) => {
        state.carrierSearchLoading = true;
      })
      .addCase(searchCarriers.fulfilled, (state, action: PayloadAction<CarrierSearchResult[]>) => {
        state.carrierSearchLoading = false;
        state.carrierSearchResults = action.payload;
      })
      .addCase(searchCarriers.rejected, (state) => {
        state.carrierSearchLoading = false;
        state.carrierSearchResults = [];
      });
  },
});

export const { clearRates, setQuoteFormData, clearQuoteFormData, clearRateError, clearCarrierSearchResults } = customerRateSlice.actions;
// Export slice reducer
export default customerRateSlice.reducer;

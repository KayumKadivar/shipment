import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

type ProductSearchApiItem = {
  productId?: number | null;
  productDescription?: string | null;
  productClass?: string | null;
  productNMFC?: string | null;
  weight?: number | null;
  pallets?: number | null;
  isHazmat?: boolean | null;
  hazmatClass?: string | null;
  hazmatUN?: string | null;
  packagingGroup?: string | null;
  length?: number | null;
  height?: number | null;
  width?: number | null;
  isActive?: boolean | null;
};

type ProductSearchApiResponse = {
  isSuccess: boolean;
  message?: string | null;
  data?: ProductSearchApiItem[] | null;
};

export type ShipmentProductSearchResult = {
  productId: number;
  description: string;
  freightClass: string;
  nmfc: string;
  weight: number | null;
  pallets: number | null;
  packageType: string;
  length: number | null;
  width: number | null;
  height: number | null;
  isHazmat: boolean;
  hazmatClass: string;
  hazmatUn: string;
  isActive: boolean | null;
};

export type SearchShipmentProductsArgs = {
  clientCode: string;
  searchText: string;
};

export type ShipmentProductSearchState = {
  data: ShipmentProductSearchResult[];
  loading: boolean;
  error: string | null;
  currentRequestId: string | null;
};

const initialState: ShipmentProductSearchState = {
  data: [],
  loading: false,
  error: null,
  currentRequestId: null,
};

export const searchShipmentProducts = createAsyncThunk<
  ShipmentProductSearchResult[],
  SearchShipmentProductsArgs,
  { rejectValue: string }
>(
  "shipmentProductSearch/searchShipmentProducts",
  async ({ clientCode, searchText }, { rejectWithValue, signal }) => {
    try {
      const response = await axios.post<ProductSearchApiResponse>(
        `${API_BASE_URL}/Product/SearchProducts`,
        {
          clientCode,
          searchText: searchText.trim(),
          pageNumber: 1,
          pageSize: 10,
        },
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
          response.data.message || "Failed to search products",
        );
      }

      return (response.data.data ?? []).map((product) => ({
        productId: product.productId ?? 0,
        description: product.productDescription ?? "",
        freightClass: product.productClass ?? "",
        nmfc: product.productNMFC ?? "",
        weight: product.weight ?? null,
        pallets: product.pallets ?? null,
        packageType: product.packagingGroup ?? "",
        length: product.length ?? null,
        width: product.width ?? null,
        height: product.height ?? null,
        isHazmat: product.isHazmat ?? false,
        hazmatClass: product.hazmatClass ?? "",
        hazmatUn: product.hazmatUN ?? "",
        isActive: product.isActive ?? null,
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError<ProductSearchApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to search products",
        );
      }

      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to search products",
      );
    }
  },
);

const shipmentProductSearchSlice = createSlice({
  name: "shipmentProductSearch",
  initialState,
  reducers: {
    clearShipmentProductSearch: (state) => {
      state.data = [];
      state.loading = false;
      state.error = null;
      state.currentRequestId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(searchShipmentProducts.pending, (state, action) => {
        state.data = [];
        state.loading = true;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(searchShipmentProducts.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(searchShipmentProducts.rejected, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = [];
        state.loading = false;
        state.error = action.meta.aborted
          ? null
          : action.payload ||
            action.error.message ||
            "Failed to search products";
        state.currentRequestId = null;
      });
  },
});

export const { clearShipmentProductSearch } =
  shipmentProductSearchSlice.actions;

export default shipmentProductSearchSlice.reducer;

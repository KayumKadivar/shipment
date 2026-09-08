import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL } from "../config/apiConfig";
import type { CustomerProduct } from "../pages/customerProductData";

interface CustomerProductState {
  products: CustomerProduct[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CustomerProductState = {
  products: [],
  loading: false,
  saving: false,
  error: null,
};

// ============================================================
// Save Product (POST to API)
// ============================================================
export const saveCustomerProduct = createAsyncThunk(
  "customerProducts/saveProduct",
  async (product: Omit<CustomerProduct, "key">, { rejectWithValue }) => {
    try {
      const response = await fetch("http://localhost:8000/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        throw new Error("Failed to save product on server");
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || "Something went wrong");
    }
  }
);



// ============================================================
// Get All Products
// ============================================================
export const getCustomerProducts = createAsyncThunk<
  CustomerProduct[],
  number,
  { rejectValue: string }
>(
  "customerProduct/getCustomerProducts",
  async (clientID, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/Product/GetProducts`,
        {
          params: {
            ClientID: clientID || 1,
          },
          headers: {
            accept: "text/plain",
          },
        }
      );

      console.log("GetProducts Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Products could not be retrieved."
        );
      }

      const products: CustomerProduct[] = (
        response.data?.data || []
      ).map((product: any) => ({
        key: `product-${product.productID}`,

        description: product.description ?? "",

        isActive: product.isActive ?? false,

        nmfc: product.nmfc ?? "",

        productClass: product.productClass ?? "",

        commodity: product.commodity ?? "",

        isHazmat: product.hazmat ?? false,

        hazmatContact:
          product.hazmatContact ?? "",

        length: product.length ?? 0,

        height: product.height ?? 0,

        weight: product.weight ?? 0,

        width: product.width ?? 0,

        productGroup:
          product.productGroup ?? "",

        notes: product.notes ?? "",

        isApproved:
          product.isApproved ?? false,
      }));

      return products;
    } catch (error: any) {
      console.error(
        "GetProducts API Error:",
        error
      );

      if (error?.response) {
        console.error(
          "API Status:",
          error.response.status
        );

        console.error(
          "API Response:",
          error.response.data
        );
      }

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to retrieve products."
      );
    }
  }
);

// ============================================================
// Search Products By Description
// ============================================================
export const searchCustomerProducts = createAsyncThunk<
  CustomerProduct[],
  {
    clientID: string | number;
    description: string;
  },
  { rejectValue: string }
>(
  "customerProduct/searchCustomerProducts",
  async (
    { clientID, description },
    { rejectWithValue }
  ) => {
    try {
      console.log(
        "Searching products:",
        {
          ClientID: clientID,
          Description: description,
        }
      );

      const response = await axios.get(
        `${API_BASE_URL}/Product/GetProductByDesc`,
        {
          params: {
            ClientID: clientID,
            Description: description,
          },
          headers: {
            accept: "text/plain",
          },
        }
      );

      console.log(
        "GetProductByDesc Response:",
        response.data
      );

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Products could not be retrieved."
        );
      }

      const products: CustomerProduct[] = (
        response.data?.data || []
      ).map((product: any) => ({
        key: `product-${product.productID}`,

        description:
          product.description ?? "",

        isActive:
          product.isActive ?? false,

        nmfc:
          product.nmfc ?? "",

        productClass:
          product.productClass ?? "",

        commodity:
          product.commodity ?? "",

        isHazmat:
          product.hazmat ?? false,

        hazmatContact:
          product.hazmatContact ?? "",

        length:
          product.length ?? 0,

        height:
          product.height ?? 0,

        weight:
          product.weight ?? 0,

        width:
          product.width ?? 0,

        productGroup:
          product.productGroup ?? "",

        notes:
          product.notes ?? "",

        isApproved:
          product.isApproved ?? false,
      }));

      console.log(
        "Mapped Search Products:",
        products
      );

      return products;
    } catch (error: any) {
      console.error(
        "GetProductByDesc API Error:",
        error
      );

      if (error?.response) {
        console.error(
          "API Status:",
          error.response.status
        );

        console.error(
          "API Response:",
          error.response.data
        );
      }

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to search products."
      );
    }
  }
);

// ============================================================
// Customer Product Slice
// ============================================================
const customerProductSlice = createSlice({
  name: "customerProduct",

  initialState,

  reducers: {
    clearProducts: (state) => {
      state.products = [];
      state.error = null;
    },

    clearProductError: (state) => {
      state.error = null;
    },

    setProducts: (
      state,
      action: PayloadAction<CustomerProduct[]>
    ) => {
      state.products = action.payload;
    },
  },

  extraReducers: (builder) => {
    // ========================================================
    // GET ALL PRODUCTS
    // ========================================================
    builder.addCase(
      getCustomerProducts.pending,
      (state) => {
        state.loading = true;
        state.error = null;
      }
    );

    builder.addCase(
      getCustomerProducts.fulfilled,
      (state, action) => {
        state.loading = false;

        // IMPORTANT
        // Replace existing table data
        state.products = action.payload;

        state.error = null;
      }
    );

    builder.addCase(
      getCustomerProducts.rejected,
      (state, action) => {
        state.loading = false;

        state.error =
          action.payload ||
          action.error.message ||
          "Failed to retrieve products.";
      }
    );

    // ========================================================
    // SEARCH PRODUCTS
    // ========================================================
    builder.addCase(
      searchCustomerProducts.pending,
      (state) => {
        state.loading = true;
        state.error = null;
      }
    );

    builder.addCase(
      searchCustomerProducts.fulfilled,
      (state, action) => {
        state.loading = false;

        // IMPORTANT
        // This replaces the old 3 products
        // with search API results
        state.products = action.payload;

        state.error = null;
      }
    );

    builder.addCase(
      searchCustomerProducts.rejected,
      (state, action) => {
        state.loading = false;

        state.error =
          action.payload ||
          action.error.message ||
          "Failed to search products.";
      }
    );
  },
});

// ============================================================
// Actions
// ============================================================
export const {
  clearProducts,
  clearProductError,
  setProducts,
} = customerProductSlice.actions;

// ============================================================
// Reducer
// ============================================================
export default customerProductSlice.reducer;
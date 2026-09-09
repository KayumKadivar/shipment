import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL } from "../config/apiConfig";
import type { CustomerProduct } from "../types/customerProduct.types";

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
// Save Product (POST /api/Product/AddProduct)
// ============================================================
export const saveCustomerProduct = createAsyncThunk(
  "customerProduct/saveCustomerProduct",
  async (
    payloadData: Omit<CustomerProduct, "key"> & { clientID?: string | number },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        clientID: payloadData.clientID || 1,
        description: payloadData.description || "",
        isActive: payloadData.isActive ?? true,
        nmfc: payloadData.nmfc || "",
        productClass: payloadData.productClass || "",
        commodity: payloadData.commodity || "",
        hazmat: payloadData.isHazmat ?? false,
        hazmatContact: payloadData.hazmatContact || "",
        length: payloadData.length || 0,
        height: payloadData.height || 0,
        weight: payloadData.weight || 0,
        width: payloadData.width || 0,
        productGroup: payloadData.productGroup || "STANDARD",
        notes: payloadData.notes || "",
        isApproved: payloadData.isApproved ?? true,
      };

      const response = await axios.post(
        `${API_BASE_URL}/Product/AddProduct`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("AddProduct Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to save product."
        );
      }

      return response.data?.data;
    } catch (error: any) {
      console.error("AddProduct API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save product."
      );
    }
  }
);

// ============================================================
// Get All Products (GET /api/Product/GetProducts)
// ============================================================
export const getCustomerProducts = createAsyncThunk<
  CustomerProduct[],
  string | number | undefined,
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
        key: String(product.productID || Date.now()),
        productID: product.productID,
        description: product.description ?? "",
        isActive: product.isActive ?? false,
        nmfc: product.nmfc ?? "",
        productClass: product.productClass ?? "",
        commodity: product.commodity ?? "",
        isHazmat: product.hazmat ?? product.isHazmat ?? false,
        hazmatContact: product.hazmatContact ?? "",
        length: product.length ?? 0,
        height: product.height ?? 0,
        weight: product.weight ?? 0,
        width: product.width ?? 0,
        productGroup: product.productGroup ?? "STANDARD",
        notes: product.notes ?? "",
        isApproved: product.isApproved ?? false,
      }));

      return products;
    } catch (error: any) {
      console.error("GetProducts API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to retrieve products."
      );
    }
  }
);

// ============================================================
// Get Product By ID (GET /api/Product/GetProductByID)
// ============================================================
export const getCustomerProductByID = createAsyncThunk<
  CustomerProduct,
  { productID: string | number },
  { rejectValue: string }
>(
  "customerProduct/getCustomerProductByID",
  async ({ productID }, { rejectWithValue }) => {
    try {
      console.log("Getting product by ID:", { ProductID: productID });

      const response = await axios.get(
        `${API_BASE_URL}/Product/GetProductByID`,
        {
          params: {
            ProductID: productID,
          },
          headers: {
            accept: "text/plain",
          },
        }
      );

      console.log("GetProductByID Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Product could not be retrieved."
        );
      }

      const product = response.data?.data;
      if (!product) {
        return rejectWithValue("Product not found.");
      }

      const mappedProduct: CustomerProduct = {
        key: String(product.productID || productID),
        productID: product.productID,
        description: product.description ?? "",
        isActive: product.isActive ?? false,
        nmfc: product.nmfc ?? "",
        productClass: product.productClass ?? "",
        commodity: product.commodity ?? "",
        isHazmat: product.hazmat ?? product.isHazmat ?? false,
        hazmatContact: product.hazmatContact ?? "",
        length: product.length ?? 0,
        height: product.height ?? 0,
        weight: product.weight ?? 0,
        width: product.width ?? 0,
        productGroup: product.productGroup ?? "STANDARD",
        notes: product.notes ?? "",
        isApproved: product.isApproved ?? false,
      };

      return mappedProduct;
    } catch (error: any) {
      console.error("GetProductByID API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to retrieve product details."
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
        key: String(product.productID || Date.now()),
        productID: product.productID,
        description: product.description ?? "",
        isActive: product.isActive ?? false,
        nmfc: product.nmfc ?? "",
        productClass: product.productClass ?? "",
        commodity: product.commodity ?? "",
        isHazmat: product.hazmat ?? product.isHazmat ?? false,
        hazmatContact: product.hazmatContact ?? "",
        length: product.length ?? 0,
        height: product.height ?? 0,
        weight: product.weight ?? 0,
        width: product.width ?? 0,
        productGroup: product.productGroup ?? "STANDARD",
        notes: product.notes ?? "",
        isApproved: product.isApproved ?? false,
      }));

      return products;
    } catch (error: any) {
      console.error(
        "GetProductByDesc API Error:",
        error
      );
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
    builder.addCase(getCustomerProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getCustomerProducts.fulfilled, (state, action) => {
      state.loading = false;
      state.products = action.payload;
      state.error = null;
    });
    builder.addCase(getCustomerProducts.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload ||
        action.error.message ||
        "Failed to retrieve products.";
    });

    // ========================================================
    // GET PRODUCT BY ID
    // ========================================================
    builder.addCase(getCustomerProductByID.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getCustomerProductByID.fulfilled, (state, action) => {
      state.loading = false;
      const index = state.products.findIndex(
        (p) => p.key === action.payload.key
      );
      if (index !== -1) {
        state.products[index] = action.payload;
      } else {
        state.products.push(action.payload);
      }
      state.error = null;
    });
    builder.addCase(getCustomerProductByID.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload ||
        action.error.message ||
        "Failed to retrieve product details.";
    });

    // ========================================================
    // SAVE PRODUCT
    // ========================================================
    builder.addCase(saveCustomerProduct.pending, (state) => {
      state.saving = true;
      state.error = null;
    });
    builder.addCase(saveCustomerProduct.fulfilled, (state) => {
      state.saving = false;
      state.error = null;
    });
    builder.addCase(saveCustomerProduct.rejected, (state, action) => {
      state.saving = false;
      state.error =
        (action.payload as string) ||
        action.error.message ||
        "Failed to save product.";
    });

    // ========================================================
    // SEARCH PRODUCTS
    // ========================================================
    builder.addCase(searchCustomerProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(searchCustomerProducts.fulfilled, (state, action) => {
      state.loading = false;
      state.products = action.payload;
      state.error = null;
    });
    builder.addCase(searchCustomerProducts.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload ||
        action.error.message ||
        "Failed to search products.";
    });
  },
});

export const {
  clearProducts,
  clearProductError,
  setProducts,
} = customerProductSlice.actions;

export default customerProductSlice.reducer;
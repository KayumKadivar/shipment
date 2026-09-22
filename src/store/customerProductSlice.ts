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
  totalCount: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CustomerProductState = {
  products: [],
  totalCount: 0,
  loading: false,
  saving: false,
  error: null,
};

// ============================================================
// Save Product (POST /api/Product)
// ============================================================
export const saveCustomerProduct = createAsyncThunk(
  "customerProduct/saveCustomerProduct",
  async (
    payloadData: Omit<CustomerProduct, "key"> & { clientID?: string | number },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        productId: 0,
        productDescription: payloadData.description || "",
        productClass: payloadData.productClass || "",
        productNMFC: payloadData.nmfc || "",
        weight: payloadData.weight || 0,
        pallets: 0,
        isHazmat: payloadData.isHazmat ?? false,
        hazmatClass: "",
        hazmatUN: "",
        packagingGroup: "",
        clientCode: sessionStorage.getItem("customerProduct_selectedClientCode") || "1",
        length: payloadData.length || 0,
        height: payloadData.height || 0,
        width: payloadData.width || 0,
        isActive: payloadData.isActive ?? true,
      };

      const response = await axios.post(
        `${API_BASE_URL}/Product`,
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
// Update Product (PUT /api/Product)
// ============================================================
export const updateCustomerProduct = createAsyncThunk(
  "customerProduct/updateCustomerProduct",
  async (
    payloadData: Partial<CustomerProduct> & { productID: string | number },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        productId: Number(payloadData.productID),
        productDescription: payloadData.description || "",
        productClass: payloadData.productClass || "",
        productNMFC: payloadData.nmfc || "",
        weight: payloadData.weight || 0,
        pallets: 0,
        isHazmat: payloadData.isHazmat ?? false,
        hazmatClass: "",
        hazmatUN: "",
        packagingGroup: "",
        clientCode: sessionStorage.getItem("customerProduct_selectedClientCode") || "1",
        length: payloadData.length || 0,
        height: payloadData.height || 0,
        width: payloadData.width || 0,
        isActive: payloadData.isActive ?? true,
      };

      const response = await axios.put(
        `${API_BASE_URL}/Product`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("UpdateProduct Response:", response.data);

      if (!response.data?.isSuccess && response.data?.message) {
         return rejectWithValue(response.data?.message || "Failed to update product.");
      }

      return payloadData;
    } catch (error: any) {
      console.error("UpdateProduct API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to update product."
      );
    }
  }
);

// ============================================================
// Get All Products (GET /api/Product/GetProductsByClientCode/{clientCode})
// ============================================================
export interface GetProductsParams {
  clientCode?: string;
  searchText?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const getCustomerProducts = createAsyncThunk<
  { products: CustomerProduct[]; totalCount: number },
  GetProductsParams | string | number | undefined,
  { rejectValue: string }
>(
  "customerProduct/getCustomerProducts",
  async (params, { rejectWithValue }) => {
    try {
      let clientCode = "1";
      let searchText = "";
      let pageNumber = 1;
      let pageSize = 10;

      if (typeof params === "object" && params !== null) {
        if (params.clientCode) clientCode = params.clientCode;
        if (params.searchText !== undefined) searchText = params.searchText;
        if (params.pageNumber !== undefined) pageNumber = params.pageNumber;
        if (params.pageSize !== undefined) pageSize = params.pageSize;
      } else if (typeof params === "string" || typeof params === "number") {
        clientCode = String(params);
      }

      let response;
      if (searchText && searchText.trim() !== "") {
        const payload = {
          clientCode,
          searchText,
          pageNumber,
          pageSize
        };

        response = await axios.post(
          `${API_BASE_URL}/Product/SearchProducts`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              accept: "application/json, text/plain, */*",
            },
          }
        );
      } else {
        response = await axios.get(
          `${API_BASE_URL}/Product/GetProductsByClientCode/${encodeURIComponent(clientCode)}`,
          {
            params: {
              pageNumber,
              pageSize,
            },
            headers: {
              "Content-Type": "application/json",
              accept: "application/json, text/plain, */*",
            },
          }
        );
      }

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
        key: String(product.productId || Date.now()),
        productID: product.productId,
        description: product.productDescription ?? "",
        isActive: product.isActive ?? false,
        nmfc: product.productNMFC ?? "",
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

      const totalCount = response.data?.totalCount ?? response.data?.TotalCount ?? products.length;

      return { products, totalCount };
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
// Get Product By Description (GET /api/Product/GetProductByDesc)
// ============================================================
export const getCustomerProductByDesc = createAsyncThunk<
  CustomerProduct,
  { clientID?: string | number; description: string },
  { rejectValue: string }
>(
  "customerProduct/getCustomerProductByDesc",
  async ({ clientID, description }, { rejectWithValue }) => {
    try {
      console.log("Getting product by description:", {
        ClientID: clientID,
        Description: description,
      });

      const response = await axios.get(
        `${API_BASE_URL}/Product/GetProductByDesc`,
        {
          params: {
            ClientID: clientID || "1",
            Description: description,
          },
          headers: {
            accept: "text/plain",
          },
        }
      );

      console.log("GetProductByDesc Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Product could not be retrieved."
        );
      }

      const prod = response.data?.data;
      if (!prod) {
        return rejectWithValue("Product data not found.");
      }

      const mappedProduct: CustomerProduct = {
        key: String(prod.productId || Date.now()),
        productID: prod.productId,
        description: prod.productDescription ?? "",
        isActive: prod.isActive ?? false,
        nmfc: prod.productNMFC ?? "",
        productClass: prod.productClass ?? "",
        commodity: prod.commodity ?? "",
        isHazmat: prod.isHazmat ?? false,
        hazmatContact: prod.hazmatContact ?? "",
        length: prod.length ?? 0,
        height: prod.height ?? 0,
        weight: prod.weight ?? 0,
        width: prod.width ?? 0,
        productGroup: prod.productGroup ?? "STANDARD",
        notes: prod.notes ?? "",
        isApproved: prod.isApproved ?? true,
      };

      return mappedProduct;
    } catch (error: any) {
      console.error("GetProductByDesc API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to retrieve product details."
      );
    }
  }
);

// ============================================================
// Delete Multiple Products (DELETE /api/Product/DeleteMultiple)
// ============================================================
export const deleteCustomerProducts = createAsyncThunk<
  number[],
  number[],
  { rejectValue: string }
>(
  "customerProduct/deleteCustomerProducts",
  async (productIds: number[], { rejectWithValue }) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/Product/DeleteMultiple`,
        {
          data: productIds,
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("DeleteMultiple Response:", response.data);

      if (!response.data?.isSuccess && response.data?.message) {
         return rejectWithValue(response.data?.message || "Failed to delete products.");
      }

      return productIds;
    } catch (error: any) {
      console.error("DeleteMultiple API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to delete products."
      );
    }
  }
);

// ============================================================
// Get Product By ID (GET /api/Product/{id})
// ============================================================
export const getCustomerProductByID = createAsyncThunk<
  CustomerProduct,
  number | string,
  { rejectValue: string }
>(
  "customerProduct/getCustomerProductByID",
  async (id, { rejectWithValue }) => {
    try {
      console.log("Getting product by ID:", id);

      const response = await axios.get(
        `${API_BASE_URL}/Product/${id}`,
        {
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

      const prod = response.data?.data;
      if (!prod) {
        return rejectWithValue("Product data not found.");
      }

      const mappedProduct: CustomerProduct = {
        key: String(prod.productId || Date.now()),
        productID: prod.productId,
        description: prod.productDescription ?? "",
        isActive: prod.isActive ?? false,
        nmfc: prod.productNMFC ?? "",
        productClass: prod.productClass ?? "",
        commodity: prod.commodity ?? "",
        isHazmat: prod.isHazmat ?? false,
        hazmatContact: prod.hazmatContact ?? "",
        length: prod.length ?? 0,
        height: prod.height ?? 0,
        weight: prod.weight ?? 0,
        width: prod.width ?? 0,
        productGroup: prod.productGroup ?? "STANDARD",
        notes: prod.notes ?? "",
        isApproved: prod.isApproved ?? true,
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
            "Content-Type": "application/json",
            accept: "application/json, text/plain, */*",
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
      state.products = action.payload.products;
      state.totalCount = action.payload.totalCount;
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
    // GET PRODUCT BY DESC
    // ========================================================
    builder.addCase(getCustomerProductByDesc.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(getCustomerProductByDesc.fulfilled, (state, action) => {
      state.loading = false;
      const index = state.products.findIndex(
        (p) => p.productID === action.payload.productID || p.description === action.payload.description
      );
      if (index !== -1) {
        state.products[index] = action.payload;
      }
      state.error = null;
    });
    builder.addCase(getCustomerProductByDesc.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload ||
        action.error.message ||
        "Failed to retrieve product details.";
    });

    // ========================================================
    // UPDATE PRODUCT
    // ========================================================
    builder.addCase(updateCustomerProduct.pending, (state) => {
      state.saving = true;
      state.error = null;
    });
    builder.addCase(updateCustomerProduct.fulfilled, (state, action) => {
      state.saving = false;
      const index = state.products.findIndex(
        (p) => p.productID === action.payload.productID
      );
      if (index !== -1) {
        state.products[index] = { ...state.products[index], ...action.payload };
      }
      state.error = null;
    });
    builder.addCase(updateCustomerProduct.rejected, (state, action) => {
      state.saving = false;
      state.error =
        (action.payload as string) ||
        action.error.message ||
        "Failed to update product.";
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
        (p) => p.productID === action.payload.productID
      );
      if (index !== -1) {
        state.products[index] = action.payload;
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
    // DELETE PRODUCTS
    // ========================================================
    builder.addCase(deleteCustomerProducts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteCustomerProducts.fulfilled, (state, action) => {
      state.loading = false;
      state.products = state.products.filter(
        (p) => p.productID === undefined || !action.payload.includes(p.productID)
      );
      state.error = null;
    });
    builder.addCase(deleteCustomerProducts.rejected, (state, action) => {
      state.loading = false;
      state.error =
        action.payload ||
        action.error.message ||
        "Failed to delete products.";
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
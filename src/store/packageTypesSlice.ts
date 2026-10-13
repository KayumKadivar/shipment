import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL } from "../config/apiConfig";

export type ProductPackageType = {
  packageTypeId: number;
  packageType: string;
};

type PackageTypeApiResponse = {
  isSuccess: boolean;
  message?: string | null;
  data?: ProductPackageType[] | null;
};

type PackageTypesState = {
  data: ProductPackageType[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  currentRequestId: string | null;
};

const initialState: PackageTypesState = {
  data: [],
  loading: false,
  loaded: false,
  error: null,
  currentRequestId: null,
};

export const fetchPackageTypes = createAsyncThunk<
  ProductPackageType[],
  void,
  {
    state: { packageTypes: PackageTypesState };
    rejectValue: string;
  }
>(
  "packageTypes/fetchPackageTypes",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<PackageTypeApiResponse>(
        `${API_BASE_URL}/ProductPackageType`,
        { headers: { Accept: "text/plain" } },
      );

      if (!response.data.isSuccess) {
        return rejectWithValue(
          response.data.message || "Failed to fetch package types",
        );
      }

      return (response.data.data ?? []).map((item) => ({
        ...item,
        packageType: item.packageType.trim(),
      }));
    } catch (error: unknown) {
      if (axios.isAxiosError<PackageTypeApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            "Failed to fetch package types",
        );
      }

      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to fetch package types",
      );
    }
  },
  {
    condition: (_, { getState }) => {
      const state = getState().packageTypes;
      return !state.loading && !state.loaded;
    },
  },
);

const packageTypesSlice = createSlice({
  name: "packageTypes",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPackageTypes.pending, (state, action) => {
        state.data = [];
        state.loading = true;
        state.loaded = false;
        state.error = null;
        state.currentRequestId = action.meta.requestId;
      })
      .addCase(fetchPackageTypes.fulfilled, (state, action) => {
        if (state.currentRequestId !== action.meta.requestId) return;

        state.data = action.payload;
        state.loading = false;
        state.loaded = true;
        state.error = null;
        state.currentRequestId = null;
      })
      .addCase(fetchPackageTypes.rejected, (state, action) => {
        if (
          action.meta.condition ||
          state.currentRequestId !== action.meta.requestId
        ) {
          return;
        }

        state.data = [];
        state.loading = false;
        state.loaded = false;
        state.error = action.meta.aborted
          ? null
          : action.payload ||
            action.error.message ||
            "Failed to fetch package types";
        state.currentRequestId = null;
      });
  },
});

export default packageTypesSlice.reducer;

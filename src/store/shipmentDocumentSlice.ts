import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";

export type FetchShipmentDocumentsArgs = {
  loadNumber: string;
  clientCode?: string | null;
  force?: boolean;
};

export type ShipmentDocumentsApiResponse = {
  isSuccess: boolean;
  message: string | null;
  data: any;
};

export type ShipmentDocumentState = {
  data: any;
  loading: boolean;
  error: string | null;
  requestedLoadNumber: string | null;
  loadedLoadNumber: string | null;
  loadedClientCode: string | null;
  requestedClientCode: string | null;
};

const initialState: ShipmentDocumentState = {
  data: null,
  loading: false,
  error: null,
  requestedLoadNumber: null,
  loadedLoadNumber: null,
  loadedClientCode: null,
  requestedClientCode: null,
};

export const fetchShipmentDocuments = createAsyncThunk<
  any,
  FetchShipmentDocumentsArgs,
  { rejectValue: string; state: { shipmentDocument: ShipmentDocumentState } }
>(
  "shipmentDocument/fetchShipmentDocuments",
  async ({ loadNumber, clientCode }, { rejectWithValue }) => {
    const resolvedLoadNumber = loadNumber.trim();
    const resolvedClientCode = clientCode?.trim() || "";

    try {
      console.log(
        `[GetDocumentsByLoadNumberAndClientCode] Fetching documents for loadNumber="${resolvedLoadNumber}", clientCode="${resolvedClientCode}"`
      );

      const response = await axios.get<ShipmentDocumentsApiResponse>(
        `${API_BASE_URL}/GetDocumentsByLoadNumberAndClientCode`,
        {
          params: {
            loadNumber: resolvedLoadNumber,
            clientCode: resolvedClientCode,
            srvToken: SRV_TOKEN,
          },
          headers: {
            Accept: "*/*",
          },
        }
      );

      console.log(
        "[GetDocumentsByLoadNumberAndClientCode] API Response:",
        response.data
      );

      if (!response.data || response.data.isSuccess === false) {
        return rejectWithValue(
          response.data?.message ||
            `Documents for shipment ${resolvedLoadNumber} were not found.`
        );
      }

      return response.data;
    } catch (error: unknown) {
      console.error("[GetDocumentsByLoadNumberAndClientCode] API Error:", error);
      if (axios.isAxiosError<ShipmentDocumentsApiResponse>(error)) {
        return rejectWithValue(
          error.response?.data?.message ||
            error.message ||
            `Unable to load documents for shipment ${resolvedLoadNumber}.`
        );
      }

      return rejectWithValue(
        error instanceof Error
          ? error.message
          : `Unable to load documents for shipment ${resolvedLoadNumber}.`
      );
    }
  },
  {
    condition: ({ loadNumber, clientCode, force }, { getState }) => {
      if (force) return true;
      const state = getState().shipmentDocument;
      const keyLoadNumber = loadNumber.trim();
      const keyClientCode = clientCode?.trim() || "";
      if (state.loading && state.requestedLoadNumber === keyLoadNumber && state.requestedClientCode === keyClientCode) return false;
      return !(state.loadedLoadNumber === keyLoadNumber && state.loadedClientCode === keyClientCode && state.data !== null);
    },
  }
);

const shipmentDocumentSlice = createSlice({
  name: "shipmentDocument",
  initialState,
  reducers: {
    clearShipmentDocuments(state) {
      state.data = null;
      state.loading = false;
      state.error = null;
      state.requestedLoadNumber = null;
      state.loadedLoadNumber = null;
      state.loadedClientCode = null;
      state.requestedClientCode = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchShipmentDocuments.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestedLoadNumber = action.meta.arg.loadNumber.trim();
        state.requestedClientCode = action.meta.arg.clientCode?.trim() || "";
      })
      .addCase(fetchShipmentDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.data = action.payload;
        state.loadedLoadNumber = action.meta.arg.loadNumber.trim();
        state.loadedClientCode = action.meta.arg.clientCode?.trim() || "";
      })
      .addCase(fetchShipmentDocuments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load documents";
      });
  },
});

export const { clearShipmentDocuments } = shipmentDocumentSlice.actions;
export default shipmentDocumentSlice.reducer;

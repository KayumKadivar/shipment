import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL, DEFAULT_CLIENT_CODE } from "../config/apiConfig";
import type { CustomerLocation, LocationType } from "../types/customerLocation.types";

interface CustomerLocationState {
  locations: CustomerLocation[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CustomerLocationState = {
  locations: [],
  loading: false,
  saving: false,
  error: null,
};

// ============================================================
// Add Location (POST API)
// ============================================================
import type { RootState } from "../app/store";

export const saveCustomerLocation = createAsyncThunk(
  "customerLocation/saveCustomerLocation",
  async (
    payloadData: Omit<CustomerLocation, "key"> & { clientID?: string },
    { rejectWithValue, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const allAccessorials = state.accessorials.data;

      const payload = {
        clientID: payloadData.clientID || "1",
        shortName: payloadData.shortName || "",
        locationName: payloadData.locationName || "",
        address1: payloadData.address1 || "",
        address2: payloadData.address2 || "",
        country: payloadData.country || "",
        postal: payloadData.postal || "",
        state: payloadData.state || "",
        city: payloadData.city || "",
        port: payloadData.port || "",
        contactName: payloadData.contactName || "",
        phone: payloadData.phone || "",
        email: payloadData.email || "",
        faxNumber: payloadData.faxNumber || "",
        locationType: payloadData.locationType || "",
        group: payloadData.group || "",
        activateDate: payloadData.activateDate ? new Date(payloadData.activateDate).toISOString() : new Date().toISOString(),
        deactivateDate: payloadData.deactivateDate ? new Date(payloadData.deactivateDate).toISOString() : new Date().toISOString(),
        isActive: payloadData.isActive ?? true,
        locationRef: payloadData.locationRef || "",
        inboundAccount: payloadData.inboundAccount || "",
        outboundAccount: payloadData.outboundAccount || "",
        notes: payloadData.notes || "",
        openTime: payloadData.openTime && payloadData.openTime.trim() !== "" ? payloadData.openTime.trim() : null,
        closeTime: payloadData.closeTime && payloadData.closeTime.trim() !== "" ? payloadData.closeTime.trim() : null,
        accessorialsList: (payloadData.accessorials || []).map((acc: any) => {
          const matched = allAccessorials.find(a => a.accessorialName === acc);
          return {
            accessorialsID: matched ? matched.accessorialID : 0,
            accessorialsName: acc
          };
        })
      };

      const response = await axios.post(
        `${API_BASE_URL}/CustomerLocation/AddLocation`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("AddLocation Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to add location."
        );
      }

      return response.data?.data;
    } catch (error: any) {
      console.error("AddLocation API Error:", error);
      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to save location."
      );
    }
  }
);

// ============================================================
// Get All Locations (GET /api/Location/GetLocationsByClientCode/{clientCode})
// ============================================================
export interface GetLocationsParams {
  clientCode?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const getAllCustomerLocations = createAsyncThunk<
  CustomerLocation[],
  GetLocationsParams | string | number | undefined,
  { rejectValue: string }
>(
  "customerLocation/getAllCustomerLocations",
  async (params, { rejectWithValue }) => {
    try {
      let clientCode = DEFAULT_CLIENT_CODE;
      let pageNumber = 1;
      let pageSize = 10;

      if (typeof params === "object" && params !== null) {
        if (params.clientCode) clientCode = params.clientCode;
        if (params.pageNumber !== undefined) pageNumber = params.pageNumber;
        if (params.pageSize !== undefined) pageSize = params.pageSize;
      } else if (typeof params === "string" && isNaN(Number(params))) {
        clientCode = params;
      }

      const token = localStorage.getItem("authToken");

      const response = await axios.get(
        `${API_BASE_URL}/Location/GetLocationsByClientCode/${encodeURIComponent(clientCode)}`,
        {
          params: {
            pageNumber,
            pageSize,
          },
          headers: {
            "Content-Type": "application/json",
            accept: "application/json, text/plain, */*",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      console.log("GetLocationsByClientCode Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Locations could not be retrieved."
        );
      }

      const locations: CustomerLocation[] = (
        response.data?.data || []
      ).map((loc: any) => {
        const id = loc.locationId ?? loc.locationID;
        return {
          key: String(id || `loc-${Math.random()}`),
          locationId: id,
          locationID: id,
          locationName: loc.locationName ?? "",
          isActive: loc.isActive ?? true,
          address1: loc.address1 ?? "",
          address2: loc.address2 ?? "",
          country: loc.countryCode ?? loc.country ?? "",
          countryCode: loc.countryCode ?? loc.country ?? "",
          state: loc.stateCode ?? loc.state ?? "",
          stateCode: loc.stateCode ?? loc.state ?? "",
          city: loc.city ?? "",
          postal: loc.zipCode ?? loc.postal ?? "",
          zipCode: loc.zipCode ?? loc.postal ?? "",
          clientCode: loc.clientCode ?? clientCode,
          contactName: loc.contactName ?? loc.createdBy ?? "",
          phone: loc.phone ?? "",
          email: loc.email ?? "",
          activateDate: loc.createdDate
            ? new Date(loc.createdDate).toLocaleDateString()
            : loc.activateDate ?? "",
          deactivateDate: loc.deactivateDate ?? "",
          createdBy: loc.createdBy ?? "",
          createdDate: loc.createdDate ?? "",
          modifiedBy: loc.modifiedBy ?? "",
          modifiedDate: loc.modifiedDate ?? "",
          group: loc.group ?? "STANDARD",
          locationType: (loc.locationType as LocationType) ?? "All",
        };
      });

      return locations;
    } catch (error: any) {
      console.error(
        "GetLocationsByClientCode API Error:",
        error
      );

      return rejectWithValue(
        error?.response?.data?.message ||
          error?.message ||
          "Failed to retrieve locations."
      );
    }
  }
);

// ============================================================
// Get Location By ID
// ============================================================
export const getCustomerLocationByID = createAsyncThunk<
  CustomerLocation,
  { locationID: string | number },
  { rejectValue: string }
>(
  "customerLocation/getCustomerLocationByID",
  async (
    { locationID },
    { rejectWithValue }
  ) => {
    try {
      console.log(
        "Getting location by ID:",
        {
          LocationID: locationID,
        }
      );

      const response = await axios.get(
        `${API_BASE_URL}/Location/${locationID}`,
        {
          headers: {
            accept: "application/json, text/plain, */*",
          },
        }
      );

      console.log(
        "GetLocationByID Response:",
        response.data
      );

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Location could not be retrieved."
        );
      }

      const loc = response.data?.data;
      if (!loc) {
        return rejectWithValue("Location not found.");
      }

      const location: CustomerLocation = {
        key: String(loc.locationId || loc.locationID || `temp-${Date.now()}`),
        locationID: loc.locationId || loc.locationID,

        locationName: loc.locationName ?? "",

        isActive: loc.isActive ?? false,

        address1: loc.address1 ?? "",

        address2: loc.address2 ?? "",

        country: loc.country ?? "",

        state: loc.state ?? "",

        city: loc.city ?? "",

        postal: loc.postal ?? "",

        contactName: loc.contactName ?? "",

        phone: loc.phone ?? "",

        email: loc.email ?? "",

        activateDate: loc.activateDate ?? "",

        deactivateDate: loc.deactivateDate ?? "",

        group: loc.group ?? "STANDARD",

        locationType: (loc.locationType as LocationType) ?? "All",
      };

      console.log(
        "Mapped Location:",
        location
      );

      return location;
    } catch (error: any) {
      console.error(
        "GetLocationByID API Error:",
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
          "Failed to retrieve location."
      );
    }
  }
);

// ============================================================
// Customer Location Slice
// ============================================================
const customerLocationSlice = createSlice({
  name: "customerLocation",

  initialState,

  reducers: {
    clearLocations: (state) => {
      state.locations = [];
      state.error = null;
    },

    clearLocationError: (state) => {
      state.error = null;
    },

    setLocations: (
      state,
      action: PayloadAction<CustomerLocation[]>
    ) => {
      state.locations = action.payload;
    },
  },

  extraReducers: (builder) => {
    // ========================================================
    // GET ALL LOCATIONS
    // ========================================================
    builder.addCase(
      getAllCustomerLocations.pending,
      (state) => {
        state.loading = true;
        state.error = null;
      }
    );

    builder.addCase(
      getAllCustomerLocations.fulfilled,
      (state, action) => {
        state.loading = false;

        // IMPORTANT
        // Replace existing table data
        state.locations = action.payload;

        state.error = null;
      }
    );

    builder.addCase(
      getAllCustomerLocations.rejected,
      (state, action) => {
        state.loading = false;

        state.error =
          action.payload ||
          action.error.message ||
          "Failed to retrieve locations.";
      }
    );

    // ========================================================
    // GET LOCATION BY ID
    // ========================================================
    builder.addCase(
      getCustomerLocationByID.pending,
      (state) => {
        state.loading = true;
        state.error = null;
      }
    );

    builder.addCase(
      getCustomerLocationByID.fulfilled,
      (state, action) => {
        state.loading = false;

        const index = state.locations.findIndex(
          (l) => l.key === action.payload.key
        );
        if (index !== -1) {
          state.locations[index] = action.payload;
        } else {
          state.locations.push(action.payload);
        }

        state.error = null;
      }
    );

    builder.addCase(
      getCustomerLocationByID.rejected,
      (state, action) => {
        state.loading = false;

        state.error =
          action.payload ||
          action.error.message ||
          "Failed to retrieve location.";
      }
    );

    // ========================================================
    // SAVE LOCATION
    // ========================================================
    builder.addCase(saveCustomerLocation.pending, (state) => {
      state.saving = true;
      state.error = null;
    });
    builder.addCase(saveCustomerLocation.fulfilled, (state) => {
      state.saving = false;
      state.error = null;
    });
    builder.addCase(saveCustomerLocation.rejected, (state, action) => {
      state.saving = false;
      state.error =
        (action.payload as string) ||
        action.error.message ||
        "Failed to save location.";
    });
  },
});

// ============================================================
// Actions
// ============================================================
export const {
  clearLocations,
  clearLocationError,
  setLocations,
} = customerLocationSlice.actions;

// ============================================================
// Reducer
// ============================================================
export default customerLocationSlice.reducer;

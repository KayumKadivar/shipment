import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL } from "../config/apiConfig";
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
export const saveCustomerLocation = createAsyncThunk(
  "customerLocation/saveCustomerLocation",
  async (
    payloadData: Omit<CustomerLocation, "key"> & { clientID?: string },
    { rejectWithValue }
  ) => {
    try {
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
        accessorialsList: (payloadData.accessorials || []).map((acc, index) => ({
          accessorialsID: index,
          accessorialsName: acc
        }))
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
// Get All Locations
// ============================================================
export const getAllCustomerLocations = createAsyncThunk<
  CustomerLocation[],
  string | number | undefined,
  { rejectValue: string }
>(
  "customerLocation/getAllCustomerLocations",
  async (clientID, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/CustomerLocation/GetAllLocation`,
        {
          params: {
            ClientID: String(clientID || "1"),
          },
          headers: {
            "Content-Type": "application/json",
            accept: "application/json, text/plain, */*",
          },
        }
      );

      console.log("GetAllLocation Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Locations could not be retrieved."
        );
      }

      const locations: CustomerLocation[] = (
        response.data?.data || []
      ).map((loc: any) => ({
        key: String(loc.locationID || `temp-${Date.now()}`),
        locationID: loc.locationID,

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
      }));

      return locations;
    } catch (error: any) {
      console.error(
        "GetAllLocation API Error:",
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
        `${API_BASE_URL}/CustomerLocation/GetLocationByID`,
        {
          params: {
            LocationID: locationID,
          },
          headers: {
            accept: "text/plain",
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
        key: String(loc.locationID || `temp-${Date.now()}`),
        locationID: loc.locationID,

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

import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL } from "../config/apiConfig";
import type { CustomerLocation, LocationType } from "../pages/customerLocationData";

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
// Get All Locations
// ============================================================
export const getAllCustomerLocations = createAsyncThunk<
  CustomerLocation[],
  number,
  { rejectValue: string }
>(
  "customerLocation/getAllCustomerLocations",
  async (clientID, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/CustomerLocation/GetAllLocation`,
        {
          params: {
            ClientID: clientID || 1,
          },
          headers: {
            accept: "text/plain",
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
        key: `loc-${loc.locationID}`,

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
        key: `loc-${loc.locationID}`,

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

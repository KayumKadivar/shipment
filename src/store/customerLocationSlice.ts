import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

import { API_BASE_URL, DEFAULT_CLIENT_CODE, SRV_TOKEN } from "../config/apiConfig";
import type { CustomerLocation, LocationType } from "../types/customerLocation.types";
import { getApiErrorMessage } from "../utils/getApiErrorMessage";

type ApiResponse<T> = {
  isSuccess: boolean;
  message?: string | null;
  data?: T | null;
  totalCount?: number;
  totalRecords?: number;
};

export type ClientOption = {
  clientCode: string;
  clientName: string;
  profileCode?: string;
  ratingClientCode?: string | null;
  ratingProfileCode?: string | null;
  isCorporate?: boolean;
  isLoggedClient?: boolean;
};

type ClientApiItem = {
  clientName?: string;
  clientCode?: string;
  profileCode?: string;
  ratingClientCode?: string | null;
  ratingProfileCode?: string | null;
  isCorporate?: boolean;
  isLoggedClient?: boolean;
  profiles?: ClientApiItem[];
  subClients?: ClientApiItem[];
};

type ClientLookupApiResponse =
  | ClientApiItem[]
  | ApiResponse<ClientApiItem[] | ClientApiItem>;

type LocationApiItem = {
  locationId?: number;
  locationID?: number;
  locationName?: string;
  isActive?: boolean;
  address1?: string;
  address2?: string;
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
  postal?: string;
  zipCode?: string;
  clientCode?: string;
  contactName?: string;
  contactPerson?: string;
  contactPhone?: string;
  phone?: string;
  phoneNumber?: string;
  contactEmail?: string;
  email?: string;
  emailAddress?: string;
  activateDate?: string;
  deactivateDate?: string;
  createdBy?: string;
  createdDate?: string;
  modifiedBy?: string;
  modifiedDate?: string;
  group?: string;
  locationType?: LocationType;
};

type PagedLocationApiData = {
  items: LocationApiItem[];
  totalCount?: number;
  totalRecords?: number;
};

type LocationListApiResponse = ApiResponse<
  LocationApiItem[] | PagedLocationApiData
>;

interface CustomerLocationState {
  locations: CustomerLocation[];
  clients: ClientOption[];
  totalCount: number;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: CustomerLocationState = {
  locations: [],
  clients: [],
  totalCount: 0,
  loading: false,
  saving: false,
  error: null,
};

// ============================================================
// Fetch Clients and Subclients (GET API)
// ============================================================
export const fetchClientsAndSubclients = createAsyncThunk<
  ClientOption[],
  string | void,
  { rejectValue: string }
>(
  "customerLocation/fetchClientsAndSubclients",
  async (clientCode, { rejectWithValue }) => {
    try {
      const codeToUse = clientCode || DEFAULT_CLIENT_CODE;
      let response;
      try {
        response = await axios.get<ClientLookupApiResponse>(
          `${API_BASE_URL}/GetClientAndSubclientWithProfiles/GetClientAndSubclientWithProfilesByClientCode`,
          {
            params: {
              srvToken: SRV_TOKEN,
              clientCode: codeToUse,
            },
          },
        );
      } catch {
        response = await axios.get<ClientLookupApiResponse>(
          `${API_BASE_URL}/GetClientAndSubclientWithProfiles`,
          {
            params: {
              srvToken: SRV_TOKEN,
              clientCode: codeToUse,
            },
          },
        );
      }
      
      const resData = response.data;
      if (Array.isArray(resData)) {
        return resData.map((c) => ({
          clientCode: c.clientCode || c.profileCode || "",
          clientName: c.clientName || c.profileCode || c.clientCode || "",
          profileCode: c.profileCode || "",
          ratingClientCode: c.ratingClientCode ?? null,
          ratingProfileCode: c.ratingProfileCode ?? null,
          isCorporate: c.isCorporate,
          isLoggedClient: c.isLoggedClient,
        }));
      }

      if (resData && typeof resData === "object" && "data" in resData && Array.isArray(resData.data)) {
        return resData.data.map((c) => ({
          clientCode: c.clientCode || c.profileCode || "",
          clientName: c.clientName || c.profileCode || c.clientCode || "",
          profileCode: c.profileCode || "",
          ratingClientCode: c.ratingClientCode ?? null,
          ratingProfileCode: c.ratingProfileCode ?? null,
          isCorporate: c.isCorporate,
          isLoggedClient: c.isLoggedClient,
        }));
      }

      if (!resData || (typeof resData === "object" && "isSuccess" in resData && !resData.isSuccess)) {
        return rejectWithValue("Failed to fetch clients.");
      }

      if (resData && typeof resData === "object" && "data" in resData && resData.data) {
        const d = resData.data as any;
        const mainClient: ClientOption = {
          clientCode: d.clientCode || d.profileCode || "",
          clientName: d.clientName || d.profileCode || "",
          profileCode: d.profileCode || "",
          isCorporate: d.isCorporate,
          isLoggedClient: true,
        };
        const subClients: ClientOption[] = (d.subClients || d.profiles || []).map((s: any) => ({
          clientCode: s.clientCode || s.profileCode || "",
          clientName: s.clientName || s.profileCode || "",
          profileCode: s.profileCode || "",
          isCorporate: s.isCorporate,
          isLoggedClient: false,
        }));
        return [mainClient, ...subClients];
      }

      return rejectWithValue("Failed to fetch clients.");
    } catch (error: unknown) {
      console.error("FetchClients API Error:", error);
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch clients.")
      );
    }
  }
);

// ============================================================
// Add Location (POST API)
// ============================================================
// import type { RootState } from "../app/store";

export const saveCustomerLocation = createAsyncThunk(
  "customerLocation/saveCustomerLocation",
  async (
    payloadData: Omit<CustomerLocation, "key"> & { clientID?: string },
    { rejectWithValue }
    // { rejectWithValue, getState }
  ) => {
    try {
      // const state = getState() as RootState;
      // const allAccessorials = state.accessorials.data;

      const payload = {
        locationId: 0,
        locationName: payloadData.locationName || "",
        address1: payloadData.address1 || "",
        address2: payloadData.address2 || "",
        city: payloadData.city || "",
        stateCode: payloadData.stateCode || payloadData.state || "",
        countryCode: payloadData.countryCode || payloadData.country || "",
        zipCode: payloadData.zipCode || payloadData.postal || "",
        clientCode: (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("customerLocation_selectedClientCode") : null) || DEFAULT_CLIENT_CODE,
        contactName: payloadData.contactName || "",
        contactPhone: payloadData.phone || "",
        contactEmail: payloadData.email || "",
        openTime: payloadData.openTime && payloadData.openTime.trim() !== "" ? payloadData.openTime.trim() : null,
        closeTime: payloadData.closeTime && payloadData.closeTime.trim() !== "" ? payloadData.closeTime.trim() : null,
        isActive: payloadData.isActive ?? true
      };

      const response = await axios.post<ApiResponse<unknown>>(
        `${API_BASE_URL}/Location`,
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
    } catch (error: unknown) {
      console.error("AddLocation API Error:", error);
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to save location.")
      );
    }
  }
);

// ============================================================
// Update Location (POST API)
// ============================================================
export const updateCustomerLocation = createAsyncThunk(
  "customerLocation/updateCustomerLocation",
  async (
    payloadData: Omit<Partial<CustomerLocation>, "locationId"> & {
      locationId: string | number;
    },
    { rejectWithValue }
  ) => {
    try {
      const payload = {
        locationId: payloadData.locationId,
        locationName: payloadData.locationName || "",
        address1: payloadData.address1 || "",
        address2: payloadData.address2 || "",
        city: payloadData.city || "",
        stateCode: payloadData.stateCode || payloadData.state || "",
        countryCode: payloadData.countryCode || payloadData.country || "",
        zipCode: payloadData.zipCode || payloadData.postal || "",
        clientCode: (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("customerLocation_selectedClientCode") : null) || DEFAULT_CLIENT_CODE,
        contactName: payloadData.contactName || "",
        contactPhone: payloadData.phone || (payloadData as any).contactPhone || "",
        contactEmail: payloadData.email || (payloadData as any).contactEmail || "",
        isActive: payloadData.isActive ?? true,
        createdBy: "",
        createdDate: new Date().toISOString(),
        modifiedBy: "",
        modifiedDate: new Date().toISOString()
      };

      const response = await axios.put<ApiResponse<unknown>>(
        `${API_BASE_URL}/Location`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("UpdateLocation Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message || "Failed to update location."
        );
      }

      return payloadData;
    } catch (error: unknown) {
      console.error("UpdateLocation API Error:", error);
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to update location.")
      );
    }
  }
);

// ============================================================
// Delete Multiple Locations (DELETE API)
// ============================================================
export const deleteCustomerLocations = createAsyncThunk<
  number[],
  number[],
  { rejectValue: string }
>(
  "customerLocation/deleteCustomerLocations",
  async (locationIds: number[], { rejectWithValue }) => {
    try {
      const response = await axios.delete<ApiResponse<unknown>>(
        `${API_BASE_URL}/Location/DeleteMultiple`,
        {
          data: locationIds, // Axios DELETE requests send body in 'data'
          headers: {
            "Content-Type": "application/json",
            accept: "text/plain",
          },
        }
      );

      console.log("DeleteMultiple Response:", response.data);

      if (!response.data?.isSuccess && response.data?.message) {
         return rejectWithValue(response.data?.message || "Failed to delete locations.");
      }

      return locationIds;
    } catch (error: unknown) {
      console.error("DeleteMultiple API Error:", error);
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to delete locations.")
      );
    }
  }
);

// ============================================================
// Get All Locations (GET /api/Location/GetLocationsByClientCode/{clientCode})
// ============================================================
export interface GetLocationsParams {
  clientCode?: string;
  searchText?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const getAllCustomerLocations = createAsyncThunk<
  { locations: CustomerLocation[], totalCount: number },
  GetLocationsParams | string | number | undefined,
  { rejectValue: string }
>(
  "customerLocation/getAllCustomerLocations",
  async (params, { rejectWithValue }) => {
    try {
      let clientCode = DEFAULT_CLIENT_CODE;
      let searchText = "";
      let pageNumber = 1;
      let pageSize = 10;

      if (typeof params === "object" && params !== null) {
        if (params.clientCode) clientCode = params.clientCode;
        if (params.searchText !== undefined) searchText = params.searchText;
        if (params.pageNumber !== undefined) pageNumber = params.pageNumber;
        if (params.pageSize !== undefined) pageSize = params.pageSize;
      } else if (typeof params === "string" && isNaN(Number(params))) {
        clientCode = params;
      }

      const token = localStorage.getItem("authToken");

      let response;

      if (searchText && searchText.trim() !== "") {
        const payload = {
          clientCode,
          searchText,
          pageNumber,
          pageSize
        };

        response = await axios.post<LocationListApiResponse>(
          `${API_BASE_URL}/Location/SearchLocations`,
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              accept: "application/json, text/plain, */*",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          }
        );
      } else {
        response = await axios.get<LocationListApiResponse>(
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
      }

      console.log("GetLocationsByClientCode Response:", response.data);

      if (!response.data?.isSuccess) {
        return rejectWithValue(
          response.data?.message ||
            "Locations could not be retrieved."
        );
      }

      const responseData = response.data?.data || [];
      let rawData: LocationApiItem[] = [];
      let totalCount = 0;
      
      if (Array.isArray(responseData)) {
        rawData = responseData;
        totalCount = response.data?.totalCount || response.data?.totalRecords || responseData.length;
      } else {
        rawData = responseData.items;
        totalCount = responseData.totalCount || responseData.totalRecords || responseData.items.length;
      }

      const locations: CustomerLocation[] = rawData.map((loc) => {
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
          contactName: loc.contactName ?? loc.contactPerson ?? loc.createdBy ?? "",
          phone: loc.contactPhone ?? loc.phone ?? loc.phoneNumber ?? "",
          email: loc.contactEmail ?? loc.email ?? loc.emailAddress ?? "",
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

      return { locations, totalCount };
    } catch (error: unknown) {
      console.error(
        "GetLocationsByClientCode API Error:",
        error
      );

      return rejectWithValue(
        getApiErrorMessage(error, "Failed to retrieve locations.")
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

      const response = await axios.get<ApiResponse<LocationApiItem>>(
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

        country: loc.countryCode ?? loc.country ?? "",

        state: loc.stateCode ?? loc.state ?? "",

        city: loc.city ?? "",

        postal: loc.zipCode ?? loc.postal ?? "",

        contactName: loc.contactName ?? loc.contactPerson ?? "",

        phone: loc.contactPhone ?? loc.phone ?? loc.phoneNumber ?? "",

        email: loc.contactEmail ?? loc.email ?? loc.emailAddress ?? "",

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
    } catch (error: unknown) {
      console.error(
        "GetLocationByID API Error:",
        error
      );

      if (axios.isAxiosError(error) && error.response) {
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
        getApiErrorMessage(error, "Failed to retrieve location.")
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
      state.totalCount = 0;
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

        
        state.locations = action.payload.locations;
        state.totalCount = action.payload.totalCount;

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

    // ========================================================
    // FETCH CLIENTS
    // ========================================================
    builder.addCase(fetchClientsAndSubclients.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchClientsAndSubclients.fulfilled, (state, action) => {
      state.loading = false;
      state.clients = action.payload;
      state.error = null;
    });
    builder.addCase(fetchClientsAndSubclients.rejected, (state, action) => {
      state.loading = false;
      state.error =
        (action.payload as string) ||
        action.error.message ||
        "Failed to fetch clients.";
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

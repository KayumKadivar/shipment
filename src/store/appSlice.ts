import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import type { AppState, Country, LoginResponse } from "../types/auth.types";

type ApiErrorResponse = {
  message?: unknown;
  title?: unknown;
  errors?: Record<string, unknown>;
};

type CountriesApiResponse = {
  isSuccess: boolean;
  data?: Country[] | null;
};

const publicApiClient = axios.create();

function toErrorText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();

  if (Array.isArray(value)) {
    const messages = value
      .map(toErrorText)
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" ") : null;
  }

  return null;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<ApiErrorResponse | string>(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  const responseData = error.response?.data;
  const responseText = toErrorText(responseData);
  if (responseText) return responseText;

  if (responseData && typeof responseData === "object") {
    const message = toErrorText(responseData.message);
    if (message) return message;

    const validationMessages = responseData.errors
      ? Object.values(responseData.errors)
          .map(toErrorText)
          .filter((item): item is string => Boolean(item))
      : [];
    if (validationMessages.length) return validationMessages.join(" ");

    const title = toErrorText(responseData.title);
    if (title) return title;
  }

  return error.message || fallback;
}

const storedToken = typeof localStorage !== "undefined" ? localStorage.getItem("authToken") : null;
const storedUsername = typeof localStorage !== "undefined" ? localStorage.getItem("username") : null;
const storedProfileCode = typeof localStorage !== "undefined" ? localStorage.getItem("profileCode") : null;
const storedIsCorporate = typeof localStorage !== "undefined" ? localStorage.getItem("isCorporate") : null;
const storedClientCode = typeof localStorage !== "undefined" ? localStorage.getItem("clientCode") : null;
const storedClientName = typeof localStorage !== "undefined" ? localStorage.getItem("clientName") : null;
const storedRatingClientCode = typeof localStorage !== "undefined" ? localStorage.getItem("ratingClientCode") : null;
const storedRatingProfileCode = typeof localStorage !== "undefined" ? localStorage.getItem("ratingProfileCode") : null;

const initialState: AppState = {
  isAuthenticated: Boolean(storedToken),
  token: storedToken || null,
  username: storedUsername || null,
  countries: [],
  profileCode: storedProfileCode || null,
  isCorporate: storedIsCorporate !== null ? storedIsCorporate === "true" : null,
  clientCode: storedClientCode || null,
  clientName: storedClientName || null,
  ratingClientCode: storedRatingClientCode || null,
  ratingProfileCode: storedRatingProfileCode || null,
  loading: false,
  error: null,
};

export const fetchCountries = createAsyncThunk<
  Country[],
  void,
  { rejectValue: string }
>(
  "app/fetchCountries",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get<CountriesApiResponse>(
        `${API_BASE_URL}/Countries`,
      );
      if (response.data && response.data.isSuccess) {
        return response.data.data ?? [];
      }
      return rejectWithValue("Failed to fetch countries");
    } catch (error: unknown) {
      return rejectWithValue(
        getApiErrorMessage(error, "Failed to fetch countries"),
      );
    }
  }
);

export const loginUser = createAsyncThunk<
  {
    token: string;
    username: string;
    profileCode: string | null;
    isCorporate?: boolean | null;
    clientCode?: string | null;
    clientName?: string | null;
    ratingClientCode?: string | null;
    ratingProfileCode?: string | null;
  },
  { username: string; password: string },
  { rejectValue: string }
>("app/loginUser", async ({ username, password }, { rejectWithValue }) => {
  try {
    const response = await publicApiClient.post<LoginResponse>(
      `${API_BASE_URL}/Login`,
      {
        username: username.trim(),
        password,
        srvToken: SRV_TOKEN,
      },
      {
        headers: {
          "Content-Type": "application/json",
          accept: "*/*",
        },
      }
    );

    if (response.data?.isSuccess && response.data.data) {
      const token = response.data.data;
      localStorage.setItem("authToken", token);
      localStorage.setItem("username", username.trim());
      let profileCode: string | null = null;
      let isCorporate: boolean | null = null;
      let clientCode: string | null = null;
      let clientName: string | null = null;
      let ratingClientCode: string | null = null;
      let ratingProfileCode: string | null = null;
      
      // Call GetClientAndSubclientWithProfiles API
      try {
        const clientRes = await axios.get(
          `${API_BASE_URL}/GetClientAndSubclientWithProfiles?srvToken=${SRV_TOKEN}`,
          {
            headers: {
              accept: "*/*",
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (clientRes.data?.data) {
          const rawData = clientRes.data.data;
          const list = Array.isArray(rawData)
            ? rawData
            : Array.isArray(rawData.clientAndProfileDetails)
              ? rawData.clientAndProfileDetails
              : Array.isArray(rawData.ClientAndProfileDetails)
                ? rawData.ClientAndProfileDetails
                : null;

          if (Array.isArray(list)) {
            const isItemLogged = (c: any) =>
              c.isLoggedClient === true ||
              c.IsLoggedClient === true ||
              c.isLoggedClient === 1 ||
              c.IsLoggedClient === 1 ||
              String(c.isLoggedClient).toLowerCase() === "true" ||
              String(c.IsLoggedClient).toLowerCase() === "true";

            const userLower = username.trim().toLowerCase();
            const matchByUser = list.find(
              (c: any) =>
                c.clientCode?.toLowerCase() === userLower ||
                c.profileCode?.toLowerCase() === userLower ||
                c.clientName?.toLowerCase() === userLower
            );

            const matchByDev = userLower.includes("dev")
              ? list.find(
                  (c: any) =>
                    c.clientCode?.toUpperCase() === "DEVTS" ||
                    c.profileCode?.toUpperCase() === "DEVTS"
                )
              : null;

            const logged = matchByUser || matchByDev || list.find(isItemLogged) || list[0];
            if (logged) {
              profileCode = logged.profileCode || null;
              isCorporate = typeof logged.isCorporate === "boolean" ? logged.isCorporate : null;
              clientCode = logged.clientCode || null;
              clientName = logged.clientName || null;
              ratingClientCode = logged.ratingClientCode ?? null;
              ratingProfileCode = logged.ratingProfileCode ?? null;

              if (profileCode) localStorage.setItem("profileCode", profileCode);
              if (isCorporate !== null) localStorage.setItem("isCorporate", String(isCorporate));
              if (clientCode) localStorage.setItem("clientCode", clientCode);
              if (clientName) localStorage.setItem("clientName", clientName);
              if (ratingClientCode) localStorage.setItem("ratingClientCode", ratingClientCode);
              if (ratingProfileCode) localStorage.setItem("ratingProfileCode", ratingProfileCode);
            }
          } else {
            // Fallback for legacy object format
            if (clientRes.data.data.profiles?.length > 0) {
              profileCode = clientRes.data.data.profiles[0].profileCode;
              localStorage.setItem("profileCode", profileCode as string);
            }
            if (typeof clientRes.data.data.isCorporate === "boolean") {
              isCorporate = clientRes.data.data.isCorporate;
              localStorage.setItem("isCorporate", String(isCorporate));
            }
          }
        }
      } catch {
        // A profile is optional for authentication; protected screens can still load.
      }

      return {
        token,
        username: username.trim(),
        profileCode,
        isCorporate,
        clientCode,
        clientName,
        ratingClientCode,
        ratingProfileCode,
      };
    }

    return rejectWithValue(
      response.data?.message || "Invalid username or password. Please try again."
    );
  } catch (error: unknown) {
    return rejectWithValue(
      getApiErrorMessage(
        error,
        "Unable to connect to the login server. Please verify the server is running.",
      ),
    );
  }
});

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    login(
      state,
      action: PayloadAction<
        {
          token?: string;
          username?: string;
          isCorporate?: boolean;
          profileCode?: string;
          clientCode?: string;
          clientName?: string;
          ratingClientCode?: string;
          ratingProfileCode?: string;
        } | undefined
      >
    ) {
      state.isAuthenticated = true;
      if (action.payload) {
        if (action.payload.token) {
          state.token = action.payload.token;
          localStorage.setItem("authToken", action.payload.token);
        }
        if (action.payload.username) {
          state.username = action.payload.username;
          localStorage.setItem("username", action.payload.username);
        }
        if (typeof action.payload.isCorporate === "boolean") {
          state.isCorporate = action.payload.isCorporate;
          localStorage.setItem("isCorporate", String(action.payload.isCorporate));
        }
        if (action.payload.profileCode) {
          state.profileCode = action.payload.profileCode;
          localStorage.setItem("profileCode", action.payload.profileCode);
        }
        if (action.payload.clientCode) {
          state.clientCode = action.payload.clientCode;
          localStorage.setItem("clientCode", action.payload.clientCode);
        }
        if (action.payload.clientName) {
          state.clientName = action.payload.clientName;
          localStorage.setItem("clientName", action.payload.clientName);
        }
        if (action.payload.ratingClientCode) {
          state.ratingClientCode = action.payload.ratingClientCode;
          localStorage.setItem("ratingClientCode", action.payload.ratingClientCode);
        }
        if (action.payload.ratingProfileCode) {
          state.ratingProfileCode = action.payload.ratingProfileCode;
          localStorage.setItem("ratingProfileCode", action.payload.ratingProfileCode);
        }
      }
    },
    logout(state) {
      state.isAuthenticated = false;
      state.token = null;
      state.username = null;
      state.profileCode = null;
      state.isCorporate = null;
      state.clientCode = null;
      state.clientName = null;
      state.ratingClientCode = null;
      state.ratingProfileCode = null;
      state.error = null;
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        console.error("Storage clear error in logout reducer:", e);
      }
    },
    clearLoginError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.token = action.payload.token;
        state.username = action.payload.username;
        state.profileCode = action.payload.profileCode;
        state.isCorporate = action.payload.isCorporate ?? null;
        state.clientCode = action.payload.clientCode ?? null;
        state.clientName = action.payload.clientName ?? null;
        state.ratingClientCode = action.payload.ratingClientCode ?? null;
        state.ratingProfileCode = action.payload.ratingProfileCode ?? null;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      })
      .addCase(fetchCountries.fulfilled, (state, action) => {
        state.countries = action.payload;
      });
  },
});

export const { login, logout, clearLoginError } = appSlice.actions;
export default appSlice.reducer;

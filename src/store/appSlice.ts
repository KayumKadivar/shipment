import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";
import { API_BASE_URL, SRV_TOKEN } from "../config/apiConfig";
import type { AppState, LoginResponse } from "../types/auth.types";

const savedToken = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
const savedUsername = typeof window !== "undefined" ? localStorage.getItem("username") : null;

const initialState: AppState = {
  isAuthenticated: Boolean(savedToken),
  token: savedToken,
  username: savedUsername,
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk<
  { token: string; username: string },
  { username: string; password: string },
  { rejectValue: string }
>("app/loginUser", async ({ username, password }, { rejectWithValue }) => {
  try {
    const response = await axios.post<LoginResponse>(
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

    console.log("Login API Response:", response.data);

    if (response.data && response.data.isSuccess) {
      const token = response.data.data;
      localStorage.setItem("authToken", token);
      localStorage.setItem("username", username.trim());
      return { token, username: username.trim() };
    }

    return rejectWithValue(
      response.data?.message || "Invalid username or password. Please try again."
    );
  } catch (error: any) {
    console.error("Login API Error:", error);
    const errorMessage =
      error?.response?.data?.message ||
      error?.response?.data?.title ||
      error?.message ||
      "Unable to connect to the login server. Please verify the server is running.";
    return rejectWithValue(errorMessage);
  }
});

const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    login(
      state,
      action: PayloadAction<{ token?: string; username?: string } | void>
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
      }
    },
    logout(state) {
      state.isAuthenticated = false;
      state.token = null;
      state.username = null;
      state.error = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("username");
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
        state.token = action.payload.token;
        state.username = action.payload.username;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login failed";
      });
  },
});

export const { login, logout, clearLoginError } = appSlice.actions;
export default appSlice.reducer;

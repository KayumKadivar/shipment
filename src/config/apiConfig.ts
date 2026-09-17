import axios from "axios";

export const API_BASE_URL = "/api";
export const SRV_TOKEN = "335D6759802A4DBEB41CD6D68AB3024D";
export const DEFAULT_CLIENT_CODE = "DEVTS";

// Automatically attach Bearer token to all outgoing axios requests if available
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken");
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

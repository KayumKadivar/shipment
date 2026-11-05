import axios from "axios";

export const API_BASE_URL = "https://nico-api.nicedesert-4da8ecd2.centralus.azurecontainerapps.io/api";
export const SRV_TOKEN = "335D6759802A4DBEB41CD6D68AB3024D";

/** Identifier of the installed interceptor, allowing safe reconfiguration. */
let authenticationInterceptor: number | undefined;

/**
 * Reads the current Redux token for each request without importing the store.
 * @param getToken Returns the current runtime token, or null when logged out.
 */
export function configureApiAuthentication(getToken: () => string | null): void {
  if (authenticationInterceptor !== undefined) {
    axios.interceptors.request.eject(authenticationInterceptor);
  }
  authenticationInterceptor = axios.interceptors.request.use(
    (config) => {
      const token = getToken();
      if (token && config.headers && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error),
  );
}

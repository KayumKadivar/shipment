export interface LoginRequest {
  username: string;
  password: string;
  srvToken: string;
}

export interface LoginResponse {
  isSuccess: boolean;
  message: string;
  data: string;
}

export interface Country {
  countryId: number;
  countryCode: string;
  countryName: string;
}

export interface AppState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  countries: Country[];
  profileCode: string | null;
  isCorporate: boolean | null;
  loading: boolean;
  error: string | null;
}

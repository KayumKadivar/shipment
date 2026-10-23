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

export interface ClientProfileItem {
  clientCode: string;
  clientName: string;
  profileCode: string;
  ratingClientCode: string | null;
  ratingProfileCode: string | null;
  isCorporate: boolean;
  isLoggedClient: boolean;
}

export interface AppState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  countries: Country[];
  profileCode: string | null;
  isCorporate: boolean | null;
  clientCode: string | null;
  clientName: string | null;
  ratingClientCode: string | null;
  ratingProfileCode: string | null;
  loading: boolean;
  error: string | null;
}

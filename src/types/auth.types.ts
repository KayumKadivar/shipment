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

export interface AppState {
  isAuthenticated: boolean;
  token: string | null;
  username: string | null;
  countries: any[];
  profileCode: string | null;
  loading: boolean;
  error: string | null;
}

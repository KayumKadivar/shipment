import axios from "axios";

type ApiErrorResponse = {
  message?: string | null;
};

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === "string" && error.trim()) return error.trim();

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return error.response?.data?.message || error.message || fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

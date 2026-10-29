import axios from "axios";

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (typeof error === "string" && error.trim()) return error.trim();

  if (axios.isAxiosError(error)) {
    const data: any = error.response?.data;
    if (typeof data === "string" && data.trim()) return data.trim();
    if (data?.message) return String(data.message);
    if (data?.errorMessage) return String(data.errorMessage);
    if (data?.errors) {
      if (Array.isArray(data.errors)) {
        const joined = data.errors.filter(Boolean).join(", ");
        if (joined) return joined;
      } else if (typeof data.errors === "object" && data.errors !== null) {
        const msgs = Object.values(data.errors).flat().filter(Boolean).join(", ");
        if (msgs) return data.title ? `${data.title}: ${msgs}` : msgs;
      }
    }
    if (data?.title) return String(data.title);
    return error.message || fallback;
  }

  return error instanceof Error && error.message ? error.message : fallback;
}

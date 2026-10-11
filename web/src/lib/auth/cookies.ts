export const TOKEN_COOKIE = "mw_access_token";
export const TOKEN_MAX_AGE = 60 * 60 * 12;

export function apiOrigin(): string {
  return process.env.API_INTERNAL_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";
}

export function cookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

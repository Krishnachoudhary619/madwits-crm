export const TOKEN_COOKIE = "mw_access_token";
export const TOKEN_MAX_AGE = 60 * 60 * 12;

export function apiOrigin(): string {
  return process.env.API_INTERNAL_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";
}

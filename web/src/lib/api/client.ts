import { ApiError } from "@/lib/errors";
import type { ApiErrorBody } from "@/types/api";

type Options = RequestInit & { skipAuthRedirect?: boolean };

export async function api<T>(path: string, init: Options = {}): Promise<T> {
  const { skipAuthRedirect, ...rest } = init;
  const url = path.startsWith("/api/") ? path : `/api/v1${path}`;
  const res = await fetch(url, {
    ...rest,
    credentials: "include",
    headers: {
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: { code: "HTTP_ERROR", message: text, details: [] } };
    }
  }

  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    const code = body?.error?.code ?? "HTTP_ERROR";
    const message = body?.error?.message ?? "Request failed.";
    if (res.status === 401 && !skipAuthRedirect && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw new ApiError(res.status, code, message, body?.error?.details ?? []);
  }

  return data as T;
}

export type QueryValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string | number | boolean>;

export function qs(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === "") continue;
        search.append(key, String(item));
      }
    } else {
      search.set(key, String(value));
    }
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

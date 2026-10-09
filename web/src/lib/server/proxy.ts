import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { apiOrigin, TOKEN_COOKIE } from "@/lib/auth/cookies";

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  options: { token?: string | null } = {},
): Promise<NextResponse> {
  const token =
    options.token === undefined
      ? (await cookies()).get(TOKEN_COOKIE)?.value
      : options.token;
  const target = new URL(backendPath, `${apiOrigin()}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
  });

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const out = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) out.set("content-type", ct);
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

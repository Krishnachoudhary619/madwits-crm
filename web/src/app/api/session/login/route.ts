import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { apiOrigin, TOKEN_COOKIE, TOKEN_MAX_AGE } from "@/lib/auth/cookies";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const login = await fetch(`${apiOrigin()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await login.text();
  if (!login.ok) {
    return new NextResponse(text || JSON.stringify({
      error: { code: "UNAUTHENTICATED", message: "Incorrect username or password.", details: [] },
    }), {
      status: login.status,
      headers: { "content-type": login.headers.get("content-type") || "application/json" },
    });
  }
  const tokenBody = JSON.parse(text) as { access_token: string };
  const me = await fetch(`${apiOrigin()}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    cache: "no-store",
  });
  const meText = await me.text();
  if (!me.ok) {
    return new NextResponse(meText, { status: me.status });
  }
  (await cookies()).set(TOKEN_COOKIE, tokenBody.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE,
  });
  return new NextResponse(meText, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

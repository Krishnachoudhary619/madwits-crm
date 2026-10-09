import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/auth/cookies";
import { proxyToBackend } from "@/lib/server/proxy";

export async function POST(request: NextRequest) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  try {
    if (token) {
      await proxyToBackend(request, "/api/v1/auth/logout", { token });
    }
  } finally {
    (await cookies()).delete(TOKEN_COOKIE);
  }
  return new NextResponse(null, { status: 204 });
}

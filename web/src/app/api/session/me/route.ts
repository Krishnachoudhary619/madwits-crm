import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/server/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/api/v1/auth/me");
}

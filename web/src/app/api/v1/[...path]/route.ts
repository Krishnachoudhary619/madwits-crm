import { NextRequest } from "next/server";
import { proxyToBackend } from "@/lib/server/proxy";

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyToBackend(request, `/api/v1/${path.join("/")}`);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;

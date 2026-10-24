import { NextResponse } from "next/server";
import { getAuthPublicConfig } from "@/lib/auth/config";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json({ config: getAuthPublicConfig(origin) });
}

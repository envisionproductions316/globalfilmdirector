import { NextResponse } from "next/server";
import { probeConnectors } from "@/lib/connectors";
// Server-only: probe uses child_process / FFmpeg detection.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Local PATH / FFmpeg detection only. Never reports cloud APIs as connected. */
export async function GET() {
  const results = await probeConnectors();
  return NextResponse.json({
    probedAt: new Date().toISOString(),
    note: "Only tools this studio build uses. FFmpeg is probed on PATH; browser, storage, and timeline are always local to this device.",
    results,
  });
}

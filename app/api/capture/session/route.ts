import { NextResponse } from "next/server";
import {
  clearPendingTake,
  createCaptureSession,
  getCaptureSession,
  getPendingTake,
  putPhoneTake,
  takePhoneMedia,
} from "@/lib/capture-sessions";

export const runtime = "nodejs";

function publicCaptureOrigin(request: Request, clientOrigin?: string) {
  const fromEnv = process.env.CAPTURE_PUBLIC_ORIGIN?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const origin = clientOrigin?.trim().replace(/\/$/, "");
  if (origin && /^https?:\/\//i.test(origin) && !/0\.0\.0\.0/i.test(origin)) return origin;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "127.0.0.1:5180";
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const cleanedHost = host.replace(/^0\.0\.0\.0(?=[:/]|$)/i, "127.0.0.1");
  return `${proto}://${cleanedHost}`;
}

export async function POST(request: Request) {
  let body: {
    projectId?: string;
    characterId?: string;
    characterName?: string;
    sceneId?: string;
    shotId?: string;
    origin?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.projectId || !body.characterId) {
    return NextResponse.json({ error: "projectId and characterId required" }, { status: 400 });
  }
  const session = createCaptureSession({
    projectId: body.projectId,
    characterId: body.characterId,
    characterName: body.characterName?.trim() || "Character",
    sceneId: body.sceneId || "",
    shotId: body.shotId || "",
  });
  const url = `${publicCaptureOrigin(request, body.origin)}/mobile-capture?s=${session.code}`;
  return NextResponse.json({ session, url });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || searchParams.get("s") || "";
  const takeId = searchParams.get("takeId") || "";
  const download = searchParams.get("download") === "1";
  const ack = searchParams.get("ack") === "1";

  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });
  const session = getCaptureSession(code);
  if (!session) return NextResponse.json({ error: "Session not found or expired." }, { status: 404 });

  if (ack && takeId) {
    clearPendingTake(code, takeId);
    return NextResponse.json({ ok: true });
  }

  if (download && takeId) {
    const media = takePhoneMedia(code, takeId);
    if (!media) return NextResponse.json({ error: "Take not found." }, { status: 404 });
    return new NextResponse(new Uint8Array(media.buffer), {
      status: 200,
      headers: {
        "Content-Type": media.mime,
        "Content-Length": String(media.buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({
    session,
    pending: getPendingTake(code),
  });
}

export async function PUT(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart/form-data required" }, { status: 400 });
  }
  const form = await request.formData();
  const code = String(form.get("code") || "");
  const file = form.get("file");
  if (!code || !(file instanceof File)) {
    return NextResponse.json({ error: "code and file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = putPhoneTake(code, {
    buffer,
    mime: file.type || "video/webm",
    durationMs: Number(form.get("durationMs") || 0),
    hasAudio: String(form.get("hasAudio") || "false") === "true",
    hasVideo: String(form.get("hasVideo") || "true") !== "false",
    name: String(form.get("name") || "Phone take"),
    dialogue: String(form.get("dialogue") || ""),
    notes: String(form.get("notes") || ""),
  });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ pending: result });
}

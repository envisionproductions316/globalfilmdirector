import { NextResponse } from "next/server";
import { cancelExport, exportFile, exportStatus, probeFfmpeg, startExport, type ExportManifest } from "@/lib/export-jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json(await probeFfmpeg());
  if (url.searchParams.get("file") === "1") {
    const file = await exportFile(id);
    if (!file) return NextResponse.json({ error: "The export is not ready." }, { status: 404 });
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Length": String(file.bytes.byteLength),
      },
    });
  }
  const status = exportStatus(id);
  if (!status) return NextResponse.json({ error: "That export was not found." }, { status: 404 });
  return NextResponse.json(status);
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id") || "";
  const status = cancelExport(id);
  if (!status) return NextResponse.json({ error: "That export was not found." }, { status: 404 });
  return NextResponse.json(status);
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The export request could not be read. Nothing was exported." }, { status: 400 });
  }
  let manifest: ExportManifest;
  try {
    manifest = JSON.parse(String(form.get("manifest") || "")) as ExportManifest;
  } catch {
    return NextResponse.json({ error: "The timeline description was not valid. Nothing was exported." }, { status: 400 });
  }
  if (!manifest || !Array.isArray(manifest.clips) || !Array.isArray(manifest.mix)) {
    return NextResponse.json({ error: "The timeline description was not valid. Nothing was exported." }, { status: 400 });
  }
  const files: { mediaId: string; bytes: Buffer }[] = [];
  for (const entry of form.getAll("file")) {
    if (!(entry instanceof File)) continue;
    const bytes = Buffer.from(await entry.arrayBuffer());
    files.push({ mediaId: entry.name, bytes });
  }
  const started = await startExport({ title: String(manifest.title || "Timeline"), clips: manifest.clips, mix: manifest.mix }, files);
  if ("error" in started && started.error) {
    return NextResponse.json({ error: started.error, notes: "notes" in started ? started.notes : [] }, { status: started.status });
  }
  return NextResponse.json({ id: started.id }, { status: 202 });
}

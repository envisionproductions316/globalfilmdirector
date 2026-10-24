"use client";

import { useState } from "react";
import { BACKUP_FORMAT, base64ToBlob, blobToBase64, scrubAuthFromStudioSnapshot, validateBackup, type StudioBackup } from "@/lib/backup";
import { base64ToUtf8, getDesktopApi, utf8ToBase64 } from "@/lib/desktop-bridge";
import { clearAllMedia, listMediaRecords, putMedia } from "@/lib/media-db";

const STORAGE_KEY = "gfd.studio.v1";

export function BackupControl() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const desktop = getDesktopApi();

  async function buildBackup(): Promise<StudioBackup> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("No studio project data is stored in this browser profile.");
    const studio = scrubAuthFromStudioSnapshot(JSON.parse(raw) as unknown);
    const records = await listMediaRecords();
    const media = [];
    for (const record of records) {
      media.push({
        id: record.id,
        projectId: record.projectId,
        takeId: record.takeId,
        mime: record.mime,
        bytes: record.bytes || record.blob.size,
        createdAt: record.createdAt,
        dataBase64: await blobToBase64(record.blob),
      });
    }
    return {
      format: BACKUP_FORMAT,
      createdAt: new Date().toISOString(),
      appVersion: "0.1.0",
      studio,
      media,
    };
  }

  async function exportBackup() {
    setBusy(true);
    setMessage("");
    try {
      const backup = await buildBackup();
      const text = JSON.stringify(backup);
      const stamp = backup.createdAt.replace(/[:.]/g, "-");
      const defaultName = `gfd-backup-${stamp}.gfdbackup.json`;

      if (desktop) {
        const save = await desktop.showSaveDialog({
          title: "Save project backup",
          defaultPath: defaultName,
          filters: [{ name: "GFD Backup", extensions: ["gfdbackup.json", "json"] }],
        });
        if (save.canceled || !save.filePath) {
          setMessage("Backup cancelled.");
          return;
        }
        const written = await desktop.writeFile({
          path: save.filePath,
          base64: utf8ToBase64(text),
        });
        if (written.error) {
          setMessage(written.error);
          return;
        }
        setMessage(`Backup saved (${backup.media.length} media file${backup.media.length === 1 ? "" : "s"}). Git does not store these recordings.`);
        return;
      }

      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = defaultName;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Backup downloaded (${backup.media.length} media file${backup.media.length === 1 ? "" : "s"}). Keep this file outside Git.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Backup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function applyBackup(backup: StudioBackup, replace: boolean) {
    if (replace) {
      await clearAllMedia();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.studio));
    for (const entry of backup.media) {
      await putMedia({
        id: entry.id,
        projectId: entry.projectId || "",
        takeId: entry.takeId || "",
        mime: entry.mime || "application/octet-stream",
        bytes: entry.bytes || 0,
        createdAt: entry.createdAt || new Date().toISOString(),
        blob: base64ToBlob(entry.dataBase64, entry.mime || "application/octet-stream"),
      });
    }
    window.location.reload();
  }

  async function importBackupFromText(text: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setMessage("That file is not valid JSON.");
      return;
    }
    const checked = validateBackup(parsed);
    if (!checked.ok) {
      setMessage(checked.error);
      return;
    }
    const confirmed = window.confirm(
      `Restore backup from ${checked.backup.createdAt}?\n\nThis replaces studio project data in this profile and restores ${checked.backup.media.length} media file(s). Continue?`,
    );
    if (!confirmed) {
      setMessage("Restore cancelled.");
      return;
    }
    await applyBackup(checked.backup, true);
  }

  async function importBackup() {
    setBusy(true);
    setMessage("");
    try {
      if (desktop) {
        const open = await desktop.showOpenDialog({
          title: "Restore project backup",
          properties: ["openFile"],
          filters: [{ name: "GFD Backup", extensions: ["gfdbackup.json", "json"] }],
        });
        if (open.canceled || !open.filePaths[0]) {
          setMessage("Restore cancelled.");
          return;
        }
        const read = await desktop.readFile(open.filePaths[0]);
        if (read.error || !read.base64) {
          setMessage(read.error || "Could not read backup file.");
          return;
        }
        const text = base64ToUtf8(read.base64);
        await importBackupFromText(text);
        return;
      }

      await new Promise<void>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,.gfdbackup.json,application/json";
        input.onchange = () => {
          const file = input.files?.[0];
          if (!file) {
            setMessage("Restore cancelled.");
            resolve();
            return;
          }
          void file.text().then((text) => importBackupFromText(text)).finally(resolve);
        };
        input.click();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="mt-4 rounded-[10px] bg-card px-5 py-4" data-testid="backup-control">
      <h2 className="m-0 text-base font-bold">Backup & restore</h2>
      <p className="mt-2 text-sm text-muted">
        Saves project records and IndexedDB recordings into a versioned <code>{BACKUP_FORMAT}</code> file. Git commits do not back up media blobs.
        {desktop ? " Desktop file dialogs are used when available." : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="h-9 rounded-[7px] bg-accent px-3 text-[13px] font-bold text-on-accent disabled:opacity-50"
          data-testid="backup-export"
          disabled={busy}
          onClick={() => void exportBackup()}
        >
          {busy ? "Working…" : "Backup projects + media"}
        </button>
        <button
          type="button"
          className="h-9 rounded-[7px] bg-inset px-3 text-[13px] disabled:opacity-50"
          data-testid="backup-restore"
          disabled={busy}
          onClick={() => void importBackup()}
        >
          Restore backup
        </button>
        {desktop ? (
          <button
            type="button"
            className="h-9 rounded-[7px] bg-inset px-3 text-[13px] disabled:opacity-50"
            data-testid="open-production-folder"
            disabled={busy}
            onClick={() => {
              void desktop.openDataDir().then((result) => {
                setMessage(result.error || "Opened the desktop production data folder (capture sessions and render temps). Project JSON and media still live in this Chromium profile.");
              });
            }}
          >
            Open production data folder
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-3 text-sm text-muted" data-testid="backup-message">
          {message}
        </p>
      ) : null}
    </article>
  );
}

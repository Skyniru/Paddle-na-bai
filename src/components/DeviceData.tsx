"use client";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { venueTime } from "@/lib/reservations";
import {
  createBackup,
  downloadBackup,
  restoreBackup,
  validateBackup,
  type Backup,
} from "@/lib/backup";
import { db } from "@/lib/db";
import { Download, Upload, ShieldCheck } from "lucide-react";

import { storageError } from "@/lib/storage";
export default function DeviceData() {
  const lastExport = useLiveQuery(() => db.safety.get("last-export"));
  const [preview, setPreview] = useState<Backup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Storage protection not requested");
  const [snapshot, setSnapshot] = useState(false);
  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then((value) =>
        setStatus(
          value
            ? "Storage protected from automatic eviction"
            : "Storage may be evicted; keep backups",
        ),
      )
      .catch(() => {});
    db.safety
      .get("before-restore")
      .then((value) => setSnapshot(!!value))
      .catch(() => {});
  }, []);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (error) {
      setMessage(storageError(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <footer className="device-data" aria-label="Device data and backups">
      <div className="device-data-copy">
        <strong>PaddleBai</strong>
        <p>Your game, saved on this device.</p>
      </div>
      <p className="device-data-last-backup">
        {lastExport
          ? "Last backup exported: " + venueTime(lastExport.createdAt)
          : "No backup exported on this device yet."}
      </p>
      <div className="data-actions">
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const saved = await downloadBackup(await createBackup());
              setMessage(
                saved
                  ? "Backup saved. Keep the file somewhere safe."
                  : "Backup export cancelled.",
              );
            })
          }
        >
          <Download size={15} aria-hidden="true" />
          Export backup
        </button>
        <label className="secondary">
          <Upload size={15} aria-hidden="true" />
          Preview restore
          <input
            aria-label="Choose backup to restore"
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              setPreview(null);
              if (file)
                void run(async () => {
                  if (file.size > 100 * 1024 * 1024)
                    throw Error("Backup exceeds the 100 MB restore limit.");
                  const backup = validateBackup(JSON.parse(await file.text()));
                  // Validate photo decoding before opening any write transaction.
                  for (const record of [...backup.players, ...backup.groups])
                    if (record.photo)
                      await new Promise<void>((resolve, reject) => {
                        const image = new Image();
                        image.onload = () =>
                          image.naturalWidth <= 8192 &&
                          image.naturalHeight <= 8192
                            ? resolve()
                            : reject(
                                Error(
                                  "Backup photo dimensions exceed 8192 pixels.",
                                ),
                              );
                        image.onerror = () =>
                          reject(Error("Backup contains an unreadable photo."));
                        image.src = record.photo!;
                      });
                  setPreview(backup);
                });
            }}
          />
        </label>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const protectedStorage = await navigator.storage?.persist?.();
              setStatus(
                protectedStorage
                  ? "Storage protected from automatic eviction"
                  : "Browser did not grant protection; keep backups",
              );
            })
          }
        >
          <ShieldCheck size={15} aria-hidden="true" />
          Protect storage
        </button>
        {snapshot && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const saved = await db.safety.get("before-restore");
                if (saved)
                  await downloadBackup(
                    validateBackup(JSON.parse(saved.payload)),
                    "paddlebai-before-restore.json",
                  );
              })
            }
          >
            Download pre-restore backup
          </button>
        )}
      </div>
      <p className="device-data-status">
        <span className="dot" aria-hidden="true" />
        {status}. Backups include player and group photos.
      </p>
      {message && (
        <p className="device-data-message" role="status">
          {message}
        </p>
      )}
      {preview && (
        <div
          className="restore-preview"
          role="region"
          aria-label="Restore preview"
        >
          <h3>Replace this device’s saved data?</h3>
          <p>
            Backup from {venueTime(Date.parse(preview.exportedAt))}:{" "}
            {preview.players.length} players, {preview.groups.length} groups,{" "}
            {preview.sessions.length} sessions, {preview.courts.length} courts,{" "}
            {preview.matches.length} matches.{" "}
            {preview.players.filter((p) => p.photo).length +
              preview.groups.filter((g) => g.photo).length}{" "}
            photos.
          </p>
          <p>
            This replaces all current records. A pre-restore copy is retained on
            this device. Export a separate copy first for device-loss
            protection. Finish any live session before restoring.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await restoreBackup(preview);
                setPreview(null);
                setSnapshot(true);
                setMessage(
                  "Restore complete. Previous data is available as a pre-restore backup.",
                );
              })
            }
          >
            Confirm replacement
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setPreview(null)}
          >
            Cancel restore
          </button>
        </div>
      )}
    </footer>
  );
}

"use client";
import { storageError } from "@/lib/storage";
import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import GroupAvatar from "./GroupAvatar";
import { readGroupPhoto } from "@/lib/photos";
import type { Player, PlayerGroup } from "@/types";
import { db, saveGroup } from "@/lib/db";
import PlayerPicker from "./PlayerPicker";

export default function GroupManager({
  players,
  groups,
  onEditingChange,
}: {
  players: Player[];
  groups: PlayerGroup[];
  onEditingChange?: (editing: boolean) => void;
}) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await saveGroup(name, selected, editing || undefined, photo);
      setEditing(null);
      setDeleteId(null);
      onEditingChange?.(false);
      setNotice("Group saved. Choose it when setting up a session.");
    } catch (e) {
      setError(storageError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="groups-section" aria-label="Saved player groups">
      <div className="section-heading">
        <div>
          <h2>
            Your groups <span className="count">{groups.length}</span>
          </h2>
          <p>Your regular players, ready for the next game.</p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={busy || photoBusy || playerBusy}
          onClick={() => {
            setEditing("");
            setDeleteId(null);
            onEditingChange?.(true);
            setName("");
            setPhoto(null);
            setSelected([]);
            setError("");
            setNotice("");
          }}
        >
          Create group
        </button>
      </div>
      {notice && (
        <p role="status" className="alert success">
          {notice}
        </p>
      )}
      {editing !== null ? (
        <form className="group-editor" onSubmit={save}>
          <div className="group-editor-heading">
            <h3>{editing ? "Edit group" : "Create a player group"}</h3>
            <button
              type="button"
              className="icon-button"
              aria-label="Close group editor"
              disabled={busy || playerBusy || photoBusy}
              onClick={() => {
                setEditing(null);
                setDeleteId(null);
                onEditingChange?.(false);
              }}
            >
              <X size={20} />
            </button>
          </div>
          <p className="muted">
            Give your group a name, then add your players.
          </p>
          <label>
            Group name
            <input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Padel Club"
            />
          </label>
          <div className="group-photo-field">
            <GroupAvatar group={{ name, photo: photo ?? undefined }} />
            <label>
              Group photo or logo (optional)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy || photoBusy || playerBusy}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoBusy(true);
                  setError("");
                  try {
                    setPhoto(await readGroupPhoto(file));
                  } catch (error) {
                    setError(
                      error instanceof Error
                        ? error.message
                        : "Could not load photo.",
                    );
                  } finally {
                    setPhotoBusy(false);
                    e.target.value = "";
                  }
                }}
              />
              <small>JPG, PNG, or WebP, up to 2 MB.</small>
            </label>
            {photo && (
              <button
                type="button"
                className="text-button"
                disabled={photoBusy || busy}
                onClick={() => setPhoto(null)}
              >
                Remove photo
              </button>
            )}
          </div>
          <div className="editor-divider">
            <h3>Group members</h3>
          </div>
          <PlayerPicker
            players={players}
            groups={[]}
            selected={selected}
            onChange={setSelected}
            onPendingChange={setPlayerBusy}
            disabled={busy || photoBusy}
          />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="two-buttons">
            <button
              type="button"
              className="secondary"
              disabled={busy || photoBusy || playerBusy}
              onClick={() => {
                setEditing(null);
                setDeleteId(null);
                onEditingChange?.(false);
              }}
            >
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || photoBusy || playerBusy}
            >
              Save group
            </button>
          </div>
          {editing && (
            <>
              <button
                type="button"
                className="text-button"
                disabled={busy || photoBusy || playerBusy}
                onClick={() => setDeleteId(editing)}
              >
                Delete group (keep players)
              </button>
              {deleteId === editing && (
                <div
                  className="alert"
                  role="region"
                  aria-label="Delete group confirmation"
                >
                  <p>
                    Delete this saved group? Your players, photos on player
                    records, and match results will stay.
                  </p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setDeleteId(null)}
                  >
                    Keep group
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || photoBusy || playerBusy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await db.groups.delete(editing);
                        setDeleteId(null);
                        setEditing(null);
                        setDeleteId(null);
                        onEditingChange?.(false);
                        setNotice(
                          "Group removed. Your players and match results are still saved.",
                        );
                      } catch {
                        setError("Could not remove the group. Try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm group deletion
                  </button>
                </div>
              )}
            </>
          )}
        </form>
      ) : (
        <>
          {groups.length > 4 && (
            <label className="group-search">
              Search groups
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by group name"
              />
            </label>
          )}
          <div className="group-grid">
            {groups
              .filter((g) =>
                g.name
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
              )
              .map((g) => (
                <article className="group-card" key={g.id}>
                  <Link
                    className="group-identity"
                    href={"/?group=" + encodeURIComponent(g.id)}
                    aria-label={"Choose " + g.name}
                  >
                    <GroupAvatar group={g} />
                    <h3>{g.name}</h3>
                    <span>{g.playerIds.length} players</span>
                  </Link>
                  <div className="group-card-actions">
                    <Link
                      className="primary"
                      aria-label={"Add " + g.name + " to session"}
                      href={"/?group=" + encodeURIComponent(g.id)}
                    >
                      Add to session
                    </Link>
                    <button
                      type="button"
                      className="text-button"
                      aria-label={"Manage " + g.name}
                      onClick={() => {
                        setEditing(g.id);
                        setDeleteId(null);
                        onEditingChange?.(true);
                        setName(g.name);
                        setPhoto(g.photo ?? null);
                        setSelected(g.playerIds);
                        setError("");
                        setNotice("");
                      }}
                    >
                      Manage group
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!groups.length && (
            <p className="empty-inline">
              Create a group, add your regular players once, and find them
              quickly for each session.
            </p>
          )}
          {groups.length > 0 &&
            !groups.some((g) =>
              g.name
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
            ) && <p className="empty-inline">No groups match your search.</p>}
        </>
      )}
    </section>
  );
}

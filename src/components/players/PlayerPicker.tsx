"use client";
import { useState } from "react";
import type { Player, PlayerGroup } from "@/types";
import GroupAvatar from "./GroupAvatar";
import { Avatar } from "./PlayerCard";
import { addSavedPlayer } from "@/lib/db";

export default function PlayerPicker({
  players: savedPlayers,
  groups,
  selected,
  onChange,
  initialGroupId = "",
  onPendingChange,
  disabled = false,
}: {
  players: Player[];
  groups: PlayerGroup[];
  selected: string[];
  onChange: (ids: string[]) => void;
  initialGroupId?: string;
  onPendingChange?: (pending: boolean) => void;
  disabled?: boolean;
}) {
  const [addedPlayers, setAddedPlayers] = useState<Player[]>([]);
  const players = [
    ...savedPlayers,
    ...addedPlayers.filter(
      (added) => !savedPlayers.some((p) => p.id === added.id),
    ),
  ];
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addNotice, setAddNotice] = useState("");
  async function addName() {
    if (adding || disabled) return;
    setAdding(true);
    onPendingChange?.(true);
    setAddError("");
    setAddNotice("");
    try {
      const player = await addSavedPlayer(newName);
      setAddedPlayers((previous) => [
        ...previous.filter((p) => p.id !== player.id),
        player,
      ]);
      onChange([...new Set([...selected, player.id])]);
      setNewName("");
      setSearch("");
      setGroupId("");
      setAddNotice(
        `${player.name} added to your selection. Saved for future games.`,
      );
    } catch (error) {
      setAddError(
        error instanceof Error
          ? error.message
          : "Could not add player. Try again.",
      );
    } finally {
      setAdding(false);
      onPendingChange?.(false);
    }
  }
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState(initialGroupId);
  const group = groups.find((g) => g.id === groupId);
  const visible = players.filter(
    (p) =>
      (!group || group.playerIds.includes(p.id)) &&
      p.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <div className="player-picker">
      {groups.length > 0 && (
        <div
          className="group-picker"
          role="group"
          aria-label="Choose a player group"
        >
          <button
            type="button"
            className="group-choice"
            aria-pressed={!groupId}
            onClick={() => {
              setGroupId("");
              setSearch("");
            }}
          >
            <span
              className="group-avatar all-players-avatar"
              aria-hidden="true"
            >
              All
            </span>
            <span>All players</span>
          </button>
          {groups.map((g) => (
            <button
              type="button"
              className="group-choice"
              key={g.id}
              aria-pressed={groupId === g.id}
              onClick={() => {
                setGroupId(g.id);
                setSearch("");
              }}
            >
              <GroupAvatar group={g} />
              <span>{g.name}</span>
              <small>
                {
                  g.playerIds.filter((id) => players.some((p) => p.id === id))
                    .length
                }{" "}
                players
              </small>
            </button>
          ))}
        </div>
      )}
      {group && (
        <div className="group-selection-heading">
          <h3>{group.name}</h3>
          <p>Tap a player to select them.</p>
          <div className="group-selection-actions">
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onChange([
                  ...new Set([
                    ...selected,
                    ...players
                      .filter((p) => group.playerIds.includes(p.id))
                      .map((p) => p.id),
                  ]),
                ])
              }
            >
              Add whole group
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                onChange([
                  ...new Set([
                    ...selected,
                    ...players
                      .filter(
                        (p) =>
                          group.playerIds.includes(p.id) &&
                          p.status === "active",
                      )
                      .map((p) => p.id),
                  ]),
                ])
              }
            >
              Add active players
            </button>
          </div>
        </div>
      )}
      <div className="inline-player-add">
        <label>
          New player name
          <input
            value={newName}
            maxLength={60}
            disabled={adding || disabled}
            placeholder="e.g. Alex Santos"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addName();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={adding || disabled || !newName.trim()}
          onClick={addName}
        >
          {adding ? "Adding…" : "Add name"}
        </button>
        <p>Names are saved for next time.</p>
        {addError && (
          <p role="alert" className="form-error">
            {addError}
          </p>
        )}
        {addNotice && <p role="status">{addNotice}</p>}
      </div>
      {players.length > 0 && (
        <div className="picker-filters">
          <label>
            Search saved players
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a player's name"
            />
          </label>
        </div>
      )}
      <div className="picker-summary">
        <span>{selected.length} selected</span>
        {!group && (
          <button
            type="button"
            className="text-button"
            onClick={() =>
              onChange([
                ...new Set([
                  ...selected,
                  ...visible
                    .filter((p) => p.status === "active")
                    .map((p) => p.id),
                ]),
              ])
            }
          >
            Add available players
          </button>
        )}
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([])}
        >
          Clear selection
        </button>
      </div>
      <div className="crew-picker">
        {visible.map((p) => (
          <label
            key={p.id}
            className={
              selected.includes(p.id)
                ? "player-choice is-picked"
                : "player-choice"
            }
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, p.id]
                    : selected.filter((id) => id !== p.id),
                )
              }
            />
            <Avatar player={p} />
            <span>
              {p.name}
              <small>{p.status}</small>
            </span>
          </label>
        ))}
      </div>
      {!visible.length && players.length > 0 && (
        <p className="muted">No players found. Try another name or group.</p>
      )}
      {selected.length > 0 && (
        <details className="selection-details">
          <summary>View selected players</summary>
          <p className="selection-names">
            {" "}
            {players
              .filter((p) => selected.includes(p.id))
              .map((p) => p.name)
              .join(", ")}
          </p>
        </details>
      )}
      {players
        .filter((p) => selected.includes(p.id))
        .map((p) => (
          <input key={p.id} type="hidden" name="players" value={p.id} />
        ))}
    </div>
  );
}

export function SessionPlayerPicker({
  players,
  groups,
  initialGroupId = "",
  onPendingChange,
}: {
  players: Player[];
  groups: PlayerGroup[];
  initialGroupId?: string;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [selected, setSelected] = useState(
    groups.length
      ? []
      : players.filter((p) => p.status === "active").map((p) => p.id),
  );
  return (
    <PlayerPicker
      players={players}
      groups={groups}
      selected={selected}
      onChange={setSelected}
      initialGroupId={initialGroupId}
      onPendingChange={onPendingChange}
    />
  );
}

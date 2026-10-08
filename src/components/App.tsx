"use client";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import {
  Plus,
  ArrowUpRight,
  Shuffle,
  Users,
  MapPin,
  Camera,
  Check,
  X,
  History,
  Download,
} from "lucide-react";
import {
  db,
  base,
  createSession,
  startSession,
  endSession,
  generateRound,
  finishMatch,
  removePlayer,
} from "@/lib/db";
import { statistics } from "@/lib/statistics";
import type { Player, Mode } from "@/types";
import SessionCard from "./dashboard/SessionCard";
import StatsOverview from "./dashboard/StatsOverview";
import CourtCard from "./courts/CourtCard";
import PlayerCard, { Avatar } from "./players/PlayerCard";
import LeaderboardTable from "./leaderboard/LeaderboardTable";
type View = "play" | "courts" | "players" | "leaderboard" | "snaps" | "history";
export default function App({ view }: { view: View }) {
  const [loadError, setLoadError] = useState("");
  const data = useLiveQuery(async () => {
    try {
      return {
        players: await db.players.toArray(),
        sessions: await db.sessions.orderBy("createdAt").reverse().toArray(),
        courts: await db.courts.toArray(),
        matches: await db.matches.toArray(),
      };
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Could not read device storage.",
      );
      return null;
    }
  }, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"player" | "session" | "end" | null>(null);
  const [edit, setEdit] = useState<Player | null>(null);
  const [detail, setDetail] = useState<Player | null>(null);
  const [historyId, setHistoryId] = useState("");
  const [mode, setMode] = useState<Mode>("fair");
  const [search, setSearch] = useState("");
  async function action(fn: () => Promise<unknown>, success = "") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Try again.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (loadError)
    return (
      <section className="empty-state">
        <h1>Device storage is unavailable</h1>
        <p>{loadError}</p>
        <p>Enable browser storage and reload to continue.</p>
        <button className="primary" onClick={() => location.reload()}>
          Try again
        </button>
      </section>
    );
  if (!data)
    return (
      <div className="loading">
        <span className="loader" />
        Loading your courts…
      </div>
    );
  const { players, sessions, courts, matches } = data;
  const current = sessions.find((s) => s.status !== "completed");
  const selected = historyId
    ? sessions.find((s) => s.id === historyId)
    : current;
  const sessionMatches = matches.filter((m) => m.sessionId === selected?.id);
  const sessionPlayers = players.filter((p) =>
    selected?.playerIds.includes(p.id),
  );
  const sessionCourts = courts
    .filter((c) => c.sessionId === selected?.id)
    .sort((a, b) => a.number - b.number);
  const liveIds = new Set(
    sessionMatches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const waiting = sessionPlayers.filter(
    (p) => p.status === "active" && !liveIds.has(p.id),
  );
  function addPlayer() {
    setEdit(null);
    setModal("player");
    setError("");
  }
  async function savePlayer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const status = String(form.get("status")) as Player["status"];
    const file = form.get("photo") as File;
    await action(async () => {
      if (!name) throw Error("Enter the player’s name.");
      if (name.length > 60) throw Error("Keep the name under 60 characters.");
      let photo = edit?.photo;
      if (file?.size) {
        if (
          file.size > 2 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(file.type)
        )
          throw Error("Choose a JPG, PNG, or WebP photo under 2 MB.");
        photo = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
      await db.players.put({
        ...(edit ?? base()),
        name,
        status,
        photo,
        updatedAt: Date.now(),
      });
      setModal(null);
    }, "Player saved.");
  }
  async function saveSession(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await action(async () => {
      await createSession({
        name: String(f.get("name") ?? ""),
        venue: String(f.get("venue") ?? ""),
        courtCount: Number(f.get("courts")),
        playerIds: f.getAll("players").map(String),
        duration: f.get("duration") ? Number(f.get("duration")) : undefined,
      });
      setModal(null);
    }, "Session created. Start when your crew is ready.");
  }
  async function result(id: string, w: "A" | "B", a?: number, b?: number) {
    await action(
      () => finishMatch(id, w, a, b),
      "Result saved. Ready for the next game.",
    );
  }
  function renderCourts() {
    return (
      <div className="court-grid">
        {sessionCourts.map((c) => (
          <CourtCard
            key={c.id}
            court={c}
            players={players}
            match={
              [...sessionMatches]
                .filter((m) => m.courtId === c.id && m.status !== "cancelled")
                .sort((a, b) => b.createdAt - a.createdAt)[0]
            }
            onResult={result}
          />
        ))}
      </div>
    );
  }
  const headings = {
    play: [
      "LET’S GET A GAME GOING",
      "Good games start here.",
      "Round up your crew. We’ll take care of the rotation.",
    ],
    courts: [
      "ON THE COURT",
      "Room for a great game.",
      "Follow every court and record your match results.",
    ],
    players: [
      "YOUR PADEL PEOPLE",
      "Meet your crew.",
      "A familiar face. A new partner. A better game.",
    ],
    leaderboard: [
      "A LITTLE FRIENDLY COMPETITION",
      "Every game counts.",
      "Celebrate the wins. Keep the good games coming.",
    ],
    history: [
      "THE GAMES WE PLAYED",
      "Good times, on record.",
      "Look back at your completed sessions.",
    ],
    snaps: [
      "MORE THAN THE SCORE",
      "Save the good moments.",
      "The post-match smiles deserve a place here.",
    ],
  }[view];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{headings[0]}</p>
          <h1>{headings[1]}</h1>
          <p className="subtitle">{headings[2]}</p>
        </div>
        {view === "players" ? (
          <button className="primary" onClick={addPlayer}>
            <Plus size={18} />
            Add player
          </button>
        ) : view === "play" && !current ? (
          <button className="primary" onClick={() => setModal("session")}>
            <Plus size={18} />
            New session
          </button>
        ) : (
          <span className="date-label">
            {new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date())}
          </span>
        )}
      </div>
      {error && (
        <div role="alert" className="alert error">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="alert success">
          <Check size={16} />
          {notice}
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {view === "play" && (
        <>
          {current ? (
            <>
              <SessionCard
                session={current}
                onStart={() =>
                  action(
                    () => startSession(current.id),
                    "Session started. Generate your first round.",
                  )
                }
                onEnd={() => setModal("end")}
              />
              <StatsOverview
                players={sessionPlayers.length}
                courts={
                  sessionCourts.filter((c) =>
                    sessionMatches.some(
                      (m) => m.courtId === c.id && m.status === "playing",
                    ),
                  ).length
                }
                games={
                  sessionMatches.filter((m) => m.status === "completed").length
                }
                waiting={waiting.length}
              />
              <div className="section-heading">
                <div>
                  <h2>
                    Your courts{" "}
                    <span className="count">{sessionCourts.length}</span>
                  </h2>
                  <p>Good partners. Fresh matchups.</p>
                </div>
                <div className="round-tools">
                  <label className="sr-only" htmlFor="mode">
                    Matchmaking mode
                  </label>
                  <select
                    id="mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as Mode)}
                  >
                    <option value="fair">Fair rotation</option>
                    <option value="random">Pure random</option>
                    <option value="balanced">Balanced teams</option>
                  </select>
                  <button
                    className="primary"
                    disabled={busy || current.status !== "active"}
                    onClick={() =>
                      action(
                        () => generateRound(current.id, mode),
                        "New matches are ready. Let’s play!",
                      )
                    }
                  >
                    <Shuffle size={16} />
                    Generate round
                  </button>
                </div>
              </div>
              {renderCourts()}
              <section className="waiting">
                <div className="section-heading">
                  <div>
                    <h2>
                      Up next <span className="count">{waiting.length}</span>
                    </h2>
                    <p>Taking a breather. Ready for the next round.</p>
                  </div>
                  <Link href="/players">
                    Manage players <ArrowUpRight size={15} />
                  </Link>
                </div>
                <div className="waiting-players">
                  {waiting.map((p) => (
                    <button key={p.id} onClick={() => setDetail(p)}>
                      <Avatar player={p} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                  {!waiting.length && (
                    <p className="muted">
                      Everyone is on court or taking a rest.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="welcome">
                <div>
                  <span className="eyebrow">
                    LESS ORGANIZING. MORE PLAYING.
                  </span>
                  <h2>
                    Your next great game
                    <br />
                    starts with your crew.
                  </h2>
                  <p>
                    Create a session, fill your courts, and keep the
                    <br className="desktop-only" /> games fair. All saved right
                    here on your device.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setModal("session")}
                  >
                    <Plus size={18} />
                    Create your first session
                  </button>
                  <span className="welcome-note">
                    No account needed. Just bring your racket.
                  </span>
                </div>
                <div className="court-art" aria-hidden="true">
                  <div className="art-court">
                    <div />
                    <div />
                    <span className="ball" />
                    <span className="art-player p1" />
                    <span className="art-player p2" />
                    <span className="art-player p3" />
                    <span className="art-player p4" />
                  </div>
                  <span className="art-caption">SEE YOU ON THE COURT ↗</span>
                </div>
              </section>
              <StatsOverview
                players={players.length}
                courts={0}
                games={matches.filter((m) => m.status === "completed").length}
                waiting={players.filter((p) => p.status === "active").length}
              />
              <div className="onboarding">
                <div>
                  <span>01</span>
                  <Users size={23} />
                  <h3>Bring your people</h3>
                  <p>Add your crew once. They’ll be ready for every session.</p>
                  <button onClick={addPlayer}>
                    Add a player <ArrowUpRight size={16} />
                  </button>
                </div>
                <div>
                  <span>02</span>
                  <MapPin size={23} />
                  <h3>Set the scene</h3>
                  <p>
                    Pick a venue, choose your courts, and gather your players.
                  </p>
                  <button onClick={() => setModal("session")}>
                    Create a session <ArrowUpRight size={16} />
                  </button>
                </div>
                <div>
                  <span>03</span>
                  <Shuffle size={23} />
                  <h3>Mix it up. Play fair.</h3>
                  <p>
                    Fresh teams and fair rotations. More games for everyone.
                  </p>
                  <Link href="/courts">
                    Explore courts <ArrowUpRight size={16} />
                  </Link>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {view === "players" && (
        <>
          <div className="section-heading">
            <h2>
              All players <span className="count">{players.length}</span>
            </h2>
            <input
              className="search"
              placeholder="Search your crew…"
              aria-label="Search players"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="player-grid">
            {players
              .filter((p) =>
                p.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((p) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  onClick={() => setDetail(p)}
                />
              ))}
          </div>
          {!players.length && (
            <div className="empty-state">
              <Users size={38} />
              <h2>Every great game needs a crew.</h2>
              <p>Add your first player to get things started.</p>
              <button className="primary" onClick={addPlayer}>
                <Plus size={16} />
                Add a player
              </button>
            </div>
          )}
          {players.length > 0 &&
            !players.some((p) =>
              p.name.toLowerCase().includes(search.toLowerCase()),
            ) && <p className="empty-inline">No players match your search.</p>}
        </>
      )}
      {view === "courts" &&
        (current ? (
          <>
            <div className="section-heading">
              <h2>{current.name}</h2>
              <Link href="/">
                Manage rotation <ArrowUpRight size={16} />
              </Link>
            </div>
            {renderCourts()}
          </>
        ) : (
          <div className="empty-state">
            <MapPin size={38} />
            <h2>Your courts are waiting.</h2>
            <p>Create a session to open your courts.</p>
            <Link className="primary" href="/">
              Go to Play <ArrowUpRight size={16} />
            </Link>
          </div>
        ))}
      {view === "leaderboard" && (
        <>
          <div className="section-heading">
            <h2>{selected?.name ?? "All-time standings"}</h2>
            <select
              value={historyId}
              aria-label="Leaderboard session"
              onChange={(e) => setHistoryId(e.target.value)}
            >
              <option value="">
                {current ? "Current session" : "All time"}
              </option>
              {sessions
                .filter((s) => s.status === "completed")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
          <LeaderboardTable
            players={selected ? sessionPlayers : players}
            matches={selected ? sessionMatches : matches}
            onPlayer={setDetail}
          />
          <p className="footnote">
            Ranked by wins, then win rate and best streak. Only completed
            matches count.
          </p>
        </>
      )}
      {view === "history" && (
        <>
          {!historyId ? (
            <div className="history-list">
              {sessions
                .filter((s) => s.status === "completed")
                .map((s) => (
                  <button
                    key={s.id}
                    className="history-card"
                    onClick={() => setHistoryId(s.id)}
                  >
                    <span className="history-icon">
                      <History size={23} />
                    </span>
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.venue} · {new Date(s.createdAt).toLocaleDateString()}{" "}
                        ·{" "}
                        {
                          matches.filter(
                            (m) =>
                              m.sessionId === s.id && m.status === "completed",
                          ).length
                        }{" "}
                        matches
                      </small>
                    </span>
                    <ArrowUpRight size={19} />
                  </button>
                ))}
              {!sessions.some((s) => s.status === "completed") && (
                <div className="empty-state">
                  <History size={38} />
                  <h2>Memories in the making.</h2>
                  <p>Your completed sessions will appear here.</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <button className="text-button" onClick={() => setHistoryId("")}>
                ← All sessions
              </button>
              <h2>{selected?.name}</h2>
              <p className="subtitle">{selected?.venue}</p>
              <LeaderboardTable
                players={sessionPlayers}
                matches={sessionMatches}
                onPlayer={setDetail}
              />
              <div className="section-heading">
                <h2>Match results</h2>
              </div>
              {sessionMatches
                .filter((m) => m.status === "completed")
                .map((m) => (
                  <div className="history-card" key={m.id}>
                    <span>
                      <strong>
                        {m.teamA
                          .map((id) => players.find((p) => p.id === id)?.name)
                          .join(" & ")}{" "}
                        vs{" "}
                        {m.teamB
                          .map((id) => players.find((p) => p.id === id)?.name)
                          .join(" & ")}
                      </strong>
                      <small>
                        Team {m.winner} won{" "}
                        {m.scoreA !== undefined
                          ? " · " + m.scoreA + " – " + m.scoreB
                          : ""}
                      </small>
                    </span>
                  </div>
                ))}
            </>
          )}
        </>
      )}
      {view === "snaps" && (
        <section className="empty-state snaps">
          <span className="snaps-icon">
            <Camera size={40} />
          </span>
          <span className="pill">ON THE HORIZON</span>
          <h2>The moments between matches.</h2>
          <p>
            Quick Snaps, captions, and shareable recaps are coming later.
            <br />
            For now, make some memories on court.
          </p>
          <Link className="secondary" href="/">
            Back to the game <ArrowUpRight size={16} />
          </Link>
        </section>
      )}
      <footer className="footer">
        <span>
          <span className="dot" />
          Your game stays with you. Saved on this device.
        </span>
        <button
          className="text-button"
          onClick={() =>
            action(async () => {
              const blob = new Blob(
                [
                  JSON.stringify(
                    {
                      ...data,
                      exportedAt: new Date().toISOString(),
                      schemaVersion: 1,
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "paddle-na-bai-backup.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, "Backup downloaded.")
          }
        >
          <Download size={14} />
          Export backup
        </button>
      </footer>
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <button
              className="close"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            <p className="eyebrow">PADDLE NA BAI!</p>
            <h2 id="modal-title">
              {modal === "player"
                ? edit
                  ? "Edit player"
                  : "Welcome to the crew."
                : modal === "session"
                  ? "Let’s set up your session."
                  : "Call it a good session?"}
            </h2>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            {modal === "player" ? (
              <form onSubmit={savePlayer}>
                <label>
                  Player name
                  <input
                    autoFocus
                    name="name"
                    required
                    maxLength={60}
                    defaultValue={edit?.name}
                    placeholder="e.g. Alex Santos"
                  />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={edit?.status ?? "active"}>
                    <option value="active">Active · ready to play</option>
                    <option value="resting">Resting</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </label>
                <label>
                  Profile photo{" "}
                  <span className="muted">(optional, up to 2 MB)</span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/jpeg,image/png,image/webp"
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Save player <Check size={16} />
                </button>
              </form>
            ) : modal === "session" ? (
              <form onSubmit={saveSession}>
                <label>
                  Session name
                  <input
                    autoFocus
                    name="name"
                    required
                    maxLength={80}
                    placeholder="Friday night open play"
                  />
                </label>
                <label>
                  Venue
                  <input
                    name="venue"
                    required
                    maxLength={120}
                    placeholder="Where are we playing?"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Courts
                    <input
                      name="courts"
                      type="number"
                      min="1"
                      max="12"
                      required
                      defaultValue="1"
                    />
                  </label>
                  <label>
                    Duration in minutes
                    <input
                      name="duration"
                      type="number"
                      min="1"
                      max="1440"
                      placeholder="Optional"
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>Choose your crew · at least 4 players</legend>
                  <div className="crew-picker">
                    {players.map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          name="players"
                          value={p.id}
                          defaultChecked={p.status === "active"}
                        />
                        <Avatar player={p} />
                        <span>
                          {p.name}
                          <small>{p.status}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  {players.length < 4 && (
                    <p className="form-error">
                      Add {4 - players.length} more{" "}
                      {players.length === 3 ? "player" : "players"} before
                      creating a session.
                    </p>
                  )}
                </fieldset>
                <button
                  className="primary full"
                  disabled={busy || players.length < 4}
                >
                  Create session <ArrowUpRight size={16} />
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={addPlayer}
                >
                  <Plus size={15} />
                  Add a player
                </button>
              </form>
            ) : (
              <>
                <p>
                  Completed results will be kept in History. Matches still in
                  progress will be cancelled and won’t count in the standings.
                </p>
                <div className="two-buttons">
                  <button className="secondary" onClick={() => setModal(null)}>
                    Keep playing
                  </button>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        if (current) await endSession(current.id);
                        setModal(null);
                      }, "Session completed. Find the results in History.")
                    }
                  >
                    End session
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {detail &&
        (() => {
          const s = statistics(
            detail.id,
            (view === "leaderboard" || view === "history") && selected
              ? sessionMatches
              : matches,
          );
          const fresh = players.find((p) => p.id === detail.id) ?? detail;
          return (
            <div className="modal-backdrop">
              <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="player-title"
              >
                <button
                  className="close"
                  aria-label="Close player details"
                  onClick={() => setDetail(null)}
                >
                  <X size={20} />
                </button>
                <Avatar player={fresh} />
                <h2 id="player-title">{fresh.name}</h2>
                <span className="pill">{fresh.status}</span>
                <div className="personal-stats">
                  {[
                    [s.games, "Games"],
                    [s.wins, "Wins"],
                    [s.losses, "Losses"],
                    [s.rate.toFixed(0) + "%", "Win rate"],
                    [s.streak, "Current streak"],
                    [s.best, "Best streak"],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <strong>{v}</strong>
                      <span>{l}</span>
                    </div>
                  ))}
                </div>
                <div className="two-buttons">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEdit(fresh);
                      setDetail(null);
                      setModal("player");
                    }}
                  >
                    Edit player
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await removePlayer(fresh.id);
                        setDetail(null);
                      }, "Player removed.")
                    }
                  >
                    Remove player
                  </button>
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </section>
            </div>
          );
        })()}
    </>
  );
}

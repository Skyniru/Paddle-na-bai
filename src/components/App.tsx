"use client";
import { matchElapsed } from "@/lib/match-time";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import {
  db,
  base,
  createSession,
  startSession,
  endSession,
  generateRound,
  syncContinuousQueue,
  resumeContinuousSession,
  finishMatch,
  removePlayer,
} from "@/lib/db";
import { statistics } from "@/lib/statistics";
import type { Player, Mode } from "@/types";
import ReservationSetup from "./courts/ReservationSetup";
import {
  isCheckedIn,
  freeCourts,
  sessionPlayerState,
  venueTime,
} from "@/lib/reservations";
import GroupManager from "./players/GroupManager";
import SessionRoster from "./players/SessionRoster";
import { SessionPlayerPicker } from "./players/PlayerPicker";
import SessionCard from "./dashboard/SessionCard";
import StatsOverview from "./dashboard/StatsOverview";
import ResultEditor from "./courts/ResultEditor";
import CourtCard from "./courts/CourtCard";
import SessionQueue from "./courts/SessionQueue";
import ResultsRecap from "./results/ResultsRecap";
import PlayerCard, { Avatar } from "./players/PlayerCard";
import LeaderboardTable from "./leaderboard/LeaderboardTable";
import DeviceData from "./DeviceData";
import { storageError } from "@/lib/storage";
import { readGroupPhoto } from "@/lib/photos";
type View = "play" | "courts" | "players" | "leaderboard" | "snaps" | "history";
export default function App({ view }: { view: View }) {
  const router = useRouter();
  const [now, refreshClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => refreshClock(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);
  const [loadError, setLoadError] = useState("");
  const data = useLiveQuery(async () => {
    try {
      return await db.transaction(
        "r",
        [db.players, db.groups, db.sessions, db.courts, db.matches],
        async () => ({
          players: await db.players.toArray(),
          groups: await db.groups.toArray(),
          sessions: await db.sessions.orderBy("createdAt").reverse().toArray(),
          courts: await db.courts.toArray(),
          matches: await db.matches.toArray(),
        }),
      );
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
  const recoveryId = data?.sessions.find(
    (s) => s.continuous !== false && s.status === "active",
  )?.id;
  useEffect(() => {
    if (!recoveryId) return;
    resumeContinuousSession(recoveryId).catch((error) =>
      setLoadError(storageError(error)),
    );
  }, [recoveryId]);
  const [modal, setModal] = useState<"player" | "session" | "end" | null>(null);
  const [edit, setEdit] = useState<Player | null>(null);
  const [detail, setDetail] = useState<Player | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState("");
  useEffect(() => {
    if (view !== "history") return;
    const id = new URLSearchParams(window.location.search).get("session");
    if (!id) return;
    const frame = requestAnimationFrame(() => setHistoryId(id));
    return () => cancelAnimationFrame(frame);
  }, [view]);
  const [mode, setMode] = useState<Mode>("fair");
  const [sessionPhoto, setSessionPhoto] = useState<string>();
  const [readingBanner, setReadingBanner] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [search, setSearch] = useState("");
  const [addingSessionPlayer, setAddingSessionPlayer] = useState(false);
  const [sessionGroupId, setSessionGroupId] = useState("");
  const [rosterGroupId, setRosterGroupId] = useState("");
  const [groupRequest, setGroupRequest] = useState(0);
  useEffect(() => {
    if (view !== "play" || !data) return;
    const groupId = new URLSearchParams(window.location.search).get("group");
    if (!groupId || !data.groups.some((g) => g.id === groupId)) return;
    const frame = requestAnimationFrame(() => {
      if (data.sessions.some((s) => s.status !== "completed")) {
        setRosterGroupId(groupId);
        setGroupRequest((request) => request + 1);
      } else {
        setSessionGroupId(groupId);
        setModal("session");
      }
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [view, data]);
  async function action(fn: () => Promise<unknown>, success = "") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      if (success) setNotice(success);
      return true;
    } catch (e) {
      setError(storageError(e));
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
  const { players, groups, sessions, courts, matches } = data;
  const current = sessions.find((s) => s.status !== "completed");
  const selected = historyId
    ? sessions.find((s) => s.id === historyId)
    : current;
  const sessionMatches = matches.filter((m) => m.sessionId === selected?.id);
  const sessionPlayers = players
    .filter((p) => selected?.playerIds.includes(p.id))
    .map((p) => ({
      ...p,
      status: selected?.playerStatuses?.[p.id] ?? p.status,
    }));
  const sessionCourts = courts
    .filter((c) => c.sessionId === selected?.id)
    .sort((a, b) => a.number - b.number);
  const liveIds = new Set(
    sessionMatches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const waiting = sessionPlayers.filter(
    (p) =>
      p.status === "active" &&
      !!selected &&
      isCheckedIn(selected, p.id) &&
      !liveIds.has(p.id),
  );
  const availableCourts = freeCourts(sessionCourts, sessionMatches, now);
  const generationReason =
    current?.status !== "active"
      ? "Start the session first."
      : availableCourts.length === 0
        ? "No court is free right now. Finish a match to free a court."
        : waiting.length < 4
          ? "Check in at least four ready players who are not already playing."
          : "";
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
      if (file?.size) photo = await readGroupPhoto(file);
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
        continuous: true,
        mode,
        bannerPhoto: sessionPhoto,
        playerIds: f.getAll("players").map(String),
      });
      try {
        localStorage.setItem("paddle-court-count", String(f.get("courts")));
      } catch {
        /* Session is already saved. */
      }
      setSessionPhoto(undefined);
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
        {sessionCourts.map((c) => {
          const latest = sessionMatches
            .filter((m) => m.courtId === c.id && m.status !== "cancelled")
            .sort(
              (a, b) =>
                Number(b.status === "playing") -
                  Number(a.status === "playing") ||
                b.createdAt - a.createdAt ||
                b.updatedAt - a.updatedAt,
            )[0];
          return (
            <CourtCard
              key={c.id + ":" + (latest?.id ?? "empty")}
              court={c}
              players={players}
              eligiblePlayers={waiting}
              canAssign={
                !current?.continuous &&
                current?.status === "active" &&
                availableCourts.some((court) => court.id === c.id)
              }
              match={latest}
              onResult={result}
            />
          );
        })}
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
      <div
        className={
          view === "play" ? "page-heading play-heading" : "page-heading"
        }
      >
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
              timeZone: "Asia/Manila",
            }).format(new Date())}
          </span>
        )}
      </div>
      {current?.status === "active" && view === "play" && (
        <p className="recovery-note" role="status">
          Your session is saved on this device and resumes when you reopen.
        </p>
      )}
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
                    "Session started. Matches are ready.",
                  )
                }
                onEnd={() => setModal("end")}
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
                    value={current.mode ?? mode}
                    onChange={(e) => {
                      const value = e.target.value as Mode;
                      setMode(value);
                      if (current.continuous)
                        action(
                          () => syncContinuousQueue(current.id, value),
                          "Rotation preference saved.",
                        );
                    }}
                  >
                    <option value="fair">Fair rotation</option>
                    <option value="random">Pure random</option>
                    <option value="balanced">Balanced teams</option>
                  </select>
                  {!current.continuous && (
                    <button
                      className="primary"
                      disabled={busy || !!generationReason}
                      aria-describedby="round-reason"
                      onClick={() =>
                        action(
                          () => generateRound(current.id, mode),
                          "New matches are ready. Let’s play!",
                        )
                      }
                    >
                      <Shuffle size={16} />
                      Resume rotation
                    </button>
                  )}
                </div>
              </div>
              {!current.continuous && (
                <p id="round-reason" className="muted" role="status">
                  {generationReason}
                </p>
              )}
              <div className="stats-grid session-primary-stats">
                {[
                  [
                    sessionPlayers.filter((p) => isCheckedIn(current, p.id))
                      .length,
                    "Players Present",
                  ],
                  [liveIds.size, "Playing"],
                  [waiting.length, "Waiting"],
                  [availableCourts.length, "Currently Available Courts"],
                ].map(([value, label]) => (
                  <div className="stat" key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <details className="session-details">
                <summary>More session details</summary>
                <div className="session-secondary-stats">
                  <p>
                    Current round: <strong>{current.round ?? 0}</strong>
                  </p>
                  <p>
                    Finished matches:{" "}
                    <strong>
                      {
                        sessionMatches.filter((m) => m.status === "completed")
                          .length
                      }
                    </strong>
                  </p>
                  <p>
                    Resting:{" "}
                    <strong>
                      {
                        sessionPlayers.filter(
                          (p) =>
                            sessionPlayerState(current, p, sessionMatches) ===
                            "Resting",
                        ).length
                      }
                    </strong>
                  </p>
                  <p>
                    Unavailable:{" "}
                    <strong>
                      {
                        sessionPlayers.filter(
                          (p) =>
                            sessionPlayerState(current, p, sessionMatches) ===
                            "Unavailable",
                        ).length
                      }
                    </strong>
                  </p>
                  <p>
                    Checked out:{" "}
                    <strong>
                      {
                        sessionPlayers.filter(
                          (p) =>
                            sessionPlayerState(current, p, sessionMatches) ===
                            "Checked Out",
                        ).length
                      }
                    </strong>
                  </p>
                  <p>
                    Session courts: <strong>{sessionCourts.length}</strong>
                  </p>
                </div>
              </details>
              {renderCourts()}
              {sessionMatches.some((match) => match.status === "completed") && (
                <details className="session-details">
                  <summary>Finished match results</summary>
                  {sessionMatches
                    .filter((match) => match.status === "completed")
                    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
                    .map((match) => (
                      <div key={match.id} className="session-finished-match">
                        <p>
                          {venueTime(match.endedAt ?? match.createdAt)} ·
                          Winner: Team {match.winner} · Duration:{" "}
                          {matchElapsed(match)}
                          {match.scoreA !== undefined
                            ? ` ${match.scoreA} – ${match.scoreB}`
                            : ""}
                        </p>
                        <ResultEditor match={match} />
                      </div>
                    ))}
                </details>
              )}
              {current.continuous && (
                <SessionQueue session={current} players={sessionPlayers} />
              )}
              <SessionRoster
                key={current.id + rosterGroupId + groupRequest}
                initialGroupId={rosterGroupId}
                session={current}
                players={players}
                groups={groups}
                matches={sessionMatches}
              />
              {!current.continuous && (
                <section className="waiting">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Up next <span className="count">{waiting.length}</span>
                      </h2>
                      <p>Checked in and ready for the next round.</p>
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
              )}
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
                  <p className="welcome-note">
                    Use New session above to choose your courts and players.
                  </p>
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
                  <h3>1. Add players</h3>
                  <p>Add your crew once. They’ll be ready for every session.</p>
                  <button onClick={addPlayer}>
                    Add a player <ArrowUpRight size={16} />
                  </button>
                </div>
                <div>
                  <span>02</span>
                  <MapPin size={23} />
                  <h3>2. Create a session</h3>
                  <p>
                    Pick a venue, choose your courts, and gather your players.
                  </p>
                  <p>Use the New session button above.</p>
                </div>
                <div>
                  <span>03</span>
                  <Shuffle size={23} />
                  <h3>3. Start playing</h3>
                  <p>
                    Start the session, generate teams, and record each match
                    result.
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
          <GroupManager
            players={players}
            groups={groups}
            onEditingChange={setEditingGroup}
          />
          {!editingGroup && (
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
                ) && (
                  <p className="empty-inline">No players match your search.</p>
                )}
            </>
          )}
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
                        {s.venue} · {venueTime(s.createdAt)} ·{" "}
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
              {selected?.status === "completed" && (
                <ResultsRecap
                  key={
                    selected.id +
                    sessionMatches.map((m) => m.id + m.updatedAt).join(",") +
                    sessionPlayers.map((p) => p.name).join(",")
                  }
                  session={selected}
                  players={sessionPlayers}
                  matches={sessionMatches}
                />
              )}
              {selected?.status !== "completed" && <h2>{selected?.name}</h2>}
              <p className="subtitle">
                {selected?.venue} ·{" "}
                {Math.round((selected?.elapsedDuration ?? 0) / 60000)} minutes
              </p>
              <details>
                <summary>Attendance and historical court details</summary>
                {sessionPlayers.map((p) => (
                  <div key={p.id}>
                    <strong>{p.name}</strong>
                    {selected?.attendance?.[p.id]?.map((e, i) => (
                      <p key={i}>
                        {e.action} ·{" "}
                        {new Intl.DateTimeFormat("en-PH", {
                          timeZone: "Asia/Manila",
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(e.at)}
                      </p>
                    ))}
                  </div>
                ))}
                {sessionCourts
                  .filter((c) => c.reservationHistory?.length)
                  .map((c) => (
                    <div key={c.id}>
                      <strong>Court {c.number}</strong>
                      {c.reservationHistory?.map((r, i) => (
                        <p key={i}>
                          {new Date(r.start).toLocaleString("en-PH", {
                            timeZone: "Asia/Manila",
                          })}{" "}
                          –{" "}
                          {new Date(r.end).toLocaleString("en-PH", {
                            timeZone: "Asia/Manila",
                          })}
                        </p>
                      ))}
                    </div>
                  ))}
              </details>
              <LeaderboardTable
                players={sessionPlayers}
                matches={sessionMatches}
                onPlayer={setDetail}
              />
              <div className="section-heading">
                <h2>Match results</h2>
              </div>
              {sessionMatches.some((m) => m.status === "cancelled") && (
                <p className="muted">
                  {
                    sessionMatches.filter((m) => m.status === "cancelled")
                      .length
                  }{" "}
                  unfinished matches were cancelled when the session ended. No
                  winners or scores were added to the standings.
                </p>
              )}
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
                        Duration: {matchElapsed(m)} · Team {m.winner} won{" "}
                        {m.scoreA !== undefined
                          ? " · " + m.scoreA + " – " + m.scoreB
                          : ""}
                      </small>
                    </span>
                    <ResultEditor match={m} />
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
      <DeviceData />
      {modal && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="modal-close-bar">
              <button
                className="close"
                aria-label="Close dialog"
                onClick={() => setModal(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p className="eyebrow">PaddleBai</p>
              <h2 id="modal-title">
                {modal === "player"
                  ? edit
                    ? "Edit player"
                    : "Add a player"
                  : modal === "session"
                    ? "Let’s set up your session."
                    : "End this session?"}
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
                    <select
                      name="status"
                      defaultValue={edit?.status ?? "active"}
                    >
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
                      defaultValue="Davao Padel Club"
                    />
                  </label>
                  <ReservationSetup />
                  <label>
                    Session banner photo (optional)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy || readingBanner}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setReadingBanner(true);
                        try {
                          setSessionPhoto(await readGroupPhoto(file));
                        } catch (error) {
                          setError(storageError(error));
                        } finally {
                          setReadingBanner(false);
                        }
                      }}
                    />
                  </label>
                  {sessionPhoto && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setSessionPhoto(undefined)}
                    >
                      Remove session photo
                    </button>
                  )}
                  <fieldset>
                    <legend>Choose your crew · at least 4 players</legend>
                    <SessionPlayerPicker
                      players={players}
                      groups={groups}
                      initialGroupId={sessionGroupId}
                      onPendingChange={setAddingSessionPlayer}
                    />
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
                    disabled={
                      busy ||
                      readingBanner ||
                      addingSessionPlayer ||
                      players.length < 4
                    }
                  >
                    Create session <ArrowUpRight size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <p>
                    Completed results will be kept in History. Matches still in
                    progress will be cancelled and won’t count in the standings.
                  </p>
                  <div className="two-buttons">
                    <button
                      className="secondary"
                      onClick={() => setModal(null)}
                    >
                      Keep playing
                    </button>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          if (current) {
                            await endSession(current.id);
                            router.push(
                              `/history/?session=${encodeURIComponent(current.id)}`,
                            );
                          }
                          setModal(null);
                        }, "Session completed. Find the results in History.")
                      }
                    >
                      End session
                    </button>
                  </div>
                </>
              )}
            </div>
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
                <div className="modal-close-bar">
                  <button
                    className="close"
                    aria-label="Close player details"
                    onClick={() => {
                      setDetail(null);
                      setRemoveId(null);
                    }}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="modal-body">
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
                      onClick={() => setRemoveId(fresh.id)}
                    >
                      Remove player
                    </button>
                  </div>
                  {removeId === fresh.id && (
                    <div
                      className="alert"
                      role="region"
                      aria-label="Remove player confirmation"
                    >
                      <p>
                        Remove {fresh.name} and their photo from saved players?
                        Players with session records cannot be removed.
                      </p>
                      <div className="two-buttons">
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => setRemoveId(null)}
                        >
                          Keep player
                        </button>
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() =>
                            action(async () => {
                              await removePlayer(fresh.id);
                              setRemoveId(null);
                              setDetail(null);
                            }, "Player removed.")
                          }
                        >
                          Confirm removal
                        </button>
                      </div>
                    </div>
                  )}
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              </section>
            </div>
          );
        })()}
    </>
  );
}

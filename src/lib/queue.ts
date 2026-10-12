import type { Match, Player, Session } from "@/types";
import { generateTeams } from "./matchmaking";
import { isCheckedIn } from "./reservations";
import { opportunities, lastPlayed } from "./rotation";

// Called only on meaningful events, never on clock ticks or React renders.
export function prepareQueue(
  session: Session,
  players: Player[],
  matches: Match[],
) {
  const busy = new Set(
    matches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const eligible = players.filter(
    (p) =>
      session.playerIds.includes(p.id) &&
      isCheckedIn(session, p.id) &&
      (session.playerStatuses?.[p.id] ?? p.status) === "active" &&
      !busy.has(p.id),
  );
  const eligibleIds = new Set(eligible.map((p) => p.id));
  const claimed = new Set<string>();
  const retain = (ids: string[]) =>
    ids.filter((id) => {
      if (!eligibleIds.has(id) || claimed.has(id)) return false;
      claimed.add(id);
      return true;
    });
  const previous = session.queue?.upNext ?? [];
  const kept = retain(previous);
  const standby = retain(session.queue?.standby ?? []);
  const arrivals = eligible.filter((p) => !claimed.has(p.id));
  const arrival = (id: string) =>
    session.attendance?.[id]?.filter((e) => e.action !== "check-out").at(-1)
      ?.at ??
    session.startedAt ??
    session.createdAt;
  arrivals.sort(
    (a, b) =>
      opportunities(a.id, matches) - opportunities(b.id, matches) ||
      Math.max(lastPlayed(a.id, matches), arrival(a.id)) -
        Math.max(lastPlayed(b.id, matches), arrival(b.id)) ||
      session.playerIds.indexOf(a.id) - session.playerIds.indexOf(b.id),
  );
  if (session.mode === "random") {
    for (let i = arrivals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arrivals[i], arrivals[j]] = [arrivals[j], arrivals[i]];
    }
  }
  standby.push(...arrivals.map((p) => p.id));
  if (session.mode !== "random") {
    const order = new Map(standby.map((id, index) => [id, index]));
    standby.sort(
      (a, b) =>
        opportunities(a, matches) - opportunities(b, matches) ||
        Math.max(lastPlayed(a, matches), arrival(a)) -
          Math.max(lastPlayed(b, matches), arrival(b)) ||
        order.get(a)! - order.get(b)!,
    );
  }
  // Keep surviving players in their existing team slots; replace only invalid slots.
  const upNext = previous.length
    ? previous
        .map((id) => (kept.includes(id) ? id : (standby.shift() ?? "")))
        .filter(Boolean)
    : [];
  while (upNext.length < 4 && standby.length) upNext.push(standby.shift()!);
  if (!previous.length && upNext.length === 4) {
    const group = generateTeams(
      eligible.filter((p) => upNext.includes(p.id)),
      matches,
      session.mode ?? "fair",
      1,
      [],
      session,
    )[0];
    return { upNext: [...group.teamA, ...group.teamB], standby };
  }
  return { upNext, standby };
}

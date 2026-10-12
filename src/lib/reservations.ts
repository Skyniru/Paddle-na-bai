import type { Court, Session, Player, Match } from "@/types";

export function sessionPlayerState(
  session: Session,
  player: Player,
  matches: Match[],
) {
  if (!isCheckedIn(session, player.id))
    return session.attendance?.[player.id]?.length
      ? "Checked Out"
      : "Not Checked In";
  if (
    matches.some(
      (match) =>
        match.status === "playing" &&
        [...match.teamA, ...match.teamB].includes(player.id),
    )
  )
    return "Playing";
  const status = session.playerStatuses?.[player.id] ?? player.status;
  return status === "active"
    ? "Waiting"
    : status === "resting"
      ? "Resting"
      : "Unavailable";
}

export function freeCourts(
  courts: Court[],
  matches: Match[],
  now = Date.now(),
) {
  const occupied = new Set(
    matches
      .filter((match) => match.status === "playing")
      .map((match) => match.courtId),
  );
  return courts.filter(
    (court) => courtAvailable(court, now) && !occupied.has(court.id),
  );
}

const manilaDateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export function isCheckedIn(s: Session, id: string) {
  const e = s.attendance?.[id];
  return (
    s.attendance === undefined ||
    (!!e?.length && e.at(-1)?.action !== "check-out")
  );
}
export function courtAvailable(c: Court, now = Date.now()) {
  // Historical reservation timestamps do not restrict live open play.
  void c;
  void now;
  return true;
}
export function courtStatus(c: Court, now = Date.now(), playing = false) {
  void c;
  void now;
  return playing ? "Playing" : "Available";
}
export function validateReservation(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw Error("Reservation end must follow its start.");
}
export function venueTime(at: number) {
  return manilaDateTime.format(at);
}

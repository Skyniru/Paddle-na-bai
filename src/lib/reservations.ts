import type { Court, Session } from "@/types";
export function isCheckedIn(s: Session, id: string) {
  const e = s.attendance?.[id];
  return (
    s.attendance === undefined ||
    (!!e?.length && e.at(-1)?.action !== "check-out")
  );
}
export function courtAvailable(c: Court, now = Date.now()) {
  return (
    (c.reservationStart === undefined || now >= c.reservationStart) &&
    (c.reservationEnd === undefined || now < c.reservationEnd)
  );
}
export function courtStatus(c: Court, now = Date.now(), playing = false) {
  if (c.reservationEnd !== undefined && now >= c.reservationEnd)
    return "Reservation Expired";
  if (c.reservationStart !== undefined && now < c.reservationStart)
    return "Not Started";
  if (c.reservationEnd !== undefined && c.reservationEnd - now <= 900000)
    return "Reservation Ending Soon";
  return playing ? "Playing" : "Available";
}
export function validateReservation(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw Error("Reservation end must follow its start.");
}
export function venueTime(at: number) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

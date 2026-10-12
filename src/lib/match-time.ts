import type { Match } from "@/types";

export function matchElapsed(match: Match, now = Date.now()) {
  const seconds = Math.max(
    0,
    Math.floor(((match.endedAt ?? now) - match.createdAt) / 1000),
  );
  const tail = `${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return seconds >= 3600
    ? `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${tail}`
    : tail;
}

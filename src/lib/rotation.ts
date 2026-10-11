import type { Match } from "@/types";
export function opportunities(id: string, matches: Match[]) {
  return matches.filter(
    (m) => m.status !== "cancelled" && [...m.teamA, ...m.teamB].includes(id),
  ).length;
}
export function lastPlayed(id: string, matches: Match[]) {
  return Math.max(
    0,
    ...matches
      .filter(
        (m) =>
          m.status !== "cancelled" && [...m.teamA, ...m.teamB].includes(id),
      )
      .map((m) => m.endedAt ?? m.createdAt),
  );
}

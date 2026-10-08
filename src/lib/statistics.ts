import type { Match, Stats } from "@/types";
export function statistics(id: string, matches: Match[]): Stats {
  let games = 0,
    wins = 0,
    streak = 0,
    best = 0;
  for (const m of [...matches]
    .filter(
      (m) => m.status === "completed" && [...m.teamA, ...m.teamB].includes(id),
    )
    .sort(
      (a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0) || a.id.localeCompare(b.id),
    )) {
    games++;
    const won = (m.winner === "A" ? m.teamA : m.teamB).includes(id);
    if (won) {
      wins++;
      streak++;
      best = Math.max(best, streak);
    } else streak = 0;
  }
  return {
    id,
    games,
    wins,
    losses: games - wins,
    rate: games ? (wins / games) * 100 : 0,
    streak,
    best,
  };
}

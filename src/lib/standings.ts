import type { Player, Match } from "@/types";
import { statistics } from "./statistics";
export function sessionStandings(players: Player[], matches: Match[]) {
  return players
    .map((p) => ({ p, s: statistics(p.id, matches) }))
    .sort(
      (a, b) =>
        Number(b.s.games > 0) - Number(a.s.games > 0) ||
        b.s.wins - a.s.wins ||
        b.s.rate - a.s.rate ||
        b.s.best - a.s.best ||
        a.p.name.localeCompare(b.p.name),
    );
}

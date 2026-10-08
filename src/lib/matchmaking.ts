import type { Player, Match, Mode } from "@/types";
import { statistics } from "./statistics";
import { opportunities, lastPlayed } from "./rotation";
export function generateTeams(
  players: Player[],
  matches: Match[],
  mode: Mode,
  count: number,
  courtIds: string[] = [],
) {
  const busy = new Set(
    matches
      .filter((m) => m.status === "playing")
      .flatMap((m) => [...m.teamA, ...m.teamB]),
  );
  const pool = players
    .filter((p) => p.status === "active" && !busy.has(p.id))
    .map((p) => ({ p, tie: Math.random() }));
  pool.sort((a, b) =>
    mode === "random"
      ? a.tie - b.tie
      : opportunities(a.p.id, matches) - opportunities(b.p.id, matches) ||
        lastPlayed(a.p.id, matches) - lastPlayed(b.p.id, matches) ||
        a.tie - b.tie,
  );
  const selected = pool.slice(0, count * 4).map((x) => x.p);
  const groups: { teamA: string[]; teamB: string[] }[] = [];
  for (let i = 0; i + 3 < selected.length; i += 4) {
    let four = selected.slice(i, i + 4);
    const courtId = courtIds[groups.length];
    if (mode !== "random" && courtId) {
      const remaining = selected.slice(i);
      remaining.sort(
        (a, b) =>
          matches.filter(
            (m) =>
              m.courtId === courtId && [...m.teamA, ...m.teamB].includes(a.id),
          ).length -
          matches.filter(
            (m) =>
              m.courtId === courtId && [...m.teamA, ...m.teamB].includes(b.id),
          ).length,
      );
      four = remaining.slice(0, 4);
      selected.splice(
        i,
        selected.length - i,
        ...four,
        ...remaining.filter((p) => !four.includes(p)),
      );
    }
    const options = [
      [
        [0, 1],
        [2, 3],
      ],
      [
        [0, 2],
        [1, 3],
      ],
      [
        [0, 3],
        [1, 2],
      ],
    ];
    const cost = (o: number[][]) => {
      const a = o[0].map((n) => four[n].id),
        b = o[1].map((n) => four[n].id);
      let c = 0;
      for (const m of matches.filter((m) => m.status !== "cancelled")) {
        for (const t of [a, b])
          if (
            [m.teamA, m.teamB].some((old) => t.every((id) => old.includes(id)))
          )
            c += 8;
        for (const x of a)
          for (const y of b)
            if (
              (m.teamA.includes(x) && m.teamB.includes(y)) ||
              (m.teamB.includes(x) && m.teamA.includes(y))
            )
              c += 1;
      }
      if (mode === "balanced")
        c +=
          Math.abs(
            a.reduce((s, id) => s + statistics(id, matches).rate, 0) -
              b.reduce((s, id) => s + statistics(id, matches).rate, 0),
          ) / 10;
      return c;
    };
    if (mode !== "random") options.sort((a, b) => cost(a) - cost(b));
    const o = options[0];
    groups.push({
      teamA: o[0].map((n) => four[n].id),
      teamB: o[1].map((n) => four[n].id),
    });
  }
  return groups;
}

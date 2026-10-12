import type { Player, Match } from "@/types";
import { sessionStandings } from "@/lib/standings";
import { Avatar } from "@/components/players/PlayerCard";
export default function LeaderboardTable({
  players,
  matches,
  onPlayer,
}: {
  players: Player[];
  matches: Match[];
  onPlayer: (p: Player) => void;
}) {
  const rows = sessionStandings(players, matches);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank / Player</th>
            <th>Played</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win %</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, s }, i) => (
            <tr key={p.id}>
              <td>
                <button className="table-player" onClick={() => onPlayer(p)}>
                  <span className={i === 0 && s.games ? "rank first" : "rank"}>
                    {i + 1}
                  </span>
                  <Avatar player={p} />
                  {p.name}
                </button>
              </td>
              <td>{s.games}</td>
              <td>{s.wins}</td>
              <td>{s.losses}</td>
              <td>{s.rate.toFixed(0)}%</td>
              <td>
                {s.streak} <small> / best {s.best}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="empty-inline">Your crew’s rankings will appear here.</p>
      )}
    </div>
  );
}

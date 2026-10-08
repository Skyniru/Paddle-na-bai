import { Users, Grid2X2, CheckCheck, Coffee } from "lucide-react";
export default function StatsOverview({
  players,
  courts,
  games,
  waiting,
}: {
  players: number;
  courts: number;
  games: number;
  waiting: number;
}) {
  return (
    <div className="stats-grid">
      {[
        [Users, players, "Players in session"],
        [Grid2X2, courts, "Courts in play"],
        [CheckCheck, games, "Matches completed"],
        [Coffee, waiting, "Players waiting"],
      ].map(([Icon, value, label]) => {
        const I = Icon as typeof Users;
        return (
          <div className="stat" key={String(label)}>
            <I size={19} />
            <strong>{String(value)}</strong>
            <span>{String(label)}</span>
          </div>
        );
      })}
    </div>
  );
}

import type { Session, Player } from "@/types";
import { Avatar } from "@/components/players/PlayerCard";

export default function SessionQueue({
  session,
  players,
}: {
  session: Session;
  players: Player[];
}) {
  const queue = session.queue ?? { upNext: [], standby: [] };
  const group = (ids: string[]) =>
    ids.map((id) => {
      const player = players.find((p) => p.id === id);
      return (
        <li key={id}>
          <Avatar player={player} />
          <span>{player?.name ?? "Former player"}</span>
        </li>
      );
    });
  return (
    <section className="session-queue" aria-label="Waiting rotation">
      <div>
        <h2>Up Next</h2>
        <p className="muted">
          {queue.upNext.length === 4
            ? "This group plays on the next free court."
            : "Waiting for more players."}
        </p>
        <ol aria-label="Up Next players">{group(queue.upNext)}</ol>
      </div>
      <div>
        <h3>
          Standby <span className="count">{queue.standby.length}</span>
        </h3>
        <ol aria-label="Standby players">{group(queue.standby)}</ol>
        {!queue.standby.length && (
          <p className="muted">No other players waiting.</p>
        )}
      </div>
    </section>
  );
}

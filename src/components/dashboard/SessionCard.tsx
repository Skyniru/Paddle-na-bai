import { MapPin, ArrowUpRight } from "lucide-react";
import type { Session } from "@/types";
import SessionTimer from "./SessionTimer";
export default function SessionCard({
  session,
  onStart,
  onEnd,
}: {
  session: Session;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
    <section className="session-card">
      <div>
        <span className="eyebrow">
          <span className="dot" />
          {session.status === "active" ? "LIVE SESSION" : "READY WHEN YOU ARE"}
        </span>
        <h2>{session.name}</h2>
        <p>
          <MapPin size={16} />
          {session.venue}
        </p>
        <div className="session-tags">
          <span>
            {session.courtCount} {session.courtCount === 1 ? "court" : "courts"}
          </span>
          <span>{session.playerIds.length} players</span>
          <span>Open play</span>
        </div>
      </div>
      <SessionTimer session={session} />
      <div className="session-action">
        {session.status === "draft" ? (
          <button className="primary" onClick={onStart}>
            Start session <ArrowUpRight size={16} />
          </button>
        ) : (
          <button className="dark-button" onClick={onEnd}>
            End session <ArrowUpRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}

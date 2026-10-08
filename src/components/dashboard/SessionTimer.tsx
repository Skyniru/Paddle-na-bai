"use client";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { time } from "@/lib/utils";
import type { Session } from "@/types";
export default function SessionTimer({ session }: { session: Session }) {
  const seconds = useSessionTimer(session);
  return (
    <div className="timer">
      <small>SESSION TIME</small>
      <strong>{time(seconds)}</strong>
      <span>
        {session.duration
          ? seconds >= session.duration * 60
            ? "Planned time reached · keep playing or end session"
            : session.duration + " min planned"
          : "No rush. Enjoy the game."}
      </span>
    </div>
  );
}

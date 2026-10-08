"use client";
import { useEffect, useState } from "react";
import type { Session } from "@/types";
export function useSessionTimer(session?: Session) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return session?.startedAt
    ? Math.max(
        0,
        Math.floor(((session.endedAt ?? now) - session.startedAt) / 1000),
      )
    : 0;
}

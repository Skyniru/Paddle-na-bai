export type PlayerStatus = "active" | "resting" | "unavailable";
export interface RecordBase {
  id: string;
  createdAt: number;
  updatedAt: number;
}
export interface Player extends RecordBase {
  name: string;
  status: PlayerStatus;
  photo?: string;
}
export interface PlayerGroup extends RecordBase {
  name: string;
  playerIds: string[];
  photo?: string;
}
export interface Session extends RecordBase {
  continuous?: boolean;
  mode?: Mode;
  bannerPhoto?: string;
  queue?: { upNext: string[]; standby: string[] };
  attendance?: Record<
    string,
    { action: "check-in" | "check-out" | "undo-check-out"; at: number }[]
  >;
  round?: number;
  elapsedDuration?: number;
  playerStatuses?: Record<string, PlayerStatus>;
  name: string;
  venue: string;
  courtCount: number;
  playerIds: string[];
  status: "draft" | "active" | "completed";
  startedAt?: number;
  endedAt?: number;
  duration?: number;
}
export interface Court extends RecordBase {
  sessionId: string;
  number: number;
  reservationStart?: number;
  reservationEnd?: number;
  reservationHistory?: { start: number; end: number; changedAt: number }[];
}
export interface Match extends RecordBase {
  scoreDraft?: { a: string; b: string };
  resultHistory?: ResultChange[];
  sessionId: string;
  courtId: string;
  eligiblePlayerIds?: string[];
  teamA: string[];
  teamB: string[];
  status: "playing" | "completed" | "cancelled";
  winner?: "A" | "B";
  scoreA?: number;
  scoreB?: number;
  endedAt?: number;
}
export interface MatchResult {
  winner: "A" | "B";
  scoreA?: number;
  scoreB?: number;
}
export interface ResultChange {
  id: string;
  at: number;
  kind: "correction" | "undo";
  before: MatchResult;
  after: MatchResult;
}
export type Mode = "random" | "fair" | "balanced";
export interface Stats {
  id: string;
  games: number;
  wins: number;
  losses: number;
  rate: number;
  streak: number;
  best: number;
}

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
export interface Session extends RecordBase {
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
}
export interface Match extends RecordBase {
  sessionId: string;
  courtId: string;
  teamA: string[];
  teamB: string[];
  status: "playing" | "completed" | "cancelled";
  winner?: "A" | "B";
  scoreA?: number;
  scoreB?: number;
  endedAt?: number;
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

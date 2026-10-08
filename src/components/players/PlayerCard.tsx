import Image from "next/image";
import type { Player } from "@/types";
export function Avatar({ player }: { player?: Player }) {
  return (
    <span className="avatar">
      {player?.photo ? (
        <Image src={player.photo} alt="" width={60} height={60} unoptimized />
      ) : (
        player?.name
          .split(" ")
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "?"
      )}
    </span>
  );
}
export default function PlayerCard({
  player,
  onClick,
}: {
  player: Player;
  onClick: () => void;
}) {
  return (
    <button className="player-card" onClick={onClick}>
      <Avatar player={player} />
      <span>
        <strong>{player.name}</strong>
        <small>
          <i className={"status-dot " + player.status} />
          {player.status}
        </small>
      </span>
      <span className="arrow">↗</span>
    </button>
  );
}

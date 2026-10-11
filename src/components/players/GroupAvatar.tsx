import Image from "next/image";
import type { PlayerGroup } from "@/types";

export default function GroupAvatar({
  group,
}: {
  group: Pick<PlayerGroup, "name" | "photo">;
}) {
  return (
    <span className="group-avatar">
      {group.photo ? (
        <Image src={group.photo} alt="" width={96} height={96} unoptimized />
      ) : (
        <span aria-hidden="true">
          {group.name
            .trim()
            .split(/\s+/)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "GC"}
        </span>
      )}
    </span>
  );
}

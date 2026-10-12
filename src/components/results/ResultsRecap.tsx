"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Share2, Download, Medal } from "lucide-react";
import type { Session, Player, Match } from "@/types";
import { sessionStandings } from "@/lib/standings";
import { createResultsImages, saveResultsImages } from "@/lib/results-image";

export default function ResultsRecap({
  session,
  players,
  matches,
}: {
  session: Session;
  players: Player[];
  matches: Match[];
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const working = useRef(false);
  const winners = sessionStandings(players, matches)
    .filter((row) => row.s.games > 0)
    .slice(0, 3);
  async function exportResults(share: boolean) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage("Preparing your results...");
    try {
      const files = await createResultsImages(session, players, matches);
      setPages(files);
      if (share && navigator.canShare?.({ files }) && navigator.share) {
        try {
          await navigator.share({
            files,
            title: session.name,
            text: "PaddleBai final open-play results",
          });
          setMessage("Results shared.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setMessage("Sharing cancelled.");
            return;
          }
        }
      }
      const saved = await saveResultsImages(files);
      setMessage(
        saved === files.length
          ? `${saved} PNG ${saved === 1 ? "image" : "images"} ready to save. All ${players.length} players are included.${files.length > 1 ? " Allow multiple downloads, or save each image below." : ""}`
          : `Saved ${saved} of ${files.length} images. Saving cancelled.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not export results. Try again.",
      );
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="results-recap" aria-label="Final session recap">
      {session.bannerPhoto && (
        // The validated data URL is local and must also work in a static offline export.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="session-banner"
          src={session.bannerPhoto}
          alt={`Session photo for ${session.name}`}
        />
      )}
      <h2>{session.name}</h2>
      <p className="muted">
        {session.venue} ·{" "}
        {new Intl.DateTimeFormat("en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "long",
        }).format(session.startedAt ?? session.createdAt)}
      </p>
      <div className="results-podium" aria-label="Top three podium">
        {[1, 0, 2].map(
          (rank) =>
            winners[rank] && (
              <div key={rank} className={`podium-place podium-${rank + 1}`}>
                <Medal
                  aria-label={
                    ["Gold medal", "Silver medal", "Bronze medal"][rank]
                  }
                />
                <span>
                  {rank + 1}
                  {["st", "nd", "rd"][rank]} place
                </span>
                <strong>{winners[rank].p.name}</strong>
                <small>
                  {winners[rank].s.wins} wins ·{" "}
                  {winners[rank].s.rate.toFixed(0)}%
                </small>
              </div>
            ),
        )}
      </div>
      {!winners.length && (
        <p className="muted">No completed matches recorded.</p>
      )}
      <div className="recap-actions">
        <button
          className="primary"
          disabled={busy}
          onClick={() => exportResults(true)}
        >
          <Share2 size={18} />
          Share Results
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => exportResults(false)}
        >
          <Download size={18} />
          Save PNG
        </button>
        <Link className="secondary" href="/">
          Done
        </Link>
      </div>
      <p role="status">{message}</p>
      {pages.length > 1 && (
        <details>
          <summary>Save individual image pages</summary>
          <div className="recap-actions">
            {pages.map((file, index) => (
              <button
                key={file.name}
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  if (working.current) return;
                  working.current = true;
                  setBusy(true);
                  try {
                    const saved = await saveResultsImages([file]);
                    setMessage(
                      saved
                        ? `Image ${index + 1} of ${pages.length} ready to save.`
                        : "Saving cancelled.",
                    );
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Could not save this image. Try again.",
                    );
                  } finally {
                    working.current = false;
                    setBusy(false);
                  }
                }}
              >
                Save image {index + 1} of {pages.length}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

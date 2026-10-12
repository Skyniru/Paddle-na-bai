import type { Session, Player, Match } from "@/types";
import { sessionStandings } from "./standings";
import { isDesktopApp } from "./platform";

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        Error("The results image could not load its logo or photo. Try again."),
      );
    image.src = source;
  });
}

// Every player is exported. Page height stays bounded even for very large crews.
export async function createResultsImages(
  session: Session,
  players: Player[],
  matches: Match[],
): Promise<File[]> {
  if (session.status !== "completed")
    throw Error("End the session before sharing final results.");
  await document.fonts.ready;
  const logo = await loadImage("/icons/icon-192.png");
  const banner = session.bannerPhoto
    ? await loadImage(session.bannerPhoto)
    : null;
  const rows = sessionStandings(
    players,
    matches.filter((m) => m.sessionId === session.id),
  );
  const podium = rows.filter((row) => row.s.games > 0).slice(0, 3);
  const files: File[] = [];
  const pages = Math.max(1, Math.ceil(rows.length / 12));
  const date = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
  }).format(session.startedAt ?? session.createdAt);
  for (let page = 0; page < pages; page++) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height =
      1400 + (banner ? 260 : 0) + Math.min(12, rows.length - page * 12) * 180;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Image export is unavailable on this device.");
    const text = (
      value: string,
      x: number,
      y: number,
      size = 28,
      color = "#172b3a",
      weight = 500,
    ) => {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px "Geist Local", Arial`;
      ctx.fillText(value, x, y);
    };
    const lineCount = (
      value: string,
      width: number,
      size: number,
      weight: number,
    ) => {
      ctx.font = `${weight} ${size}px "Geist Local", Arial`;
      let lines = 1,
        line = "";
      for (const character of value) {
        if (ctx.measureText(line + character).width > width && line) {
          lines++;
          line = character;
        } else line += character;
      }
      return lines;
    };
    const wrap = (
      value: string,
      x: number,
      y: number,
      width: number,
      size: number,
      color = "#172b3a",
      weight = 500,
    ) => {
      ctx.font = `${weight} ${size}px "Geist Local", Arial`;
      let line = "";
      let lineCount = 0;
      // Character wrapping also handles long names without spaces.
      for (const character of value) {
        if (ctx.measureText(line + character).width > width && line) {
          text(line, x, y + lineCount * size * 1.25, size, color, weight);
          lineCount++;
          line = character;
        } else line += character;
      }
      if (line) {
        text(line, x, y + lineCount * size * 1.25, size, color, weight);
        lineCount++;
      }
      return Math.max(1, lineCount) * size * 1.25;
    };
    ctx.fillStyle = "#f5f7fa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(logo, 52, 40, 86, 86);
    text("PaddleBai", 156, 93, 46, "#126b5e", 750);
    text("FINAL OPEN-PLAY RESULTS", 52, 170, 25, "#526170", 650);
    const titleHeight = wrap(session.name, 52, 225, 976, 38, "#172b3a", 750);
    const venueHeight = wrap(
      session.venue,
      52,
      245 + titleHeight,
      976,
      28,
      "#526170",
    );
    let y = 280 + titleHeight + venueHeight;
    text(date, 52, y, 25, "#526170");
    y += 35;
    if (banner) {
      const scale = Math.max(976 / banner.width, 220 / banner.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(52, y, 976, 220);
      ctx.clip();
      ctx.drawImage(
        banner,
        52 + (976 - banner.width * scale) / 2,
        y + (220 - banner.height * scale) / 2,
        banner.width * scale,
        banner.height * scale,
      );
      ctx.restore();
      y += 250;
    }
    text("TOP THREE", 52, y + 35, 26, "#126b5e", 700);
    y += 65;
    const colors = ["#d6a93c", "#a9b7c4", "#bc8355"];
    const podiumHeight = Math.max(
      240,
      ...podium.map((row) => 155 + lineCount(row.p.name, 276, 28, 700) * 35),
    );
    for (const [position, rank] of [1, 0, 2].entries()) {
      const row = podium[rank];
      if (!row) continue;
      const x = 52 + position * 332,
        top = y + (rank === 0 ? 0 : 36);
      ctx.fillStyle = rank === 0 ? "#e7f4d0" : "#ffffff";
      ctx.fillRect(x, top, 312, podiumHeight);
      ctx.fillStyle = colors[rank];
      ctx.beginPath();
      ctx.arc(x + 156, top + 44, 28, 0, Math.PI * 2);
      ctx.fill();
      text(String(rank + 1), x + 148, top + 54, 28, "#172b3a", 750);
      wrap(row.p.name, x + 18, top + 105, 276, 28, "#172b3a", 700);
      text(
        `${row.s.wins} wins · ${row.s.rate.toFixed(0)}%`,
        x + 18,
        top + podiumHeight - 26,
        25,
        "#526170",
      );
    }
    if (!podium.length)
      text("No completed matches recorded.", 52, y + 100, 28, "#526170");
    y += podiumHeight + 75;
    text("FINAL STANDINGS", 52, y, 28, "#126b5e", 700);
    text(
      `Page ${page + 1} of ${pages} · ${rows.length} players`,
      650,
      y,
      25,
      "#526170",
    );
    y += 50;
    text("PLAYER", 110, y, 22, "#526170", 650);
    text("PLAYED", 630, y, 22, "#526170", 650);
    text("W", 765, y, 22, "#526170", 650);
    text("L", 855, y, 22, "#526170", 650);
    text("WIN %", 930, y, 22, "#526170", 650);
    y += 25;
    for (const [index, row] of rows
      .slice(page * 12, (page + 1) * 12)
      .entries()) {
      const rowHeight = Math.max(
        90,
        45 + lineCount(row.p.name, 480, 27, 650) * 34,
      );
      ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#eaf1f3";
      ctx.fillRect(52, y, 976, rowHeight);
      text(String(page * 12 + index + 1), 65, y + 44, 26, "#526170");
      wrap(row.p.name, 110, y + 35, 480, 27, "#172b3a", 650);
      text(String(row.s.games), 650, y + 52);
      text(String(row.s.wins), 770, y + 52);
      text(String(row.s.losses), 860, y + 52);
      text(row.s.rate.toFixed(0) + "%", 930, y + 52);
      y += rowHeight;
    }
    text("GOOD GAMES. GREAT COMPANY.", 52, y + 48, 23, "#526170");
    // Expand if unusually long session metadata exceeds the nominal page height.
    if (y + 70 > canvas.height)
      throw Error(
        "Session name or location is too long for image export. Shorten it and try again.",
      );
    const cropped = document.createElement("canvas");
    cropped.width = canvas.width;
    cropped.height = Math.ceil(y + 70);
    const output = cropped.getContext("2d");
    if (!output) throw Error("Image export is unavailable on this device.");
    output.drawImage(canvas, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      cropped.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(Error("Could not create the PNG image.")),
        "image/png",
      ),
    );
    files.push(
      new File([blob], `paddlebai-results-${session.id}-${page + 1}.png`, {
        type: "image/png",
      }),
    );
  }
  return files;
}

export async function saveResultsImages(files: File[]) {
  if (isDesktopApp()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    let saved = 0;
    for (const file of files) {
      const path = await save({
        title: "Save PaddleBai results",
        defaultPath: file.name,
        filters: [{ name: "PNG image", extensions: ["png"] }],
      });
      if (!path) return saved;
      await writeFile(path, new Uint8Array(await file.arrayBuffer()));
      saved++;
    }
    return saved;
  }
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return files.length;
}

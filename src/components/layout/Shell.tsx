"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CircleDot,
  Grid2X2,
  Trophy,
  Camera,
  Users,
  Menu,
  X,
  Sun,
  Moon,
  History,
  WifiOff,
  Settings,
} from "lucide-react";
const links = [
  ["/", "Play", CircleDot],
  ["/courts", "Courts", Grid2X2],
  ["/leaderboard", "Leaderboard", Trophy],
  ["/snaps", "Snaps", Camera],
  ["/players", "Players", Users],
] as const;
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("paddle-theme");
    const value = saved
      ? saved === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    requestAnimationFrame(() => setDark(value));
    document.documentElement.classList.toggle("dark", value);
    const update = () => setOffline(!navigator.onLine);
    requestAnimationFrame(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    )
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  function theme() {
    const v = !dark;
    setDark(v);
    localStorage.setItem("paddle-theme", v ? "dark" : "light");
    document.documentElement.classList.toggle("dark", v);
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="header">
        <Link href="/" className="brand">
          <span className="brand-icon">
            <CircleDot size={25} />
          </span>
          <span>
            PADDLE <b>NA BAI!</b>
            <small>GOOD GAMES. GREAT COMPANY.</small>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links.map(([href, label, Icon]) => (
            <Link
              className={path === href ? "selected" : ""}
              aria-current={path === href ? "page" : undefined}
              key={href}
              href={href}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <span className="local-badge">
            {offline ? <WifiOff size={13} /> : <span className="dot" />}
            {offline ? "Offline" : "Saved on device"}
          </span>
          <button
            className="icon-button"
            onClick={theme}
            aria-label="Toggle color theme"
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="Open secondary menu"
            aria-expanded={menu}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menu && (
          <div className="menu">
            <Link href="/history" onClick={() => setMenu(false)}>
              <History size={17} />
              Session history
            </Link>
            <button onClick={theme}>
              <Settings size={17} />
              Settings: {dark ? "dark" : "light"} theme
            </button>
            <p>
              Saved on this device.
              <br />
              Export a backup to keep a copy.
            </p>
          </div>
        )}
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {links.map(([href, label, Icon]) => (
          <Link
            className={path === href ? "selected" : ""}
            aria-current={path === href ? "page" : undefined}
            key={href}
            href={href}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}

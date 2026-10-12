"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OfflineStatus from "./OfflineStatus";
import DeveloperAbout from "./DeveloperAbout";
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
  ["/history", "History", History],
  ["/players", "Players", Users],
] as const;
export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  const [menuRoute, setMenuRoute] = useState<string | null>(null);
  const menu = menuRoute === path;
  useEffect(() => {
    if (menuRoute === null || menuRoute === path) return;
    const frame = requestAnimationFrame(() => setMenuRoute(null));
    return () => cancelAnimationFrame(frame);
  }, [path, menuRoute]);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  function closeMenu(restoreFocus = false) {
    setMenuRoute(null);
    if (restoreFocus) menuButton.current?.focus();
  }
  useEffect(() => {
    if (!menu) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuRoute(null);
        menuButton.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !menuPanel.current?.contains(target) &&
        !menuButton.current?.contains(target)
      )
        setMenuRoute(null);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [menu]);
  const [dark, setDark] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("paddle-theme");
    } catch {
      /* Theme still works when preference storage is blocked. */
    }
    const preference = matchMedia("(prefers-color-scheme: dark)");
    const value = saved === "dark" || (saved !== "light" && preference.matches);
    const systemTheme = () => {
      let current: string | null = null;
      try {
        current = localStorage.getItem("paddle-theme");
      } catch {
        /* Use system preference. */
      }
      if (current === "dark" || current === "light") return;
      setDark(preference.matches);
      document.documentElement.classList.toggle("dark", preference.matches);
    };
    preference.addEventListener("change", systemTheme);
    requestAnimationFrame(() => setDark(value));
    document.documentElement.classList.toggle("dark", value);
    const update = () => setOffline(!navigator.onLine);
    requestAnimationFrame(update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      preference.removeEventListener("change", systemTheme);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  function theme() {
    const v = !dark;
    setDark(v);
    try {
      localStorage.setItem("paddle-theme", v ? "dark" : "light");
    } catch {
      /* Keep the in-memory theme. */
    }
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width="48" height="48" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">PaddleBai</span>
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
              onClick={() => closeMenu()}
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
            ref={menuButton}
            onClick={() => setMenuRoute(menu ? null : path)}
            aria-label="Open secondary menu"
            aria-expanded={menu}
            aria-controls="secondary-navigation"
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        {menu && (
          <div ref={menuPanel} id="secondary-navigation" className="menu">
            <Link href="/snaps" onClick={() => closeMenu()}>
              <Camera size={17} />
              Snaps · Coming later
            </Link>
            <button
              onClick={() => {
                theme();
                closeMenu(true);
              }}
            >
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
      <OfflineStatus />
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
            onClick={() => closeMenu()}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <DeveloperAbout />
    </>
  );
}

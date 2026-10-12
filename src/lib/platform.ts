import { isTauri } from "@tauri-apps/api/core";

export function isDesktopApp() {
  return typeof window !== "undefined" && isTauri();
}

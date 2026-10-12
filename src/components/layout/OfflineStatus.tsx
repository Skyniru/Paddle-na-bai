"use client";
import { useEffect, useState } from "react";
import { isDesktopApp } from "@/lib/platform";
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export default function OfflineStatus() {
  const [status, setStatus] = useState("Offline files not prepared");
  const [update, setUpdate] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (isDesktopApp()) {
      const frame = requestAnimationFrame(() => {
        setDesktop(true);
        setStatus("Desktop app · bundled for offline play");
      });
      return () => cancelAnimationFrame(frame);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallPrompt);
    };
    const installed = () => {
      setInstall(null);
      setHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", installed);
    let alive = true;
    let registration: ServiceWorkerRegistration | undefined;
    async function check() {
      if (
        !("serviceWorker" in navigator) ||
        !navigator.serviceWorker.controller
      )
        return;
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        if (alive)
          setStatus(
            event.data.ready
              ? "Ready for offline play"
              : "Preparing offline files",
          );
        channel.port1.close();
      };
      navigator.serviceWorker.controller.postMessage("STATUS", [channel.port2]);
    }
    const controller = () => {
      if (alive) setUpdate(false);
      void check();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", controller);
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator &&
      window.isSecureContext
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async (reg) => {
          registration = reg;
          if (alive) {
            setStatus("Preparing offline files");
            setUpdate(!!reg.waiting && !!reg.active);
          }
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            installing?.addEventListener("statechange", () => {
              if (alive && reg.waiting && reg.active) setUpdate(true);
              if (alive && installing.state === "redundant" && !reg.active)
                setStatus(
                  "Offline setup failed. Reconnect and reload to retry.",
                );
            });
          });
          await navigator.serviceWorker.ready;
          await check();
        })
        .catch(() => {
          if (alive)
            setStatus("Offline setup failed. Reconnect and reload to retry.");
        });
    }
    const timer = window.setInterval(() => {
      void check();
      if (alive && registration?.waiting && registration.active)
        setUpdate(true);
    }, 10000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", installed);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controller,
      );
    };
  }, []);
  return (
    <aside className="offline-status" aria-label="Offline installation">
      <span role="status">{status}</span>
      {!desktop && (
        <button
          className="text-button"
          onClick={async () => {
            if (install) {
              await install.prompt();
              await install.userChoice;
              setInstall(null);
            } else setHelp(!help);
          }}
        >
          {install ? "Install app" : "Install guidance"}
        </button>
      )}
      {update && (
        <p>
          Update downloaded. Finish your session, close every app window and
          browser tab, then reopen to apply safely.
        </p>
      )}
      {help && (
        <p>
          Open over HTTPS (or desktop localhost). Wait for “Ready for offline
          play”. Use the browser’s Install app option. On iPhone/iPad, use
          Safari → Share → Add to Home Screen. Reopen once, then test with Wi-Fi
          and cellular off. Installation availability depends on your browser.
        </p>
      )}
    </aside>
  );
}

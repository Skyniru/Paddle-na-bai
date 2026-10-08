import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/layout/Shell";
export const metadata: Metadata = {
  title: "Paddle Na Bai!",
  description:
    "Your court. Your crew. Your game. Offline-first padel open play.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Paddle Na Bai!",
    statusBarStyle: "default",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#c4f34b",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/layout/Shell";
export const metadata: Metadata = {
  title: "PaddleBai",
  description:
    "Your court. Your crew. Your game. Offline-first padel open play.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PaddleBai",
    statusBarStyle: "default",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var saved;try{saved=localStorage.getItem('paddle-theme')}catch(e){}var dark=saved==='dark'||(saved!=='light'&&saved!=='dark'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)})();`,
          }}
        />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

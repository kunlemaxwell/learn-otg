import type { Metadata, Viewport } from "next";
import "@openuidev/react-ui/styles/index.css";
import "../styles/tokens.css";
import "./globals.css";
import "../styles/platform.css";
import "../styles/lesson.css";
import "../styles/workspace.css";
import { THEME_BOOT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Learn OTG",
  description: "Learning on the go: ask anything, build a course, and learn with visual lessons.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F3F5F1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        {/* OpenUI's Inspect widget auto-mounts bottom-right in development, over the chat. Turn that off; Settings can show it top-left. */}
        <script dangerouslySetInnerHTML={{ __html: `globalThis[Symbol.for("openui.devtools.autoMount")]=true;` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

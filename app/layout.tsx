// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

import ClientNav from "./_components/ClientNav";
import { ToastProvider } from "./_shared/ToastProvider";
import { GlobalOverlayProvider } from "./_shared/GlobalOverlay";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://itsreadyroster.com"),
  title: {
    default: "Ready Roster – Youth Wrestling Free-Agent Marketplace",
    template: "%s | Ready Roster",
  },
  description:
    "Connect athletes with teams, confirm matches, and streamline communication. Ready Roster is the digital free-agent marketplace for youth wrestling.",
  alternates: { canonical: "https://itsreadyroster.com" },
  openGraph: {
    type: "website",
    url: "https://itsreadyroster.com",
    siteName: "Ready Roster",
    title: "Ready Roster – Youth Wrestling Free-Agent Marketplace",
    description:
      "Connect athletes with teams, confirm matches, and streamline communication. Ready Roster is the digital free-agent marketplace for youth wrestling.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ready Roster" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ready Roster – Youth Wrestling Free-Agent Marketplace",
    description:
      "Connect athletes with teams, confirm matches, and streamline communication.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1220",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="antialiased bg-slate-950 text-white">
        <Providers>
          <ToastProvider>
            <GlobalOverlayProvider>
              <ClientNav />
              {children}
            </GlobalOverlayProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}

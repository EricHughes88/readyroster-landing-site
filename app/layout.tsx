// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

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
    images: [
      {
        url: "/og-image.png", // put this file in /public (1200x630 recommended)
        width: 1200,
        height: 630,
        alt: "Ready Roster",
      },
    ],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-white`}>
        {children}
      </body>
    </html>
  );
}

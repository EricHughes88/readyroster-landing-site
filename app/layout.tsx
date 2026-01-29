// app/layout.tsx
import "./globals.css";
import AppProviders from "./_providers/AppProviders";
import ClientNav from "./_components/ClientNav";
import type { ReactNode } from "react";

export const metadata = {
  title: "Ready Roster",
  description: "The digital free-agent marketplace for youth wrestling",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white">
        <AppProviders>
          {/* DEBUG STRIP — REMOVE AFTER CONFIRMATION */}
          <div className="bg-red-600 text-white text-xs px-3 py-1">
            NAV MOUNTED
          </div>

          <ClientNav />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}


import "./globals.css";
import AppProviders from "./_providers/AppProviders";
import ClientNav from "./_components/ClientNav";
import Footer from "./_components/Footer";
import type { ReactNode } from "react";

export const metadata = {
  title: "Ready Roster",
  description: "The digital free-agent marketplace for youth wrestling",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-white flex flex-col">
        <AppProviders>
          <ClientNav />
          <main className="flex-1">{children}</main>
          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}
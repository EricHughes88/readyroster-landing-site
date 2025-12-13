"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/app/_shared/ToastProvider";
import { GlobalOverlayProvider } from "@/app/_shared/GlobalOverlay";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ToastProvider>
        <GlobalOverlayProvider>
          {children}
        </GlobalOverlayProvider>
      </ToastProvider>
    </SessionProvider>
  );
}

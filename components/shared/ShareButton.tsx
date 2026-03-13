"use client";

import { useState } from "react";

type ShareButtonProps = {
  title?: string;
  text?: string;
  url?: string;
  className?: string;
};

export default function ShareButton({
  title = "Ready Roster",
  text = "Check this out on Ready Roster",
  url,
  className = "",
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const shareUrl =
      url || (typeof window !== "undefined" ? window.location.href : "");

    if (!shareUrl) return;

    try {
      // Native mobile share (iOS / Android)
      if (navigator.share) {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });
        return;
      }

      // Fallback copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Share failed:", err);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 transition ${className}`}
    >
      {copied ? "Link Copied!" : "Share Profile"}
    </button>
  );
}
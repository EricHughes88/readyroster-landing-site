"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountButton() {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This will remove your profile from Ready Roster and sign you out."
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        alert(data?.message || "Failed to delete account.");
        setLoading(false);
        return;
      }

      await signOut({ callbackUrl: "/" });
    } catch (error) {
      console.error("Delete account failed:", error);
      alert("Something went wrong while deleting your account.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-red-900/60 bg-slate-900 p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-red-400">Delete Account</h3>

      <p className="mt-2 text-sm text-slate-300">
        This will deactivate your Ready Roster account and remove your profile
        from active use.
      </p>

      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Deleting..." : "Delete My Account"}
      </button>
    </div>
  );
}
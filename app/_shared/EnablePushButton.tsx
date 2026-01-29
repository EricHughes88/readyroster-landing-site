"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function EnablePushButton() {
  const [loading, setLoading] = useState(false);

  async function enablePush() {
    setLoading(true);

    const raw = localStorage.getItem("rr_user");
    const userId = raw ? JSON.parse(raw)?.id : null;
    if (!userId) return alert("Not logged in");

    if (!("serviceWorker" in navigator)) return alert("Not supported");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.register("/sw.js");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        subscription: sub,
        userAgent: navigator.userAgent,
      }),
    });

    alert("Push notifications enabled!");
    setLoading(false);
  }

  return (
    <button
      onClick={enablePush}
      disabled={loading}
      className="px-4 py-2 rounded bg-red-600 hover:bg-red-500"
    >
      {loading ? "Enabling..." : "Enable Push Notifications"}
    </button>
  );
}

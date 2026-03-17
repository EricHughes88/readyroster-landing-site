// components/team/TeamLogoUploader.tsx
"use client";

import { useRef, useState } from "react";

type Props = {
  teamId?: number | null;
  onUploaded?: (logoUrl: string) => void;
};

export default function TeamLogoUploader({ teamId, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleUpload() {
    if (!file) {
      setMessage("Please choose a file first.");
      return;
    }

    if (!teamId || teamId <= 0) {
      setMessage("Missing team ID.");
      return;
    }

    try {
      setBusy(true);
      setMessage(null);

      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/team-logo/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData?.ok) {
        throw new Error(uploadData?.message || "Upload failed");
      }

      const saveRes = await fetch("/api/team-logo/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logoUrl: uploadData.publicUrl,
          teamId,
        }),
      });

      const saveData = await saveRes.json();

      if (!saveRes.ok || !saveData?.ok) {
        throw new Error(saveData?.message || "Saving logo failed");
      }

      setMessage("Logo uploaded successfully.");
      onUploaded?.(uploadData.publicUrl);
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    } catch (err: any) {
      setMessage(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid #334155",
        borderRadius: 12,
        padding: 16,
        background: "rgba(2,6,23,0.35)",
        marginTop: 16,
        maxWidth: 420,
      }}
    >
      <div style={{ color: "#fff", fontWeight: 800, marginBottom: 12 }}>
        Upload Team Logo
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const nextFile = e.target.files?.[0] ?? null;
          setFile(nextFile);
        }}
        style={{ display: "block", marginBottom: 12 }}
      />

      <button
        type="button"
        onClick={handleUpload}
        disabled={busy}
        className="rr-btn rr-btn-primary"
      >
        {busy ? "Uploading..." : "Upload Logo"}
      </button>

      {message ? (
        <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 14 }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
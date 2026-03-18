// components/team/TeamLogoUploader.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import TeamLogo from "@/components/team/TeamLogo";

type Props = {
  teamId?: number | null;
  teamName?: string | null;
  currentLogoPath?: string | null;
  onUploaded?: (logoUrl: string) => void | Promise<void>;
};

export default function TeamLogoUploader({
  teamId,
  teamName,
  currentLogoPath,
  onUploaded,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentLogoPath ?? null
  );
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(currentLogoPath ?? null);
    }
  }, [currentLogoPath, file]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

      setPreviewUrl(uploadData.publicUrl);
      setMessage("Logo uploaded successfully.");
      await onUploaded?.(uploadData.publicUrl);
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

      <div style={{ marginBottom: 14 }}>
        <TeamLogo
          logoPath={previewUrl}
          teamName={teamName || "Team"}
          size={72}
          rounded={false}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const nextFile = e.target.files?.[0] ?? null;
          setMessage(null);

          if (previewUrl && previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(previewUrl);
          }

          setFile(nextFile);

          if (nextFile) {
            const objectUrl = URL.createObjectURL(nextFile);
            setPreviewUrl(objectUrl);
          } else {
            setPreviewUrl(currentLogoPath ?? null);
          }
        }}
        style={{ display: "block", marginBottom: 12, color: "#cbd5e1" }}
      />

      {file ? (
        <div style={{ marginBottom: 12, color: "#cbd5e1", fontSize: 14 }}>
          Selected: {file.name}
        </div>
      ) : null}

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
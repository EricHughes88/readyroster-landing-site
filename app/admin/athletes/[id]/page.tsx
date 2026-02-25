"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type AthleteDetail = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  state: string | null;
  dob: string | null;
  parent_user_id: number | null;

  parent_firstname: string | null;
  parent_lastname: string | null;
  parent_email: string | null;
  parent_phone: string | null;
};

export default function AdminAthleteDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [row, setRow] = useState<AthleteDetail | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/admin/athletes/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok || !json?.ok) throw new Error(json?.message || "Failed loading athlete");

        if (cancelled) return;
        setRow(json.row ?? null);
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (Number.isFinite(id) && id > 0) load();
    else {
      setLoading(false);
      setErr("Invalid athlete id");
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  const athleteName = useMemo(() => {
    if (!row) return "";
    return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  }, [row]);

  const parentName = useMemo(() => {
    if (!row) return "";
    return `${row.parent_firstname ?? ""} ${row.parent_lastname ?? ""}`.trim();
  }, [row]);

  const location = useMemo(() => {
    if (!row) return "";
    return [row.city, row.state].filter(Boolean).join(", ");
  }, [row]);

  return (
    <main style={{ padding: 20, maxWidth: 1000, margin: "0 auto", color: "#e5e7eb" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, color: "#fff" }}>
            {loading ? "Loading…" : athleteName || "Athlete Profile"}
          </h1>
          <p style={{ marginTop: 6, color: "#94a3b8" }}>
            Profile details from <code>admin_athletes_directory</code>.
          </p>
        </div>

        <Link href={"/admin/athletes" as any} style={{ color: "#cbd5e1", textDecoration: "underline" }}>
          ← Back to directory
        </Link>
      </div>

      {err && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            border: "1px solid #f99",
            borderRadius: 10,
            background: "#fff5f5",
            color: "#111",
          }}
        >
          <b>Error:</b> {err}
        </div>
      )}

      <section style={{ marginTop: 16, border: "1px solid #334155", borderRadius: 12, padding: 14 }}>
        {!row ? (
          <div style={{ color: "#94a3b8" }}>{loading ? "Loading…" : "No record found."}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Athlete</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{athleteName || "—"}</div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Location</div>
              <div style={{ color: "#fff", fontWeight: 700 }}>{location || "—"}</div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>DOB</div>
              <div style={{ color: "#fff", fontWeight: 700 }}>
                {row.dob ? new Date(row.dob).toLocaleDateString() : "—"}
              </div>
            </div>

            <div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Parent User ID</div>
              <div style={{ color: "#fff", fontWeight: 700 }}>{row.parent_user_id ?? "—"}</div>
            </div>

            {/* Parent contact */}
            <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #334155", paddingTop: 12 }}>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>Parent Contact</div>

              <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Name</div>
                  <div style={{ color: "#fff", fontWeight: 700 }}>{parentName || "—"}</div>
                </div>

                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Email</div>
                  {row.parent_email ? (
                    <a href={`mailto:${row.parent_email}`} style={{ color: "#fff", textDecoration: "underline" }}>
                      {row.parent_email}
                    </a>
                  ) : (
                    <div style={{ color: "#94a3b8" }}>—</div>
                  )}
                </div>

                <div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Phone</div>
                  <div style={{ color: "#fff", fontWeight: 700 }}>{row.parent_phone || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
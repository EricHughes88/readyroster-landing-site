"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditItem = {
  id: number;
  admin_user_id: number;
  admin_email: string | null;
  admin_firstname: string | null;
  admin_lastname: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  metadata: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

type AuditResponse = {
  ok: boolean;
  items?: AuditItem[];
  message?: string;
  warning?: string;
};

type SessionUser = {
  id?: string | number;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  isSuperAdmin?: boolean;
};

function niceName(i: AuditItem) {
  const n = [i.admin_firstname, i.admin_lastname].filter(Boolean).join(" ").trim();
  return n || i.admin_email || `Admin #${i.admin_user_id}`;
}

function isAllowedSuperAdmin(user: SessionUser | null) {
  const email = String(user?.email ?? "").trim().toLowerCase();
  const superEmails = [
    "eric@nuwaycombat.com",
    "brittaustin1031@gmail.com",
  ];

  return Boolean(user?.isSuperAdmin) || superEmails.includes(email);
}

export default function AdminActivityPage() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErr(null);

        const sessionRes = await fetch("/api/auth/session", { cache: "no-store" });
        const sessionData = sessionRes.ok ? await sessionRes.json() : null;
        const user = (sessionData?.user as SessionUser) ?? null;

        const canView = isAllowedSuperAdmin(user);

        if (cancelled) return;
        setAllowed(canView);

        if (!canView) {
          setErr("Access denied");
          setItems([]);
          return;
        }

        const res = await fetch("/api/admin/audit?limit=100", { cache: "no-store" });
        const data: AuditResponse = await res.json();

        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || "Failed to load admin activity");
        }

        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="rr-container">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href="/admin"
          className="text-sm text-slate-400 hover:text-white underline"
        >
          ← Back to Admin
        </Link>

        <div className="text-xs text-slate-400">
          {loading ? "Loading…" : `${items.length} recent actions`}
        </div>
      </div>

      <div className="rr-card">
        <h1 className="text-2xl font-semibold mb-2">Admin Activity</h1>
        <p className="text-slate-300 mb-6">Recent admin actions (audit log).</p>

        {err ? (
          <div className="rr-alert rr-alert-error mb-4">{err}</div>
        ) : null}

        {!loading && allowed === false ? (
          <div className="text-sm text-slate-400">
            You do not have permission to view this page.
          </div>
        ) : loading ? (
          <div className="text-sm text-slate-400">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-slate-400">No admin activity yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((i) => (
              <div
                key={i.id}
                className="border border-slate-800 rounded-lg p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-white">
                    <span className="font-semibold">{niceName(i)}</span>{" "}
                    <span className="text-slate-300">•</span>{" "}
                    <span className="text-slate-200">{i.action}</span>
                    {i.entity_type ? (
                      <>
                        <span className="text-slate-300"> • </span>
                        <span className="text-slate-300">
                          {i.entity_type}
                          {i.entity_id ? ` #${i.entity_id}` : ""}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(i.created_at).toLocaleString()}
                  </div>
                </div>

                {i.metadata ? (
                  <pre className="mt-2 text-xs text-slate-300 overflow-auto bg-slate-900 border border-slate-800 rounded-md p-2">
                    {JSON.stringify(i.metadata, null, 2)}
                  </pre>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
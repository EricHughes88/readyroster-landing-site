// app/parent/wrestlers/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Wrestler = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  age_group: string | null;
  weight_class: string | null;
};

export default function ParentWrestlersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [wrestlers, setWrestlers] = useState<Wrestler[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    // If not authenticated OR missing user id -> redirect to login
    if (status !== "authenticated" || !session?.user?.id) {
      router.replace("/login?next=/parent/wrestlers");
      return;
    }

    // From here on, session.user.id is defined
    const userId = Number(session.user.id);

    (async () => {
      try {
        const res = await fetch(`/api/parent/${userId}/wrestlers`, {
          cache: "no-store",
        });

        if (!res.ok) {
          let text: string;
          try {
            const body = await res.json();
            text = JSON.stringify(body);
          } catch {
            text = await res.text();
          }
          throw new Error(
            `Failed to load wrestlers (${res.status}): ${text}`
          );
        }

        const data = await res.json();
        setWrestlers(data?.wrestlers ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load wrestlers");
      } finally {
        setLoading(false);
      }
    })();
  }, [status, session, router]);

  if (status === "loading" || loading)
    return <div className="p-6">Loading wrestlers…</div>;
  if (err) return <div className="p-6 text-red-600">Error: {err}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Wrestlers</h1>
        <Link href="/parent/wrestlers/new" className="underline">
          + Add Wrestler
        </Link>
      </div>

      {wrestlers.length === 0 ? (
        <div className="text-gray-600">
          No wrestlers yet.{" "}
          <Link href="/parent/wrestlers/new" className="underline">
            Add your first
          </Link>
          .
        </div>
      ) : (
        <ul className="space-y-3">
          {wrestlers.map((w) => (
            <li key={w.id} className="border rounded p-4">
              <div className="font-medium">
                {(w.first_name ?? "").trim()}{" "}
                {(w.last_name ?? "").trim()}
              </div>
              <div className="text-sm text-gray-600">
                {w.age_group ?? "—"} · {w.weight_class ?? "—"}
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <Link
                  href={`/parent/wrestlers/${w.id}`}
                  className="underline"
                >
                  View
                </Link>
                <Link
                  href={`/parent/wrestlers/${w.id}/interests`}
                  className="underline"
                >
                  Interests
                </Link>
                <Link
                  href={`/parent/wrestlers/${w.id}/matches`}
                  className="underline"
                >
                  Matches
                </Link>
                <Link
                  href={`/parent/wrestlers/${w.id}/messages`}
                  className="underline"
                >
                  Messages
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Resp = {
  ok: boolean;
  total: number;
  pending: number;
  confirmed: number;
  message?: string;
};

export default function MatchesCountButtons({ wrestlerId }: { wrestlerId: number }) {
  const [counts, setCounts] = useState<{ pending: number; confirmed: number } | null>(null);

  useEffect(() => {
    let on = true;
    fetch(`/api/wrestlers/${wrestlerId}/matches/count`)
      .then(r => r.json() as Promise<Resp>)
      .then(d => {
        if (!on) return;
        if (d.ok) setCounts({ pending: d.pending ?? 0, confirmed: d.confirmed ?? 0 });
        else setCounts({ pending: 0, confirmed: 0 });
      })
      .catch(() => on && setCounts({ pending: 0, confirmed: 0 }));
    return () => { on = false; };
  }, [wrestlerId]);

  const P = counts?.pending ?? 0;
  const C = counts?.confirmed ?? 0;

  return (
    <>
      <Link
        href={`/parent/wrestlers/${wrestlerId}/matches?status=pending`}
        className="px-3 py-2 rounded-md bg-white/5 ring-1 ring-inset ring-white/10 text-sm hover:bg-white/10"
      >
        Pending <span className="ml-1 text-xs opacity-80">({P})</span>
      </Link>
      <Link
        href={`/parent/wrestlers/${wrestlerId}/matches?status=confirmed`}
        className="px-3 py-2 rounded-md bg-white/5 ring-1 ring-inset ring-white/10 text-sm hover:bg-white/10"
      >
        Confirmed <span className="ml-1 text-xs opacity-80">({C})</span>
      </Link>
    </>
  );
}

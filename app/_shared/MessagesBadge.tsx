"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CountResp = {
  ok: boolean;
  total: number;
  unread?: number | null;
  message?: string;
};

export default function MessagesBadge({
  wrestlerId,
  showUnreadFirst = true,
}: {
  wrestlerId: number;
  showUnreadFirst?: boolean;
}) {
  const [count, setCount] = useState<{ total: number; unread?: number | null } | null>(null);

  useEffect(() => {
    let on = true;
    fetch(`/api/wrestlers/${wrestlerId}/messages/count`)
      .then((r) => r.json() as Promise<CountResp>)
      .then((d) => {
        if (!on) return;
        if (d.ok) setCount({ total: d.total, unread: d.unread ?? null });
        else setCount({ total: 0, unread: 0 });
      })
      .catch(() => on && setCount({ total: 0, unread: 0 }));
    return () => {
      on = false;
    };
  }, [wrestlerId]);

  const bubble =
    count?.unread != null && showUnreadFirst && (count.unread ?? 0) > 0
      ? count!.unread!
      : count?.total ?? 0;

  return (
    <Link
      href={`/parent/wrestlers/${wrestlerId}/messages`}
      className="relative px-3 py-2 rounded-md bg-white/5 ring-1 ring-inset ring-white/10 text-sm hover:bg-white/10"
      title="Open messages"
    >
      Messages
      <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1 text-xs rounded-full bg-white/10 ring-1 ring-inset ring-white/15">
        {bubble}
      </span>
    </Link>
  );
}

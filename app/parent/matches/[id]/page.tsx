// app/parent/matches/[id]/page.tsx
"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ParentMatchRedirectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = params.id;
    if (!id) return;

    const qs = searchParams.toString();
    const suffix = qs ? `?${qs}` : "";
    router.replace(`/matches/${id}${suffix}`);
  }, [router, params, searchParams]);

  return null; // just redirects
}

// app/access-denied/page.tsx
import Link from "next/link";

export default function AccessDeniedPage({
  searchParams,
}: {
  searchParams?: { to?: string };
}) {
  const to = searchParams?.to ? decodeURIComponent(searchParams.to) : null;

  return (
    <main className="rr-container">
      <div className="rr-card">
        <h1 className="text-2xl font-semibold mb-2">Access denied</h1>
        <p className="text-slate-300 mb-4">
          You don’t have permission to view {to ? <b>{to}</b> : "this page"}.
        </p>

        <div className="flex gap-3 flex-wrap">
          <Link href="/" className="rr-btn">
            Back to Home
          </Link>
          <Link href="/login" className="rr-btn rr-btn-primary">
            Log in with a different account
          </Link>
        </div>
      </div>
    </main>
  );
}
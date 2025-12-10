// app/loading.tsx
export default function Loading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        <span className="text-sm text-slate-200">Loading…</span>
      </div>
    </div>
  );
}

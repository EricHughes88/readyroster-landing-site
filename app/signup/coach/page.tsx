"use client";
import Link from "next/link";

export default function SignupCoach() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full bg-slate-900/70 border border-slate-800 rounded-2xl p-8">
        <h1 className="text-2xl font-bold mb-4">Sign up — Coach</h1>
        <p className="text-slate-400 mb-6">Placeholder page (we’ll connect real auth next).</p>
        <div className="flex gap-3">
          <Link href="/signup" className="px-4 py-2 rounded border border-slate-700">Back</Link>
          <Link href="/login" className="px-4 py-2 rounded bg-red-600 hover:bg-red-700">Continue to Log In</Link>
        </div>
      </div>
    </main>
  );
}

// app/messages/match/[matchId]/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSessionUser } from "@/lib/session";

type RRRole = "Coach" | "Parent" | "Athlete" | "Admin";

type Message = {
  id?: number;
  match_id?: number | null;
  sender_id?: number | null;
  receiver_id?: number | null;

  body?: string | null;
  message_text?: string | null;
  message?: string | null;
  text?: string | null;
  content?: string | null;

  created_at?: string | null;
  sent_at?: string | null;
  timestamp?: string | null;
  created?: string | null;
  sentAt?: string | null;
};

type Participants = {
  coach?: { id?: number | null; name?: string | null };
  parent?: { id?: number | null; name?: string | null };
};

function pickTimestamp(m: Message): string {
  return (
    m.created_at ||
    m.sent_at ||
    m.timestamp ||
    m.created ||
    m.sentAt ||
    new Date().toISOString()
  );
}

function pickMessageText(m: Message): string {
  return m.body ?? m.message_text ?? m.message ?? m.text ?? m.content ?? "";
}

function makeKey(m: Message): string {
  const t = pickTimestamp(m);
  const txt = pickMessageText(m).slice(0, 12);
  return `${m.id ?? Math.random()}-${t}-${txt}`;
}

function initials(name?: string | null) {
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Avatar({ name, mine }: { name: string; mine?: boolean }) {
  return (
    <div
      className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-bold ${
        mine ? "bg-rose-600/80 text-white" : "bg-slate-700 text-slate-100"
      }`}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}

export default function MatchChatPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();
  const matchId = Number(params.matchId);

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState<RRRole | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participants | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boxRef = useRef<HTMLDivElement>(null);

  // Load user session from localStorage
  useEffect(() => {
    const u = getSessionUser();
    if (!u) {
      router.push("/login");
      return;
    }
    setCurrentUserId(Number(u.id));
    setCurrentRole((u.role as RRRole) ?? "Parent");
    setSessionChecked(true);
  }, [router]);

  // Load + poll messages
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/messages/${matchId}?userId=${currentUserId}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!cancelled) {
          setMessages(Array.isArray(data?.messages) ? data.messages : []);
          setParticipants(data?.participants ?? null);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(String(err?.message ?? err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchId, currentUserId]);

  // Auto-scroll
  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const isCoach = currentRole === "Coach";

  const myName =
    participants && currentUserId
      ? isCoach
        ? participants.coach?.name || "You"
        : participants.parent?.name || "You"
      : "You";

  const otherName =
    participants && currentUserId
      ? isCoach
        ? participants.parent?.name || "Parent"
        : participants.coach?.name || "Coach"
      : "Parent";

  async function handleSend() {
    if (!currentUserId) return;

    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    // optimistic message
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      match_id: matchId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await fetch(`/api/messages/${matchId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: currentUserId, text }),
      });

      const data = await res.json();

      if (data?.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      } else {
        const refresh = await fetch(
          `/api/messages/${matchId}?userId=${currentUserId}`
        );
        const fresh = await refresh.json();
        setMessages(Array.isArray(fresh?.messages) ? fresh.messages : []);
      }

      setError(null);
    } catch (err: any) {
      setError(String(err?.message ?? err));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  if (!sessionChecked || !currentUserId) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
        <div>Loading your session…</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      {/* Back to inbox */}
      <div className="mb-3">
        <button
          onClick={() => router.push("/parent/messages")}
          className="text-slate-300 hover:text-white text-sm"
        >
          ← Back to messages
        </button>
      </div>

      <h1 className="text-xl font-bold mb-4">
        Messages with {otherName}
      </h1>

      {error && (
        <div className="mb-3 rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm">
          {error}
        </div>
      )}

      <div
        ref={boxRef}
        className="rounded-2xl p-4 min-h-[280px] max-h-[440px] overflow-auto bg-slate-800/40 border border-slate-700"
      >
        {loading ? (
          <div className="opacity-60 text-sm">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="opacity-60 text-sm">No messages yet.</div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m) => {
              const mine = currentUserId === Number(m.sender_id);
              const timestamp = pickTimestamp(m);
              const text = pickMessageText(m);
              const name = mine ? myName || "You" : otherName || "Parent";

              return (
                <li
                  key={makeKey(m)}
                  className={`flex items-start gap-2 ${
                    mine ? "justify-end" : "justify-start"
                  }`}
                >
                  {!mine && <Avatar name={name} />}

                  <div className={`max-w-[70%] ${mine ? "order-1" : ""}`}>
                    <div
                      className={`text-[11px] mb-1 ${
                        mine
                          ? "text-rose-300 text-right"
                          : "text-slate-300"
                      }`}
                    >
                      <span className="font-semibold">
                        {mine ? "You" : name}
                      </span>{" "}
                      <span className="opacity-70">
                        ·{" "}
                        {new Date(timestamp).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div
                      className={`rounded-2xl px-3 py-2 text-sm ${
                        mine
                          ? "bg-rose-600 text-white"
                          : "bg-slate-800 text-slate-100"
                      }`}
                    >
                      {text || (
                        <span className="opacity-60">(no text)</span>
                      )}
                    </div>
                  </div>

                  {mine && <Avatar name={name} mine />}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <input
          className="flex-1 rounded-lg px-3 py-2 bg-slate-800/60 border border-slate-700 outline-none"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-lg px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </main>
  );
}

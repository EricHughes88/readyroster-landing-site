"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AnyRow = Record<string, any>;

type Message = {
  messageId: number;
  matchId: number;
  senderId: number | null;
  receiverId: number | null;
  messageText: string;
  sentAt: string;
};

// Heuristic: if the API uses an unexpected column for the body, grab the first stringy field
function pickTextHeuristic(r: AnyRow): string | undefined {
  const candidates = Object.keys(r).filter((k) =>
    /(message|text|body|content)/i.test(k)
  );
  for (const k of candidates) {
    const v = r[k];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

function normalize(rows: AnyRow[] = []): Message[] {
  return rows.map((r) => {
    const messageText =
      r.messageText ??
      r.body ??
      r.text ??
      r.message ??
      r.content ??
      r.message_text ??
      pickTextHeuristic(r) ??
      "";

    const sentAt =
      r.sentAt ??
      r.created_at ??
      r.sent_at ??
      r.createdon ??
      r.created_on ??
      r.timestamp ??
      r.created ??
      new Date().toISOString();

    return {
      messageId:
        r.messageId ?? r.id ?? r.message_id ?? r.msg_id ?? Math.floor(Math.random() * 1e12),
      matchId: r.matchId ?? r.match_id ?? r.matchid ?? 0,
      senderId:
        r.senderId ??
        r.sender_id ??
        r.sender_user_id ??
        r.from_user_id ??
        r.from_id ??
        r.sender ??
        null,
      receiverId:
        r.receiverId ??
        r.receiver_id ??
        r.receiver_user_id ??
        r.to_user_id ??
        r.to_id ??
        r.receiver ??
        null,
      messageText,
      sentAt,
    };
  });
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 300)}`);
  if (!ct.includes("application/json")) throw new Error(`Expected JSON, got: ${text.slice(0, 120)}`);
  return JSON.parse(text);
}

export default function MessagesPanel({
  matchId,
  currentUserId,
}: {
  matchId: number;
  currentUserId: number;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [rawFirst, setRawFirst] = useState<AnyRow | null>(null); // debug: first raw row
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const url = useMemo(() => `/api/messages/${matchId}`, [matchId]);

  useEffect(() => {
    let on = true;
    let timer: any;

    const load = async () => {
      try {
        const data = await fetchJson(url);
        if (!on) return;

        // DEBUG: inspect first row (also log to console)
        const first = Array.isArray(data?.messages) && data.messages.length ? data.messages[0] : null;
        setRawFirst(first);
        if (first) console.log("First message row from API:", first);

        setMessages(normalize(data?.messages));
        setErr(null);
      } catch (e: any) {
        if (!on) return;
        setErr(String(e?.message ?? e));
      } finally {
        if (on) setLoading(false);
      }
    };

    const loop = () => (timer = setTimeout(() => load().then(loop), 6000));
    load().then(loop);

    return () => {
      on = false;
      clearTimeout(timer);
    };
  }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    // optimistic
    const tmpId = -Date.now();
    const optimistic: Message = {
      messageId: tmpId,
      matchId,
      senderId: currentUserId,
      receiverId: null,
      messageText: text,
      sentAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const data = await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderId: currentUserId, text }),
      });

      const createdRow = data?.message;
      if (createdRow) {
        const created = normalize([createdRow])[0];
        setMessages((m) => m.map((x) => (x.messageId === tmpId ? created : x)));
      } else {
        const refetched = await fetchJson(url);
        setMessages(normalize(refetched?.messages));
      }
      setErr(null);
    } catch (e: any) {
      setMessages((m) => m.filter((x) => x.messageId !== tmpId));
      setInput(text);
      setErr(String(e?.message ?? e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">Messages</span>
        <span className="text-xs opacity-60">
          {loading ? "Loading…" : `${messages.length} message${messages.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {/* DEBUG: show first row keys to verify field names (remove after it works) */}
      {rawFirst && (
        <div className="text-[10px] opacity-60 break-all">
          fields: {Object.keys(rawFirst).join(", ")}
        </div>
      )}

      {err && (
        <div className="rounded-md bg-red-900/30 border border-red-500/50 p-3 text-sm">
          {err}
        </div>
      )}

      <div
        ref={boxRef}
        className="rounded-2xl p-4 min-h-[260px] max-h-[420px] overflow-auto bg-slate-800/40 border border-slate-700"
      >
        {loading ? (
          <div className="opacity-60 text-sm">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="opacity-60 text-sm">No messages yet.</div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.messageId} className="flex flex-col">
                <div className="text-xs opacity-60">
                  {new Date(m.sentAt).toLocaleString()}
                </div>
                <div
                  className={`rounded-lg px-3 py-2 text-slate-200 ${
                    m.senderId === currentUserId ? "bg-red-700/60" : "bg-slate-700/60"
                  }`}
                >
                  {m.messageText || <span className="opacity-60">(no text)</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg px-3 py-2 bg-slate-800/60 border border-slate-700 outline-none"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
        />
        <button
          className="rounded-lg px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50"
          onClick={onSend}
          disabled={sending || !input.trim()}
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}

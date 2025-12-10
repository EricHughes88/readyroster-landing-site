// app/parent/messages/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MatchRow = {
  id: number;
  team_name?: string | null;
  coach_name?: string | null;
  event_name?: string | null;
  status?:
    | "pending"
    | "confirmed"
    | "declined"
    | "cancelled"
    | string
    | null;
};

type MatchesApiResponse = {
  ok: boolean;
  matches: MatchRow[];
};

type Message = {
  id: number;
  match_id: number;
  sender_id: number | null;
  receiver_id: number | null;
  message_text: string;
  sent_at: string;
};

type MessagesApiResponse = {
  ok: boolean;
  messages: Message[];
  participants?: {
    coach?: { id: number | null; name: string | null };
    parent?: { id: number | null; name: string | null };
  };
};

type InboxItem = {
  matchId: number;
  coachName: string;
  eventName: string;
  lastMessage: string;
  lastSentAt: string | null;
};

export default function ParentMessagesInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInbox() {
      try {
        setLoading(true);

        // 1️⃣ Get logged-in parent from localStorage
        let parentUserId: number | null = null;
        try {
          const raw = localStorage.getItem("rr_user");
          if (raw) {
            const u = JSON.parse(raw);
            if (u?.id) parentUserId = Number(u.id);
          }
        } catch (err) {
          console.error("Error reading rr_user from localStorage:", err);
        }

        if (!parentUserId) {
          console.warn("No parent user id found; cannot load inbox.");
          setItems([]);
          setLoading(false);
          return;
        }

        // 2️⃣ Load all matches for this parent
        const qs = `?parentUserId=${parentUserId}&status=all&page=1&limit=50`;
        const matchesRes = await fetch(`/api/matches${qs}`);
        const matchesData: MatchesApiResponse = await matchesRes.json();

        if (!matchesData.ok) {
          console.error("Failed to load matches for inbox:", matchesData);
          setItems([]);
          setLoading(false);
          return;
        }

        const matches = matchesData.matches || [];

        // 3️⃣ For each match, load its messages and take the latest
        const inboxPromises = matches.map(
          async (m): Promise<InboxItem | null> => {
            try {
              const msgRes = await fetch(`/api/messages/${m.id}`);
              const msgData: MessagesApiResponse = await msgRes.json();
              if (!msgData.ok) return null;

              const messages = msgData.messages || [];
              if (!messages.length) return null; // skip matches with no messages

              const last = messages[messages.length - 1];

              const coachName =
                msgData.participants?.coach?.name ||
                m.coach_name ||
                "Coach";

              const eventName = m.event_name ?? "Event";

              return {
                matchId: m.id,
                coachName,
                eventName,
                lastMessage: last.message_text,
                lastSentAt: last.sent_at,
              };
            } catch (err) {
              console.error("Error loading messages for match", m.id, err);
              return null;
            }
          }
        );

        const inboxItems = (await Promise.all(inboxPromises)).filter(
          (x): x is InboxItem => x !== null
        );

        // 4️⃣ Sort newest conversations first
        inboxItems.sort((a, b) => {
          const ta = a.lastSentAt ? new Date(a.lastSentAt).getTime() : 0;
          const tb = b.lastSentAt ? new Date(b.lastSentAt).getTime() : 0;
          return tb - ta;
        });

        setItems(inboxItems);
      } catch (err) {
        console.error("Error loading inbox:", err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadInbox();
  }, []);

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold mb-2">Messages</h1>
      <p className="text-gray-400 mb-6">
        View and continue conversations with coaches for your wrestler&apos;s
        matches.
      </p>

      <div className="mb-4">
        <Link
          href="/parent"
          className="inline-flex items-center rounded-md border border-white/10 px-3 py-1 text-sm hover:bg-white/10"
        >
          ← Back to dashboard
        </Link>
      </div>

      {loading && (
        <p className="text-gray-400">Loading your conversations...</p>
      )}

      {!loading && items.length === 0 && (
        <p className="text-gray-400">
          You don&apos;t have any message conversations yet. Once you start
          messaging a coach about a match, those conversations will appear here.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <Link
              key={item.matchId}
              href={`/messages/match/${item.matchId}`}
              className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <div className="font-medium">
                  {item.coachName}
                  <span className="text-xs text-gray-400 ml-2">
                    • {item.eventName}
                  </span>
                </div>
                {item.lastSentAt && (
                  <div className="text-xs text-gray-400">
                    {new Date(item.lastSentAt).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-300 truncate">
                {item.lastMessage}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

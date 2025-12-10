// lib/session.ts

export type RRUser = {
  id: number;
  role?: "coach" | "parent" | string | null;
  type?: "coach" | "parent" | string | null;
  [k: string]: any;
};

export function getSessionUser(): RRUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("rr_user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== "object") return null;
    return u as RRUser;
  } catch {
    return null;
  }
}

export function userIsCoach(u: RRUser | null | undefined) {
  const r = (u?.role ?? u?.type ?? "").toString().toLowerCase();
  return r === "coach";
}

export function userIsParent(u: RRUser | null | undefined) {
  const r = (u?.role ?? u?.type ?? "").toString().toLowerCase();
  return r === "parent";
}

export function buildMatchesQS(opts: {
  user: RRUser;
  status: "pending" | "confirmed" | "all";
  needId?: string | null;
  wrestlerId?: string | null;
}) {
  const { user, status, needId, wrestlerId } = opts;
  const qs = new URLSearchParams();

  if (userIsCoach(user)) qs.set("coachUserId", String(user.id));
  if (userIsParent(user)) qs.set("parentUserId", String(user.id));

  qs.set("status", status);
  if (needId) qs.set("needId", needId);
  if (wrestlerId) qs.set("wrestlerId", wrestlerId);

  return qs.toString();
}

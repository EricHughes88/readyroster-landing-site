// lib/opportunities.ts
import { pool } from "@/lib/db";

export type OpportunityPriority = "high" | "medium" | "low";

export type AppRoute =
  | "/coach"
  | "/coach/matches"
  | "/coach/notifications"
  | "/parent"
  | "/parent/matches"
  | "/parent/notifications"
  | "/athlete"
  | "/athlete/matches"
  | "/athlete/notifications"
  | "/admin"
  | "/admin/notifications"
  | "/matches"
  | "/notifications"
  | "/";

export type OpportunityItem = {
  id: string;
  type:
    | "potential_matches"
    | "pending_matches"
    | "unread_notifications"
    | "stale_profile"
    | "expiring_interest";
  title: string;
  message: string;
  priority: OpportunityPriority;
  count?: number;
  href?: AppRoute | null;
  createdAt?: string | null;
};

type Role = "coach" | "parent" | "athlete" | "admin" | string;

type TableInfo = {
  exists: boolean;
  columns: string[];
};

async function getTableInfo(tableName: string): Promise<TableInfo> {
  const res = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    `,
    [tableName]
  );

  return {
    exists: res.rows.length > 0,
    columns: res.rows.map((r) => String(r.column_name)),
  };
}

function pickFirst(columns: string[], candidates: string[]) {
  return candidates.find((c) => columns.includes(c)) ?? null;
}

function userDashboardHref(role: string): AppRoute {
  const r = String(role || "").toLowerCase();

  if (r === "coach") return "/coach";
  if (r === "parent") return "/parent";
  if (r === "athlete") return "/athlete";
  if (r === "admin") return "/admin";

  return "/";
}

function matchesHref(role: string): AppRoute {
  const r = String(role || "").toLowerCase();

  if (r === "coach") return "/coach/matches";
  if (r === "parent") return "/parent/matches";
  if (r === "athlete") return "/athlete/matches";

  return "/matches";
}

function notificationsHref(role: string): AppRoute {
  const r = String(role || "").toLowerCase();

  if (r === "coach") return "/coach/notifications";
  if (r === "parent") return "/parent/notifications";
  if (r === "athlete") return "/athlete/notifications";
  if (r === "admin") return "/admin/notifications";

  return "/notifications";
}

async function getUnreadNotifications(userId: number, role: Role): Promise<OpportunityItem[]> {
  const info = await getTableInfo("notifications");
  if (!info.exists) return [];

  const cols = info.columns;
  const userCol = pickFirst(cols, ["user_id", "userid"]);
  const readCol = pickFirst(cols, ["is_read", "read"]);
  const titleCol = pickFirst(cols, ["title", "type"]);
  const messageCol = pickFirst(cols, ["message", "body"]);
  const createdCol = pickFirst(cols, ["created_at", "sent_at", "updated_at"]);
  const hrefCol = pickFirst(cols, ["href", "url", "link"]);

  if (!userCol || !readCol) return [];

  const selectParts = [
    titleCol ? `${titleCol} AS title` : `'Notification'::text AS title`,
    messageCol ? `${messageCol} AS message` : `NULL::text AS message`,
    createdCol ? `${createdCol} AS created_at` : `NULL::timestamptz AS created_at`,
    hrefCol ? `${hrefCol} AS href` : `NULL::text AS href`,
  ];

  const unreadCountRes = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE ${userCol} = $1
      AND COALESCE(${readCol}, false) = false
    `,
    [userId]
  );

  const count = Number(unreadCountRes.rows[0]?.count ?? 0);
  if (!count) return [];

  const latestRes = await pool.query(
    `
    SELECT ${selectParts.join(", ")}
    FROM notifications
    WHERE ${userCol} = $1
      AND COALESCE(${readCol}, false) = false
    ORDER BY ${createdCol ?? "CURRENT_TIMESTAMP"} DESC
    LIMIT 1
    `,
    [userId]
  );

  const latest = latestRes.rows[0];

  return [
    {
      id: `unread_notifications_${userId}`,
      type: "unread_notifications",
      title: count === 1 ? "1 unread notification" : `${count} unread notifications`,
      message:
        latest?.message?.trim?.() ||
        latest?.title?.trim?.() ||
        "You have unread updates waiting for you.",
      priority: count >= 3 ? "high" : "medium",
      count,
      href: notificationsHref(role),
      createdAt: latest?.created_at || null,
    },
  ];
}

async function getPendingMatches(userId: number, role: Role): Promise<OpportunityItem[]> {
  const matchesInfo = await getTableInfo("matches");
  const coachNeedsInfo = await getTableInfo("coach_needs");
  const interestsInfo = await getTableInfo("wrestler_interests");

  if (!matchesInfo.exists || !coachNeedsInfo.exists || !interestsInfo.exists) return [];

  const mCols = matchesInfo.columns;
  const cnCols = coachNeedsInfo.columns;
  const wiCols = interestsInfo.columns;

  const matchCoachNeedCol = pickFirst(mCols, ["coach_need_id", "need_id"]);
  const matchInterestCol = pickFirst(mCols, ["wrestler_interest_id", "interest_id"]);
  const matchStatusCol = pickFirst(mCols, ["status"]);
  const matchCreatedCol = pickFirst(mCols, ["created_at", "matched_at", "updated_at"]);

  const coachUserCol = pickFirst(cnCols, ["user_id", "coach_user_id", "userid"]);
  const interestUserCol = pickFirst(wiCols, ["user_id", "parent_user_id", "athlete_user_id", "userid"]);

  if (!matchCoachNeedCol || !matchInterestCol || !coachUserCol || !interestUserCol) return [];

  const normalizedRole = String(role || "").toLowerCase();
  const isCoach = normalizedRole === "coach";

  const scopeJoin = isCoach ? `cn.${coachUserCol} = $1` : `wi.${interestUserCol} = $1`;

  const pendingWhere = matchStatusCol
    ? `AND LOWER(COALESCE(m.${matchStatusCol}::text, 'pending')) = 'pending'`
    : "";

  const res = await pool.query(
    `
    SELECT
      COUNT(*)::int AS count,
      MAX(${matchCreatedCol ? `m.${matchCreatedCol}` : "CURRENT_TIMESTAMP"}) AS created_at
    FROM matches m
    INNER JOIN coach_needs cn ON cn.id = m.${matchCoachNeedCol}
    INNER JOIN wrestler_interests wi ON wi.id = m.${matchInterestCol}
    WHERE ${scopeJoin}
    ${pendingWhere}
    `,
    [userId]
  );

  const count = Number(res.rows[0]?.count ?? 0);
  if (!count) return [];

  return [
    {
      id: `pending_matches_${userId}_${normalizedRole}`,
      type: "pending_matches",
      title: count === 1 ? "1 pending match" : `${count} pending matches`,
      message: isCoach
        ? "You have athletes waiting for review or response."
        : "You have team opportunities waiting for review or response.",
      priority: "high",
      count,
      href: matchesHref(role),
      createdAt: res.rows[0]?.created_at || null,
    },
  ];
}

async function getPotentialMatches(userId: number, role: Role): Promise<OpportunityItem[]> {
  const coachNeedsInfo = await getTableInfo("coach_needs");
  const interestsInfo = await getTableInfo("wrestler_interests");
  const matchesInfo = await getTableInfo("matches");

  if (!coachNeedsInfo.exists || !interestsInfo.exists) return [];

  const cnCols = coachNeedsInfo.columns;
  const wiCols = interestsInfo.columns;
  const mCols = matchesInfo.columns;

  const coachUserCol = pickFirst(cnCols, ["user_id", "coach_user_id", "userid"]);
  const interestUserCol = pickFirst(wiCols, ["user_id", "parent_user_id", "athlete_user_id", "userid"]);

  const cnEventCol = pickFirst(cnCols, ["event_name"]);
  const cnWeightCol = pickFirst(cnCols, ["weight_class"]);
  const cnAgeCol = pickFirst(cnCols, ["age_group"]);
  const cnStatusCol = pickFirst(cnCols, ["status"]);
  const cnCreatedCol = pickFirst(cnCols, ["created_at", "updated_at"]);

  const wiEventCol = pickFirst(wiCols, ["event_name"]);
  const wiWeightCol = pickFirst(wiCols, ["weight_class"]);
  const wiAgeCol = pickFirst(wiCols, ["age_group"]);
  const wiStatusCol = pickFirst(wiCols, ["status"]);
  const wiCreatedCol = pickFirst(wiCols, ["created_at", "updated_at"]);

  const matchCoachNeedCol = pickFirst(mCols, ["coach_need_id", "need_id"]);
  const matchInterestCol = pickFirst(mCols, ["wrestler_interest_id", "interest_id"]);

  if (
    !coachUserCol ||
    !interestUserCol ||
    !cnEventCol ||
    !cnWeightCol ||
    !cnAgeCol ||
    !wiEventCol ||
    !wiWeightCol ||
    !wiAgeCol
  ) {
    return [];
  }

  const normalizedRole = String(role || "").toLowerCase();
  const isCoach = normalizedRole === "coach";

  const ownTable = isCoach ? "coach_needs" : "wrestler_interests";
  const otherTable = isCoach ? "wrestler_interests" : "coach_needs";
  const ownAlias = isCoach ? "cn" : "wi";
  const otherAlias = isCoach ? "wi" : "cn";
  const ownUserCol = isCoach ? coachUserCol : interestUserCol;

  const ownEventCol = isCoach ? cnEventCol : wiEventCol;
  const ownWeightCol = isCoach ? cnWeightCol : wiWeightCol;
  const ownAgeCol = isCoach ? cnAgeCol : wiAgeCol;
  const ownStatusCol = isCoach ? cnStatusCol : wiStatusCol;
  const ownCreatedCol = isCoach ? cnCreatedCol : wiCreatedCol;

  const otherEventCol = isCoach ? wiEventCol : cnEventCol;
  const otherWeightCol = isCoach ? wiWeightCol : cnWeightCol;
  const otherAgeCol = isCoach ? wiAgeCol : cnAgeCol;
  const otherStatusCol = isCoach ? wiStatusCol : cnStatusCol;
  const otherCreatedCol = isCoach ? wiCreatedCol : cnCreatedCol;

  const ownActiveFilter = ownStatusCol
    ? `AND LOWER(COALESCE(${ownAlias}.${ownStatusCol}::text, 'active')) NOT IN ('closed', 'filled', 'inactive', 'archived')`
    : "";

  const otherActiveFilter = otherStatusCol
    ? `AND LOWER(COALESCE(${otherAlias}.${otherStatusCol}::text, 'active')) NOT IN ('closed', 'filled', 'inactive', 'archived')`
    : "";

  const unmatchedClause =
    matchCoachNeedCol && matchInterestCol
      ? `
      AND NOT EXISTS (
        SELECT 1
        FROM matches m
        WHERE m.${matchCoachNeedCol} = cn.id
          AND m.${matchInterestCol} = wi.id
      )
    `
      : "";

  const createdExpr = ownCreatedCol
    ? `${ownAlias}.${ownCreatedCol}`
    : otherCreatedCol
      ? `${otherAlias}.${otherCreatedCol}`
      : "CURRENT_TIMESTAMP";

  const res = await pool.query(
    `
    SELECT
      COUNT(*)::int AS count,
      MAX(${createdExpr}) AS created_at
    FROM ${ownTable} ${ownAlias}
    INNER JOIN ${otherTable} ${otherAlias}
      ON LOWER(TRIM(COALESCE(${ownAlias}.${ownEventCol}::text, ''))) = LOWER(TRIM(COALESCE(${otherAlias}.${otherEventCol}::text, '')))
     AND LOWER(TRIM(COALESCE(${ownAlias}.${ownWeightCol}::text, ''))) = LOWER(TRIM(COALESCE(${otherAlias}.${otherWeightCol}::text, '')))
     AND LOWER(TRIM(COALESCE(${ownAlias}.${ownAgeCol}::text, ''))) = LOWER(TRIM(COALESCE(${otherAlias}.${otherAgeCol}::text, '')))
    WHERE ${ownAlias}.${ownUserCol} = $1
    ${ownActiveFilter}
    ${otherActiveFilter}
    ${unmatchedClause}
    `,
    [userId]
  );

  const count = Number(res.rows[0]?.count ?? 0);
  if (!count) return [];

  return [
    {
      id: `potential_matches_${userId}_${normalizedRole}`,
      type: "potential_matches",
      title: isCoach
        ? count === 1
          ? "1 athlete matches your needs"
          : `${count} athletes match your needs`
        : count === 1
          ? "1 team matches your profile"
          : `${count} teams match your profile`,
      message: isCoach
        ? "New athletes appear to fit your posted needs."
        : "New team opportunities appear to fit your posted interests.",
      priority: "high",
      count,
      href: matchesHref(role),
      createdAt: res.rows[0]?.created_at || null,
    },
  ];
}

async function getStaleProfilePrompt(role: Role): Promise<OpportunityItem[]> {
  const r = String(role || "").toLowerCase();

  if (r === "admin") return [];

  return [
    {
      id: `stale_profile_prompt_${r}`,
      type: "stale_profile",
      title: "Keep your profile fresh",
      message:
        r === "coach"
          ? "Update your needs and team details to improve match quality."
          : "Update your interest details to improve visibility and matching.",
      priority: "low",
      href: userDashboardHref(role),
      createdAt: null,
    },
  ];
}

function priorityRank(p: OpportunityPriority) {
  if (p === "high") return 3;
  if (p === "medium") return 2;
  return 1;
}

export async function getUserOpportunities(userId: number, role: Role): Promise<OpportunityItem[]> {
  const items: OpportunityItem[] = [];

  const tasks = [
    getPotentialMatches(userId, role),
    getPendingMatches(userId, role),
    getUnreadNotifications(userId, role),
    getStaleProfilePrompt(role),
  ];

  const results = await Promise.allSettled(tasks);

  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      items.push(...result.value);
    }
  }

  return items
    .sort((a, b) => {
      const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 8);
}
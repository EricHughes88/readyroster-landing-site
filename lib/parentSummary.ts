// lib/parentSummary.ts
import { pool } from "@/lib/db";

export type ParentSummaryRoute =
  | "/parent/notifications"
  | "/parent/matches"
  | "/parent/wrestlers";

export type ParentSummaryItem = {
  id: string;
  label: string;
  value: number;
  href: ParentSummaryRoute;
  tone: "cyan" | "emerald" | "amber" | "red";
};

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

async function getUnreadUpdatesCount(userId: number): Promise<number> {
  const info = await getTableInfo("notifications");
  if (!info.exists) return 0;

  const cols = info.columns;
  const userCol = pickFirst(cols, ["user_id", "userid"]);
  const readCol = pickFirst(cols, ["is_read", "read"]);

  if (!userCol || !readCol) return 0;

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE ${userCol} = $1
      AND COALESCE(${readCol}, false) = false
    `,
    [userId]
  );

  return Number(res.rows[0]?.count ?? 0);
}

async function getRecentCoachViewsCount(userId: number): Promise<number> {
  const info = await getTableInfo("profile_views");
  const athletesInfo = await getTableInfo("athletes");

  if (!info.exists || !athletesInfo.exists) return 0;

  const pvCols = info.columns;
  const aCols = athletesInfo.columns;

  const viewedWrestlerCol = pickFirst(pvCols, ["wrestler_id", "athlete_id"]);
  const viewedAtCol = pickFirst(pvCols, ["viewed_at", "created_at"]);
  const athleteIdCol = pickFirst(aCols, ["id", "athlete_id"]);
  const athleteUserCol = pickFirst(aCols, ["user_id", "parent_user_id", "userid"]);

  if (!viewedWrestlerCol || !viewedAtCol || !athleteIdCol || !athleteUserCol) return 0;

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM profile_views pv
    INNER JOIN athletes a
      ON a.${athleteIdCol} = pv.${viewedWrestlerCol}
    WHERE a.${athleteUserCol} = $1
      AND pv.${viewedAtCol} >= NOW() - INTERVAL '7 days'
    `,
    [userId]
  );

  return Number(res.rows[0]?.count ?? 0);
}

async function getPotentialMatchesCount(userId: number): Promise<number> {
  const coachNeedsInfo = await getTableInfo("coach_needs");
  const interestsInfo = await getTableInfo("wrestler_interests");
  const matchesInfo = await getTableInfo("matches");

  if (!coachNeedsInfo.exists || !interestsInfo.exists) return 0;

  const cnCols = coachNeedsInfo.columns;
  const wiCols = interestsInfo.columns;
  const mCols = matchesInfo.columns;

  const interestUserCol = pickFirst(wiCols, ["user_id", "parent_user_id", "athlete_user_id", "userid"]);

  const cnEventCol = pickFirst(cnCols, ["event_name"]);
  const cnWeightCol = pickFirst(cnCols, ["weight_class"]);
  const cnAgeCol = pickFirst(cnCols, ["age_group"]);
  const cnStatusCol = pickFirst(cnCols, ["status"]);

  const wiEventCol = pickFirst(wiCols, ["event_name"]);
  const wiWeightCol = pickFirst(wiCols, ["weight_class"]);
  const wiAgeCol = pickFirst(wiCols, ["age_group"]);
  const wiStatusCol = pickFirst(wiCols, ["status"]);

  const matchCoachNeedCol = pickFirst(mCols, ["coach_need_id", "need_id"]);
  const matchInterestCol = pickFirst(mCols, ["wrestler_interest_id", "interest_id"]);

  if (
    !interestUserCol ||
    !cnEventCol ||
    !cnWeightCol ||
    !cnAgeCol ||
    !wiEventCol ||
    !wiWeightCol ||
    !wiAgeCol
  ) {
    return 0;
  }

  const interestActiveFilter = wiStatusCol
    ? `AND LOWER(COALESCE(wi.${wiStatusCol}::text, 'active')) NOT IN ('closed', 'filled', 'inactive', 'archived')`
    : "";

  const needActiveFilter = cnStatusCol
    ? `AND LOWER(COALESCE(cn.${cnStatusCol}::text, 'active')) NOT IN ('closed', 'filled', 'inactive', 'archived')`
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

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM wrestler_interests wi
    INNER JOIN coach_needs cn
      ON LOWER(TRIM(COALESCE(wi.${wiEventCol}::text, ''))) = LOWER(TRIM(COALESCE(cn.${cnEventCol}::text, '')))
     AND LOWER(TRIM(COALESCE(wi.${wiWeightCol}::text, ''))) = LOWER(TRIM(COALESCE(cn.${cnWeightCol}::text, '')))
     AND LOWER(TRIM(COALESCE(wi.${wiAgeCol}::text, ''))) = LOWER(TRIM(COALESCE(cn.${cnAgeCol}::text, '')))
    WHERE wi.${interestUserCol} = $1
    ${interestActiveFilter}
    ${needActiveFilter}
    ${unmatchedClause}
    `,
    [userId]
  );

  return Number(res.rows[0]?.count ?? 0);
}

async function getProfilesNeedingAttentionCount(userId: number): Promise<number> {
  const athletesInfo = await getTableInfo("athletes");
  if (!athletesInfo.exists) return 0;

  const cols = athletesInfo.columns;
  const userCol = pickFirst(cols, ["user_id", "parent_user_id", "userid"]);
  const accoladesCol = pickFirst(cols, ["accolades"]);
  const bioCol = pickFirst(cols, ["bio"]);
  const ageGroupCol = pickFirst(cols, ["age_group"]);
  const weightClassCol = pickFirst(cols, ["weight_class"]);

  if (!userCol) return 0;

  const selectBits = [
    accoladesCol ? `${accoladesCol} AS accolades` : `NULL::text AS accolades`,
    bioCol ? `${bioCol} AS bio` : `NULL::text AS bio`,
    ageGroupCol ? `${ageGroupCol} AS age_group` : `NULL::text AS age_group`,
    weightClassCol ? `${weightClassCol} AS weight_class` : `NULL::text AS weight_class`,
  ];

  const res = await pool.query(
    `
    SELECT ${selectBits.join(", ")}
    FROM athletes
    WHERE ${userCol} = $1
    LIMIT 50
    `,
    [userId]
  );

  if (!res.rows.length) return 0;

  return res.rows.filter((row) => {
    const missingAge = !String(row.age_group ?? "").trim();
    const missingWeight = !String(row.weight_class ?? "").trim();
    const missingAccolades = !String(row.accolades ?? "").trim();
    const missingBio = !String(row.bio ?? "").trim();

    return missingAge || missingWeight || missingAccolades || missingBio;
  }).length;
}

export async function getParentQuickSummary(
  userId: number
): Promise<ParentSummaryItem[]> {
  const [
    unreadUpdates,
    recentCoachViews,
    potentialMatches,
    profilesNeedingAttention,
  ] = await Promise.all([
    getUnreadUpdatesCount(userId),
    getRecentCoachViewsCount(userId),
    getPotentialMatchesCount(userId),
    getProfilesNeedingAttentionCount(userId),
  ]);

  return [
    {
      id: "unread_updates",
      label: "Unread Updates",
      value: unreadUpdates,
      href: "/parent/notifications",
      tone: "red",
    },
    {
      id: "recent_views",
      label: "Recent Coach Views",
      value: recentCoachViews,
      href: "/parent/wrestlers",
      tone: "cyan",
    },
    {
      id: "potential_matches",
      label: "Potential Matches",
      value: potentialMatches,
      href: "/parent/matches",
      tone: "emerald",
    },
    {
      id: "profiles_attention",
      label: "Profiles Needing Attention",
      value: profilesNeedingAttention,
      href: "/parent/wrestlers",
      tone: "amber",
    },
  ];
}
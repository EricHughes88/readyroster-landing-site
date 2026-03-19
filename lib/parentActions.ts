// lib/parentActions.ts
import { pool } from "@/lib/db";

export type ActionPriority = "high" | "medium" | "low";

export type ParentActionRoute =
  | "/parent"
  | "/parent/wrestlers"
  | "/parent/matches"
  | "/parent/messages"
  | "/parent/notifications"
  | "/parent/interests";

export type ParentRecommendedAction = {
  id: string;
  title: string;
  description: string;
  priority: ActionPriority;
  ctaLabel: string;
  href: ParentActionRoute;
  count?: number;
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

function priorityRank(priority: ActionPriority) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

async function getPendingMatchAction(userId: number): Promise<ParentRecommendedAction | null> {
  const matchesInfo = await getTableInfo("matches");
  const interestsInfo = await getTableInfo("wrestler_interests");

  if (!matchesInfo.exists || !interestsInfo.exists) return null;

  const mCols = matchesInfo.columns;
  const wiCols = interestsInfo.columns;

  const matchInterestCol = pickFirst(mCols, ["wrestler_interest_id", "interest_id"]);
  const matchStatusCol = pickFirst(mCols, ["status"]);
  const interestUserCol = pickFirst(wiCols, ["user_id", "parent_user_id", "athlete_user_id", "userid"]);

  if (!matchInterestCol || !interestUserCol) return null;

  const pendingWhere = matchStatusCol
    ? `AND LOWER(COALESCE(m.${matchStatusCol}::text, 'pending')) = 'pending'`
    : "";

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM matches m
    INNER JOIN wrestler_interests wi
      ON wi.id = m.${matchInterestCol}
    WHERE wi.${interestUserCol} = $1
    ${pendingWhere}
    `,
    [userId]
  );

  const count = Number(res.rows[0]?.count ?? 0);
  if (!count) return null;

  return {
    id: "pending_matches",
    title: count === 1 ? "Review 1 pending match" : `Review ${count} pending matches`,
    description: "You have team opportunities waiting for a response.",
    priority: "high",
    ctaLabel: "Review Matches",
    href: "/parent/matches",
    count,
  };
}

async function getUnreadNotificationAction(userId: number): Promise<ParentRecommendedAction | null> {
  const info = await getTableInfo("notifications");
  if (!info.exists) return null;

  const cols = info.columns;
  const userCol = pickFirst(cols, ["user_id", "userid"]);
  const readCol = pickFirst(cols, ["is_read", "read"]);

  if (!userCol || !readCol) return null;

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM notifications
    WHERE ${userCol} = $1
      AND COALESCE(${readCol}, false) = false
    `,
    [userId]
  );

  const count = Number(res.rows[0]?.count ?? 0);
  if (!count) return null;

  return {
    id: "unread_notifications",
    title: count === 1 ? "Check 1 unread update" : `Check ${count} unread updates`,
    description: "You have new activity waiting in your notifications.",
    priority: count >= 3 ? "high" : "medium",
    ctaLabel: "Open Notifications",
    href: "/parent/notifications",
    count,
  };
}

async function getPotentialMatchesAction(userId: number): Promise<ParentRecommendedAction | null> {
  const coachNeedsInfo = await getTableInfo("coach_needs");
  const interestsInfo = await getTableInfo("wrestler_interests");
  const matchesInfo = await getTableInfo("matches");

  if (!coachNeedsInfo.exists || !interestsInfo.exists) return null;

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
    return null;
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

  const count = Number(res.rows[0]?.count ?? 0);
  if (!count) return null;

  return {
    id: "potential_matches",
    title: count === 1 ? "You have 1 potential match" : `You have ${count} potential matches`,
    description: "Teams currently match one or more of your wrestler interests.",
    priority: "high",
    ctaLabel: "View Opportunities",
    href: "/parent/matches",
    count,
  };
}

async function getWrestlerProfileAction(userId: number): Promise<ParentRecommendedAction | null> {
  const athletesInfo = await getTableInfo("athletes");
  if (!athletesInfo.exists) return null;

  const cols = athletesInfo.columns;
  const userCol = pickFirst(cols, ["user_id", "parent_user_id", "userid"]);
  const firstNameCol = pickFirst(cols, ["first_name", "firstname"]);
  const lastNameCol = pickFirst(cols, ["last_name", "lastname"]);
  const accoladesCol = pickFirst(cols, ["accolades"]);
  const bioCol = pickFirst(cols, ["bio"]);
  const ageGroupCol = pickFirst(cols, ["age_group"]);
  const weightClassCol = pickFirst(cols, ["weight_class"]);

  if (!userCol) return null;

  const selectBits = [
    firstNameCol ? `${firstNameCol} AS first_name` : `NULL::text AS first_name`,
    lastNameCol ? `${lastNameCol} AS last_name` : `NULL::text AS last_name`,
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
    LIMIT 25
    `,
    [userId]
  );

  if (!res.rows.length) {
    return {
      id: "add_wrestler",
      title: "Add your first wrestler",
      description: "Create a wrestler profile to start receiving matches and coach views.",
      priority: "high",
      ctaLabel: "Add Wrestler",
      href: "/parent/wrestlers",
      count: 0,
    };
  }

  const incompleteCount = res.rows.filter((row) => {
    const missingAge = !String(row.age_group ?? "").trim();
    const missingWeight = !String(row.weight_class ?? "").trim();
    const missingAccolades = !String(row.accolades ?? "").trim();
    const missingBio = !String(row.bio ?? "").trim();

    return missingAge || missingWeight || missingAccolades || missingBio;
  }).length;

  if (!incompleteCount) return null;

  return {
    id: "complete_profiles",
    title:
      incompleteCount === 1
        ? "Complete 1 wrestler profile"
        : `Complete ${incompleteCount} wrestler profiles`,
    description: "Adding details like accolades, bio, age group, and weight class can improve visibility.",
    priority: "medium",
    ctaLabel: "Update Profiles",
    href: "/parent/wrestlers",
    count: incompleteCount,
  };
}

async function getInterestAction(userId: number): Promise<ParentRecommendedAction | null> {
  const info = await getTableInfo("wrestler_interests");
  if (!info.exists) return null;

  const cols = info.columns;
  const userCol = pickFirst(cols, ["user_id", "parent_user_id", "athlete_user_id", "userid"]);

  if (!userCol) return null;

  const res = await pool.query(
    `
    SELECT COUNT(*)::int AS count
    FROM wrestler_interests
    WHERE ${userCol} = $1
    `,
    [userId]
  );

  const count = Number(res.rows[0]?.count ?? 0);

  if (count > 0) return null;

  return {
    id: "add_interest",
    title: "Add a wrestler interest",
    description: "Post an interest so coaches can find your wrestler and matching teams can appear.",
    priority: "high",
    ctaLabel: "Add Interest",
    href: "/parent/interests",
    count: 0,
  };
}

export async function getParentRecommendedActions(
  userId: number
): Promise<ParentRecommendedAction[]> {
  const results = await Promise.allSettled([
    getPendingMatchAction(userId),
    getUnreadNotificationAction(userId),
    getPotentialMatchesAction(userId),
    getWrestlerProfileAction(userId),
    getInterestAction(userId),
  ]);

  const actions: ParentRecommendedAction[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      actions.push(result.value);
    }
  }

  return actions
    .sort((a, b) => {
      const priorityDiff = priorityRank(b.priority) - priorityRank(a.priority);
      if (priorityDiff !== 0) return priorityDiff;

      return (b.count ?? 0) - (a.count ?? 0);
    })
    .slice(0, 4);
}
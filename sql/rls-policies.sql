-- Ready Roster RLS Security Policies
-- Applied: 2026-03-30
-- Purpose: Restrict data access to authenticated users and enforce row-level ownership

BEGIN;

-- =========================================================
-- USERS
-- =========================================================

DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;

CREATE POLICY "users_select_self"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = auth_user_id);

CREATE POLICY "users_admin_all"
ON public.users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND COALESCE(u.role, '') IN ('Admin','Super Admin','SuperAdmin','admin','super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND COALESCE(u.role, '') IN ('Admin','Super Admin','SuperAdmin','admin','super_admin')
  )
);

-- =========================================================
-- ATHLETES
-- =========================================================

DROP POLICY IF EXISTS "athletes_all" ON public.athletes;

CREATE POLICY "athletes_all"
ON public.athletes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = athletes.userid OR u.id = athletes.userid)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = athletes.userid OR u.id = athletes.userid)
  )
);

-- =========================================================
-- TEAMS
-- =========================================================

DROP POLICY IF EXISTS "teams_all" ON public.teams;

CREATE POLICY "teams_all"
ON public.teams
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = teams.userid OR u.id = teams.userid)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = teams.userid OR u.id = teams.userid)
  )
);

-- =========================================================
-- COACH NEEDS
-- =========================================================

DROP POLICY IF EXISTS "coach_needs_select" ON public.coach_needs;
DROP POLICY IF EXISTS "coach_needs_modify" ON public.coach_needs;

CREATE POLICY "coach_needs_select"
ON public.coach_needs
FOR SELECT
TO authenticated
USING (
  (is_visible = true AND is_open = true AND (expired_at IS NULL OR expired_at > now()))
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = coach_needs.coach_user_id OR u.id = coach_needs.coach_user_id)
  )
);

CREATE POLICY "coach_needs_modify"
ON public.coach_needs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = coach_needs.coach_user_id OR u.id = coach_needs.coach_user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = coach_needs.coach_user_id OR u.id = coach_needs.coach_user_id)
  )
);

-- =========================================================
-- WRESTLER INTERESTS
-- =========================================================

DROP POLICY IF EXISTS "wrestler_interests_select" ON public.wrestler_interests;
DROP POLICY IF EXISTS "wrestler_interests_modify" ON public.wrestler_interests;

CREATE POLICY "wrestler_interests_select"
ON public.wrestler_interests
FOR SELECT
TO authenticated
USING (
  is_visible = true
  OR EXISTS (
    SELECT 1
    FROM public.athletes a
    JOIN public.users u ON (u.user_id = a.userid OR u.id = a.userid)
    WHERE a.athleteid = wrestler_interests.wrestler_id
      AND u.auth_user_id = auth.uid()
  )
);

CREATE POLICY "wrestler_interests_modify"
ON public.wrestler_interests
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.athletes a
    JOIN public.users u ON (u.user_id = a.userid OR u.id = a.userid)
    WHERE a.athleteid = wrestler_interests.wrestler_id
      AND u.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.athletes a
    JOIN public.users u ON (u.user_id = a.userid OR u.id = a.userid)
    WHERE a.athleteid = wrestler_interests.wrestler_id
      AND u.auth_user_id = auth.uid()
  )
);

-- =========================================================
-- MATCHES
-- =========================================================

DROP POLICY IF EXISTS "matches_all" ON public.matches;

CREATE POLICY "matches_all"
ON public.matches
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = matches.coach_user_id OR u.id = matches.coach_user_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.wrestler_interests wi
    JOIN public.athletes a ON a.athleteid = wi.wrestler_id
    JOIN public.users u ON (u.user_id = a.userid OR u.id = a.userid)
    WHERE wi.id = matches.wrestler_interest_id
      AND u.auth_user_id = auth.uid()
  )
);

-- =========================================================
-- MESSAGES
-- =========================================================

DROP POLICY IF EXISTS "messages_all" ON public.messages;

CREATE POLICY "messages_all"
ON public.messages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (
        u.user_id = messages.senderid OR u.id = messages.senderid
        OR u.user_id = messages.receiverid OR u.id = messages.receiverid
      )
  )
);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;

CREATE POLICY "notifications_all"
ON public.notifications
FOR ALL
TO authenticated
USING (
  user_uuid = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND (u.user_id = notifications.user_id OR u.id = notifications.user_id)
  )
);

COMMIT;
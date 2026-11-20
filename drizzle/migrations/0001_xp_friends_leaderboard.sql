
CREATE TABLE public.xp_rewards (
  reason text PRIMARY KEY,
  amount integer NOT NULL CHECK (amount >= 0),
  daily_cap integer
);
GRANT SELECT ON public.xp_rewards TO authenticated;
GRANT ALL ON public.xp_rewards TO service_role;
ALTER TABLE public.xp_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in students can read reward values" ON public.xp_rewards FOR SELECT TO authenticated USING (true);
INSERT INTO public.xp_rewards (reason, amount, daily_cap) VALUES
  ('focus_minute', 1, 240), ('task_complete', 30, NULL), ('daily_goal', 50, NULL),
  ('on_time_submission', 100, NULL), ('streak_7', 150, NULL);

CREATE TABLE public.student_profiles (
  user_id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text NOT NULL DEFAULT 'Student' CHECK (char_length(display_name) BETWEEN 1 AND 40),
  avatar text NOT NULL DEFAULT '🎓' CHECK (char_length(avatar) <= 8),
  friend_code text NOT NULL UNIQUE,
  leaderboard_opt_in boolean NOT NULL DEFAULT true,
  share_focus boolean NOT NULL DEFAULT true,
  share_streak boolean NOT NULL DEFAULT true,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  xp_started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own profile" ON public.student_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.xp_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  ref text NOT NULL,
  activity_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reason, ref)
);
CREATE INDEX xp_transactions_user_time ON public.xp_transactions (user_id, activity_at);
GRANT SELECT ON public.xp_transactions TO authenticated;
GRANT ALL ON public.xp_transactions TO service_role;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own XP" ON public.xp_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.student_achievements (
  user_id uuid NOT NULL,
  achievement text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement)
);
GRANT SELECT ON public.student_achievements TO authenticated;
GRANT ALL ON public.student_achievements TO service_role;
ALTER TABLE public.student_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own achievements" ON public.student_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester uuid NOT NULL,
  addressee uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester <> addressee)
);
CREATE UNIQUE INDEX friendships_pair ON public.friendships (LEAST(requester, addressee), GREATEST(requester, addressee));
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read their friendships" ON public.friendships FOR SELECT TO authenticated USING (auth.uid() IN (requester, addressee));

CREATE TABLE public.user_blocks (
  blocker uuid NOT NULL,
  blocked uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked)
);
GRANT SELECT ON public.user_blocks TO authenticated;
GRANT ALL ON public.user_blocks TO service_role;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read their own blocks" ON public.user_blocks FOR SELECT TO authenticated USING (auth.uid() = blocker);

CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator uuid NOT NULL,
  opponent uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('focus_sessions','xp','tasks','goal_days')),
  target integer NOT NULL CHECK (target > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (creator <> opponent)
);
GRANT SELECT ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read their challenges" ON public.challenges FOR SELECT TO authenticated USING (auth.uid() IN (creator, opponent));

-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.are_friends(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM friendships WHERE status = 'accepted' AND LEAST(requester, addressee) = LEAST(a, b) AND GREATEST(requester, addressee) = GREATEST(a, b));
$$;

CREATE OR REPLACE FUNCTION public.is_blocked_between(a uuid, b uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker = a AND blocked = b) OR (blocker = b AND blocked = a));
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile() RETURNS public.student_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); p student_profiles; code text; uname text; nm text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO p FROM student_profiles WHERE user_id = me;
  IF FOUND THEN RETURN p; END IF;
  SELECT left(coalesce(nullif(trim(data->>'studentName'), ''), 'Student'), 40) INTO nm FROM momentum_state WHERE user_id = me;
  LOOP
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    uname := 'student_' || lower(substr(md5(random()::text), 1, 6));
    BEGIN
      INSERT INTO student_profiles (user_id, username, display_name, friend_code) VALUES (me, uname, coalesce(nm, 'Student'), code) RETURNING * INTO p;
      RETURN p;
    EXCEPTION WHEN unique_violation THEN
      SELECT * INTO p FROM student_profiles WHERE user_id = me;
      IF FOUND THEN RETURN p; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.update_my_profile(p_username text, p_display_name text, p_avatar text, p_opt_in boolean, p_share_focus boolean, p_share_streak boolean)
RETURNS public.student_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p student_profiles;
BEGIN
  PERFORM ensure_profile();
  IF lower(p_username) !~ '^[a-z0-9_]{3,20}$' THEN RAISE EXCEPTION 'Usernames use 3–20 letters, numbers or underscores'; END IF;
  IF EXISTS (SELECT 1 FROM student_profiles WHERE username = lower(p_username) AND user_id <> auth.uid()) THEN RAISE EXCEPTION 'That username is taken'; END IF;
  UPDATE student_profiles SET username = lower(p_username), display_name = left(coalesce(nullif(trim(p_display_name), ''), 'Student'), 40),
    avatar = left(coalesce(nullif(p_avatar, ''), '🎓'), 8), leaderboard_opt_in = p_opt_in, share_focus = p_share_focus, share_streak = p_share_streak
  WHERE user_id = auth.uid() RETURNING * INTO p;
  RETURN p;
END $$;

-- ---------- XP sync: validates rewards against the student's saved workspace ----------
CREATE OR REPLACE FUNCTION public.sync_xp(p_tz text DEFAULT 'UTC') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := auth.uid(); prof student_profiles; ws jsonb; tz text; start_at timestamptz;
  r record; amt int; cap int; already int; goal int; weekly_min int;
  awarded jsonb := '[]'::jsonb; ach jsonb := '[]'::jsonb;
  d date; first_day date; today date; streak int := 0; best int := 0; rest_days int[];
  active_days date[]; ins record;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  prof := ensure_profile();
  start_at := prof.xp_started_at;
  tz := CASE WHEN EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz) THEN p_tz ELSE 'UTC' END;
  today := (now() AT TIME ZONE tz)::date;
  SELECT data INTO ws FROM momentum_state WHERE user_id = me;
  IF ws IS NULL THEN RETURN jsonb_build_object('awarded', awarded, 'achievements', ach); END IF;
  goal := greatest(1, coalesce((ws #>> '{dashboard,goals,dailyTasks}')::int, 3));
  weekly_min := greatest(60, coalesce((ws #>> '{dashboard,goals,weeklyHours}')::numeric, 10) * 60)::int;

  -- Focus sessions: 1 XP per completed active minute, capped per day.
  SELECT amount, coalesce(daily_cap, 100000) INTO amt, cap FROM xp_rewards WHERE reason = 'focus_minute';
  FOR r IN
    SELECT s->>'id' AS id, (s->>'endedAt')::timestamptz AS ended, (s->>'startedAt')::timestamptz AS started,
      least(coalesce((s->>'activeMinutes')::int, (s->>'actualMinutes')::int, 0), coalesce((s->>'plannedMinutes')::int, 0), 180) AS mins
    FROM jsonb_array_elements(coalesce(ws->'sessions', '[]')) s
    WHERE (s->>'completed')::boolean IS TRUE AND s->>'id' IS NOT NULL AND s->>'endedAt' IS NOT NULL AND s->>'startedAt' IS NOT NULL
    ORDER BY 2
  LOOP
    CONTINUE WHEN r.ended < start_at OR r.ended > now() + interval '5 minutes' OR r.mins <= 0;
    CONTINUE WHEN extract(epoch FROM (r.ended - r.started)) / 60 < r.mins - 1; -- active time can't exceed elapsed time
    CONTINUE WHEN EXISTS (SELECT 1 FROM xp_transactions WHERE user_id = me AND reason = 'focus_minute' AND ref = r.id);
    SELECT coalesce(sum(amount), 0) INTO already FROM xp_transactions
      WHERE user_id = me AND reason = 'focus_minute' AND (activity_at AT TIME ZONE tz)::date = (r.ended AT TIME ZONE tz)::date;
    IF least(r.mins * amt, cap - already) > 0 THEN
      INSERT INTO xp_transactions (user_id, amount, reason, ref, activity_at) VALUES (me, least(r.mins * amt, cap - already), 'focus_minute', r.id, r.ended)
      ON CONFLICT DO NOTHING RETURNING amount, reason INTO ins;
      IF ins IS NOT NULL THEN awarded := awarded || jsonb_build_object('amount', ins.amount, 'reason', ins.reason); END IF;
    END IF;
  END LOOP;

  -- Completed tasks.
  SELECT amount INTO amt FROM xp_rewards WHERE reason = 'task_complete';
  FOR ins IN
    INSERT INTO xp_transactions (user_id, amount, reason, ref, activity_at)
    SELECT me, amt, 'task_complete', t->>'id', (t->>'completedAt')::timestamptz
    FROM jsonb_array_elements(coalesce(ws->'tasks', '[]')) t
    WHERE (t->>'completed')::boolean IS TRUE AND t->>'completedAt' IS NOT NULL
      AND (t->>'completedAt')::timestamptz BETWEEN start_at AND now() + interval '5 minutes'
    ON CONFLICT DO NOTHING RETURNING amount, reason
  LOOP awarded := awarded || jsonb_build_object('amount', ins.amount, 'reason', ins.reason); END LOOP;

  -- Daily task goal met (based on rewarded task completions).
  SELECT amount INTO amt FROM xp_rewards WHERE reason = 'daily_goal';
  FOR ins IN
    INSERT INTO xp_transactions (user_id, amount, reason, ref, activity_at)
    SELECT me, amt, 'daily_goal', day::text, max(activity_at) FROM (
      SELECT (activity_at AT TIME ZONE tz)::date AS day, activity_at FROM xp_transactions WHERE user_id = me AND reason = 'task_complete'
    ) x GROUP BY day HAVING count(*) >= goal
    ON CONFLICT DO NOTHING RETURNING amount, reason
  LOOP awarded := awarded || jsonb_build_object('amount', ins.amount, 'reason', ins.reason); END LOOP;

  -- On-time completion: every task of an assignment finished before its deadline.
  SELECT amount INTO amt FROM xp_rewards WHERE reason = 'on_time_submission';
  FOR ins IN
    INSERT INTO xp_transactions (user_id, amount, reason, ref, activity_at)
    SELECT me, amt, 'on_time_submission', a->>'id', max((t->>'completedAt')::timestamptz)
    FROM jsonb_array_elements(coalesce(ws->'assignments', '[]')) a
    JOIN jsonb_array_elements(coalesce(ws->'tasks', '[]')) t ON t->>'assignmentId' = a->>'id'
    GROUP BY a->>'id', a->>'deadline', a->>'deadlineTime'
    HAVING bool_and((t->>'completed')::boolean IS TRUE AND t->>'completedAt' IS NOT NULL)
      AND max((t->>'completedAt')::timestamptz) BETWEEN start_at AND now() + interval '5 minutes'
      AND max(((t->>'completedAt')::timestamptz AT TIME ZONE tz)) <= ((a->>'deadline') || ' ' || coalesce(a->>'deadlineTime', '23:59'))::timestamp
    ON CONFLICT DO NOTHING RETURNING amount, reason
  LOOP awarded := awarded || jsonb_build_object('amount', ins.amount, 'reason', ins.reason); END LOOP;

  -- Study streak: days with a rewarded focus session or task. Planned rest days never break it.
  SELECT array_agg(DISTINCT (activity_at AT TIME ZONE tz)::date ORDER BY (activity_at AT TIME ZONE tz)::date) INTO active_days
    FROM xp_transactions WHERE user_id = me AND reason IN ('focus_minute', 'task_complete');
  SELECT array_agg(i - 1) INTO rest_days FROM jsonb_array_elements(coalesce(ws #> '{availability,days}', '[]')) WITH ORDINALITY e(v, i) WHERE jsonb_typeof(v) = 'null';
  SELECT amount INTO amt FROM xp_rewards WHERE reason = 'streak_7';
  IF active_days IS NOT NULL THEN
    first_day := active_days[1];
    d := first_day;
    WHILE d <= today LOOP
      IF d = ANY(active_days) THEN
        streak := streak + 1;
        best := greatest(best, streak);
        IF streak % 7 = 0 THEN
          INSERT INTO xp_transactions (user_id, amount, reason, ref, activity_at) VALUES (me, amt, 'streak_7', d::text, (d + 1)::timestamp AT TIME ZONE tz - interval '1 second')
          ON CONFLICT DO NOTHING RETURNING amount, reason INTO ins;
          IF ins IS NOT NULL THEN awarded := awarded || jsonb_build_object('amount', ins.amount, 'reason', ins.reason); ins := NULL; END IF;
        END IF;
      ELSIF d = today OR extract(dow FROM d)::int = ANY(coalesce(rest_days, '{}')) THEN
        NULL; -- today isn't over yet / planned rest day
      ELSE
        streak := 0;
      END IF;
      d := d + 1;
    END LOOP;
  END IF;
  UPDATE student_profiles SET current_streak = streak, best_streak = greatest(best_streak, best) WHERE user_id = me;

  -- Achievements.
  FOR ins IN
    INSERT INTO student_achievements (user_id, achievement)
    SELECT me, k FROM (VALUES
      ('first_focus', EXISTS (SELECT 1 FROM xp_transactions WHERE user_id = me AND reason = 'focus_minute')),
      ('first_task', EXISTS (SELECT 1 FROM xp_transactions WHERE user_id = me AND reason = 'task_complete')),
      ('streak_3', greatest(best, prof.best_streak) >= 3),
      ('streak_7', greatest(best, prof.best_streak) >= 7),
      ('ten_focus', (SELECT count(*) FROM xp_transactions WHERE user_id = me AND reason = 'focus_minute') >= 10),
      ('weekly_goal', EXISTS (SELECT 1 FROM xp_transactions x JOIN jsonb_array_elements(coalesce(ws->'sessions', '[]')) s ON s->>'id' = x.ref
          WHERE x.user_id = me AND x.reason = 'focus_minute'
          GROUP BY date_trunc('week', x.activity_at AT TIME ZONE tz)
          HAVING sum(least(coalesce((s->>'activeMinutes')::int, (s->>'actualMinutes')::int, 0), 180)) >= weekly_min)),
      ('plan_complete', EXISTS (SELECT 1 FROM xp_transactions WHERE user_id = me AND reason = 'on_time_submission'))
    ) v(k, ok) WHERE ok
    ON CONFLICT DO NOTHING RETURNING achievement AS reason, 0 AS amount
  LOOP ach := ach || to_jsonb(ins.reason); END LOOP;

  RETURN jsonb_build_object('awarded', awarded, 'achievements', ach, 'streak', streak);
END $$;

-- ---------- Friends ----------
CREATE OR REPLACE FUNCTION public.find_student(p_query text)
RETURNS TABLE (user_id uuid, username text, display_name text, avatar text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.username, p.display_name, p.avatar FROM student_profiles p
  WHERE (p.username = lower(trim(p_query)) OR p.friend_code = upper(trim(p_query)))
    AND p.user_id <> auth.uid() AND NOT is_blocked_between(auth.uid(), p.user_id)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_target uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); f friendships;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_target = me THEN RAISE EXCEPTION 'You can''t add yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = p_target) OR is_blocked_between(me, p_target) THEN RAISE EXCEPTION 'Student not found'; END IF;
  PERFORM ensure_profile();
  SELECT * INTO f FROM friendships WHERE LEAST(requester, addressee) = LEAST(me, p_target) AND GREATEST(requester, addressee) = GREATEST(me, p_target);
  IF FOUND THEN
    IF f.status = 'accepted' THEN RETURN 'already_friends'; END IF;
    IF f.requester = me THEN RETURN 'already_sent'; END IF;
    UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = f.id;
    RETURN 'accepted';
  END IF;
  INSERT INTO friendships (requester, addressee) VALUES (me, p_target);
  RETURN 'sent';
END $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(p_id uuid, p_accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM friendships WHERE id = p_id AND addressee = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF p_accept THEN UPDATE friendships SET status = 'accepted', responded_at = now() WHERE id = p_id;
  ELSE DELETE FROM friendships WHERE id = p_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_other uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM friendships WHERE LEAST(requester, addressee) = LEAST(auth.uid(), p_other) AND GREATEST(requester, addressee) = GREATEST(auth.uid(), p_other);
  DELETE FROM challenges WHERE (creator = auth.uid() AND opponent = p_other) OR (creator = p_other AND opponent = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.block_user(p_other uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_other = auth.uid() THEN RAISE EXCEPTION 'You can''t block yourself'; END IF;
  PERFORM remove_friend(p_other);
  INSERT INTO user_blocks (blocker, blocked) VALUES (auth.uid(), p_other) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_other uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM user_blocks WHERE blocker = auth.uid() AND blocked = p_other;
$$;

CREATE OR REPLACE FUNCTION public.list_connections()
RETURNS TABLE (id uuid, other uuid, username text, display_name text, avatar text, status text, incoming boolean, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, o.user_id, o.username, o.display_name, o.avatar, f.status, f.addressee = auth.uid(), 'friendship'
  FROM friendships f JOIN student_profiles o ON o.user_id = CASE WHEN f.requester = auth.uid() THEN f.addressee ELSE f.requester END
  WHERE auth.uid() IN (f.requester, f.addressee)
  UNION ALL
  SELECT NULL, o.user_id, o.username, o.display_name, o.avatar, 'blocked', false, 'block'
  FROM user_blocks b JOIN student_profiles o ON o.user_id = b.blocked WHERE b.blocker = auth.uid();
$$;

-- Leaderboard: the signed-in student plus accepted friends who opted in. Aggregates only.
CREATE OR REPLACE FUNCTION public.friend_leaderboard(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (user_id uuid, display_name text, avatar text, is_me boolean, opted_in boolean, total_xp bigint, period_xp bigint, focus_minutes bigint, tasks bigint, goal_days bigint, streak integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.display_name, p.avatar, p.user_id = auth.uid(), p.leaderboard_opt_in,
    (SELECT coalesce(sum(amount), 0) FROM xp_transactions x WHERE x.user_id = p.user_id),
    (SELECT coalesce(sum(amount), 0) FROM xp_transactions x WHERE x.user_id = p.user_id AND x.activity_at >= p_from AND x.activity_at < p_to),
    CASE WHEN p.share_focus OR p.user_id = auth.uid() THEN (SELECT coalesce(sum(amount), 0) FROM xp_transactions x WHERE x.user_id = p.user_id AND x.reason = 'focus_minute' AND x.activity_at >= p_from AND x.activity_at < p_to) END,
    (SELECT count(*) FROM xp_transactions x WHERE x.user_id = p.user_id AND x.reason = 'task_complete' AND x.activity_at >= p_from AND x.activity_at < p_to),
    (SELECT count(*) FROM xp_transactions x WHERE x.user_id = p.user_id AND x.reason = 'daily_goal' AND x.activity_at >= p_from AND x.activity_at < p_to),
    CASE WHEN p.share_streak OR p.user_id = auth.uid() THEN p.current_streak END
  FROM student_profiles p
  WHERE p.user_id = auth.uid() OR (p.leaderboard_opt_in AND are_friends(auth.uid(), p.user_id) AND NOT is_blocked_between(auth.uid(), p.user_id));
$$;

-- ---------- Challenges ----------
CREATE OR REPLACE FUNCTION public.create_challenge(p_opponent uuid, p_kind text, p_target int, p_days int) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid; max_target int;
BEGIN
  IF NOT are_friends(auth.uid(), p_opponent) THEN RAISE EXCEPTION 'You can only challenge accepted friends'; END IF;
  IF p_days NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Challenges last 1 to 7 days'; END IF;
  -- Keep targets healthy: per-day ceilings.
  max_target := p_days * CASE p_kind WHEN 'focus_sessions' THEN 4 WHEN 'xp' THEN 300 WHEN 'tasks' THEN 6 WHEN 'goal_days' THEN 1 ELSE 0 END;
  IF p_target < 1 OR p_target > max_target THEN RAISE EXCEPTION 'Pick a target between 1 and %', max_target; END IF;
  INSERT INTO challenges (creator, opponent, kind, target, ends_at) VALUES (auth.uid(), p_opponent, p_kind, p_target, now() + make_interval(days => p_days)) RETURNING id INTO cid;
  RETURN cid;
END $$;

CREATE OR REPLACE FUNCTION public.respond_challenge(p_id uuid, p_accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM challenges WHERE id = p_id AND opponent = auth.uid() AND status = 'pending') THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  UPDATE challenges SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END,
    starts_at = CASE WHEN p_accept THEN now() ELSE starts_at END,
    ends_at = CASE WHEN p_accept THEN now() + (ends_at - created_at) ELSE ends_at END
  WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.challenge_progress_for(p_user uuid, p_kind text, p_from timestamptz, p_to timestamptz) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE p_kind
    WHEN 'focus_sessions' THEN (SELECT count(*) FROM xp_transactions WHERE user_id = p_user AND reason = 'focus_minute' AND activity_at BETWEEN p_from AND p_to)
    WHEN 'xp' THEN (SELECT coalesce(sum(amount), 0) FROM xp_transactions WHERE user_id = p_user AND activity_at BETWEEN p_from AND p_to)
    WHEN 'tasks' THEN (SELECT count(*) FROM xp_transactions WHERE user_id = p_user AND reason = 'task_complete' AND activity_at BETWEEN p_from AND p_to)
    WHEN 'goal_days' THEN (SELECT count(*) FROM xp_transactions WHERE user_id = p_user AND reason = 'daily_goal' AND activity_at BETWEEN p_from AND p_to)
  END;
$$;

CREATE OR REPLACE FUNCTION public.my_challenges()
RETURNS TABLE (id uuid, kind text, target int, status text, starts_at timestamptz, ends_at timestamptz, incoming boolean, other_name text, other_avatar text, my_progress bigint, their_progress bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.kind, c.target, c.status, c.starts_at, c.ends_at, c.opponent = auth.uid(), o.display_name, o.avatar,
    CASE WHEN c.status = 'accepted' THEN challenge_progress_for(auth.uid(), c.kind, c.starts_at, c.ends_at) ELSE 0 END,
    CASE WHEN c.status = 'accepted' THEN challenge_progress_for(o.user_id, c.kind, c.starts_at, c.ends_at) ELSE 0 END
  FROM challenges c JOIN student_profiles o ON o.user_id = CASE WHEN c.creator = auth.uid() THEN c.opponent ELSE c.creator END
  WHERE auth.uid() IN (c.creator, c.opponent) AND c.status <> 'declined' AND c.ends_at > now() - interval '3 days'
  ORDER BY c.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.challenge_progress_for(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC, anon;
DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['ensure_profile()','update_my_profile(text,text,text,boolean,boolean,boolean)','sync_xp(text)','find_student(text)','send_friend_request(uuid)','respond_friend_request(uuid,boolean)','remove_friend(uuid)','block_user(uuid)','unblock_user(uuid)','list_connections()','friend_leaderboard(timestamptz,timestamptz)','create_challenge(uuid,text,int,int)','respond_challenge(uuid,boolean)','my_challenges()'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

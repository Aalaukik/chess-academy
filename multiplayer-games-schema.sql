-- ══════════════════════════════════════════════════════════
--  Chess Academy — multiplayer_games table
--  Run AFTER supabase-schema.sql in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.multiplayer_games (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code     text        UNIQUE NOT NULL
                              DEFAULT upper(substring(replace(gen_random_uuid()::text,'-',''),1,6)),
  white_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  black_id        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  white_name      text,
  black_name      text,
  status          text        NOT NULL DEFAULT 'waiting'
                              CHECK (status IN ('waiting','active','complete','aborted')),
  result          text        CHECK (result IN ('white','black','draw','aborted')),
  result_reason   text,
  fen             text,
  move_history    text[]      DEFAULT '{}',
  last_move_from  text,
  last_move_to    text,
  last_move_at    timestamptz,
  time_control_ms bigint      NOT NULL DEFAULT 0,
  white_time_ms   bigint      NOT NULL DEFAULT 999999999,
  black_time_ms   bigint      NOT NULL DEFAULT 999999999,
  use_timer       boolean     NOT NULL DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.multiplayer_games ENABLE ROW LEVEL SECURITY;

-- Anyone can read games (needed for invite-code lookup)
CREATE POLICY "Anyone can view games"
  ON public.multiplayer_games FOR SELECT
  USING (true);

-- Only the creator (white) can insert
CREATE POLICY "Authenticated users can create games"
  ON public.multiplayer_games FOR INSERT
  WITH CHECK (auth.uid() = white_id);

-- Participant update policy (already handles NULL black_id on join)
CREATE POLICY "Participants can update game"
  ON public.multiplayer_games FOR UPDATE
  USING (
    auth.uid() = white_id
    OR auth.uid() = black_id
    OR (status = 'waiting' AND auth.uid() IS NOT NULL)
  )
  WITH CHECK (
    auth.uid() = white_id
    OR auth.uid() = black_id
  );

-- Enable realtime for this table (run separately if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.multiplayer_games;

-- Verify
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'multiplayer_games'
ORDER BY ordinal_position;

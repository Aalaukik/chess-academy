-- ══════════════════════════════════════════════════════════════════
--  Chess Academy — RLS Fix for multiplayer_games UPDATE policy
--  Run in: Supabase Dashboard → SQL Editor → New Query → Run
--
--  ROOT CAUSE:
--  The original UPDATE policy was:
--    USING (auth.uid() = white_id OR auth.uid() = black_id)
--  When a new player tries to JOIN a waiting game, black_id IS NULL
--  so both checks fail → RLS silently blocks the UPDATE → 0 rows
--  returned → app sees null and does nothing.
-- ══════════════════════════════════════════════════════════════════

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Participants can update game"
  ON public.multiplayer_games;

-- New two-part policy:
--
--  USING  (old row filter):
--    Allow if you are already a participant (white or black)
--    OR if the game is still 'waiting' and you are logged in
--    (this is how a new player is allowed to claim the black seat)
--
--  WITH CHECK  (new row validation):
--    After the update, you must be either white or black.
--    This prevents a random user from overwriting an active game.
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

-- Verify the policy was created correctly
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'multiplayer_games';

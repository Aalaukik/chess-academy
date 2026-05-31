-- ══════════════════════════════════════════════════════════════════
--  Chess Academy — Multiplayer Schema
--  Run AFTER supabase-schema.sql in:
--  Supabase Dashboard → SQL Editor → New Query → Run
--  Safe to re-run — all statements use IF NOT EXISTS / DO guards.
-- ══════════════════════════════════════════════════════════════════

-- ── 1. MULTIPLAYER GAMES TABLE ────────────────────────────────────
create table if not exists public.multiplayer_games (
  id              uuid        primary key default gen_random_uuid(),

  -- 6-char uppercase invite code, e.g. "A3K9XZ"
  invite_code     text        unique not null
                                default upper(substring(replace(gen_random_uuid()::text,'-',''), 1, 6)),

  -- Players (white always creates the game)
  white_id        uuid        references public.profiles(id) on delete set null,
  black_id        uuid        references public.profiles(id) on delete set null,
  white_name      text        not null default 'White',
  black_name      text,

  -- Board state — always kept current so reconnecting clients can catch up
  fen             text        not null
                                default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  move_history    text[]      not null default '{}',   -- SAN array e.g. {"e4","e5","Nf3"}
  last_move_from  text,                                -- e.g. "e2"
  last_move_to    text,                                -- e.g. "e4"

  -- Game lifecycle
  status          text        not null default 'waiting'
                                check (status in ('waiting','active','complete','aborted')),
  result          text        check (result in ('white','black','draw','aborted')),
  result_reason   text        check (result_reason in
                                ('checkmate','stalemate','resign','timeout',
                                 'draw_agreement','insufficient','repetition','abandoned')),

  -- Timers (stored in milliseconds; 0 = no timer)
  time_control_ms int         not null default 600000,   -- 10 min default
  white_time_ms   int         not null default 600000,
  black_time_ms   int         not null default 600000,
  use_timer       boolean     not null default false,
  last_move_at    timestamptz not null default now(),

  created_at      timestamptz not null default now()
);

-- ── 2. ENABLE REALTIME on the new table ──────────────────────────
--    Wrapped in a DO block so re-running this script never throws
--    "already a member of publication" (error 42710).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname    = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'multiplayer_games'
  ) then
    alter publication supabase_realtime add table public.multiplayer_games;
  end if;
end $$;

-- ── 3. ROW LEVEL SECURITY ─────────────────────────────────────────
alter table public.multiplayer_games enable row level security;

-- Everyone can read (required so a user can look up a game by invite
-- code before they've been set as black_id)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'multiplayer_games' and policyname = 'Anyone can read multiplayer games'
  ) then
    create policy "Anyone can read multiplayer games"
      on public.multiplayer_games for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'multiplayer_games' and policyname = 'Auth users can create games'
  ) then
    create policy "Auth users can create games"
      on public.multiplayer_games for insert
      with check (auth.uid() = white_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'multiplayer_games' and policyname = 'Participants can update game'
  ) then
    create policy "Participants can update game"
      on public.multiplayer_games for update
      using (auth.uid() = white_id or auth.uid() = black_id);
  end if;
end $$;

-- ── 4. INDEXES ────────────────────────────────────────────────────
create index if not exists idx_mp_games_invite_code
  on public.multiplayer_games (invite_code);

create index if not exists idx_mp_games_status_created
  on public.multiplayer_games (status, created_at desc);

create index if not exists idx_mp_games_white_id
  on public.multiplayer_games (white_id);

create index if not exists idx_mp_games_black_id
  on public.multiplayer_games (black_id);

-- ── 5. HELPER FUNCTION: clean up stale waiting games ─────────────
create or replace function public.cleanup_stale_games()
returns void language sql security definer as $$
  update public.multiplayer_games
  set status = 'aborted', result = 'aborted', result_reason = 'abandoned'
  where status = 'waiting'
    and created_at < now() - interval '10 minutes';
$$;

-- ── 6. ALLOW NULL DIFFICULTY IN game_sessions ────────────────────
--    Online games have no AI difficulty level so difficulty = NULL.
--    The original schema's check rejects NULL; this relaxes it.
alter table public.game_sessions
  drop constraint if exists game_sessions_difficulty_check;

alter table public.game_sessions
  add constraint game_sessions_difficulty_check
  check (difficulty is null or difficulty between 0 and 4);

-- ── VERIFY ────────────────────────────────────────────────────────
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'multiplayer_games'
order by ordinal_position;

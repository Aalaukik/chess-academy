-- ══════════════════════════════════════════════════════════
--  Chess Academy — Supabase Schema
--  Run this entire file in:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════

-- 1. PROFILES ─────────────────────────────────────────────
--    One row per user, created automatically on sign-up.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  avatar_url  text,
  created_at  timestamptz default now()
);

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. GAME SESSIONS ────────────────────────────────────────
create table if not exists public.game_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete cascade,
  result       text check (result in ('win','loss','draw','resign','timeout')),
  player_color text check (player_color in ('w','b')),
  difficulty   int  check (difficulty between 0 and 4),
  moves        text[],           -- array of SAN move strings
  opening      text,
  total_moves  int,
  duration_s   int,              -- seconds elapsed
  played_at    timestamptz default now()
);


-- 3. PROGRESS ─────────────────────────────────────────────
create table if not exists public.progress (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  completed_lessons int[]    default '{}',
  solved_puzzles    text[]   default '{}',
  puzzle_streak     int      default 0,
  wins              int      default 0,
  losses            int      default 0,
  draws             int      default 0,
  updated_at        timestamptz default now()
);

-- Auto-create progress row when profile is created
create or replace function public.handle_new_profile()
returns trigger language plpgsql security definer as $$
begin
  insert into public.progress (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();


-- 4. ROW LEVEL SECURITY ───────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.game_sessions enable row level security;
alter table public.progress      enable row level security;

-- Profiles: users can read all, only edit their own
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Game sessions: users can only see and insert their own
create policy "Users see own games"
  on public.game_sessions for select using (auth.uid() = user_id);

create policy "Users insert own games"
  on public.game_sessions for insert with check (auth.uid() = user_id);

-- Progress: users can only see and modify their own
create policy "Users see own progress"
  on public.progress for select using (auth.uid() = user_id);

create policy "Users upsert own progress"
  on public.progress for all using (auth.uid() = user_id);


-- 5. LEADERBOARD VIEW ─────────────────────────────────────
create or replace view public.leaderboard as
select
  p.username,
  pr.wins,
  pr.losses,
  pr.draws,
  pr.wins + pr.losses + pr.draws as total_games,
  case when (pr.wins + pr.losses + pr.draws) > 0
       then round(pr.wins::numeric / (pr.wins + pr.losses + pr.draws) * 100, 1)
       else 0
  end as win_rate,
  array_length(pr.completed_lessons, 1) as lessons_done,
  array_length(pr.solved_puzzles, 1)    as puzzles_solved,
  pr.puzzle_streak
from public.progress pr
join public.profiles p on p.id = pr.user_id
order by pr.wins desc, win_rate desc;

grant select on public.leaderboard to anon, authenticated;

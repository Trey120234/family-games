-- =============================================================
--  Games: play time table
--  Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- =============================================================

-- One row = one stretch of play in one game.
create table if not exists public.play_sessions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  game        text not null check (char_length(game) between 1 and 40),
  started_at  timestamptz not null,
  seconds     integer not null check (seconds between 0 and 86400),
  device      text check (char_length(device) <= 20),
  created_at  timestamptz not null default now()
);

create index if not exists play_sessions_user_time on public.play_sessions (user_id, started_at);

-- Safety rules: turn them on, then allow ONLY these two things.
alter table public.play_sessions enable row level security;

-- A player (including guests) can add sessions, but only as themselves.
drop policy if exists "add own sessions" on public.play_sessions;
create policy "add own sessions" on public.play_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- A player can read their own sessions (for a future "your stats" screen).
drop policy if exists "read own sessions" on public.play_sessions;
create policy "read own sessions" on public.play_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Nobody can change or delete sessions from the app.
-- You (the owner) can see everything in the Supabase dashboard.

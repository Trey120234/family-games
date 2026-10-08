-- =============================================================
--  Games: player summary - one row per player
--  Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--  Safe to run more than once.
--
--  play_sessions stays the full log (one row per visit to a game).
--  player_summary adds it all up per player, and updates by itself.
--  Find it in Table Editor under play_sessions.
--  Times are Central time (Chicago). Minutes have one decimal.
--
--  Added a new game later? Copy one of the game lines below, change
--  the game's folder name and the column name, and run this again.
-- =============================================================

drop view if exists public.player_summary;

create view public.player_summary
with (security_invoker = true)   -- follows the same safety rules as play_sessions
as
select user_id,
       string_agg(distinct device, ', ')                           as devices,
       min(started_at) at time zone 'America/Chicago'              as first_played,
       max(started_at) at time zone 'America/Chicago'              as last_played,
       count(distinct (started_at at time zone 'America/Chicago')::date) as days_played,
       count(*)                                                     as sessions,
       round(sum(seconds) / 60.0, 1)                                as total_minutes,
       round(coalesce(sum(seconds) filter (where game = 'solitaire'), 0) / 60.0, 1)     as solitaire,
       round(coalesce(sum(seconds) filter (where game = 'sudoku-sprout'), 0) / 60.0, 1) as sudoku,
       round(coalesce(sum(seconds) filter (where game = 'mahjong'), 0) / 60.0, 1)       as mahjong,
       round(coalesce(sum(seconds) filter (where game = 'word-garden'), 0) / 60.0, 1)   as word_garden,
       round(coalesce(sum(seconds) filter (where game = 'word-builder'), 0) / 60.0, 1)  as word_builder
from public.play_sessions
group by user_id
order by max(started_at) desc;   -- most recent players first

-- Only you (in the Supabase dashboard) can see it - not the app or players.
revoke all on public.player_summary from anon, authenticated;

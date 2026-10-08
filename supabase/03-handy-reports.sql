-- =============================================================
--  Handy reports - paste any one into SQL Editor and click Run.
--  Times and days are in Central time (Chicago), daylight saving
--  included. (The Table Editor itself still shows UTC.)
-- =============================================================

-- 1. Total play time per game (all players)
select game,
       count(distinct user_id)               as players,
       count(*)                              as sessions,
       round(sum(seconds) / 3600.0, 1)       as hours
from public.play_sessions
group by game
order by hours desc;

-- 2. Each player: how long they've played each game
select user_id,
       game,
       count(*)                              as sessions,
       round(sum(seconds) / 60.0)            as minutes,
       max(started_at) at time zone 'America/Chicago' as last_played
from public.play_sessions
group by user_id, game
order by max(started_at) desc;

-- 3. Play time per day, last 30 days (today and the 29 days before)
select (started_at at time zone 'America/Chicago')::date as day,
       count(distinct user_id)               as players,
       round(sum(seconds) / 60.0)            as minutes
from public.play_sessions
where (started_at at time zone 'America/Chicago')::date
      > (now() at time zone 'America/Chicago')::date - 30
group by day
order by day desc;

-- 4. Phone types
select device, count(distinct user_id) as players, round(sum(seconds) / 3600.0, 1) as hours
from public.play_sessions
group by device
order by hours desc;

-- =============================================================
--  Handy reports - paste any one into SQL Editor and click Run.
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
       max(started_at)                       as last_played
from public.play_sessions
group by user_id, game
order by last_played desc;

-- 3. Play time per day, last 30 days
select date_trunc('day', started_at)::date  as day,
       count(distinct user_id)               as players,
       round(sum(seconds) / 60.0)            as minutes
from public.play_sessions
where started_at > now() - interval '30 days'
group by day
order by day desc;

-- 4. Phone types
select device, count(distinct user_id) as players, round(sum(seconds) / 3600.0, 1) as hours
from public.play_sessions
group by device
order by hours desc;

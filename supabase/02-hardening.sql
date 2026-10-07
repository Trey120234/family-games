-- =============================================================
--  Games: security + reliability update for play_sessions
--  Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
--  Safe to run more than once.
-- =============================================================

-- 1. Each session carries its own random id, so a session that gets sent
--    twice (e.g. the phone closed the page mid-send) is only stored once.
alter table public.play_sessions add column if not exists client_id uuid;
update public.play_sessions set client_id = gen_random_uuid() where client_id is null;
alter table public.play_sessions alter column client_id set not null;
create unique index if not exists play_sessions_client_id on public.play_sessions (client_id);

-- 2. Access. New Supabase projects don't let the app use a new table until
--    it's granted. Players may READ (only their own rows - see the rules)
--    and ADD rows, filling in only these five columns. Nobody can set
--    user_id (it's always the signed-in player) or created_at.
revoke all on public.play_sessions from anon, authenticated;
grant select on public.play_sessions to authenticated;
grant insert (client_id, game, started_at, seconds, device) on public.play_sessions to authenticated;

-- 3. Only sensible values.
alter table public.play_sessions drop constraint if exists play_sessions_game_format;
alter table public.play_sessions add constraint play_sessions_game_format
  check (game ~ '^[a-z0-9-]{1,40}$');
alter table public.play_sessions drop constraint if exists play_sessions_device_ok;
alter table public.play_sessions add constraint play_sessions_device_ok
  check (device is null or device in ('android-app', 'android-web', 'iphone', 'ipad', 'computer'));

-- 4. Before each new row is saved:
--    - a phone with a wrong clock: keep the session, but use the server's time
--    - stop floods: at most 300 sessions per player per day
create index if not exists play_sessions_user_created on public.play_sessions (user_id, created_at);

create or replace function public.play_sessions_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  if new.started_at > now() + interval '10 minutes'
     or new.started_at < now() - interval '60 days' then
    new.started_at := now() - make_interval(secs => new.seconds);
  end if;
  if (select count(*) from public.play_sessions p
      where p.user_id = new.user_id
        and p.created_at > now() - interval '1 day') >= 300 then
    raise exception 'too many play sessions today' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists play_sessions_before_insert on public.play_sessions;
create trigger play_sessions_before_insert
  before insert on public.play_sessions
  for each row execute function public.play_sessions_before_insert();

-- 5. Make sure the safety rules are on (from the first script).
alter table public.play_sessions enable row level security;

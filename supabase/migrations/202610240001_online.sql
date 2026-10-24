-- Online adapter. The existing TypeScript engine is the only rules implementation.
-- The complete aggregate is private; clients receive a filtered view from the API.
begin;
create schema if not exists monigones_private;
revoke all on schema monigones_private from public,anon,authenticated;
grant usage on schema monigones_private to service_role;
alter table public.memberships add column club_id text unique;
create table monigones_private.games(
 league_id uuid primary key references public.leagues(id),
 state jsonb not null check(jsonb_typeof(state)='object'),
 revision bigint not null default 1 check(revision>0),
 invite text not null unique,
 next_due_at timestamptz not null default now(),
 lease_until timestamptz, lease_token uuid,
 attempts integer not null default 0, last_error text,
 updated_at timestamptz not null default now()
);
create index games_due on monigones_private.games(next_due_at);
create table monigones_private.receipts(
 user_id uuid not null references public.profiles(id), key text not null,
 league_id uuid not null references public.leagues(id), operation_hash text not null,
 revision bigint not null, created_at timestamptz not null default now(), primary key(user_id,key)
);
create table monigones_private.rate_limits(
 user_id uuid not null references auth.users(id) on delete cascade,
 bucket text not null, minute timestamptz not null, hits integer not null,
 primary key(user_id,bucket)
);
create table public.game_revisions(
 league_id uuid primary key references public.leagues(id), revision bigint not null,
 changed_at timestamptz not null default now()
);
alter table public.game_revisions enable row level security;
create policy revisions_members on public.game_revisions for select to authenticated
 using(public.is_league_member(league_id));
revoke all on public.game_revisions from public,anon,authenticated;
grant select on public.game_revisions to authenticated;
grant all on public.game_revisions to service_role;
alter table monigones_private.games enable row level security;
alter table monigones_private.receipts enable row level security;
alter table monigones_private.rate_limits enable row level security;
grant all on all tables in schema monigones_private to service_role;
-- This legacy example RPC belongs to the normalized draft schema, not the live engine.
-- Do not expose a second, disconnected path for placing economic bids.
revoke execute on function public.place_market_bid(uuid,text,bigint,integer,uuid) from authenticated;

create function public.online_health() returns boolean
language sql security definer set search_path=pg_catalog,pg_temp as $$select true$$;

create function public.online_profile(p_user uuid,p_name text) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if p_user is null or p_name is null or length(p_name) not between 2 and 60 then raise exception 'Invalid profile';end if;
 insert into public.profiles(id,display_name) values(p_user,p_name)
 on conflict(id) do update set display_name=excluded.display_name;
end$$;

create function public.online_rate(p_user uuid,p_bucket text,p_max integer) returns boolean
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare count integer;
begin
 if p_max not between 1 and 300 or p_bucket not in('read','command','join') then raise exception 'Invalid rate bucket';end if;
 insert into monigones_private.rate_limits values(p_user,p_bucket,date_trunc('minute',clock_timestamp()),1)
 on conflict(user_id,bucket) do update set
 hits=case when rate_limits.minute=excluded.minute then rate_limits.hits+1 else 1 end,
 minute=excluded.minute returning hits into count;
 return count<=p_max;
end$$;

create function public.online_load(p_user uuid,p_invite text default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g monigones_private.games%rowtype; m public.memberships%rowtype;
begin
 if p_invite is null then
  select * into m from public.memberships where user_id=p_user;
  if not found then return jsonb_build_object('membership',false,'now',floor(extract(epoch from clock_timestamp())*1000));end if;
  select * into g from monigones_private.games where league_id=m.league_id;
 else
  if exists(select 1 from public.memberships where user_id=p_user) then raise exception 'Ya perteneces a una liga.';end if;
  select * into g from monigones_private.games where invite=upper(trim(p_invite));
 end if;
 if g.league_id is null then raise exception 'Liga o invitación no válida.';end if;
 return jsonb_build_object('membership',m.user_id is not null,'state',g.state,'revision',g.revision,
  'clubId',m.club_id,'now',floor(extract(epoch from clock_timestamp())*1000),
  'presidents',coalesce((select jsonb_object_agg(p.id,p.display_name) from public.profiles p
    join public.memberships mm on mm.user_id=p.id where mm.league_id=g.league_id),'{}'::jsonb));
end$$;

create function public.online_head(p_user uuid) returns jsonb
language sql security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('revision',g.revision,'due',g.next_due_at<=clock_timestamp(),
 'now',floor(extract(epoch from clock_timestamp())*1000)) from monigones_private.games g
 join public.memberships m on m.league_id=g.league_id where m.user_id=p_user
$$;

create function public.online_create(p_user uuid,p_state jsonb,p_due timestamptz) returns boolean
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare id uuid:=(p_state->>'id')::uuid; club text:=p_state#>>'{clubs,0,id}';
begin
 perform 1 from public.profiles where profiles.id=p_user for update;
 if not found then raise exception 'Profile unavailable';end if;
 if exists(select 1 from public.memberships where user_id=p_user) then raise exception 'Ya perteneces a una liga.';end if;
 if p_state->>'adminId' is distinct from p_user::text or jsonb_array_length(p_state->'clubs')<>1
 or p_state#>>'{clubs,0,userId}' is distinct from p_user::text or club is null then raise exception 'Invalid new league';end if;
 insert into public.leagues(id,name,admin_id) values(id,p_state->>'name',p_user);
 insert into public.memberships(user_id,league_id,club_id) values(p_user,id,club);
 insert into monigones_private.games(league_id,state,invite,next_due_at) values(id,p_state,upper(p_state->>'invite'),p_due);
 insert into public.game_revisions values(id,1,clock_timestamp());
 return true;
end$$;

-- CAS + row lock + receipt is one PostgreSQL transaction. A stale computation is
-- discarded, reloaded and recomputed; it can never overwrite another command.
create function public.online_commit(p_league uuid,p_expected bigint,p_state jsonb,p_due timestamptz,
 p_user uuid default null,p_key text default null,p_hash text default null,p_join boolean default false)
returns text language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g monigones_private.games%rowtype; receipt monigones_private.receipts%rowtype; club text;
begin
 -- Lock ordering: profile then league, including concurrent joins and receipts.
 if p_user is not null then
  perform 1 from public.profiles where id=p_user for update;
  if not found then raise exception 'Profile unavailable';end if;
 end if;
 select * into g from monigones_private.games where league_id=p_league for update;
 if not found then raise exception 'League unavailable';end if;
 if p_key is not null then
  if p_user is null or p_hash is null or length(p_key) not between 8 and 100 then raise exception 'Invalid receipt';end if;
  select * into receipt from monigones_private.receipts where user_id=p_user and key=p_key;
  if found then
   if receipt.operation_hash<>p_hash or receipt.league_id<>p_league then raise exception 'La clave de idempotencia ya se utilizó con otra acción.';end if;
   return 'duplicate';
  end if;
 end if;
 if g.revision<>p_expected then return 'conflict';end if;
 if p_state->>'id' is distinct from p_league::text or (p_state->>'version')::bigint<=g.revision
 or p_state->>'adminId' is distinct from g.state->>'adminId' or p_state->>'invite' is distinct from g.state->>'invite'
 or (p_state->>'now')::bigint<(g.state->>'now')::bigint then raise exception 'Invalid aggregate';end if;
 if p_join then
  if p_user is null or exists(select 1 from public.memberships where user_id=p_user) then raise exception 'Ya perteneces a una liga.';end if;
  select c->>'id' into club from jsonb_array_elements(p_state->'clubs') c where c->>'userId'=p_user::text;
  if club is null or jsonb_array_length(p_state->'clubs')<>jsonb_array_length(g.state->'clubs')+1 then raise exception 'Invalid membership';end if;
  insert into public.memberships(user_id,league_id,club_id) values(p_user,p_league,club);
 elsif p_user is not null and not exists(select 1 from public.memberships where user_id=p_user and league_id=p_league) then
  raise exception 'No perteneces a esta liga.';
 end if;
 update monigones_private.games set state=p_state,revision=(p_state->>'version')::bigint,
 next_due_at=p_due,lease_until=null,lease_token=null,attempts=0,last_error=null,updated_at=clock_timestamp() where league_id=p_league;
 -- New seasons can create fresh club IDs. Keep auth membership in the same commit.
 update public.memberships m set club_id=c->>'id' from jsonb_array_elements(p_state->'clubs') c
 where m.league_id=p_league and m.user_id::text=c->>'userId';
 if p_key is not null then insert into monigones_private.receipts(user_id,key,league_id,operation_hash,revision)
 values(p_user,p_key,p_league,p_hash,(p_state->>'version')::bigint);end if;
 insert into public.game_revisions values(p_league,(p_state->>'version')::bigint,clock_timestamp())
 on conflict(league_id) do update set revision=excluded.revision,changed_at=excluded.changed_at;
 return 'committed';
end$$;

create function public.online_receipt(p_user uuid,p_key text) returns jsonb
language sql security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('hash',operation_hash,'league',league_id) from monigones_private.receipts where user_id=p_user and key=p_key
$$;

create function public.online_claim_due(p_limit integer default 10) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
 if p_limit not between 1 and 20 then raise exception 'Invalid batch';end if;
 with due as(select league_id from monigones_private.games where next_due_at<=clock_timestamp()
 and (lease_until is null or lease_until<clock_timestamp()) order by next_due_at for update skip locked limit p_limit),
 claimed as(update monigones_private.games g set lease_until=clock_timestamp()+interval '2 minutes',lease_token=gen_random_uuid(),attempts=attempts+1
 from due where g.league_id=due.league_id returning g.*)
 select coalesce(jsonb_agg(jsonb_build_object('state',state,'revision',revision,'lease',lease_token,
 'now',floor(extract(epoch from clock_timestamp())*1000))),'[]') into result from claimed;
 return result;
end$$;
create function public.online_tick_failed(p_league uuid,p_lease uuid,p_error text) returns void
language sql security definer set search_path=pg_catalog,pg_temp as $$
 update monigones_private.games set last_error=left(p_error,1000),lease_until=null,lease_token=null,
 next_due_at=clock_timestamp()+interval '1 minute' where league_id=p_league and lease_token=p_lease
$$;
-- Cron retries use the stored checkpoint; only the same CAS commit can publish an
-- advance. No resource reward or settlement can escape its aggregate transaction.
create function public.online_load_league(p_league uuid) returns jsonb
language sql security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('state',state,'revision',revision,'now',floor(extract(epoch from clock_timestamp())*1000))
 from monigones_private.games where league_id=p_league
$$;

do $$declare f record;begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'online\_%' escape '\' loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end$$;
-- RLS filters this metadata-only stream. No state, bids or private messages are published.
do $$begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime;
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='game_revisions') then
  alter publication supabase_realtime add table public.game_revisions;
 end if;
end$$;
commit;

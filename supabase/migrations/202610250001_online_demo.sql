-- Optional controlled demo import. No existing games or normalized catalogs change.
begin;
create table monigones_private.demo_seeds(
 league_id uuid primary key references public.leagues(id),
 admin_id uuid not null references public.profiles(id),
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 mode text not null check(mode in('initial','advanced')),
 start_at timestamptz not null,
 baseline_revision bigint not null,
 baseline_hash text not null,
 created_at timestamptz not null default clock_timestamp()
);
create table monigones_private.demo_slots(
 league_id uuid not null references monigones_private.demo_seeds(league_id),
 slot text not null check(slot ~ '^demo[1-6]$'),
 club_id text not null unique,
 reserved_user_id text not null unique,
 user_id uuid references public.profiles(id),
 president_name text not null check(length(president_name) between 2 and 60),
 primary key(league_id,slot), unique(league_id,user_id)
);
create table monigones_private.demo_runs(
 id uuid primary key default gen_random_uuid(),
 league_id uuid not null references monigones_private.demo_seeds(league_id),
 actor uuid not null references public.profiles(id),
 action text not null check(action in('create','bind')),
 revision bigint not null,
 details jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table monigones_private.demo_seeds enable row level security;
alter table monigones_private.demo_slots enable row level security;
alter table monigones_private.demo_runs enable row level security;
revoke all on monigones_private.demo_seeds,monigones_private.demo_slots,monigones_private.demo_runs from public,anon,authenticated;
grant all on monigones_private.demo_seeds,monigones_private.demo_slots,monigones_private.demo_runs to service_role;

create function public.online_demo_inspect(p_league uuid) returns jsonb
language sql security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object(
 'now',floor(extract(epoch from clock_timestamp())*1000),
 'exists',exists(select 1 from public.leagues where id=p_league),
 'demo',(select jsonb_build_object('requestHash',d.request_hash,'sourceHash',d.source_hash,
  'mode',d.mode,'startAt',floor(extract(epoch from d.start_at)*1000),'admin',d.admin_id,
  'revision',g.revision,'baselineRevision',d.baseline_revision,
  'modified',g.revision<>d.baseline_revision or encode(sha256(convert_to(g.state::text,'UTF8')),'hex')<>d.baseline_hash,
  'slots',(select jsonb_agg(jsonb_build_object('slot',s.slot,'clubId',s.club_id,'userId',s.user_id,
    'presidentName',s.president_name) order by s.slot) from monigones_private.demo_slots s where s.league_id=p_league),
  'runs',(select count(*) from monigones_private.demo_runs r where r.league_id=p_league))
  from monigones_private.demo_seeds d join monigones_private.games g using(league_id) where d.league_id=p_league))
$$;

create function public.online_demo_apply(p_spec jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
 s jsonb:=p_spec->'state'; id uuid:=(s->>'id')::uuid; admin uuid:=(s->>'adminId')::uuid;
 item jsonb; u uuid; club jsonb; old monigones_private.demo_seeds%rowtype;
 g monigones_private.games%rowtype; due timestamptz:=(p_spec->>'due')::timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(id::text,92041));
 select * into old from monigones_private.demo_seeds where league_id=id;
 if found then
  select * into g from monigones_private.games where league_id=id for update;
  if old.request_hash is distinct from p_spec->>'requestHash' then raise exception 'DEMO_CONFIG_MISMATCH';end if;
  if g.revision<>old.baseline_revision or encode(sha256(convert_to(g.state::text,'UTF8')),'hex')<>old.baseline_hash then raise exception 'DEMO_MODIFIED';end if;
  -- Compare supplied mappings; new users must use the separate binding operation.
  if exists(select 1 from jsonb_array_elements(p_spec->'slots') x
    left join monigones_private.demo_slots ds on ds.league_id=id and ds.slot=x->>'slot'
    where (x->>'userId') is distinct from ds.user_id::text) then raise exception 'DEMO_USE_BIND';end if;
  return jsonb_build_object('status','already_initialized','league',id,'revision',g.revision);
 end if;
 if exists(select 1 from public.leagues where leagues.id=(s->>'id')::uuid) then raise exception 'DEMO_TARGET_OCCUPIED';end if;
 if p_spec->>'requestHash' !~ '^[a-f0-9]{64}$' or p_spec->>'sourceHash' !~ '^[a-f0-9]{64}$'
 or p_spec->>'mode' not in('initial','advanced') or (s->>'version')::bigint<>1
 or (s->>'timeOffset')::bigint<>0 or jsonb_array_length(s->'clubs')<>6
 or jsonb_array_length(s->'players')<>500 or jsonb_array_length(p_spec->'slots')<>6
 or abs(extract(epoch from clock_timestamp())*1000-(s->>'now')::numeric)>300000
 or due<=clock_timestamp() or due>to_timestamp((s->>'nextMarketAt')::numeric/1000)
 then raise exception 'DEMO_INVALID_PLAN_OR_CLOCK';end if;
 if (select count(distinct c->>'id') from jsonb_array_elements(s->'clubs') c)<>6
 or (select count(distinct c->>'id') from jsonb_array_elements(s->'players') c)<>500
 or (select count(distinct x->>'slot') from jsonb_array_elements(p_spec->'slots') x where x->>'slot' ~ '^demo[1-6]$')<>6
 or (select count(*) from jsonb_array_elements(p_spec->'slots') x where x->>'userId' is not null)
 <> (select count(distinct x->>'userId') from jsonb_array_elements(p_spec->'slots') x)
 or not exists(select 1 from jsonb_array_elements(p_spec->'slots') x where x->>'slot'='demo1' and x->>'userId'=admin::text)
 then raise exception 'DEMO_INVALID_RELATIONS';end if;
 -- Deterministic profile locking also serializes against online_create/online_commit.
 for item in select x from jsonb_array_elements(p_spec->'slots') x where x->>'userId' is not null order by x->>'userId' loop
  u:=(item->>'userId')::uuid;
  if not exists(select 1 from auth.users where users.id=u) then raise exception 'DEMO_AUTH_USER_MISSING';end if;
  insert into public.profiles(id,display_name) values(u,item->>'presidentName') on conflict do nothing;
  perform 1 from public.profiles where profiles.id=u for update;
  if exists(select 1 from public.memberships where user_id=u) then raise exception 'DEMO_USER_ALREADY_MEMBER';end if;
 end loop;
 for item in select x from jsonb_array_elements(p_spec->'slots') x loop
  select c into club from jsonb_array_elements(s->'clubs') c where c->>'id'=item->>'clubId';
  if club is null or item->>'reservedUserId' is distinct from 'reserved-demo:'||id::text||':'||(item->>'slot')
   or club->>'userId' is distinct from coalesce(item->>'userId',item->>'reservedUserId')
   or club->>'presidentName' is distinct from item->>'presidentName'
  then raise exception 'DEMO_INVALID_CLUB_MAPPING';end if;
 end loop;
 -- Fresh independent secrets; reproducible public seed must not predict economic rolls or invitations.
 s:=jsonb_set(jsonb_set(s,'{privateRng}',to_jsonb(gen_random_uuid()::text)),
  '{invite}',to_jsonb(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))));
 insert into public.leagues(id,name,admin_id) values(id,s->>'name',admin);
 insert into monigones_private.games(league_id,state,invite,next_due_at) values(id,s,s->>'invite',due);
 insert into monigones_private.demo_seeds values(id,admin,p_spec->>'requestHash',p_spec->>'sourceHash',p_spec->>'mode',
  to_timestamp((s->>'now')::numeric/1000),1,encode(sha256(convert_to(s::text,'UTF8')),'hex'),clock_timestamp());
 for item in select x from jsonb_array_elements(p_spec->'slots') x loop
  u:=(item->>'userId')::uuid;
  insert into monigones_private.demo_slots values(id,item->>'slot',item->>'clubId',item->>'reservedUserId',u,item->>'presidentName');
  if u is not null then insert into public.memberships(user_id,league_id,club_id) values(u,id,item->>'clubId');end if;
 end loop;
 insert into public.game_revisions values(id,1,clock_timestamp());
 insert into monigones_private.demo_runs(league_id,actor,action,revision,details) values(id,admin,'create',1,
  jsonb_build_object('sourceHash',p_spec->>'sourceHash','mode',p_spec->>'mode','assigned',
   (select count(*) from monigones_private.demo_slots where league_id=id and user_id is not null)));
 return jsonb_build_object('status','created','league',id,'revision',1);
end$$;

-- Add users to reserved clubs without replacing game progress. Never transfer an owned club.
create function public.online_demo_bind(p_league uuid,p_admin uuid,p_request_hash text,p_bindings jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d monigones_private.demo_seeds%rowtype; g monigones_private.games%rowtype;
 v_slot monigones_private.demo_slots%rowtype; item jsonb; u uuid; s jsonb; count integer:=0; pristine boolean;
begin
 -- Validate only additions; no reassignment or dropping a membership is available.
 if jsonb_typeof(p_bindings) is distinct from 'object' or p_bindings='{}'::jsonb
 or exists(select 1 from jsonb_each_text(p_bindings) e where e.key !~ '^demo[1-6]$' or e.value is null)
 or (select count(*) from jsonb_each_text(p_bindings))<>(select count(distinct value) from jsonb_each_text(p_bindings))
 then raise exception 'DEMO_INVALID_BINDINGS';end if;
 for item in select to_jsonb(e) from jsonb_each_text(p_bindings) e order by e.value loop
  u:=(item->>'value')::uuid;
  if not exists(select 1 from auth.users where id=u) then raise exception 'DEMO_AUTH_USER_MISSING';end if;
  -- No profile can appear on a different league while this transaction is binding it.
  insert into public.profiles(id,display_name) values(u,'Presidente') on conflict do nothing;
  perform 1 from public.profiles where id=u for update;
 end loop;
 select * into g from monigones_private.games where league_id=p_league for update;
 select * into d from monigones_private.demo_seeds where league_id=p_league;
 if d.league_id is null or d.admin_id is distinct from p_admin or d.request_hash is distinct from p_request_hash then raise exception 'DEMO_NOT_AUTHORIZED';end if;
 s:=g.state;
 pristine:=g.revision=d.baseline_revision and encode(sha256(convert_to(s::text,'UTF8')),'hex')=d.baseline_hash;
 for item in select to_jsonb(e) from jsonb_each_text(p_bindings) e order by e.key loop
  u:=(item->>'value')::uuid;
  select * into v_slot from monigones_private.demo_slots where league_id=p_league and demo_slots.slot=item->>'key';
  if v_slot.user_id=u then continue;end if;
  if v_slot.league_id is null or v_slot.user_id is not null then raise exception 'DEMO_SLOT_ALREADY_OWNED';end if;
  if exists(select 1 from public.memberships where user_id=u) then raise exception 'DEMO_USER_ALREADY_MEMBER';end if;
  if not exists(select 1 from jsonb_array_elements(s->'clubs') c where c->>'id'=v_slot.club_id and c->>'userId'=v_slot.reserved_user_id) then raise exception 'DEMO_SLOT_CHANGED';end if;
  s:=replace(s::text,to_jsonb(v_slot.reserved_user_id)::text,to_jsonb(u::text)::text)::jsonb;
  insert into public.memberships(user_id,league_id,club_id) values(u,p_league,v_slot.club_id);
  update monigones_private.demo_slots set user_id=u where league_id=p_league and demo_slots.slot=v_slot.slot;
  count:=count+1;
 end loop;
 if count=0 then return jsonb_build_object('status','already_bound','league',p_league,'revision',g.revision);end if;
 s:=jsonb_set(s,'{version}',to_jsonb(g.revision+1));
 update monigones_private.games set state=s,revision=g.revision+1,updated_at=clock_timestamp() where league_id=p_league;
 if pristine then update monigones_private.demo_seeds set baseline_revision=g.revision+1,baseline_hash=encode(sha256(convert_to(s::text,'UTF8')),'hex') where league_id=p_league;end if;
 insert into public.game_revisions values(p_league,g.revision+1,clock_timestamp())
 on conflict(league_id) do update set revision=excluded.revision,changed_at=excluded.changed_at;
 insert into monigones_private.demo_runs(league_id,actor,action,revision,details) values(p_league,p_admin,'bind',g.revision+1,jsonb_build_object('assigned',count));
 return jsonb_build_object('status','bound','league',p_league,'assigned',count,'revision',g.revision+1);
end$$;

revoke all on function public.online_demo_inspect(uuid),public.online_demo_apply(jsonb),public.online_demo_bind(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.online_demo_inspect(uuid),public.online_demo_apply(jsonb),public.online_demo_bind(uuid,uuid,text,jsonb) to service_role;
commit;

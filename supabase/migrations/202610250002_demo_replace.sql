-- Explicit maintenance RPCs. Installation does not replace any game or touch Auth/Cron.
begin;
create table monigones_private.demo_backups(
 id uuid primary key, league_id uuid not null references public.leagues(id),
 admin_id uuid not null references public.profiles(id), payload jsonb not null,
 sha256 text not null, created_at timestamptz not null default clock_timestamp()
);
create table monigones_private.demo_replacements(
 id uuid primary key references monigones_private.demo_backups(id),
 league_id uuid not null references public.leagues(id), admin_id uuid not null,
 restore_from uuid references monigones_private.demo_backups(id), source_hash text not null,
 revision bigint not null, created_at timestamptz not null default clock_timestamp()
);
alter table monigones_private.demo_backups enable row level security;
alter table monigones_private.demo_replacements enable row level security;
revoke all on monigones_private.demo_backups,monigones_private.demo_replacements from public,anon,authenticated,service_role;
grant select,insert on monigones_private.demo_backups,monigones_private.demo_replacements to service_role;
alter table monigones_private.demo_runs drop constraint demo_runs_action_check;
alter table monigones_private.demo_runs add constraint demo_runs_action_check check(action in('create','bind','replace','restore'));

create function monigones_private.demo_capture(p_league uuid) returns jsonb
language sql set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object(
 'game',(select to_jsonb(g) from monigones_private.games g where league_id=p_league),
 'league',(select to_jsonb(l) from public.leagues l where id=p_league),
 'seed',(select to_jsonb(d) from monigones_private.demo_seeds d where league_id=p_league),
 'slots',coalesce((select jsonb_agg(to_jsonb(d) order by slot) from monigones_private.demo_slots d where league_id=p_league),'[]'),
 'memberships',coalesce((select jsonb_agg(to_jsonb(m) order by user_id) from public.memberships m where league_id=p_league),'[]'),
 'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by user_id,key) from monigones_private.receipts r where league_id=p_league),'[]'),
 'revision',(select to_jsonb(r) from public.game_revisions r where league_id=p_league))
$$;
revoke all on function monigones_private.demo_capture(uuid) from public,anon,authenticated;

create function public.online_demo_backup(p_backup uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare b monigones_private.demo_backups%rowtype;
begin
 select * into b from monigones_private.demo_backups where id=p_backup;
 if not found or b.sha256 is distinct from encode(sha256(convert_to(b.payload::text,'UTF8')),'hex') then raise exception 'REPLACE_BACKUP_INVALID';end if;
 return to_jsonb(b);
end$$;

create function public.online_demo_replacement_inspect(p_league uuid,p_admin uuid,p_restore uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare payload jsonb; b jsonb;
begin
 payload:=monigones_private.demo_capture(p_league);
 if payload#>>'{seed,admin_id}' is distinct from p_admin::text or payload#>>'{league,admin_id}' is distinct from p_admin::text
 or payload#>>'{game,state,adminId}' is distinct from p_admin::text
 or not exists(select 1 from auth.users where id=p_admin)
 or not exists(select 1 from public.memberships where user_id=p_admin and league_id=p_league)
 then raise exception 'REPLACE_NOT_AUTHORIZED_DEMO';end if;
 if p_restore is not null then
  b:=public.online_demo_backup(p_restore);
  if b->>'league_id' is distinct from p_league::text or b->>'admin_id' is distinct from p_admin::text then raise exception 'REPLACE_BACKUP_WRONG_TARGET';end if;
 end if;
 return jsonb_build_object('now',floor(extract(epoch from clock_timestamp())*1000),
 'fingerprint',encode(sha256(convert_to(payload::text,'UTF8')),'hex'),'current',payload,'backup',b);
end$$;

-- Compare every business field during restoration. Only clock-related values and reset fencing may differ.
create function monigones_private.demo_timeless(v jsonb,k text default '') returns jsonb
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare result jsonb; item record;
begin
 if k in('resetId','version','invite','privateRng','notificationReads') then return 'null'::jsonb;end if;
 if jsonb_typeof(v)='number' and k=any(array['at','now','seasonStartedAt','seasonEndsAt','nextMarketAt','startsAt','endsAt','locksAt','startedAt','createdAt','shieldUntil','lastInstitution','claimedAt','firstSeenAt','resolvedAt']) then return '0'::jsonb;end if;
 if jsonb_typeof(v)='string' and k=any(array['offerDay','lastPaidDay','lastDaily']) then return 'null'::jsonb;end if;
 if jsonb_typeof(v)='object' then
  result:='{}';
  for item in select * from jsonb_each(v) loop result:=result||jsonb_build_object(regexp_replace(item.key,'[0-9]{4}-[0-9]{2}-[0-9]{2}','DATE','g'),monigones_private.demo_timeless(item.value,item.key));end loop;
  return result;
 elsif jsonb_typeof(v)='array' then
  select coalesce(jsonb_agg(monigones_private.demo_timeless(value,k) order by ordinality),'[]') into result from jsonb_array_elements(v) with ordinality;
  return result;
 end if;
 return v;
end$$;
revoke all on function monigones_private.demo_timeless(jsonb,text) from public,anon,authenticated;

create function public.online_demo_replace(p_league uuid,p_admin uuid,p_operation uuid,p_expected text,p_spec jsonb,p_restore uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g monigones_private.games%rowtype; old monigones_private.demo_replacements%rowtype;
 payload jsonb; b jsonb; s jsonb:=p_spec->'state'; item jsonb; club jsonb;
 rev bigint; due timestamptz:=(p_spec->>'due')::timestamptz; sh text:=p_spec->>'sourceHash'; pristine boolean;
begin
 -- Same profile -> game lock order as commands/joins. CAS rejects old computations after commit.
 perform 1 from public.profiles where id=p_admin for update;
 perform pg_advisory_xact_lock(hashtextextended(p_league::text,92041));
 select * into g from monigones_private.games where league_id=p_league for update;
 select * into old from monigones_private.demo_replacements where id=p_operation;
 if found then
  if old.league_id<>p_league or old.admin_id<>p_admin or old.source_hash is distinct from sh or old.restore_from is distinct from p_restore then raise exception 'REPLACE_OPERATION_COLLISION';end if;
  return jsonb_build_object('status','already_applied','backup',p_operation,'revision',old.revision);
 end if;
 payload:=public.online_demo_replacement_inspect(p_league,p_admin,p_restore)->'current';
 if encode(sha256(convert_to(payload::text,'UTF8')),'hex') is distinct from p_expected then raise exception 'REPLACE_STALE_PREVIEW';end if;
 if exists(select 1 from public.memberships where league_id=p_league and user_id<>p_admin)
 or exists(select 1 from monigones_private.demo_slots where league_id=p_league and user_id is not null and user_id<>p_admin)
 then raise exception 'REPLACE_OTHER_USERS';end if;
 if s->>'id' is distinct from p_league::text or s->>'adminId' is distinct from p_admin::text
 or s->>'timeOffset' is distinct from '0' or jsonb_array_length(s->'clubs')<>6 or jsonb_array_length(s->'players')<>500
 or (s->>'now')::numeric < extract(epoch from clock_timestamp())*1000-120000
 or (s->>'now')::numeric > extract(epoch from clock_timestamp())*1000+5000
 or due<=clock_timestamp() or due>to_timestamp((s->>'nextMarketAt')::numeric/1000)
 or sh is null or sh !~ '^[a-f0-9]{64}$' then raise exception 'REPLACE_INVALID_PLAN';end if;
 if (select count(distinct c->>'id') from jsonb_array_elements(s->'clubs') c)<>6
 or (select count(distinct c->>'id') from jsonb_array_elements(s->'players') c)<>500
 or exists(select 1 from jsonb_array_elements(s->'contracts') c group by c->>'playerId' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(s->'contracts') c where not exists(select 1 from jsonb_array_elements(s->'players') p where p->>'id'=c->>'playerId') or not exists(select 1 from jsonb_array_elements(s->'clubs') p where p->>'id'=c->>'clubId'))
 then raise exception 'REPLACE_INVALID_RELATIONS';end if;
 if p_restore is null then
  if jsonb_array_length(p_spec->'slots')<>6 or jsonb_array_length(s->'contracts')<>58
  or s#>>'{draft,active}' is distinct from 'false' or s#>>'{draft,finished}' is distinct from 'true'
  or (select count(distinct x->>'slot') from jsonb_array_elements(p_spec->'slots') x where x->>'slot' ~ '^demo[1-6]$')<>6
  or exists(select 1 from jsonb_array_elements(s->'players') p where p->>'simulated' is distinct from 'false')
  or (select count(*) from jsonb_array_elements(p_spec->'slots') x where x->>'userId' is not null)<>1
  or not exists(select 1 from jsonb_array_elements(p_spec->'slots') x where x->>'slot'='demo1' and x->>'userId'=p_admin::text)
  then raise exception 'REPLACE_INVALID_FANTASY';end if;
  for item in select x from jsonb_array_elements(p_spec->'slots') x loop
   select c into club from jsonb_array_elements(s->'clubs') c where c->>'id'=item->>'clubId';
   if club is null or item->>'reservedUserId' is distinct from 'reserved-demo:'||p_league::text||':'||(item->>'slot')
   or club->>'userId' is distinct from coalesce(item->>'userId',item->>'reservedUserId') then raise exception 'REPLACE_INVALID_MAPPING';end if;
  end loop;
 else
  b:=public.online_demo_backup(p_restore)->'payload';
  if exists(select 1 from jsonb_array_elements(b->'memberships') m where m->>'user_id'<>p_admin::text)
   or (select count(*) from jsonb_array_elements(s->'clubs') c where c->>'userId'=p_admin::text)<>1
   or sh is distinct from (public.online_demo_backup(p_restore)->>'sha256') then raise exception 'REPLACE_INVALID_RESTORE';end if;
  if monigones_private.demo_timeless(s) is distinct from monigones_private.demo_timeless(b#>'{game,state}') then raise exception 'REPLACE_RESTORE_CONTENT_MISMATCH';end if;
  -- The restored plan may only rebase time / fence old clients; identities and ownership must match the backup.
  if (select jsonb_agg(jsonb_build_array(c->>'id',c->>'userId',c->>'name') order by c->>'id') from jsonb_array_elements(s->'clubs') c)
   is distinct from (select jsonb_agg(jsonb_build_array(c->>'id',c->>'userId',c->>'name') order by c->>'id') from jsonb_array_elements(b#>'{game,state,clubs}') c)
  then raise exception 'REPLACE_INVALID_RESTORE_MAPPING';end if;
 end if;
 -- A durable, immutable, complete aggregate/control checkpoint is created in this same transaction.
 insert into monigones_private.demo_backups(id,league_id,admin_id,payload,sha256)
 values(p_operation,p_league,p_admin,payload,encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
 rev:=g.revision+1;
 s:=jsonb_set(jsonb_set(jsonb_set(jsonb_set(s,'{version}',to_jsonb(rev)),
 '{resetId}',to_jsonb(p_operation::text)),'{privateRng}',to_jsonb(gen_random_uuid()::text)),
 '{invite}',to_jsonb(upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))));
 delete from monigones_private.receipts where league_id=p_league;
 delete from monigones_private.demo_slots where league_id=p_league;
 if p_restore is null then
  update monigones_private.demo_seeds set request_hash=p_spec->>'requestHash',source_hash=sh,mode='advanced',
   start_at=to_timestamp((s->>'now')::numeric/1000),baseline_revision=rev,
   baseline_hash=encode(sha256(convert_to(s::text,'UTF8')),'hex') where league_id=p_league;
  for item in select x from jsonb_array_elements(p_spec->'slots') x loop
   insert into monigones_private.demo_slots values(p_league,item->>'slot',item->>'clubId',item->>'reservedUserId',(item->>'userId')::uuid,item->>'presidentName');
  end loop;
 else
  pristine:=(b#>>'{game,revision}')::bigint=(b#>>'{seed,baseline_revision}')::bigint and
   encode(sha256(convert_to((b#>'{game,state}')::text,'UTF8')),'hex')=b#>>'{seed,baseline_hash}';
  update monigones_private.demo_seeds set request_hash=b#>>'{seed,request_hash}',source_hash=b#>>'{seed,source_hash}',mode=b#>>'{seed,mode}',
   start_at=to_timestamp((s->>'now')::numeric/1000),baseline_revision=case when pristine then rev else (b#>>'{seed,baseline_revision}')::bigint end,
   baseline_hash=case when pristine then encode(sha256(convert_to(s::text,'UTF8')),'hex') else b#>>'{seed,baseline_hash}' end where league_id=p_league;
  insert into monigones_private.demo_slots select * from jsonb_populate_recordset(null::monigones_private.demo_slots,b->'slots');
  insert into monigones_private.receipts select * from jsonb_populate_recordset(null::monigones_private.receipts,b->'receipts');
 end if;
 update public.memberships set club_id=(select c->>'id' from jsonb_array_elements(s->'clubs') c where c->>'userId'=p_admin::text)
 where user_id=p_admin and league_id=p_league;
 update public.leagues set name=s->>'name' where id=p_league;
 update monigones_private.games set state=s,revision=rev,invite=s->>'invite',next_due_at=due,
 lease_token=null,lease_until=null,attempts=0,last_error=null,updated_at=clock_timestamp() where league_id=p_league;
 insert into public.game_revisions values(p_league,rev,clock_timestamp()) on conflict(league_id) do update set revision=excluded.revision,changed_at=excluded.changed_at;
 insert into monigones_private.demo_replacements values(p_operation,p_league,p_admin,p_restore,sh,rev,clock_timestamp());
 insert into monigones_private.demo_runs(league_id,actor,action,revision,details) values(p_league,p_admin,case when p_restore is null then 'replace' else 'restore' end,rev,jsonb_build_object('backup',p_operation,'restoreFrom',p_restore,'sourceHash',sh));
 return jsonb_build_object('status','applied','backup',p_operation,'revision',rev);
end$$;
revoke all on function public.online_demo_backup(uuid),public.online_demo_replacement_inspect(uuid,uuid,uuid),public.online_demo_replace(uuid,uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.online_demo_backup(uuid),public.online_demo_replacement_inspect(uuid,uuid,uuid),public.online_demo_replace(uuid,uuid,uuid,text,jsonb,uuid) to service_role;
commit;

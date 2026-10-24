-- Monigones: modelo PostgreSQL para Supabase, validación de ejecución pendiente.
-- Migración inicial para una base nueva; no es un parche para una instalación existente.
-- NO es el adaptador activo del modo local. Véase docs/DATABASE.md.
begin;
create extension if not exists pgcrypto;
revoke create on schema public from public,anon,authenticated;
grant usage on schema public to authenticated,service_role;
create type public.fantasy_position as enum ('POR','DEF','MED','DEL');
create type public.resource_kind as enum ('money','development','medals','fame','prestige','luck','fans');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, display_name text not null check(length(display_name) between 2 and 60),created_at timestamptz not null default now());
create table public.leagues(id uuid primary key default gen_random_uuid(),name text not null,admin_id uuid not null references public.profiles(id),created_at timestamptz not null default now());
create table public.memberships(user_id uuid primary key references public.profiles(id),league_id uuid not null references public.leagues(id),joined_at timestamptz not null default now());
create index memberships_league_idx on public.memberships(league_id);
create table public.invitations(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),token_hash text not null unique,expires_at timestamptz not null,max_uses integer not null default 10,uses integer not null default 0 check(uses>=0 and uses<=max_uses));
create table public.seasons(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),number integer not null,starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'draft' check(status in('draft','active','archived')),unique(league_id,number),check(ends_at>starts_at));
create unique index seasons_one_active on public.seasons(league_id) where status in('draft','active');
create table public.real_clubs(id text primary key,name text not null,short_name text not null,color text not null,source_url text not null);
create table public.coaches(id text primary key,name text not null,real_club_id text references public.real_clubs(id),sport_bonus_bps integer not null default 0,simulated boolean not null,source_url text);
create table public.players(id text primary key,name text not null,full_name text,real_club_id text not null references public.real_clubs(id),position public.fantasy_position not null,simulated boolean not null,source_url text,verified_at timestamptz,avatar_url text,external_ids jsonb not null default '{}',check(simulated or source_url is not null));
create table public.clubs(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),user_id uuid not null references public.profiles(id),name text not null,color text not null,favorite_club_id text not null references public.real_clubs(id),coach_id text references public.coaches(id),unique(season_id,user_id),unique(id,season_id));
create table public.player_market_values(player_id text not null references public.players(id),at timestamptz not null,value_cents bigint not null check(value_cents>0),simulated boolean not null,primary key(player_id,at));
create table public.matchdays(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),number integer not null,starts_at timestamptz not null,locks_at timestamptz not null,status text not null default 'upcoming',settled_at timestamptz,unique(season_id,number));
create table public.matches(id uuid primary key default gen_random_uuid(),matchday_id uuid not null references public.matchdays(id),home_id text not null references public.real_clubs(id),away_id text not null references public.real_clubs(id),starts_at timestamptz not null,ends_at timestamptz,status text not null default 'scheduled',home_goals integer,away_goals integer,simulated boolean not null default true,check(home_id<>away_id));
create table public.player_statistics(player_id text not null references public.players(id),match_id uuid not null references public.matches(id),minutes integer not null check(minutes between 0 and 150),goals integer not null default 0,assists integer not null default 0,stats jsonb not null default '{}',primary key(player_id,match_id));
create table public.player_scores(player_id text not null references public.players(id),matchday_id uuid not null references public.matchdays(id),centipoints integer not null,provider_version text not null,simulated boolean not null,primary key(player_id,matchday_id));
create table public.ownership(season_id uuid not null references public.seasons(id),player_id text not null references public.players(id),club_id uuid not null,primary key(season_id,player_id),foreign key(club_id,season_id) references public.clubs(id,season_id));
create index ownership_club_idx on public.ownership(club_id);
create table public.contracts(season_id uuid not null,player_id text not null,salary_bps integer not null default 200 check(salary_bps between 50 and 1000),happiness integer not null default 75 check(happiness between 0 and 100),missed_rounds integer not null default 0,clause_cents bigint not null check(clause_cents>0),ends_at timestamptz not null,primary key(season_id,player_id),foreign key(season_id,player_id) references public.ownership(season_id,player_id) on delete cascade);
create table public.shields(id uuid primary key default gen_random_uuid(),season_id uuid not null,player_id text not null,starts_at timestamptz not null,ends_at timestamptz not null,cost_cents bigint not null check(cost_cents>0),foreign key(season_id,player_id) references public.contracts(season_id,player_id));
create table public.resources(club_id uuid not null references public.clubs(id),kind public.resource_kind not null,balance bigint not null default 0,primary key(club_id,kind),check(kind='money' or balance>=0));
create table public.ledger(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),kind public.resource_kind not null,delta bigint not null,balance bigint not null,reason text not null,reference text,created_at timestamptz not null default now());
create index ledger_club_time_idx on public.ledger(club_id,created_at desc);
create table public.idempotency_receipts(user_id uuid not null references public.profiles(id),key uuid not null,operation_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(user_id,key));
create table public.drafts(id uuid primary key default gen_random_uuid(),season_id uuid not null unique references public.seasons(id),status text not null default 'active',finished_at timestamptz);
create table public.draft_queue(draft_id uuid not null references public.drafts(id),player_id text not null references public.players(id),ordinal integer not null,primary key(draft_id,player_id),unique(draft_id,ordinal));
create table public.auctions(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),player_id text not null references public.players(id),kind text not null check(kind in('draft','special')),ends_at timestamptz not null,highest_cents bigint not null default 0,leading_club_id uuid references public.clubs(id),status text not null default 'open');
create unique index auctions_one_open_player on public.auctions(season_id,player_id) where status='open';
create table public.auction_bids(id uuid primary key default gen_random_uuid(),auction_id uuid not null references public.auctions(id),club_id uuid not null references public.clubs(id),amount_cents bigint not null check(amount_cents>0),created_at timestamptz not null default now());
create table public.markets(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),opens_at timestamptz not null,closes_at timestamptz not null,status text not null default 'open',unique(season_id,opens_at),check(closes_at>opens_at));
create table public.market_entries(market_id uuid not null references public.markets(id),player_id text not null references public.players(id),primary key(market_id,player_id));
create table public.market_bids(id uuid primary key default gen_random_uuid(),market_id uuid not null,player_id text not null,club_id uuid not null references public.clubs(id),amount_cents bigint not null check(amount_cents>0),salary_bps integer not null check(salary_bps between 200 and 1000),status text not null default 'open',rejection_percent numeric(7,4),random_roll numeric(7,4),attractiveness numeric(12,6),created_at timestamptz not null default now(),foreign key(market_id,player_id) references public.market_entries(market_id,player_id),unique(market_id,player_id,club_id));
create index market_bids_open_idx on public.market_bids(club_id) where status='open';
create table public.wishlists(club_id uuid not null references public.clubs(id),player_id text not null references public.players(id),primary key(club_id,player_id));
create table public.negotiations(id uuid primary key default gen_random_uuid(),from_club uuid not null references public.clubs(id),to_club uuid not null references public.clubs(id),player_id text not null references public.players(id),offered_player_id text references public.players(id),amount_cents bigint not null check(amount_cents>=0),status text not null default 'open',created_at timestamptz not null default now(),check(from_club<>to_club));
create table public.transfers(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),player_id text not null references public.players(id),from_club uuid references public.clubs(id),to_club uuid references public.clubs(id),amount_cents bigint not null check(amount_cents>=0),kind text not null,created_at timestamptz not null default now());
create table public.player_loans(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),player_id text not null references public.players(id),from_club uuid not null references public.clubs(id),to_club uuid not null references public.clubs(id),ends_matchday uuid not null references public.matchdays(id),returned_at timestamptz);
create table public.callups(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),matchday_id uuid not null references public.matchdays(id),policy text not null check(policy in('economic','standard','premium')),valid boolean not null default false,cost_cents bigint not null default 0,locked_at timestamptz,unique(club_id,matchday_id));
create table public.callup_players(callup_id uuid not null references public.callups(id),player_id text not null references public.players(id),position public.fantasy_position not null,slot integer check(slot between 0 and 10),bench boolean not null default false,value_snapshot_cents bigint not null,salary_snapshot_cents bigint not null,primary key(callup_id,player_id),unique(callup_id,slot));
create table public.slot_quality(club_id uuid not null references public.clubs(id),slot integer not null check(slot between 0 and 10),unlocked integer not null default 0,active integer not null default 0,primary key(club_id,slot),check(active between 0 and unlocked and unlocked<=3));
create table public.substitutions(id uuid primary key default gen_random_uuid(),callup_id uuid not null references public.callups(id),out_player text not null references public.players(id),in_player text not null references public.players(id),manual boolean not null,created_at timestamptz not null default now(),unique(callup_id,in_player));
create table public.round_reports(callup_id uuid primary key references public.callups(id),centipoints integer not null,salary_cents bigint not null,stadium_cents bigint not null,maintenance_cents bigint not null,television_cents bigint not null,concerts_cents bigint not null,merchandising_cents bigint not null,details jsonb not null);
create table public.building_definitions(id text primary key,name text not null,max_level integer not null check(max_level between 0 and 5),configuration jsonb not null);
create table public.facility_definitions(id text primary key,name text not null,max_level integer not null,configuration jsonb not null);
create table public.buildings(club_id uuid not null references public.clubs(id),definition_id text not null references public.building_definitions(id),level integer not null check(level between 1 and 5),primary key(club_id,definition_id));
create table public.facilities(club_id uuid not null references public.clubs(id),definition_id text not null references public.facility_definitions(id),level integer not null check(level>=0),primary key(club_id,definition_id));
create table public.office_modules(club_id uuid not null references public.clubs(id),module_id text not null,unlocked_at timestamptz not null default now(),primary key(club_id,module_id));
create table public.research_definitions(id text primary key,name text not null,tree text not null check(tree in('Finanzas','Competición','Relaciones')),branch integer not null check(branch between 0 and 2),max_level integer not null,building_level integer not null,effects jsonb not null);
create table public.research_dependencies(node_id text not null references public.research_definitions(id),requires_id text not null references public.research_definitions(id),primary key(node_id,requires_id),check(node_id<>requires_id));
create table public.research_progress(club_id uuid not null references public.clubs(id),node_id text not null references public.research_definitions(id),level integer not null default 0,primary key(club_id,node_id));
create table public.jobs(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),kind text not null check(kind in('building','facility','research','academy')),target text not null,level integer not null,starts_at timestamptz not null,ends_at timestamptz not null,cost_cents bigint not null,development_cost integer not null default 0,status text not null default 'pending',attempts integer not null default 0,last_error text,check(ends_at>starts_at));
create index jobs_due_idx on public.jobs(ends_at) where status='pending';
create unique index jobs_one_research on public.jobs(club_id) where kind='research' and status='pending';
create unique index jobs_no_duplicate on public.jobs(club_id,kind,target) where status='pending';
create table public.bonuses(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),source text not null,kind text not null,amount_bps integer not null,expires_at timestamptz);
create table public.sponsor_definitions(id text primary key,name text not null,configuration jsonb not null);
create table public.sponsor_deals(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),sponsor_id text not null references public.sponsor_definitions(id),slot text not null,starts_at timestamptz not null,ends_at timestamptz not null,daily_cents bigint not null);
create table public.sponsor_payments(deal_id uuid not null references public.sponsor_deals(id),local_day date not null,ledger_id uuid not null references public.ledger(id),primary key(deal_id,local_day));
create table public.concert_definitions(id text primary key,artist_name text not null,configuration jsonb not null);
create table public.concert_deals(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),concert_id text not null references public.concert_definitions(id),starts_at timestamptz not null,ends_at timestamptz not null,per_round_cents bigint not null);
create table public.concert_payments(deal_id uuid not null references public.concert_deals(id),matchday_id uuid not null references public.matchdays(id),ledger_id uuid not null references public.ledger(id),primary key(deal_id,matchday_id));
create table public.merchandising_sales(club_id uuid not null references public.clubs(id),matchday_id uuid not null references public.matchdays(id),amount_cents bigint not null,primary key(club_id,matchday_id));
create table public.daily_decisions(club_id uuid not null references public.clubs(id),local_day date not null,action_id text not null,completed_at timestamptz,primary key(club_id,local_day,action_id));
create table public.institutional_actions(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),action_id text not null,risk_percent numeric not null,roll numeric not null,outcome text not null,created_at timestamptz not null default now());
create table public.bank_loans(id uuid primary key default gen_random_uuid(),club_id uuid not null references public.clubs(id),principal_cents bigint not null,repay_cents bigint not null,due_matchday uuid not null references public.matchdays(id),settled_at timestamptz);
create table public.news(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),club_id uuid references public.clubs(id),category text not null,title text not null,subtitle text not null,event_reference text,created_at timestamptz not null default now());
create index news_league_time_idx on public.news(league_id,created_at desc);
create table public.newspaper_editions(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),local_day date not null,unique(league_id,local_day));
create table public.newspaper_articles(edition_id uuid not null references public.newspaper_editions(id),news_id uuid not null references public.news(id),ordinal integer not null,primary key(edition_id,news_id));
create table public.events(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),type text not null,title text not null,starts_at timestamptz not null,ends_at timestamptz not null,goal integer not null,reward jsonb not null,rules jsonb not null default '{}');
create table public.event_progress(event_id uuid not null references public.events(id),club_id uuid not null references public.clubs(id),progress integer not null default 0,claimed_at timestamptz,primary key(event_id,club_id));
create table public.achievement_definitions(id text primary key,name text not null,configuration jsonb not null);
create table public.trophies(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),user_id uuid not null references public.profiles(id),season_number integer not null,title text not null,detail text not null,created_at timestamptz not null default now());
create table public.chat_messages(id uuid primary key default gen_random_uuid(),league_id uuid not null references public.leagues(id),author_id uuid not null references public.profiles(id),body text not null check(length(body) between 1 and 500),created_at timestamptz not null default now(),deleted_at timestamptz);
create index chat_league_time_idx on public.chat_messages(league_id,created_at);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id),league_id uuid not null references public.leagues(id),title text not null,read_at timestamptz,created_at timestamptz not null default now());
create table public.sports_sync_logs(id uuid primary key default gen_random_uuid(),provider text not null,version text not null,status text not null,attempt integer not null,detail jsonb not null,created_at timestamptz not null default now());
create table public.process_runs(id uuid primary key default gen_random_uuid(),season_id uuid not null references public.seasons(id),key text not null,status text not null,attempts integer not null default 1,error text,created_at timestamptz not null default now(),unique(season_id,key));
create table public.season_archives(season_id uuid primary key references public.seasons(id),ranking jsonb not null,archived_at timestamptz not null default now());
create table public.game_configuration(key text primary key,value jsonb not null);

-- Predicados con propietario de confianza evitan recursión en las políticas de membresía.
create function public.is_league_member(p_league uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select exists(select 1 from public.memberships where user_id=auth.uid() and league_id=p_league)$$;
create function public.is_club_owner(p_club uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select exists(select 1 from public.clubs where id=p_club and user_id=auth.uid())$$;
create function public.club_visible(p_club uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select exists(select 1 from public.clubs c join public.seasons s on s.id=c.season_id where c.id=p_club and public.is_league_member(s.league_id))$$;
create function public.season_visible(p_season uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$select exists(select 1 from public.seasons s where s.id=p_season and public.is_league_member(s.league_id))$$;
-- RLS por defecto cerrada; las escrituras económicas quedan reservadas al servidor.
do $$declare t record;begin for t in select tablename from pg_tables where schemaname='public' and tablename=any(array['profiles','leagues','memberships','invitations','seasons','real_clubs','coaches','players','clubs','player_market_values','matchdays','matches','player_statistics','player_scores','ownership','contracts','shields','resources','ledger','idempotency_receipts','drafts','draft_queue','auctions','auction_bids','markets','market_entries','market_bids','wishlists','negotiations','transfers','player_loans','callups','callup_players','slot_quality','substitutions','round_reports','building_definitions','facility_definitions','buildings','facilities','office_modules','research_definitions','research_dependencies','research_progress','jobs','bonuses','sponsor_definitions','sponsor_deals','sponsor_payments','concert_definitions','concert_deals','concert_payments','merchandising_sales','daily_decisions','institutional_actions','bank_loans','news','newspaper_editions','newspaper_articles','events','event_progress','achievement_definitions','trophies','chat_messages','notifications','sports_sync_logs','process_runs','season_archives','game_configuration']) loop execute format('alter table public.%I enable row level security',t.tablename);end loop;end$$;
create policy profiles_self on public.profiles for select to authenticated using(id=auth.uid());
create policy league_members on public.leagues for select to authenticated using(public.is_league_member(id));
create policy memberships_same_league on public.memberships for select to authenticated using(public.is_league_member(league_id));
create policy invitations_admin on public.invitations for select to authenticated using(exists(select 1 from public.leagues l where l.id=league_id and l.admin_id=auth.uid()));
create policy season_members on public.seasons for select to authenticated using(public.is_league_member(league_id));
create policy clubs_members on public.clubs for select to authenticated using(public.season_visible(season_id));
do $$declare t text;begin foreach t in array array['real_clubs','players','coaches','player_market_values','building_definitions','facility_definitions','research_definitions','research_dependencies','sponsor_definitions','concert_definitions','achievement_definitions'] loop execute format('create policy catalog_read on public.%I for select to authenticated using(true)',t);end loop;end$$;
do $$declare t text;begin foreach t in array array['resources','ledger','jobs','callups','slot_quality','buildings','facilities','office_modules','research_progress','bonuses','sponsor_deals','concert_deals','bank_loans','daily_decisions','institutional_actions','wishlists'] loop execute format('create policy club_private on public.%I for select to authenticated using(public.is_club_owner(club_id))',t);end loop;end$$;
do $$declare t text;begin foreach t in array array['ownership','transfers','player_loans','matchdays','drafts','auctions','markets','events'] loop execute format('create policy season_members on public.%I for select to authenticated using(public.season_visible(season_id))',t);end loop;end$$;
create policy bids_owner_or_winner on public.market_bids for select to authenticated using(public.is_club_owner(club_id) or (status='won' and public.club_visible(club_id)));
create policy negotiations_participants on public.negotiations for select to authenticated using(public.is_club_owner(from_club) or public.is_club_owner(to_club));
create policy news_members on public.news for select to authenticated using(public.is_league_member(league_id));
create policy newspaper_members on public.newspaper_editions for select to authenticated using(public.is_league_member(league_id));
create policy trophies_members on public.trophies for select to authenticated using(public.is_league_member(league_id));
create policy chat_members on public.chat_messages for select to authenticated using(public.is_league_member(league_id) and deleted_at is null);
create policy notifications_self on public.notifications for select to authenticated using(user_id=auth.uid() and public.is_league_member(league_id));
create policy receipts_self on public.idempotency_receipts for select to authenticated using(user_id=auth.uid());
-- Las tablas de detalle sin política permanecen inaccesibles al cliente hasta disponer de vistas seguras.
-- RPC de ejemplo transaccional: todo importe es contrastado con el VM del servidor.
create function public.place_market_bid(p_market uuid,p_player text,p_amount bigint,p_salary integer,p_key uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_user uuid:=auth.uid();v_club uuid;v_season uuid;v_balance bigint;v_reserved bigint;v_value bigint;v_id uuid;v_hash text;v_prior public.idempotency_receipts%rowtype;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_market is null or p_player is null or length(p_player)=0 or p_amount is null or p_amount<=0 or p_salary is null or p_salary not between 200 and 1000 or p_key is null then raise exception 'Invalid offer';end if;
 v_hash:=encode(sha256(convert_to(jsonb_build_array('place_market_bid',p_market,p_player,p_amount,p_salary)::text,'UTF8')),'hex');
 -- Serializar acciones del mismo usuario también impide carreras sobre la clave idempotente.
 perform 1 from public.profiles where id=v_user for update;
 if not found then raise exception 'Profile unavailable';end if;
 select * into v_prior from public.idempotency_receipts where user_id=v_user and key=p_key;
 if found then if v_prior.operation_hash<>v_hash then raise exception 'Idempotency key reused';end if;return(v_prior.result->>'bid_id')::uuid;end if;
 select m.season_id into v_season from public.markets m join public.seasons s on s.id=m.season_id where m.id=p_market and m.status='open' and m.opens_at<=now() and m.closes_at>now() and s.status='active' and public.is_league_member(s.league_id) for update of m;
 if not found then raise exception 'Market closed or unavailable';end if;
 select id into v_club from public.clubs where user_id=v_user and season_id=v_season;
 if v_club is null then raise exception 'Club unavailable';end if;
 perform 1 from public.market_entries where market_id=p_market and player_id=p_player;
 if not found or exists(select 1 from public.ownership where season_id=v_season and player_id=p_player) then raise exception 'Player unavailable';end if;
 select value_cents into v_value from public.player_market_values where player_id=p_player and at<=now() order by at desc limit 1;
 if v_value is null or p_amount<v_value or p_salary not between 200 and 1000 then raise exception 'Invalid offer';end if;
 select balance into v_balance from public.resources where club_id=v_club and kind='money' for update;
 select coalesce(sum(amount_cents),0) into v_reserved from public.market_bids where club_id=v_club and status='open' and not(market_id=p_market and player_id=p_player);
 v_reserved:=v_reserved+(select coalesce(sum(highest_cents),0) from public.auctions where leading_club_id=v_club and status='open');
 if v_balance is null or v_balance-v_reserved<p_amount then raise exception 'Insufficient available balance';end if;
 if exists(select 1 from public.market_bids where market_id=p_market and player_id=p_player and club_id=v_club and status not in('open','withdrawn')) then raise exception 'Offer already settled';end if;
 if (select count(*) from (select player_id from public.ownership where club_id=v_club union select player_id from public.market_bids where club_id=v_club and status='open' and not(market_id=p_market and player_id=p_player) union select player_id from public.auctions where leading_club_id=v_club and status='open') reserved_players)>=least(30,12+coalesce((select level from public.facilities where club_id=v_club and definition_id='locker'),0)) then raise exception 'Squad full';end if;
 insert into public.market_bids(market_id,player_id,club_id,amount_cents,salary_bps) values(p_market,p_player,v_club,p_amount,p_salary) on conflict(market_id,player_id,club_id) do update set amount_cents=excluded.amount_cents,salary_bps=excluded.salary_bps,status='open',created_at=now() returning id into v_id;
 insert into public.idempotency_receipts values(v_user,p_key,v_hash,jsonb_build_object('bid_id',v_id),now());return v_id;
end$$;
revoke all on function public.place_market_bid(uuid,text,bigint,integer,uuid) from public,anon;
grant execute on function public.place_market_bid(uuid,text,bigint,integer,uuid) to authenticated;
-- The four boolean helpers return only authorization decisions, not personal data.
revoke all on function public.is_league_member(uuid),public.is_club_owner(uuid),public.club_visible(uuid),public.season_visible(uuid) from public,anon;
grant execute on function public.is_league_member(uuid),public.is_club_owner(uuid),public.club_visible(uuid),public.season_visible(uuid) to authenticated;
-- Apply privileges only to tables declared by this migration, never unrelated public tables.
do $privileges$
declare t record;
begin
 for t in select tablename from pg_tables where schemaname='public' and rowsecurity and tablename=any(array[
 'profiles','leagues','memberships','invitations','seasons','real_clubs','coaches','players','clubs','player_market_values','matchdays','matches','player_statistics','player_scores','ownership','contracts','shields','resources','ledger','idempotency_receipts','drafts','draft_queue','auctions','auction_bids','markets','market_entries','market_bids','wishlists','negotiations','transfers','player_loans','callups','callup_players','slot_quality','substitutions','round_reports','building_definitions','facility_definitions','buildings','facilities','office_modules','research_definitions','research_dependencies','research_progress','jobs','bonuses','sponsor_definitions','sponsor_deals','sponsor_payments','concert_definitions','concert_deals','concert_payments','merchandising_sales','daily_decisions','institutional_actions','bank_loans','news','newspaper_editions','newspaper_articles','events','event_progress','achievement_definitions','trophies','chat_messages','notifications','sports_sync_logs','process_runs','season_archives','game_configuration']) loop
   execute format('revoke all on table public.%I from public,anon,authenticated',t.tablename);
   execute format('grant select on table public.%I to authenticated',t.tablename);
   execute format('grant all on table public.%I to service_role',t.tablename);
 end loop;
end $privileges$;
-- Clients never write economic rows directly. The server role remains trusted and private.
-- Additional consistency constraints; negative money is allowed because debt is a game mechanic.
alter table public.invitations add constraint invitations_positive_uses check(max_uses>0);
alter table public.seasons add constraint seasons_positive_number check(number>0);
alter table public.matchdays add constraint matchdays_state check(number>0 and locks_at<=starts_at and status in('upcoming','live','finished'));
alter table public.matches add constraint matches_values check((ends_at is null or ends_at>starts_at) and status in('scheduled','live','finished','postponed') and (home_goals is null or home_goals>=0) and (away_goals is null or away_goals>=0));
alter table public.player_statistics add constraint statistics_nonnegative check(goals>=0 and assists>=0);
alter table public.contracts add constraint contracts_missed check(missed_rounds>=0);
alter table public.shields add constraint shields_time check(ends_at>starts_at);
alter table public.resources add constraint resources_bounded check(kind not in('fame','prestige','fans','luck') or balance<=100);
alter table public.auctions add constraint auctions_values check(highest_cents>=0 and status in('open','closed') and ((highest_cents=0 and leading_club_id is null) or (highest_cents>0 and leading_club_id is not null)));
alter table public.market_bids add constraint market_bid_values check(status in('open','won','rejected','lost','withdrawn') and (rejection_percent is null or rejection_percent between 0 and 100) and (random_roll is null or random_roll between 0 and 100));
alter table public.markets add constraint markets_status check(status in('open','closed'));
alter table public.negotiations add constraint negotiations_status check(status in('open','accepted','rejected','countered'));
alter table public.player_loans add constraint loans_distinct_clubs check(from_club<>to_club);
alter table public.callups add constraint callups_nonnegative check(cost_cents>=0);
alter table public.callup_players add constraint callup_player_values check(value_snapshot_cents>0 and salary_snapshot_cents>=0 and ((bench and slot is null) or (not bench and slot is not null)));
alter table public.slot_quality add constraint slot_quality_minimum check(unlocked>=0);
alter table public.facility_definitions add constraint facilities_maximum check(max_level>=0);
alter table public.research_definitions add constraint research_definition_limits check(max_level>0 and building_level between 1 and 5);
alter table public.research_progress add constraint research_progress_minimum check(level>=0);
alter table public.jobs add constraint jobs_values check(level>0 and cost_cents>=0 and development_cost>=0 and attempts>=0 and status in('pending','completed','cancelled','failed'));
alter table public.sponsor_deals add constraint sponsor_values check(daily_cents>=0 and ends_at>starts_at);
alter table public.concert_deals add constraint concert_values check(per_round_cents>=0 and ends_at>starts_at);
alter table public.merchandising_sales add constraint merchandising_values check(amount_cents>=0);
alter table public.bank_loans add constraint bank_values check(principal_cents>0 and repay_cents>=principal_cents);
alter table public.institutional_actions add constraint institutional_values check(risk_percent between 0 and 100 and roll between 0 and 100);
alter table public.events add constraint events_values check(goal>0 and ends_at>starts_at);
alter table public.event_progress add constraint event_progress_minimum check(progress>=0);
alter table public.process_runs add constraint process_attempts check(attempts>0);
-- Finite sponsorship overlaps are checked by the trusted game command; no time-dependent CHECK.
create index notifications_user_league_time_idx on public.notifications(user_id,league_id,created_at desc);
create index contracts_expiry_idx on public.contracts(ends_at);
create index research_dependencies_requires_idx on public.research_dependencies(requires_id);
create index negotiations_recipient_idx on public.negotiations(to_club) where status in('open','countered');

-- Child foreign keys alone did not prevent a trusted writer linking different leagues/seasons.
-- A shared trigger validates the season relationships on insertion or modification.
create function public.validate_season_links() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $links$
declare expected uuid; other uuid;
begin
 case tg_table_name
 when 'market_bids' then
   select season_id into expected from public.markets where id=new.market_id;
   select season_id into other from public.clubs where id=new.club_id;
 when 'auction_bids' then
   select season_id into expected from public.auctions where id=new.auction_id;
   select season_id into other from public.clubs where id=new.club_id;
 when 'callups' then
   select season_id into expected from public.matchdays where id=new.matchday_id;
   select season_id into other from public.clubs where id=new.club_id;
 when 'negotiations' then
   select season_id into expected from public.clubs where id=new.from_club;
   select season_id into other from public.clubs where id=new.to_club;
 when 'player_loans' then
   expected:=new.season_id;
   if not exists(select 1 from public.clubs where id=new.from_club and season_id=expected)
      or not exists(select 1 from public.clubs where id=new.to_club and season_id=expected)
      or not exists(select 1 from public.matchdays where id=new.ends_matchday and season_id=expected) then
     raise exception 'Cross-season player loan';
   end if;
   return new;
 when 'transfers' then
   expected:=new.season_id;
   if (new.from_club is not null and not exists(select 1 from public.clubs where id=new.from_club and season_id=expected))
      or (new.to_club is not null and not exists(select 1 from public.clubs where id=new.to_club and season_id=expected)) then
     raise exception 'Cross-season transfer';
   end if;
   return new;
 when 'auctions' then
   if new.leading_club_id is null then return new;end if;
   expected:=new.season_id;
   select season_id into other from public.clubs where id=new.leading_club_id;
 when 'event_progress' then
   select season_id into expected from public.events where id=new.event_id;
   select season_id into other from public.clubs where id=new.club_id;
 when 'merchandising_sales' then
   select season_id into expected from public.matchdays where id=new.matchday_id;
   select season_id into other from public.clubs where id=new.club_id;
 when 'bank_loans' then
   select season_id into expected from public.matchdays where id=new.due_matchday;
   select season_id into other from public.clubs where id=new.club_id;
 else raise exception 'Unexpected season-link trigger';
 end case;
 if expected is null or other is null or expected<>other then raise exception 'Cross-season reference';end if;
 return new;
end $links$;
revoke all on function public.validate_season_links() from public,anon,authenticated;
do $triggers$
declare t text;
begin
 foreach t in array array['market_bids','auction_bids','callups','negotiations','player_loans','transfers','auctions','event_progress','merchandising_sales','bank_loans'] loop
   execute format('create trigger validate_season_links before insert or update on public.%I for each row execute function public.validate_season_links()',t);
 end loop;
end $triggers$;

create function public.validate_detail_links() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $details$
declare expected uuid; other uuid;
begin
 case tg_table_name
 when 'news' then
   if new.club_id is null then return new;end if;
   select s.league_id into expected from public.clubs c join public.seasons s on s.id=c.season_id where c.id=new.club_id;
   other:=new.league_id;
 when 'newspaper_articles' then
   select league_id into expected from public.newspaper_editions where id=new.edition_id;
   select league_id into other from public.news where id=new.news_id;
 when 'notifications','chat_messages' then
   expected:=new.league_id;
   if tg_table_name='notifications' then
     select league_id into other from public.memberships where user_id=new.user_id;
   else
     select league_id into other from public.memberships where user_id=new.author_id;
   end if;
 when 'callup_players' then
   select c.season_id into expected from public.callups ca join public.clubs c on c.id=ca.club_id where ca.id=new.callup_id;
   select o.season_id into other from public.ownership o join public.callups ca on ca.club_id=o.club_id where ca.id=new.callup_id and o.player_id=new.player_id and o.season_id=expected;
 when 'sponsor_payments' then
   select club_id into expected from public.sponsor_deals where id=new.deal_id;
   select club_id into other from public.ledger where id=new.ledger_id;
 when 'concert_payments' then
   select club_id into expected from public.concert_deals where id=new.deal_id;
   select club_id into other from public.ledger where id=new.ledger_id;
   if not exists(select 1 from public.matchdays m join public.clubs c on c.season_id=m.season_id where m.id=new.matchday_id and c.id=expected) then raise exception 'Cross-season concert payment';end if;
 else raise exception 'Unexpected detail-link trigger';
 end case;
 if expected is null or other is null or expected<>other then raise exception 'Inconsistent detail reference';end if;
 return new;
end $details$;
revoke all on function public.validate_detail_links() from public,anon,authenticated;
do $detail_triggers$
declare t text;
begin
 foreach t in array array['news','newspaper_articles','notifications','chat_messages','callup_players','sponsor_payments','concert_payments'] loop
  execute format('create trigger validate_detail_links before insert or update on public.%I for each row execute function public.validate_detail_links()',t);
 end loop;
end $detail_triggers$;

-- Realtime nativo se conecta al habilitar la publicación en el proyecto externo.
-- alter publication supabase_realtime add table public.chat_messages,public.auctions,public.auction_bids,public.news;
commit;

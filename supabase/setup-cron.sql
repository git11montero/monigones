-- Run ONLY after deploying and authorizing the remote setup described in docs/ONLINE_SETUP.md.
-- Store monigones_api_url and monigones_cron_secret in Vault first. No secret literal is tracked.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function monigones_private.invoke_tick() returns bigint
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare endpoint text; secret text; request_id bigint;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='monigones_api_url';
 select decrypted_secret into secret from vault.decrypted_secrets where name='monigones_cron_secret';
 if endpoint is null or endpoint !~ '^https://[^/]+/api/cron$' or secret is null or length(secret)<32 then
  raise exception 'Configure the HTTPS cron endpoint and dedicated secret in Vault';
 end if;
 select net.http_post(url:=endpoint,
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),
 body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
 return request_id;
end$$;
revoke all on function monigones_private.invoke_tick() from public,anon,authenticated;
select cron.schedule('monigones-tick','* * * * *','select monigones_private.invoke_tick();');
commit;

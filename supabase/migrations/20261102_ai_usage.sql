-- Controle de tentativas de IA por conta. Aplicar após 20261025_workspace_v2.sql.
-- Não armazena texto, áudio, tokens, chaves, diagnóstico nem valores financeiros.
begin;
create table public.ai_daily_usage (
 user_id uuid not null references auth.users(id) on delete cascade,
 usage_day date not null,
 operation text not null check (operation in ('documentation','transcription')),
 attempts integer not null default 0 check (attempts>=0),
 window_started_at timestamptz not null default now(),
 window_attempts integer not null default 0 check (window_attempts>=0),
 primary key (user_id,usage_day,operation)
);
alter table public.ai_daily_usage enable row level security;
-- Somente Functions autenticadas podem ler/reservar; cliente não define sua cota.
revoke all on public.ai_daily_usage from public,anon,authenticated;
grant select,insert,update,delete on public.ai_daily_usage to service_role;

create function public.reserve_ai_usage(p_user uuid,p_operation text,p_daily_limit integer,p_burst_limit integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 day_utc date:=(now() at time zone 'UTC')::date;
 reset_at timestamptz:=(((now() at time zone 'UTC')::date+1)::timestamp at time zone 'UTC');
 current_row public.ai_daily_usage;
 retry_seconds integer;
begin
 if p_user is null or p_operation is null or p_operation not in ('documentation','transcription')
 or p_daily_limit is null or p_daily_limit<0 or p_daily_limit>1000
 or p_burst_limit is null or p_burst_limit<0 or p_burst_limit>30 then
  raise exception 'Invalid usage policy' using errcode='22023';
 end if;
 if not exists(select 1 from public.profiles where user_id=p_user and enabled and not must_change_password) then
  raise exception 'Account unavailable' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('ai:'||p_user::text||':'||p_operation,0));
 insert into public.ai_daily_usage(user_id,usage_day,operation) values(p_user,day_utc,p_operation) on conflict do nothing;
 select * into current_row from public.ai_daily_usage where user_id=p_user and usage_day=day_utc and operation=p_operation for update;
 if current_row.attempts>=p_daily_limit then
  retry_seconds:=greatest(1,ceil(extract(epoch from reset_at-now()))::integer);
  return jsonb_build_object('allowed',false,'code','daily_limit','used',current_row.attempts,'limit',p_daily_limit,'retryAfter',retry_seconds);
 end if;
 if current_row.window_started_at+interval '60 seconds'<=now() then
  current_row.window_started_at:=now();current_row.window_attempts:=0;
 end if;
 if current_row.window_attempts>=p_burst_limit then
  retry_seconds:=greatest(1,ceil(extract(epoch from current_row.window_started_at+interval '60 seconds'-now()))::integer);
  return jsonb_build_object('allowed',false,'code','burst_limit','used',current_row.attempts,'limit',p_daily_limit,'retryAfter',retry_seconds);
 end if;
 update public.ai_daily_usage set attempts=attempts+1,window_started_at=current_row.window_started_at,window_attempts=current_row.window_attempts+1
 where user_id=p_user and usage_day=day_utc and operation=p_operation returning * into current_row;
 return jsonb_build_object('allowed',true,'used',current_row.attempts,'limit',p_daily_limit,'remaining',greatest(0,p_daily_limit-current_row.attempts));
end; $$;
revoke all on function public.reserve_ai_usage(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid,text,integer,integer) to service_role;

-- Rodar por tarefa administrativa diária para reter só contagem operacional recente.
create function public.purge_old_ai_usage() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare n bigint;
begin delete from public.ai_daily_usage where usage_day<(now() at time zone 'UTC')::date-35;get diagnostics n=row_count;return n;end; $$;
revoke all on function public.purge_old_ai_usage() from public,anon,authenticated;
grant execute on function public.purge_old_ai_usage() to service_role;
commit;
-- Exemplo após habilitar pg_cron, em ambiente de testes:
-- select cron.schedule('purge-ai-usage','23 3 * * *','select public.purge_old_ai_usage();');

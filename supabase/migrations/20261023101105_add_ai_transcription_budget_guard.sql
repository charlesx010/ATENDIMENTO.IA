create table if not exists public.ai_transcription_budget (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  reserved_estimate_usd numeric(12,6) not null default 0 check (reserved_estimate_usd >= 0),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);
alter table public.ai_transcription_budget enable row level security;
revoke all on table public.ai_transcription_budget from public, anon, authenticated;
grant select, insert, update on table public.ai_transcription_budget to service_role;

create or replace function public.reserve_transcription_budget(
  p_user_id uuid
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_limit numeric(12,6);
  v_reserved boolean;
  v_month date := date_trunc('month', (now() at time zone 'UTC'))::date;
  v_per_request numeric(12,6) := 0.020000;
begin
  select least(monthly_limit_usd, 2.00) into v_limit
    from public.profiles
    where user_id = p_user_id and enabled is true and ai_enabled is true;
  if v_limit is null or v_limit < v_per_request then return false; end if;
  insert into public.ai_transcription_budget(user_id, period_start, reserved_estimate_usd, request_count, updated_at)
    values (p_user_id, v_month, v_per_request, 1, now())
  on conflict (user_id, period_start)
    do update set reserved_estimate_usd=public.ai_transcription_budget.reserved_estimate_usd+v_per_request,
       request_count=public.ai_transcription_budget.request_count+1,
       updated_at=now()
    where public.ai_transcription_budget.reserved_estimate_usd+v_per_request<=v_limit
  returning true into v_reserved;
  return coalesce(v_reserved,false);
end;
$$;
revoke all on function public.reserve_transcription_budget(uuid) from public, anon, authenticated;
grant execute on function public.reserve_transcription_budget(uuid) to service_role;
comment on table public.ai_transcription_budget is 'Conservative estimated budget reservations for AI test transcription; no audio or transcripts stored. Not an official API bill or hard provider spending cap.';

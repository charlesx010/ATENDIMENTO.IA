
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z][a-z0-9_-]{2,29}$'),
  display_name text not null default 'Médico' check (char_length(display_name) between 2 and 90),
  role text not null default 'medico' check (role in ('admin','medico')),
  enabled boolean not null default true,
  must_change_password boolean not null default true,
  ai_enabled boolean not null default false,
  monthly_limit_usd numeric(10,2) not null default 0 check (monthly_limit_usd >= 0),
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and octet_length(preferences::text) <= 20000),
  created_at timestamptz not null default now()
);

create table if not exists public.clinical_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 200000),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '72 hours')
);
create index if not exists idx_clinical_sessions_expiry on public.clinical_sessions(expires_at);

alter table public.profiles enable row level security;
alter table public.clinical_sessions enable row level security;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.clinical_sessions from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, preferences) on table public.profiles to authenticated;
grant select, delete on table public.clinical_sessions to authenticated;
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.clinical_sessions to service_role;

create policy profile_read_self on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) and enabled = true);
create policy profile_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and enabled = true
    and (role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2'))
  with check (user_id = (select auth.uid()) and enabled = true
    and (role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2'));
create policy session_read_active on public.clinical_sessions for select to authenticated
  using (user_id = (select auth.uid()) and expires_at > now()
    and exists (
      select 1 from public.profiles p
      where p.user_id = (select auth.uid()) and p.enabled
      and (p.role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2')
    ));
create policy session_delete_self on public.clinical_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.save_my_clinical_session(
  p_payload jsonb, p_expected_version bigint default null
) returns table(saved_version bigint, saved_at timestamptz, expires timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_version bigint;
  v_at timestamptz;
  v_exp timestamptz;
  v_role text;
begin
  select p.role into v_role from public.profiles p
  where p.user_id=v_user and p.enabled=true;
  if v_user is null or v_role is null then raise exception 'ACESSO_NEGADO'; end if;
  if v_role = 'admin' and coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception 'MFA_OBRIGATORIA'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 200000 then
    raise exception 'CONTEUDO_INVALIDO'; end if;

  delete from public.clinical_sessions where user_id=v_user and expires_at <= now();

  if p_expected_version is null then
    insert into public.clinical_sessions (user_id,payload,version,updated_at,expires_at)
    values (v_user,p_payload,1,now(),now()+interval '72 hours')
    on conflict (user_id) do nothing
    returning version,updated_at,expires_at into v_version,v_at,v_exp;
  else
    update public.clinical_sessions
    set payload=p_payload,version=version+1,updated_at=now(),
        expires_at=now()+interval '72 hours'
    where user_id=v_user and version=p_expected_version
    returning version,updated_at,expires_at into v_version,v_at,v_exp;
  end if;
  if v_version is null then raise exception 'CONFLITO_DE_VERSAO'; end if;
  return query select v_version,v_at,v_exp;
end $$;

revoke all on function public.save_my_clinical_session(jsonb,bigint) from public, anon;
grant execute on function public.save_my_clinical_session(jsonb,bigint) to authenticated;

create or replace function app_private.mark_password_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set must_change_password=false
  where user_id=new.id;
  return new;
end $$;
revoke all on function app_private.mark_password_changed() from public, anon, authenticated;
create trigger prontuario_password_changed
after update of encrypted_password on auth.users
for each row
when (old.encrypted_password is distinct from new.encrypted_password)
execute function app_private.mark_password_changed();

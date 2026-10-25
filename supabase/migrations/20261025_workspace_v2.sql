-- INSTALAÇÃO NOVA / AMBIENTE DE TESTES. Revisar antes de executar em banco existente.
-- Não altera clinical_sessions nem migra dados antigos automaticamente.
begin;
create table if not exists public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check (username ~ '^[a-z][a-z0-9_-]{2,29}$'),
 display_name text not null,
 role text not null default 'medico' check (role in ('admin','medico')),
 enabled boolean not null default true,
 must_change_password boolean not null default true,
 preferences jsonb not null default '{}'::jsonb,
 ai_enabled boolean not null default false,
 monthly_limit_usd numeric not null default 0,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Não permitir que usuários promovam a própria conta ou alterem habilitação via API.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
drop policy if exists v2_own_profile on public.profiles;
create policy v2_own_profile on public.profiles for select to authenticated using (user_id=auth.uid());

create table public.workspace_sessions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version uuid not null default gen_random_uuid(),
 payload jsonb not null check (jsonb_typeof(payload)='object' and payload->>'schema'='2' and octet_length(payload::text)<=100000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '24 hours'),
 check (expires_at=created_at+interval '24 hours')
);
alter table public.workspace_sessions enable row level security;
-- Escritas passam exclusivamente pela RPC para não contornar versão e retenção.
revoke all on public.workspace_sessions from anon, authenticated;
grant select on public.workspace_sessions to authenticated;
grant all on public.workspace_sessions to service_role;
create policy v2_owner_read on public.workspace_sessions for select to authenticated using (
 user_id=auth.uid() and expires_at>now() and exists (
  select 1 from public.profiles p where p.user_id=auth.uid() and p.enabled and not p.must_change_password
  and (p.role<>'admin' or auth.jwt()->>'aal'='aal2')
 )
);

create function public.save_workspace(p_expected uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); current_row public.workspace_sessions; result_row public.workspace_sessions;
begin
 if uid is null or not exists (
  select 1 from public.profiles p where p.user_id=uid and p.enabled and not p.must_change_password
  and (p.role<>'admin' or auth.jwt()->>'aal'='aal2')
 ) then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or p_payload->>'schema' is distinct from '2'
 or octet_length(p_payload::text)>100000 then raise exception 'Invalid payload'; end if;
 -- Serializa inclusive inserções concorrentes para a mesma conta. Colisões só reduzem paralelismo.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select * into current_row from public.workspace_sessions where user_id=uid for update;
 if found and current_row.expires_at<=now() then
  delete from public.workspace_sessions where user_id=uid;
  current_row:=null;
 end if;
 if current_row.user_id is null then
  if p_expected is not null then return jsonb_build_object('status','conflict','row',null); end if;
  insert into public.workspace_sessions(user_id,payload) values(uid,p_payload) returning * into result_row;
 else
  if current_row.version is distinct from p_expected then return jsonb_build_object('status','conflict','row',to_jsonb(current_row)); end if;
  update public.workspace_sessions set payload=p_payload, version=gen_random_uuid(),updated_at=now() where user_id=uid returning * into result_row;
 end if;
 return jsonb_build_object('status','saved','row',to_jsonb(result_row));
end;
$$;
revoke all on function public.save_workspace(uuid,jsonb) from public,anon;
grant execute on function public.save_workspace(uuid,jsonb) to authenticated;

create function public.delete_workspace(p_expected uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); n integer;
begin
 if uid is null or not exists (select 1 from public.profiles p where p.user_id=uid and p.enabled and not p.must_change_password and (p.role<>'admin' or auth.jwt()->>'aal'='aal2')) then raise exception 'Not authorized' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 delete from public.workspace_sessions where user_id=uid and version=p_expected;
 get diagnostics n=row_count;
 return n=1;
end; $$;
revoke all on function public.delete_workspace(uuid) from public,anon;
grant execute on function public.delete_workspace(uuid) to authenticated;

create function public.purge_expired_workspaces() returns bigint
language plpgsql security definer set search_path=public,pg_temp as $$
declare n bigint;
begin delete from public.workspace_sessions where expires_at<=now(); get diagnostics n=row_count; return n; end; $$;
revoke all on function public.purge_expired_workspaces() from public,anon,authenticated;
grant execute on function public.purge_expired_workspaces() to service_role;
commit;

-- Após habilitar pg_cron no painel do Supabase, agendar UMA VEZ (com conta administrativa):
-- select cron.schedule('workspace-v2-expiry','*/15 * * * *','select public.purge_expired_workspaces();');
-- Sem o job, a UI recusa sessões vencidas, mas a exclusão física não é garantida.
-- Crie o primeiro usuário no Auth, depois insira o perfil correspondente em public.profiles
-- usando seu UUID real, role='admin', must_change_password=false; habilite TOTP no primeiro acesso.
-- Nunca colocar senha/chave neste SQL ou no repositório.

-- IAI doutor: cadastro livre com acesso gratuito aos módulos.
-- Apenas o Supabase Auth pode criar perfis; usuários não escolhem role/planos.
-- NÃO reexecutar migração histórica que faz backfill amplo de consultation_enabled.
alter table public.profiles
  add column if not exists subscription_plan text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_subscription_plan_check'
  ) then
    alter table public.profiles
      add constraint profiles_subscription_plan_check
      check (subscription_plan in ('free','premium'));
  end if;
end;
$$;

alter table public.profiles
  alter column consultation_enabled set default true;

-- Conservar os acessos existentes; liberar apenas usuários não bloqueados.
update public.profiles
set consultation_enabled=true
where enabled is true and consultation_enabled is false;

-- A permissão de plano jamais vem de raw_user_meta_data.
create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  generated_username text;
  safe_display_name text;
begin
  base_username := regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_-]+', '', 'g');
  if base_username !~ '^[a-z]' then base_username := 'usuario'; end if;
  generated_username := left(base_username, 17) || '_' || left(replace(new.id::text, '-', ''), 12);

  safe_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name',''));
  if char_length(safe_display_name)<2 then safe_display_name:='Usuário'; end if;
  safe_display_name := left(safe_display_name,90);

  insert into public.profiles (
    user_id,username,display_name,role,enabled,must_change_password,
    consultation_enabled,ai_enabled,monthly_limit_usd,preferences,subscription_plan
  ) values (
    new.id,generated_username,safe_display_name,'medico',true,false,
    true,false,0,'{}'::jsonb,'free'
  ) on conflict(user_id) do nothing;
  return new;
end
$$;

revoke all on function app_private.handle_new_auth_user() from public,anon,authenticated;
grant select(subscription_plan) on public.profiles to authenticated;
revoke update(subscription_plan) on public.profiles from authenticated,anon;

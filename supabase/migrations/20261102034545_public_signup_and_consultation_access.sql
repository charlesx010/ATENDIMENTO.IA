alter table public.profiles
  add column if not exists consultation_enabled boolean not null default false;

update public.profiles
set consultation_enabled = true
where consultation_enabled is false;

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
  if base_username !~ '^[a-z]' then
    base_username := 'usuario';
  end if;
  generated_username := left(base_username, 22) || '_' || left(replace(new.id::text, '-', ''), 6);
  safe_display_name := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(safe_display_name) < 2 then safe_display_name := 'Usuário'; end if;
  safe_display_name := left(safe_display_name, 90);
  insert into public.profiles (
    user_id, username, display_name, role, enabled, must_change_password,
    consultation_enabled, ai_enabled, monthly_limit_usd, preferences
  ) values (
    new.id, generated_username, safe_display_name, 'medico', true, false,
    false, false, 0, '{}'::jsonb
  )
  on conflict (user_id) do nothing;
  return new;
end
$$;

revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;
drop trigger if exists prontuario_create_profile on auth.users;
create trigger prontuario_create_profile after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

drop policy if exists session_read_active on public.clinical_sessions;
create policy session_read_active on public.clinical_sessions for select to authenticated
using (user_id=(select auth.uid()) and expires_at>now() and exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
  and (p.role='admin' or p.consultation_enabled)
  and (p.role<>'admin' or ((select auth.jwt())->>'aal')='aal2')
));

drop policy if exists session_insert_self on public.clinical_sessions;
create policy session_insert_self on public.clinical_sessions for insert to authenticated
with check (user_id=(select auth.uid()) and exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
  and (p.role='admin' or p.consultation_enabled)
  and (p.role<>'admin' or ((select auth.jwt())->>'aal')='aal2')
));

drop policy if exists session_update_self on public.clinical_sessions;
create policy session_update_self on public.clinical_sessions for update to authenticated
using (user_id=(select auth.uid()) and expires_at>now() and exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
  and (p.role='admin' or p.consultation_enabled)
  and (p.role<>'admin' or ((select auth.jwt())->>'aal')='aal2')
))
with check (user_id=(select auth.uid()) and exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
  and (p.role='admin' or p.consultation_enabled)
  and (p.role<>'admin' or ((select auth.jwt())->>'aal')='aal2')
));
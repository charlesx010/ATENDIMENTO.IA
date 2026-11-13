-- Public signups must never inherit clinical consultation privileges.
-- The first account remains the bootstrap administrator; subsequent accounts
-- are enabled free users without access to the clinical workspace.
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
  assigned_role text;
begin
  perform pg_catalog.pg_advisory_xact_lock(20261111, 1);

  base_username := regexp_replace(
    lower(split_part(coalesce(new.email, ''), '@', 1)),
    '[^a-z0-9_-]+', '', 'g'
  );
  if base_username !~ '^[a-z]' then
    base_username := 'usuario';
  end if;
  generated_username :=
    left(base_username, 17) || '_' ||
    left(replace(new.id::text, '-', ''), 12);

  safe_display_name := btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  ));
  if char_length(safe_display_name) < 2 then
    safe_display_name := 'Usuário';
  end if;
  safe_display_name := left(safe_display_name, 90);

  select case
    when exists (select 1 from public.profiles) then 'medico'
    else 'admin'
  end into assigned_role;

  insert into public.profiles (
    user_id, username, display_name, role, enabled, must_change_password,
    consultation_enabled, ai_enabled, monthly_limit_usd, preferences,
    subscription_plan
  ) values (
    new.id, generated_username, safe_display_name, assigned_role, true, false,
    assigned_role = 'admin', false, 0, '{}'::jsonb, 'free'
  )
  on conflict (user_id) do nothing;

  return new;
end
$$;

revoke all on function app_private.handle_new_auth_user()
  from public, anon, authenticated;
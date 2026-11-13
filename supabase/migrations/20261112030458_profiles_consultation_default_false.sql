-- Deny consultation by default. Only the first bootstrap admin receives
-- consultation explicitly in app_private.handle_new_auth_user().
alter table public.profiles
  alter column consultation_enabled set default false;
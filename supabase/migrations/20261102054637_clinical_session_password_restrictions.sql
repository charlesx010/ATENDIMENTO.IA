-- Hardening adicional: nÃ£o substitui as regras de proprietÃ¡rio, convite,
-- expiraÃ§Ã£o e MFA jÃ¡ existentes. Aplicar somente apÃ³s conferir o banco-alvo.
drop policy if exists session_password_read_guard on public.clinical_sessions;
create policy session_password_read_guard on public.clinical_sessions
as restrictive
for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.enabled is true
      and p.must_change_password is false
  )
);

drop policy if exists session_password_insert_guard on public.clinical_sessions;
create policy session_password_insert_guard on public.clinical_sessions
as restrictive
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.enabled is true
      and p.must_change_password is false
  )
);

drop policy if exists session_password_update_guard on public.clinical_sessions;
create policy session_password_update_guard on public.clinical_sessions
as restrictive
for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.enabled is true
      and p.must_change_password is false
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.enabled is true
      and p.must_change_password is false
  )
);

-- DELETE permanece sujeito Ã  polÃ­tica de exclusÃ£o do proprietÃ¡rio existente.
-- NÃ£o adicionar um guard de DELETE. Homologar tambÃ©m a chamada de exclusÃ£o
-- pela API: filtros/RETURNING podem envolver permissÃµes e polÃ­ticas de SELECT.

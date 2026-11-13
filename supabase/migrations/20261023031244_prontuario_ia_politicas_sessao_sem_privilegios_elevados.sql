
create or replace function app_private.stamp_session()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1;
  else
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  new.expires_at := now() + interval '72 hours';
  return new;
end $$;
revoke all on function app_private.stamp_session() from public, anon, authenticated;
create trigger stamp_clinical_session
before insert or update on public.clinical_sessions
for each row execute function app_private.stamp_session();

create policy session_insert_self on public.clinical_sessions for insert to authenticated
  with check (user_id = (select auth.uid()) and
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.enabled and (p.role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2')));

create policy session_update_self on public.clinical_sessions for update to authenticated
  using (user_id = (select auth.uid()) and expires_at > now() and
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.enabled and (p.role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2')))
  with check (user_id = (select auth.uid()) and
    exists (select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.enabled and (p.role <> 'admin' or (select auth.jwt()->>'aal') = 'aal2')));

grant insert (user_id, payload) on public.clinical_sessions to authenticated;
grant update (payload) on public.clinical_sessions to authenticated;
alter function public.save_my_clinical_session(jsonb,bigint) security invoker;

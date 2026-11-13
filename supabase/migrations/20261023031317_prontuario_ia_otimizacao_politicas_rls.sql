
drop policy if exists profile_update_self on public.profiles;
create policy profile_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and enabled = true
    and (role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2'))
  with check (user_id = (select auth.uid()) and enabled = true
    and (role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2'));

drop policy if exists session_read_active on public.clinical_sessions;
create policy session_read_active on public.clinical_sessions for select to authenticated
  using (user_id = (select auth.uid()) and expires_at > now()
    and exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
      and (p.role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2')));

drop policy if exists session_insert_self on public.clinical_sessions;
create policy session_insert_self on public.clinical_sessions for insert to authenticated
  with check (user_id=(select auth.uid()) and
    exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
      and (p.role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2')));

drop policy if exists session_update_self on public.clinical_sessions;
create policy session_update_self on public.clinical_sessions for update to authenticated
  using (user_id=(select auth.uid()) and expires_at>now() and
    exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
      and (p.role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2')))
  with check (user_id=(select auth.uid()) and
    exists (select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled
      and (p.role <> 'admin' or ((select auth.jwt())->>'aal') = 'aal2')));

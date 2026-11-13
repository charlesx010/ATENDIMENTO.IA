-- Aplicar somente apÃ³s inspeÃ§Ã£o do banco. CPF/nascimento/foto nÃ£o integram JWT
-- nem preferences. Esta migraÃ§Ã£o nÃ£o altera as permissÃµes de Consulta.
create table public.account_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  cpf text null,
  birth_date date null,
  avatar_path text null,
  constraint account_details_name_valid check (full_name is null or char_length(btrim(full_name)) between 2 and 120),
  constraint account_details_cpf_format check (cpf is null or (cpf ~ '^[0-9]{11}$' and cpf !~ '^([0-9])\1{10}$')),
  constraint account_details_birth_date_valid check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date)),
  constraint account_details_avatar_owner check (avatar_path is null or avatar_path ~ ('^' || user_id::text || '/[A-Za-z0-9-]+\.(jpg|png|webp)$'))
);
alter table public.account_details enable row level security;
alter table public.account_details force row level security;
revoke all on public.account_details from anon,authenticated;
grant select,insert,update,delete on public.account_details to authenticated;

drop policy if exists account_details_read_self on public.account_details;
create policy account_details_read_self on public.account_details for select to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_details_insert_self on public.account_details;
create policy account_details_insert_self on public.account_details for insert to authenticated
with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_details_update_self on public.account_details;
create policy account_details_update_self on public.account_details for update to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true))
with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_details_delete_self on public.account_details;
create policy account_details_delete_self on public.account_details for delete to authenticated
using (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('account-avatars','account-avatars',false,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

-- A pasta do objeto Ã© o UUID do titular. NÃ£o hÃ¡ leitura pÃºblica ou regra de
-- administrador para fotos/dados privados de outros usuÃ¡rios.
drop policy if exists account_avatar_read_self on storage.objects;
create policy account_avatar_read_self on storage.objects for select to authenticated
using (bucket_id='account-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_avatar_insert_self on storage.objects;
create policy account_avatar_insert_self on storage.objects for insert to authenticated
with check (bucket_id='account-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ ('^'||(select auth.uid())::text||'/[A-Za-z0-9-]+\.(jpg|png|webp)$')
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_avatar_update_self on storage.objects;
create policy account_avatar_update_self on storage.objects for update to authenticated
using (bucket_id='account-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true))
with check (bucket_id='account-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ ('^'||(select auth.uid())::text||'/[A-Za-z0-9-]+\.(jpg|png|webp)$')
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));
drop policy if exists account_avatar_delete_self on storage.objects;
create policy account_avatar_delete_self on storage.objects for delete to authenticated
using (bucket_id='account-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true));

-- Guards restritivos isolam este bucket mesmo na presenÃ§a de policies antigas
-- permissivas. NÃ£o alteram o acesso aos demais buckets.
drop policy if exists account_avatar_select_guard on storage.objects;
create policy account_avatar_select_guard on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'account-avatars' or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true)));
drop policy if exists account_avatar_select_anon_guard on storage.objects;
create policy account_avatar_select_anon_guard on storage.objects as restrictive for select to anon
using (bucket_id <> 'account-avatars');
drop policy if exists account_avatar_insert_guard on storage.objects;
create policy account_avatar_insert_guard on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'account-avatars' or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true)));
drop policy if exists account_avatar_insert_anon_guard on storage.objects;
create policy account_avatar_insert_anon_guard on storage.objects as restrictive for insert to anon
with check (bucket_id <> 'account-avatars');
drop policy if exists account_avatar_update_guard on storage.objects;
create policy account_avatar_update_guard on storage.objects as restrictive for update to authenticated
using (bucket_id <> 'account-avatars' or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true)))
with check (bucket_id <> 'account-avatars' or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true)));
drop policy if exists account_avatar_update_anon_guard on storage.objects;
create policy account_avatar_update_anon_guard on storage.objects as restrictive for update to anon
using (bucket_id <> 'account-avatars')
with check (bucket_id <> 'account-avatars');
drop policy if exists account_avatar_delete_guard on storage.objects;
create policy account_avatar_delete_guard on storage.objects as restrictive for delete to authenticated
using (bucket_id <> 'account-avatars' or ((storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles p where p.user_id=(select auth.uid()) and p.enabled is true)));
drop policy if exists account_avatar_delete_anon_guard on storage.objects;
create policy account_avatar_delete_anon_guard on storage.objects as restrictive for delete to anon
using (bucket_id <> 'account-avatars');


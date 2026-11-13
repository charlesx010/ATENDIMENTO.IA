-- Biblioteca de guias de documentação; aplicar após 20261025_workspace_v2.sql.
-- Não é armazenamento de consultas. Não inserir dados de pacientes nos guias.
begin;
create table public.personal_template_libraries (
 user_id uuid primary key references auth.users(id) on delete cascade,
 version uuid not null default gen_random_uuid(),
 library jsonb not null check (
  jsonb_typeof(library)='object' and library @> '{"schema":1,"kind":"documentation-checklists"}'::jsonb
  and jsonb_typeof(library->'templates') is not distinct from 'array'
  and jsonb_array_length(library->'templates')<=40
  and octet_length(library::text)<=220000
 ),
 updated_at timestamptz not null default now()
);
alter table public.personal_template_libraries enable row level security;
-- A API verifica sessão/MFA e schema completo. Sem escrita/leitura REST direta.
revoke all on public.personal_template_libraries from public,anon,authenticated;
grant select,insert,update,delete on public.personal_template_libraries to service_role;

create function public.save_personal_template_library(p_user uuid,p_expected uuid,p_library jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.personal_template_libraries;result_row public.personal_template_libraries;
begin
 if p_user is null or not exists(select 1 from public.profiles where user_id=p_user and enabled and not must_change_password) then
  raise exception 'Account unavailable' using errcode='42501';
 end if;
 if p_library is null or jsonb_typeof(p_library)<>'object' or p_library->>'schema' is distinct from '1'
 or p_library->>'kind' is distinct from 'documentation-checklists' or jsonb_typeof(p_library->'templates') is distinct from 'array'
 or octet_length(p_library::text)>220000 then raise exception 'Invalid documentation guides' using errcode='22023';end if;
 if jsonb_array_length(p_library->'templates')>40 then raise exception 'Too many guides' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('templates:'||p_user::text,0));
 select * into current_row from public.personal_template_libraries where user_id=p_user for update;
 if current_row.user_id is null then
  if p_expected is not null then return jsonb_build_object('status','conflict','row',null);end if;
  insert into public.personal_template_libraries(user_id,library)values(p_user,p_library)returning * into result_row;
 else
  if current_row.version is distinct from p_expected then return jsonb_build_object('status','conflict','row',to_jsonb(current_row));end if;
  update public.personal_template_libraries set library=p_library,version=gen_random_uuid(),updated_at=now()where user_id=p_user returning * into result_row;
 end if;
 return jsonb_build_object('status','saved','row',to_jsonb(result_row));
end;$$;
revoke all on function public.save_personal_template_library(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_personal_template_library(uuid,uuid,jsonb) to service_role;

create function public.delete_personal_template_library(p_user uuid,p_expected uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.personal_template_libraries;
begin
 if p_user is null or not exists(select 1 from public.profiles where user_id=p_user and enabled and not must_change_password) then
  raise exception 'Account unavailable' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('templates:'||p_user::text,0));
 select * into current_row from public.personal_template_libraries where user_id=p_user for update;
 if current_row.user_id is null then return jsonb_build_object('status','conflict','row',null);end if;
 if p_expected is null or current_row.version is distinct from p_expected then return jsonb_build_object('status','conflict','row',to_jsonb(current_row));end if;
 delete from public.personal_template_libraries where user_id=p_user;
 return jsonb_build_object('status','deleted');
end;$$;
revoke all on function public.delete_personal_template_library(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_personal_template_library(uuid,uuid) to service_role;
commit;

-- Biblioteca de teste independente dos casos de uso/consulta.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000007'),('00000000-0000-4000-8000-000000000008');
insert into public.profiles(user_id,username,display_name,must_change_password)values
 ('00000000-0000-4000-8000-000000000007','modelos_um','Modelos um',false),
 ('00000000-0000-4000-8000-000000000008','modelos_dois','Modelos dois',false);
set role authenticated;
do $$begin
 begin perform public.save_personal_template_library('00000000-0000-4000-8000-000000000007',null,'{}');raise exception 'client bypassed templates API';exception when insufficient_privilege then null;end;
 begin perform 1 from public.personal_template_libraries;raise exception 'client read templates table';exception when insufficient_privilege then null;end;
 raise notice 'PASS: template RPC/table denied to direct client';
end $$;
reset role;
set role service_role;
do $$declare r jsonb;v uuid;latest uuid;guide jsonb:='{"schema":1,"kind":"documentation-checklists","templates":[]}';begin
 r:=public.save_personal_template_library('00000000-0000-4000-8000-000000000007',null,guide);
 if r->>'status'<>'saved' then raise exception 'template insertion failed';end if;
 v:=(r#>>'{row,version}')::uuid;
 r:=public.save_personal_template_library('00000000-0000-4000-8000-000000000007',null,guide);
 if r->>'status'<>'conflict' then raise exception 'concurrent insert overwritten';end if;
 r:=public.save_personal_template_library('00000000-0000-4000-8000-000000000007',v,guide);
 latest:=(r#>>'{row,version}')::uuid;
 if r->>'status'<>'saved' or latest=v then raise exception 'template CAS update failed';end if;
 r:=public.save_personal_template_library('00000000-0000-4000-8000-000000000007',v,guide);
 if r->>'status'<>'conflict' then raise exception 'stale template update accepted';end if;
 r:=public.delete_personal_template_library('00000000-0000-4000-8000-000000000007',v);
 if r->>'status'<>'conflict' then raise exception 'stale template deletion accepted';end if;
 r:=public.save_personal_template_library('00000000-0000-4000-8000-000000000008',null,guide);
 if r->>'status'<>'saved' then raise exception 'independent template account failed';end if;
 r:=public.delete_personal_template_library('00000000-0000-4000-8000-000000000007',latest);
 if r->>'status'<>'deleted' then raise exception 'template deletion failed';end if;
 if (select count(*) from public.personal_template_libraries where user_id='00000000-0000-4000-8000-000000000008')<>1 then raise exception 'other account affected by deletion';end if;
 begin perform public.save_personal_template_library('00000000-0000-4000-8000-000000000007',null,'{"schema":2,"source":"clinical note"}');raise exception 'clinical schema accepted';exception when invalid_parameter_value then null;end;
 raise notice 'PASS: templates CAS insert/update/delete, independent accounts, clinical-schema rejection';
end $$;
reset role;
update public.profiles set enabled=false where username='modelos_dois';
set role service_role;
do $$begin
 begin perform public.delete_personal_template_library('00000000-0000-4000-8000-000000000008',null);raise exception 'blocked account operated on templates';exception when insufficient_privilege then null;end;
 raise notice 'PASS: disabled account denied templates';
end $$;
reset role;

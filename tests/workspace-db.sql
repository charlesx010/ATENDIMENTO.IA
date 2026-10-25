-- Para banco PostgreSQL descartável com auth.uid/auth.jwt equivalentes ao Supabase.
-- Executar após a migração com psql -v ON_ERROR_STOP=1.
insert into auth.users(id) values
 ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003');
insert into public.profiles(user_id,username,display_name,must_change_password,role) values
 ('00000000-0000-4000-8000-000000000001','teste_um','Teste um',false,'medico'),
 ('00000000-0000-4000-8000-000000000002','teste_dois','Teste dois',false,'medico'),
 ('00000000-0000-4000-8000-000000000003','teste_admin','Teste admin',false,'admin');
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
set request.jwt.claims='{"aal":"aal1"}';
do $$declare r jsonb; v uuid; c timestamptz; e timestamptz; begin
 r:=public.save_workspace(null,'{"schema":2,"source":"teste um"}');
 if r->>'status'<>'saved' then raise exception 'insert failed'; end if;
 v:=(r#>>'{row,version}')::uuid;c:=(r#>>'{row,created_at}')::timestamptz;e:=(r#>>'{row,expires_at}')::timestamptz;
 if e-c<>interval '24 hours' then raise exception 'TTL wrong'; end if;
 r:=public.save_workspace(v,'{"schema":2,"source":"atualização"}');
 if r->>'status'<>'saved' or (r#>>'{row,version}')::uuid=v then raise exception 'CAS update failed'; end if;
 if (r#>>'{row,expires_at}')::timestamptz<>e then raise exception 'TTL renewed incorrectly'; end if;
 if public.save_workspace(v,'{"schema":2}') ->>'status'<>'conflict' then raise exception 'stale write accepted'; end if;
 if public.delete_workspace(v) then raise exception 'stale delete accepted'; end if;
 begin update public.workspace_sessions set version=gen_random_uuid();raise exception 'direct update accepted';exception when insufficient_privilege then null;end;
 begin update public.profiles set role='admin';raise exception 'self promotion accepted';exception when insufficient_privilege then null;end;
 raise notice 'PASS: insertion, CAS, fixed TTL, stale update/delete, direct-write and privilege protection';
end $$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
 if (select count(*) from public.workspace_sessions)<>0 then raise exception 'cross user leak';end if;
 if (select count(*) from public.profiles)<>1 then raise exception 'profile isolation failed';end if;
 perform public.save_workspace(null,'{"schema":2,"source":"teste dois"}');
 raise notice 'PASS: cross-user isolation';
end $$;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
do $$begin
 begin perform public.save_workspace(null,'{"schema":2}');raise exception 'admin aal1 accepted';exception when insufficient_privilege then null;end;
 raise notice 'PASS: admin requires MFA';
end $$;
set request.jwt.claims='{"aal":"aal2"}';
do $$begin perform public.save_workspace(null,'{"schema":2}');raise notice 'PASS: admin aal2 permitted';end $$;
reset role;
update public.profiles set enabled=false where username='teste_dois';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000002';
do $$begin
 if (select count(*) from public.workspace_sessions)<>0 then raise exception 'disabled account reads';end if;
 begin perform public.save_workspace(null,'{"schema":2}');raise exception 'disabled account writes';exception when insufficient_privilege then null;end;
 raise notice 'PASS: disabled account blocked';
end $$;
reset role;
update public.workspace_sessions set created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour' where user_id='00000000-0000-4000-8000-000000000001';
set role authenticated;
set request.jwt.claim.sub='00000000-0000-4000-8000-000000000001';
do $$declare r jsonb;begin
 if (select count(*) from public.workspace_sessions)<>0 then raise exception 'expired data readable';end if;
 r:=public.save_workspace(null,'{"schema":2,"source":"sessão nova"}');
 if r->>'status'<>'saved' then raise exception 'expired session not replaced';end if;
 if not public.delete_workspace((r#>>'{row,version}')::uuid) then raise exception 'delete failed';end if;
 raise notice 'PASS: expiry enforcement, replacement, versioned deletion';
end $$;
reset role;
set role anon;
do $$begin
 begin perform public.save_workspace(null,'{"schema":2}');raise exception 'anon writes';exception when insufficient_privilege then null;end;
 begin perform 1 from public.workspace_sessions;raise exception 'anon reads';exception when insufficient_privilege then null;end;
 raise notice 'PASS: anonymous denied';
end $$;
reset role;

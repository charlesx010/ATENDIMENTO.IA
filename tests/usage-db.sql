-- Executar após ambas as migrações em banco descartável com papéis de Supabase.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000004'),('00000000-0000-4000-8000-000000000005');
insert into public.profiles(user_id,username,display_name,must_change_password) values
 ('00000000-0000-4000-8000-000000000004','quota_um','Teste quota um',false),
 ('00000000-0000-4000-8000-000000000005','quota_dois','Teste quota dois',false);
set role authenticated;
do $$begin
 begin perform public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',999,30);raise exception 'client sets own quota';exception when insufficient_privilege then null;end;
 begin perform 1 from public.ai_daily_usage;raise exception 'client reads usage table directly';exception when insufficient_privilege then null;end;
 raise notice 'PASS: usage RPC/table are service-only';
end $$;
reset role;
set role anon;
do $$begin
 begin perform public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',999,30);raise exception 'anon calls quota';exception when insufficient_privilege then null;end;
 raise notice 'PASS: anonymous cannot reserve usage';
end $$;
reset role;
set role service_role;
do $$declare r jsonb;begin
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',2,3);
 if not (r->>'allowed')::boolean or (r->>'used')::integer<>1 then raise exception 'first reserve failed';end if;
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',2,3);
 if not (r->>'allowed')::boolean or (r->>'used')::integer<>2 then raise exception 'second reserve failed';end if;
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',2,3);
 if (r->>'allowed')::boolean or r->>'code'<>'daily_limit' or (r->>'used')::integer<>2 then raise exception 'daily cap bypassed';end if;
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','transcription',20,1);
 if not (r->>'allowed')::boolean then raise exception 'independent operation failed';end if;
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','transcription',20,1);
 if (r->>'allowed')::boolean or r->>'code'<>'burst_limit' or (r->>'used')::integer<>1 then raise exception 'burst cap bypassed or consumed daily';end if;
 if (r->>'retryAfter')::integer<1 or (r->>'retryAfter')::integer>60 then raise exception 'invalid retry window';end if;
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000005','documentation',2,3);
 if not (r->>'allowed')::boolean or (r->>'used')::integer<>1 then raise exception 'account quotas not independent';end if;
 begin perform public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','arbitrary',2,3);raise exception 'invalid operation accepted';exception when invalid_parameter_value then null;end;
 begin perform public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','documentation',1001,3);raise exception 'unbounded policy accepted';exception when invalid_parameter_value then null;end;
 raise notice 'PASS: atomic reservations, daily/burst caps, no overcount on denial, account/operation isolation';
end $$;
update public.ai_daily_usage set window_started_at=now()-interval '61 seconds' where user_id='00000000-0000-4000-8000-000000000004' and operation='transcription';
do $$declare r jsonb;begin
 r:=public.reserve_ai_usage('00000000-0000-4000-8000-000000000004','transcription',20,1);
 if not (r->>'allowed')::boolean or (r->>'used')::integer<>2 then raise exception 'burst window not reset';end if;
 raise notice 'PASS: burst resets after fixed window';
end $$;
reset role;
update public.profiles set enabled=false where username='quota_dois';
set role service_role;
do $$begin
 begin perform public.reserve_ai_usage('00000000-0000-4000-8000-000000000005','documentation',2,3);raise exception 'disabled user reserved';exception when insufficient_privilege then null;end;
 raise notice 'PASS: blocked profile cannot reserve';
end $$;
reset role;

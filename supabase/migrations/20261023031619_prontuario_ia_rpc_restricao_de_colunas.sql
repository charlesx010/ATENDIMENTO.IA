
create or replace function public.save_my_clinical_session(
  p_payload jsonb, p_expected_version bigint default null
) returns table(saved_version bigint, saved_at timestamptz, expires timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := (select auth.uid());
  v_version bigint;
  v_at timestamptz;
  v_exp timestamptz;
  v_role text;
begin
  select p.role into v_role from public.profiles p where p.user_id=v_user and p.enabled=true;
  if v_user is null or v_role is null then raise exception 'ACESSO_NEGADO'; end if;
  if v_role = 'admin' and coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception 'MFA_OBRIGATORIA'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or octet_length(p_payload::text) > 200000 then
    raise exception 'CONTEUDO_INVALIDO'; end if;

  delete from public.clinical_sessions where user_id=v_user and expires_at <= now();

  if p_expected_version is null then
    insert into public.clinical_sessions (user_id,payload)
    values (v_user,p_payload)
    on conflict (user_id) do nothing
    returning version,updated_at,expires_at into v_version,v_at,v_exp;
  else
    update public.clinical_sessions
    set payload=p_payload
    where user_id=v_user and version=p_expected_version
    returning version,updated_at,expires_at into v_version,v_at,v_exp;
  end if;
  if v_version is null then raise exception 'CONFLITO_DE_VERSAO'; end if;
  return query select v_version,v_at,v_exp;
end $$;

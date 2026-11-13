
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'prontuario-ia-expirar-sessoes',
  '*/15 * * * *',
  $$delete from public.clinical_sessions where expires_at <= now()$$
);

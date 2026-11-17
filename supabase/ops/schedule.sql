-- Run after enabling Supabase Cron and pg_net and creating Vault secrets
-- screener_origin (https://your-app.example) and screener_cron_secret (same as CRON_SECRET).
select cron.schedule('eclub-screening', '* * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'screener_origin') || '/api/internal/screen',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'screener_cron_secret')),
    timeout_milliseconds := 55000
  )
  where exists (
    select 1 from public.screening_jobs
    where (status = 'queued' and run_after <= now()) or (status = 'processing' and lease_until < now())
  );
$job$);

select cron.schedule('eclub-resume-cleanup', '*/15 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'screener_origin') || '/api/internal/screen?cleanup=1',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'screener_cron_secret')),
    timeout_milliseconds := 55000
  );
$job$);

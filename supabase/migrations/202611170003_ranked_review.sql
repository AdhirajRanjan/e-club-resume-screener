begin;
create view public.ranked_applications with (security_invoker = true) as
select a.id, a.project_id, a.submitted_at, a.submission_version,
  u.name, u.email, concat_ws(' ', u.name, u.email) as search_text,
  s.score, s.bucket, s.matched_skills, s.flags, d.decision,
  j.status as job_status, j.error_code,
  case s.bucket when 'Yes' then 1 when 'Maybe' then 2 when 'No' then 3 else 4 end as bucket_order
from public.applications a
join public.profiles u on u.id = a.user_id
left join public.screenings s on s.application_id = a.id and s.submission_version = a.submission_version
left join public.decisions d on d.application_id = a.id and d.submission_version = a.submission_version
left join public.screening_jobs j on j.application_id = a.id and j.submission_version = a.submission_version
where private.owns_project(a.project_id);
revoke all on public.ranked_applications from anon, authenticated, public;
grant select on public.ranked_applications to authenticated;
commit;

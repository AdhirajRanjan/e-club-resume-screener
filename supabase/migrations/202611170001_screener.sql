begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.account_role as enum ('applicant', 'reviewer');
create type public.project_status as enum ('draft', 'published', 'closed');
create type public.application_status as enum ('submitted', 'under_review');
create type public.screening_bucket as enum ('Yes', 'Maybe', 'No');
create type public.review_decision as enum ('shortlist', 'hold', 'reject');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed');

create table private.settings (
  singleton boolean primary key default true check (singleton),
  authorized_domain text not null check (authorized_domain ~ '^[a-z0-9.-]+[.][a-z]{2,}$')
);
insert into private.settings (authorized_domain) values ('ashoka.edu.in');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '' check (length(name) <= 100),
  email text not null,
  student_id text check (student_id ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  role public.account_role not null default 'applicant',
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.profiles on delete restrict,
  name text not null check (length(name) between 3 and 100),
  short_description text not null check (length(short_description) between 10 and 220),
  description text not null check (length(description) between 20 and 8000),
  required_skills text[] not null check (cardinality(required_skills) between 1 and 20),
  requirements text not null check (length(requirements) <= 2500),
  questions text[] not null default '{}' check (cardinality(questions) <= 6),
  rubric jsonb not null check (jsonb_typeof(rubric) = 'array' and jsonb_array_length(rubric) between 1 and 12),
  rubric_version integer not null default 1 check (rubric_version > 0),
  yes_threshold integer not null default 70,
  maybe_threshold integer not null default 40,
  check (maybe_threshold between 1 and 99 and yes_threshold between maybe_threshold + 1 and 100),
  rubric_locked_at timestamptz,
  deadline timestamptz not null check (isfinite(deadline)),
  status public.project_status not null default 'draft',
  created_at timestamptz not null default now()
);
create index projects_owner on public.projects (reviewer_id, created_at desc);
create index projects_live on public.projects (deadline) where status = 'published';

create table public.project_rubrics (
  project_id uuid not null references public.projects on delete cascade,
  version integer not null,
  criteria jsonb not null,
  yes_threshold integer not null,
  maybe_threshold integer not null,
  created_at timestamptz not null default now(),
  primary key (project_id, version)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete restrict,
  user_id uuid not null references public.profiles on delete cascade,
  resume_path text not null unique,
  answers text[] not null check (cardinality(answers) <= 6),
  links text[] not null check (cardinality(links) <= 5),
  status public.application_status not null default 'submitted',
  submission_version integer not null default 1 check (submission_version > 0),
  rubric_version integer not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_id),
  foreign key (project_id, rubric_version) references public.project_rubrics (project_id, version)
);
create index applications_user on public.applications (user_id, submitted_at desc);

create table public.screening_jobs (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications on delete cascade,
  submission_version integer not null check (submission_version > 0),
  status public.job_status not null default 'queued',
  run_after timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  attempts integer not null default 0 check (attempts between 0 and 2),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, submission_version),
  check ((status = 'processing') = (lease_token is not null and lease_until is not null))
);
create index jobs_ready on public.screening_jobs (run_after) where status = 'queued';
create index jobs_expired on public.screening_jobs (lease_until) where status = 'processing';

create table public.screenings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications on delete cascade,
  submission_version integer not null,
  score integer not null check (score between 0 and 100),
  bucket public.screening_bucket not null,
  matched_skills text[] not null,
  missing_skills text[] not null,
  summary text not null check (length(summary) between 1 and 420),
  flags text[] not null,
  criterion_evidence jsonb not null check (jsonb_typeof(criterion_evidence) = 'array'),
  rubric_version integer not null,
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (application_id, submission_version),
  foreign key (application_id, submission_version)
    references public.screening_jobs (application_id, submission_version) on delete cascade
);

create table public.decisions (
  application_id uuid not null references public.applications on delete cascade,
  submission_version integer not null,
  decided_by uuid not null references public.profiles on delete restrict,
  decision public.review_decision not null,
  note text not null check (length(note) <= 2000),
  decided_at timestamptz not null default now(),
  primary key (application_id, submission_version)
);

create table public.decision_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications on delete cascade,
  submission_version integer not null,
  decided_by uuid not null references public.profiles on delete restrict,
  decision public.review_decision not null,
  note text not null check (length(note) <= 2000),
  decided_at timestamptz not null
);
create index history_application on public.decision_history (application_id, decided_at desc);

create table public.upload_tickets (
  path text primary key,
  user_id uuid not null references public.profiles on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index tickets_rate on public.upload_tickets (user_id, created_at desc);
create index tickets_expiry on public.upload_tickets (created_at);

create table public.resume_deletions (
  path text primary key,
  run_after timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function private.campus_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.settings
    where lower(split_part(auth.jwt()->>'email', '@', 2)) = authorized_domain
      and split_part(auth.jwt()->>'email', '@', 3) = '');
$$;

create function private.sync_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from private.settings
    where lower(split_part(new.email, '@', 2)) = authorized_domain
      and split_part(new.email, '@', 3) = '') then
    raise exception 'campus_account_required';
  end if;
  insert into public.profiles (id, email) values (new.id, lower(new.email))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
create trigger campus_profile after insert or update of email on auth.users
for each row execute function private.sync_profile();

create function private.has_role(target public.account_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.campus_account() and exists (
    select 1 from public.profiles where id = auth.uid() and role = target);
$$;

create function private.owns_project(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role('reviewer') and exists (
    select 1 from public.projects where id = target and reviewer_id = auth.uid());
$$;

create function private.reviews_application(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications a where a.id = target and private.owns_project(a.project_id));
$$;

create function private.applied_to(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications where project_id = target and user_id = auth.uid());
$$;

create function private.reviews_profile(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.applications a where a.user_id = target and private.owns_project(a.project_id));
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_rubrics enable row level security;
alter table public.applications enable row level security;
alter table public.screenings enable row level security;
alter table public.screening_jobs enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_history enable row level security;
alter table public.upload_tickets enable row level security;
alter table public.resume_deletions enable row level security;
alter table private.settings enable row level security;

revoke all on public.profiles, public.projects, public.project_rubrics, public.applications,
  public.screenings, public.screening_jobs, public.decisions, public.decision_history,
  public.upload_tickets, public.resume_deletions from anon, authenticated, public;
grant select on public.profiles, public.applications, public.project_rubrics, public.screenings,
  public.screening_jobs, public.decisions, public.decision_history to authenticated;
-- Column grants keep rubric contents and thresholds out of applicant-visible project queries.
-- Reviewer rubric reads use project_rubrics, which is owner-only.
grant select (id, reviewer_id, name, short_description, description, required_skills, requirements,
  questions, rubric_version, rubric_locked_at, deadline, status, created_at) on public.projects to authenticated;
grant update (name, student_id) on public.profiles to authenticated;
grant all on public.profiles, public.projects, public.project_rubrics, public.applications, public.screenings,
  public.screening_jobs, public.decisions, public.decision_history, public.upload_tickets,
  public.resume_deletions to service_role;
grant usage, select on sequence public.decision_history_id_seq to service_role;

create policy profile_read on public.profiles for select to authenticated
using ((private.campus_account() and id = auth.uid()) or private.reviews_profile(id));
create policy profile_update on public.profiles for update to authenticated
using (private.campus_account() and id = auth.uid()) with check (private.campus_account() and id = auth.uid());
create policy project_read on public.projects for select to authenticated using (
  private.owns_project(id) or (private.has_role('applicant') and
    ((status = 'published' and deadline > now()) or private.applied_to(id)))
);
create policy rubric_read on public.project_rubrics for select to authenticated using (private.owns_project(project_id));
create policy application_read on public.applications for select to authenticated using (
  (private.has_role('applicant') and user_id = auth.uid()) or private.owns_project(project_id)
);
create policy screening_read on public.screenings for select to authenticated using (private.reviews_application(application_id));
create policy job_read on public.screening_jobs for select to authenticated using (private.reviews_application(application_id));
create policy decisions_read on public.decisions for select to authenticated using (private.reviews_application(application_id));
create policy history_read on public.decision_history for select to authenticated using (private.reviews_application(application_id));

-- Supabase Storage manages this table. These restrictive policies keep broader bucket policies
-- from accidentally granting direct reads/writes of resume objects.
create policy resumes_server_only on storage.objects as restrictive for all to anon, authenticated
using (bucket_id <> 'resumes') with check (bucket_id <> 'resumes');

create function private.version_project() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.reviewer_id <> old.reviewer_id then raise exception 'immutable_owner'; end if;
  if old.rubric_locked_at is not null and (
    new.rubric is distinct from old.rubric or new.yes_threshold <> old.yes_threshold
    or new.maybe_threshold <> old.maybe_threshold or new.questions is distinct from old.questions
    or new.rubric_locked_at is distinct from old.rubric_locked_at
  ) then raise exception 'rubric_frozen'; end if;
  if old.rubric_locked_at is not null and new.deadline < old.deadline then
    raise exception 'deadline_locked';
  end if;
  if (old.status = 'closed' or (old.rubric_locked_at is not null and old.deadline <= clock_timestamp()))
    and (new.deadline <> old.deadline or new.status = 'published') then raise exception 'project_closed'; end if;
  new.rubric_version := old.rubric_version + case when new.rubric is distinct from old.rubric
    or new.yes_threshold <> old.yes_threshold or new.maybe_threshold <> old.maybe_threshold then 1 else 0 end;
  return new;
end;
$$;
create trigger version_project before update on public.projects for each row execute function private.version_project();

create function private.snapshot_rubric() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.rubric_version <> old.rubric_version then
    insert into public.project_rubrics values (new.id, new.rubric_version, new.rubric, new.yes_threshold, new.maybe_threshold);
  end if;
  return new;
end;
$$;
create trigger snapshot_rubric after insert or update on public.projects for each row execute function private.snapshot_rubric();

create function public.begin_resume_upload(p_user uuid, p_project uuid) returns text
language plpgsql set search_path = '' as $$
declare ticket text;
begin
  perform 1 from public.profiles where id = p_user and role = 'applicant' and name <> '' and student_id is not null for update;
  if not found then raise exception 'profile_required'; end if;
  if not exists (select 1 from public.projects where id = p_project and status = 'published'
    and deadline > clock_timestamp()) then raise exception 'applications_closed'; end if;
  if (select count(*) from public.upload_tickets where user_id = p_user
    and created_at > now() - interval '1 hour') >= 10 then raise exception 'upload_limit'; end if;
  ticket := p_user::text || '/' || p_project::text || '/' || gen_random_uuid() || '.pdf';
  insert into public.upload_tickets (path, user_id, project_id) values (ticket, p_user, p_project);
  return ticket;
end;
$$;

create function public.submit_resume(
  p_user uuid, p_project uuid, p_path text, p_expected_version integer, p_question_snapshot text[],
  p_answers text[], p_links text[]
) returns uuid language plpgsql set search_path = '' as $$
declare
  project public.projects;
  prior public.applications;
  ticket public.upload_tickets;
  application uuid;
  version integer;
begin
  select * into ticket from public.upload_tickets where path = p_path and user_id = p_user and project_id = p_project for update;
  if not found then raise exception 'upload_expired'; end if;
  if ticket.finalized_at is not null then
    select id into application from public.applications where resume_path = p_path;
    if found then return application; end if;
    raise exception 'submission_changed';
  end if;
  if ticket.created_at < clock_timestamp() - interval '20 minutes' then raise exception 'upload_expired'; end if;
  perform 1 from public.profiles where id = p_user and role = 'applicant' and name <> '' and student_id is not null;
  if not found then raise exception 'profile_required'; end if;
  select * into project from public.projects where id = p_project for update;
  if not found or project.status <> 'published' or project.deadline <= clock_timestamp()
    then raise exception 'applications_closed'; end if;
  if p_question_snapshot is distinct from project.questions or cardinality(p_answers) <> cardinality(project.questions)
    then raise exception 'questions_changed'; end if;
  if exists (select 1 from unnest(p_answers) a where a is null or length(trim(a)) not between 1 and 1000)
    then raise exception 'answers_invalid'; end if;
  select * into prior from public.applications where project_id = p_project and user_id = p_user for update;
  if coalesce(prior.submission_version, 0) <> p_expected_version then raise exception 'submission_changed'; end if;
  if project.rubric_locked_at is null then
    update public.projects set rubric_locked_at = clock_timestamp() where id = p_project;
  end if;
  if prior.id is null then
    insert into public.applications (project_id, user_id, resume_path, answers, links, rubric_version)
      values (p_project, p_user, p_path, p_answers, p_links, project.rubric_version)
      returning id, submission_version into application, version;
  else
    update public.applications set resume_path = p_path, answers = p_answers, links = p_links,
      status = 'submitted', submission_version = submission_version + 1,
      submitted_at = clock_timestamp(), updated_at = clock_timestamp()
      where id = prior.id returning id, submission_version into application, version;
    update public.screening_jobs set status = 'failed', error_code = 'superseded',
      lease_token = null, lease_until = null, updated_at = now()
      where application_id = prior.id and submission_version = prior.submission_version and status in ('queued', 'processing');
    insert into public.resume_deletions (path, run_after) values (prior.resume_path, greatest(now(), coalesce(
      (select created_at + interval '3 hours' from public.upload_tickets where path = prior.resume_path), now())))
      on conflict (path) do nothing;
  end if;
  update public.upload_tickets set finalized_at = clock_timestamp() where path = p_path;
  insert into public.screening_jobs (application_id, submission_version) values (application, version);
  return application;
end;
$$;

create function public.claim_screenings(p_limit integer default 2) returns setof public.screening_jobs
language plpgsql set search_path = '' as $$
begin
  update public.screening_jobs set status = 'failed', error_code = 'worker_interrupted',
    lease_token = null, lease_until = null, updated_at = now()
    where status = 'processing' and lease_until < now() and attempts >= 2;
  return query
    with ready as (
      select j.id from public.screening_jobs j
      join public.applications a on a.id = j.application_id and a.submission_version = j.submission_version
      where (j.status = 'queued' and j.run_after <= now() or j.status = 'processing' and j.lease_until < now())
        and j.attempts < 2
      order by j.run_after, j.id limit greatest(1, least(p_limit, 4)) for update of j skip locked
    )
    update public.screening_jobs j set status = 'processing', attempts = j.attempts + 1,
      lease_token = gen_random_uuid(), lease_until = now() + interval '100 seconds', updated_at = now()
      from ready where j.id = ready.id returning j.*;
end;
$$;

create function public.finish_screening(p_job uuid, p_lease uuid, p_result jsonb, p_error text, p_retry boolean)
returns boolean language plpgsql set search_path = '' as $$
declare job public.screening_jobs; app public.applications; rubric public.project_rubrics;
declare result_score integer; result_bucket public.screening_bucket;
begin
  -- Application before job matches the lock order of resubmissions and retries.
  select a.* into app from public.applications a join public.screening_jobs j on j.application_id = a.id
    where j.id = p_job for update of a;
  if not found then return false; end if;
  select * into job from public.screening_jobs where id = p_job for update;
  if not found or job.status <> 'processing' or job.lease_token is distinct from p_lease
    or job.lease_until <= clock_timestamp() or job.submission_version <> app.submission_version
    then return false; end if;
  if p_result is not null then
    select * into strict rubric from public.project_rubrics where project_id = app.project_id and version = app.rubric_version;
    result_score := (p_result->>'score')::integer;
    result_bucket := case when result_score >= rubric.yes_threshold then 'Yes'::public.screening_bucket
      when result_score >= rubric.maybe_threshold then 'Maybe'::public.screening_bucket else 'No'::public.screening_bucket end;
    insert into public.screenings (application_id, submission_version, score, bucket, matched_skills,
      missing_skills, summary, flags, criterion_evidence, rubric_version, model_version)
    values (app.id, app.submission_version, result_score, result_bucket,
      array(select jsonb_array_elements_text(p_result->'matched_skills')),
      array(select jsonb_array_elements_text(p_result->'missing_skills')),
      p_result->>'summary', array(select jsonb_array_elements_text(p_result->'flags')),
      p_result->'criterion_evidence', app.rubric_version, p_result->>'model_version');
    update public.screening_jobs set status = 'completed', lease_token = null,
      lease_until = null, error_code = null, updated_at = now() where id = p_job;
  else
    update public.screening_jobs set
      status = case when p_retry and job.attempts < 2 then 'queued'::public.job_status else 'failed'::public.job_status end,
      run_after = now() + interval '30 seconds', lease_token = null, lease_until = null,
      error_code = p_error, updated_at = now() where id = p_job;
  end if;
  -- Applicant-visible status is independent of the score and whether screening succeeded.
  update public.applications set status = 'under_review', updated_at = now() where id = app.id;
  return true;
end;
$$;

create function public.retry_screening(p_reviewer uuid, p_application uuid, p_version integer) returns boolean
language plpgsql set search_path = '' as $$
declare app public.applications;
begin
  select a.* into app from public.applications a join public.projects p on p.id = a.project_id
    join public.profiles r on r.id = p.reviewer_id
    where a.id = p_application and r.id = p_reviewer and r.role = 'reviewer' for update of a;
  if not found or app.submission_version <> p_version then return false; end if;
  update public.screening_jobs set status = 'queued', attempts = 0, run_after = now(), updated_at = now()
    where application_id = app.id and submission_version = app.submission_version and status = 'failed'
      and error_code not in ('no_readable_text', 'invalid_pdf', 'unsupported_pdf');
  return found;
end;
$$;

create function public.record_decision(
  p_reviewer uuid, p_application uuid, p_version integer, p_decision public.review_decision, p_note text
) returns boolean language plpgsql set search_path = '' as $$
declare app public.applications; decision_time timestamptz;
begin
  select a.* into app from public.applications a join public.projects p on p.id = a.project_id
    join public.profiles r on r.id = p.reviewer_id
    where a.id = p_application and r.id = p_reviewer and r.role = 'reviewer' for update of a;
  if not found or app.submission_version <> p_version then return false; end if;
  decision_time := clock_timestamp();
  insert into public.decisions values (app.id, p_version, p_reviewer, p_decision, p_note, decision_time)
    on conflict (application_id, submission_version) do update set decided_by = excluded.decided_by,
      decision = excluded.decision, note = excluded.note, decided_at = excluded.decided_at;
  insert into public.decision_history (application_id, submission_version, decided_by, decision, note, decided_at)
    values (app.id, p_version, p_reviewer, p_decision, p_note, decision_time);
  return true;
end;
$$;

create function private.queue_deleted_resume() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.resume_deletions (path, run_after) values (old.resume_path, greatest(now(), coalesce(
    (select created_at + interval '3 hours' from public.upload_tickets where path = old.resume_path), now())))
    on conflict (path) do nothing;
  return old;
end;
$$;
create trigger queue_deleted_resume after delete on public.applications
for each row execute function private.queue_deleted_resume();

create function private.queue_abandoned_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.applications where resume_path = old.path) then
    insert into public.resume_deletions (path, run_after)
      values (old.path, greatest(now(), old.created_at + interval '3 hours'))
      on conflict (path) do nothing;
  end if;
  return old;
end;
$$;
create trigger queue_abandoned_ticket after delete on public.upload_tickets
for each row execute function private.queue_abandoned_ticket();

create function public.prepare_resume_cleanup(p_retention_days integer) returns void
language plpgsql set search_path = '' as $$
begin
  -- Signed uploads last two hours. Keep uncommitted files and deletion tombstones
  -- beyond this window so the initial token cannot recreate an untracked object.
  delete from public.upload_tickets where path in (
    select path from public.upload_tickets where created_at < now() - interval '3 hours'
    order by created_at limit 100 for update skip locked
  );
  delete from public.applications where id in (
    select a.id from public.applications a join public.projects p on a.project_id = p.id
    where p.deadline < now() - make_interval(days => greatest(1, p_retention_days))
    order by p.deadline limit 50 for update of a skip locked
  );
end;
$$;

create function public.shortlist_csv_rows(p_project uuid)
returns table (name text, email text, student_id text, project text, score integer,
  bucket public.screening_bucket, matched_skills text[], missing_skills text[], flags text[],
  decision public.review_decision, note text, submitted_at timestamptz, decided_at timestamptz)
language plpgsql stable set search_path = '' as $$
begin
  if not private.owns_project(p_project) then raise exception 'project_not_found'; end if;
  if exists (select 1 from public.projects p where p.id = p_project and p.deadline > now())
    then raise exception 'export_before_deadline'; end if;
  return query select u.name, u.email, u.student_id, p.name, s.score, s.bucket,
    s.matched_skills, s.missing_skills, s.flags, d.decision, d.note, a.submitted_at, d.decided_at
  from public.applications a
  join public.profiles u on u.id = a.user_id
  join public.projects p on p.id = a.project_id
  join public.decisions d on d.application_id = a.id and d.submission_version = a.submission_version
  left join public.screenings s on s.application_id = a.id and s.submission_version = a.submission_version
  where a.project_id = p_project and d.decision = 'shortlist'
  order by s.score desc nulls last, a.submitted_at, a.id;
end;
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.campus_account(), private.has_role(public.account_role), private.owns_project(uuid),
  private.reviews_application(uuid), private.applied_to(uuid), private.reviews_profile(uuid) to authenticated;
revoke execute on function public.begin_resume_upload(uuid, uuid),
  public.submit_resume(uuid, uuid, text, integer, text[], text[], text[]),
  public.claim_screenings(integer), public.finish_screening(uuid, uuid, jsonb, text, boolean),
  public.retry_screening(uuid, uuid, integer), public.record_decision(uuid, uuid, integer, public.review_decision, text),
  public.prepare_resume_cleanup(integer), public.shortlist_csv_rows(uuid) from public, anon, authenticated;
grant execute on function public.begin_resume_upload(uuid, uuid),
  public.submit_resume(uuid, uuid, text, integer, text[], text[], text[]),
  public.claim_screenings(integer), public.finish_screening(uuid, uuid, jsonb, text, boolean),
  public.retry_screening(uuid, uuid, integer), public.record_decision(uuid, uuid, integer, public.review_decision, text),
  public.prepare_resume_cleanup(integer) to service_role;
grant execute on function public.shortlist_csv_rows(uuid) to authenticated;

commit;

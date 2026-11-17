begin;

-- PostgREST requires explicit predicates on updates, including singleton rows.
create or replace function public.reserve_ai_call(p_rpm integer, p_rpd integer)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  pacific_day date := (clock_timestamp() at time zone 'America/Los_Angeles')::date;
  quota private.ai_quota;
begin
  insert into private.ai_quota (quota_day) values (pacific_day) on conflict do nothing;
  select * into quota from private.ai_quota where singleton for update;
  if quota.quota_day <> pacific_day then
    quota.requests := 0;
    update private.ai_quota set quota_day = pacific_day, requests = 0 where singleton;
  end if;
  if quota.requests >= greatest(1, p_rpd) then
    return greatest(quota.next_request, (pacific_day + 1)::timestamp at time zone 'America/Los_Angeles');
  end if;
  if quota.next_request > clock_timestamp() then return quota.next_request; end if;
  update private.ai_quota set requests = requests + 1,
    next_request = clock_timestamp() + make_interval(secs => 60.0 / greatest(1, p_rpm))
    where singleton;
  return null;
end;
$$;

create or replace function public.defer_screening(p_job uuid, p_lease uuid, p_until timestamptz, p_cooldown boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.screening_jobs j set status = 'queued', attempts = j.attempts - 1,
    lease_token = null, lease_until = null, run_after = greatest(clock_timestamp(), p_until),
    error_code = 'quota_wait', updated_at = now()
  where j.id = p_job and j.status = 'processing' and j.lease_token = p_lease
    and j.lease_until > clock_timestamp();
  if not found then return false; end if;
  if p_cooldown then
    update private.ai_quota set next_request = greatest(next_request, p_until) where singleton;
  end if;
  return true;
end;
$$;

commit;

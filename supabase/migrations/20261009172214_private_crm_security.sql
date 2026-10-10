-- RLS does not protect TRUNCATE. API roles need row operations only.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
revoke insert, update, delete on all tables in schema public from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke insert, update, delete on tables from anon;

-- Keep anonymous SELECT for the row-free health probe. No anon RLS policies exist.
alter function public.set_updated_at() set search_path = pg_catalog, public, pg_temp;
alter function public.prevent_owner_change() set search_path = pg_catalog, public, pg_temp;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.prevent_owner_change() from public, anon, authenticated;

alter policy "Users can view their own automation logs" on public.automation_logs to authenticated;
alter policy "Users can insert their own automation logs" on public.automation_logs to authenticated;
alter policy "Users can update their own automation logs" on public.automation_logs to authenticated;

-- A policy follow-up must refer to that policy's customer, not another owned customer.
alter policy "Users can insert own follow_ups" on public.follow_ups
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = follow_ups.customer_id and c.owner_id = (select auth.uid()))
    and (policy_id is null or exists (
      select 1 from public.policies p where p.id = follow_ups.policy_id
        and p.owner_id = (select auth.uid()) and p.customer_id = follow_ups.customer_id
    ))
  );
alter policy "Users can update own follow_ups" on public.follow_ups
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.customers c where c.id = follow_ups.customer_id and c.owner_id = (select auth.uid()))
    and (policy_id is null or exists (
      select 1 from public.policies p where p.id = follow_ups.policy_id
        and p.owner_id = (select auth.uid()) and p.customer_id = follow_ups.customer_id
    ))
  );

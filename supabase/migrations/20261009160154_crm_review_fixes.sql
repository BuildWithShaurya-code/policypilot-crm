-- Preserve notes entered by the CRM forms.
alter table public.customers add column if not exists notes text;
alter table public.policies add column if not exists notes text;

-- Clients can append/read audit events, but cannot rewrite or erase history.
drop policy if exists "Users can update own activities" on public.activities;
drop policy if exists "Users can delete own activities" on public.activities;
revoke update, delete, truncate on public.activities from anon, authenticated;
grant select, insert on public.activities to authenticated;

-- A renewal is one atomic transaction under the caller's existing RLS policies.
create or replace function public.renew_policy(policy_id_input uuid, new_expiry_input date default null)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  previous public.policies%rowtype;
  updated public.policies%rowtype;
  next_expiry date;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into previous from public.policies
    where id = policy_id_input and owner_id = auth.uid() for update;
  if not found then raise exception 'Policy not found'; end if;

  -- Repeated clicks/retries must not extend the same renewal twice.
  if previous.status = 'renewed' and previous.renewal_status = 'renewed' and new_expiry_input is null then
    updated := previous;
  else
    next_expiry := coalesce(new_expiry_input, (previous.expiry_date + interval '1 year')::date);
    if next_expiry <= previous.expiry_date then
      raise exception 'New expiry must be later than the current expiry';
    end if;
    update public.policies set status = 'renewed', renewal_status = 'renewed', expiry_date = next_expiry
      where id = previous.id returning * into updated;
    update public.follow_ups set status = 'completed', completed_at = now(), updated_at = now()
      where policy_id = previous.id and owner_id = auth.uid() and status in ('pending', 'overdue');
    update public.customers set status = 'active' where id = previous.customer_id and owner_id = auth.uid();
    insert into public.activities(owner_id, customer_id, policy_id, type, description, metadata)
    values (auth.uid(), previous.customer_id, previous.id, 'policy_renewed',
      format('Policy %s successfully renewed. New expiry: %s', previous.policy_number, next_expiry),
      jsonb_build_object('previous_expiry', previous.expiry_date, 'new_expiry', next_expiry, 'premium', previous.premium));
  end if;
  select to_jsonb(updated) || jsonb_build_object('customer', jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email, 'status', c.status))
    into result from public.customers c where c.id = updated.customer_id;
  return result;
end;
$$;
revoke all on function public.renew_policy(uuid, date) from public, anon;
grant execute on function public.renew_policy(uuid, date) to authenticated;

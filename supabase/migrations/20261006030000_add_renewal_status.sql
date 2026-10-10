-- Phase 6 Migration: Add renewal_status to policies table
-- Supports: 'new', 'contacted', 'interested', 'quote_sent', 'payment_pending', 'renewed', 'not_interested'

-- 1. Create renewal workflow status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'renewal_workflow_status') then
    create type public.renewal_workflow_status as enum (
      'new',
      'contacted',
      'interested',
      'quote_sent',
      'payment_pending',
      'renewed',
      'not_interested'
    );
  end if;
end
$$;

-- 2. Add renewal_status column to policies table with default 'new'
alter table public.policies
  add column if not exists renewal_status public.renewal_workflow_status not null default 'new';

-- 3. Create index for fast filtering by renewal status
create index if not exists idx_policies_owner_renewal_status
  on public.policies(owner_id, renewal_status);

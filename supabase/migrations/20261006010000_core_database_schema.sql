-- Phase 2 Migration: PolicyPilot Core Database Schema
-- Tables: profiles (extended), customers, policies, follow_ups, activities, imports, import_errors

-- 1. EXTEND PROFILES TABLE
alter table public.profiles
  add column if not exists phone text,
  add column if not exists business_name text,
  add column if not exists business_address text,
  add column if not exists avatar_url text;

-- 2. CREATE HELPER FUNCTION FOR UPDATED_AT TIMESTAMP
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- Trigger for profiles updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_profiles_updated_at') then
    create trigger set_profiles_updated_at
      before update on public.profiles
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- 3. CUSTOMERS TABLE
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  status text not null default 'active' check (status in ('active', 'renewal_due', 'expired')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Trigger for customers updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_customers_updated_at') then
    create trigger set_customers_updated_at
      before update on public.customers
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Indexes for customers
create index if not exists idx_customers_owner_id on public.customers(owner_id);
create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_customers_phone on public.customers(phone);

-- 4. POLICIES TABLE
create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  policy_number text not null,
  insurer text not null,
  policy_type text not null,
  premium numeric not null check (premium >= 0),
  start_date date,
  expiry_date date not null,
  status text not null default 'active' check (status in ('active', 'expiring_soon', 'due_today', 'expired', 'renewed')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint check_policy_dates check (start_date is null or start_date <= expiry_date),
  constraint policies_owner_policy_number_key unique (owner_id, policy_number)
);

-- Trigger for policies updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_policies_updated_at') then
    create trigger set_policies_updated_at
      before update on public.policies
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Indexes for policies
create index if not exists idx_policies_owner_id on public.policies(owner_id);
create index if not exists idx_policies_customer_id on public.policies(customer_id);
create index if not exists idx_policies_policy_number on public.policies(policy_number);
create index if not exists idx_policies_expiry_date on public.policies(expiry_date);
create index if not exists idx_policies_status on public.policies(status);
create index if not exists idx_policies_insurer on public.policies(insurer);

-- 5. FOLLOW_UPS TABLE
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  policy_id uuid references public.policies(id) on delete cascade,
  reason text not null check (reason in ('renewal', 'quote', 'payment', 'document', 'callback', 'other')),
  scheduled_date date not null,
  scheduled_time time,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'overdue')),
  completed_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Trigger for follow_ups updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'set_follow_ups_updated_at') then
    create trigger set_follow_ups_updated_at
      before update on public.follow_ups
      for each row execute function public.set_updated_at();
  end if;
end
$$;

-- Indexes for follow_ups
create index if not exists idx_follow_ups_owner_id on public.follow_ups(owner_id);
create index if not exists idx_follow_ups_customer_id on public.follow_ups(customer_id);
create index if not exists idx_follow_ups_policy_id on public.follow_ups(policy_id);
create index if not exists idx_follow_ups_scheduled_date on public.follow_ups(scheduled_date);
create index if not exists idx_follow_ups_status on public.follow_ups(status);

-- 6. ACTIVITIES TABLE
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  policy_id uuid references public.policies(id) on delete set null,
  type text not null,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes for activities
create index if not exists idx_activities_owner_id on public.activities(owner_id);
create index if not exists idx_activities_customer_id on public.activities(customer_id);
create index if not exists idx_activities_policy_id on public.activities(policy_id);
create index if not exists idx_activities_created_at on public.activities(created_at);

-- 7. IMPORTS TABLE
create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  total_rows integer default 0,
  customers_created integer default 0,
  policies_created integer default 0,
  policies_updated integer default 0,
  duplicates integer default 0,
  errors integer default 0,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed', 'partially_completed')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  completed_at timestamptz
);

-- Indexes for imports
create index if not exists idx_imports_owner_id on public.imports(owner_id);
create index if not exists idx_imports_created_at on public.imports(created_at);

-- 8. IMPORT_ERRORS TABLE
create table if not exists public.import_errors (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.imports(id) on delete cascade,
  row_number integer not null,
  field text,
  value text,
  error_type text,
  message text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Indexes for import_errors
create index if not exists idx_import_errors_import_id on public.import_errors(import_id);

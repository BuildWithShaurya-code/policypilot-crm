-- Phase 3 Migration: Row Level Security (RLS), Ownership Isolation & Data Integrity
-- Secures: profiles, customers, policies, follow_ups, activities, imports, import_errors

-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.policies enable row level security;
alter table public.follow_ups enable row level security;
alter table public.activities enable row level security;
alter table public.imports enable row level security;
alter table public.import_errors enable row level security;

-- 2. OWNERSHIP IMMUTABILITY TRIGGER
-- Strictly prevents malicious re-assignment of owner_id on existing records
create or replace function public.prevent_owner_change()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Security violation: Reassigning owner_id is not permitted.';
  end if;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_customer_owner_change') then
    create trigger trg_prevent_customer_owner_change
      before update on public.customers
      for each row execute function public.prevent_owner_change();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_policy_owner_change') then
    create trigger trg_prevent_policy_owner_change
      before update on public.policies
      for each row execute function public.prevent_owner_change();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_follow_up_owner_change') then
    create trigger trg_prevent_follow_up_owner_change
      before update on public.follow_ups
      for each row execute function public.prevent_owner_change();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_activity_owner_change') then
    create trigger trg_prevent_activity_owner_change
      before update on public.activities
      for each row execute function public.prevent_owner_change();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'trg_prevent_import_owner_change') then
    create trigger trg_prevent_import_owner_change
      before update on public.imports
      for each row execute function public.prevent_owner_change();
  end if;
end
$$;

-- 3. INPUT VALIDATION & DATA INTEGRITY CONSTRAINTS
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'check_customer_name_length') then
    alter table public.customers
      add constraint check_customer_name_length
      check (length(trim(name)) >= 2 and length(name) <= 255);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_customer_phone_format') then
    alter table public.customers
      add constraint check_customer_phone_format
      check (phone is null or (length(trim(phone)) >= 7 and length(phone) <= 30));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_policy_number_length') then
    alter table public.policies
      add constraint check_policy_number_length
      check (length(trim(policy_number)) >= 1 and length(policy_number) <= 100);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_policy_insurer_length') then
    alter table public.policies
      add constraint check_policy_insurer_length
      check (length(trim(insurer)) >= 2 and length(insurer) <= 150);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'check_policy_type_length') then
    alter table public.policies
      add constraint check_policy_type_length
      check (length(trim(policy_type)) >= 2 and length(policy_type) <= 100);
  end if;
end
$$;

-- 4. ROW LEVEL SECURITY POLICIES: CUSTOMERS
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'Users can view own customers') then
    create policy "Users can view own customers"
      on public.customers for select to authenticated
      using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'Users can insert own customers') then
    create policy "Users can insert own customers"
      on public.customers for insert to authenticated
      with check (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'Users can update own customers') then
    create policy "Users can update own customers"
      on public.customers for update to authenticated
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'Users can delete own customers') then
    create policy "Users can delete own customers"
      on public.customers for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;

-- 5. ROW LEVEL SECURITY POLICIES: POLICIES (CROSS-OWNER PREVENTION)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'policies' and policyname = 'Users can view own policies') then
    create policy "Users can view own policies"
      on public.policies for select to authenticated
      using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'policies' and policyname = 'Users can insert own policies') then
    create policy "Users can insert own policies"
      on public.policies for insert to authenticated
      with check (
        auth.uid() = owner_id
        and customer_id in (
          select c.id from public.customers c where c.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'policies' and policyname = 'Users can update own policies') then
    create policy "Users can update own policies"
      on public.policies for update to authenticated
      using (auth.uid() = owner_id)
      with check (
        auth.uid() = owner_id
        and customer_id in (
          select c.id from public.customers c where c.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'policies' and policyname = 'Users can delete own policies') then
    create policy "Users can delete own policies"
      on public.policies for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;

-- 6. ROW LEVEL SECURITY POLICIES: FOLLOW_UPS (CROSS-OWNER PREVENTION)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'follow_ups' and policyname = 'Users can view own follow_ups') then
    create policy "Users can view own follow_ups"
      on public.follow_ups for select to authenticated
      using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'follow_ups' and policyname = 'Users can insert own follow_ups') then
    create policy "Users can insert own follow_ups"
      on public.follow_ups for insert to authenticated
      with check (
        auth.uid() = owner_id
        and customer_id in (
          select c.id from public.customers c where c.owner_id = auth.uid()
        )
        and (
          policy_id is null
          or policy_id in (
            select p.id from public.policies p where p.owner_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'follow_ups' and policyname = 'Users can update own follow_ups') then
    create policy "Users can update own follow_ups"
      on public.follow_ups for update to authenticated
      using (auth.uid() = owner_id)
      with check (
        auth.uid() = owner_id
        and customer_id in (
          select c.id from public.customers c where c.owner_id = auth.uid()
        )
        and (
          policy_id is null
          or policy_id in (
            select p.id from public.policies p where p.owner_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'follow_ups' and policyname = 'Users can delete own follow_ups') then
    create policy "Users can delete own follow_ups"
      on public.follow_ups for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;

-- 7. ROW LEVEL SECURITY POLICIES: ACTIVITIES
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'Users can view own activities') then
    create policy "Users can view own activities"
      on public.activities for select to authenticated
      using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'Users can insert own activities') then
    create policy "Users can insert own activities"
      on public.activities for insert to authenticated
      with check (
        auth.uid() = owner_id
        and (
          customer_id is null
          or customer_id in (
            select c.id from public.customers c where c.owner_id = auth.uid()
          )
        )
        and (
          policy_id is null
          or policy_id in (
            select p.id from public.policies p where p.owner_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'Users can update own activities') then
    create policy "Users can update own activities"
      on public.activities for update to authenticated
      using (auth.uid() = owner_id)
      with check (
        auth.uid() = owner_id
        and (
          customer_id is null
          or customer_id in (
            select c.id from public.customers c where c.owner_id = auth.uid()
          )
        )
        and (
          policy_id is null
          or policy_id in (
            select p.id from public.policies p where p.owner_id = auth.uid()
          )
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activities' and policyname = 'Users can delete own activities') then
    create policy "Users can delete own activities"
      on public.activities for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;

-- 8. ROW LEVEL SECURITY POLICIES: IMPORTS
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports' and policyname = 'Users can view own imports') then
    create policy "Users can view own imports"
      on public.imports for select to authenticated
      using (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports' and policyname = 'Users can insert own imports') then
    create policy "Users can insert own imports"
      on public.imports for insert to authenticated
      with check (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports' and policyname = 'Users can update own imports') then
    create policy "Users can update own imports"
      on public.imports for update to authenticated
      using (auth.uid() = owner_id)
      with check (auth.uid() = owner_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'imports' and policyname = 'Users can delete own imports') then
    create policy "Users can delete own imports"
      on public.imports for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end
$$;

-- 9. ROW LEVEL SECURITY POLICIES: IMPORT_ERRORS (TIED TO OWNED IMPORTS)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_errors' and policyname = 'Users can view own import_errors') then
    create policy "Users can view own import_errors"
      on public.import_errors for select to authenticated
      using (
        import_id in (
          select i.id from public.imports i where i.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_errors' and policyname = 'Users can insert own import_errors') then
    create policy "Users can insert own import_errors"
      on public.import_errors for insert to authenticated
      with check (
        import_id in (
          select i.id from public.imports i where i.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_errors' and policyname = 'Users can update own import_errors') then
    create policy "Users can update own import_errors"
      on public.import_errors for update to authenticated
      using (
        import_id in (
          select i.id from public.imports i where i.owner_id = auth.uid()
        )
      )
      with check (
        import_id in (
          select i.id from public.imports i where i.owner_id = auth.uid()
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'import_errors' and policyname = 'Users can delete own import_errors') then
    create policy "Users can delete own import_errors"
      on public.import_errors for delete to authenticated
      using (
        import_id in (
          select i.id from public.imports i where i.owner_id = auth.uid()
        )
      );
  end if;
end
$$;

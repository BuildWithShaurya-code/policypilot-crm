-- ==============================================================================
-- PolicyPilot Migration: Production Hardening Indexes
-- Phase 9 — Production Hardening, Security & Reliability
-- ==============================================================================

-- 1. Customers composite indexes for fast search and listing under RLS
CREATE INDEX IF NOT EXISTS idx_customers_owner_name ON public.customers (owner_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_owner_phone ON public.customers (owner_id, phone);

-- 2. Policies composite indexes for renewals, expiry, customer listing, status filtering
CREATE INDEX IF NOT EXISTS idx_policies_owner_expiry ON public.policies (owner_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_policies_owner_status ON public.policies (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_policies_owner_customer ON public.policies (owner_id, customer_id);

-- 3. Follow-ups composite indexes for dashboard and scheduler queries
CREATE INDEX IF NOT EXISTS idx_follow_ups_owner_scheduled ON public.follow_ups (owner_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_follow_ups_owner_status ON public.follow_ups (owner_id, status);

-- 4. Activities composite indexes for audit trail & timeline queries
CREATE INDEX IF NOT EXISTS idx_activities_owner_created ON public.activities (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_owner_customer ON public.activities (owner_id, customer_id);

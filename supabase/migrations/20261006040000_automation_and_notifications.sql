-- Phase 8: Automation, Logs & Notification Preferences Migration

-- 1. Add notification preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "daily_summary_email": true,
  "renewal_reminders": true,
  "follow_up_reminders": true,
  "notification_email": null
}'::jsonb;

-- 2. Create automation_logs table with idempotency constraint
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL,
  execution_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  records_processed INTEGER NOT NULL DEFAULT 0,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  payload_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_automation_daily_run UNIQUE (owner_id, automation_type, execution_date)
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_owner_date ON public.automation_logs(owner_id, execution_date);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs(status);

-- 3. Enable RLS on automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Users can view their own automation logs"
  ON public.automation_logs
  FOR SELECT
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own automation logs" ON public.automation_logs;
CREATE POLICY "Users can insert their own automation logs"
  ON public.automation_logs
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own automation logs" ON public.automation_logs;
CREATE POLICY "Users can update their own automation logs"
  ON public.automation_logs
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

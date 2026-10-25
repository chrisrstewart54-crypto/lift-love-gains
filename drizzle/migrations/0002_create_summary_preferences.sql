CREATE TABLE public.summary_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  notif_day INTEGER NOT NULL DEFAULT 0,
  notif_hour INTEGER NOT NULL DEFAULT 20,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  email_last_sent_week TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.summary_preferences TO authenticated;
GRANT ALL ON public.summary_preferences TO service_role;

ALTER TABLE public.summary_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own summary preferences"
  ON public.summary_preferences FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own summary preferences"
  ON public.summary_preferences FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own summary preferences"
  ON public.summary_preferences FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own summary preferences"
  ON public.summary_preferences FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));
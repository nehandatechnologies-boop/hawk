-- Coordinates on cameras
ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Coordinates on alerts (snapshot of detection location)
ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Escalation dispatch log
CREATE TABLE IF NOT EXISTS public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid,
  subject_id uuid,
  channel text NOT NULL,          -- 'webhook' | 'email' | 'sms'
  target text NOT NULL,           -- redacted target label
  status text NOT NULL,           -- 'dispatched' | 'failed'
  http_status int,
  response_excerpt text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Supervisors can read escalations" ON public.escalations;
CREATE POLICY "Admins and Supervisors can read escalations"
  ON public.escalations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'Administrator')
    OR public.has_role(auth.uid(), 'Supervisor')
  );

-- No INSERT/UPDATE/DELETE policies — writes go through service role only.

CREATE INDEX IF NOT EXISTS escalations_alert_id_idx ON public.escalations (alert_id);
CREATE INDEX IF NOT EXISTS escalations_created_at_idx ON public.escalations (created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_subject_id_idx ON public.alerts (subject_id);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON public.alerts (created_at DESC);
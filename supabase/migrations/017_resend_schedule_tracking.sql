-- Migration: resend sched metadata on snaps
-- Created: 2026-02-22
-- Description: manage and query snaps scheduled for resend and diff them frm reg. snaps

ALTER TABLE public.snaps
  ADD COLUMN IF NOT EXISTS resend_email_id TEXT,
  ADD COLUMN IF NOT EXISTS resend_scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_snaps_resend_email_id
  ON public.snaps (resend_email_id)
  WHERE resend_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snaps_delivery_status_send_time
  ON public.snaps (delivery_status, send_time);

COMMENT ON COLUMN public.snaps.resend_email_id IS 'Resend provider email id for immediate or scheduled delivery';
COMMENT ON COLUMN public.snaps.resend_scheduled_at IS 'Scheduled delivery timestamp registered with Resend';
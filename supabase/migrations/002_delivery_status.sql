-- =====================================================
-- Add delivery status tracking to snaps table
-- =====================================================

-- Remove the old delivered boolean column
ALTER TABLE public.snaps DROP COLUMN IF EXISTS delivered;

-- Add new delivery tracking columns
ALTER TABLE public.snaps 
  ADD COLUMN delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN error_message TEXT,
  ADD COLUMN retry_count INTEGER DEFAULT 0;

-- delivery_status values: 'pending', 'sent', 'failed'

-- Update index to use delivery_status instead of delivered
DROP INDEX IF EXISTS idx_snaps_send_date;
CREATE INDEX idx_snaps_send_date ON public.snaps(send_date, delivery_status);

-- Add index for failed deliveries that need retry
CREATE INDEX idx_snaps_failed ON public.snaps(delivery_status) WHERE delivery_status = 'failed';

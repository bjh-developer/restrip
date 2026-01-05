-- =====================================================
-- Add telegram_chat_id column to snaps table
-- =====================================================

ALTER TABLE public.snaps ADD COLUMN telegram_chat_id BIGINT;
CREATE INDEX idx_snaps_telegram_chat_id ON public.snaps(telegram_chat_id);
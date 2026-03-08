-- Migration: Pending Uploads for Sign-Up Flow
-- Created: 2026-03-08
-- Description: Temporary storage for form data when anonymous users on /upload
-- choose to create an account. Data is restored on /new after sign-up completes.

create table pending_uploads (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  form_data jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes')
);

-- Fast lookup by token
create index idx_pending_uploads_token on pending_uploads (token);

-- Index for cleanup of expired rows
create index idx_pending_uploads_expires on pending_uploads (expires_at);

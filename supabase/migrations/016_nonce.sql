-- Migration: Nonce Table for Upload Verification
-- Created: 2026-02-18
-- Description: Create a table to store nonces for verifying upload requests, especially for anonymous users. This will be used in conjunction with Cloudflare Turnstile to prevent abuse of the upload endpoint.

create table upload_nonces (
  nonce text primary key,
  client_ip text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-cleanup expired nonces
create index on upload_nonces (expires_at);
-- ══════════════════════════════════════════════════════════
--  Chess Academy — Elo Migration
--  Run this in:
--  Supabase Dashboard → SQL Editor → New Query → Run
-- ══════════════════════════════════════════════════════════

-- Add elo column to the progress table.
-- Default 1200 so existing users start at standard rating.
ALTER TABLE public.progress
  ADD COLUMN IF NOT EXISTS elo int NOT NULL DEFAULT 1200;

-- Verify
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'progress'
  AND column_name  = 'elo';

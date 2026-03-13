-- Migration: add_report_sharing
-- Adds shared_with_roles JSON column to FND_SAVED_REPORTS for role-based template sharing

ALTER TABLE "FND_SAVED_REPORTS" ADD COLUMN IF NOT EXISTS "shared_with_roles" JSONB;

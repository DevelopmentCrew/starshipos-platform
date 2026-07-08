-- Base44 User built-in fields dropped during the original migration. Add them so
-- names and app branding work. Idempotent.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "full_name" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_suspended" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_verified" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disabled" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disabled_reason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "force_password_reset" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_service" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "collaborator_role" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "app_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "homecare_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "checkmate_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "kitbag_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "procureit_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "mobile_logo_url" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "johnny5_logo_url" text;

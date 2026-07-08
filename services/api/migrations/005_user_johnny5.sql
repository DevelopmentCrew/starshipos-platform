-- Johnny5 cell assignment fields on user (used by updateJ5UserCell). Idempotent.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "johnny5_cell_id" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "johnny5_cell_name" text;

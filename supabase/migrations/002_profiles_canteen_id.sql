-- 002_profiles_canteen_id.sql
-- Idempotent: safe if 001_initial_schema.sql already defined profiles.canteen_id.
-- Use this when upgrading an older database that was created without canteen_id.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS canteen_id uuid REFERENCES public.canteens (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_canteen_id ON public.profiles (canteen_id);

COMMENT ON COLUMN public.profiles.canteen_id IS
  'Optional. Set for canteen_staff / canteen_owner so RLS can limit orders and menu ops to that canteen. '
  'Leave NULL for students, institution_admin, and super_admin.';

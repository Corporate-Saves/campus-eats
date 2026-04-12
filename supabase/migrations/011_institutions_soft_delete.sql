-- Soft-delete for institutions; allow slug reuse after delete (unique among non-deleted rows only).

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS institutions_slug_unique_active
  ON public.institutions (slug)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.institutions.deleted_at IS
  'When set, institution is soft-deleted; tenant users should be blocked from login.';

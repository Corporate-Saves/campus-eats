-- Soft delete for menu items (hidden from student menu when set)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_canteen_active
  ON public.menu_items (canteen_id)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.menu_items.deleted_at IS
  'When set, item is soft-deleted (not shown on menus).';

-- Public bucket for menu photos (uploads go through API with service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

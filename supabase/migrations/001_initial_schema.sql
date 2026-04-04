-- 001_initial_schema.sql — multi-tenant canteen schema, indexes, RLS
-- Requires: Supabase (auth schema). Uses gen_random_uuid() (pgcrypto; enabled by default on Supabase).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#FF6B35',
  domain_whitelist text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.canteens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  is_open boolean NOT NULL DEFAULT true,
  opening_time time,
  closing_time time,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Links staff/owners to a single canteen for RLS (nullable for students / institution admins / super_admin).
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions (id) ON DELETE SET NULL,
  canteen_id uuid REFERENCES public.canteens (id) ON DELETE SET NULL,
  full_name text,
  role text NOT NULL,
  student_id text,
  wallet_balance numeric NOT NULL DEFAULT 0,
  fcm_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (
    role IN (
      'super_admin',
      'institution_admin',
      'canteen_owner',
      'canteen_staff',
      'student'
    )
  ),
  CONSTRAINT profiles_wallet_balance_non_negative CHECK (wallet_balance >= 0)
);

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL REFERENCES public.canteens (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL REFERENCES public.canteens (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.menu_categories (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  is_veg boolean NOT NULL DEFAULT true,
  max_daily_quantity integer,
  prepared_quantity integer NOT NULL DEFAULT 0,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_items_price_positive CHECK (price >= 0),
  CONSTRAINT menu_items_prepared_non_negative CHECK (prepared_quantity >= 0)
);

CREATE TABLE public.time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canteen_id uuid NOT NULL REFERENCES public.canteens (id) ON DELETE CASCADE,
  label text,
  start_time time,
  end_time time,
  max_orders integer NOT NULL DEFAULT 20,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT time_slots_max_orders_positive CHECK (max_orders > 0)
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  canteen_id uuid NOT NULL REFERENCES public.canteens (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  time_slot_id uuid REFERENCES public.time_slots (id) ON DELETE SET NULL,
  token_number integer,
  status text NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text,
  special_instructions text,
  scheduled_for date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_status_check CHECK (
    status IN (
      'PENDING',
      'ACCEPTED',
      'PREPARING',
      'READY',
      'COLLECTED',
      'CANCELLED'
    )
  ),
  CONSTRAINT orders_payment_method_check CHECK (
    payment_method IS NULL
    OR payment_method IN ('wallet', 'upi', 'cash')
  ),
  CONSTRAINT orders_payment_status_check CHECK (
    payment_status IS NULL
    OR payment_status IN ('paid', 'pending', 'refunded')
  ),
  CONSTRAINT orders_total_non_negative CHECK (total_amount >= 0)
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items (id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_prices_non_negative CHECK (unit_price >= 0 AND subtotal >= 0)
);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  institution_id uuid NOT NULL REFERENCES public.institutions (id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  type text NOT NULL,
  reference_id text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_type_check CHECK (
    type IN ('topup', 'order_payment', 'refund')
  )
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (
    type IN ('order_update', 'promo', 'system')
  )
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_institutions_slug ON public.institutions (slug);
CREATE INDEX idx_institutions_active ON public.institutions (is_active) WHERE is_active = true;

CREATE INDEX idx_profiles_institution_id ON public.profiles (institution_id);
CREATE INDEX idx_profiles_canteen_id ON public.profiles (canteen_id);
CREATE INDEX idx_profiles_role ON public.profiles (role);

CREATE INDEX idx_canteens_institution_id ON public.canteens (institution_id);

CREATE INDEX idx_menu_categories_canteen_id ON public.menu_categories (canteen_id);
CREATE INDEX idx_menu_categories_canteen_sort ON public.menu_categories (canteen_id, sort_order);

CREATE INDEX idx_menu_items_canteen_id ON public.menu_items (canteen_id);
CREATE INDEX idx_menu_items_category_id ON public.menu_items (category_id);
CREATE INDEX idx_menu_items_available ON public.menu_items (canteen_id) WHERE is_available = true;

CREATE INDEX idx_time_slots_canteen_id ON public.time_slots (canteen_id);

CREATE INDEX idx_orders_institution_id ON public.orders (institution_id);
CREATE INDEX idx_orders_canteen_id ON public.orders (canteen_id);
CREATE INDEX idx_orders_student_id ON public.orders (student_id);
CREATE INDEX idx_orders_status ON public.orders (status);
CREATE INDEX idx_orders_created_at ON public.orders (created_at DESC);

CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_order_items_menu_item_id ON public.order_items (menu_item_id);

CREATE INDEX idx_wallet_transactions_profile_id ON public.wallet_transactions (profile_id);
CREATE INDEX idx_wallet_transactions_institution_id ON public.wallet_transactions (institution_id);
CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions (created_at DESC);

CREATE INDEX idx_notifications_profile_id ON public.notifications (profile_id);
CREATE INDEX idx_notifications_unread ON public.notifications (profile_id) WHERE is_read = false;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER — bypass RLS when reading profiles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_institution_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_canteen_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT canteen_id
  FROM public.profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_institution_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'institution_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_canteen_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'canteen_owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_canteen_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'canteen_staff'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'student'
  );
$$;

-- Canteen belongs to caller's institution (for admin checks)
CREATE OR REPLACE FUNCTION public.canteen_in_my_institution(p_canteen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.id = p_canteen_id
      AND c.institution_id = public.get_my_institution_id()
  );
$$;

COMMENT ON COLUMN public.profiles.canteen_id IS
  'When set for canteen_staff / canteen_owner, RLS scopes kitchen actions to this canteen.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canteens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------- institutions ----------
CREATE POLICY institutions_select ON public.institutions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR id = public.get_my_institution_id()
  );

CREATE POLICY institutions_insert ON public.institutions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY institutions_update ON public.institutions
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND id = public.get_my_institution_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND id = public.get_my_institution_id()
    )
  );

CREATE POLICY institutions_delete ON public.institutions
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ---------- profiles ----------
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id IS NOT DISTINCT FROM public.get_my_institution_id()
    )
    OR (
      public.get_my_institution_id() IS NOT NULL
      AND institution_id = public.get_my_institution_id()
      AND (
        public.is_canteen_staff()
        OR public.is_canteen_owner()
      )
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

-- ---------- canteens ----------
CREATE POLICY canteens_select ON public.canteens
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR institution_id = public.get_my_institution_id()
  );

CREATE POLICY canteens_insert ON public.canteens
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

CREATE POLICY canteens_update ON public.canteens
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
    OR (
      public.is_canteen_owner()
      AND id = public.get_my_canteen_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
    OR (
      public.is_canteen_owner()
      AND id = public.get_my_canteen_id()
    )
  );

CREATE POLICY canteens_delete ON public.canteens
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

-- ---------- menu_categories ----------
CREATE POLICY menu_categories_select ON public.menu_categories
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.canteen_in_my_institution(canteen_id)
  );

CREATE POLICY menu_categories_insert ON public.menu_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY menu_categories_update ON public.menu_categories
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY menu_categories_delete ON public.menu_categories
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

-- ---------- menu_items ----------
CREATE POLICY menu_items_select ON public.menu_items
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.canteen_in_my_institution(canteen_id)
  );

CREATE POLICY menu_items_insert ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY menu_items_update ON public.menu_items
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY menu_items_delete ON public.menu_items
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

-- ---------- time_slots ----------
CREATE POLICY time_slots_select ON public.time_slots
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.canteen_in_my_institution(canteen_id)
  );

CREATE POLICY time_slots_insert ON public.time_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY time_slots_update ON public.time_slots
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY time_slots_delete ON public.time_slots
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND public.canteen_in_my_institution(canteen_id)
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

-- ---------- orders ----------
CREATE POLICY orders_select ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR student_id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
    OR (
      public.is_canteen_staff()
      AND canteen_id = public.get_my_canteen_id()
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY orders_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_student()
      AND student_id = auth.uid()
      AND institution_id = public.get_my_institution_id()
      AND EXISTS (
        SELECT 1
        FROM public.canteens c
        WHERE c.id = canteen_id
          AND c.institution_id = public.get_my_institution_id()
      )
    )
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
      AND EXISTS (
        SELECT 1
        FROM public.canteens c
        WHERE c.id = canteen_id
          AND c.institution_id = public.get_my_institution_id()
      )
    )
  );

CREATE POLICY orders_update ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
    OR (
      public.is_canteen_staff()
      AND canteen_id = public.get_my_canteen_id()
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
    OR (
      public.is_canteen_staff()
      AND canteen_id = public.get_my_canteen_id()
    )
    OR (
      public.is_canteen_owner()
      AND canteen_id = public.get_my_canteen_id()
    )
  );

CREATE POLICY orders_delete ON public.orders
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

-- ---------- order_items ----------
CREATE POLICY order_items_select ON public.order_items
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          o.student_id = auth.uid()
          OR (
            public.is_institution_admin()
            AND o.institution_id = public.get_my_institution_id()
          )
          OR (
            public.is_canteen_staff()
            AND o.canteen_id = public.get_my_canteen_id()
          )
          OR (
            public.is_canteen_owner()
            AND o.canteen_id = public.get_my_canteen_id()
          )
        )
    )
  );

CREATE POLICY order_items_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          (
            public.is_student()
            AND o.student_id = auth.uid()
          )
          OR (
            public.is_institution_admin()
            AND o.institution_id = public.get_my_institution_id()
          )
        )
    )
  );

CREATE POLICY order_items_update ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          (
            public.is_institution_admin()
            AND o.institution_id = public.get_my_institution_id()
          )
          OR (
            public.is_canteen_staff()
            AND o.canteen_id = public.get_my_canteen_id()
          )
          OR (
            public.is_canteen_owner()
            AND o.canteen_id = public.get_my_canteen_id()
          )
        )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          (
            public.is_institution_admin()
            AND o.institution_id = public.get_my_institution_id()
          )
          OR (
            public.is_canteen_staff()
            AND o.canteen_id = public.get_my_canteen_id()
          )
          OR (
            public.is_canteen_owner()
            AND o.canteen_id = public.get_my_canteen_id()
          )
        )
    )
  );

CREATE POLICY order_items_delete ON public.order_items
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          (
            public.is_institution_admin()
            AND o.institution_id = public.get_my_institution_id()
          )
          OR (
            public.is_canteen_owner()
            AND o.canteen_id = public.get_my_canteen_id()
          )
        )
    )
  );

-- ---------- wallet_transactions ----------
CREATE POLICY wallet_transactions_select ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR profile_id = auth.uid()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
    )
  );

CREATE POLICY wallet_transactions_insert ON public.wallet_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND institution_id = public.get_my_institution_id()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  );

CREATE POLICY wallet_transactions_update ON public.wallet_transactions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY wallet_transactions_delete ON public.wallet_transactions
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- ---------- notifications ----------
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR profile_id = auth.uid()
    OR (
      public.is_institution_admin()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = notifications.profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  );

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  );

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    public.is_super_admin()
    OR profile_id = auth.uid()
    OR (
      public.is_institution_admin()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = notifications.profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR profile_id = auth.uid()
    OR (
      public.is_institution_admin()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = notifications.profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  );

CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (
    public.is_super_admin()
    OR (
      public.is_institution_admin()
      AND EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = notifications.profile_id
          AND p.institution_id = public.get_my_institution_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Grants (optional RPC / SQL from app)
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_my_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_canteen_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_canteen_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_canteen_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.canteen_in_my_institution(uuid) TO authenticated;

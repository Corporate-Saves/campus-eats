-- Production: composite index for kitchen / queue date filters, Realtime publication,
-- idempotent Razorpay refund debit (service_role).

-- Composite index (001 has separate idx_orders_canteen_id; this optimizes canteen + day).
CREATE INDEX IF NOT EXISTS idx_orders_canteen_date
  ON public.orders (canteen_id, scheduled_for);

-- Note: idx_orders_student (student_id), idx_menu_items_canteen (canteen_id),
-- idx_wallet_transactions_profile (profile_id) already exist in 001 as
-- idx_orders_student_id, idx_menu_items_canteen_id, idx_wallet_transactions_profile_id.

-- ---------------------------------------------------------------------------
-- Supabase Realtime: orders + notifications (idempotent)
-- ---------------------------------------------------------------------------
DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$pub$;

DO $pub$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END
$pub$;

-- ---------------------------------------------------------------------------
-- Razorpay refund: atomic debit + ledger row (idempotent by reference_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debit_wallet_razorpay_refund(
  p_profile_id uuid,
  p_institution_id uuid,
  p_amount_rupees numeric,
  p_reference_id text,
  p_description text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_amount_rupees IS NULL OR p_amount_rupees <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_reference';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_reference_id));

  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions AS wt
    WHERE wt.reference_id = p_reference_id
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles AS p
  SET wallet_balance = p.wallet_balance - p_amount_rupees
  WHERE p.id = p_profile_id
    AND p.institution_id = p_institution_id
    AND p.wallet_balance >= p_amount_rupees;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'profile_debit_failed';
  END IF;

  INSERT INTO public.wallet_transactions (
    profile_id,
    institution_id,
    amount,
    type,
    reference_id,
    description
  )
  VALUES (
    p_profile_id,
    p_institution_id,
    -p_amount_rupees,
    'refund',
    p_reference_id,
    p_description
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_wallet_razorpay_refund(uuid, uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_wallet_razorpay_refund(uuid, uuid, numeric, text, text) TO service_role;

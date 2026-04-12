-- Web Push: store browser subscription on the student's profile (updated via API).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_subscription jsonb;

COMMENT ON COLUMN public.profiles.push_subscription IS
  'Web Push subscription JSON (endpoint, keys); set via /api/notifications/push-subscribe.';

-- Realtime: student clients subscribe to their notification rows.
DO $body$
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
END $body$;

-- Notifications for order transitions are created in application code (createNotification + optional push).
CREATE OR REPLACE FUNCTION public.staff_transition_order_status(
  p_order_id uuid,
  p_canteen_id uuid,
  p_next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  allowed boolean := false;
BEGIN
  SELECT *
  INTO o
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF o.canteen_id IS DISTINCT FROM p_canteen_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_next_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'use_staff_cancel_order_refund';
  END IF;

  IF o.status = 'PENDING' AND p_next_status = 'ACCEPTED' THEN
    allowed := true;
  ELSIF o.status = 'ACCEPTED' AND p_next_status = 'PREPARING' THEN
    allowed := true;
  ELSIF o.status = 'PREPARING' AND p_next_status = 'READY' THEN
    allowed := true;
  ELSIF o.status = 'READY' AND p_next_status = 'COLLECTED' THEN
    allowed := true;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'invalid_transition';
  END IF;

  UPDATE public.orders AS ord
  SET status = p_next_status
  WHERE ord.id = p_order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_cancel_order_refund(
  p_order_id uuid,
  p_canteen_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
BEGIN
  SELECT *
  INTO o
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF o.canteen_id IS DISTINCT FROM p_canteen_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF o.status <> 'PENDING' THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF o.payment_method = 'wallet' AND o.payment_status = 'paid' THEN
    UPDATE public.profiles AS p
    SET wallet_balance = p.wallet_balance + o.total_amount
    WHERE p.id = o.student_id;

    INSERT INTO public.wallet_transactions (
      profile_id,
      institution_id,
      amount,
      type,
      reference_id,
      description
    )
    VALUES (
      o.student_id,
      o.institution_id,
      o.total_amount,
      'refund',
      o.id::text,
      'Refund — order rejected by canteen'
    );
  END IF;

  UPDATE public.orders AS ord
  SET
    status = 'CANCELLED',
    payment_status = CASE
      WHEN o.payment_method = 'wallet' AND o.payment_status = 'paid' THEN 'refunded'::text
      ELSE o.payment_status
    END,
    cancellation_reason = coalesce(ord.cancellation_reason, 'Rejected by canteen')
  WHERE ord.id = p_order_id;

  RETURN jsonb_build_object('order_id', o.id, 'status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_transition_order_status(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_transition_order_status(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.staff_cancel_order_refund(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_order_refund(uuid, uuid) TO service_role;


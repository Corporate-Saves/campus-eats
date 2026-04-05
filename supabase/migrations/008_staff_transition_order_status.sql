-- Staff order status transitions (non-cancel): single transaction with row lock, validation, and notification.
-- CANCELLED / reject remains staff_cancel_order_refund.
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

  -- Must match API ALLOWED_NEXT for non-cancel transitions (validated under row lock).
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

  IF p_next_status = 'ACCEPTED' THEN
    INSERT INTO public.notifications (
      profile_id,
      title,
      body,
      type,
      metadata
    )
    VALUES (
      o.student_id,
      'Order accepted',
      'The canteen has accepted your order.',
      'order_update',
      jsonb_build_object('order_id', o.id, 'status', p_next_status)
    );
  ELSIF p_next_status = 'PREPARING' THEN
    INSERT INTO public.notifications (
      profile_id,
      title,
      body,
      type,
      metadata
    )
    VALUES (
      o.student_id,
      'Being prepared',
      'Your order is now being prepared.',
      'order_update',
      jsonb_build_object('order_id', o.id, 'status', p_next_status)
    );
  ELSIF p_next_status = 'READY' THEN
    INSERT INTO public.notifications (
      profile_id,
      title,
      body,
      type,
      metadata
    )
    VALUES (
      o.student_id,
      'Ready for pickup',
      'Your order is ready — please collect it at the counter.',
      'order_update',
      jsonb_build_object('order_id', o.id, 'status', p_next_status)
    );
  ELSIF p_next_status = 'COLLECTED' THEN
    INSERT INTO public.notifications (
      profile_id,
      title,
      body,
      type,
      metadata
    )
    VALUES (
      o.student_id,
      'Order collected',
      'Your pickup has been marked complete. Enjoy!',
      'order_update',
      jsonb_build_object('order_id', o.id, 'status', p_next_status)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_transition_order_status(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_transition_order_status(uuid, uuid, text) TO service_role;

-- Staff rejection: cancel PENDING order, refund wallet, notify student (service_role / API only)
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

  INSERT INTO public.notifications (
    profile_id,
    title,
    body,
    type,
    metadata
  )
  VALUES (
    o.student_id,
    'Order cancelled',
    'Your order was not accepted. Any payment has been refunded to your wallet.',
    'order_update',
    jsonb_build_object('order_id', o.id, 'status', 'CANCELLED')
  );

  RETURN jsonb_build_object('order_id', o.id, 'status', 'CANCELLED');
END;
$$;

REVOKE ALL ON FUNCTION public.staff_cancel_order_refund(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_cancel_order_refund(uuid, uuid) TO service_role;

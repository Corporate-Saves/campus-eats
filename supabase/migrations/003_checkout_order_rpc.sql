-- Slot fill counts for checkout (students cannot see other orders under RLS).
CREATE OR REPLACE FUNCTION public.get_slot_order_counts(
  p_canteen_id uuid,
  p_scheduled_for date
)
RETURNS TABLE (time_slot_id uuid, order_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.canteen_in_my_institution(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT o.time_slot_id, count(*)::bigint
  FROM public.orders o
  WHERE o.canteen_id = p_canteen_id
    AND o.scheduled_for = p_scheduled_for
    AND o.time_slot_id IS NOT NULL
    AND o.status <> 'CANCELLED'
  GROUP BY o.time_slot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_slot_order_counts(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slot_order_counts(uuid, date) TO authenticated;

-- Atomic student checkout: order + items + wallet debit + ledger row.
-- Callable only by service_role (Next.js API after session verification).
CREATE OR REPLACE FUNCTION public.create_student_order(
  p_student_id uuid,
  p_canteen_id uuid,
  p_institution_id uuid,
  p_time_slot_id uuid,
  p_special_instructions text,
  p_scheduled_for date,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_wallet numeric;
  v_inst uuid;
  v_order_id uuid;
  v_token int;
  v_total numeric := 0;
  elem jsonb;
  mi public.menu_items%ROWTYPE;
  qty int;
  sold_today numeric;
  v_slot_max int;
  v_slot_count bigint;
  v_line_total numeric;
  v_updated int;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  SELECT p.role, p.institution_id, p.wallet_balance
  INTO v_role, v_inst, v_wallet
  FROM public.profiles AS p
  WHERE p.id = p_student_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF v_role <> 'student' THEN
    RAISE EXCEPTION 'not_student';
  END IF;

  IF v_inst IS DISTINCT FROM p_institution_id THEN
    RAISE EXCEPTION 'institution_mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.canteens AS c
    WHERE c.id = p_canteen_id
      AND c.institution_id = p_institution_id
  ) THEN
    RAISE EXCEPTION 'invalid_canteen';
  END IF;

  IF p_time_slot_id IS NOT NULL THEN
    SELECT ts.max_orders
    INTO v_slot_max
    FROM public.time_slots AS ts
    WHERE ts.id = p_time_slot_id
      AND ts.canteen_id = p_canteen_id
      AND ts.is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'invalid_slot';
    END IF;

    SELECT count(*)::bigint
    INTO v_slot_count
    FROM public.orders AS o
    WHERE o.canteen_id = p_canteen_id
      AND o.scheduled_for = p_scheduled_for
      AND o.time_slot_id = p_time_slot_id
      AND o.status <> 'CANCELLED';

    IF v_slot_count >= v_slot_max THEN
      RAISE EXCEPTION 'slot_full';
    END IF;
  END IF;

  FOR elem IN SELECT j FROM jsonb_array_elements(p_items) AS t(j)
  LOOP
    qty := (elem->>'quantity')::int;
    IF qty IS NULL OR qty < 1 THEN
      RAISE EXCEPTION 'bad_quantity';
    END IF;

    SELECT *
    INTO mi
    FROM public.menu_items AS m
    WHERE m.id = (elem->>'menu_item_id')::uuid
      AND m.canteen_id = p_canteen_id
      AND m.is_available = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'item_unavailable';
    END IF;

    IF mi.max_daily_quantity IS NOT NULL THEN
      IF mi.prepared_quantity >= mi.max_daily_quantity THEN
        RAISE EXCEPTION 'item_sold_out';
      END IF;

      SELECT coalesce(sum(oi.quantity), 0)
      INTO sold_today
      FROM public.order_items AS oi
      INNER JOIN public.orders AS o ON o.id = oi.order_id
      WHERE oi.menu_item_id = mi.id
        AND o.scheduled_for = p_scheduled_for
        AND o.status <> 'CANCELLED';

      IF sold_today + qty > mi.max_daily_quantity THEN
        RAISE EXCEPTION 'item_daily_cap';
      END IF;
    END IF;

    v_line_total := mi.price * qty;
    v_total := v_total + v_line_total;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'empty_cart';
  END IF;

  IF v_wallet < v_total THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  SELECT coalesce(max(o.token_number), 0) + 1
  INTO v_token
  FROM public.orders AS o
  WHERE o.canteen_id = p_canteen_id
    AND o.scheduled_for = p_scheduled_for;

  INSERT INTO public.orders (
    institution_id,
    canteen_id,
    student_id,
    time_slot_id,
    token_number,
    status,
    total_amount,
    payment_method,
    payment_status,
    special_instructions,
    scheduled_for
  )
  VALUES (
    p_institution_id,
    p_canteen_id,
    p_student_id,
    p_time_slot_id,
    v_token,
    'PENDING',
    v_total,
    'wallet',
    'paid',
    nullif(trim(coalesce(p_special_instructions, '')), ''),
    p_scheduled_for
  )
  RETURNING id INTO v_order_id;

  FOR elem IN SELECT j FROM jsonb_array_elements(p_items) AS t(j)
  LOOP
    qty := (elem->>'quantity')::int;
    SELECT *
    INTO mi
    FROM public.menu_items AS m
    WHERE m.id = (elem->>'menu_item_id')::uuid
      AND m.canteen_id = p_canteen_id;

    INSERT INTO public.order_items (
      order_id,
      menu_item_id,
      quantity,
      unit_price,
      subtotal
    )
    VALUES (
      v_order_id,
      mi.id,
      qty,
      mi.price,
      mi.price * qty
    );
  END LOOP;

  UPDATE public.profiles AS p
  SET wallet_balance = p.wallet_balance - v_total
  WHERE p.id = p_student_id
    AND p.wallet_balance >= v_total;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'wallet_update_failed';
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
    p_student_id,
    p_institution_id,
    -v_total,
    'order_payment',
    v_order_id::text,
    'Wallet payment for order'
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'token_number', v_token,
    'total_amount', v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_student_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_student_order(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  jsonb
) TO service_role;

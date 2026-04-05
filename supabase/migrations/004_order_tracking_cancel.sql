-- Status timestamps for student tracking + cancellation metadata
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparing_at timestamptz,
  ADD COLUMN IF NOT EXISTS ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

COMMENT ON COLUMN public.orders.cancellation_reason IS
  'Set when order is cancelled (student or staff).';

-- When status changes, stamp the corresponding time (staff dashboard updates, etc.)
CREATE OR REPLACE FUNCTION public.orders_status_timestamp_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status = 'ACCEPTED' AND NEW.accepted_at IS NULL THEN
    NEW.accepted_at := now();
  END IF;
  IF NEW.status = 'PREPARING' AND NEW.preparing_at IS NULL THEN
    NEW.preparing_at := now();
  END IF;
  IF NEW.status = 'READY' AND NEW.ready_at IS NULL THEN
    NEW.ready_at := now();
  END IF;
  IF NEW.status = 'COLLECTED' AND NEW.collected_at IS NULL THEN
    NEW.collected_at := now();
  END IF;
  IF NEW.status = 'CANCELLED' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_timestamp_trg ON public.orders;
CREATE TRIGGER orders_status_timestamp_trg
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.orders_status_timestamp_fn();

-- Student cancel: wallet refund + status (service_role only; API verifies session)
CREATE OR REPLACE FUNCTION public.cancel_student_order(
  p_order_id uuid,
  p_student_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders%ROWTYPE;
  slot_start timestamptz;
  cutoff timestamptz;
  st time;
  v_reason text;
BEGIN
  SELECT *
  INTO o
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found';
  END IF;

  IF o.student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF o.status NOT IN ('PENDING', 'ACCEPTED') THEN
    RAISE EXCEPTION 'not_cancellable';
  END IF;

  IF o.time_slot_id IS NOT NULL AND o.scheduled_for IS NOT NULL THEN
    SELECT ts.start_time
    INTO st
    FROM public.time_slots AS ts
    WHERE ts.id = o.time_slot_id;

    IF FOUND AND st IS NOT NULL THEN
      slot_start := (o.scheduled_for + st) AT TIME ZONE 'UTC';
      cutoff := slot_start - interval '30 minutes';
      IF now() >= cutoff THEN
        RAISE EXCEPTION 'cancellation_window_closed';
      END IF;
    END IF;
  END IF;

  v_reason := coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Cancelled by student');

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
    'Refund for cancelled order'
  );

  UPDATE public.orders AS ord
  SET
    status = 'CANCELLED',
    payment_status = 'refunded',
    cancellation_reason = v_reason
  WHERE ord.id = p_order_id;

  RETURN jsonb_build_object(
    'order_id', o.id,
    'status', 'CANCELLED',
    'refunded_amount', o.total_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_student_order(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_student_order(uuid, uuid, text) TO service_role;

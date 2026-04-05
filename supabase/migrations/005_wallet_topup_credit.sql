-- Atomic, idempotent wallet top-up credit for Razorpay verify (service_role only).
CREATE OR REPLACE FUNCTION public.credit_wallet_topup(
  p_profile_id uuid,
  p_institution_id uuid,
  p_amount numeric,
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
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_reference_id IS NULL OR length(trim(p_reference_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_reference';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_reference_id));

  IF EXISTS (
    SELECT 1
    FROM public.wallet_transactions AS wt
    WHERE wt.profile_id = p_profile_id
      AND wt.reference_id = p_reference_id
      AND wt.type = 'topup'
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.profiles AS p
  SET wallet_balance = p.wallet_balance + p_amount
  WHERE p.id = p_profile_id
    AND p.institution_id = p_institution_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'profile_update_failed';
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
    p_amount,
    'topup',
    p_reference_id,
    p_description
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_wallet_topup(uuid, uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_wallet_topup(uuid, uuid, numeric, text, text) TO service_role;

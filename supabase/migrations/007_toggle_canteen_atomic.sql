-- Atomic open/close flip for canteen (avoids read-modify-write races; API-only via service_role)
CREATE OR REPLACE FUNCTION public.toggle_canteen_is_open(p_canteen_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open boolean;
BEGIN
  UPDATE public.canteens
  SET is_open = NOT is_open
  WHERE id = p_canteen_id
  RETURNING is_open INTO v_open;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'canteen_not_found';
  END IF;

  RETURN v_open;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_canteen_is_open(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_canteen_is_open(uuid) TO service_role;

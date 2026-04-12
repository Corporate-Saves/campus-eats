-- Owner analytics RPCs (numbered 010 because 002+ already exist in this repo).
-- Auth: super_admin (any canteen), institution_admin (tenant), canteen_owner (own canteen).
-- Students cannot use these.

CREATE OR REPLACE FUNCTION public.can_view_canteen_analytics(p_canteen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN public.is_super_admin() THEN EXISTS (
        SELECT 1 FROM public.canteens c WHERE c.id = p_canteen_id
      )
      WHEN public.is_institution_admin() AND public.canteen_in_my_institution(p_canteen_id)
        THEN true
      WHEN public.is_canteen_owner() AND p_canteen_id IS NOT DISTINCT FROM public.get_my_canteen_id()
        THEN true
      ELSE false
    END;
$$;

REVOKE ALL ON FUNCTION public.can_view_canteen_analytics(uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Daily revenue and order counts (UTC calendar day of order creation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_revenue_by_day(
  p_canteen_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (day date, revenue numeric, order_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = '22000';
  END IF;

  RETURN QUERY
  SELECT
    (timezone('UTC', o.created_at))::date AS d,
    COALESCE(sum(o.total_amount), 0)::numeric AS rev,
    count(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.canteen_id = p_canteen_id
    AND o.status <> 'CANCELLED'
    AND (timezone('UTC', o.created_at))::date >= p_start_date
    AND (timezone('UTC', o.created_at))::date <= p_end_date
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_revenue_by_day(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_revenue_by_day(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Top selling items by quantity
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_top_items(
  p_canteen_id uuid,
  p_start_date date,
  p_end_date date,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  menu_item_id uuid,
  item_name text,
  quantity_sold bigint,
  revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer;
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = '22000';
  END IF;

  lim := p_limit;
  IF lim IS NULL OR lim < 1 OR lim > 100 THEN
    lim := 5;
  END IF;

  RETURN QUERY
  SELECT
    mi.id AS mid,
    mi.name AS iname,
    sum(oi.quantity)::bigint AS qty,
    sum(oi.subtotal)::numeric AS rev
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  INNER JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.canteen_id = p_canteen_id
    AND o.status <> 'CANCELLED'
    AND (timezone('UTC', o.created_at))::date >= p_start_date
    AND (timezone('UTC', o.created_at))::date <= p_end_date
  GROUP BY mi.id, mi.name
  ORDER BY qty DESC, iname ASC
  LIMIT lim;
END;
$$;

REVOKE ALL ON FUNCTION public.get_top_items(uuid, date, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_items(uuid, date, date, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- Order counts by status for one UTC day
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_orders_by_status(
  p_canteen_id uuid,
  p_date date
)
RETURNS TABLE (status text, count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT o.status, count(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.canteen_id = p_canteen_id
    AND (timezone('UTC', o.created_at))::date = p_date
  GROUP BY o.status
  ORDER BY o.status;
END;
$$;

REVOKE ALL ON FUNCTION public.get_orders_by_status(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_orders_by_status(uuid, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Orders per hour of day (UTC), aggregated across date range
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hourly_distribution(
  p_canteen_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (hour integer, order_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = '22000';
  END IF;

  RETURN QUERY
  SELECT
    extract(hour FROM timezone('UTC', o.created_at))::integer AS hr,
    count(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.canteen_id = p_canteen_id
    AND o.status <> 'CANCELLED'
    AND (timezone('UTC', o.created_at))::date >= p_start_date
    AND (timezone('UTC', o.created_at))::date <= p_end_date
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hourly_distribution(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hourly_distribution(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Heatmap: UTC weekday (0 = Sunday .. 6 = Saturday) × hour → order count
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hourly_weekday_distribution(
  p_canteen_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (dow integer, hour integer, order_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = '22000';
  END IF;

  RETURN QUERY
  SELECT
    extract(dow FROM timezone('UTC', o.created_at))::integer AS d,
    extract(hour FROM timezone('UTC', o.created_at))::integer AS h,
    count(*)::bigint AS cnt
  FROM public.orders o
  WHERE o.canteen_id = p_canteen_id
    AND o.status <> 'CANCELLED'
    AND (timezone('UTC', o.created_at))::date >= p_start_date
    AND (timezone('UTC', o.created_at))::date <= p_end_date
  GROUP BY 1, 2
  ORDER BY 1, 2;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hourly_weekday_distribution(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_hourly_weekday_distribution(uuid, date, date) TO authenticated;

-- ---------------------------------------------------------------------------
-- Per-day item quantities for prep forecast (client aggregates same-weekday)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_item_sales(
  p_canteen_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  sale_date date,
  menu_item_id uuid,
  item_name text,
  quantity_sold bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_view_canteen_analytics(p_canteen_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_start_date > p_end_date THEN
    RAISE EXCEPTION 'invalid_range' USING ERRCODE = '22000';
  END IF;

  RETURN QUERY
  SELECT
    (timezone('UTC', o.created_at))::date AS sd,
    mi.id AS mid,
    mi.name AS iname,
    sum(oi.quantity)::bigint AS qty
  FROM public.order_items oi
  INNER JOIN public.orders o ON o.id = oi.order_id
  INNER JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE o.canteen_id = p_canteen_id
    AND o.status <> 'CANCELLED'
    AND (timezone('UTC', o.created_at))::date >= p_start_date
    AND (timezone('UTC', o.created_at))::date <= p_end_date
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 3 ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_item_sales(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_daily_item_sales(uuid, date, date) TO authenticated;

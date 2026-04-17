-- Public TV token board: anonymous read for enabled canteens (RLS still scopes rows by policy below).
ALTER TABLE public.canteens
  ADD COLUMN IF NOT EXISTS allow_tv_display boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.canteens.allow_tv_display IS
  'When true, anon clients may read this canteen name and today PREPARING/READY orders for /display/[canteenId].';

-- Today = UTC calendar date match on scheduled_for or created_at when walk-in (scheduled_for null).
CREATE POLICY orders_select_anon_tv ON public.orders
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.canteens c
      WHERE c.id = orders.canteen_id
        AND c.allow_tv_display = true
    )
    AND status IN ('PREPARING', 'READY')
    AND (
      (
        orders.scheduled_for IS NOT NULL
        AND orders.scheduled_for = (timezone('UTC', now()))::date
      )
      OR (
        orders.scheduled_for IS NULL
        AND (timezone('UTC', orders.created_at))::date = (timezone('UTC', now()))::date
      )
    )
  );

CREATE POLICY canteens_select_anon_tv ON public.canteens
  FOR SELECT TO anon
  USING (allow_tv_display = true);

-- Include old row values in Realtime UPDATE payloads (fly / fade transitions).
ALTER TABLE public.orders REPLICA IDENTITY FULL;

-- Realtime: token board subscribes to order changes for this canteen.
DO $body$
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
END $body$;

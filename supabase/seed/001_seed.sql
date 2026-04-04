-- 001_seed.sql — demo institution, canteen, menu, and lunch slots
-- Run as postgres / service role (bypasses RLS). Safe to re-run if you truncate first.

BEGIN;

INSERT INTO public.institutions (name, slug, domain_whitelist, primary_color)
VALUES (
  'Demo College',
  'demo-college',
  ARRAY['demo.edu']::text[],
  '#FF6B35'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.canteens (
  institution_id,
  name,
  description,
  is_open,
  opening_time,
  closing_time,
  created_at
)
SELECT
  i.id,
  'Main Canteen',
  'Central campus canteen',
  true,
  time '08:00',
  time '22:00',
  now()
FROM public.institutions i
WHERE i.slug = 'demo-college'
  AND NOT EXISTS (
    SELECT 1
    FROM public.canteens c
    WHERE c.institution_id = i.id
      AND c.name = 'Main Canteen'
  );

INSERT INTO public.menu_categories (canteen_id, name, sort_order)
SELECT c.id, v.name, v.sort_order
FROM public.canteens c
JOIN public.institutions i ON i.id = c.institution_id
CROSS JOIN (
  VALUES
    ('Meals', 0),
    ('Snacks', 1),
    ('Beverages', 2)
) AS v(name, sort_order)
WHERE i.slug = 'demo-college'
  AND c.name = 'Main Canteen'
  AND NOT EXISTS (
    SELECT 1
    FROM public.menu_categories mc
    WHERE mc.canteen_id = c.id
      AND mc.name = v.name
  );

-- 8 menu items (Indian canteen–style, INR)
INSERT INTO public.menu_items (
  canteen_id,
  category_id,
  name,
  description,
  price,
  is_veg,
  tags,
  created_at
)
SELECT
  c.id,
  mc.id,
  v.name,
  v.description,
  v.price,
  v.is_veg,
  v.tags,
  now()
FROM public.canteens c
JOIN public.institutions i ON i.id = c.institution_id
CROSS JOIN (
  VALUES
    (
      'Meals',
      'Veg Thali',
      'Dal, sabzi, rice, roti, salad, and pickle',
      80.00::numeric,
      true,
      ARRAY['bestseller', 'meal']::text[]
    ),
    (
      'Meals',
      'Chicken Biryani',
      'Hyderabadi-style biryani with raita',
      120.00::numeric,
      false,
      ARRAY['bestseller', 'spicy']::text[]
    ),
    (
      'Meals',
      'Dal Rice',
      'Yellow dal tadka with steamed rice',
      50.00::numeric,
      true,
      ARRAY['comfort']::text[]
    ),
    (
      'Meals',
      'Masala Dosa',
      'Crispy dosa with potato masala, sambar, chutney',
      60.00::numeric,
      true,
      ARRAY['south indian']::text[]
    ),
    (
      'Snacks',
      'Samosa (2 pcs)',
      'Crisp potato and pea samosas with chutney',
      20.00::numeric,
      true,
      ARRAY['snack', 'fried']::text[]
    ),
    (
      'Snacks',
      'Veg Puff',
      'Bakery-style puff with spiced vegetables',
      25.00::numeric,
      true,
      ARRAY['snack']::text[]
    ),
    (
      'Beverages',
      'Masala Chai',
      'Kadak masala tea',
      15.00::numeric,
      true,
      ARRAY['hot', 'bestseller']::text[]
    ),
    (
      'Beverages',
      'Cold Coffee',
      'Chilled coffee with milk',
      40.00::numeric,
      true,
      ARRAY['cold']::text[]
    )
) AS v(cat, name, description, price, is_veg, tags)
JOIN public.menu_categories mc ON mc.canteen_id = c.id AND mc.name = v.cat
WHERE i.slug = 'demo-college'
  AND c.name = 'Main Canteen'
  AND NOT EXISTS (
    SELECT 1
    FROM public.menu_items mi
    WHERE mi.canteen_id = c.id
      AND mi.name = v.name
  );

-- Lunch slots: 12:00–13:00 in 15-minute windows
INSERT INTO public.time_slots (
  canteen_id,
  label,
  start_time,
  end_time,
  max_orders,
  is_active
)
SELECT
  c.id,
  v.label,
  v.start_time,
  v.end_time,
  20,
  true
FROM public.canteens c
JOIN public.institutions i ON i.id = c.institution_id
CROSS JOIN (
  VALUES
    ('12:00 PM - 12:15 PM', time '12:00', time '12:15'),
    ('12:15 PM - 12:30 PM', time '12:15', time '12:30'),
    ('12:30 PM - 12:45 PM', time '12:30', time '12:45'),
    ('12:45 PM - 1:00 PM', time '12:45', time '13:00')
) AS v(label, start_time, end_time)
WHERE i.slug = 'demo-college'
  AND c.name = 'Main Canteen'
  AND NOT EXISTS (
    SELECT 1
    FROM public.time_slots ts
    WHERE ts.canteen_id = c.id
      AND ts.start_time = v.start_time
      AND ts.end_time = v.end_time
  );

COMMIT;

# 🍱 CampusEats — Agent Implementation Playbook
**Stack:** Next.js 15 · Supabase · Vercel · Razorpay · Tailwind CSS · Capacitor  
**Method:** Run each prompt inside Cursor Agent / Claude / Copilot Workspace

---

> **How to use this document**
> - Work top to bottom. Each section depends on the previous one.
> - Each task has a **🤖 Agent Prompt** — paste it directly into your AI coding agent.
> - Subtasks inside a section can be parallelized if you have multiple agent windows open.
> - All prompts assume the agent has access to your full project repo.

---

# SECTION 1 — Project Scaffold & Monorepo Setup

## Task 1.1 — Initialize Next.js Project

**🤖 Agent Prompt:**
```
Create a new Next.js 15 project called "campus-eats" using the App Router. Use TypeScript, Tailwind CSS, and the src/ directory structure. Set up the following folder structure inside src/app:

- (auth)/login/page.tsx
- (auth)/register/page.tsx
- (student)/dashboard/page.tsx
- (student)/menu/page.tsx
- (student)/orders/page.tsx
- (student)/wallet/page.tsx
- (staff)/queue/page.tsx
- (owner)/menu/page.tsx
- (owner)/analytics/page.tsx
- (admin)/tenants/page.tsx
- (admin)/institutions/page.tsx
- api/ (for all API routes)

Also create the following config files:
- .env.local with placeholder keys for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, NEXT_PUBLIC_APP_URL
- tailwind.config.ts with a custom color palette: primary (#FF6B35), background (#FAFAF8), surface (#FFFFFF), text (#1A1A1A), muted (#6B7280)

Use the Next.js 15 app router conventions throughout. Do not use the pages/ router.
```

---

## Task 1.2 — Install & Configure Dependencies

**🤖 Agent Prompt:**
```
In the campus-eats Next.js project, install and configure the following dependencies:

npm packages to install:
- @supabase/supabase-js @supabase/ssr
- @tanstack/react-query
- zustand
- razorpay (server-side)
- react-hot-toast
- lucide-react
- date-fns
- zod
- react-hook-form @hookform/resolvers
- clsx tailwind-merge
- @capacitor/core @capacitor/cli (dev dependency)

After installing:
1. Create src/lib/supabase/client.ts — browser Supabase client using createBrowserClient from @supabase/ssr
2. Create src/lib/supabase/server.ts — server Supabase client using createServerClient from @supabase/ssr with cookie handling for Next.js App Router
3. Create src/lib/utils.ts — export a cn() utility using clsx + tailwind-merge
4. Create src/lib/constants.ts — export ORDER_STATUS enum (PENDING, ACCEPTED, PREPARING, READY, COLLECTED, CANCELLED), USER_ROLES enum (SUPER_ADMIN, INSTITUTION_ADMIN, CANTEEN_OWNER, CANTEEN_STAFF, STUDENT)
5. Set up TanStack Query provider in src/app/providers.tsx and wrap it in src/app/layout.tsx

Show the full file contents for each file created.
```

---

## Task 1.3 — Supabase Project & Database Schema

**🤖 Agent Prompt:**
```
Write a complete Supabase SQL migration file (001_initial_schema.sql) that creates the following tables with all constraints, indexes, and Row Level Security policies for a multi-tenant canteen management app.

Tables to create:

1. institutions
   - id (uuid, primary key, default gen_random_uuid())
   - name (text, not null)
   - slug (text, unique, not null) — used as tenant identifier
   - logo_url (text)
   - primary_color (text, default '#FF6B35')
   - domain_whitelist (text[]) — allowed email domains
   - is_active (boolean, default true)
   - created_at (timestamptz, default now())

2. profiles (extends Supabase auth.users)
   - id (uuid, primary key, references auth.users)
   - institution_id (uuid, references institutions)
   - full_name (text)
   - role (text) — values: super_admin, institution_admin, canteen_owner, canteen_staff, student
   - student_id (text) — college roll number
   - wallet_balance (numeric, default 0)
   - fcm_token (text)
   - created_at (timestamptz, default now())

3. canteens
   - id (uuid, primary key)
   - institution_id (uuid, references institutions, not null)
   - name (text, not null)
   - description (text)
   - image_url (text)
   - is_open (boolean, default true)
   - opening_time (time)
   - closing_time (time)
   - created_at (timestamptz)

4. menu_categories
   - id (uuid, primary key)
   - canteen_id (uuid, references canteens)
   - name (text, not null)
   - sort_order (int, default 0)

5. menu_items
   - id (uuid, primary key)
   - canteen_id (uuid, references canteens)
   - category_id (uuid, references menu_categories)
   - name (text, not null)
   - description (text)
   - price (numeric, not null)
   - image_url (text)
   - is_available (boolean, default true)
   - is_veg (boolean, default true)
   - max_daily_quantity (int) — null means unlimited
   - prepared_quantity (int, default 0) — how many made today
   - tags (text[]) — e.g. ['spicy', 'bestseller']
   - created_at (timestamptz)

6. time_slots
   - id (uuid, primary key)
   - canteen_id (uuid, references canteens)
   - label (text) — e.g. "1:00 PM - 1:15 PM"
   - start_time (time)
   - end_time (time)
   - max_orders (int, default 20)
   - is_active (boolean, default true)

7. orders
   - id (uuid, primary key)
   - institution_id (uuid, references institutions)
   - canteen_id (uuid, references canteens)
   - student_id (uuid, references profiles)
   - time_slot_id (uuid, references time_slots, nullable — null means walk-in)
   - token_number (int)
   - status (text) — PENDING, ACCEPTED, PREPARING, READY, COLLECTED, CANCELLED
   - total_amount (numeric)
   - payment_method (text) — wallet, upi, cash
   - payment_status (text) — paid, pending, refunded
   - special_instructions (text)
   - scheduled_for (date)
   - created_at (timestamptz)

8. order_items
   - id (uuid, primary key)
   - order_id (uuid, references orders)
   - menu_item_id (uuid, references menu_items)
   - quantity (int)
   - unit_price (numeric)
   - subtotal (numeric)

9. wallet_transactions
   - id (uuid, primary key)
   - profile_id (uuid, references profiles)
   - institution_id (uuid, references institutions)
   - amount (numeric) — positive for credit, negative for debit
   - type (text) — topup, order_payment, refund
   - reference_id (text) — razorpay payment id or order id
   - description (text)
   - created_at (timestamptz)

10. notifications
    - id (uuid, primary key)
    - profile_id (uuid, references profiles)
    - title (text)
    - body (text)
    - type (text) — order_update, promo, system
    - is_read (boolean, default false)
    - metadata (jsonb)
    - created_at (timestamptz)

RLS Policies to implement:
- Students can only SELECT their own profile, orders, wallet_transactions, notifications
- Students can only SELECT menu items, canteens, time_slots from their own institution_id
- Canteen staff can SELECT and UPDATE orders for their canteen only
- Canteen owners can do full CRUD on menu_items, menu_categories, time_slots for their canteen only
- Institution admins can manage all records within their institution_id
- Super admins bypass all RLS
- Use auth.uid() and a helper function get_my_institution_id() that returns the institution_id from the profiles table for the current user

Also write a seed file (001_seed.sql) that creates:
- 1 institution: name "Demo College", slug "demo-college", domain_whitelist ["demo.edu"]
- 1 canteen: "Main Canteen"
- 3 menu categories: Meals, Snacks, Beverages
- 8 menu items across those categories with realistic Indian canteen prices
- 4 time slots from 12:00 PM to 1:00 PM in 15-min intervals
```

---

# SECTION 2 — Authentication & Multi-Tenancy

## Task 2.1 — Auth Flow (Login / Register)

**🤖 Agent Prompt:**
```
Build the full authentication flow for campus-eats using Supabase Auth and Next.js 15 App Router.

Create the following:

1. src/app/(auth)/layout.tsx
   - Centered card layout, show the CampusEats logo and tagline "Order smart. Eat fast."

2. src/app/(auth)/login/page.tsx
   - Email + password form using react-hook-form + zod validation
   - On submit: call Supabase signInWithPassword
   - After login, fetch the user's profile row to get their role
   - Redirect based on role:
     - student → /student/dashboard
     - canteen_staff → /staff/queue
     - canteen_owner → /owner/menu
     - institution_admin → /admin/institutions
     - super_admin → /admin/tenants
   - Show error toast on invalid credentials
   - Link to /register

3. src/app/(auth)/register/page.tsx
   - Fields: Full Name, Institution Code (maps to institution slug), Student ID, Email, Password, Confirm Password
   - On submit:
     a. Validate the institution slug exists and email domain matches the institution's domain_whitelist
     b. Call Supabase signUp
     c. Insert a row into profiles with role = 'student'
   - Show success message: "Check your email to confirm your account"

4. src/middleware.ts
   - Protect all routes under /student/*, /staff/*, /owner/*, /admin/*
   - If no session, redirect to /login
   - If session exists but wrong role tries to access a route, redirect to their correct dashboard
   - Use Supabase SSR session refresh pattern

5. src/hooks/useProfile.ts
   - Custom hook that fetches the current user's profile from Supabase
   - Cache using TanStack Query with key ['profile']
   - Return: profile, isLoading, error

Show full code for all files.
```

---

## Task 2.2 — Tenant Context & Institution Branding

**🤖 Agent Prompt:**
```
Implement multi-tenancy context in campus-eats so that every part of the UI and API is scoped to the user's institution.

1. Create src/context/TenantContext.tsx
   - On app load, after auth, fetch the institution record for the logged-in user using their institution_id from their profile
   - Store: institution name, slug, logo_url, primary_color in context
   - Export useTenant() hook

2. Create src/components/TenantProvider.tsx
   - Wrap the app and inject the institution's primary_color as a CSS variable (--color-primary) into the document root dynamically
   - This allows each institution to have its own branded color throughout the UI

3. Update src/app/(student)/layout.tsx
   - Show a top navbar with:
     - Institution logo (from TenantContext)
     - Student's name
     - Wallet balance (from profile)
     - Notification bell icon with unread count
   - Bottom tab navigation: Home, Menu, Orders, Wallet

4. Create src/app/api/tenant/route.ts
   - GET endpoint that accepts ?slug=demo-college
   - Returns the public institution info (name, logo, primary_color)
   - Used for the login page to show branding before the user logs in
   - No auth required — this is public info only

All API routes must extract institution_id from the authenticated user's JWT/session and never trust a client-supplied institution_id for data scoping.
```

---

# SECTION 3 — Student-Facing Features

## Task 3.1 — Menu Browsing

**🤖 Agent Prompt:**
```
Build the menu browsing screen for students in campus-eats.

1. src/app/(student)/menu/page.tsx (Server Component)
   - Fetch all menu_categories and menu_items for the student's institution's canteen using the Supabase server client
   - Only fetch items where is_available = true
   - Pass data to client components as props

2. src/components/student/MenuPage.tsx (Client Component)
   - Category tabs at the top (horizontal scrollable pill tabs)
   - Clicking a tab filters items to that category
   - Search bar to filter items by name (client-side filter)
   - Item cards showing: image, name, price, veg/non-veg badge (green dot for veg, red for non-veg), tags (bestseller chip)
   - "Add to Cart" button on each card
   - If max_daily_quantity is reached (prepared_quantity >= max_daily_quantity), show "Sold Out" badge and disable button

3. src/components/student/CartDrawer.tsx
   - Slide-in drawer from the bottom
   - Shows all cart items with quantity controls (+/-)
   - Shows subtotal
   - "Proceed to Order" button → navigates to /student/checkout
   - Persist cart in Zustand store (src/store/cartStore.ts)

4. src/store/cartStore.ts
   - Zustand store with: items (array of {menu_item_id, name, price, quantity}), addItem, removeItem, updateQuantity, clearCart, getTotal

5. src/components/student/ItemCard.tsx
   - Reusable card component
   - Prop types: id, name, description, price, image_url, is_veg, is_available, tags, max_daily_quantity, prepared_quantity
   - Animate "Add" button with a small bounce on click using CSS transition
```

---

## Task 3.2 — Checkout & Slot Selection

**🤖 Agent Prompt:**
```
Build the checkout flow for campus-eats students.

1. src/app/(student)/checkout/page.tsx
   - Display order summary (items + quantities + prices)
   - Show total amount
   - Time slot selector (fetch available time_slots for today's date from Supabase)
     - Show each slot as a selectable card with label and remaining capacity
     - If a slot is full (orders in that slot >= max_orders), show "Full" and disable it
     - Include a "ASAP / Walk-in" option that sets time_slot_id to null
   - Special instructions textarea (optional)
   - Payment method display: show current wallet balance
     - If wallet balance >= total: show "Pay ₹X from Wallet" button
     - If wallet balance < total: show "Insufficient balance — Top up Wallet" link
   - On confirm:
     a. Call POST /api/orders to create the order
     b. Deduct from wallet balance in the same transaction
     c. Clear cart
     d. Redirect to /student/orders/[orderId] (order tracking page)

2. src/app/api/orders/route.ts (POST)
   - Auth required
   - Validate: cart items exist, belong to student's institution, are still available
   - Calculate total server-side (never trust client total)
   - Check wallet balance >= total
   - In a Supabase transaction (use rpc):
     a. Generate token_number for the day (max token for that canteen today + 1)
     b. Insert into orders
     c. Insert into order_items for each cart item
     d. Deduct wallet_balance on profiles
     e. Insert wallet_transaction record (debit)
   - Return the created order with its token_number
   - Emit a Supabase realtime event so the staff dashboard updates instantly

3. src/components/student/SlotCard.tsx
   - Shows time label, capacity bar (e.g. "12 / 20 slots filled")
   - Selected state has a highlighted border using the institution's primary color
```

---

## Task 3.3 — Order Tracking

**🤖 Agent Prompt:**
```
Build the real-time order tracking screen for students in campus-eats.

1. src/app/(student)/orders/[orderId]/page.tsx
   - Server render initial order state
   - Pass to client component for real-time updates

2. src/components/student/OrderTracker.tsx (Client Component)
   - Subscribe to Supabase Realtime on the orders table, filtered by id = orderId
   - Show a visual step-by-step status tracker:
     PENDING → ACCEPTED → PREPARING → READY → COLLECTED
   - Each step has an icon, label, and timestamp when it was reached
   - When status = READY:
     - Show a large token number display (e.g. Token #42)
     - Show a green "Your order is ready! 🎉" banner
     - Trigger a browser notification if permission granted
   - When status = CANCELLED:
     - Show cancellation reason and refund confirmation
   - Show order summary (items ordered, total paid, payment method)
   - Show "Cancel Order" button only if status = PENDING (within cancellation window)

3. src/app/(student)/orders/page.tsx
   - List all past orders for the student
   - Each row: date, token number, total, status badge (color-coded), link to tracking page
   - Filter tabs: All, Active, Completed, Cancelled

4. src/app/api/orders/[orderId]/cancel/route.ts (POST)
   - Auth required — only the order's student can cancel
   - Check: order status must be PENDING or ACCEPTED
   - Check: if pre-order, must be > 30 mins before the slot time
   - Update order status to CANCELLED
   - Refund full amount to wallet_balance
   - Insert wallet_transaction record (credit, type = refund)
   - Return updated order
```

---

## Task 3.4 — Wallet & Top-Up

**🤖 Agent Prompt:**
```
Build the wallet screen and Razorpay top-up flow for campus-eats.

1. src/app/(student)/wallet/page.tsx
   - Show current wallet balance (large, prominent display)
   - Quick top-up buttons: ₹50, ₹100, ₹200, ₹500
   - Custom amount input
   - Transaction history list (fetch from wallet_transactions where profile_id = current user)
     - Each row: date, type icon (↑ topup, ↓ payment, ↩ refund), description, amount (green for credit, red for debit)

2. src/app/api/wallet/create-order/route.ts (POST)
   - Auth required
   - Accept: { amount } in rupees
   - Validate: amount between ₹10 and ₹5000
   - Create a Razorpay order using the Razorpay Node SDK:
     const razorpay = new Razorpay({ key_id, key_secret })
     const order = await razorpay.orders.create({ amount: amount * 100, currency: 'INR', receipt: `wallet_${userId}_${Date.now()}` })
   - Return: { razorpay_order_id, amount, key_id }

3. src/app/api/wallet/verify/route.ts (POST)
   - Accept: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount }
   - Verify the HMAC signature using crypto:
     const expectedSig = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(order_id + '|' + payment_id).digest('hex')
   - If valid:
     a. Update profiles.wallet_balance += amount
     b. Insert wallet_transaction (credit, type = topup)
   - Return success/failure

4. src/components/student/WalletTopUp.tsx (Client Component)
   - On clicking a top-up amount:
     a. Call /api/wallet/create-order
     b. Load Razorpay checkout script dynamically
     c. Open Razorpay modal with the order details
     d. On payment success callback, call /api/wallet/verify
     e. On verify success, show toast "₹X added to wallet!" and refetch wallet balance
   - Use the Razorpay web checkout (not redirect mode)
   - Load Razorpay script: https://checkout.razorpay.com/v1/checkout.js
```

---

# SECTION 4 — Canteen Staff Features

## Task 4.1 — Live Order Queue Dashboard

**🤖 Agent Prompt:**
```
Build the canteen staff order queue dashboard for campus-eats.

1. src/app/(staff)/queue/page.tsx
   - This is the primary screen for canteen staff (tablet-optimized, works on large screens)
   - Layout: 3 columns — "New Orders", "Preparing", "Ready for Pickup"

2. src/components/staff/OrderQueueBoard.tsx (Client Component)
   - Subscribe to Supabase Realtime on orders table, filtered by canteen_id and scheduled_for = today
   - Fetch all active orders on mount (status != COLLECTED and != CANCELLED)
   - Render orders as cards in the appropriate column based on status:
     - PENDING / ACCEPTED → "New Orders" column
     - PREPARING → "Preparing" column
     - READY → "Ready for Pickup" column
   - When a new order arrives via Realtime, animate it into the "New Orders" column with a slide-in + highlight effect
   - Play a soft notification sound when a new order arrives (use a short beep audio file)

3. src/components/staff/OrderCard.tsx
   - Shows: Token number (large), student name, items list with quantities, special instructions, time slot label, total amount, time since order placed
   - Action buttons based on current status:
     - PENDING: "Accept" (green) | "Reject" (red)
     - ACCEPTED: "Start Preparing" (orange)
     - PREPARING: "Mark Ready" (blue)
     - READY: "Mark Collected" (gray)
   - Button click calls PATCH /api/orders/[orderId]/status

4. src/app/api/orders/[orderId]/status/route.ts (PATCH)
   - Auth required, role must be canteen_staff or canteen_owner
   - Accept: { status } — validate it's a valid next status in the flow
   - Valid transitions: PENDING→ACCEPTED, PENDING→CANCELLED, ACCEPTED→PREPARING, PREPARING→READY, READY→COLLECTED
   - Update order status in DB
   - If status = CANCELLED by staff, refund to student wallet
   - Insert notification record for the student
   - Return updated order

5. src/components/staff/StaffHeader.tsx
   - Show canteen name, current time, open/close toggle for the canteen
   - Toggle calls PATCH /api/canteens/[canteenId]/toggle
```

---

## Task 4.2 — Item Availability Toggle

**🤖 Agent Prompt:**
```
Build the item availability management screen for canteen staff in campus-eats.

1. src/app/(staff)/availability/page.tsx
   - Show all menu items for the canteen grouped by category
   - Each item row shows: item name, price, a toggle switch for is_available, a counter input for max_daily_quantity and prepared_quantity

2. src/components/staff/AvailabilityToggle.tsx
   - Toggle switch component
   - On toggle: optimistically update the UI, then call PATCH /api/menu-items/[itemId] with { is_available }
   - On error: revert the toggle and show error toast

3. src/components/staff/QuantityCounter.tsx
   - Shows "X / Y prepared today" 
   - +/- buttons to increment/decrement prepared_quantity
   - Calls PATCH /api/menu-items/[itemId] with { prepared_quantity }
   - When prepared_quantity >= max_daily_quantity, auto-set is_available = false and show "Auto sold out" label

4. src/app/api/menu-items/[itemId]/route.ts (PATCH)
   - Auth required, role must be canteen_staff or canteen_owner
   - Validate the item belongs to the user's canteen
   - Update is_available and/or prepared_quantity
   - Return updated item
```

---

# SECTION 5 — Canteen Owner Features

## Task 5.1 — Menu Management

**🤖 Agent Prompt:**
```
Build the full menu management CRUD interface for canteen owners in campus-eats.

1. src/app/(owner)/menu/page.tsx
   - Split layout: left sidebar shows categories, right panel shows items in selected category
   - "Add Category" button opens a modal
   - "Add Item" button opens a full item form drawer

2. src/components/owner/MenuItemForm.tsx
   - Form fields: Name, Description, Category (dropdown), Price (number input), Is Veg (toggle), Max Daily Quantity (number, optional), Tags (multi-select: spicy, bestseller, new, healthy), Image Upload
   - Image upload: upload to Supabase Storage bucket 'menu-images', get public URL, store in menu_items.image_url
   - Form validation using zod + react-hook-form
   - On submit: POST /api/menu-items (create) or PATCH /api/menu-items/[id] (update)

3. src/app/api/menu-items/route.ts (GET, POST)
   - GET: fetch all items for the owner's canteen
   - POST: create new menu item, validate canteen ownership

4. src/app/api/menu-items/[itemId]/route.ts (PATCH, DELETE)
   - PATCH: update item fields
   - DELETE: soft delete (set is_available = false, add deleted_at timestamp)

5. src/components/owner/CategoryManager.tsx
   - List categories with drag-to-reorder (use @dnd-kit/sortable)
   - On reorder, update sort_order for each category via PATCH /api/categories/reorder
   - Inline rename on double-click
   - Delete category (only if no items exist in it)

6. src/app/api/categories/route.ts (GET, POST)
   src/app/api/categories/[id]/route.ts (PATCH, DELETE)
   src/app/api/categories/reorder/route.ts (POST)
   - Standard CRUD, scoped to canteen owner's canteen
```

---

## Task 5.2 — Time Slot Management

**🤖 Agent Prompt:**
```
Build the time slot configuration screen for canteen owners in campus-eats.

1. src/app/(owner)/slots/page.tsx
   - Visual timeline showing the day divided into slots
   - Each slot card shows: time range label, max_orders capacity, is_active toggle
   - "Add Slot" button opens a modal

2. src/components/owner/SlotForm.tsx
   - Fields: Start Time (time picker), End Time (time picker), Slot Label (auto-generated but editable), Max Orders (number)
   - Validate: end time must be after start time, no overlapping slots
   - POST /api/slots to create

3. src/app/api/slots/route.ts (GET, POST)
   src/app/api/slots/[slotId]/route.ts (PATCH, DELETE)
   - GET: fetch all slots for the canteen
   - POST: create slot, validate no overlap with existing slots
   - PATCH: update max_orders or is_active
   - DELETE: only if no future orders reference this slot

4. Also update the checkout page's slot selector (from Task 3.2) to show real-time capacity:
   - Fetch current order count per slot for today
   - Slot card shows a progress bar: orders_today / max_orders
```

---

## Task 5.3 — Owner Analytics Dashboard

**🤖 Agent Prompt:**
```
Build the analytics dashboard for canteen owners in campus-eats.

1. src/app/(owner)/analytics/page.tsx
   - Date range selector (Today, Last 7 days, Last 30 days, Custom)
   - Fetch aggregated data from Supabase using RPC functions

2. Supabase RPC functions to create (add to a new migration file 002_analytics_functions.sql):
   - get_revenue_by_day(canteen_id, start_date, end_date) → returns [{date, revenue, order_count}]
   - get_top_items(canteen_id, start_date, end_date, limit) → returns [{item_name, quantity_sold, revenue}]
   - get_orders_by_status(canteen_id, date) → returns [{status, count}]
   - get_hourly_distribution(canteen_id, start_date, end_date) → returns [{hour, order_count}]

3. src/components/owner/RevenueChart.tsx
   - Line chart using Recharts showing daily revenue
   - Show total revenue and total orders in summary cards above

4. src/components/owner/TopItemsChart.tsx
   - Horizontal bar chart of top 5 selling items by quantity

5. src/components/owner/OrderStatusPie.tsx
   - Pie chart of order statuses for today (how many completed vs cancelled)

6. src/components/owner/HourlyHeatmap.tsx
   - Simple heatmap grid (hours x days of week) showing order density
   - Darker color = more orders in that hour
   - Helps owner understand peak hours visually

7. src/components/owner/DemandForecast.tsx
   - Simple forecast card that shows suggested prep quantities for each menu item for tomorrow
   - Logic: average of last 7 same-weekdays for each item * 1.1 (10% buffer)
   - Calculated client-side from the top_items data
   - Show as a table: Item | Avg Sold | Suggested Prep Qty
```

---

# SECTION 6 — Institution Admin Features

## Task 6.1 — Institution Admin Panel

**🤖 Agent Prompt:**
```
Build the institution admin panel for campus-eats.

1. src/app/(admin)/institutions/page.tsx
   - Overview cards: Total Students, Active Orders Today, Total Revenue This Month, Number of Canteens
   - Student management table (paginated, 20 per page):
     - Columns: Name, Student ID, Email, Wallet Balance, Last Active, Actions
     - Actions: View profile, Deactivate account
     - Search by name or student ID
     - Export to CSV button

2. src/components/admin/BulkStudentImport.tsx
   - CSV upload component
   - Expected CSV format: full_name, student_id, email
   - Parse CSV client-side using PapaParse
   - Preview the parsed rows in a table before confirming
   - On confirm: POST /api/admin/students/bulk-import
   - Show import results: X created, X skipped (already exists), X failed (invalid email domain)

3. src/app/api/admin/students/bulk-import/route.ts (POST)
   - Auth required, role must be institution_admin
   - For each row: validate email domain against institution's domain_whitelist
   - Call Supabase Admin API (using service role key) to create auth users with temporary passwords
   - Insert profile rows
   - Send invite emails via Supabase Auth (inviteUserByEmail)
   - Return import summary

4. src/app/(admin)/institutions/canteens/page.tsx
   - List canteens in the institution
   - Add new canteen form: name, description, image, opening/closing times
   - Assign canteen_owner: input email → find user → assign role + canteen_id

5. src/app/api/admin/canteens/route.ts (GET, POST)
   - POST creates a new canteen scoped to the admin's institution_id
```

---

# SECTION 7 — Super Admin Features

## Task 7.1 — Tenant Management

**🤖 Agent Prompt:**
```
Build the super admin tenant management panel for campus-eats.

1. src/app/(admin)/tenants/page.tsx
   - Table of all institutions: name, slug, student count, active orders, status (active/inactive), created date
   - "Add Institution" button opens a form

2. src/components/superadmin/AddInstitutionForm.tsx
   - Fields: Institution Name, Slug (auto-generated from name, editable), Domain Whitelist (tag input for multiple domains), Primary Color (color picker), Logo Upload
   - Slug validation: must be unique, lowercase, hyphens only
   - POST /api/superadmin/institutions to create

3. src/app/api/superadmin/institutions/route.ts (GET, POST)
   - Auth required, role must be super_admin
   - POST: create institution, create a default institution_admin user (send invite email)

4. src/app/(admin)/tenants/[tenantId]/page.tsx
   - Detailed view of one institution
   - Stats: daily active users, orders today, revenue this month
   - Toggle institution active/inactive (disables all logins for that tenant)
   - Danger zone: delete institution (soft delete, requires typing institution name to confirm)

5. src/app/(admin)/tenants/platform-stats/page.tsx
   - Platform-wide stats across all tenants:
     - Total institutions, Total students, Total orders today, Total GMV (gross merchandise value)
   - Simple table listing all institutions with their key metrics side by side
```

---

# SECTION 8 — Notifications

## Task 8.1 — In-App & Push Notifications

**🤖 Agent Prompt:**
```
Build the notification system for campus-eats.

1. src/components/NotificationBell.tsx
   - Bell icon in the student navbar
   - Subscribe to Supabase Realtime on notifications table filtered by profile_id = current user
   - Show unread count badge (red dot with number)
   - Click opens a dropdown panel showing the last 10 notifications
   - Each notification: icon by type, title, body, time ago, unread dot
   - "Mark all read" button → PATCH /api/notifications/mark-read

2. src/app/api/notifications/mark-read/route.ts (PATCH)
   - Auth required
   - Update all notifications for current user where is_read = false → set is_read = true

3. src/lib/notifications.ts
   - Server-side helper function: createNotification(profile_id, title, body, type, metadata)
   - Inserts a row into the notifications table
   - Call this from the order status update API (Task 4.1) whenever order status changes

4. src/app/api/notifications/push-subscribe/route.ts (POST)
   - Accept a Web Push subscription object from the browser
   - Store it in the profiles table (add a push_subscription jsonb column)

5. src/lib/webpush.ts
   - Server helper using the web-push npm package
   - Function: sendPushNotification(profile_id, title, body)
   - Fetches the stored push_subscription and sends a push notification
   - Call this alongside createNotification for order ready events

6. src/app/(student)/dashboard/page.tsx
   - On first load, prompt the user for notification permission using the Push API
   - If granted, register the service worker and subscribe using VAPID public key
   - Send subscription to /api/notifications/push-subscribe

7. Create public/sw.js — basic service worker that handles push events and shows browser notifications:
   self.addEventListener('push', event => { show notification with data from event.data.json() })
```

---

# SECTION 9 — TV Token Display Mode

## Task 9.1 — Canteen Token Display Screen

**🤖 Agent Prompt:**
```
Build a full-screen TV token display mode for campus-eats canteens.

1. src/app/display/[canteenId]/page.tsx
   - NO auth required — this is a public display URL
   - Full screen, dark background, large typography
   - Layout:
     - Top: Canteen name + current time (updates every second)
     - Main area split into 2 sections:
       LEFT: "Now Ready" — large token numbers currently in READY status (up to 6 tokens shown as large cards)
       RIGHT: "Preparing" — smaller list of token numbers in PREPARING status
   - Subscribe to Supabase Realtime on orders table for this canteen + today's date
   - When a token moves to READY: animate it flying into the "Now Ready" section with a scale-up animation
   - When a token moves to COLLECTED: fade it out from "Now Ready"
   - Auto-refresh the page every 30 minutes to prevent memory leaks

2. src/app/(staff)/display-link/page.tsx
   - Simple page for staff showing the QR code for the TV display URL
   - "Copy Link" and "Open Full Screen" buttons
   - Instruction: "Scan or open this on the canteen TV"

3. Style requirements for the display page:
   - Font size for "Now Ready" tokens: minimum 5rem
   - High contrast: white text on near-black background
   - Visible from 5+ meters away
   - No navigation, no headers — purely the token display
   - Add a subtle pulse animation on newly added READY tokens
```

---

# SECTION 10 — Mobile Wrapping (Capacitor)

## Task 10.1 — Capacitor Setup for iOS & Android

**🤖 Agent Prompt:**
```
Configure Capacitor to wrap the campus-eats Next.js app for iOS and Android deployment.

1. Initialize Capacitor in the project:
   npx cap init "CampusEats" "app.campuseats.mobile" --web-dir=out

2. Update next.config.ts:
   - Add output: 'export' for static export
   - Add images: { unoptimized: true } since Capacitor can't use Next.js image optimization
   - Add trailingSlash: true

3. Install platforms:
   npx cap add ios
   npx cap add android

4. Create capacitor.config.ts:
   - appId: 'app.campuseats.mobile'
   - appName: 'CampusEats'
   - webDir: 'out'
   - server.androidScheme: 'https'
   - plugins: SplashScreen (show for 2s), StatusBar (style: dark)

5. Install Capacitor plugins:
   @capacitor/push-notifications
   @capacitor/status-bar
   @capacitor/splash-screen
   @capacitor/haptics

6. Create src/lib/capacitor.ts:
   - Detect if running in native context: Capacitor.isNativePlatform()
   - Export a requestNativePushPermission() function that uses @capacitor/push-notifications when native, falls back to Web Push API when web
   - Export a triggerHaptic() function for button feedback on native

7. Update src/components/student/OrderTracker.tsx:
   - When order status changes to READY on native, call triggerHaptic() for a success haptic feedback

8. Add build script to package.json:
   "build:mobile": "next build && npx cap sync"

9. Create .github/workflows/mobile-build.yml:
   - Trigger on push to main
   - Build Next.js static export
   - Sync Capacitor
   - Upload ios/ and android/ as artifacts for manual submission to App Store / Play Store
```

---

# SECTION 11 — Polish, Performance & Launch

## Task 11.1 — Loading States & Error Boundaries

**🤖 Agent Prompt:**
```
Add proper loading states, skeletons, and error boundaries throughout campus-eats.

1. Create src/components/ui/Skeleton.tsx
   - Animated shimmer skeleton component (gray pulsing block)
   - Variants: text (lines), card, avatar, button

2. Create loading.tsx files for each major route:
   - src/app/(student)/menu/loading.tsx — show 6 skeleton item cards in a grid
   - src/app/(student)/orders/loading.tsx — show 3 skeleton order rows
   - src/app/(owner)/analytics/loading.tsx — show skeleton chart placeholders
   - src/app/(staff)/queue/loading.tsx — show 3 skeleton order card columns

3. Create src/components/ErrorBoundary.tsx
   - React error boundary component
   - Show a friendly "Something went wrong" UI with a retry button
   - Log errors to console (hook up Sentry later)

4. Create src/app/not-found.tsx
   - Friendly 404 page with a "Go to Dashboard" link

5. Add optimistic updates to:
   - Item availability toggle (Task 4.2) — already noted, verify it's implemented
   - Cart add/remove — should feel instant
   - Notification mark-as-read — mark read immediately without waiting for API

6. Add react-hot-toast notifications for all user actions:
   - Order placed successfully → "Order placed! Token #X 🎉"
   - Order cancelled → "Order cancelled. Refund added to wallet."
   - Wallet topped up → "₹X added to wallet!"
   - Item marked sold out → "Item marked as unavailable"
   - Any API error → "Something went wrong. Please try again."
```

---

## Task 11.2 — PWA Configuration

**🤖 Agent Prompt:**
```
Configure campus-eats as a Progressive Web App (PWA) for add-to-home-screen on mobile browsers.

1. Create public/manifest.json:
   - name: "CampusEats"
   - short_name: "CampusEats"
   - start_url: "/"
   - display: "standalone"
   - background_color: "#FAFAF8"
   - theme_color: "#FF6B35"
   - icons: reference icon files at sizes 192x192 and 512x512

2. Create placeholder icon files or use a generator script that creates them from an SVG logo.

3. Add manifest and theme-color meta tags to src/app/layout.tsx

4. Update public/sw.js to also handle:
   - Cache-first strategy for static assets
   - Network-first strategy for API calls
   - Offline fallback page (public/offline.html) when network is unavailable

5. Add an "Install App" prompt component:
   - Detect beforeinstallprompt event
   - Show a bottom banner after 30 seconds: "Add CampusEats to your home screen for the best experience" with an Install button
   - Dismiss and remember dismissal in localStorage
   - Show the native install prompt on button click

6. Add to src/app/layout.tsx:
   <link rel="manifest" href="/manifest.json" />
   <meta name="theme-color" content="#FF6B35" />
   <meta name="apple-mobile-web-app-capable" content="yes" />
   <meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

---

## Task 11.3 — Deployment & Environment Setup

**🤖 Agent Prompt:**
```
Set up production deployment for campus-eats on Vercel with Supabase.

1. Create vercel.json:
   - Set regions: ["bom1"] (Mumbai, closest to India)
   - Set function maxDuration: 10 for API routes

2. Update src/app/api routes to use Edge Runtime where possible:
   - Add export const runtime = 'edge' to: /api/tenant, /api/menu-items GET
   - Keep Node.js runtime for: /api/wallet/* (Razorpay SDK requires Node), /api/admin/*

3. Create a Supabase migration for production:
   - Add indexes on frequently queried columns:
     CREATE INDEX idx_orders_canteen_date ON orders(canteen_id, scheduled_for);
     CREATE INDEX idx_orders_student ON orders(student_id);
     CREATE INDEX idx_menu_items_canteen ON menu_items(canteen_id);
     CREATE INDEX idx_wallet_transactions_profile ON wallet_transactions(profile_id);

4. Set up Supabase Realtime publication:
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

5. Create a DEPLOYMENT.md file documenting:
   - All required environment variables and where to find them
   - Supabase project setup steps
   - Razorpay account setup and webhook configuration
   - Vercel project setup steps
   - How to run migrations
   - How to add a new institution (step-by-step)

6. Set up Razorpay webhook:
   - Create src/app/api/webhooks/razorpay/route.ts
   - Verify webhook signature using X-Razorpay-Signature header
   - Handle payment.captured event → same logic as /api/wallet/verify
   - Handle refund.processed event → log to wallet_transactions
   - Return 200 immediately and process async
```

---

# Appendix — Suggested Agent Session Order

| Session | Tasks | Est. Time |
|---|---|---|
| 1 | 1.1, 1.2, 1.3 | 2–3 hrs |
| 2 | 2.1, 2.2 | 2 hrs |
| 3 | 3.1, 3.2 | 2 hrs |
| 4 | 3.3, 3.4 | 2 hrs |
| 5 | 4.1, 4.2 | 2 hrs |
| 6 | 5.1, 5.2, 5.3 | 3 hrs |
| 7 | 6.1, 7.1 | 2 hrs |
| 8 | 8.1, 9.1 | 2 hrs |
| 9 | 10.1 | 1–2 hrs |
| 10 | 11.1, 11.2, 11.3 | 2–3 hrs |

**Total estimated build time with AI agents: ~20–25 hours of active prompting across ~2 weeks.**

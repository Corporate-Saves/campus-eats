# CampusEats - Product Requirements Document
**Version:** 1.1  
**Status:** Draft  
**Last Updated:** April 3, 2026

---

## 1. Product Overview

**CampusEats** is a multi-tenant canteen ordering and operations platform for schools and colleges. It lets students browse menus, place live or scheduled orders, pay from a wallet, and pick up food with minimal queueing. It also gives canteen staff, owners, institution admins, and platform admins role-based tools to manage operations in real time.

The current product direction is **web-first**:
- Primary application: **Next.js 15 App Router** web app
- Distribution: browser, installable **PWA**, and **Capacitor** wrappers for iOS/Android
- Backend platform: **Supabase** for auth, Postgres, storage, realtime, and server-side policy enforcement

---

## 2. Problem Statement

Campus canteens face repeated operational breakdowns during peak hours:
- Students wait 15-30 minutes to place and collect orders
- Staff handle orders manually, causing missed, delayed, or incorrect preparation
- Owners lack structured visibility into demand, item sell-through, and peak periods
- Institutions have no clean operational data across students, wallets, orders, and canteens
- Multi-campus adoption is hard without strict tenant isolation and institution-specific branding

---

## 3. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Reduce pickup wait time | < 5 minutes average pickup wait |
| Increase throughput | +20% daily fulfilled orders |
| Improve ordering reliability | < 1% order creation/payment mismatch |
| Preserve tenant isolation | Zero cross-institution data leakage |
| Speed up institution onboarding | New institution live in < 1 business day |
| Improve student adoption | 60% of active students order within first 30 days |
| Improve operational visibility | Staff dashboard reflects status changes in near real time (< 3s) |

---

## 4. Stakeholders & User Roles

| Role | Description |
|---|---|
| **Super Admin** | Platform operator. Manages institutions, platform health, and cross-tenant reporting |
| **Institution Admin** | Institution representative. Manages students, canteens, and institution settings |
| **Canteen Owner** | Owns menu, slots, pricing, analytics, and canteen configuration |
| **Canteen Staff** | Operates live queue, item availability, preparation flow, and pickup handoff |
| **Student** | Browses menu, orders food, pays through wallet, tracks status, receives notifications |

---

## 5. Product Principles

- **Tenant-safe by default:** every authenticated request is scoped to the user's institution
- **Role-based UX:** users land only on the surfaces relevant to their role
- **Wallet-first checkout:** order confirmation should be fast and atomic
- **Realtime operations:** order and notification updates should propagate immediately
- **Operational simplicity:** staff actions must work on tablet-sized screens with minimal friction
- **Fast deployment:** one codebase should support browser, PWA, and mobile wrapping

---

## 6. Supported Product Surfaces

### 6.1 Public
- `/login`
- `/register`
- `/display/[canteenId]` public token display screen
- `/api/tenant?slug=<institution-slug>` public endpoint for institution branding on auth screens

### 6.2 Student
- `/student/dashboard`
- `/student/menu`
- `/student/checkout`
- `/student/orders`
- `/student/orders/[orderId]`
- `/student/wallet`

### 6.3 Canteen Staff
- `/staff/queue`
- `/staff/availability`
- `/staff/display-link`

### 6.4 Canteen Owner
- `/owner/menu`
- `/owner/slots`
- `/owner/analytics`

### 6.5 Institution Admin
- `/admin/institutions`
- `/admin/institutions/canteens`

### 6.6 Super Admin
- `/admin/tenants`
- `/admin/tenants/[tenantId]`
- `/admin/tenants/platform-stats`

---

## 7. Core Use Cases

### UC-01 - Student Places a Scheduled Order
**Actor:** Student  
**Flow:** Browse menu -> add items to cart -> choose time slot or walk-in -> confirm wallet payment -> receive token number -> track status live  
**Outcome:** Student arrives near pickup time with minimal queueing.

### UC-02 - Student Tracks and Cancels Order
**Actor:** Student  
**Flow:** Open order tracking page -> watch status move from `PENDING` to `READY` -> cancel within allowed window if needed -> wallet refund processed automatically  
**Outcome:** Student has visibility and a fair cancellation/refund flow.

### UC-03 - Staff Runs the Live Queue
**Actor:** Canteen Staff  
**Flow:** Open queue board -> accept order -> move to preparing -> mark ready -> mark collected or cancel with refund  
**Outcome:** Kitchen flow is controlled through a shared realtime board.

### UC-04 - Staff Manages Item Availability
**Actor:** Canteen Staff  
**Flow:** Toggle item availability -> update prepared quantity -> item auto-marks sold out when prepared quantity reaches max daily quantity  
**Outcome:** Students do not order unavailable items.

### UC-05 - Owner Manages Menu and Slots
**Actor:** Canteen Owner  
**Flow:** Create categories and items -> upload images -> set veg/non-veg tags and max quantities -> define pickup slots and capacities  
**Outcome:** Menu and throughput are configurable without engineering support.

### UC-06 - Owner Reviews Analytics
**Actor:** Canteen Owner  
**Flow:** Select date range -> view revenue, top items, status split, hourly demand, and next-day prep suggestion  
**Outcome:** Owner can optimize menu planning and staffing.

### UC-07 - Institution Admin Imports Students
**Actor:** Institution Admin  
**Flow:** Upload CSV -> validate domain whitelist -> create auth accounts and profiles -> send invite emails  
**Outcome:** Institution onboarding and student setup scale cleanly.

### UC-08 - Super Admin Onboards a Tenant
**Actor:** Super Admin  
**Flow:** Create institution -> assign branding and whitelist domains -> invite default institution admin -> monitor tenant activity  
**Outcome:** New institutions can go live quickly with isolated data and branding.

### UC-09 - Students Receive Status Notifications
**Actor:** Student  
**Flow:** Order status changes -> in-app notification created -> push notification sent for ready state when subscribed  
**Outcome:** Students return only when food is ready.

### UC-10 - Public TV Token Display
**Actor:** Walk-up students / staff  
**Flow:** Open public display URL on TV -> show `READY` and `PREPARING` token lists with realtime updates  
**Outcome:** Token calling does not depend on shouting names or individual device access.

---

## 8. Functional Requirements

### 8.1 Authentication, Authorization, and Tenant Context

- Authentication must use **Supabase Auth** with email/password flows.
- Login must redirect users by role:
  - `student` -> `/student/dashboard`
  - `canteen_staff` -> `/staff/queue`
  - `canteen_owner` -> `/owner/menu`
  - `institution_admin` -> `/admin/institutions`
  - `super_admin` -> `/admin/tenants`
- Registration must validate institution slug and email domain against the institution's `domain_whitelist`.
- Middleware must protect all `/student/*`, `/staff/*`, `/owner/*`, and `/admin/*` routes.
- If a signed-in user accesses the wrong role area, middleware must redirect them to the correct dashboard.
- On app load, the client must fetch and store tenant branding: `name`, `slug`, `logo_url`, and `primary_color`.
- Institution color must be injected into the UI as a CSS variable for tenant branding.
- **Critical rule:** no API route may trust a client-supplied `institution_id` for authorization or scoping. Scope must come from the authenticated session/profile.

### 8.2 Required Data Model

The platform must include at minimum the following core entities:
- `institutions`
- `profiles`
- `canteens`
- `menu_categories`
- `menu_items`
- `time_slots`
- `orders`
- `order_items`
- `wallet_transactions`
- `notifications`

Required domain rules:
- `institutions.slug` is the tenant identifier
- `profiles` extend `auth.users`
- `menu_items` support `is_available`, `is_veg`, `max_daily_quantity`, `prepared_quantity`, and `tags`
- `orders` support `token_number`, `status`, `payment_method`, `payment_status`, `special_instructions`, and `scheduled_for`
- `wallet_transactions` must record top-ups, debits, and refunds
- `notifications` must support typed payloads and read/unread state

Required order statuses:
- `PENDING`
- `ACCEPTED`
- `PREPARING`
- `READY`
- `COLLECTED`
- `CANCELLED`

Required user roles:
- `super_admin`
- `institution_admin`
- `canteen_owner`
- `canteen_staff`
- `student`

### 8.3 Row-Level Security and Access Rules

- Postgres Row-Level Security must be enabled for tenant-sensitive tables.
- A helper such as `get_my_institution_id()` must resolve the current user's institution from `profiles`.
- Students may only read:
  - their own profile
  - their own orders
  - their own wallet transactions
  - their own notifications
  - menu, canteen, and slot data within their institution
- Canteen staff may only view and update orders for their assigned canteen.
- Canteen owners may only manage menu items, categories, and slots for their assigned canteen.
- Institution admins may manage records within their own institution.
- Super admins must have platform-wide access.

### 8.4 Student Experience

**Menu and Cart**
- Students must be able to browse available menu items grouped by category.
- The menu must support client-side search and category filtering.
- Item cards must show image, name, price, veg/non-veg marker, and tags.
- Cart state must persist in a client store and support add, remove, quantity update, clear, and total calculation.

**Checkout**
- Students must be able to choose a pickup slot or an `ASAP / Walk-in` option.
- Slot cards must show remaining capacity and disable full slots.
- The server must calculate totals and validate item availability.
- Order creation, wallet debit, order items insertion, and token assignment must happen atomically.
- On success, the cart must clear and the student must be redirected to the order tracking page.

**Order Tracking**
- The tracking page must render the current order state and subscribe to realtime updates.
- The student must see:
  - visual status stepper
  - token number
  - ordered items
  - payment method
  - cancellation and refund state if relevant
- Students may cancel orders only within the allowed window:
  - status must be `PENDING` or `ACCEPTED`
  - if the order is scheduled, cancellation must be more than 30 minutes before the slot

**Wallet**
- Students must have a wallet screen with current balance, top-up actions, and transaction history.
- Supported quick top-up amounts: `50`, `100`, `200`, `500` INR, plus a custom amount.
- Top-up must integrate with **Razorpay** order creation and signature verification.

### 8.5 Canteen Staff Requirements

- Staff queue view must be optimized for tablet/large-screen usage.
- Active orders for the current day must appear in three live columns:
  - New Orders
  - Preparing
  - Ready for Pickup
- Valid staff state transitions:
  - `PENDING -> ACCEPTED`
  - `PENDING -> CANCELLED`
  - `ACCEPTED -> PREPARING`
  - `PREPARING -> READY`
  - `READY -> COLLECTED`
- Cancelling a paid order from staff tools must trigger a wallet refund.
- The queue must visually highlight new orders and optionally play a notification sound.
- Staff must be able to toggle canteen open/close state.
- Staff must be able to update item availability and prepared quantity.
- If `prepared_quantity >= max_daily_quantity`, the item should automatically become unavailable.

### 8.6 Canteen Owner Requirements

**Menu Management**
- Owners must be able to create, update, soft-delete, and reorder categories.
- Owners must be able to create and edit menu items with:
  - name
  - description
  - category
  - price
  - veg toggle
  - max daily quantity
  - tags
  - image upload to Supabase Storage

**Slot Management**
- Owners must be able to create, edit, activate/deactivate, and delete time slots.
- Slot validation must prevent overlap and invalid start/end times.
- A slot cannot be deleted if future orders reference it.

**Analytics**
- Owners must be able to view:
  - revenue by day
  - top-selling items
  - orders by status
  - hourly demand distribution
  - next-day prep suggestion based on recent historical averages

### 8.7 Institution Admin Requirements

- Institution admin dashboard must show overview metrics for students, active orders, revenue, and number of canteens.
- Student management must support search, pagination, profile view, deactivation, and CSV export.
- Bulk student import must accept CSV with `full_name`, `student_id`, and `email`.
- Import must validate allowed email domains and report created, skipped, and failed rows.
- Institution admins must be able to create canteens and assign canteen owners.

### 8.8 Super Admin Requirements

- Super admins must be able to list all institutions with status and activity metrics.
- Super admins must be able to create institutions with:
  - name
  - slug
  - domain whitelist
  - primary color
  - logo
- Tenant detail page must support active/inactive toggle and soft delete with explicit confirmation.
- Platform stats page must aggregate institution, student, order, and GMV metrics.

### 8.9 Notifications

- Students must receive in-app notifications for order updates.
- Notification bell must show unread count and recent items.
- Users must be able to mark all notifications as read.
- Browser push notifications must be supported for subscribed users.
- Native/mobile packaging must use native push permissions when running under Capacitor.

### 8.10 Public Token Display

- A public display page must be available per canteen without login.
- The display must show:
  - canteen name
  - current time
  - large `READY` tokens
  - smaller `PREPARING` tokens
- The display must update in realtime and remain readable from at least 5 meters away.

### 8.11 PWA and Mobile Packaging

- The web app must be installable as a PWA.
- A web app manifest, service worker, offline fallback, and install prompt are required.
- Static assets should be cached with a cache-first strategy; API calls should prefer network-first behavior.
- The same app must be wrappable using **Capacitor** for iOS and Android builds.

### 8.12 Deployment and Operations

- Primary deployment target: **Vercel**, Mumbai region (`bom1`) where supported.
- Supabase migrations must include production indexes for common order, wallet, and menu queries.
- `orders` and `notifications` must be enabled for Supabase Realtime publication.
- Razorpay webhooks must be supported for payment capture and refund handling.
- A deployment runbook must document environment variables, Supabase setup, Razorpay setup, migration steps, and tenant onboarding steps.

---

## 9. MVP Scope

The MVP is the first production-capable release aligned to the current implementation playbook.

### 9.1 In Scope

**Foundation**
- Next.js 15 App Router application with Tailwind CSS
- Supabase auth, database, storage, realtime, and RLS
- Role-based routing and middleware
- Tenant branding via institution context

**Student**
- Registration and login
- Menu browsing and cart
- Checkout with wallet payment
- Slot selection and walk-in orders
- Order tracking and cancellation
- Wallet top-up with Razorpay
- In-app and browser push notifications

**Staff**
- Live queue board
- Order status actions
- Item availability and prepared quantity management
- Public display link generation

**Owner**
- Menu/category CRUD
- Time slot management
- Analytics dashboard with heuristic prep forecast

**Institution Admin**
- Dashboard overview
- Student management
- Bulk CSV student import
- Canteen creation and owner assignment

**Super Admin**
- Institution list and creation
- Tenant detail management
- Platform stats dashboard

**Cross-Cutting**
- Public TV token display
- PWA configuration
- Capacitor setup for mobile packaging
- Deployment documentation and production setup

### 9.2 Explicitly Out of Scope

- Multi-canteen ordering in a single student checkout flow
- Parent wallet management and spend controls
- Loyalty points, coupons, and referral systems
- Full offline-first staff operations with delayed sync
- AI-generated menu suggestions
- Advanced ML demand forecasting beyond rule-based heuristics
- SMS notifications as a launch requirement
- GST/tax engine and invoicing complexity beyond basic receipts

---

## 10. Tech Stack & Architecture

### 10.1 Application Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Next.js 15 App Router** | Primary web runtime for all roles |
| Styling | **Tailwind CSS** | Shared UI foundation |
| Client State | **Zustand** | Cart and lightweight client state |
| Server State | **TanStack Query** | Cached profile and API-backed client data |
| Backend | **Next.js Route Handlers** + **Supabase** | Avoid separate API server for MVP |
| Database | **Supabase Postgres** | Tenant-safe RLS and SQL migrations |
| Auth | **Supabase Auth** with SSR helpers | Session handling in App Router |
| Storage | **Supabase Storage** | Menu images and branding assets |
| Realtime | **Supabase Realtime** | Order and notification updates |
| Payments | **Razorpay** | Wallet top-up and verification |
| Charts | **Recharts** | Owner analytics dashboard |
| Mobile Wrapper | **Capacitor** | iOS and Android packaging |
| Deployment | **Vercel** | Web delivery |

### 10.2 Architectural Pattern

```
[Browser / PWA / Capacitor App]
        |
        v
[Next.js App Router + Route Handlers]
        |
        v
[Supabase Auth + Postgres + RLS + Storage + Realtime]
        |
        v
[Razorpay + Web Push + Vercel Runtime]
```

Key architectural decisions:
- Keep product logic close to the Next.js app for MVP speed
- Use Supabase policies and SQL for tenant isolation and transactional integrity
- Use realtime subscriptions for queue, tracking, and notifications
- Use a single UI codebase for web, PWA, and mobile wrapping

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| API response time | < 300ms p95 for standard reads |
| Realtime propagation | < 3 seconds for order/notification updates |
| Uptime | 99.5% |
| Concurrent load | 500 active users per tenant at launch |
| Tenant isolation | Zero cross-tenant leakage |
| Order/payment consistency | Atomic order creation and wallet debit |
| Data privacy | Student PII encrypted at rest where supported and deletable on request |
| Accessibility | Tablet-friendly staff UI and high-contrast public display |
| Installability | PWA install prompt supported on modern mobile browsers |

---

## 12. Milestones & Delivery Order

| Phase | Scope | Deliverable |
|---|---|---|
| **Phase 1** | Project scaffold, dependencies, DB schema | Working app shell and initial schema |
| **Phase 2** | Auth and tenant context | Role-based access and branded tenant experience |
| **Phase 3** | Student menu, checkout, orders, wallet | Complete student ordering loop |
| **Phase 4** | Staff queue and availability | Live operations tooling |
| **Phase 5** | Owner menu, slots, analytics | Canteen configuration and reporting |
| **Phase 6** | Institution admin and super admin | Operational administration across tenants |
| **Phase 7** | Notifications and public token display | Realtime communication surfaces |
| **Phase 8** | PWA, Capacitor, polish | Installable and mobile-packaged app |
| **Phase 9** | Deployment and production hardening | Launch-ready environment and runbooks |

Suggested build order:
1. Scaffold and dependencies
2. Supabase schema and seed data
3. Auth and middleware
4. Tenant context and student flows
5. Staff operations
6. Owner operations
7. Admin and super admin
8. Notifications and display
9. PWA and Capacitor
10. Deployment hardening

---

## 13. Open Questions

1. Should students without institutional email addresses be allowed to register through invite-only onboarding?
2. Is wallet-first payment mandatory at launch, or should direct Razorpay checkout for each order be added later?
3. Should canteen staff and owners be tied to exactly one canteen in MVP, or can one user operate multiple canteens?
4. Is the public TV display required for every pilot institution, or only for canteens with high footfall?
5. Should native app store packaging ship in the first launch wave, or should the pilot begin with web + PWA only?
6. Are push notifications sufficient for launch, or does the pilot require email/SMS fallbacks for key status changes?

---

*Document Owner: Product Team | Next Review: After MVP schema and auth sign-off*

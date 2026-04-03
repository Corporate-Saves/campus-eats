# 🍱 CampusEats — Product Requirements Document
**Version:** 1.0  
**Status:** Draft  
**Last Updated:** March 31, 2026

---

## 1. Product Overview

**CampusEats** is a multi-tenant canteen management platform that allows students to browse menus, pre-order meals, and pick up food without queues — while giving canteen owners real-time order visibility and kitchen management tools. Any school or college can onboard as an independent tenant with full data isolation.

---

## 2. Problem Statement

Campus canteens face a recurring cycle of chaos during lunch hours:
- Students queue 15–30 minutes just to order and collect food
- Canteen staff are overwhelmed, leading to wrong or delayed orders
- Food wastage occurs due to lack of demand forecasting
- No digital record of sales, inventory, or peak patterns

---

## 3. Goals & Success Metrics

| Goal | Metric |
|---|---|
| Reduce average order wait time | < 5 min pickup time |
| Increase canteen revenue | +20% orders per day |
| Reduce food wastage | Demand forecast accuracy > 85% |
| Multi-tenant onboarding | New institution live in < 1 day |
| Student adoption | 60% of enrolled students active in 30 days |

---

## 4. Stakeholders & User Roles

| Role | Description |
|---|---|
| **Super Admin** | Platform owner (you). Manages tenant onboarding, billing, platform config |
| **Institution Admin** | College/school IT or admin staff. Manages canteen staff, students, and settings per tenant |
| **Canteen Owner/Manager** | Sets menu, prices, operating hours, views analytics |
| **Canteen Staff** | Accepts/rejects orders, marks ready/collected, manages kitchen queue |
| **Student** | Browses menu, orders/pre-orders, pays, tracks order |
| **Parent (optional)** | Loads wallet balance for their ward, views purchase history |

---

## 5. Multi-Tenancy Architecture

Each institution is an isolated tenant:
- **Tenant Identifier:** Unique `institution_id` (slug-based, e.g., `abc-college`)
- **Data Isolation:** Row-level security (RLS) via Postgres policies — students of Tenant A can never query Tenant B's data
- **Custom Branding:** Each tenant gets a configurable logo, color theme, and subdomain (e.g., `abccollege.campuseats.app`)
- **Onboarding Flow:** Super Admin creates tenant → Institution Admin invited → Canteen(s) configured → Students bulk-imported via CSV or SSO

---

## 6. Use Cases

### UC-01 — Student Pre-Orders Before Lunch
**Actor:** Student  
**Trigger:** Student opens app at 10 AM before lunch hour  
**Flow:** Browse menu → Select items → Choose pickup slot (e.g., 1:00–1:15 PM) → Pay via wallet/UPI → Receive token number  
**Outcome:** Food is ready at the counter exactly at the chosen slot. No waiting.

---

### UC-02 — Walk-In Order During Lunch
**Actor:** Student  
**Trigger:** Student arrives at canteen without pre-ordering  
**Flow:** Scan QR code at counter → Open app → Place live order → Pay → Get live token queue status  
**Outcome:** Student can wait elsewhere and return only when token is called.

---

### UC-03 — Canteen Staff Kitchen Queue Management
**Actor:** Canteen Staff  
**Trigger:** Orders start coming in  
**Flow:** View live order dashboard → Accept orders → Mark items as "Preparing" → Mark "Ready for Pickup" → Student notified  
**Outcome:** Orderly kitchen flow; no verbal shouting of names.

---

### UC-04 — Canteen Owner Menu & Inventory Management
**Actor:** Canteen Owner  
**Trigger:** Start of day  
**Flow:** Set daily menu → Mark item availability (toggle items on/off) → Set max quantity per item to prevent over-ordering → View end-of-day report  
**Outcome:** No orders for unavailable items; reduced waste.

---

### UC-05 — Institution Admin Onboarding
**Actor:** Institution Admin  
**Trigger:** New college joins the platform  
**Flow:** Super Admin creates tenant → Admin receives invite → Configures canteen, uploads student list, sets SSO/email domain whitelist  
**Outcome:** Institution live in under 1 day.

---

### UC-06 — Wallet Top-Up (Student / Parent)
**Actor:** Student or Parent  
**Trigger:** Low wallet balance notification  
**Flow:** Open wallet → Choose top-up amount → Pay via UPI/card/netbanking → Balance updated instantly  
**Outcome:** Frictionless in-app payments; no cash at counter.

---

### UC-07 — Demand Forecasting for Canteen Owner
**Actor:** Canteen Owner  
**Trigger:** Viewing next week's prep plan  
**Flow:** System analyzes past 30-day order patterns → Suggests quantity to prep per item per day  
**Outcome:** Reduced over-preparation and food wastage.

---

### UC-08 — Order Cancellation & Refund
**Actor:** Student  
**Trigger:** Student cancels a pre-order within allowed window  
**Flow:** Open order → Cancel (if within cancellation window, e.g., 30 mins before slot) → Refund to wallet instantly  
**Outcome:** Flexible ordering with fair cancellation policy.

---

## 7. Tech Stack & Architecture

### 7.1 Frontend (Platform-Independent)

| Layer | Technology | Reason |
|---|---|---|
| Mobile (iOS + Android) | **React Native (Expo)** | Single codebase for both platforms, OTA updates |
| Web App | **Next.js 15 (App Router)** | SSR for fast loads, same React component logic |
| Shared UI Kit | **Tamagui** or **NativeWind** | Consistent design across web and mobile |
| State Management | **Zustand** + **React Query (TanStack)** | Lightweight, server-state friendly |
| Real-time UI | **Socket.IO client** or **Supabase Realtime** | Live order status updates |

---

### 7.2 Backend

| Layer | Technology | Reason |
|---|---|---|
| API Server | **Node.js + Fastify** (or NestJS for larger teams) | High throughput, TypeScript-first |
| Database | **PostgreSQL** (via Supabase or self-hosted) | Row-level security for multi-tenancy |
| ORM | **Prisma** | Type-safe DB queries, easy migrations |
| Real-time | **Supabase Realtime** or **Socket.IO** | Order status push events |
| Auth | **Supabase Auth** or **Auth.js** with institutional SSO (Google Workspace, Azure AD) | Multi-tenant identity |
| File Storage | **Supabase Storage** or **Cloudflare R2** | Menu images, receipts |
| Queue / Jobs | **BullMQ** (Redis-backed) | Scheduled slot processing, notifications |
| Search | **pg_trgm** (Postgres extension) | Menu item search |

---

### 7.3 Infrastructure

| Service | Tool |
|---|---|
| Hosting | **Railway** / **Render** (MVP) → **AWS ECS** / **GCP Cloud Run** (scale) |
| CDN | **Cloudflare** |
| Database | **Supabase** (managed Postgres) |
| Cache | **Redis (Upstash)** |
| Monitoring | **Sentry** + **Grafana** |
| CI/CD | **GitHub Actions** |
| Notifications | **Firebase Cloud Messaging (FCM)** for push; **Twilio** for SMS |

---

### 7.4 Architecture Pattern

```
[Mobile App / Web App]
        ↓ HTTPS / WebSocket
[API Gateway (Fastify)]
        ↓
[Multi-Tenant Middleware → extracts tenant_id from JWT / subdomain]
        ↓
[Service Layer: Orders | Menu | Users | Payments | Analytics]
        ↓
[PostgreSQL with RLS] + [Redis Cache] + [BullMQ Jobs]
        ↓
[External: Payment Gateway | FCM | SMS]
```

**Key Pattern:** Every API request carries a `tenant_id` from the JWT. Postgres RLS policies enforce that all queries are automatically scoped to that tenant — no manual filtering needed across the codebase.

---

## 8. Payment Integration

- **Primary:** Razorpay (India-first, UPI + cards + netbanking)
- **Wallet:** In-app prepaid wallet (reduces payment friction at order time)
- **Fallback:** QR-based UPI at counter (for students who didn't top up)
- **Receipts:** Auto-generated PDF receipt per order, downloadable

---

## 9. New & Good-to-Have Features

### 🔥 High-Impact (Post-MVP)
- **AI-Based Daily Menu Suggestions** — Suggest popular combos based on historical orders using a lightweight ML model
- **Combo / Meal Deal Builder** — Canteen owner can create bundled deals (e.g., Thali + Juice = ₹60 instead of ₹75)
- **Allergen & Dietary Tags** — Veg / Non-Veg / Egg / Jain / Gluten-Free labels on menu items
- **Order Scheduling for Events** — Bulk pre-orders for college fests, exams, or special days
- **Multi-Canteen Campus** — A single campus can have multiple canteens (Canteen A, Canteen B, Juice Counter)
- **Loyalty Points System** — Earn points per order, redeem for discounts

### 💡 Smart Features
- **Peak Hour Surge Warning** — Notify students if a slot is filling up, nudge them to pick off-peak slots
- **Waste Reduction Report** — Show canteen owner daily unsold item counts and suggest quantity cuts
- **Reorder / Favorites** — One-tap reorder of frequently ordered items
- **Live Token Display (TV Mode)** — A canteen TV/monitor shows live token queue (no app needed to track)

### 🛡️ Operational Features
- **Canteen Offline Mode** — Staff can accept and mark orders offline; sync when back online
- **Feedback & Ratings** — Per-item star rating after order completion
- **Nutritional Info** — Calories and macros per item (optional for canteen owner to fill)
- **Parent Dashboard** — View child's meal history, set daily spend limits

---

## 10. MVP Scope

The MVP focuses on proving the core loop: **student orders → canteen fulfills → student picks up without queuing.**

### ✅ In Scope for MVP

**Student App**
- [ ] Register / Login (email + institution code)
- [ ] View today's canteen menu
- [ ] Place live order or pre-order with slot selection
- [ ] In-app wallet top-up (Razorpay)
- [ ] Real-time order status (Pending → Preparing → Ready)
- [ ] Push notification when order is ready
- [ ] Order history

**Canteen Staff App (Tablet/Web)**
- [ ] View live order queue
- [ ] Accept / reject orders
- [ ] Mark order as Preparing → Ready → Collected
- [ ] Toggle item availability (sold out)

**Canteen Owner Web Dashboard**
- [ ] Menu CRUD (add/edit/delete items with photos and price)
- [ ] Set daily item availability and max quantity
- [ ] View today's orders and revenue summary

**Institution Admin Panel (Web)**
- [ ] Invite and manage students
- [ ] Configure canteen(s) for the institution
- [ ] View institution-level reports

**Super Admin Panel (Web)**
- [ ] Create and manage tenants
- [ ] View platform-level usage stats

### ❌ Out of Scope for MVP
- AI/ML recommendations
- Loyalty points
- Multi-canteen per campus
- Parent dashboard
- Nutritional info
- Offline mode

---

## 11. Non-Functional Requirements

| Requirement | Target |
|---|---|
| API Response Time | < 300ms (p95) |
| Uptime | 99.5% |
| Concurrent Users | 500 per tenant at launch |
| Data Isolation | Zero cross-tenant data leakage (enforced by RLS) |
| GDPR / Data Privacy | Student PII encrypted at rest; deletable on request |
| Mobile App Size | < 25MB download |

---

## 12. Milestones & Timeline (Suggested)

| Phase | Duration | Deliverable |
|---|---|---|
| **Phase 0 — Design** | 2 weeks | Figma wireframes, DB schema, API contract |
| **Phase 1 — MVP Backend** | 4 weeks | Auth, multi-tenancy, orders, menu, payments APIs |
| **Phase 2 — MVP Frontend** | 4 weeks | Student app (React Native), Staff web dashboard |
| **Phase 3 — Admin Panels** | 2 weeks | Institution admin + Super admin panels |
| **Phase 4 — Beta Launch** | 2 weeks | Pilot with 1 college, bug fixes, performance tuning |
| **Phase 5 — GA** | Ongoing | Feedback loop, feature backlog from Phase 9 |

---

## 13. Open Questions

1. Should student registration require institutional email verification, or is an institution invite code sufficient?
2. What is the preferred payment method split for the target demographic (wallet-first vs. UPI-first)?
3. Should the canteen owner be able to set item-level tax (GST) per item for receipt generation?
4. Is a hardware token display screen (TV mode) a hard requirement for pilot institutions?
5. How should refunds be handled if the canteen marks an order as failed after payment?

---

*Document Owner: Product Team | Next Review: After Phase 0 Design Sprint*

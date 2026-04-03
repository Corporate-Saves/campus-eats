# PRD Routing Guide

This file tells the orchestrator how to split CampusEats work using the PRD.

## Workstream Map

| PRD Area | Main Scope | Default Specialist Order |
|---|---|---|
| Product surfaces and route map | app structure and navigation boundaries | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Auth, authorization, tenant context | login, register, middleware, role routing, branding | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Data model and RLS | migrations, policies, seed data, helper functions | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Student experience | menu, cart, checkout, order tracking, wallet | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Staff requirements | queue board, status actions, availability, display link | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Owner requirements | menu CRUD, slots, analytics, prep forecast | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Institution admin | bulk import, student management, canteen management | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Super admin | tenant management and platform stats | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| Notifications and public display | notification bell, push, TV display | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |
| PWA, Capacitor, deployment | installability, build scripts, production setup | `prd-planner -> feature-implementer -> test-designer -> observability-agent -> code-quality-guardian -> build-verifier` |

## Delivery Slices

### Slice A: Platform Foundation
- project scaffold
- shared utilities
- environment setup
- Supabase clients
- providers

### Slice B: Auth and Tenant Safety
- auth pages
- middleware
- profile loading
- tenant context
- public tenant branding endpoint

### Slice C: Student Ordering Loop
- menu browsing
- cart
- checkout
- order creation
- order tracking
- wallet

### Slice D: Staff Operations
- queue board
- order status workflow
- canteen toggle
- item availability and prepared quantity

### Slice E: Owner Controls
- category management
- item CRUD
- slot management
- analytics and prep forecast

### Slice F: Administration
- institution admin student management
- bulk import
- canteen creation
- super admin tenant management

### Slice G: Realtime and Display
- notification bell
- push subscription
- public TV display

### Slice H: Hardening and Launch
- loading states
- error boundaries
- PWA
- Capacitor
- deployment setup

## Mandatory Cross-Cutting Checks

Every slice must consider:
- tenant isolation
- role authorization
- logging
- test case generation
- successful build
- regression risk

## Failure Loop

If any slice fails review, tests, or build:
1. route to `bug-fixer`
2. update or add regression tests through `test-designer`
3. rerun `code-quality-guardian`
4. rerun `build-verifier`

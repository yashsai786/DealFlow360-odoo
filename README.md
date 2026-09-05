# DealFlow360

> **An Intelligent, Self-Governing Sales Operations Platform**

DealFlow360 is a B2B sales operations platform designed to connect the
complete sales lifecycle into one intelligent workflow:

**Quotation → Discount Governance → Approval → Upsell/Cross-sell →
Fulfillment → Subscription/Billing → Customer Negotiation → Re-approval
→ Invoice → Payment → Deal Health → Reporting**

The project is being developed as a hackathon implementation with a
strong focus on real business rules, Domain-Driven Design (DDD), bounded
contexts, and a microservice-oriented architecture.

## Project Vision

Traditional sales systems often treat quotations, approvals, inventory,
billing, and customer communication as disconnected modules.

DealFlow360 connects them.

A change in one part of a deal can automatically affect the rest of the
lifecycle. For example:

-   A discount change can recalculate risk and approval requirements.
-   A customer negotiation can trigger re-approval.
-   An inventory shortage can create a backorder and affect deal health.
-   A payment can reconcile an invoice and advance the quotation
    lifecycle.
-   Adding an upsell can update quotation totals, margin, and
    governance.

The goal is to demonstrate a realistic, self-governing B2B sales
workflow rather than a collection of disconnected CRUD screens.

## Core Capabilities

### Quotation & Sales

-   Customer-aware quotation creation
-   Product and quantity management
-   One-time and recurring quotation lines
-   Live totals, taxes, discounts, and margin
-   Quotation lifecycle/state transitions

### Discount Governance

-   Customer-tier discount ceilings
-   Category-specific discount ceilings
-   Line-level discount evaluation
-   Quote-level blended risk scoring
-   Automatic approval-chain determination
-   Audit trail for important decisions

Default customer tiers:

  Tier       Discount Ceiling
  -------- ------------------
  Bronze                   5%
  Silver                  10%
  Gold                    15%

Default category ceilings:

  Category     Discount Ceiling
  ---------- ------------------
  Hardware                  15%
  Services                  10%

### Approval Workflow

-   Automatic approval routing
-   Sales Manager approval
-   Finance approval for high-risk quotes
-   Approve / Return for Revision / Reject
-   Approval history and audit trail

### Upsell & Cross-sell

-   Seeded co-purchase relationships
-   Margin-aware recommendations
-   Promotion-aware recommendations
-   Recommendation ranking
-   Add-to-quote and dismiss actions

### Multi-Warehouse Fulfillment

-   Live stock evaluation
-   Warehouse allocation
-   Shipping-cost-aware split calculation
-   Manual allocation override
-   Shortage detection
-   Backorder creation
-   Backorder consolidation after replenishment

### Subscription & Hybrid Billing

-   One-time products + recurring products in the same quotation
-   Monthly, quarterly, and yearly billing
-   Billing schedules
-   Subscription modification
-   Pause/resume/cancel
-   Mid-cycle proration
-   Billing adjustments

### Customer Negotiation

-   Restricted customer portal
-   Line-level negotiation
-   Counter-discount requests
-   Delivery-date requests
-   Customer/sales messaging
-   Automatic governance re-evaluation
-   Re-approval when negotiated terms exceed policy

### Invoices & Payments

-   Invoice lifecycle
-   Partial payments
-   Outstanding balance calculation
-   Payment reconciliation
-   Paid / partially paid states

### Deal Intelligence

-   Stalled-deal detection
-   Discount anomalies
-   Delivery slippage
-   Approval bottlenecks
-   Negotiation pressure
-   Deal health classification
-   Nudge and escalation actions

### Reporting

-   Revenue and pipeline metrics
-   Quote metrics
-   Conversion metrics
-   Approval duration
-   Discount trends
-   Rep performance
-   Top upsold products
-   Approval bottleneck analysis
-   CSV/Excel export
-   Printable/PDF reporting

## Architecture

DealFlow360 follows **Domain-Driven Design (DDD)** and is organized
around business bounded contexts.

### Bounded Contexts

1.  Identity & Access
2.  Catalog & Pricing
3.  Discount Governance
4.  Quotation / Sales
5.  Recommendation
6.  Fulfillment & Inventory
7.  Subscription & Billing
8.  Deal Intelligence
9.  Reporting
10. Customer Portal / Negotiation

The architecture is intentionally microservice-oriented: each bounded
context owns its business logic and communicates through clear
service/application contracts and meaningful domain events.

For the hackathon, the focus is on clean service boundaries without
unnecessary operational infrastructure such as Kubernetes, service
meshes, or distributed messaging platforms.

### Architectural Direction

``` text
                ┌──────────────────────┐
                │      Next.js UI      │
                │  App Router / React  │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  Application Layer   │
                │  Service Contracts   │
                └──────────┬───────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     Quotations      Discount          Fulfillment
      Domain        Governance           Domain
          │                │                │
          ├──── Recommendation ─────────────┤
          │                                 │
          ├──── Billing / Subscription ─────┤
          │                                 │
          └──── Deal Intelligence ──────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │    Infrastructure    │
                │   Prisma + SQLite    │
                └──────────────────────┘
```

Business logic must remain outside React components.

The intended dependency direction is:

``` text
UI
 ↓
Application Services
 ↓
Domain
 ↓
Repository Interfaces
 ↓
Infrastructure
 ↓
SQLite
```

## Technology

The target technology stack is:

-   **Next.js**
-   **Next.js App Router**
-   **React**
-   **TypeScript**
-   **Tailwind CSS**
-   **shadcn/ui**
-   **Lucide Icons**
-   **Prisma**
-   **SQLite**

SQLite is the required persistent database for the project.

The existing project was initially generated with Lovable and contains
reusable React/Tailwind/shadcn UI work and domain services. Migration
and integration are being handled incrementally rather than rebuilding
the product from scratch.

## Current Development State

This repository is an active work-in-progress.

The current implementation already contains substantial domain
foundations, including:

-   Identity and role permissions
-   Discount governance and blended risk
-   Quotation calculations
-   Recommendation engine
-   Fulfillment and warehouse allocation
-   Billing and proration
-   Deal intelligence
-   Reporting calculations
-   Seed/demo data
-   Reactive application state
-   Domain events
-   Audit trail

The remaining work focuses on completing the application shell and
screens, connecting the existing domain logic to the UI, implementing
SQLite/Prisma persistence, completing admin configuration, customer
isolation, tests, and end-to-end verification.

## Demo Personas

The application uses demo personas to demonstrate role-specific
workflows:

-   **Priya Raman** --- Sales Representative
-   **Dana Whitfield** --- Sales Manager
-   **Owen Vasquez** --- Finance & Operations
-   **Sasha Idris** --- Administrator
-   **Lena Ortiz** --- Acme Corp Customer
-   **Ravi Kapoor** --- Beta Industries Customer

## Demo Scenario

A key demonstration scenario uses:

**Acme Corp --- Gold Customer**

Quotation:

-   Enterprise Laptop --- 12% discount
-   Setup Service --- 18% discount

The Laptop discount is within the Hardware ceiling.

The Setup Service discount exceeds the Services ceiling.

The quotation therefore demonstrates the blended discount-risk and
approval workflow.

The intended flow is:

``` text
Sales Rep
   ↓
Create Quotation
   ↓
Discount Governance
   ↓
Blended Risk
   ↓
Approval
   ↓
Upsell / Cross-sell
   ↓
Fulfillment
   ↓
Hybrid Billing
   ↓
Customer Negotiation
   ↓
Re-approval (if required)
   ↓
Invoice
   ↓
Payment
   ↓
Deal Health
   ↓
Reporting
```

## Engineering Principles

### 1. Real Business Logic

Core business rules must be implemented in application/domain services,
not simulated in the UI.

### 2. Single Source of Truth

Avoid conflicting copies of important business state.

### 3. DDD First

Business boundaries should determine module boundaries.

### 4. Service-Oriented Design

Bounded contexts should communicate through clear contracts rather than
directly reaching into each other's internals.

### 5. No Dead Code

Do not leave unused components, hooks, services, duplicate types, dead
routes, fake buttons, placeholder business logic, or unnecessary
dependencies.

### 6. Preserve Existing Work

Existing approved UI and working domain logic should be reused and
extended rather than unnecessarily rewritten.

### 7. Demo Reliability

Every critical workflow must work end-to-end and produce consistent
state changes.

## Planned Validation

The completed application should verify these six primary flows:

1.  **Quotation → Approval**
2.  **Recommendation → Fulfillment**
3.  **Hybrid Billing**
4.  **Customer Negotiation → Re-approval**
5.  **Partial Payment → Full Payment**
6.  **Deal Health → Nudge / Escalation**

Core domain tests should cover discount governance, approval routing,
warehouse allocation, backorders, billing/proration, payment
reconciliation, negotiation/re-approval, and deal intelligence.

## Status

**Development Status: In Progress**

DealFlow360 is being actively implemented and integrated as a hackathon
project.

The first priority is a reliable end-to-end demonstration of the
complete sales lifecycle while maintaining clean DDD boundaries and a
production-style architecture.

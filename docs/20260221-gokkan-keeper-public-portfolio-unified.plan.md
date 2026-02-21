# Gokkan Keeper - Public Portfolio Unified Plan (v1 + Option B)

Author: Hosung Hwang  
Date: 2026-02-21  
Mode: Unified Execution Plan  
Objective: Transform Gokkan Keeper into a public judgment archive with true stock-level transparency.

## 1. Product Direction

Gokkan Keeper is not a recommendation engine.
It is a structured transparency layer for:

Hypothesis -> Allocation -> Tracking -> Reflection

Public layer exposes only:
- symbol/name
- allocation (%)
- return (%)
- one-line thesis
- last update

Private layer keeps:
- account-level detail
- total asset amount
- internal notes and operations

## 2. Scope

### In Scope (Unified MVP)
- Public portfolio page (`/public`)
- Public portfolio API (`/public/portfolio`, `/api/public/portfolio`)
- Position-based model (`gk_positions`) for public exposure
- Position CRUD (private/authenticated)
- Disclaimer block
- Consulting request form that sends to Discord channel

### Out of Scope
- brokerage sync
- transaction ledger/full backtesting
- payment flow

## 3. Domain Model

### Granary
- purpose bucket (emergency, household, kids, etc.)
- can include multiple positions

### Position
- public exposure unit (stock/ETF/crypto)
- fields include:
  - identity: `name`, `symbol`, `market`, `asset_type`
  - valuation: `quantity`, `avg_cost`, `current_value`, `weight_percent`
  - return: `profit_loss_percent` (preferred), derived return fallback
  - visibility: `is_public`, `public_thesis`, `public_order`, `last_public_update`

Public portfolio = all positions where `is_public = 1`.

## 4. Data Model

### 4.1 Granary Extension
- `is_public` (deprecated for portfolio source)
- `public_thesis` (deprecated)
- `public_order` (deprecated)
- `last_public_update` (deprecated)

Note: kept for compatibility, not used as portfolio source.

### 4.2 Positions Table
`gk_positions`
- `id`, `granary_id`, `name`, `symbol`
- `market`, `asset_type`
- `quantity`, `avg_cost`, `current_value`, `weight_percent`
- `profit_loss`, `profit_loss_percent`, `note`
- `is_public`, `public_thesis`, `public_order`, `last_public_update`
- `created_at`, `updated_at`

Indexes:
- `idx_positions_granary_id`
- `idx_positions_is_public`
- `idx_positions_symbol`
- `idx_positions_public_order`
- `idx_positions_weight_percent`

## 5. API Contract

### 5.1 Public Portfolio
`GET /public/portfolio` (alias: `/api/public/portfolio`)

Response:
- `data[]`
  - `symbol`, `name`
  - `granaryId`, `granaryName` (optional)
  - `allocationPercent`
  - `returnPercent`
  - `thesis`
  - `lastUpdated`
  - `isEstimatedReturn`
- `meta.warnings[]`

Rules:
- only `is_public=1` positions
- if `weight_percent` exists, allocation displays that value directly
- otherwise allocation derives from value basis (`current_value` or `quantity*avg_cost`)
- return priority:
  1) `profit_loss_percent`
  2) derived from cost basis and current value
  3) `null` with warning

### 5.2 Position CRUD (private)
- `GET /positions?granary_id=` (alias `/api/positions?...`)
- `GET /positions/:id`
- `POST /positions`
- `PATCH /positions/:id`
- `DELETE /positions/:id`

Validation for public positions:
- require `public_thesis`
- require one of: `weight_percent`, `current_value`, or (`quantity` + `avg_cost`)

### 5.3 Consulting Request
`POST /public/consulting-request`
- validated form payload
- sent to Discord webhook channel
- returns `requestId` for per-request follow-up

## 6. Frontend

### 6.1 Public Page (`/public`)
Sections:
- Current Return Overview
- Portfolio Allocation Table
- Data Warnings
- Disclaimer
- Consulting request form (Discord channel delivery)

### 6.2 Admin UX
- Granary detail includes position list
- add/edit/delete position flow
- market/asset_type via dropdown
- remove deprecated granary-level public fields from granary form

## 7. Calculation Policy

### Allocation
- if position has `weight_percent`, show that as allocation
- else derive by normalized value basis among public positions

### Return
- `profit_loss_percent` first
- else `(current_value - cost_basis) / cost_basis * 100`
- else null + warning

## 8. Security / Legal / Risk

- no absolute private totals in public APIs
- explicit disclaimer fixed on public page
- no recommendation language
- transparent negative return display allowed

## 9. Migration / Deployment Strategy

Current strategy: migration chain squashed into one file (`0005_public_portfolio.sql`) for this feature set.

Includes:
- granary public columns (compatibility)
- positions table creation
- positions indexes including `weight_percent`

Removed:
- separate `0006~0008` split migrations
- monthly snapshots table flow

## 10. Testing Checklist

### Backend
- typecheck/build pass
- public portfolio exposes only public positions
- warnings generated for incomplete inputs
- position CRUD auth enforced

### Frontend
- `/public` renders without auth
- position CRUD works from granary detail
- consulting request submission returns requestId

### Privacy
- no private asset-size leakage in public responses

## 11. Definition of Done

- public page shows real symbols from positions
- allocation/return are explicit and auditable
- consulting requests land in Discord channel as individual items
- maintainer can reply per request (by `requestId` message context)

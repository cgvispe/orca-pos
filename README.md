# ORCA POS — On-site Recycler Cash Application

> Sesami SafePay RC5000 Integration · v1.3.0

A full-featured Point of Sale web application with native integration with the **Sesami SafePay RC5000** cash recycler. Designed for touch screens on **Linux ARM64 i.MX8 boards** (Yocto), and fully compatible with Windows and macOS for development.

---

## Table of Contents

- [What's New in v1.3.0](#whats-new-in-v130)
- [What's New in v1.2.0](#whats-new-in-v120)
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Default Credentials](#default-credentials)
- [RC5000 Integration](#rc5000-integration)
- [RC5000 Backoffice Operations](#rc5000-backoffice-operations)
- [Refund / Payout Flow](#refund--payout-flow)
- [Multi-Device Architecture](#multi-device-architecture)
- [Transaction Reporting](#transaction-reporting)
- [API Reference](#api-reference)
- [User Roles](#user-roles)
- [Manager Panel](#manager-panel)
- [Theme System](#theme-system)
- [Deployment on i.MX8 / Yocto Linux](#deployment-on-imx8--yocto-linux)
- [Known Limitations](#known-limitations)

---

## What's New in v1.3.0

### RC5000 Backoffice Operations
Five hardware-level operations are now available from **Manager Panel → Devices → 🔧 Operations**:

| Operation | Type | Description |
|---|---|---|
| Load | 2 | Load cash manually — waits for insertion, requires manual Finish |
| Payout Denomination | 4 | Dispense specific denominations from the recycler |
| Float Denomination | 8 | Move specific denominations to the float cassette |
| Float Excess | 11 | Move excess cash to float automatically |
| Empty | 15 | Empty all cassettes |

Denomination-based operations (Payout Denomination, Float Denomination) open a picker showing the **recycler cassette** contents only — deposit and reject cassettes cannot be dispensed. Notes and Coins are split into tabs, with per-denomination +/− controls and a running total. All cash-moving operations are saved as transactions with `totalIn`, `totalOut`, and `rcStatus`.

The Load operation (type 2) requires a manual **Finish** after cash has been physically inserted. `totalIn` is accumulated from poll responses during the wait.

### Device Cash Content Viewer
**Devices → 💰 Content** opens a real-time modal showing cash levels for each RC5000, broken down by cassette type (recycler, deposit, reject), with animated fill-level indicators per denomination and multi-currency support.

### Sesami Brand Guidelines Applied
The UI has been updated to match the official Sesami brand palette:

- **Dark mode** — background `#19191F`, surface `#25252D`, borders `#3F3F46`
- **Light mode** — background `#EEEEEE`, surface `#FFFFFF`, borders `#D3D3D5`
- **Primary color** updated to Sesami Aqua `#5CE5DB` (was `#00c4b3`)
- Additional Sesami accent variables available globally: `--color-aqua`, `--color-purple` (`#A6A6FF`), `--color-yellow` (`#E7F218`)

### Neue Haas Unica Font Support
The application now supports **Neue Haas Unica** (Sesami's official typeface) as the primary font. To activate it, place the `.woff2` files in `client/public/fonts/` following the naming convention `Neue_Haas_Unica_W06_<Weight>.woff2`. Without the files the font stack falls back to **Inter** (loaded from Google Fonts). See [Theme System](#theme-system) for details.

### Adjustable Font Size
A **Font Size** setting (Small / Normal / Large) is now available under Settings → Theme. The chosen size is applied to `html { font-size }`, and all component sizes use `rem`, so the entire interface scales proportionally. The setting is persisted to the database.

| Setting | Base size |
|---|---|
| Small | 13 px |
| Normal | 15 px |
| Large | 17 px |

### Responsive Layout — 800×480 Support
The minimum supported resolution is now **800×480 px**, the native display size of common i.MX8 kiosk touchscreens:

- Top bar condensed to 56 px; user info and device label hidden below 960 px
- Category tabs with auto-hidden scrollbar; grid adapts to `minmax(110px, 1fr)` at ≤900 px
- Cart panel width 300 px (min 260 px)
- Manager sidebar condensed to 160 px; header to 52 px
- Login card adapts padding at low viewport heights (`max-height: 520px` breakpoint)
- Transaction filters wrap horizontally and scroll on small viewports
- Device action buttons use `flex-wrap` — compact at any resolution

### Settings Persistence Fix
A bug in `server/db.js` caused **primary color**, **font family**, and **font size** changes to never be saved to SQLite. The field mapping between frontend keys (`primaryColor`, `fontFamily`, `fontSize`) and database keys (`themePrimary`, `themeFont`, `themeFontSize`) has been corrected. `fontSize` is now a first-class persisted setting.

### RC5000 Session Recovery Improvement
Login recovery now also handles HTTP 500 responses with error code **636** (session already active on the device), in addition to the existing "Operación ya iniciada" string match. The server uses the persisted bearer token to cancel + logout before retrying.

### Device Form — Default Secret Key
New device forms are pre-filled value in the Secret Key field, the factory default used by Sesami devices.

---

## What's New in v1.2.0

### SQLite Database Migration
The flat-file `db.json` database was replaced with **SQLite via `better-sqlite3`**. All data is stored in `server/data/orca.db`. Schema migrations run automatically on server start.

### Multi-Device RC5000 Support
The system supports **multiple RC5000 devices** in a single store. Cashiers select a device at login; each device maintains its own session independently.

### RC5000 Bearer Token Persistence
Bearer tokens are persisted to SQLite after every successful login. On server restart, if login returns a stuck-session error, the server uses the saved token to cancel the operation and retry.

### Refund / Payout (RC5000 type 5 — PayoutAmount)
Authorized users can process **refunds** via cart refund or manual amount entry. The refund toggle is only visible to users with the `can_refund` permission.

### Manual Payment Mode
Stores without an RC5000 can operate in **manual mode** — the checkout flow skips all device steps and records the transaction directly.

### Device Error Recovery UI
When the RC5000 is unavailable, the checkout modal offers: **Retry**, **Manual payment/refund**, or **Cancel sale**.

### Force Reset (Manager Panel)
A **🔄 Reset** button lets a manager force-clear a stuck session, optionally providing a bearer token to cancel any active device operation.

### Transaction Reporting Overhaul
The Transactions tab was replaced with a filterable data table with multi-field filters, pagination, and Excel export.

### Operation Type Constants
`server/sesami/operationTypes.js` centralises all 22 RC5000 operation type codes as named constants.

---

## Overview

Two user profiles:

- **Cashier** — Product grid, shopping cart, cash checkout via RC5000, refund/payout
- **Manager** — Product catalog, device management, user management, transaction reporting, theme

The backend is Node.js/Express. The frontend is a Vue 3 SPA. In production, both are served from a single process on port 3001.

---

## Features

### Retail (Cashier) View
- Touch-optimized product grid with category filters and live search
- Shopping cart with quantity controls and running totals
- Full RC5000 cash payment flow with real-time progress display
- Banknote insertion progress bar (amount inserted vs. amount due)
- Handles all RC5000 operation states: waiting, insufficient change, complete, cancelled, error
- Change display with cashier prompt after successful payment
- **Refund / Payout** with RC5000 dispensing (type 5 — PayoutAmount)
- **Manual amount entry** via on-screen numeric keypad with optional reason
- **Manual payment mode** when no RC5000 is available
- Device error recovery: Retry / Manual / Cancel options
- Live RC5000 device status indicator (polls every 30s)

### Manager Panel
- **Products** — CRUD with image upload, emoji fallback, auto-generated item codes
- **Categories** — Add/delete product categories
- **Users** — Create/edit/delete accounts; set per-user refund permissions
- **Devices** — Multi-device config, 💰 cash content viewer, 🔧 backoffice operations, 🔄 force reset
- **Settings** — Business name, logo, currency, locale, theme (mode, color, font, font size)
- **Transactions** — Filterable, paginated data table with Excel export

### System
- Sesami brand-aligned dark and light themes
- Dynamic theming — all configurable at runtime without reload
- Adjustable font size (Small / Normal / Large)
- JWT-based authentication (8h sessions)
- SQLite database with automatic schema migrations
- Responsive layout — minimum 800×480 px (i.MX8 kiosk native)
- Cross-platform: Linux ARM64, Windows, macOS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API) + Vite 5 |
| State management | Pinia |
| Routing | Vue Router 4 |
| HTTP client | Axios |
| Backend | Node.js + Express 4 |
| Authentication | JWT (`jsonwebtoken` + `bcryptjs`) |
| File uploads | Multer |
| Database | SQLite (`better-sqlite3`) |
| RC5000 comms | Axios + custom HMAC-SHA256 JWT generator |
| Excel export | SheetJS (loaded client-side on demand) |
| Dev tooling | Nodemon + Concurrently |

---

## Architecture

```
Browser / Kiosk (Chromium)
        │
        ▼
┌─────────────────────────────────┐
│  Vue 3 SPA  (port 5173 dev)     │
│  RetailView        — cashier    │
│  ManagerView       — back office│
│  CheckoutModal     — RC5000 pay │
│  ManualAmountModal — refund amt │
│  DeviceContentModal  — contents │
│  DeviceOperationsModal — ops    │
│  RC5000Status      — polling    │
└────────────┬────────────────────┘
             │ HTTP /api/*
             ▼
┌─────────────────────────────────┐
│  Express API  (port 3001)       │
│  /api/auth         JWT auth     │
│  /api/items        CRUD         │
│  /api/categories   CRUD         │
│  /api/users        CRUD         │
│  /api/settings     Config       │
│  /api/sesami       RC5000 proxy │
└────────────┬────────────────────┘
             │ HTTPS (local network, self-signed cert)
             ▼
┌─────────────────────────────────┐
│  Sesami SafePay RC5000          │
│  POS API v3                     │
│  https://<ip>:4443              │
└─────────────────────────────────┘
```

In production, Express serves the Vite build statically — single process on port 3001.

---

## Project Structure

```
demo-pos/
│
├── package.json              # Root — concurrently dev/build scripts
├── .gitignore
├── README.md
│
├── client/
│   ├── public/
│   │   └── fonts/            # Place Neue_Haas_Unica_W06_*.woff2 files here
│   ├── index.html            # @font-face declarations (commented until files present)
│   ├── vite.config.js        # Dev proxy → :3001
│   └── src/
│       ├── stores/
│       │   ├── auth.js                   # User session + deviceId
│       │   ├── cart.js                   # Cart + refund mode
│       │   └── theme.js                  # CSS vars, font size, currency formatter
│       ├── components/
│       │   ├── ProductCard.vue
│       │   ├── CartPanel.vue             # Cart + refund toggle + manual amount
│       │   ├── CheckoutModal.vue         # Multi-phase RC5000 payment/refund modal
│       │   ├── ManualAmountModal.vue
│       │   ├── DeviceContentModal.vue    # Cash contents viewer
│       │   ├── DeviceOperationsModal.vue # Backoffice operations
│       │   └── RC5000Status.vue
│       └── views/
│           ├── LoginView.vue
│           ├── RetailView.vue
│           └── ManagerView.vue           # 6-tab back office
│
└── server/
    ├── index.js               # Entry point
    ├── database.js            # SQLite schema + migrations (v1–v4)
    ├── db.js                  # Data access helpers
    ├── data/
    │   └── orca.db            # SQLite DB (auto-created, gitignored)
    ├── uploads/               # Product images + logos
    ├── routes/
    │   ├── auth.js
    │   ├── items.js
    │   ├── categories.js
    │   ├── users.js           # + canRefund field
    │   ├── settings.js
    │   └── sesami.js          # All RC5000 proxy routes (16 endpoints)
    └── sesami/
        ├── jwt.js             # HMAC-SHA256 JWT for RC5000 login
        ├── client.js          # RC5000 client + token persistence + backoffice ops
        └── operationTypes.js  # 22 operation type constants
```

---

## Prerequisites

- **Node.js v18+** (tested on v24 LTS)
- npm v8+
- Network access to the RC5000 (same LAN or direct Ethernet)
- ARM64 deployment: `node-gyp` build tools required for `better-sqlite3`

---

## Installation

```bash
git clone https://github.com/cgvispe/orca-pos.git
cd orca-pos
npm run install:all
```

### Upgrading from v1.2.0
Replace files and restart — no manual database steps needed. Schema migrations run automatically. The only optional step is placing Neue Haas Unica `.woff2` files in `client/public/fonts/` if you have a valid web font license.

### Upgrading from v1.0.0
Replace files and restart. The server migrates `orca.db` automatically. The old `db.json` is no longer used and can be deleted.

### SQLite Native Binaries (`better-sqlite3`)

`better-sqlite3` compiles a native `.node` addon during `npm install`. It is the only package in the project requiring build tools — all other dependencies are pure JavaScript.

#### Linux / ARM64 (i.MX8, Yocto)

```bash
# Ensure these are available in your Yocto image
python3 make gcc g++
```

If the board lacks build tools, **pre-build on a matching ARM64 machine** and rsync the result. Do not copy `node_modules` from an x86 machine — native binaries are architecture-specific and will crash with `invalid ELF header`.

```bash
rsync -av server/node_modules user@<board-ip>:/opt/demo-pos/server/
```

#### Windows

Requires **Visual Studio Build Tools** with the C++ workload:

```bash
npm install --global --production windows-build-tools
```

Or install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) manually.

#### macOS

```bash
xcode-select --install
```

#### Troubleshooting

```bash
# Rebuild if Node.js version changed or ELF error on startup
cd server && npm rebuild better-sqlite3

# Permission denied on binaries (Linux)
chmod +x node_modules/.bin/* server/node_modules/.bin/* client/node_modules/.bin/*

# CERT_NOT_YET_VALID — fix system clock
sudo timedatectl set-ntp true
```

---

## Configuration

RC5000 devices are configured from **Manager Panel → Devices → Add Device**:

| Field | Description |
|---|---|
| Name | Display name (e.g. "Caja 1") |
| IP | Device IP on the local network |
| Port | `4443` (HTTPS default) |
| POS ID | Identifier registered with Sesami |
| Username | Sesami username for this POS |
| Secret Key | 256-bit HMAC secret from Sesami (default: `your-256-bit-secret`) |
| HTTPS | `true` by default |
| Default | Pre-selected at cashier login |

---

## Running the Application

```bash
# Development
npm run dev
# Frontend: http://localhost:5173  Backend: http://localhost:3001/api

# Production
npm run build
NODE_ENV=production node server/index.js
# http://<host>:3001
```

---

## Default Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `password` | Manager |
| `cashier` | `password` | Cashier |

> ⚠️ Change these before any production deployment.

---

## RC5000 Integration

### HTTPS and Self-Signed Certificate
The RC5000 uses HTTPS on port 4443 with a self-signed cert. The Node.js client uses `rejectUnauthorized: false`. The browser never connects to the device directly.

### JWT Authentication
- **Base64url** encoded header + payload
- **HMAC-SHA256** signature using the Sesami secret key
- Expiration must be ≥5 min in the future (app uses +10 min)
- Login returns a bearer token used for all subsequent calls in that session
- **One session per device** — logout is always called after every terminal operation

### Bearer Token Persistence
Token is saved to SQLite (`settings` table, key `session_<deviceId>`) after every successful login. On server restart, if login returns "Operación ya iniciada" or error code 636, the server uses the persisted token to cancel + logout before retrying.

### PayIn Flow (type 10)

```
POST /api/sesami/payin { deviceId, amount }
  → login → start op type 10
  → poll GET /api/sesami/operation/:deviceId/:operationId every 1.5s
      status 1/2 → keep polling
      status 4/5/8 → finish → logout → save tx
      status 7 → offer Finish or Cancel to cashier
      status 3/9/6 → logout
```

### Operation Status Codes

| Code | Meaning | Intermediate |
|---|---|---|
| 1 | Started | ✓ |
| 2 | Processing | ✓ |
| 3 | Cancelled | — |
| 4 | Finished | — |
| 5 | Finished by system | — |
| 6 | Finished with error | — |
| 7 | Amount not available | ✓ |
| 8 | Finished incomplete | — |
| 9 | Cancelled incomplete | — |

### Operation Type Constants (`operationTypes.js`)

```js
PayoutAmount: 5,  PayinAmount: 10,  Collection: 17,  Empty: 15,
// ... and 18 more — see server/sesami/operationTypes.js
```

---

## RC5000 Backoffice Operations

Available from **Manager Panel → Devices → 🔧 Operations**. Manager role required.

### Available Operations

| Operation | Type | Denomination picker | Manual Finish | Saves tx |
|---|---|---|---|---|
| Load | 2 | — | ✓ (required) | ✓ |
| Payout Denomination | 4 | ✓ recycler only | — | ✓ |
| Float Denomination | 8 | ✓ recycler only | — | — |
| Float Excess | 11 | — | — | — |
| Empty | 15 | — | — | — |

### Denomination Picker
Fetches current contents via `GET /api/sesami/contents/:deviceId`. Only the **recycler cassette** is shown — deposit and reject cassettes cannot be dispensed. Notes and Coins are in separate tabs. Each denomination shows its current available level; the maximum selectable quantity is capped at what is available.

### Load Operation
Starts the operation and waits for the operator to insert cash physically. A **Finish** button is shown during polling — the manager presses it once insertion is complete. `totalIn` is accumulated from poll responses throughout the wait period.

### API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/sesami/contents/:deviceId` | 👔 | Current cash by cassette and denomination |
| POST | `/sesami/backoffice/start` | 👔 | Start a backoffice operation |
| POST | `/sesami/backoffice/finish` | 👔 | Finish operation; optionally save transaction |

---

## Refund / Payout Flow

Operation type **5 (PayoutAmount)** — RC5000 dispenses cash.

### Permissions
Refund toggle visible only when `canRefund === true`. Managers always have it. Configurable per cashier in Manager Panel → Users.

### Workflow 1 — Cart Refund
1. Add items to cart → enable ↩ Refund toggle
2. Checkout button shows "↩️ Dispense"
3. `POST /api/sesami/payout` → type 5 operation
4. Modal shows amber "Dispensing cash…" with totalOut progress bar
5. `POST /api/sesami/operation/finish-refund` → save tx → logout → clear cart

### Workflow 2 — Manual Amount
1. Click **+ Add manual amount** → numeric keypad → optional reason
2. Enable refund toggle → proceed as above

### Manual Refund (no device)
Device-error screen offers **Manual refund** → saves tx with `isManual: true`, `rcStatus: null`.

---

## Multi-Device Architecture

- One server + one SQLite DB per store, multiple RC5000 devices
- Cashiers select device at login (or default is pre-selected)
- Sessions tracked per-device in memory + SQLite
- Server only logs out sessions it owns — never interrupts another terminal's active transaction
- **Force Reset**: Manager Panel → Devices → 🔄 Reset clears stuck sessions

---

## Transaction Reporting

### Columns

| Column | Description |
|---|---|
| Date | Timestamp |
| ID | Short UUID |
| User | Who processed the transaction |
| Device | RC5000 name or "Manual" |
| Operation | e.g. "Payin Amount", "Payout Amount", "Load" |
| Source | 🏧 RC5000 / 💵 Manual |
| RC Status | Finished / Cancelled / Error / Incomplete |
| Total In | Cash inserted (€) |
| Total Out | Cash dispensed (€) |
| Total | Net (positive = sale, negative = refund) |

### Filters (combinable)
- **Date** — calendar picker with month navigation
- **Operation** — multi-select (includes all backoffice types)
- **Source** — All / RC5000 / Manual
- **RC Status** — multi-select
- **User** — multi-select (all roles)

### Pagination & Export
Up to 100 rows per page. **⬇ Export Excel** downloads all filtered rows as `.xlsx` via SheetJS.

---

## API Reference

`/api` prefix. ✓ = JWT required. 👔 = manager role required.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Returns JWT + user |
| GET | `/auth/me` | ✓ | Current user |

### Items · Categories · Users · Settings
Standard CRUD. POST / PUT / DELETE require manager role.

### RC5000

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/sesami/heartbeat` | — | Ping |
| GET | `/sesami/status/:deviceId` | — | Device status |
| POST | `/sesami/payin` | ✓ | Start PayinAmount (type 10) |
| POST | `/sesami/payout` | ✓ | Start PayoutAmount (type 5) |
| GET | `/sesami/operation/:deviceId/:operationId` | ✓ | Poll operation status |
| POST | `/sesami/operation/finish` | ✓ | Finish payin, save tx |
| POST | `/sesami/operation/finish-refund` | ✓ | Finish payout, save tx |
| POST | `/sesami/operation/finish-manual` | ✓ | Record manual tx |
| POST | `/sesami/operation/cancel` | ✓ | Cancel operation |
| POST | `/sesami/logout` | ✓ | Force logout device |
| POST | `/sesami/force-reset/:deviceId` | 👔 | Clear stuck session |
| GET | `/sesami/transactions` | ✓ | History (filterable, paginated) |
| GET | `/sesami/contents/:deviceId` | 👔 | Cash contents by cassette |
| POST | `/sesami/backoffice/start` | 👔 | Start backoffice operation |
| POST | `/sesami/backoffice/finish` | 👔 | Finish backoffice operation |

#### `/sesami/transactions` query params
`date`, `operationType` (CSV ints), `status` (CSV), `rcStatus` (CSV ints), `cashierId` (CSV), `isManual` (bool), `page`, `limit` (max 100)

---

## User Roles

| Capability | Cashier | Manager |
|---|---|---|
| View products & cart | ✓ | ✓ |
| Process cash payment | ✓ | ✓ |
| Process refund / payout | if `canRefund` | ✓ |
| Select RC5000 device at login | ✓ | ✓ |
| Manage products & categories | — | ✓ |
| Manage users (+ refund permissions) | — | ✓ |
| Configure / reset RC5000 devices | — | ✓ |
| View cash contents | — | ✓ |
| Run backoffice operations | — | ✓ |
| View & export transactions | — | ✓ |

---

## Manager Panel

| Tab | Description |
|---|---|
| Products | CRUD, image upload, auto item codes |
| Categories | Add/delete |
| Users | CRUD + canRefund permission per user |
| Devices | Multi-device config + 💰 Content + 🔧 Operations + 🔄 Force Reset |
| Settings | Business info, logo, currency, locale, theme (mode, color, font, font size) |
| Transactions | Filterable table + Excel export |

---

## Theme System

CSS custom properties are injected by the Pinia theme store at runtime — instant repaint with no page reload.

### Dark Mode (Sesami brand)

```
--color-bg:        #19191F   (Sesami Gray 1)
--color-surface:   #25252D   (Sesami Gray 2)
--color-surface-2: #36363E   (Sesami Gray 3)
--color-border:    #3F3F46   (Sesami Gray 4)
--color-text:      #F6F6F7   (Sesami Gray 10)
--color-primary:   #5CE5DB   (Sesami Aqua)
```

### Light Mode (Sesami brand)

```
--color-bg:        #EEEEEE   (Sesami Light Gray)
--color-surface:   #FFFFFF
--color-surface-2: #F6F6F7
--color-border:    #D3D3D5   (Sesami Gray 8)
--color-text:      #19191F   (Sesami Gray 1)
--color-primary:   #5CE5DB   (Sesami Aqua)
```

### Sesami Accent Colors

```
--color-aqua:    #5CE5DB
--color-purple:  #A6A6FF
--color-yellow:  #E7F218
```

### Font Size

All component sizes use `rem`, so changing `html { font-size }` scales the entire interface:

| Setting | Base size |
|---|---|
| Small | 13 px |
| Normal | 15 px |
| Large | 17 px |

### Neue Haas Unica

Place licensed `.woff2` files in `client/public/fonts/` to activate:

```
Neue_Haas_Unica_W06_Light.woff2
Neue_Haas_Unica_W06_Regular.woff2
Neue_Haas_Unica_W06_Medium.woff2
Neue_Haas_Unica_W06_Bold.woff2
```

Then uncomment the `@font-face` block in `client/index.html`. Without these files the stack falls back to **Inter** (Google Fonts). Neue Haas Unica is a commercial typeface available from [fonts.com](https://www.fonts.com) or [myfonts.com](https://www.myfonts.com).

---

## Deployment on i.MX8 / Yocto Linux

```bash
# On dev machine
npm run build
rsync -av --exclude='node_modules' --exclude='client/dist' --exclude='server/data' \
  . user@<board-ip>:/opt/demo-pos

# On the board
cd /opt/demo-pos
npm install --prefix server --omit=dev
NODE_ENV=production node server/index.js

# Kiosk — 800×480 native resolution
chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:3001
```

### systemd

```ini
[Unit]
Description=ORCA POS Server
After=network.target

[Service]
WorkingDirectory=/opt/demo-pos
ExecStart=/usr/bin/node server/index.js
Environment=NODE_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

---

## Known Limitations

- **One active operation per device at a time** — concurrent checkouts on the same device must queue
- **No HTTPS on the POS server** — use nginx for remote access
- **Image storage** — `server/uploads/` is local filesystem, excluded from git; back up separately
- **Token persistence** — per-device, per-server-instance; multi-server setups need a shared token store
- **Neue Haas Unica** — commercial typeface not included; falls back to Inter without valid `.woff2` files

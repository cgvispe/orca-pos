# ORCA POS — On-site Recycler Cash Application

> Sesami SafePay RC5000 Integration

A full-featured Point of Sale web application with native integration with the **Sesami SafePay RC5000** cash recycler. Designed for touch screens on **Linux ARM64 i.MX8 boards** (Yocto), and fully compatible with Windows and macOS for development.

---

## Table of Contents

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
- [API Reference](#api-reference)
- [User Roles](#user-roles)
- [Manager Panel](#manager-panel)
- [Theme System](#theme-system)
- [Deployment on i.MX8 / Yocto Linux](#deployment-on-imx8--yocto-linux)
- [Known Limitations](#known-limitations)

---

## Overview

This application provides two user profiles:

- **Cashier** — Product grid, shopping cart, and full cash checkout via the RC5000
- **Manager** — Product catalog management, RC5000 connection configuration, user management, theme customization, and transaction history

The backend is a Node.js/Express API. The frontend is a Vue 3 SPA. In production on the ARM64 board, both are served from a single process. In development, they run separately with Vite's HMR proxy.

---

## Features

### Retail (Cashier) View
- Touch-optimized product grid with category filters and live search
- Shopping cart with quantity controls and running totals
- Full RC5000 cash payment flow with real-time progress display
- Banknote insertion progress bar (amount inserted vs. amount due)
- Handles all RC5000 operation states: waiting, insufficient change, complete, cancelled, error
- Change display with cashier prompt after successful payment
- Live RC5000 device status indicator in the top bar (polls every 30s)

### Manager Panel
- **Products** — CRUD with image upload, emoji fallback, auto-generated item codes
- **Categories** — Add/delete product categories used in filters and item classification
- **Cashiers** — Create, edit and delete cashier accounts
- **Settings** — Business name, logo, currency, locale, RC5000 connection parameters, theme
- **Transactions** — Full history of completed cash transactions

### System
- Sesami-inspired dark theme by default (teal `#00c4b3` accent, Sesami logo pre-loaded)
- Dynamic theming: primary color, font family, logo — all configurable at runtime without reload
- JWT-based authentication (8h sessions)
- Flat JSON file database (no external DB required)
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
| Database | JSON flat file (custom helper) |
| RC5000 comms | Axios + custom HMAC-SHA256 JWT generator |
| Dev tooling | Nodemon + Concurrently |

---

## Architecture

```
Browser / Kiosk (Chromium)
        │
        ▼
┌─────────────────────────────────┐
│  Vue 3 SPA  (port 5173 dev)     │
│  RetailView    — cashier POS    │
│  ManagerView   — back office    │
│  CheckoutModal — RC5000 flow    │
│  RC5000Status  — live polling   │
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
             │ HTTPS (local network, self-signed cert accepted)
             ▼
┌─────────────────────────────────┐
│  Sesami SafePay RC5000          │
│  POS API v3                     │
│  https://<ip>:4443              │
└─────────────────────────────────┘
```

In production, Express serves the Vite build statically — a single process on port 3001.

---

## Project Structure

```
demo-pos/
│
├── package.json              # Root — concurrently dev/build scripts
├── .gitignore
├── README.md
│
├── client/                   # Vue 3 + Vite frontend
│   ├── index.html
│   ├── vite.config.js        # Dev proxy → :3001
│   ├── package.json
│   └── src/
│       ├── main.js
│       ├── App.vue            # Global CSS variables + theme bootstrap
│       ├── api/
│       │   └── index.js       # Axios instance with JWT interceptor + 401 handler
│       ├── router/
│       │   └── index.js       # Route guards (auth + role check)
│       ├── stores/
│       │   ├── auth.js        # User session (login, logout, restore)
│       │   ├── cart.js        # Shopping cart (add, remove, qty, total)
│       │   └── theme.js       # CSS variable injection + currency formatter
│       ├── components/
│       │   ├── ProductCard.vue     # Touch-friendly product tile
│       │   ├── CartPanel.vue       # Right sidebar cart with checkout button
│       │   ├── CheckoutModal.vue   # 6-phase RC5000 payment modal
│       │   └── RC5000Status.vue    # Live device status indicator
│       └── views/
│           ├── LoginView.vue
│           ├── RetailView.vue      # Main POS screen
│           └── ManagerView.vue     # Back-office panel (5 tabs)
│
└── server/                   # Node.js + Express backend
    ├── index.js               # Entry point — mounts routes, serves static in prod
    ├── db.js                  # JSON database read/write helper
    ├── package.json
    ├── data/
    │   └── db.json            # Database: users, items, categories, settings, transactions
    ├── uploads/               # Product images and logos (excluded from git)
    │   └── .gitkeep
    ├── routes/
    │   ├── auth.js            # Login, logout, /me
    │   ├── items.js           # Product CRUD + Multer image upload
    │   ├── categories.js      # Category add/list/delete
    │   ├── users.js           # Cashier account CRUD
    │   ├── settings.js        # App config + logo upload
    │   └── sesami.js          # RC5000 proxy: payin, poll, finish, cancel, logout
    └── sesami/
        ├── jwt.js             # Custom HMAC-SHA256 JWT generator for RC5000 login
        └── client.js          # RC5000 HTTP client with session management
```

---

## Prerequisites

- **Node.js v18 or higher** (tested on v24 LTS)
- npm v8+
- Network access to the RC5000 device (same LAN or direct Ethernet)
- For ARM64 deployment: Linux with a Node.js ARM64 build

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/cgvispe/orca-pos.git
cd orca-pos

# 2. Install all dependencies (root + server + client) in one command
npm run install:all
```

> ⚠️ `node_modules` are not included in the repository. You must run `npm run install:all` after every fresh clone — on every platform (Windows, macOS, Linux/ARM64). npm will install the correct native binaries for your OS automatically.

### Troubleshooting on Linux / ARM64

**Permission denied on `nodemon`, `vite` or `concurrently`**

This happens when `node_modules` were copied from Windows (NTFS does not preserve Unix execute permissions). Fix:

```bash
chmod +x node_modules/.bin/*
chmod +x server/node_modules/.bin/*
chmod +x client/node_modules/.bin/*
```

Or do a clean reinstall (preferred):

```bash
rm -rf node_modules server/node_modules client/node_modules
npm run install:all
```

**`CERT_NOT_YET_VALID` during npm install**

The system clock is wrong. npm rejects SSL certificates if the board date is in the past. Fix:

```bash
# Sync with NTP (requires internet)
sudo timedatectl set-ntp true

# Or set manually
sudo date -s "2026-03-02 10:00:00"
```

Then re-run `npm run install:all`.

---

## Configuration

Configure the RC5000 connection before running. Two options:

### Option A — Edit `db.json` directly (before first run)

Open `server/data/db.json` and update the `settings.sesami` block:

```json
"sesami": {
  "ip": "192.168.1.100",
  "port": "4443",
  "useHttps": true,
  "posId": "POS1",
  "username": "DEMPOS",
  "secretKey": "your-256-bit-secret-key"
}
```

| Field | Description |
|---|---|
| `ip` | IP address of the RC5000 on your local network |
| `port` | `4443` for HTTPS (default), `3000` for HTTP |
| `useHttps` | `true` by default — RC5000 uses a self-signed cert, which is accepted automatically |
| `posId` | POS identifier registered with Sesami |
| `username` | Username registered with Sesami for this POS |
| `secretKey` | 256-bit HMAC secret provided by Sesami |

### Option B — Manager Panel (after first run)

Log in as `admin` → **Manager Panel → Settings → RC5000 Connection** → fill in the fields → **Test Connection** to verify with the current form values (without saving) → **Save Changes**.

> **Note:** Test Connection uses the values currently entered in the form, not the previously saved settings. This allows you to verify new credentials before committing them.

---

## Running the Application

### Development (Windows / macOS / Linux)

```bash
npm run dev
```

Starts server and client concurrently:
- Frontend (Vite HMR): http://localhost:5173
- Backend API: http://localhost:3001/api

### Production (i.MX8 ARM64 board)

```bash
# Build the Vue frontend (run on a dev machine or on the board)
npm run build

# Start — serves the built frontend + API on port 3001
NODE_ENV=production node server/index.js
```

Access at `http://<board-ip>:3001`

---

## Default Credentials

| Username | Password | Role |
|---|---|---|
| `admin` | `password` | Manager |
| `cashier` | `password` | Cashier |

> ⚠️ Change these passwords before any production or on-site deployment. Passwords are bcrypt-hashed in `db.json`.

---

## RC5000 Integration

### HTTPS and Self-Signed Certificate

The RC5000 communicates over **HTTPS on port 4443** using a self-signed certificate. The Node.js HTTP client is configured with `rejectUnauthorized: false` to accept it without requiring manual certificate installation. The browser does not connect to the device directly — all communication goes through the Express backend proxy.

### JWT Authentication

The RC5000 POS API v3 uses a **non-standard JWT** for login:

- Header and payload encoded with **base64url** (not standard base64)
- Signed with **HMAC-SHA256** using the Sesami-provided secret key
- Payload must include `{ username, pos, expiration }` where `expiration` is a Unix timestamp **at least 5 minutes in the future** (device enforces a 5-min margin). This app uses +10 minutes.
- `POST /login` returns a **bearer token** used for all subsequent requests
- ⚠️ The device allows **only one active session at a time**. Logout is **always** performed after every operation — success, cancel, or error — to free the device for the next transaction.

### Payment Flow (PayIn Amount — operation type 10)

```
Cashier clicks Pay
      │
      ▼
POST /api/sesami/payin  { amount }
      │  server logs into RC5000, starts operation type 10
      ▼
GET /api/sesami/operation/:id  (every 1.5 seconds)
      │  polls device status, extracts totalIN from currencies array
      ▼
  ┌───────────────────────────────────────────────────────┐
  │  status 1/2  → keep polling                           │
  │  status 4/5  → SUCCESS  → finish → LOGOUT → save tx   │
  │  status 8    → SUCCESS  → finish → LOGOUT → save tx   │
  │  status 7    → NO CHANGE → cashier: Finish or Cancel  │
  │  status 3/9  → CANCELLED by machine → LOGOUT          │
  │  status 6    → ERROR → LOGOUT                         │
  └───────────────────────────────────────────────────────┘

  Cashier presses Cancel at any time:
      → POST /operation/cancel (best-effort) → LOGOUT
```

**Logout guarantee:** Every terminal path — success, cashier cancel, machine cancel, or error — calls `POST /api/sesami/logout`. This endpoint is separate from the operation cancel call so that logout succeeds even if the operation is already in a terminal state on the device.

**Amounts:** All amounts in the RC5000 API are in **cents (integer)**. €20.00 = `2000`.

### Operation Status Codes

| Code | Meaning | App behaviour |
|---|---|---|
| `1` | Started | Keep polling |
| `2` | Processing | Keep polling |
| `3` | Cancelled by machine | Logout, show cancelled |
| `4` | Finished | Finish, logout, save transaction |
| `5` | Finished by system | Finish, logout, save transaction |
| `6` | Error | Logout, show error |
| `7` | Amount not available (insufficient change) | Cashier chooses: Finish or Cancel |
| `8` | Finished incomplete | Finish, logout, save transaction |
| `9` | Cancelled incomplete | Logout, show cancelled |

### Device Status Codes (live indicator)

| Code | Meaning | Indicator colour |
|---|---|---|
| `1`, `2` | Ready / Initialized | 🟢 Green (pulsing) |
| `4`, `5`, `11` | Session active / In use | 🟠 Orange (pulsing) |
| `12` | Warning | 🟠 Orange (pulsing) |
| `0`, `13` | Error | 🔴 Red (pulsing) |
| — | Unreachable / not configured | ⚫ Grey |

---

## API Reference

All endpoints are prefixed with `/api`. Endpoints marked ✓ require `Authorization: Bearer <token>`. Endpoints marked 👔 additionally require the `manager` role.

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | ✓ | Current user info |

### Items
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/items` | — | Active items only |
| GET | `/items/all` | 👔 | All items including inactive |
| POST | `/items` | 👔 | Create item (`multipart/form-data`) |
| PUT | `/items/:id` | 👔 | Update item |
| DELETE | `/items/:id` | 👔 | Soft-delete (sets `active=false`) |

### Categories
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/categories` | — | All categories |
| POST | `/categories` | 👔 | Add a category |
| DELETE | `/categories/:name` | 👔 | Remove a category |

### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users` | 👔 | All cashier accounts |
| POST | `/users` | 👔 | Create cashier |
| PUT | `/users/:id` | 👔 | Update name / username / password |
| DELETE | `/users/:id` | 👔 | Delete cashier (managers are protected) |

### Settings
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/settings` | — | Public settings (secret key omitted) |
| PUT | `/settings` | 👔 | Update settings (`multipart/form-data`, optional logo) |
| GET | `/settings/sesami-full` | 👔 | Settings including RC5000 secret key |

### RC5000
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/sesami/heartbeat` | — | Ping device — no login required |
| GET | `/sesami/status` | — | Full device status — no login required |
| POST | `/sesami/test-connection` | — | Test connectivity using form values `{ ip, port, useHttps }` without saving |
| POST | `/sesami/payin` | ✓ | Login to device + start PayIn Amount operation |
| GET | `/sesami/operation/:id` | ✓ | Poll operation status |
| POST | `/sesami/operation/finish` | ✓ | Finish operation, save transaction, logout |
| POST | `/sesami/operation/cancel` | ✓ | Cancel operation (best-effort) |
| POST | `/sesami/logout` | ✓ | Force logout — always called after any terminal state |
| GET | `/sesami/transactions` | ✓ | Transaction history (newest first) |

---

## User Roles

| Capability | Cashier | Manager |
|---|---|---|
| View products & cart | ✓ | ✓ |
| Process cash payment | ✓ | ✓ |
| Manage products | — | ✓ |
| Manage categories | — | ✓ |
| Manage cashier accounts | — | ✓ |
| Configure RC5000 | — | ✓ |
| Customize theme & logo | — | ✓ |
| View transaction history | — | ✓ |

---

## Manager Panel

### Products tab
- Create, edit, disable/enable products
- Upload a product image (PNG, JPG, WebP); displayed with `object-fit: cover`
- Emoji fallback when no image is uploaded
- **Auto-generated item codes**: format `CAT001` (first 3 letters of category + sequential counter)
- Code regenerates automatically when the category is changed (reclassification), excluding the item itself from the counter to avoid inflation
- Codes remain manually editable at any time

### Categories tab
- Add and delete categories independently of items
- Deleting a category does not affect its items — they retain the category name

### Cashiers tab
- Create cashier accounts (name, username, password)
- Edit display name and password; username is immutable after creation
- Manager accounts are protected and cannot be modified here

### Settings tab
- **Business**: name, logo (displayed at 80×80px), currency code, currency symbol, locale
- **RC5000**: IP, port (default `4443`), POS ID, username, secret key, HTTPS toggle (default `true`), plus **Test Connection** — tests the current form values without requiring a save first
- **Theme**: dark/light mode, primary color (hex picker), font family (Inter, Poppins, Roboto)

---

## Theme System

The theme is applied entirely via **CSS custom properties** injected by the Pinia theme store. The UI repaints instantly when settings change — no page reload needed.

Default palette (Sesami-inspired dark):

```
--color-bg:        #090b0f    near-black background
--color-surface:   #0f1117    card and panel surfaces
--color-surface-2: #15181f    inputs and secondary backgrounds
--color-border:    #1e2330    very subtle borders
--color-primary:   #00c4b3    Sesami teal accent
```

The Sesami logo is embedded as a default and appears in the top bar and login screen out of the box, without any configuration. It can be replaced via Manager Panel → Settings → Store Logo.

A soft teal radial glow is applied in the bottom-right corner of the screen, matching the Sesami web app aesthetic. The login screen adds a second glow in the top-left.

---

## Deployment on i.MX8 / Yocto Linux

Tested on NXP i.MX8 ARM64 running Yocto Linux (Scarthgap).

```bash
# 1. Build the frontend on a development machine
npm run build

# 2. Copy project to the board (skip node_modules and build artifacts)
rsync -av \
  --exclude='node_modules' \
  --exclude='client/dist' \
  --exclude='client/.vite' \
  . user@<board-ip>:/opt/demo-pos

# 3. On the board — install production server dependencies only
cd /opt/demo-pos
npm install --prefix server --omit=dev

# 4. Copy the client build to the board separately
scp -r client/dist user@<board-ip>:/opt/demo-pos/client/dist

# 5. Start the server
NODE_ENV=production node server/index.js

# 6. Launch Chromium in kiosk mode
chromium-browser --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  http://localhost:3001
```

For autostart on boot, create a systemd service:

```ini
# /etc/systemd/system/demo-pos.service
[Unit]
Description=Demo POS Server
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

```bash
systemctl enable demo-pos
systemctl start demo-pos
```

---

## Known Limitations

- **Single RC5000 session**: One active device session at a time. Concurrent checkouts from multiple browsers are not supported.
- **Flat file database**: `db.json` is suitable for demo and low-volume use. For higher volume, consider migrating to SQLite.
- **No HTTPS on the POS server**: Acceptable for kiosk use on a local network. For remote access, place nginx in front.
- **Manager accounts**: Only `admin` is provided by default. Additional manager accounts must be added manually to `db.json` (bcrypt-hash the password first).
- **Image storage**: Uploaded files are stored in `server/uploads/` on the local filesystem and are excluded from git. Back up this folder separately.

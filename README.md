# dafuq

**dafuq** is an open source **application framework** for building data-driven web apps. It ships with a **built-in dashboard builder**: a drag-and-drop canvas, a library of widgets (gauges, charts, maps, labels, and more), responsive breakpoints, and optional live data from HTTP APIs.

Use it as a starting point for internal tools, observability-style UIs, or any product that needs a polished, editable dashboard without stitching a separate BI or page builder.

## What you get

- **Dashboard editor** — Place, resize, move, and configure widgets on a grid; lock the layout for view-only use or keep it editable.
- **Widget system** — Extensible registry of widget types with per-widget settings (sources, formatting, time windows, and more).
- **Single deployable app** — One **Go** server can serve the production **Vite + SolidJS** frontend and the **API** surface on the same origin.
- **Authentication** — **WorkOS** (AuthKit / User Management) for sign-in, JWT access tokens, refresh, and protected routes.
- **API gateway** — JSON configuration maps **URL prefixes** to either **local handler plugins** or **upstream HTTP APIs** with **priority-ordered failover**. Every configured route expects a valid **Bearer JWT**; the same token is forwarded upstream when proxying.
- **Sensible defaults** — Dark, neon-accented UI theme; environment-based server and static file configuration.

## Architecture (high level)

| Layer | Role |
|--------|------|
| **Frontend** (`src/`) | SolidJS + TypeScript, Vite build to `dist/`. Dashboard state, widget registry, layout, and fetch helpers for widget data. |
| **Backend** (`backend/`) | HTTP server: health and auth endpoints, JWT validation, optional JSON-defined proxy + plugin routes, static SPA fallback. |
| **Auth** | WorkOS-issued JWTs validated with JWKS; `Authorization: Bearer <token>` for protected `/api/v1/*` and for configured gateway routes. |

## Prerequisites

- **Node.js** (for the frontend; use a current LTS).
- **Go 1.26+** (for the backend server).
- A **WorkOS** account and app if you use the bundled auth flows.

## Quick start (development)

**Frontend (hot reload):**

```bash
npm install
npm run dev
```

**Backend (API + optional static app):**

From the `backend/` directory, set environment variables (see `backend/env.example`) and run:

```bash
go run ./cmd/server
```

Point `DAFUQ_STATIC_DIR` at your Vite `dist/` folder when you want the Go binary to serve the built UI (typical for production).

**Production-style flow:**

```bash
npm run build
# Then run the server with DAFUQ_STATIC_DIR pointing at ../dist (or your deploy path)
```

## Configuration (environment)

| Variable | Purpose |
|----------|---------|
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI` | WorkOS User Management / AuthKit. |
| `DAFUQ_ADDR` | Listen address (defaults e.g. `:8080` or `:8443` with TLS). |
| `DAFUQ_STATIC_DIR` | Directory of the built SPA (e.g. `../dist`). |
| `DAFUQ_TLS_CERT_FILE`, `DAFUQ_TLS_KEY_FILE` | Optional TLS. |
| `DAFUQ_API_PROXY_CONFIG_FILE` | Path to a JSON file that defines **listen paths**, **plugins**, and **upstream backends** (see `backend/api-proxy-routes.example.json`). |
| `DAFUQ_POST_LOGIN_REDIRECT` | After OAuth callback (non-JSON), where to send the browser (tokens in URL fragment). |
| `DAFUQ_COOKIE_SECURE` | Override `Secure` on cookies (e.g. for local HTTP). |

Details and optional keys are in `backend/env.example`.

## API gateway and plugins

- Routes are defined in JSON (see **`backend/api-proxy-routes.example.json`**).
- **Plugin routes** use a **plugin** name and handle traffic locally (for example, included sample metrics under a configured `listen_path`).
- **Proxy routes** define **`backends` in order**: the gateway tries each until a non-5xx response (failover).
- Set **`DAFUQ_API_PROXY_CONFIG_FILE`** to the path of that JSON file for the process.

## Project layout

```
backend/          # Go server (auth, static files, API gateway, plugins)
src/              # SolidJS app: dashboard, widgets, layout, config UI
```

## Contributing

Issues and pull requests are welcome. Please keep changes focused and consistent with existing patterns in the repo.

## License

This project is released under the **GNU General Public License v2.0** — see the [`LICENSE`](LICENSE) file in this repository (SPDX: `GPL-2.0-only`).

## Name

**dafuq** is the framework’s name. Fork it, rename it, or build your product on top—this repo is meant as a **base** you can own and ship.

---

*Built for people who want a real dashboard in the box, not a blank page and a week of wiring.*

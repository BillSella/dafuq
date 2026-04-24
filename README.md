# dafuq

TODO: This is currently AI generated garbage to be replaced.

**dafuq** is an open source **application framework** for building data-driven web apps. It ships with a **built-in dashboard builder**: a drag-and-drop canvas, a library of widgets (gauges, charts, maps, labels, and more), responsive breakpoints, and optional live data from HTTP APIs.

Use it as a starting point for internal tools, observability-style UIs, or any product that needs a polished, editable dashboard without stitching a separate BI or page builder.

## What you get

- **Dashboard editor** — Place, resize, move, and configure widgets on a grid; lock the layout for view-only use or keep it editable.
- **Widget system** — Extensible registry of widget types with per-widget settings (sources, formatting, time windows, and more).
- **Single deployable app** — One **Go** server can serve the production **Vite + SolidJS** frontend and the **API** surface on the same origin.
- **Authentication** — Pluggable: **in-process WorkOS** (AuthKit), **dev allow** (requires **`--insecure`**), **PAM** (Linux), or **proxy** `/api/auth/*` to an external BFF. The mode is declared in the required **`auth`** block in the **gateway JSON** (path from **`-c` / `--conf`**, default `/etc/dafuq/dafuq.json` if omitted). The same `Authorization: Bearer` token is validated (WorkOS JWKS or OIDC JWKS) for protected APIs.
- **API gateway** — JSON configuration maps **URL prefixes** to either **local handler plugins** or **upstream HTTP APIs** with **priority-ordered failover**. Every configured route expects a valid **Bearer JWT**; the same token is forwarded upstream when proxying.
- **Sensible defaults** — Dark, neon-accented UI theme; most server surface is set via **command-line flags** (listen address, static dir, TLS, gateway JSON), with remaining options from the environment.
- **Server-side dashboard save** — With a valid access token, the UI syncs the dashboard list to **`GET/PUT /api/v1/dashboards`** (per-user JSON under **`--dashboard-data-dir`**, default **`data/dashboards`**). Local `localStorage` still works as a cache when signed out; after login, the server copy wins when it has at least one dashboard.

## Architecture (high level)

| Layer | Role |
|--------|------|
| **Frontend** (`src/`) | SolidJS + TypeScript, Vite build to `dist/`. Dashboard state, widget registry, layout, and fetch helpers for widget data. |
| **Backend** (`backend/`) | HTTP server: health and auth endpoints, JWT validation, optional JSON-defined proxy + plugin routes, static SPA fallback. |
| **Auth** | In-process sign-in and tokens from WorkOS, or proxied to another auth service; access tokens are validated with JWKS. `Authorization: Bearer <token>` for protected `/api/v1/*` and for configured data gateway routes. |

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

From the `backend/` directory, set environment variables (see `backend/env.example`) and pass the **gateway config** (JSON with a top-level **`auth`**), e.g. the repo’s `api-proxy-routes.example.json`:

```bash
go run ./cmd/server -c ./api-proxy-routes.example.json
```

Omitting **`-c`** uses the default path **`/etc/dafuq/dafuq.json`**. For auth plugin **`allow`**, add **`--insecure`** (dev only). Use **`-a` / `--addr`**, **`--static-dir`**, and **`--tls-cert` / `--tls-key`** for listen address, the built SPA, and HTTPS (see **`-h`**). Use **`-h` / `--help`** and **`-v` / `--version`** as usual.

Point **`--static-dir`** at your Vite `dist/` folder (default **`../dist`**) so the Go binary can serve the built UI in production.

**Production-style flow:**

```bash
npm run build
# Then run the server, e.g. go run ./cmd/server -c ./api-proxy-routes.example.json --static-dir ../dist
```

## Configuration (command line and environment)

| Flag | Purpose |
|------|---------|
| **`-c` / `--conf`** | Path to the gateway JSON (top-level **`auth`**, optional **`routes`**). **Default** if you omit the flag: **`/etc/dafuq/dafuq.json`**. |
| **`-a` / `--addr`** | HTTP(S) listen address. **Default** if you omit: **`:8080`**, or **`:8443`** when **`--tls-cert`** and **`--tls-key`** are set. |
| **`--static-dir`** | Directory of the built SPA (e.g. **`../dist`**, the default if you omit the flag). |
| **`--tls-cert`**, **`--tls-key`** | TLS certificate and private key. Set **both** for HTTPS, or **neither** for HTTP. |
| **`--dashboard-data-dir`** | Where to store per-user dashboard JSON (default **`data/dashboards`**). |
| **`--cookie-secure`** | `true` / `false` to force the **`Secure`** attribute on session cookies, or **omit** to use **true** only when serving with TLS. |
| **`--insecure`** | **Required** when the gateway `auth` plugin is **`allow`** (dev and testing only). |
| **`-h` / `--help`**, **`-v` / `--version`** | Print usage or version. |

| Variable | Purpose |
|----------|---------|
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_REDIRECT_URI` | WorkOS User Management / AuthKit. |
| `DAFUQ_JWKS_URL`, `DAFUQ_JWT_ISSUER`, `DAFUQ_JWT_AUDIENCE` | Required when **`auth` uses `backends`** (proxied BFF). OIDC JWKS and issuer (and optional audience) for validating access tokens. |
| `DAFUQ_POST_LOGIN_REDIRECT` | After OAuth callback (non-JSON), where to send the browser (tokens in URL fragment). |

Details and optional keys are in `backend/env.example`.

**Development:** the Vite dev server proxies `/api` to `http://127.0.0.1:8080`, so run the Go app on the default address and `npm run dev` on another port, then use **Log In** (goes to `/api/auth/login`). OAuth returns tokens in the URL hash; the app stores them and calls the dashboard API.

**Dashboard API** (requires `Authorization: Bearer <access_token>`):

- `GET /api/v1/dashboards` — returns `{ "version": 1, "dashboards": [ ... ] }` (empty array if the user has no saved file yet).
- `PUT /api/v1/dashboards` — body same shape; validates and writes the user’s file atomically.

## API gateway and auth routing

- The gateway file **must** include a top-level **`auth`** object (see **`backend/api-proxy-routes.example.json`**). Set its path with **`-c` / `--conf`** (default **`/etc/dafuq/dafuq.json`** if the flag is omitted). Optional **`routes`** define the data API gateway.
- **In-process auth** uses the same shape as data routes, e.g. `"auth": { "listen": "/api/auth", "plugin": { "local": "workos" } }` (plus `WORKOS_*` for WorkOS).
- **Proxy auth (external BFF / Auth0)** e.g. `"auth": { "listen": "/api/auth", "plugin": { "proxy": ["https://your-bff.example.com/v1/your-callbacks"] } }` — each entry is a full base URL (scheme, host, and path prefix to mount under). `GET/PUT /api/v1/*` and data routes still need a valid access token, validated with **`DAFUQ_JWKS_URL` / `DAFUQ_JWT_ISSUER` / optional `DAFUQ_JWT_AUDIENCE`**.

## API gateway: data routes and plugins

- Every entry uses **`plugin`**: an object with either **`"local": "<name>"`** (built-in or registered handler) or **`"proxy": [ "<url>", ... ]`**, where each URL includes any path prefix (e.g. `https://api.example.com/v1/metrics`); the remaining path under **`listen`** is appended when forwarding. List order is **failover** until a non-5xx.
- **`listen`**: public URL path prefix. **`endpoint`** and **`listen_path`** are accepted as aliases.
- The older form (`listen_path` only, `plugin` as a string, and `backends` as full base URLs) is still accepted.

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

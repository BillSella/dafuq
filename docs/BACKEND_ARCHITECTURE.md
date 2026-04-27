# Backend Architecture (High Level)

This document describes the backend architecture for `dafuq`.
It focuses on the Go server runtime, auth, API gateway, and persistence behavior.

## Goals

- Provide a single deployable backend that serves API endpoints and the built SPA.
- Keep authentication pluggable across local and external identity modes.
- Enforce bearer-token authorization consistently for protected APIs.
- Support configurable API routing to local plugins or upstream backends with failover.
- Persist dashboard data safely with per-user isolation and version history.

## Stack

- Language: `Go`
- HTTP framework: standard library `net/http` (`http.ServeMux`)
- CLI flags: `spf13/pflag`
- JWT/JWKS validation:
  - WorkOS mode via WorkOS SDK + JWKS validation
  - OIDC/JWKS mode for external auth proxy setups
- Storage: filesystem-based JSON snapshots for dashboards

## Entry Point and Runtime

- Binary entrypoint: `backend/cmd/server/main.go`
- High-level startup flow:
  1. Parse CLI flags.
  2. Load environment config.
  3. Resolve gateway config path (`-c/--conf`, default `/etc/dafuq/dafuq.json`).
  4. Build HTTP mux via `server.NewMux(...)`.
  5. Start HTTP or HTTPS server.
  6. Handle graceful shutdown on signal.

## Configuration Model

### CLI-First Runtime Controls

Primary runtime controls are flags:

- `--conf` / `-c`
- `--addr` / `-a`
- `--static-dir`
- `--tls-cert`, `--tls-key`
- `--dashboard-data-dir`
- `--organization-id`
- `--cookie-secure`
- `--insecure` (required for dev-only `allow` auth plugin)

### Environment Variables

Environment config is used for auth provider and HTTP/runtime tuning:

- WorkOS keys and redirect URI
- OIDC/JWKS validation settings for external auth proxy mode
- PAM and allow-mode auth settings
- HTTP timeout and proxy body size settings

Reference file: `backend/env.example`.

## HTTP Composition

Core router assembly happens in `backend/internal/server/server.go`:

- Health:
  - `GET /api/health`
- Protected API namespace:
  - `GET/PUT /api/v1/dashboards`
  - versions + rollback endpoints
  - guarded by bearer auth middleware
- Gateway-configured auth routes:
  - in-process handlers (`workos`, `allow`, `pam`) or proxy pass-through
- Gateway-configured data routes:
  - local plugin handlers or upstream proxy with failover
- SPA/static serving fallback:
  - serves files from `--static-dir`
  - falls back to `index.html` for non-API routes

## Authentication and Authorization

Auth middleware: `backend/internal/auth/middleware.go`

- Requires `Authorization: Bearer <token>`
- Validates access token with pluggable validator
- Injects access claims into request context

Token validator selection: `newTokenValidator(...)` in `server.go`

- `workos` -> WorkOS JWT validator
- `allow` -> dev-only permissive validator
- `pam` -> PAM-backed local auth validator
- `proxy` auth mode -> OIDC/JWKS validator

### Auth Route Modes

Auth route config is required in gateway JSON top-level `auth` block:

- `plugin.local = "workos"`: in-process OAuth/password/refresh/logout/me handlers
- `plugin.local = "allow"`: dev/testing only, requires `--insecure`
- `plugin.local = "pam"`: Linux PAM auth mode
- `plugin.proxy = [...]`: forwards `/api/auth/*` to external auth BFF

## Gateway and Plugin Architecture

Gateway config parsing: `backend/internal/server/gateway_parse.go`

- JSON shape:
  - top-level `auth` route (required)
  - `routes` array (optional)
- Route supports:
  - `listen` (aliases: `endpoint`, `listen_path`)
  - plugin local mode (`plugin.local`)
  - plugin proxy mode (`plugin.proxy`)
  - legacy compatibility with `backends`

Route registration: `backend/internal/server/gateway_routes.go`

- Every configured data route is wrapped with bearer auth middleware.
- Local plugin routes are stripped to listen-prefix and dispatched in-process.
- Proxy routes use failover proxy handler.

Plugin registry:

- `backend/internal/server/plugin.go`
- `backend/internal/server/plugin_builtins.go`
- Supports registering custom local handlers/plugins via mux options.

## Upstream Proxy Failover

Proxy behavior: `backend/internal/server/proxy_failover.go`

- Reads and caps request body size before upstream forwarding.
- For each backend in order:
  - forwards request with filtered hop-by-hop headers
  - returns first non-5xx response
- If all backends fail or return 5xx:
  - responds `502 Bad Gateway`

This gives deterministic priority-ordered failover for gateway routes.

## Dashboard Persistence Architecture

Implementation: `backend/internal/api/dashboards.go`

Store root is under `--dashboard-data-dir`, segmented by org and subject.

Layout:

- `<root>/<org>/users/<user-id>/<dashboard-id>/<timestamp>.json`
- deletion recovery area under `<root>/<org>/deleted/...`

Behavior:

- `GET /api/v1/dashboards`:
  - reads latest version per dashboard folder
  - returns envelope `{ version, dashboards }`
- `PUT /api/v1/dashboards`:
  - validates payload shape
  - writes new timestamped version snapshot per dashboard
  - prunes older snapshots (keeps latest window)
  - moves removed dashboards to recovery area
- rollback/version endpoints:
  - list timestamp versions
  - restore specific version payload

Safety features:

- path segment sanitization
- bounded request body sizes
- atomic/guarded write patterns
- explicit JSON validation before persistence

## Production Middleware and Operations

Mux wrapping includes:

- request logging
- production middleware hooks (`backend/internal/server/middleware_production.go`)

Operational characteristics:

- explicit HTTP server timeouts
- optional TLS with minimum TLS1.2
- graceful shutdown with timeout

## Build and Deployment Shape

Typical production flow:

1. Build frontend (`npm run build`) to `dist/`.
2. Run backend server pointing `--static-dir` to that build output.
3. Configure auth + gateway JSON via `--conf`.
4. Provide required environment secrets/config for chosen auth mode.

This supports single-origin deployment where backend serves both API and SPA assets.

## Extension Guidance

To add a new local gateway capability:

1. Implement plugin handler (`Plugin` or direct handler).
2. Register plugin in `PluginRegistry` passed via `NewMux(..., WithPluginRegistry(...))`.
3. Add gateway route entry mapping `listen` to that local plugin name.
4. Add tests for:
   - route registration behavior
   - auth wrapping expectations
   - failure/retry handling (if proxy involved)

To integrate external auth:

1. Configure `auth.plugin.proxy` in gateway file.
2. Set OIDC/JWKS validation environment values.
3. Verify `/api/v1/*` bearer validation against your issuer/audience.

## Known Constraints

- Filesystem persistence is pragmatic and simple, but not a full relational/event store.
- Auth complexity is intentionally centralized but still multi-mode; misconfiguration can block startup.
- Gateway behavior is powerful but JSON-driven; schema discipline and tests are important as routes grow.

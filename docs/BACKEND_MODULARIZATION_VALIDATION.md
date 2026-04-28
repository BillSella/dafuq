# Backend Modularization Validation

This document validates whether the backend currently follows a clean modular architecture.
It is based on the current code under `backend/`.

## Validation Summary

Overall, the backend is modularized in a clean and maintainable way:

- clear package boundaries by responsibility
- low coupling between HTTP composition, auth, gateway parsing, and persistence
- extension seam for local plugins
- consistent configuration entrypoint and driver-based auth selection

Main remaining gaps are test coverage depth and deeper package-level documentation granularity.

## Package Boundary Review

### `cmd/server`

Role:

- process entrypoint
- CLI flag parsing
- config wiring
- HTTP server bootstrap and graceful shutdown

Assessment:

- thin orchestration layer
- no business logic leakage from internals

### `internal/config`

Role:

- environment config loading and validation
- auth-driver-specific validation
- timeout/body-size parsing helpers

Assessment:

- cohesive responsibilities
- reused by command and server package without cycle risk

### `internal/server`

Role:

- main HTTP mux composition
- gateway config load/normalize
- route registration
- proxy failover behavior
- plugin registry and middleware composition

Assessment:

- strong separation inside package:
  - parse/normalize (`gateway_parse.go`, `gateway_types.go`)
  - registration (`gateway_routes.go`)
  - proxy transport (`proxy_failover.go`)
  - plugin seams (`plugin.go`, `plugin_builtins.go`)
  - top-level composition (`server.go`)

### `internal/auth`

Role:

- bearer middleware and access claims context
- token validators by mode (WorkOS, OIDC, allow, PAM)
- auth endpoint handlers by mode

Assessment:

- auth concerns are centralized and swappable by driver
- middleware cleanly decoupled from endpoint handlers
- clear split between:
  - validation primitives
  - HTTP handlers
  - context claims propagation

### `internal/api`

Role:

- health/sample handlers
- dashboard persistence API and file-backed storage lifecycle

Assessment:

- domain persistence isolated from server composition
- `DashboardStore` encapsulates storage behavior and route wiring

## Architecture Rule Checks

### Rule: HTTP composition should not contain domain storage internals

Status: PASS

- `server.NewMux` wires `api.NewDashboardStore` and `api.RegisterDashboardRoutes`
- storage logic remains in `internal/api/dashboards.go`

### Rule: Auth mode should be configurable without route code duplication

Status: PASS

- `authDriverForRoute` + `newTokenValidator` drive behavior
- `registerAuthRoutes` maps mode to handlers/proxy route

### Rule: Gateway route parsing should be normalized before routing

Status: PASS

- route shape normalized through parser + `normalizeRoute`
- registration consumes normalized `APIProxyRoute`

### Rule: API gateway should support extension without editing router core

Status: PASS

- `PluginRegistry` + `WithPluginRegistry` enable external plugin injection

### Rule: Persistence should isolate user/org path handling and validation

Status: PASS

- path sanitization and user/org directory mapping centralized in `DashboardStore`

## Coupling and Cohesion Notes

Strengths:

- low cross-package imports
- no circular dependency patterns
- packages correspond to runtime domains (server/auth/api/config)

Watch items:

- `internal/auth/handlers.go` is large and could be split by concern (oauth/password/refresh/me/rate-limit helpers) in future refactor.
- `internal/api/dashboards.go` is also large and could split into:
  - HTTP handlers
  - versioning helpers
  - filesystem operations

## Testability Review

Strengths:

- many pure helper functions already isolated and test-friendly
- proxy and plugin behaviors already have dedicated tests

Gaps:

- command entrypoint (`cmd/server/main.go`) has no test coverage
- several server/auth handler paths still under-tested
- coverage baseline is far below near-100 target (see quality section)

## Quality Baseline (Current)

Recent backend combined coverage baseline:

- total statements: ~30.7%

Implication:

- architecture is reasonably clean, but quality gates are not yet at near-100 coverage.

## Recommendations

Short-term (immediate):

1. Expand tests for untested low-level helpers and middleware.
2. Add focused handler tests for auth and server route registration branches.
3. Add tests for dashboard versions/rollback endpoints and error branches.

Medium-term:

1. Split large files in `internal/auth` and `internal/api` for finer-grained ownership.
2. Add CI coverage thresholds per backend package.
3. Add package-level docs for exported symbols and extension points.

## Verdict

Backend modularization is **clean enough to scale**:

- boundaries are clear
- responsibilities are coherent
- extension points exist

Primary risk is not architecture shape; it is **insufficient test depth** relative to a near-100% target.

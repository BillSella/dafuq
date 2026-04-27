# Frontend Architecture (High Level)

This document describes the frontend architecture for the `dafuq` application.
It focuses on the SolidJS + TypeScript client only; backend architecture is intentionally excluded.

## Goals

- Keep app-level concerns separate from module-level implementation details.
- Support pluggable modules (dashboard today, others next) behind a stable contract.
- Keep behavior testable through pure domain utilities and isolated UI components.
- Keep auth and authorization policy centralized and easy to evolve to stricter JWT scope enforcement.

## Stack

- Framework: `SolidJS`
- Language: `TypeScript` (strict mode)
- Build tool: `Vite`
- Unit test runner: `Vitest` + `@solidjs/testing-library`
- Styling: global CSS in `src/index.css`

## Frontend Layering

The frontend follows a three-layer model.

1. Application Layer
   - Owns app shell composition, module selection, and access control.
   - Key files:
     - `src/App.tsx`
     - `src/AppAuthGate.tsx`
     - `src/modules/WorkspaceApp.tsx`
     - `src/modules/shell/WorkspaceShell.tsx`

2. Shared Component Layer
   - Reusable UI primitives and feature components used by modules.
   - Key folders:
     - `src/components/ui/`
     - `src/components/layout/`
     - `src/components/config/`

3. Module Layer
   - Feature modules that implement domain behavior and module-specific UI.
   - Key folders:
     - `src/modules/dashboard/`
     - `src/modules/help/`
     - `src/modules/traffic/`
     - `src/modules/settings/`
     - `src/modules/user/`

## Composition and Routing Model

- `src/main.tsx` mounts:
  - `SessionProvider`
  - `AppAuthGate`
- `AppAuthGate` chooses authenticated app vs. auth landing.
- `WorkspaceApp` is the application root for authenticated users:
  - owns active module state
  - applies module access policy
  - renders `WorkspaceShell`
- `WorkspaceShell` renders common chrome and slots:
  - topbar center
  - topbar tools
  - main content
  - overlays
- Module hosts (`DashboardApp` and non-dashboard modules) supply those slots.

## Module Contract System

Module metadata and behavior are centralized in contract/registry files:

- `src/modules/moduleTypes.ts`
  - Canonical `AppModuleId` union.
- `src/modules/moduleRegistry.ts`
  - Navigation/display metadata (titles, placeholders, stable module order).
- `src/modules/moduleContracts.ts`
  - Shared per-module contract:
    - `requiredClaims`
    - `helpDocs`

This keeps new module onboarding predictable and avoids scattering config across multiple places.

## Help Documentation Architecture

The Help module is contract-driven:

- `src/modules/help/helpDocTypes.ts` defines documentation schema.
- `src/modules/help/helpDocsRegistry.ts` aggregates docs from:
  - app-level docs
  - module contracts (`helpDocs`)
- Each module owns its own help content file (for example `dashboardHelpDoc.ts`).

Result: a new module can add docs without changing Help page rendering logic.

## Authentication and Authorization

Authentication state:

- `src/session/SessionContext.tsx`
  - source of truth for `isAuthenticated`
  - login/logout commands
  - normalized JWT claims surface via `claims()`

Token handling:

- `src/authToken.ts`
  - token storage helpers
  - OAuth hash capture
  - JWT claim extraction (`scope`, `scp`, `roles`, `permissions`)

Authorization policy:

- `src/modules/moduleAccessPolicy.ts`
  - central module access gate
  - currently:
    - dashboards always allowed
    - other modules require auth
    - if claims are present, module claim requirements are enforced
  - required claims come from `moduleContracts.ts`

## Dashboard Module Architecture

The dashboard module is the primary implemented feature module and contains:

- Domain/persistence/sync logic:
  - `dashboardStore.ts`
  - `dashboardPersistence.ts`
  - `dashboardServerSync.ts`
  - `layoutService.ts`
  - `timeWindow.ts`
  - `widgetDataService.ts`
- Module app orchestrator:
  - `DashboardApp.tsx`
- Focused module components/hooks:
  - `DashboardMainRegion.tsx`
  - `DashboardWidgetCard.tsx`
  - `useDashboardAutosave.ts`
  - `useDashboardRollback.ts`
  - other module-local helpers

This keeps dashboard-specific behavior inside `src/modules/dashboard/` instead of root-level app files.

## State Management Approach

The frontend uses Solid signals/accessors with a pragmatic split:

- App-level orchestration state in `WorkspaceApp` and session context.
- Module-local state in module roots/hooks.
- Pure update utilities for complex data structures (dashboard store transforms).
- Local UI/transient state in components (menus, overlays, drag interactions).

No global third-party state library is currently required.

## Testing and Quality Gates

Current test strategy emphasizes:

- Unit tests for pure domain logic and policy files.
- Component interaction tests for critical UX flows.
- Contract tests to prevent module-registry/contract drift.

Primary commands:

- `npm test` for unit/component suite.
- `npm run build` for production compilation gate.
- `npm run test:coverage` for coverage report output.

## Build and Runtime Boundaries

Development:

- Vite dev server serves frontend and proxies `/api` to backend.

Production:

- `npm run build` outputs static assets to `dist/`.
- Backend serves built SPA and API under same origin.

## Extension Guidance

When adding a new frontend module:

1. Add module id in `moduleTypes.ts`.
2. Add display metadata in `moduleRegistry.ts`.
3. Add module contract in `moduleContracts.ts`:
   - required claims (if needed)
   - help docs contribution
4. Add module host/component implementation under `src/modules/<module>/`.
5. Add tests for:
   - contract coverage
   - module host behavior
   - policy/help integration when relevant.

## Known Constraints

- Dashboard module remains the largest complexity hotspot.
- Global CSS is centralized and broad; long-term maintainability may benefit from more localized style ownership.
- Production readiness depends on keeping both `npm test` and `npm run build` green on every change.

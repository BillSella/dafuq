# dafuq

`dafuq` is an open-source foundation for building data-driven internal web apps, with a dashboard builder included out of the box.

It combines:

- a SolidJS frontend for modular app UX and dashboard editing
- a Go backend for auth, API routing, and static serving

The project is designed to be forked and adapted into a product-specific platform.

## Why this project

Most teams that need dashboard-heavy tooling end up assembling:

- layout/grid behavior
- widget rendering and configuration
- data-fetch orchestration
- auth/session wiring
- persistence and rollback behavior

`dafuq` provides those building blocks in one starter codebase so teams can iterate on domain features faster.

## What you get

- **Dashboard editor**: drag, resize, configure, visibility per breakpoint
- **Widget system**: typed registry for widget creation, config patching, fetch specs, and runtime formatting
- **Module shell architecture**: app shell + pluggable modules (`dashboard`, `help`, and stubs for future modules)
- **JWT-ready module authorization**: centralized policy with claim-based gating
- **Module-contributed help docs**: help content aggregated from module contracts
- **Build + test gates**: strict TypeScript, Vitest suite, and coverage reporting

## Architecture docs

- Frontend architecture: [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md)
- Backend architecture: _planned in a separate document_

## Quick start

### Frontend (development)

```bash
npm install
npm run dev
```

### Frontend (production build check)

```bash
npm run build
```

### Frontend tests

```bash
npm test
npm run test:coverage
```

### Backend (run server)

From `backend/`:

```bash
go run ./cmd/server -c ./api-proxy-routes.example.json
```

The frontend dev server proxies `/api` to `http://127.0.0.1:8080` by default.

## Repository layout

```text
backend/   Go server runtime, auth, gateway/proxy, static serving
src/       SolidJS frontend app, modules, widgets, UI components
docs/      Architecture and quality documentation
```

## Current quality gates

- `npm run build` must pass
- `npm test` must pass
- coverage reports generated to `coverage/` (gitignored)

Supporting docs:

- `docs/quality/testing-rubric.md`
- `docs/quality/component-documentation-standard.md`
- `docs/quality/source-documentation-checklist.md`

## Contributing

Issues and PRs are welcome. Favor focused changes, strong tests, and clear docs updates alongside behavior changes.

## License

GNU GPL v2.0 only. See [`LICENSE`](LICENSE).

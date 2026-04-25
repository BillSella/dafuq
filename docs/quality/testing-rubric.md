# Frontend Testing Rubric

This rubric defines the required test quality bar for frontend changes.

## Goals

- Keep refactors safe with behavior-focused tests.
- Validate lock/nav/edit policies with deterministic tests.
- Raise coverage steadily without brittle snapshot-heavy suites.

## Coverage Policy

- Global minimum gate: `90%` for lines, statements, branches, and functions.
- New or modified files should meet `>= 90%`.
- Critical flows should target `100%` branch coverage:
  - dashboard lock and unlock state transitions
  - left-nav tool blocking behavior
  - widget editing gates (drag, resize, add, delete)
  - dashboard runtime fetch lifecycle hooks

## Test Pyramid (Required Balance)

- Unit tests:
  - pure transforms and utility functions
  - state hooks with deterministic state transitions
- Component tests:
  - rendered states, callbacks, and accessibility attributes
  - locked vs unlocked behaviors for controls
- Integration tests (small set):
  - lock toggle in topbar affects left-nav tool availability
  - breakpoint/menu interactions for dashboard editing

## Quality Checklist for New Tests

- Test names describe behavior, not implementation details.
- Avoid asserting private internals or class structure unless behavior-critical.
- Prefer semantic queries (`getByRole`, `getByLabelText`) over test IDs.
- Include negative-path assertions (blocked state, invalid input, empty states).
- Include teardown-safe async tests (no dangling timers/listeners).

## Refactor Safety Rule

When extracting code from a component:

1. Add tests around existing behavior first.
2. Move code in small slices.
3. Keep tests green after each slice.
4. Only then adjust structure or naming.


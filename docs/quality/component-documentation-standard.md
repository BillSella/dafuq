# Component Documentation Standard

This standard defines required docs for every frontend component, component-level function, and state-modification contract.

## Required for Every Component File

- File header block explaining:
  - purpose
  - inputs (props)
  - outputs (events/callbacks)
  - side effects (if any)
- State-modification contract section (required when file can trigger state changes), including:
  - source of truth (where state is owned)
  - allowed mutations (which callbacks/actions may modify state)
  - guard rules (for example, lock/permission gates)
- Significant UI/behavior decisions and rationale (brief, actionable).
- Exported prop type with clear, descriptive field names.
- Notes for behavior-sensitive props (for example: `blocked`, `locked`, `disabled`).

## Required for Every Non-Trivial Function

Use JSDoc on component-local functions that contain behavior logic, branching, or side effects.

Include:

- what the function does
- parameter meaning and constraints
- return value
- side effects (state updates, network, timers, DOM events)
- policy or guard conditions enforced by the function

## Required for State APIs and Patterns

Any file that defines or consumes a state API/pattern must document it clearly.

- For hooks/stores/controllers:
  - list exposed actions and their intent
  - list read-only selectors/accessors
  - define invariants (what must always be true)
- For component callback contracts:
  - document whether callback is command-like (triggers mutation) or event-like (notification)
  - document any no-op conditions (for example: blocked while locked)
- For side-effect flows:
  - document timers/listeners/network lifecycles and cleanup expectations

## JSDoc Template

```ts
/**
 * Brief behavior summary in one sentence.
 *
 * @param paramName What this value represents and any expected format.
 * @returns What is returned and when.
 */
```

## Example Component Header

```ts
/**
 * Left navigation rail for primary app sections.
 *
 * Responsibilities:
 * - render nav actions
 * - reflect active section
 * - enforce blocked state for non-dashboard tools while editing
 *
 * This component is presentational and relies on parent callbacks.
 */
```

## Documentation Scope Rules

- Do not add comments for trivial one-line assignments.
- Do document policy-driven behavior (lock gates, state transitions, permissions).
- Keep docs synchronized with behavior in the same PR that changes code.
- If behavior changes and docs are not updated, the PR is not complete.


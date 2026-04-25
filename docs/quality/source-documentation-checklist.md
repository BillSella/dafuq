# Source Documentation Checklist

Use this checklist for every frontend PR touching `src/`.

## Per-File Requirements

- File-level header exists and explains purpose.
- Inputs/outputs are documented (props, exports, callbacks).
- Side effects are documented (timers, listeners, network, storage).
- Significant decisions are documented with short rationale.

## State Modification Contract Requirements

- Source of truth is explicitly named.
- Every mutation path is listed (actions/callbacks that can modify state).
- Guard conditions are listed (lock/permission/validation no-op paths).
- Invariants are listed when relevant.

## Function-Level Requirements

- Every non-trivial function has JSDoc.
- JSDoc includes side effects and guard behavior.
- Public API functions include parameter constraints and return semantics.

## Review Gate

- PR includes a "Documentation updated" checklist item.
- Reviewer confirms docs match behavior for modified files.


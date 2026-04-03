# CampusEats Agent System

This folder defines a reusable multi-agent delivery system for building CampusEats from the PRD and implementation playbook.

## Agent Set

- `orchestrator.md`: central coordinator that reads the PRD, breaks work into packets, dispatches specialists, and enforces verification gates
- `prd-planner.md`: converts PRD scope into implementation slices, dependencies, and acceptance criteria
- `feature-implementer.md`: builds features, APIs, schema, and UI changes
- `test-designer.md`: generates test cases and validation scenarios from the PRD and changed code
- `observability-agent.md`: defines required logs, trace fields, and diagnostics for critical flows and failures
- `code-quality-guardian.md`: reviews correctness, maintainability, logging, and safety
- `build-verifier.md`: validates install, lint, typecheck, tests, and production build readiness
- `bug-fixer.md`: diagnoses failures, applies targeted fixes, and loops back through verification
- `prd-routing.md`: maps PRD sections to workstreams and preferred specialist flow
- `registry.yaml`: machine-readable registry of the agent roles and handoff contract

## Operating Model

1. The orchestrator reads the user request, `canteen_prd.md`, and `canteen_agent_tasks.md`.
2. It creates a task packet with scope, constraints, affected PRD sections, acceptance criteria, and dependencies.
3. It dispatches the right specialists in sequence.
4. No task is complete until tests, code quality, logging, and build checks are satisfied.
5. If a check fails, the orchestrator routes the issue to the bug fixer and re-runs verification.

## Standard Handoff Payload

Every agent should receive or produce the same core fields:

- `task_id`
- `goal`
- `affected_prd_sections`
- `affected_playbook_tasks`
- `inputs`
- `assumptions`
- `acceptance_criteria`
- `logging_requirements`
- `artifacts_changed`
- `tests_added_or_updated`
- `verification_results`
- `open_risks`

## Default Verification Gates

- Test cases generated from PRD acceptance criteria
- Logging added or updated for critical state transitions and failures
- Static quality checks pass
- Build succeeds
- Known bugs or regressions are closed before handoff

## Recommended Sequence

1. `prd-planner`
2. `feature-implementer`
3. `test-designer`
4. `observability-agent`
5. `code-quality-guardian`
6. `build-verifier`
7. `bug-fixer` if needed
8. `build-verifier` final pass

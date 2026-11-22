# P01 — NOVA LAPTOP Roadmap

- **Audit Date:** 2026-11-21 (Asia/Shanghai)
- **Owner:** Domince Aseberos
- **Portfolio Entry:** NOVA LAPTOP
- **Evidence & Current Classification:** Local source reviewed; 3D showcase/editor groundwork
- **Recommended Priority:** Batch / Sequence 7–8 (or follow showcase-to-quote readiness)

---

## 1. Observed Evidence & Current State

Local `NOva/package.json`, `src/App.jsx`, `PersistentLaptop3D.jsx`, `scroll-story/core` and editor/runtime modules, product briefs, and QA script declarations. The package's test command builds; that does not establish behavior-test coverage.

---

## 2. Product Direction & Stack Decision

- **Product Goal:** A workstation discovery and configuration experience. Preserve the 3D narrative while allowing visitors to compare configurations and request or purchase a specific configuration.
- **Stack & Integration Decision:** Keep React/Vite, Three.js, GSAP, Lenis, and existing scroll-story contracts. Add small configuration schemas and a product/quote gateway. Use the actual merchant's commerce system when available; a headless commerce adapter is a later decision, not a prerequisite for requesting a quote.

---

## 3. Ordered Development Workflow

1. Extract supported configurations, price inputs, and compatibility rules into data/domain modules.
2. Add configuration selection, comparison, specifications, and a usable low-motion/low-GPU fallback.
3. Create quote/contact submission with configuration snapshot, budget, and country; return a persisted reference.
4. Build an operator quote inbox or integrate the existing CRM.
5. Add checkout only when catalog, fulfillment, and payment ownership are established. Later: saved configurations and compatibility-aware accessories.

---

## 4. Failure Cases & Acceptance Criteria

Reject unsupported combinations and changed prices; handle failed 3D loading without blocking specifications or contact. Test quote replay and keyboard configuration. Document 3D asset budget, editor/runtime boundary, and product configuration contract. Showcase a completed configuration-to-quote journey.

---

## Delivery Sequence & Stage Gates

| Stage | Concrete Output | Exit Gate |
| --- | --- | --- |
| **A — Establish baseline** | Correct source/branch, current commands, inventory of implemented vs. simulated flows | One selected user journey and current limitations documented |
| **B — Product definition** | Actors, data, states, MVP, and acceptance scenarios | Customer and operator agree on result ownership |
| **C — Stack and integration decision** | Existing-stack inventory and one short provider/architecture decision | Known source of truth for identity, content, and transactions |
| **D — One complete vertical slice** | UI, validation, adapter, endpoint/provider, persistence, and operator action | Happy path and primary failure path work |
| **E — Reliability** | Conflict handling, uncertain-write recovery, permissions, and meaningful tests | Critical acceptance scenarios pass |
| **F — Documentation and evidence** | Updated docs, controlled demo data, and repeatable walkthrough | Another developer can run and explain the product |
| **G — Portfolio update** | Honest label, case study, links, and proof | Claims correspond to implemented/tested behavior |
| **H — Further expansion** | Next business capability | Added only after core workflow remains stable |

---

## Shared Engineering & Completion Standards

### Completion Criteria (Before Updating Portfolio Label)
- Core workflow passes in a fresh session using controlled data.
- Relevant operator can receive and manage the result.
- Invalid inputs, unavailable dependencies, and uncertain writes have recoverable behavior.
- Authorization and critical business constraints are enforced beyond the UI.
- Reload, deep-link, and back navigation preserve correct state.
- Keyboard/mobile layouts, focus, dialog behavior, and reduced motion are checked.
- CI runs relevant lint/type/build and meaningful flow tests.
- Documentation matches actual implementation and explicitly identifies fixtures/sandbox integrations.
- Case-study claims link to evidence; performance and conversion improvements have measurements.

### Required Documentation Artifacts (Sized to Product)
- `README.md` — Product purpose, users, honest status, setup, env var names, commands, and demo limits
- `docs/PRODUCT.md` — Problem, actors, core workflow, MVP, later scope, success measures, exclusions
- `docs/ARCHITECTURE.md` — Modules, responsibilities, dependencies, data flow, state ownership, tradeoffs
- `docs/FLOWS.md` — Customer and operator flows, transitions, failure recovery, access rules
- `docs/FORMS.md` — Fields, constraints, consent, submission endpoint, notification routing, UI states
- `docs/API.md` (or OpenAPI) — Request/response shapes, auth, errors, idempotency, provider contracts
- `docs/DATA.md` — Entities, persistence, indexes, lifecycle, migrations, retention, backup/restore
- `docs/TESTING.md` — Commands, fixtures, critical scenarios, hardware/browser coverage, evidence
- `docs/OPERATIONS.md` — Deployment, secrets setup, health checks, logs, recovery, rollback
- `docs/decisions/` — Short ADRs for meaningful stack/provider/architecture choices
- `docs/CASE_STUDY.md` — Problem, decisions, verified workflows, screenshots, limitations, measured results

---

## 7. Local Evidence References

- `NOva/package.json`
- `NOva/src/App.jsx`
- `NOva/src/components/PersistentLaptop3D.jsx` (and `scroll-story/core` / editor/runtime modules)

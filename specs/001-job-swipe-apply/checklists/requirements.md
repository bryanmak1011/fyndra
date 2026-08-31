# Specification Quality Checklist: Swipe-to-Apply Job Search

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-31 | **Re-validated**: 2026-08-31 (rev 2)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Rev 2 re-validation notes

The spec was re-validated after career-ops was read at source. Three rev-1 requirements rested on
false premises and have been rewritten; the full record is in
[SDD.md Appendix A](../SDD.md#appendix-a-review-of-earlier-planning).

| Item | Rev 1 | Rev 2 |
|---|---|---|
| FR-009 | Apply via LinkedIn/Indeed | Both excluded; direct submission is allowlist-gated (FR-009, FR-009a) |
| FR-008 | career-ops performs submission | We prepare; career-ops does not submit, by design |
| FR-001 | PDF **and DOCX** | Text-layer PDF only — the back-spine parses neither DOCX nor scanned PDFs |
| Market | Unstated (implicitly global) | Hong Kong and Taiwan, with bilingual zh-Hant/English requirements (FR-027, FR-028) |
| Auth | Absent from spec and contract | FR-026 added; bearer auth added to the contract |
| Async | Implicitly synchronous | FR-023 — a right-swipe is acknowledged immediately |
| Notifications | "notify the user", no mechanism | FR-029 — push, because the constitution prohibits polling |
| Volume | Unbounded | FR-024 — per-user daily and per-employer caps |

**Open items are product/legal, not specification gaps** — tracked in
[SDD Appendix B](../SDD.md#appendix-b-open-decisions). Two need closing before implementation:

1. Constitution amendment for backend principles (`/speckit-constitution`) — the constitution
   governs iOS only, and this feature ships a server.
2. App Store Review Guidelines assessment for the auto-submit capability, per constitution
   Principle V.

**Ready for `/speckit-tasks`.**

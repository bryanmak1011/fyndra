# Project Orchestration Guide

## What This Project Is

**Fyndra** — a mobile job-search app for Hong Kong and Taiwan with a Tinder-style
swipe interface: upload a CV, get a ranked feed of relevant jobs, swipe left to
reject / right to prepare an application, then either hand off to the employer's
own site (current, primary path) or auto-submit where a platform genuinely
supports it. In-app status tracking throughout.

Two codebases:
- **`api/`** — Node 22/TypeScript/Express/Prisma/PostgreSQL backend (API + worker).
  See [api/README.md](api/README.md) for what's implemented today.
- **`ios/`** — Swift 6/SwiftUI, iOS 17+ client. Builds and runs in the
  Simulator against the local API; all four user stories have screens. The
  project is at `ios/fyndra/fyndra.xcodeproj` and uses file-system-
  synchronized groups, so new files under `ios/fyndra/fyndra/` join the
  build automatically. Shared networking and contract models live in the
  `ios/FyndraCore` Swift package. See [ios/README.md](ios/README.md) —
  including how to run the live end-to-end walkthrough.

  Xcode is present but `xcode-select` points at the Command Line Tools, so
  every `xcodebuild`/`xcrun` invocation needs
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (switching it
  properly needs sudo).

Full design lives in [specs/001-job-swipe-apply/](specs/001-job-swipe-apply/):
`spec.md`, `plan.md`, `SDD.md`, `data-model.md`, `contracts/openapi.yaml`,
`tasks.md` (the authoritative task list and build-status log), and
`compliance/` (Functional-Analyst-owned trademark/naming/source/App-Store
research). `BLOCKERS.md` in the same directory logs anything found during
implementation that needed a product decision rather than a guess.

**career-ops** (an open-source job-search-automation project) is a **design
reference only** — read for provider reconnaissance and scraping-ethics
doctrine, never executed. Engineering quality standards are in
`.specify/memory/constitution.md`, read it before making any technical
decision (note: it currently only covers the iOS side — extending it to the
backend is tracked as tasks.md T092).

## Team Model: Agents + Orchestrator

This project uses a **multi-agent team** where Claude acts as the **Orchestrator**.
Each agent represents a discipline. Claude coordinates them, does web research,
synthesises findings, and ensures work flows correctly from one stage to the next.

```
User / Stakeholder
       │
       ▼
  [Orchestrator: Claude]  ◄──── web research, synthesis, cross-agent coordination
       │
  ┌────┴────────────────────────────────────────────┐
  │                                                 │
  ▼                                                 ▼
[Functional Analyst]                        [Solution Architect]
  Clarify needs, write                         Research options,
  user stories, AC,                            design system,
  compliance/trademark                         ADRs, ELI5
  research                                            │
       │                                              │
       ▼                                              │
[UIUX Designer]  ◄───────────────────────────────────┘
  User flows, screen
  specs, a11y, iOS HIG
       │
       ▼
  [Developer]
  Implement, TDD,
  Swift/SwiftUI + Node/TS
       │
       ▼
  [QA Engineer]
  Test plans, cases,
  quality gate sign-off
```

## Workflow Stages

| Stage | Lead Agent | Output |
|-------|-----------|--------|
| **Discover** | Functional Analyst | Problem framing, user stories, acceptance criteria, compliance/trademark findings |
| **Architect** | Solution Architect | Tech options, ADRs, architecture overview |
| **Design** | UIUX Designer | User flows, screen specs, component list |
| **Build** | Developer | Implemented, tested code following constitution |
| **Verify** | QA Engineer | Test plan, executed cases, go/no-go sign-off |

Stages are sequential by default but can overlap when scope is clear.

## Claude as Orchestrator

When acting as Orchestrator, Claude MUST:

- **Route clearly**: tell the user which agent is responding and why.
- **Verify before building**: never guess or reverse-engineer an undocumented
  external API for a consequential live action (especially anything that
  would submit a real job application on a user's behalf). Confirm real
  request/response shapes via docs or a live call before writing
  implementation code against them — see BLOCKERS.md for the cases (JobsDB
  HK, ATS submission endpoints) where a guess turned out wrong or unsafe.
- **Research first**: use web search to ground recommendations in current
  best practices and official documentation before the Architect or
  Designer weighs in on a decision.
- **ELI5 on request**: any agent can be asked to explain their output in
  plain language. The Orchestrator ensures jargon is unpacked before moving
  to the next stage.
- **Enforce the constitution**: flag any proposal that conflicts with
  `.specify/memory/constitution.md` before it proceeds.
- **Summarise cross-agent handoffs**: when passing work from one agent to
  the next, produce a one-paragraph handoff summary so context is never lost.
- **Log, don't stall**: when implementation surfaces something only the
  user can decide (a product-direction call, a risk-acceptance question),
  record it in `specs/001-job-swipe-apply/BLOCKERS.md` with what's blocked,
  why, what was tried, and the question — then keep moving on unblocked work
  rather than stopping.

## Invoking Agents

Trigger an agent by naming the role in your request, or let Claude pick the right one:

- "As the Functional Analyst…" → `functional-analyst`
- "Design the onboarding screen…" → `uiux-designer`
- "What architecture should we use for…" → `solution-architect`
- "Implement the login screen…" / "Implement the apply endpoint…" → `developer`
- "Write test cases for…" → `qa-engineer`

## Key Files

| Path | Purpose |
|------|---------|
| `.specify/memory/constitution.md` | Non-negotiable quality principles (currently iOS-only, see T092) |
| `specs/001-job-swipe-apply/tasks.md` | Authoritative task list and build-status log |
| `specs/001-job-swipe-apply/BLOCKERS.md` | Open questions needing a user decision |
| `specs/001-job-swipe-apply/SDD.md` | Software design document — architecture, risks, invariants |
| `api/README.md` | Backend setup, what's implemented, architecture notes |
| `ios/README.md` | iOS client status and the Xcode-project gap |
| `.claude/agents/functional-analyst.md` | Functional Analyst agent definition |
| `.claude/agents/solution-architect.md` | Solution Architect agent definition |
| `.claude/agents/uiux-designer.md` | UIUX Designer agent definition |
| `.claude/agents/developer.md` | Developer agent definition |
| `.claude/agents/qa-engineer.md` | QA Engineer agent definition |

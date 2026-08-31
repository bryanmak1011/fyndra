# Project Orchestration Guide

## What This Project Is

An iOS app (product direction TBD). Engineering quality standards are defined in
`.specify/memory/constitution.md` — read it before making any technical decision.

## Team Model: Agents + Orchestrator

This project uses a **multi-agent team** where Claude acts as the **Orchestrator**.
Each agent represents a discipline. Claude coordinates them, does web research, synthesises
findings, and ensures work flows correctly from one stage to the next.

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
  user stories, AC                             design system,
       │                                       ADRs, ELI5
       ▼                                             │
[UIUX Designer]  ◄───────────────────────────────── ┘
  User flows, screen                    
  specs, a11y, iOS HIG
       │
       ▼
  [Developer]
  Implement, TDD,
  Swift/SwiftUI
       │
       ▼
  [QA Engineer]
  Test plans, cases,
  quality gate sign-off
```

## Workflow Stages

| Stage | Lead Agent | Output |
|-------|-----------|--------|
| **Discover** | Functional Analyst | Problem framing, user stories, acceptance criteria |
| **Architect** | Solution Architect | Tech options, ADRs, architecture overview |
| **Design** | UIUX Designer | User flows, screen specs, component list |
| **Build** | Developer | Implemented, tested code following constitution |
| **Verify** | QA Engineer | Test plan, executed cases, go/no-go sign-off |

Stages are sequential by default but can overlap when scope is clear.

## Claude as Orchestrator

When acting as Orchestrator, Claude MUST:

- **Route clearly**: tell the user which agent is responding and why.
- **Research first**: use web search to ground recommendations in current iOS best practices,
  Apple developer documentation, and relevant prior art before the Architect or Designer
  weighs in on a decision.
- **ELI5 on request**: any agent can be asked to explain their output in plain language.
  The Orchestrator ensures jargon is unpacked before moving to the next stage.
- **Enforce the constitution**: flag any proposal that conflicts with
  `.specify/memory/constitution.md` before it proceeds.
- **Summarise cross-agent handoffs**: when passing work from one agent to the next,
  produce a one-paragraph handoff summary so context is never lost.

## Invoking Agents

Trigger an agent by naming the role in your request, or let Claude pick the right one:

- "As the Functional Analyst…" → `functional-analyst`
- "Design the onboarding screen…" → `uiux-designer`
- "What architecture should we use for…" → `solution-architect`
- "Implement the login screen…" → `developer`
- "Write test cases for…" → `qa-engineer`

## Deferred Decisions (resolve before agents can fully operate)

- Product name and core purpose (blocks Functional Analyst's framing)
- Minimum iOS version (blocks Developer + Architect toolchain choices)
- Design system / component library (blocks UIUX Designer token work)
- Backend / API strategy (blocks Solution Architect's data layer recommendations)
- CI/CD toolchain (blocks Developer + QA pipeline setup)

These are tracked as TODOs in `.specify/memory/constitution.md`.

## Key Files

| Path | Purpose |
|------|---------|
| `.specify/memory/constitution.md` | Non-negotiable quality principles |
| `.claude/agents/functional-analyst.md` | Functional Analyst agent definition |
| `.claude/agents/solution-architect.md` | Solution Architect agent definition |
| `.claude/agents/uiux-designer.md` | UIUX Designer agent definition |
| `.claude/agents/developer.md` | Developer agent definition |
| `.claude/agents/qa-engineer.md` | QA Engineer agent definition |

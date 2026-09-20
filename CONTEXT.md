# Fyndra

A mobile job-search app for Hong Kong and Taiwan: swipe a ranked job feed, prepare an application
from CV + profile, submit directly where an ATS genuinely supports it or hand off to the user.

## Language

**ChoiceClient**:
Fyndra's own TypeScript interface, in `api/src/llm/`, that drafts an answer for a fixed-`values`
(dropdown/multiple-choice) prefill question and returns a typed decision with a confidence score,
instead of free text to parse. An in-house reimplementation of TypeSafe AI's `Choice`/`Score`/`Noul`
request contract, run against Fyndra's existing `LlmClient` provider — not TypeSafe's hosted Jev
API. Scoped to `apply/prefill.ts`'s choice-type fields only; free-text fields, CV interpretation,
feed ranking, and per-job evaluation stay on `LlmClient` and are explicitly out of this scope.
_Avoid_: "Jev integration" — Fyndra does not call TypeSafe's API.

**Jev / TypeSafe AI**:
A third-party vendor's hosted-only "System One" decision model (typed `Choice`/`Score`/`Noul`
primitives with confidence), behind an early-access waitlist, no self-host option. Referenced as
the origin of the `Choice`/`Score`/`Noul` contract shape Fyndra's `ChoiceClient` reimplements —
Fyndra is not a TypeSafe customer and sends TypeSafe no data.
_Avoid_: using "Jev" to describe Fyndra's own drafting logic — that's `ChoiceClient`.

**Sorce**:
A US-based "Tinder for jobs" competitor (sorce.jobs) at real production scale. A product/market
reference for Fyndra's swipe-and-apply pattern only — evidence the pattern works and scales, not a
technical or compliance reference. Its own docs name no AI vendor and don't describe a deployment
architecture.
_Avoid_: conflating with `career-ops` — see below.

**career-ops**:
An open-source job-search-automation project, MIT-licensed, ships none of its code in Fyndra.
Fyndra's *compliance and sourcing* design reference — provider reconnaissance, scraping-ethics
doctrine, sensitive-field carve-outs, application-pipeline vocabulary.
_Avoid_: confusing with `Sorce` — career-ops is a design/compliance reference; Sorce is a
market-validation reference. Different roles, easy to conflate by name alone.

**CUA**:
General-purpose computer-use-agent desktop-automation tooling ([trycua/cua](https://github.com/trycua/cua)
— isolated cloud/local desktop sandboxes with native app and browser control. Not a
bot-detection-evasion product by design. In Fyndra, a second *attempt method* alongside
Playwright-stealth within the existing personal-test browser-automation scope (JobsDB HK / 104.com.tw
native apply flow only) — not an escalation path triggered by Playwright-stealth failing, and not
extended to third-party ATS submission.
_Avoid_: framing CUA as "what we fall back to when stealth isn't enough" — that framing was
considered and explicitly rejected; a bot wall still hard-fails to `needs_attention` regardless of
which tool hit it.

**Foundation Models framework / Private Cloud Compute (PCC)**:
Apple's iOS 27 on-device + cloud AI framework (`@Generable` guided generation, reachable from
Swift). A noted future direction for choice-field drafting with a stronger on-device privacy story
than any server-side option — not adopted. Conflicts with two standing decisions: the "iOS client
— presentation only" architecture invariant (`SDD.md` §6) and the iOS 17+ minimum target.

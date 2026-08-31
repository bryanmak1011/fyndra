# T005 — Volume Discipline Policy

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31
**Method**: Product-policy recommendation, not web research — grounded in SDD §6.5.3, §12 (R1, R2,
R10), and the App Store finding in `app-store-assessment.md` §4. This document gates FR-024 defaults
and tasks T054/T060.

---

## 1. Recommendation

- **Per-user daily submission cap: 15 applications per rolling 24-hour period**, counted at the
  moment an `Application` transitions into `applied` (i.e., a successfully submitted or user-confirmed
  submission — not every right-swipe, since a right-swipe that lands in `pending_needs_answer` or
  `awaiting_review` hasn't consumed anything from the employer's side yet).
- **Per-employer concurrent-application cap: 1 open application per employer at a time** — a second
  right-swipe on a posting from the same employer (by `employerApplyUrl` root domain / company
  identity, the same key `normalise.ts` already uses for dedup) is blocked until the prior one reaches
  a terminal or long-idle status, rather than counted against volume at all. This is a distinct
  control from the daily cap: the daily cap limits *how much output the user produces*; the
  per-employer cap limits *how much any single employer receives*, independent of the user's overall
  activity level.

## 2. Rationale

**Reducing the app's own App Store/ToS risk.** `app-store-assessment.md` §4 already establishes that
Guideline 5.2.2 ("specifically permitted... under the service's terms of use") is not a one-time
check at submission time — an app that is later found mass-submitting past what a third-party
service's terms tolerate re-opens the same authorization question that a clean allowlist answered at
launch. A daily cap in the mid-teens is high enough to cover a genuinely active job search (a person
searching intensively rarely submits more than a handful of quality applications a day; 15 is already
generous headroom above typical human behaviour) while being low enough that automated abuse — the
"apply to everything" pattern that mass-application tools are built around and that ATS platforms'
own anti-abuse systems are tuned to detect — never becomes the app's normal operating mode. A cap that
only bites at, say, 200/day would not function as a control at all; it would just be a number on paper.

**Reducing harm to employers.** SDD R10 names the mechanism precisely: *"a swipe UI makes low-quality
mass applying trivially easy."* The entire value proposition of the swipe interaction is near-zero
marginal effort per decision — that is exactly the property that, unconstrained, turns into spam from
the employer's side of an ATS pipeline. The per-employer cap targets this directly and independently
of the user's total daily volume: even a user comfortably under their daily cap should not be able to
send an employer three concurrent applications for slightly different postings, re-apply immediately
after a `needs_attention` failure without addressing the underlying issue, or otherwise flood a single
recruiter's queue. Capping concurrent-per-employer to 1 forces the product to behave like a genuine
one-candidate-one-role relationship even at swipe-speed interaction.

**Keeping the product useful.** A cap so low it defeats the product's purpose is not a real
recommendation — e.g., a cap of 3/day would make the "swipe through your feed" experience feel
arbitrarily gated rather than like a real job search tool, and would push users toward working around
it (multiple accounts) rather than complying with it, which produces worse safety outcomes than a
workable cap that most users never hit. 15/day sits comfortably above what an engaged job-seeker
does in a single sitting (job-search behavioural research generally puts a focused, thoughtful
application day for active seekers in the single digits to low teens) while still being a real ceiling
against automated/careless mass-swiping. This number is a starting default, not a permanent constant —
recommend it ships as a server-side configurable value (already implied by `UserProfile.dailySubmissionCap`
in SDD §7 item 3) so Product can tune it from real usage data without an app-store release cycle.

## 3. Should `handed_off` applications count against the cap? (SDD Appendix B6)

**Recommendation: No — `handed_off` applications do not count against either cap.**

Reasoning: a `handed_off` application (SDD §6.5.1 — non-allowlisted ATS, app prepares an answer sheet
and deep-links the user to the employer's own form in Safari, where **the user, not the app, performs
the actual submission**) is a fundamentally different act from an automated submission. The two risks
this policy exists to manage do not apply in the same way:
- **App Store/ToS risk (Guideline 5.2.2)**: the app is not the one submitting — the user is, in their
  own browser session, exactly as if they had found the job themselves. There is no automated
  interaction with the third-party service to be "specifically permitted" for at all in the
  submission step itself (the app's role ends at preparing an answer sheet, which is the app's own
  content, not an interaction with the third party).
- **Employer-side harm (R10)**: the friction of a manual Safari submission is real friction — it is
  not swipe-speed. A user who has to actually complete a form in their own browser, even with an
  answer sheet to paste from, is not capable of the trivial mass-application pattern R10 is about;
  the human bottleneck the whole review-path was designed to preserve (SDD §6.5.1: "a human sees the
  application before it is sent") is exactly what makes this category lower-risk by construction.

**Caveat — this should not become an unlimited bypass**: if in practice a large share of
`awaiting_review` traffic reroutes to `handed_off` specifically *because* it's uncapped (e.g. gaming
behaviour, or simply because most sources end up NO-GO/allowlist-excluded per `source-assessment.md`
and everything funnels through handoff), Product should revisit this with real data. Recommend
instrumenting `handed_off` volume per user from day one even though it isn't capped, specifically so
this assumption can be checked rather than assumed indefinitely.

## 4. Summary for FR-024 defaults

| Cap | Value | Applies to | Counted at |
|---|---|---|---|
| Daily submission cap | 15 / rolling 24h | `auto_submit` and confirmed `review_before_sending` paths reaching `applied` | Transition into `applied` |
| Per-employer concurrent cap | 1 open application | Same employer (by dedup identity), any submission mode | Any non-terminal `Application` for that employer |
| `handed_off` applications | **Excluded from both caps** | — | — (still worth instrumenting, per §3) |

These are launch defaults for `UserProfile.dailySubmissionCap` and the employer-cap enforcement in
T054/T060 — not values engineering should treat as hardcoded constants; both should be server-side
configurable per SDD §7 item 3's existing `dailySubmissionCap` field design.

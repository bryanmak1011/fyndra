# Simulator walkthrough — 2026-09-21

Every image here is a real screenshot taken by `DemoWalkthroughUITests`
driving the app in the iPhone 17 Simulator against the **live** local API,
worker and Postgres. Nothing is a mockup, and nothing was posed by hand.

Reproduce with the steps in [../../README.md](../README.md) ("The two kinds
of UI test"), then re-export with
`xcrun xcresulttool export attachments --path <...>.xcresult --output-path .`.

| Screenshot | What it shows |
|---|---|
| `01-sign-in.png` | Email-only sign-in (FR-026). No password. |
| `02-test-account-entered.png` | The configured test account. It is on the server's `AUTH_BYPASS_EMAILS` list, so tapping "Send code" signs it straight in — the code step never appears. |
| `03-job-feed.png` | The swipe deck, served from `GET /jobs/feed` — ranked `FeedEntry` rows from Postgres, rendering a zh-Hant posting. |
| `04-after-pass.png` | The deck after a left swipe: the next card, no waiting. |
| `05-after-apply.png` | After a right swipe. The cap counter in the toolbar has moved. |
| `06-application-tracking.png` | The application that swipe created, with its "needs you" badge. |
| `07-application-detail.png` | The timeline — `queued` then `awaiting_review`, both written by the real worker running the real state machine. |
| `08-profile.png` | Keywords and years of experience, editable, applied only on save (FR-003). |
| `09-settings.png` | Submission mode, daily cap, markets, language. |

## Two things worth noticing

**The match percentage reads 100%, not 120%.** An earlier run of this exact
walkthrough showed "120% match" and that is what caught the defect:
`matching/rank.ts` weights a title-token hit double while dividing by a
denominator that counts it once, so its score is unbounded. It is a ranking
value, not a fraction, and the card had been rendering it as one.

**The application detail has no answer sheet.** That is correct, not
missing: the apply route is handoff-only (no ATS platform exposes a public
third-party submission API — `BLOCKERS.md`), and the handoff path returns an
empty sheet for any provider without a form-schema reader. The user gets the
employer's own form instead.

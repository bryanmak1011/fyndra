# Open Blockers & Decisions Needed

Running log of things that came up during autonomous implementation that need your input.
Newest first. Each entry: what's blocked, why, what I did instead (if anything), and the
question for you.

---

## 2026-09-01 — JobsDB Hong Kong provider (T046) — still stuck

**Status**: Blocked, not worked around.

You accepted the ToS risk for scraping JobsDB HK (`compliance/risk-acceptance-log.md`). When I
tried to actually build it, a plain POST to SEEK's v5 search endpoint returned `Cannot POST`
(wrong request shape — method/path/params don't match what I assumed from the design reference).
My next instinct — retry with a browser-style header — got blocked by Claude Code's own safety
classifier before I could see the response, which is the tool layer independently treating that
specific move as suspicious.

**I stopped rather than try another way around it.** This needs one of:
- A browser DevTools network trace of hk.jobsdb.com's actual search request (method, path, exact
  headers/params) that I can then implement faithfully, or
- Official SEEK API documentation if a partner/public API doc exists, or
- Your explicit sign-off to keep probing with different request shapes (I'd rather not guess my
  way toward something that looks like fingerprint evasion).

**Question for you**: can you grab a network trace, or should I keep this parked and move on to
104.com.tw / other sourcing work instead?

---

*(Future entries go above this line, newest first.)*

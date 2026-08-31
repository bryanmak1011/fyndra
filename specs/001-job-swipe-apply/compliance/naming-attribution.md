# T004 — Trademark and Attribution Clearance

**Owner**: Functional Analyst · **Status**: Draft for review — **contains a finding that changes the
verdict this task was expected to reach** · **Date**: 2026-08-31
**Method**: Design-artifact review of the SDD's own attribution claims (no web research required for
that part, per task scope) plus a live WebSearch for the exact string "Swipe2Work" (required by task
scope, to check for existing use). This document gates SDD §12 R3 and Appendix B4.

---

## 1. career-ops attribution — design-artifact review

Per SDD §6.6 and §12 R3, the product design (job-source reconnaissance, provider doctrine, status
vocabulary shape, prompt-pattern structure for CV interpretation and answer drafting) was informed by
reading `github.com/santifer/career-ops`, an MIT-licensed open-source project. The SDD is explicit and
consistent throughout (§3, §6.6, §12 R2/R3) that **no code from career-ops is spawned, mounted, or
shipped** — it is read-and-cited, not a runtime dependency. This document takes that claim as given
(it is a design/engineering fact, not something a naming/trademark review re-derives) and focuses on
what follows from it for naming and attribution.

**MIT license compliance**: MIT licensing permits reuse of code with attribution and the license
notice preserved; since no code is shipped, the MIT license's copy-and-attribute condition is not
technically triggered by code reuse at all. The SDD nonetheless commits to crediting career-ops for
the *prompt text* it adapted (§6.6: "Where we adapt its prompt text, the source is credited in-repo"),
which is good practice regardless of strict license necessity — attribution for adapted creative/text
content (prompt engineering patterns) is the right norm even where the license technically only
requires it for code.

**Name/mark check**: career-ops's own `TRADEMARK.md` (as described in the SDD, §6.6 and §12 R3) does
not license the project's name for commercial product naming. **Swipe2Work does not incorporate
"career-ops" or any recognizable variant of it** — no shared word, no shared abbreviation, no visual
echo in the product name, bundle identifier, or store listing implied by the SDD. On this narrow
question — does the chosen name collide with the design-reference project's mark — the answer is
**clear: no collision.**

**Recommended attribution text** (for an in-app "About"/"Acknowledgements" screen and a repository
`NOTICE`/`CONTRIBUTORS` file):

> Swipe2Work's job-sourcing and application-assistance design was informed in part by
> [career-ops](https://github.com/santifer/career-ops), an open-source project released under the MIT
> License. We studied career-ops's approach to identifying public job-source endpoints, its provider
> etiquette (respecting robots.txt and rate limits), and elements of its prompt design for CV
> interpretation and application-answer drafting. Swipe2Work does not incorporate career-ops's source
> code, and career-ops is not affiliated with, and does not endorse, Swipe2Work. career-ops © its
> respective authors, used here as a credited design influence only.

This wording is deliberately careful about two things: (1) it does not claim endorsement or
affiliation, which would be misleading given career-ops explicitly declines to build the auto-submit
capability this app builds (SDD D2/R2); (2) it is honest that no code was taken, so it does not
overstate what MIT compliance requires while still crediting the design debt in good faith.

---

## 2. The naming search — and a finding that should change how this task is closed

Task scope asked for a WebSearch on the exact string "Swipe2Work" to flag any existing unrelated use.
That search returns a **direct hit that is not a naming coincidence to note in passing — it is a
live, functioning competitor operating under nearly the exact same name and the same product
concept**:

- **`swipe2work.ai`** is an active product, description found via search: *"Swipe2Work.ai is an
  AI-powered job search platform where you can swipe on opportunities that match your skills and let
  AI handle the applications... you upload your CV, swipe through personalized job recommendations,
  and let the AI bot apply automatically. For each right swipe, the bot fills out the application
  form and submits it."* It targets the German job market. A third-party review aggregator
  (Scamadviser) lists it as an apparently legitimate, operating site.
- Attempts to fetch `swipe2work.ai` and `www.swipe2work.ai` directly both failed with DNS resolution
  errors (`ENOTFOUND`) from this tool at the time of this review — this could mean the domain is
  down, geo-restricted, or blocking this tool's resolver; it does **not** mean the product doesn't
  exist, since it is independently described across multiple indexed pages (a dedicated marketing
  page at `swipe2work.ai/en/automatisch-bewerben`, an English landing page indexed as "AI-Powered Job
  Search in Germany | Swipe to Work," and third-party coverage). Treat the product as real and active
  based on this indirect but multi-source evidence; a human should confirm directly in a browser
  (this tool could not) before any final decision.
- I could not retrieve an Impressum/company-registration page, so the legal entity behind
  `swipe2work.ai` and whether it holds any registered trademark are **not established by this
  review** — that requires either a direct browser visit (blocked here) or a formal trademark-registry
  search (EUIPO/DPMA for Germany), which is outside a WebSearch-only review and should be commissioned
  from IP counsel if the name is to be kept.

**Why this matters more than a simple "name taken" flag**: this is not a case of a same-sounding but
functionally unrelated app (the kind of false positive this check usually screens for). The
`swipe2work.ai` product description — CV upload, AI-driven swipe-to-match, automated application
submission on right-swipe — is close enough to this project's own feature set that a reasonable
observer (or a trademark examiner assessing likelihood of confusion) would see them as the same class
of product. Geographic separation (Germany vs. Hong Kong/Taiwan) reduces immediate market-confusion
risk and litigation exposure today, but:
- Both are iOS/mobile-oriented job-search products, a single global app-store namespace (Apple's App
  Store has one global name-search surface even for regionally-targeted apps), so "Swipe2Work" search
  results in the App Store would surface both, undermining discoverability regardless of legal
  exposure.
- If `swipe2work.ai` holds or later obtains a registered trademark (EU or otherwise) and expands
  markets, or if this project expands beyond HK/TW later, the collision becomes a live legal risk, not
  just a discoverability one.

**Verdict on B4/R3 is revised, not simply confirmed**: SDD Appendix B4 was marked "resolved:
Swipe2Work" and R3 was rated Low severity on the assumption that the only naming risk was career-ops's
mark (§1 above, correctly cleared). **That framing is incomplete.** The actual open naming risk is an
unrelated third party already operating under essentially the same name with essentially the same
product concept, which §1's clearance does not address at all. This task cannot respond with a clean
GO on naming.

**Recommendation**: 
1. Treat B4 as **NEEDS-REVIEW, not resolved** — flag to Product/Tech Lead immediately, before further
   collateral (App Store Connect app record, marketing materials, domain registration) is built around
   the name "Swipe2Work."
2. Commission a proper trademark clearance search (EUIPO, USPTO, HK/TW registries as relevant to
   planned distribution markets) specifically because of the `swipe2work.ai` finding — a WebSearch is
   not a trademark clearance and this document does not substitute for one.
3. In parallel, have Product decide whether a name adjustment (e.g. a market-distinguishing suffix, or
   a different name entirely) is preferable to litigating or coexisting with an already-live,
   conceptually identical product — this is a business decision this document surfaces but does not
   make.

---

## 3. Summary verdict

| Question | Verdict |
|---|---|
| Does "Swipe2Work" incorporate career-ops's name/mark? | **Clear — no collision found.** |
| Is the credit-only attribution wording for career-ops appropriate? | **Yes — drafted in §1, ready for in-app "About" and `NOTICE`/`CONTRIBUTORS`.** |
| Is "Swipe2Work" clear of existing unrelated use? | **NO — an active, conceptually identical product (`swipe2work.ai`, Germany) was found operating under essentially the same name.** |
| Is SDD Appendix B4 / R3 correctly closed as currently written? | **No — revise B4 to NEEDS-REVIEW and keep R3 open pending a real trademark search, per T007.** |

Sources:
- SDD.md §6.6, §12 (R2, R3), Appendix A item 25, Appendix B item B4 (as provided; not independently
  re-verified, per task scope for this section)
- WebSearch: `"Swipe2Work" app`, `"Swipe2Work" trademark OR app store OR play store`,
  `swipe2work.ai company Germany automatisch bewerben Impressum` (2026-08-31) — indexed pages
  including `swipe2work.ai/en/automatisch-bewerben`, `scamadviser.com/check-website/swipe2work.ai`

# Feature Specification: Swipe-to-Apply Job Search

**Feature Branch**: `001-job-swipe-apply`

**Created**: 2026-08-31 | **Revised**: 2026-08-31 (rev 3)

**Status**: Draft

**Revision note**: Rev 2 corrected three premises that were factually wrong after career-ops was
read at source. **Rev 3** demotes career-ops from a runtime dependency to a **design reference** —
we build the scrapers, submitter, CV parser, and tracker ourselves — which lifts rev 2's DOCX
restriction (that was career-ops's limit, not ours). Product name is **Fyndra**. Target market
is **Hong Kong and Taiwan**. See
[SDD.md Appendix A](./SDD.md#appendix-a-review-of-earlier-planning) for the finding-by-finding
record.

**Input**: User description: "Build a mobile application that help users to apply job in swiping. Use career-ops as back-spine, the app should allow cv upload, categorize and capture keywords or YoE. Based on that to start Job Searching, user can either swipe left to reject the job, or swipe right to apply jobs. Backend will either help applying the job in headless browser, or help dropping the communications if that's in Linkedin or Indeed. User can track job applications status in app. App reference: Source, Sprout"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload CV and build a profile (Priority: P1)

A job seeker installs the app and uploads their CV (text-layer PDF or DOCX, in English or
Traditional Chinese). The system parses the document,
extracts key skills/keywords and years of experience (YoE), and shows the seeker a summary of
what it captured so they can confirm or correct it before job matching begins.

**Why this priority**: Every downstream feature (matching, swiping, applying) depends on having a
structured profile derived from the CV. Without this, there is no basis for the job feed.

**Independent Test**: Can be fully tested by uploading a CV file and verifying the app displays
extracted keywords, skill categories, and a YoE estimate that the user can edit and save —
independent of any job search or swipe functionality.

**Acceptance Scenarios**:

1. **Given** a new user with no profile, **When** they upload a CV file, **Then** the system parses
   it and displays extracted keywords, skill categories, and an estimated YoE within a reasonable
   processing time.
2. **Given** a parsed CV, **When** the user edits an incorrectly extracted keyword or YoE value,
   **Then** the correction is saved and used for subsequent job matching.
3. **Given** a user attempts to upload a file that is not a supported CV format, **When** the
   upload is submitted, **Then** the system rejects it with a clear error message and no profile
   is created.

---

### User Story 2 - Swipe through matched jobs (Priority: P1)

Using the profile built from the CV, the app presents a feed of job postings one at a time. The
user swipes left to reject a job (never shown again) or swipes right to start the apply flow for
that job.

**Why this priority**: This is the core, defining interaction of the product — without it, the app
is just a CV parser. It must ship alongside Story 1 for the MVP to be meaningful.

**Independent Test**: Can be fully tested by seeding a profile and a set of candidate jobs, then
verifying that swiping left removes a job from the feed permanently and swiping right transitions
the job into the apply flow, without requiring the apply automation itself to be functional.

**Acceptance Scenarios**:

1. **Given** a user with a saved profile, **When** they open the app, **Then** they see a feed of
   job postings ranked by relevance to their extracted keywords and YoE.
2. **Given** a job card on screen, **When** the user swipes left, **Then** the job is marked
   rejected, removed from the feed, and never resurfaced to that user.
3. **Given** a job card on screen, **When** the user swipes right, **Then** the job enters the
   apply flow and the app confirms the action to the user.
4. **Given** the user has swiped through all currently available matches, **When** no more jobs
   remain, **Then** the app shows an empty/end-of-feed state rather than an error.

---

### User Story 3 - Automated job application (Priority: P2)

When a user swipes right, the backend prepares the application on the user's behalf — filling the
employer's application form from the user's profile and CV — and then either submits it directly
(only for applicant-tracking systems on a supported allowlist) or hands the user a reviewed answer
sheet plus a deep link to complete it themselves.

**Why this priority**: This is the product's core value proposition (reducing manual application
effort) but depends on Stories 1 and 2 already working, and can be delivered as a fast-follow once
swiping and matching are validated.

**Independent Test**: Can be fully tested by triggering the apply flow for a single job with known
form fields and verifying the application is submitted (or handed off for review, per the
confirmed submission policy) and the outcome is recorded against that job.

**Acceptance Scenarios**:

1. **Given** any right-swiped job, **When** the swipe is registered, **Then** the app confirms the
   action immediately and the application is queued — the user never waits on the submission itself.
2. **Given** the user is in "review before sending" mode, **When** the application has been
   prepared, **Then** the user is shown an answer sheet (each form field with the proposed answer)
   and nothing is sent until they confirm.
3. **Given** the user is in "auto-submit" mode and the job is hosted on an allowlisted applicant
   tracking system, **When** the application is prepared with no unanswered or sensitive questions
   and the user is within their submission caps, **Then** the system submits it without further
   user action.
4. **Given** the user is in "auto-submit" mode but the job is **not** on the allowlist, **When**
   the application is prepared, **Then** the system falls back to review-before-sending rather
   than submitting to an unrecognized form.
5. **Given** an application form contains a question the system cannot answer from the user's
   profile, **When** the system reaches that question, **Then** it does not submit, sets status to
   "Pending — needs answer", surfaces the specific question, and notifies the user.
6. **Given** a form asks a sensitive question (work authorization, visa status, expected salary,
   identity number, or demographics), **When** the system reaches it, **Then** it is never
   auto-answered in either mode — it always becomes "Pending — needs answer".
7. **Given** an application is "Pending — needs answer", **When** the user provides the answer,
   **Then** the system completes submission and records the answer for reuse on future
   applications — except for sensitive answers, which are never reused.
8. **Given** an application cannot be submitted directly (form not allowlisted, or the user's own
   submission is required), **When** the user confirms, **Then** the app deep-links them to the
   employer's form with their answer sheet available, and marks the application "handed off".
9. **Given** an attempt fails for a reason other than a missing answer (CAPTCHA, multi-step form,
   site error), **When** the failure occurs, **Then** status becomes "needs attention" with a
   specific reason and the user is notified, rather than silently failing.

---

### User Story 4 - Track application status (Priority: P2)

The user can view a list of every job they've swiped right on, along with its current status
(queued, awaiting review, pending an answer, handed off, needs attention, applied, responded,
interview, offer, hired, rejected), updated as the backend learns more.

**Why this priority**: Tracking closes the loop on the core swipe-to-apply value proposition and
is expected by users once applications start being submitted, but the tracking view itself can be
built once Story 3 produces status events to display.

**Independent Test**: Can be fully tested by generating applications with known statuses and
verifying the tracking list displays each job with the correct status and last-updated time,
independent of whether new statuses are still arriving live.

**Acceptance Scenarios**:

1. **Given** the user has one or more submitted applications, **When** they open the tracking
   view, **Then** they see each application with its job title, employer, submission date, and
   current status.
2. **Given** an application's status changes on the backend, **When** the user next views the
   tracking list, **Then** the updated status is reflected.
3. **Given** the user selects a specific tracked application, **When** they open its detail view,
   **Then** they see a timeline/history of status changes for that application.

---

### Edge Cases

- What happens when the CV upload is unreadable, corrupted, password-protected, or a **scanned
  image PDF with no text layer**?
- What happens when the CV is in Traditional Chinese and the job description is in English (or the
  reverse) — does matching still work across languages?
- What happens when a job description is written in Traditional Chinese and keyword extraction
  finds nothing because the text has no whitespace word boundaries?
- What happens when a job posting appears on two sources (e.g., a Taiwan board and the employer's
  own Greenhouse page) — is it shown twice?
- What happens when the user reaches their daily submission cap mid-swiping session?
- How does the system handle a job posting that is removed or expired between being shown in the
  feed and the user swiping right on it?
- What happens if an automated submission encounters a CAPTCHA, a multi-step form, or other
  bot-detection challenge mid-application?
- How does the system behave if the user swipes right on the same job twice (e.g., after
  reinstalling the app)?
- What happens when the user has no jobs left matching their profile — does the app broaden
  criteria automatically or require the user to adjust filters?
- How does the system handle a job source that starts rate-limiting or blocking automated access —
  does the feed degrade gracefully, and is that source dropped rather than worked around?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to upload a CV file (**text-layer PDF or DOCX**) and parse it
  into a structured profile. Scanned/image-only PDFs MUST be rejected with a clear explanation
  naming the reason (they require OCR, which is out of scope for v1).
- **FR-002**: System MUST extract and categorize skills/keywords and an estimated years-of-experience
  (YoE) value from the uploaded CV.
- **FR-003**: Users MUST be able to review and manually correct extracted keywords and YoE before
  they are used for job matching.
- **FR-004**: System MUST use the confirmed profile (keywords, YoE) to rank a feed of candidate job
  postings sourced from supported HK/TW job providers.
- **FR-004a**: System MUST serve the swipe feed from already-collected postings, not by searching
  job sources at swipe time, so that swiping never waits on an external source.
- **FR-005**: Users MUST be able to swipe left on a job card to reject it, permanently removing it
  from that user's feed.
- **FR-006**: Users MUST be able to swipe right on a job card to initiate the apply flow for that
  job.
- **FR-007**: System MUST record every swipe-right action as an application intent tied to the
  user and the specific job posting.
- **FR-008**: System MUST prepare a complete application for every swiped-right job — filling each
  form field from the user's profile and CV — and MUST record the proposed answers so the user can
  review them.
- **FR-009**: System MUST submit an application directly on the user's behalf **only** when the
  posting is hosted on an allowlisted applicant tracking system with a known form schema. For every
  other posting, the system MUST fall back to preparing the application and handing it to the user
  to submit (FR-025), and MUST NOT attempt automated submission.
- **FR-009a**: System MUST NOT automate submission, messaging, or scraping on LinkedIn or Indeed.
  Neither platform is a supported job source or application channel.
- **FR-010**: System MUST record and expose the outcome of every application attempt back to the
  user, using the status vocabulary in Assumptions — including a specific reason whenever an
  attempt does not result in a submitted application.
- **FR-011**: Users MUST be able to view a list of all jobs they have applied to, along with each
  job's current status.
- **FR-011a**: Users MUST be able to update an application's post-submission status themselves
  (responded, interview, offer, hired, rejected), since employer responses arrive outside the app.
- **FR-012**: Users MUST be able to view the status history/timeline for an individual tracked
  application.
- **FR-013**: System MUST notify the user when an automated application attempt fails or requires
  manual intervention, including the reason.
- **FR-014**: System MUST NOT resurface a job the user has already swiped left or right on.
- **FR-015**: System MUST persist the user's profile (CV data, keywords, YoE) across sessions and
  devices tied to their account.
- **FR-016**: System MUST source job postings for the **Hong Kong and Taiwan** markets from job
  boards and applicant tracking systems, via one provider per source behind a common interface.
- **FR-016a**: System MUST only source from job boards and career sites that permit automated
  access. It MUST honour `robots.txt`, crawl-delay, and rate-limit responses, and MUST NOT attempt
  to circumvent bot protection — a source that blocks automated access is dropped, not worked around.
- **FR-016b**: System MUST show a posting only once even when it is discovered through multiple
  sources, de-duplicating on the employer's own application URL where one is available.
- **FR-016c**: Users MUST be able to choose which of the supported markets (Hong Kong, Taiwan)
  their feed draws from.
- **FR-017**: System MUST NOT store user credentials for any employer site or job platform.
  Applications are submitted only to endpoints that accept a submission without a candidate login.
- **FR-018**: System MUST let each user choose a submission mode — "review before sending" (the
  system prepares the application and waits for the user's explicit confirmation before final
  submission) or "auto-submit" (the system submits immediately on swipe-right) — with
  "review before sending" as the default for new users.
- **FR-019**: Users MUST be able to change their submission mode at any time in settings, and the
  new mode applies to subsequent swipes (not retroactively to in-flight applications).
- **FR-020**: If an application form contains a question the system cannot answer from the user's
  profile/CV data, the system MUST NOT submit that application blind — in **either** submission
  mode it MUST set the application's status to "Pending — needs answer" and surface the specific
  unanswered question(s) to the user for input.
- **FR-021**: Once the user answers a "Pending — needs answer" question, the system MUST resume and
  complete submission of that application using the provided answer, and MUST reuse that answer for
  future applications with the same or a substantially similar question where appropriate.
- **FR-022**: System MUST NOT auto-answer sensitive questions in either submission mode — work
  authorization and visa status, identity numbers (e.g. HKID / 身分證字號), expected salary, and
  demographic questions. These MUST always become "Pending — needs answer", and their answers MUST
  NOT be reused across applications.
- **FR-023**: System MUST acknowledge a right-swipe immediately and perform the application attempt
  asynchronously; the user MUST NOT wait on submission to continue swiping.
- **FR-024**: System MUST enforce a per-user daily submission cap and a per-employer cap, and MUST
  tell the user when a cap is reached rather than silently dropping applications.
- **FR-025**: When direct submission is unavailable, System MUST provide the user with their
  reviewed answers and a link to the employer's application form, and MUST let the user mark the
  application as submitted by them.
- **FR-026**: System MUST authenticate users and scope all profile, swipe, and application data to
  the authenticated account.
- **FR-027**: System MUST support job descriptions and CVs in **Traditional Chinese and English**,
  including matching a CV in one language against a posting in the other.
- **FR-028**: System MUST present its interface in Traditional Chinese and English, defaulting to
  the device language, and MUST let the user override that choice in settings.
- **FR-029**: System MUST notify the user outside the app (push notification) when an application
  needs their answer, needs attention, or reaches a terminal outcome.

### Key Entities

- **User Profile**: Represents a job seeker — account identity, parsed CV data, categorized skill
  keywords, YoE estimate, and any manual corrections. Owns zero or more Job Interactions.
- **CV Document**: The uploaded resume file and its parsed structured output (keywords, YoE,
  sections). Belongs to one User Profile; a new upload supersedes the prior parse.
- **Job Posting**: A job listing sourced from a supported provider — title, employer, source
  provider, the employer's own application URL (used as the de-duplication key), market (HK/TW),
  language, requirements, and application method metadata.
- **Job Interaction (Swipe)**: A record of a user's left/right swipe on a Job Posting, including
  direction and timestamp. A right swipe creates an associated Application.
- **Application**: The application-attempt record tied to one Job Interaction — submission route
  (direct submission vs. handed off to the user), submission mode used (review-before-sending vs.
  auto-submit), current status (including "Pending — needs answer" and "handed off"), status
  history, and failure reason if applicable.
- **Application Question & Answer**: A question surfaced by an application form that the system
  could not answer automatically, the user-supplied answer, whether the question is **sensitive**,
  and whether the answer is reusable for future applications with a similar question.
- **Application Status Event**: A single timestamped status change within an Application's
  history (e.g., applied → responded → interview).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can upload a CV and reach their first job in the swipe feed in under 3
  minutes.
- **SC-002**: At least 90% of CV uploads in a supported format produce a usable keyword/YoE
  extraction without requiring the user to manually re-enter data from scratch — measured
  separately for English and Traditional Chinese CVs, with neither below 85%.
- **SC-003**: At least 80% of swipe-right actions on **allowlisted** postings result in a
  successfully submitted application without manual user intervention.
- **SC-003a**: At least 60% of postings in the HK/TW feed resolve to an application route the
  system can prepare end-to-end (direct submission or handoff with a complete answer sheet).
- **SC-004**: Users can see the current status of any application they've submitted within 5
  seconds of opening the tracking view.
- **SC-005**: Fewer than 5% of automated application attempts end in an unexplained failure (i.e.,
  a failure without a reason surfaced to the user).
- **SC-006**: 90% of users who swipe right on at least one job return to the tracking view at
  least once within 7 days to check status.

## Assumptions

- **Target market is Hong Kong and Taiwan.** Feed relevance, language support, and privacy
  obligations (HK PDPO, TW PDPA) are scoped to those two markets.
- **career-ops is a design reference, not a runtime dependency.** Nothing of it is deployed,
  spawned, or shipped. It contributes knowledge: which HK/TW job endpoints are public and stable,
  a defensible provider doctrine (honour robots/rate limits, never defeat bot protection), a
  status vocabulary, and the sensitive-field carve-out. We build the scrapers, the submitter, the
  CV parser, and the tracker ourselves.
- "Source" and "Sprout" refer to the general swipe-card interaction pattern (à la dating-app style
  swiping) as visual/UX reference, not to a specific technical integration.
- Supported CV formats at launch are **text-layer PDF and DOCX**. Scanned/image-only PDFs are out
  of scope for v1 — they require OCR.
- Job sources at launch: Hong Kong's dominant job board (JobsDB, via SEEK's public search API),
  Yourator for Taiwan startup roles, and multinational-employer applicant tracking systems — then
  Taiwan's mainstream boards, chiefly 104.com.tw. LinkedIn and Indeed are excluded: both prohibit
  automated access.
- Direct submission is limited to applicant tracking systems with published form schemas
  (Greenhouse, Lever, Ashby, Workable at launch). Everything else is handed to the user to submit.
- Application status values are: pre-submission (queued, awaiting review, pending — needs answer,
  handed off, needs attention) and post-submission (applied, responded, interview, offer, hired,
  rejected, withdrawn). Post-submission transitions are user-reported in v1; automatic detection of
  employer replies would require mailbox access and is deferred.
- Semantic steps (CV keyword/YoE interpretation, drafting form answers, judging cross-language
  relevance) require a language model; deterministic steps (sourcing, de-duplication, keyword
  overlap, status bookkeeping) do not and MUST NOT depend on one.
- New users default to "review before sending"; the choice to switch to "auto-submit" is an
  explicit, informed opt-in surfaced in settings, not a first-run prompt.
- Mobile support targets a single account per device session; multi-account switching is out of
  scope for v1.
- Phase 1 runs against a local development server and is therefore **not distributable via
  TestFlight or the App Store**; cloud deployment is a Phase 2 prerequisite for distribution.

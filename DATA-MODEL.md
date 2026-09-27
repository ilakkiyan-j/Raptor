# Data Model Specification

## 1. Overview & Principles

Raptor uses a normalized relational data model managed through **sqlite3** and persisted in **SQLite**.

The schema is built around the following domain principles:
1. **Explicit Identity:** Fixture primary identifiers remain stable string keys (e.g. `evt_01`, `prj_01`, `jdg_01`) matching DOGFOOD convention.
2. **UTC Timestamps:** Event deadlines and application-created timestamps use ISO-8601 UTC strings.
3. **Hard Boundary Isolation:** Ballots and scores are tied to a judge and project; API role checks restrict cross-judge reads.
4. **Resilient Scoring:** Unreviewed assignments have no ballot and do not contribute a zero to score averages.

---

## 2. Entity Relationship Diagram

```text
  ┌───────────────────┐         ┌───────────────┐
  │       Event       │ 1     * │     Track     │
  │───────────────────│─────────│───────────────│
  │ id (PK)           │         │ id (PK)       │
  │ name              │         │ event_id (FK) │
  │ submissions_close │         │ name          │
  └─────────┬─────────┘         └───────────────┘
            │ 1
            │
            │ *
  ┌─────────┴─────────┐         ┌─────────────────┐ *    1 ┌───────────────┐
  │      Project      │ 1     * │     Ballot      │────────│     Judge     │
  │───────────────────│─────────│─────────────────│        │───────────────│
  │ id (PK)           │         │ judge_id (PK)   │        │ id (PK)       │
  │ event_id (FK)     │         │ project_id (PK) │        │ user_id (FK)  │
  │ team_id (FK)      │         │ comment         │        └───────────────┘
  │ track_id (FK)     │         │ submitted_at    │
  │ title             │         └────────┬────────┘
  │ summary           │                  │ 1
  │ repo_url          │                  │ *
  │ submitted_at      │         ┌────────┴────────┐
  └───────────────────┘         │   BallotScore   │
                                │─────────────────│
                                │ judge_id (PK)   │
                                │ project_id (PK) │
                                │ criterion (PK)  │
                                │ score           │
                                └─────────────────┘
```

The drawing keeps the original high-level layout. `Ballot` is keyed by the `(judge_id, project_id)` assignment; `BallotScore` adds a criterion to that composite key. The schema also has event roles, teams, membership, rubric criteria, invitations, sessions and audit records, listed below.

---

## 3. Core Entities

### 3.1 `User`
Represents platform actors and security principals.
- `id` (TEXT, PK): application user ID such as `usr_...`; fixture judge IDs live in `judges`, not `users`.
- `email` (TEXT, unique, case-insensitive): User's email address.
- `name` (TEXT): Display name.
- `salt` and `password_hash` (TEXT): Salt and PBKDF2-SHA256 hash for local login.
- `roles` (separate table): `(user_id, event_id, role)` has a composite primary key. Stored roles are `organizer`, `judge`, `participant` or `admin`; visitors are public readers, not role rows.
- `sessions` (separate table): Stores `token_hash` (PK), `user_id` (FK), `expires_at` and `csrf_token`. The browser's opaque session token is never stored in plaintext.

### 3.2 `Event`
Represents a hackathon event.
- `id` (TEXT, PK): e.g. `evt_01`.
- `name` (TEXT): Event title (e.g. `Sample Hack 2026`).
- `submissions_close` (TEXT): ISO-8601 UTC deadline after which project writes are rejected.
- `judging_close` (TEXT, nullable): Optional judging deadline added by the application.

### 3.3 `Track`
Category or theme under an event.
- `id` (TEXT, PK): e.g. `trk_01`.
- `event_id` (TEXT, FK -> `events.id`).
- `name` (TEXT): e.g. `Developer tools`; unique with `event_id`.

### 3.4 `Team` & `TeamMember`
Participant teams.
- `teams`: `id` (TEXT, PK), `event_id` (TEXT, FK -> `events.id`), `name` (TEXT).
- `team_members`: `(team_id, user_id)` composite PK with FKs to `teams` and `users`. Membership is stored as rows, not a list of emails on `teams`.
- `team_invites`: `token_hash` (TEXT, PK), `team_id` (FK), `email`, `expires_at`, optional `accepted_at`, and `created_by` (FK -> `users.id`). Raw invite tokens are not stored.

### 3.5 `Project`
Hackathon project submission.
- `id` (TEXT, PK): e.g. `prj_01`.
- `event_id`, `team_id`, `track_id` (TEXT, FKs to their respective tables).
- `title`, `summary`, `repo_url` (TEXT): Project content; `repo_url` defaults to an empty string.
- `submitted_at` (TEXT, nullable): Submission timestamp; a draft has none.
- `state` (TEXT): `draft` or `submitted` (SQL CHECK constraint).
- No unique constraint on team/title: duplicate-title fixture records remain separate.

### 3.6 `RubricCriterion`
Weighted evaluation criteria defined for an event.
- `(event_id, criterion)` (TEXT, composite PK); `event_id` references `events.id`.
- `weight` (REAL, positive), `min_score` and `max_score` (INTEGER). Range validation occurs in the API.
- Fixture criterion keys are `functionality`, `quality` and `innovation`; equal demo weights and range 1-5 are app-owned choices, not fixture fields.

### 3.7 `Assignment`, `Ballot` & `BallotScore`
Judge scoring records.
- `judges`: `id` (TEXT, PK), `event_id` (FK -> `events.id`), `user_id` (FK -> `users.id`). `judge_tracks` links `(judge_id, track_id)` as a composite PK.
- `assignments`: `(judge_id, project_id)` composite PK with FKs to `judges` and `projects`. An unreviewed assignment has no ballot.
- `ballots`: `(judge_id, project_id)` composite PK and FK to its assignment; `comment` (TEXT, not null) and `submitted_at` (TEXT). Completion is represented by the ballot row, not an `is_complete` column.
- `ballot_scores`: `(judge_id, project_id, criterion)` composite PK; score (INTEGER). The judge/project pair references the ballot; criterion presence and range are checked against the event rubric by the API.
- `audit_events`: auto-increment integer `id`, `actor_id` and `event_id` FKs, `action`, `subject_id`, `happened_at`; records selected writes.

---

## 4. Fixture Ingestion Pipeline

The idempotent loader in `apps/api/app/seed.py` reads the unchanged root `fixtures.json` and loads:
1. `event` $\rightarrow$ one event (`evt_01`, submissions closed `2026-03-01T18:00:00Z`).
2. `tracks` $\rightarrow$ 8 track records.
3. `teams` $\rightarrow$ 40 teams, member user records, memberships and participant roles.
4. `judges` $\rightarrow$ 30 judges with linked users, judge roles and eligible tracks.
5. `projects` $\rightarrow$ **41 submitted project records**, preserving their IDs and timestamps.
6. `scores` $\rightarrow$ 126 assignments and ballots, and 378 criterion-score rows.

The application separately creates an organizer and admin account and four fixed local checker sessions. Fixture ballots have no timestamp, so their stored `submitted_at` is synthetic import metadata, not a judge action time. An existing seeded event is not reimported on restart.

### Handling Awkward Cases in Fixtures:
- **Missing reviews:** No ballot row is invented for a missing review, and missing reviews do not count as zero.
- **Unvarying judge scores:** Normalization uses a shrunk judge mean; it does not divide by standard deviation.
- **Duplicate project records:** `prj_07` and `prj_41` both belong to `tm_07` and share a title. Both remain stored; there is no team/title uniqueness constraint.

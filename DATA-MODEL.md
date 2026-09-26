# Data Model Specification

## 1. Overview & Principles

Raptor uses a normalized relational data model managed through **SQLAlchemy 2.0** and persisted in **SQLite**.

The schema is built around the following domain principles:
1. **Explicit Identity:** All primary identifiers are stable string keys (e.g. `evt_01`, `prj_01`, `jdg_01`) matching DOGFOOD convention.
2. **UTC Timestamps:** All dates and deadlines are stored as ISO-8601 UTC strings.
3. **Hard Boundary Isolation:** Evaluations and scores are explicitly tied to the evaluating judge and cannot be traversed or queried cross-judge by unauthorized actors.
4. **Resilient Scoring:** Missing criteria or incomplete review batches are safely handled without corrupting overall event aggregates.

---

## 2. Entity Relationship Diagram

```text
  ┌──────────────┐          ┌──────────────┐
  │    Event     │ 1      * │    Track     │
  │--------------│──────────│--------------│
  │ id (PK)      │          │ id (PK)      │
  │ name         │          │ event_id(FK) │
  │ sub_close_at │          │ name         │
  └──────┬───────┘          └──────────────┘
         │ 1
         │
         │ *
  ┌──────┴───────┐          ┌──────────────┐
  │   Project    │ 1      * │  Evaluation  │ *      1 ┌──────────────┐
  │--------------│──────────│--------------│──────────│     User     │
  │ id (PK)      │          │ id (PK)      │          │--------------│
  │ event_id(FK) │          │ project_id   │          │ id (PK)      │
  │ team_id (FK) │          │ judge_id(FK) │          │ email        │
  │ track_id(FK) │          │ comment      │          │ role         │
  │ title        │          │ submitted_at │          └──────────────┘
  │ summary      │          └──────┬───────┘
  │ repo_url     │                 │ 1
  │ submitted_at │                 │ *
  └──────────────┘          ┌──────┴───────┐
                            │  ScoreEntry  │
                            │--------------│
                            │ evaluation_id│
                            │ criterion_key│
                            │ score_value  │
                            └──────────────┘
```

---

## 3. Core Entities

### 3.1 `User`
Represents platform actors and security principals.
- `id` (String, PK): e.g. `jdg_01`, `org_01`, `prt_01`.
- `email` (String, Unique): User's email address.
- `password_hash` (String, Nullable): Hashed password for standard login.
- `name` (String): Display name.
- `role` (Enum): `organizer`, `judge`, `participant`, `admin`, `visitor`.
- `session_token` (String, Nullable): Direct session token for fixture test auth (e.g. `org_7f2a`).

### 3.2 `Event`
Represents a hackathon event.
- `id` (String, PK): e.g. `evt_01`.
- `name` (String): Event title (e.g. `Sample Hack 2026`).
- `submissions_close` (DateTime UTC): Hard deadline after which submissions are rejected.

### 3.3 `Track`
Category or theme under an event.
- `id` (String, PK): e.g. `trk_01`.
- `event_id` (String, FK -> Event.id).
- `name` (String): e.g. `Developer tools`.

### 3.4 `Team` & `TeamMember`
Participant teams.
- `id` (String, PK): e.g. `tm_01`.
- `name` (String): Team name.
- `members` (Relationship -> Users by email).

### 3.5 `Project`
Hackathon project submission.
- `id` (String, PK): e.g. `prj_01`.
- `team_id` (String, FK -> Team.id).
- `track_id` (String, FK -> Track.id).
- `title` (String): Project name (e.g. `Quiet Hours`).
- `summary` (Text): Short pitch.
- `repo_url` (String): Public repository link.
- `submitted_at` (DateTime UTC): Timestamp of submission.
- `status` (Enum): `draft`, `submitted`.

### 3.6 `RubricCriterion`
Weighted evaluation criteria defined by the organizer.
- `id` (String, PK): e.g. `crit_functionality`.
- `event_id` (String, FK -> Event.id).
- `key` (String): e.g. `functionality`, `quality`.
- `weight` (Float): Relative weight multiplier (e.g. `0.6`, `0.4`).
- `max_score` (Integer): Maximum scale points (e.g. `5`).

### 3.7 `Evaluation` & `ScoreEntry`
Judge scoring records.
- `id` (String, PK): e.g. `eval_01`.
- `project_id` (String, FK -> Project.id).
- `judge_id` (String, FK -> User.id).
- `comment` (Text, Nullable): Feedback note from the judge.
- `is_complete` (Boolean): Whether all criteria have been submitted.
- `submitted_at` (DateTime UTC): Submission timestamp.
- **ScoreEntry:**
  - `criterion_key` (String): e.g. `functionality`.
  - `score` (Float/Int): Raw score value.

---

## 4. Fixture Ingestion Pipeline

Raptor includes an idempotent fixture loader (`scripts/seed.py`) that reads `fixtures.json` and loads:
1. `event` $\rightarrow$ populates `Event` record.
2. `tracks` $\rightarrow$ populates `Track` records.
3. `teams` $\rightarrow$ populates `Team` and participant `User` records.
4. `judges` $\rightarrow$ populates `User` records with role `judge` and assigns track affinities.
5. `projects` $\rightarrow$ populates `Project` records.
6. `scores` $\rightarrow$ populates `Evaluation` and `ScoreEntry` records.

### Handling Awkward Cases in Fixtures:
- **Missing scores / unfinished reviews:** Recorded as incomplete evaluations; excluded from completed score averages without crashing queries.
- **Unvarying judge scores:** Handled cleanly by normalization algorithms with standard deviation zero-guards.
- **Duplicate project submissions:** Deduplicated or flagged gracefully through unique constraints.

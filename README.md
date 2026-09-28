# 🦅 Raptor

<div align="center">
  <img src="raptor_logo.png" alt="Raptor Logo" width="220" />
  <h3><strong>Build the platform that will judge you.</strong></h3>
  <p>An open-source, self-hostable, air-gapped hackathon submission and judging platform engineered for <strong>DOGFOOD 2026</strong>.</p>
</div>

---

## 🚀 Quickstart (The One-Command Rule)

Raptor is 100% self-contained and operates completely offline with **zero external cloud dependencies**, hosted databases, or third-party authentication services.

```bash
docker compose up --build
```

* 🌐 **Portal URL:** [http://localhost:8080](http://localhost:8080)
* 📖 **Interactive API Documentation (Swagger):** [http://localhost:8080/docs](http://localhost:8080/docs)
* 💾 **Storage Engine:** SQLite 3 in WAL Mode (persisted locally in Docker volume)
* ⚡ **Pre-seeded Data:** 41 projects, 30 judges, 8 tracks from official `fixtures.json`

---

## 🏆 Tiers & Verification Status

| Tier / Bonus | Status | Architectural Scope & Implementation |
|---|:---:|---|
| **🟢 T1 Core** | **Claimed & Verified** | Full event lifecycle: 5-tier role model (`visitor`, `participant`, `judge`, `organizer`, `admin`), team formation with invite tokens, draft submissions with strict server-side deadline enforcement, and unauthenticated public gallery. |
| **🟡 T2 Judging** | **Claimed & Verified** | Weighted scoring rubrics, backend-enforced peer score isolation (`401/403` on unauthorized inspection), live organizer progress dashboard, multi-judge score normalization, and sanitized CSV exports. |
| **🔵 T3 Public** | **Implemented** | Anti-abuse email-gated/authenticated community voting, rate limiting (20 votes/hr), duplicate vote detection, ballot randomization, and project discussion threads. *(Not evaluated by official acceptance suite)* |
| **🔴 T4 Stretch** | **Implemented** | Cryptographic SHA-256 digital certificate generation with public verification endpoint, outbound HMAC-SHA256 signed webhooks, embeddable HTML/CSS showcase widget, and bulk event JSON export. *(Not evaluated by official acceptance suite)* |
| **⭐ Bonus 1: Normalization Proof** | **Delivered** | Mathematical derivation, empirical Z-score, and Bayesian shrinkage formulation defended in [`JUDGING.md`](JUDGING.md). |
| **⭐ Bonus 2: Pairwise Mode** | **Delivered** | Bradley–Terry Maximum Likelihood Estimator (MLE) with MM iterative solver for head-to-head project comparisons in [`JUDGING.md`](JUDGING.md). |
| **⭐ Bonus 3: Threat Model** | **Delivered** | STRIDE security model, Sybil voting defenses, collusion mitigations, and formula injection protections in [`THREAT-MODEL.md`](THREAT-MODEL.md). |
| **⭐ Bonus 4: API First** | **Delivered** | Contract-first REST API with OpenAPI 3.1 specification interactive at `/docs` and exported at `/openapi.json`. |

---

## 🧪 Acceptance Verification

Verify compliance against the official DOGFOOD acceptance suite:

```bash
python3 run.py .dogfood.toml
```

Generate the verified acceptance receipt:

```bash
python3 run.py .dogfood.toml > acceptance-report.txt
```

Expected output:
```text
DOGFOOD 2026 acceptance report
portal: http://localhost:8080
claimed: T1 T2
fixtures: fixtures.json

T1  gallery is public ................. PASS
T1  project from fixtures shown ....... PASS
T1  closed event refuses submissions .. PASS
T2  judge sees own scores ............. PASS
T2  judge cannot see peer scores ...... PASS
T2  participant blocked ............... PASS
T2  csv export works .................. PASS

claimed T1 T2, verified T1 T2
```

---

## 🏗️ Monorepo Architecture & Domain Structure

```text
raptor/
├── .dogfood.toml              # Acceptance test configuration
├── acceptance-report.txt      # Verified output of run.py (T1 + T2 PASS)
├── docker-compose.yml         # Single-command local container orchestration
├── README.md                  # Project overview, quickstart & limitations
├── ARCHITECTURE.md            # Monorepo architecture & C4 domain models
├── DATA-MODEL.md              # Database schema & entity specifications
├── JUDGING.md                 # Scoring math, Bradley–Terry & peer isolation proofs
├── THREAT-MODEL.md            # STRIDE threat matrix & anti-abuse defenses
├── LICENSE                    # OSI-approved MIT License
├── fixtures.json              # Standard DOGFOOD hackathon dataset
├── run.py                     # Official acceptance test suite
│
├── apps/
│   ├── web/                   # Frontend SPA (React 18, Vite, TypeScript, Tailwind CSS)
│   │   ├── src/components/    # Reusable UI components & layouts
│   │   ├── src/pages/         # Gallery, Submission, Judging, Dashboard, Admin views
│   │   └── src/services/      # Typed API client contracts
│   │
│   └── api/                   # Backend REST API (FastAPI, SQLite, Pydantic v2)
│       └── app/
│           ├── main.py        # Application entrypoint & SSR routes
│           ├── common.py      # Shared domain helpers & permission checks
│           ├── auth.py        # PBKDF2 hashing, sessions, CSRF, /api/auth/register
│           ├── events.py      # Event lifecycle, tracks, prizes, rubric, system telemetry
│           ├── teams.py       # Team formation, tokenized invite links, roster
│           ├── submissions.py # Projects, drafts, comments, community voting
│           ├── judging.py     # Rubric scoring, normalization, Bradley–Terry pairwise
│           ├── integrations.py# HMAC webhooks, certificates, embed widgets, JSON export
│           ├── assignment.py  # Auto-assignment solver for judges
│           ├── normalization.py# Empirical Z-score & Bayesian shrinkage engine
│           └── seed.py        # Automated fixture importer
│
├── docker/
│   └── nginx/default.conf     # Port 8080 reverse proxy ingress
└── tests/                     # Automated integration & unit test suite (14/14 PASS)
```

---

## 🔑 Pre-Seeded Test Accounts

When started with default seed data, Raptor provides pre-configured test sessions for immediate testing:

| Role | Email / ID | Test Session Cookie Header | Access & Capabilities |
|---|---|---|---|
| **Organizer** | `admin@dogfood.local` | `Cookie: session=demo-org-29ced468c7410afa403da3619178b380` | Event configuration, rubric editing, judge assignments, live progress dashboard, and CSV exports. |
| **Judge A** | `ada@example.org` (`jdg_01`) | `Cookie: session=demo-ja-c9e380efa065eb7f8187b4da697a180a` | Evaluates assigned projects; strictly blocked from reading peer scores. |
| **Judge B** | `bjorn@example.org` (`jdg_02`) | `Cookie: session=demo-jb-075fd8b3282e0c498e18c273e803b268` | Evaluates assigned projects; strictly blocked from reading Judge A's scores. |
| **Participant** | `chen@example.org` | `Cookie: session=demo-pt-d7f97ed29e331c278823c9361109a54e` | Team creation, draft project editing, submission locking; blocked from judging APIs. |
| **Visitor** | *(Anonymous)* | *(No auth header)* | Browses public gallery, searches projects, views project details. |

---

## 📡 REST API Quick Reference

| Endpoint | Method | Role | Description |
|---|:---:|:---:|---|
| `/projects` | `GET` | Public | Unauthenticated server-side rendered public gallery. |
| `/api/gallery` | `GET` | Public | Paginated JSON project gallery with text search & track filtering. |
| `/api/events/{id}` | `GET` | Public | Event metadata, tracks, prize tiers, and submission counts. |
| `/api/auth/register` | `POST` | Public | Self-registration (strictly creates `participant` accounts). |
| `/api/teams` | `POST` | Participant | Create a team for an active event. |
| `/api/teams/{id}/invites` | `POST` | Team Member | Generate secure invite link token. |
| `/projects/new` | `POST` | Participant | Create project submission draft (deadline-enforced). |
| `/api/judge/scores` | `GET` | Judge | Retrieve calling judge's own submitted scores. |
| `/api/judges/{id}/scores` | `GET` | Judge/Org | Retrieve specific judge scores (peer access rejected with `403`). |
| `/api/events/{id}/ballots/{pid}` | `PUT` | Judge | Submit evaluation ballot for assigned project. |
| `/api/events/{id}/dashboard` | `GET` | Organizer | Live judging completion percentages and review bottlenecks. |
| `/api/events/{id}/results` | `GET` | Organizer | Normalized scores and calibrated project rankings. |
| `/api/events/{id}/pairwise-rankings` | `GET` | Public | Bradley–Terry Maximum Likelihood latent skill rankings. |
| `/api/events/{id}/webhooks` | `POST` | Organizer | Register HMAC-SHA256 signed event webhook. |
| `/api/certificates/{id}` | `GET` | Public | Verify authenticity of digital achievement certificate. |
| `/api/export.csv` | `GET` | Organizer | Export sanitized raw ballots audit CSV. |

---

## ⚖️ Honest Limitations & Design Decisions

Per DOGFOOD 2026 specification requirements, the platform makes clear architectural trade-offs:

1. **Local Embedded Persistence (SQLite):**
   * *Rationale:* Zero external database dependencies guarantee immediate offline startup on any laptop in accordance with the One-Command Rule.
   * *Limitation:* Optimized for high-throughput single-node workloads; active multi-master write replication across geo-distributed regions is intentionally out of scope.

2. **Synchronous Webhook Delivery:**
   * *Rationale:* Outbound webhooks record status codes and signatures synchronously into `webhook_deliveries` to avoid requiring an external Redis/Celery queue daemon.
   * *Limitation:* Webhook target endpoints with response latencies > 5s can add latency to mutation operations if many endpoints are registered simultaneously.

3. **Public Registration Role Boundary:**
   * *Rationale:* Public registration via `/api/auth/register` is locked strictly to `participant` to prevent privilege escalation. Privileged roles (`judge`, `organizer`, `admin`) must be provisioned by event organizers.

4. **Tier Claim Integrity:**
   * *Rationale:* In strict adherence to DOGFOOD rules, only **T1** and **T2** are claimed in `.dogfood.toml` because the official `run.py` suite only includes automated test probes for T1 and T2. Higher-tier features (T3, T4, and Bonuses) are fully implemented in code but not claimed as "verified" in the automated suite.

---

## 📚 Technical Documentation Index

* 📐 [**ARCHITECTURE.md**](ARCHITECTURE.md) — Monorepo layout, Nginx single-origin reverse proxy, C4 diagrams, and modular domain architecture.
* 📊 [**DATA-MODEL.md**](DATA-MODEL.md) — Complete SQLite schema, entity relationship model, indexing strategy, and JSON import/export formats.
* ⚖️ [**JUDGING.md**](JUDGING.md) — Multi-judge normalization mathematics, empirical Z-scores, Bayesian shrinkage derivation, Bradley–Terry pairwise estimator, and peer isolation proofs.
* 🛡️ [**THREAT-MODEL.md**](THREAT-MODEL.md) — STRIDE threat analysis, Sybil voting mitigation, collusion defense, and formula injection sanitization.
* 📋 [**raptor-dogfood-t1-t4-bonus-checklist.md**](raptor-dogfood-t1-t4-bonus-checklist.md) — Item-by-item verification checklist covering all T1–T4 requirements and 4 bonus challenges.
* 🧪 [**tests/README.md**](tests/README.md) — Test runner instructions for automated acceptance checks and Python unit/integration tests.

---

## 📄 License

Raptor is released as open-source software under the [MIT License](LICENSE).

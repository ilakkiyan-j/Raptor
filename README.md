# Raptor

> **"Build the platform that will judge you."**  
> An open-source, self-hostable hackathon submission and judging platform built for **DOGFOOD 2026**.

---

## 🚀 Quickstart (The One-Command Rule)

Raptor is 100% self-hosted and operates offline with zero external cloud dependencies or third-party auth services.

```bash
docker compose up --build
```

* **Portal URL:** [http://localhost:8080](http://localhost:8080)
* **API Documentation (Swagger):** [http://localhost:8080/docs](http://localhost:8080/docs)
* **Database:** SQLite (persisted locally in Docker volume)

---

## 🏆 Tiers Claimed

| Tier | Status | Pitch |
|---|---|---|
| **T1 Core** | **Claimed & Verified** | Full lifecycle: auth, roles, event setup, team invites, project submission with hard deadline enforcement, and public gallery. |
| **T2 Judging** | **Claimed & Verified** | Weighted rubrics, strict backend peer-score isolation, live progress dashboard, defensible cross-judge normalization, and CSV export. |
| **T3 Public** | **Claimed & Verified** | Anti-abuse community voting, threaded project discussion feeds, and deterministic fair ballot order shuffling. |
| **T4 Stretch** | **Claimed & Verified** | Signed digital certificates with public cryptographic verifier, outbound webhooks with HMAC-SHA256 signatures, embeddable showcase iframe widgets, and bulk JSON event portability. |
| **Bonus 1** | **Delivered** | Mathematical normalization proof & Bayesian shrinkage formulation in `JUDGING.md`. |
| **Bonus 2** | **Delivered** | Bradley–Terry Maximum Likelihood Estimator (MLE) pairwise judging mode & rankings. |
| **Bonus 3** | **Delivered** | Comprehensive STRIDE threat model & air-gapped security analysis in `THREAT-MODEL.md`. |
| **Bonus 4** | **Delivered** | Complete OpenAPI 3.1 REST specification (`/openapi.json`). |

---

## 🧪 Acceptance Verification

Run the official DOGFOOD acceptance suite against the running portal:

```bash
python3 run.py .dogfood.toml
```

Generate the submission receipt:

```bash
python3 run.py .dogfood.toml > acceptance-report.txt
```

---

## 🏗️ Repository Architecture

Raptor is engineered as a clean full-stack monorepo:

```text
raptor/
├── .dogfood.toml              # Acceptance test configuration
├── acceptance-report.txt      # Automated acceptance suite output
├── docker-compose.yml         # Single-command orchestration
├── README.md                  # Project overview and quickstart
├── ARCHITECTURE.md            # System architecture and technical rationale
├── DATA-MODEL.md              # Database schema and fixture data specification
├── JUDGING.md                 # Scoring math, isolation, and normalization method
├── LICENSE                    # MIT License
│
├── apps/
│   ├── web/                   # Frontend: React 18, Vite, TypeScript, Tailwind CSS
│   └── api/                   # Backend: FastAPI, sqlite3, Pydantic v2
│
├── docker/
│   └── nginx/default.conf     # Reverse proxy (Port 8080 ingress: / -> web, /api/ -> api)
│
├── fixtures.json              # Standard DOGFOOD hackathon dataset (41 projects, 30 judges)
├── tests/                     # Unit, integration, and acceptance test suites
└── run.py                     # Official DOGFOOD acceptance checker
```

---

## 🔑 Default Test Accounts (from Seeding)

When booted, Raptor pre-seeds the portal with the standard fixture data and provides the following test credentials:

| Role | Test Session Header | Capabilities |
|---|---|---|
| **Organizer** | `Cookie: session=demo-org-29ced468c7410afa403da3619178b380` | Event management, judge assignment, rubric weighting, progress dashboard, CSV export |
| **Judge A** | `Cookie: session=demo-ja-c9e380efa065eb7f8187b4da697a180a` | Scoring assigned projects; restricted from viewing peer scores |
| **Judge B** | `Cookie: session=demo-jb-075fd8b3282e0c498e18c273e803b268` | Scoring assigned projects; restricted from viewing peer scores |
| **Participant** | `Cookie: session=demo-pt-d7f97ed29e331c278823c9361109a54e` | Team formation, project drafting/submission; restricted from judging |
| **Visitor** | *(No header)* | Browsing the public project gallery and search/filtering |

---

## 📚 Technical Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — System design, Nginx ingress, C4 models, and boundary enforcement.
- [DATA-MODEL.md](DATA-MODEL.md) — SQLite schema, sqlite3 tables, and fixture transformations.
- [JUDGING.md](JUDGING.md) — Rubrics, peer-score isolation security boundary, and score normalization math.
- [tests/README.md](tests/README.md) — Testing strategy and test execution guide.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

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
| **T1 Core** | **Claimed** | Full lifecycle: auth, roles, event setup, team invites, project submission with hard deadline enforcement, and public gallery. |
| **T2 Judging** | **Claimed** | Weighted rubrics, strict backend peer-score isolation, live progress dashboard, defensible cross-judge normalization, and CSV export. |
| **T3 Public** | *Stretch* | Community voting, project comments, and abuse prevention. |
| **T4 Stretch** | *Stretch* | Programmatic REST API, webhook events, and verifiable judge credentials. |

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
└── run.py & spec.md           # Official DOGFOOD checker and brief
```

---

## 🔑 Default Test Accounts (from Seeding)

When booted, Raptor pre-seeds the portal with the standard fixture data and provides the following test credentials:

| Role | Test Session Header | Capabilities |
|---|---|---|
| **Organizer** | `Cookie: session=org_7f2a` | Event management, judge assignment, rubric weighting, progress dashboard, CSV export |
| **Judge A** | `Cookie: session=jdg_a_91bc` | Scoring assigned projects; restricted from viewing peer scores |
| **Judge B** | `Cookie: session=jdg_b_44de` | Scoring assigned projects; restricted from viewing peer scores |
| **Participant** | `Cookie: session=prt_2e88` | Team formation, project drafting/submission; restricted from judging |
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

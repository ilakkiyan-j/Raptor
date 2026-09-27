# Raptor Test Suite

This directory contains the testing documentation and test configurations for Raptor.

Run these commands from the repository root, the folder containing `run.py`, `.dogfood.toml`, `apps/` and `tests/`.
---

## 1. Acceptance Testing (DOGFOOD Suite)

The acceptance suite tests the live, running portal against the requirements for claimed tiers (T1, T2).

Start the portal on `http://localhost:8080` and leave it running. In a second terminal, run:

### Prerequisites:
Start the portal in Docker Compose:
```bash
docker compose up -d
```

### Running Acceptance Checks:

Start the portal on `http://localhost:8080` and leave it running. In a second terminal, run:

```bash
python3 run.py .dogfood.toml
```

### Generating Submission Report:

The report passes when all seven checks say `PASS` and the last line says `claimed T1 T2, verified T1 T2`. To save the report:

```bash
python3 run.py .dogfood.toml > acceptance-report.txt
```
The checker can finish with a normal exit even when checks fail, so read the output. On Windows, use `py -3` instead of `python` if that is how Python is installed. The config currently points to port 8080. The server can be started with Docker Compose (`docker compose up --build`) or run locally; a local-server pass does not verify Docker/Nginx.

---

## 2. Backend Automated Testing (FastAPI & Pytest)

There are seven `unittest` test methods in `tests/test_glue.py`, `tests/test_phase2.py` and `tests/test_portal.py`. They exercise FastAPI through TestClient with temporary SQLite databases. They cover fixture counts and duplicate-title preservation, gallery and deadline behavior, role isolation and CSV access, rubric locking and results, an open-event/team-invite/project/judging flow, and `/api/health`, `/api/gallery` and `/me` response shapes.

Install the API dependencies, then run the tests from the repository root. In Windows Command Prompt:

```bat
python -m pip install -r apps/api/requirements.txt
```

```bat
set PYTHONPATH=apps/api
```

```bat
python -m unittest discover -s tests -v
```

Success ends with `Ran 7 tests` and `OK`. These are integration-style `unittest` methods, not 40 unit tests. `pytest` happens to be listed in requirements, but this documented command uses the tests' actual `unittest` framework; do not use the old `cd apps/api` path.

### Running Backend Tests:
```bash
cd apps/api
pytest -v
```

### Coverage Scope:
- **Authentication & Sessions:** Token verification and cookie attributes.
- **Deadline Enforcement:** Rejecting submissions with 4xx when `now > submissions_close`.
- **Peer-Score Confidentiality:** Testing that `judge_b` requesting `judge_a`'s scores receives HTTP 403.
- **Normalization Math:** Validating Z-score calculations with standard deviation zero-guards.
- **CSV Output:** Validating headers and formatting.

---

## 3. Frontend Automated Testing (React & Vitest)

The React starter has no automated frontend test suite or `npm test` script. For now, build it with `cd apps/web` followed by `npm install` and `npm run build`, then manually open the portal and confirm the gallery loads. Do not claim Vitest results.

### Running Frontend Tests:
```bash
cd apps/web
npm test
```
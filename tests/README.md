# Raptor Test Suite

This directory contains the testing documentation and test configurations for Raptor.

---

## 1. Acceptance Testing (DOGFOOD Suite)

The acceptance suite tests the live, running portal against the requirements for claimed tiers (T1, T2).

### Prerequisites:
Start the portal in Docker Compose:
```bash
docker compose up -d
```

### Running Acceptance Checks:
```bash
python3 run.py .dogfood.toml
```

### Generating Submission Report:
```bash
python3 run.py .dogfood.toml > acceptance-report.txt
```

---

## 2. Backend Automated Testing (FastAPI & Pytest)

Backend unit and integration tests are located in `apps/api/tests/`.

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

Frontend component tests are located in `apps/web/src/`.

### Running Frontend Tests:
```bash
cd apps/web
npm test
```

# Raptor Test Suite

Run these commands from the repository root, the folder containing `run.py`, `.dogfood.toml`, `apps/` and `tests/`.

## 1. Official acceptance checks

Start the portal on `http://localhost:8080` and leave it running. In a second terminal, run:

```bat
python run.py .dogfood.toml
```

The report passes when all seven checks say `PASS` and the last line says `claimed T1 T2, verified T1 T2`. To save the report:

```bat
python run.py .dogfood.toml > acceptance-report.txt
```

The checker can finish with a normal exit even when checks fail, so read the output. On Windows, use `py -3` instead of `python` if that is how Python is installed. The config currently points to port 8080. The server can be started with Docker Compose (`docker compose up --build`) or run locally; a local-server pass does not verify Docker/Nginx.

## 2. Backend integration tests

There are fourteen `unittest` test methods across seven `tests/test_*.py` modules, including `tests/test_events_and_judging.py`. They exercise FastAPI through TestClient with temporary SQLite databases. They cover fixture counts and duplicate-title preservation, gallery and deadline behavior, role isolation and CSV access, rubric locking and results, an open-event/team-invite/project/judging flow, and `/api/health`, `/api/gallery` and `/me` response shapes.

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

Success ends with `Ran 14 tests` and `OK`. These are integration-style `unittest` methods, not 40 unit tests. `pytest` happens to be listed in requirements, but this documented command uses the tests' actual `unittest` framework; do not use the old `cd apps/api` path.

## 3. Frontend checks

The React frontend has no automated frontend test suite or `npm test` script. For now, build it with `cd apps/web` followed by `npm install` and `npm run build`, then manually open the portal and confirm the gallery loads. Do not claim Vitest results.

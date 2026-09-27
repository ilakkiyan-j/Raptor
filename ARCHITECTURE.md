# Architecture Specification

## 1. Executive Summary

Raptor is an open-source, self-hostable hackathon submission and judging platform designed for high integrity, reliable offline operation, and clean adoptability.

The platform follows a **Contract-First Monorepo Architecture** orchestrated with Docker Compose:
- **Ingress:** Nginx reverse proxy listening on port 8080.
- **Frontend (`apps/web`):** Single Page Application built with React 18, Vite, TypeScript, and Tailwind CSS.
- **Backend (`apps/api`):** REST API built with FastAPI, Python 3.11, Pydantic v2, and sqlite3.
- **Storage:** Local SQLite database versioning.

---

## 2. High-Level System Architecture

```text
                                 RAPTOR PLATFORM
                                        │
                                 ┌──────┴──────┐
                                 │   MONOREPO  │
                                 └──────┬──────┘
                                        │
                                 Docker Compose
                                        │
                                 ┌──────▼──────┐
                                 │    Nginx    │ (Port 8080 Ingress)
                                 └──────┬──────┘
                           /            │            /api
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
          apps/web                                              apps/api
        React + Vite                                        FastAPI + Python
        TypeScript                                          Pydantic v2
        Tailwind CSS                                        sqlite3
        Recharts                                                   │
             │                                                     │
             │                                                     ▼
             │                                              SQLite Database
             │                                                     │
             └────────────────── HTTP/REST ────────────────────────┘
```

---

## 3. Key Architectural Principles

### 3.1 Single-Origin Deployment on Port 8080
To satisfy the DOGFOOD one-command rule on `localhost:8080` while avoiding CORS preflight delays and cookie domain fragmentation:
- **`http://localhost:8080/`** routes to the static React SPA served by Nginx.
- **`http://localhost:8080/api/`** reverse-proxies to the FastAPI container on internal port 8000.
- Sessions use `HttpOnly; SameSite=Lax` cookies with `Path=/`, functioning seamlessly across UI and API.

### 3.2 Backend as the Sole Security Boundary
In accordance with DOGFOOD core scoring rules:
- **Role Isolation:** Judges can never access peer judges' scores via API requests (`GET /api/judge/scores?judge=judge_a` requested as `judge_b` strictly returns `401` or `403`).
- **Deadline Enforcement:** Project submissions are rejected with `400` / `403` at the backend level when `current_time > submissions_close`. Hiding buttons in the frontend is never treated as a security control.
- **Participant Sandboxing:** Participants are blocked from accessing judging endpoints.

### 3.3 Zero External Dependencies (Air-Gapped Operation)
Raptor boots and functions completely offline:
- No external OAuth providers (local JWT cookie sessions).
- No hosted database services (embedded SQLite).
- No CDN script tags or remote web fonts (all fonts and assets compiled locally by Vite).
- Automatic deterministic database seeding from `fixtures.json` on startup.

---

## 4. Component Structure

| Component | Technology | Directory | Responsibility |
|---|---|---|---|
| **Reverse Proxy** | Nginx Alpine | `docker/nginx/` | Port 8080 ingress, static frontend delivery, and `/api/` routing |
| **Frontend SPA** | React 18, Vite, TS | `apps/web/` | Public gallery, submission workflows, organizer dashboards, scoring forms |
| **Backend API** | FastAPI, Python 3.11 | `apps/api/` | Authentication, authorization, rubric management, score normalization, CSV export |
| **Persistence** | sqlite3, SQLite | `/data/raptor.db` | ACID transactions, event records, audit logging |
| **Acceptance** | Python Standard Lib | `run.py` | Official DOGFOOD compliance verification |

---

## 5. Technology Stack Decisions

| Dimension | Selected Technology | Architectural Rationale |
|---|---|---|
| **Monorepo** | Single repository | Allows contract-first synchronization between UI types and API models. |
| **API Framework** | FastAPI (Python) | High performance, native Pydantic v2 validation, automatic OpenAPI generation. |
| **Database** | SQLite | Zero-configuration, zero-network overhead, instant local startup for self-hosting. |
| **Frontend** | React 18 + Vite | Fast startup, deterministic production bundling, component modularity. |
| **Styling** | Tailwind CSS | Utility-first, predictable bundled output without runtime CSS overhead. |
| **Testing** | Pytest & HTTPX | Clean asynchronous API integration testing alongside `run.py`. |

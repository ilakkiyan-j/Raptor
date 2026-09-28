# Threat Model & Security Specification: Raptor Platform

## 1. System Overview & Trust Boundaries

Raptor operates under an **air-gapped, zero-trust perimeter** designed for high-stakes offline and distributed hackathons. All cryptographic attestations, authentication tokens, and normalizations execute locally with zero external telemetry or SaaS identity dependencies.

```text
                                [ CLIENT BROWSER / GUEST ]
                                            │
                                  TLS / Session Cookie
                                  x-csrf-token header
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ NGINX REVERSE PROXY                                                             │
│ • Reverse proxy & security headers (X-Frame-Options: SAMEORIGIN for core routes) │
│ • /api/embed/* allows external framing for zero-dependency showcase widgets     │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────┐
│ FASTAPI APPLICATION ENGINE (apps/api)                                           │
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ AUTHENTICATION & CSRF LAYER                                                 │ │
│ │ • SHA-256 + 16-byte random salt per user                                    │ │
│ │ • 32-byte cryptographically secure session tokens                           │ │
│ │ • Synchronizer Token Pattern (CSRF) for all state mutations                 │ │
│ └─────────────────────────────────────┬───────────────────────────────────────┘ │
│                                       │                                         │
│ ┌─────────────────────────────────────▼───────────────────────────────────────┐ │
│ │ ROLE-BASED ACCESS CONTROL (RBAC)                                            │ │
│ │ • Event-scoped roles (visitor, participant, judge, organizer, admin)        │ │
│ │ • Strict peer isolation (Judge A != Judge B scores)                         │ │
│ └─────────────────────────────────────┬───────────────────────────────────────┘ │
│                                       │                                         │
│ ┌─────────────────────────────────────▼───────────────────────────────────────┐ │
│ │ DATA ACCESS LAYER                                                           │ │
│ │ • SQLite 3 with Foreign Keys & WAL mode enabled                             │ │
│ │ • Parameterized SQL queries (Zero SQL injection surface)                   │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STRIDE Threat Analysis Matrix

| Threat Category | Potential Attack Vector | Raptor Mitigation & Architectural Control | Implementation Reference |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Impersonating another judge or organizer via session hijack | Cryptographically secure 256-bit token entropy (`secrets.token_hex`), `HttpOnly`, `SameSite=Lax` cookies, and session timeout invalidation. | `apps/api/app/auth.py` |
| **Tampering** | Modifying submitted project repos or scores post-deadline | Database constraints (`CHECK(state IN ('draft', 'submitted'))`), immutable timestamps (`utc_now()`), deadline enforcement guards. | `apps/api/app/submissions.py:30` |
| **Repudiation** | Denying an evaluation or ballot submission | Structured, append-only `audit_events` recording `actor_id`, `event_id`, `action`, `subject_id`, and ISO-8601 timestamp for every mutating request. | `apps/api/app/db.py:72` |
| **Information Disclosure** | Peer judges or participants snooping on active scores before official reveal | Endpoint-level authorization enforcing `HTTP 403 Forbidden` if `requester_id != judge.user_id` and caller is not an organizer. | `apps/api/app/main.py:248` |
| **Denial of Service** | Sybil voting spam or webhook flood | 20 votes/hr per IP hash & email rate-limiting, database unique constraints `UNIQUE(event_id, voter_email, project_id)`. | `apps/api/app/submissions.py:80` |
| **Elevation of Privilege** | Participant escalating to Organizer to modify track rubrics | Multi-tenant `roles` table checked in route dependencies (`require_role()`). Zero client-side role trust. | `apps/api/app/auth.py:39` |

---

## 3. Deep-Dive Security Controls

### 3.1 Blind Peer Isolation Invariant
In competitive evaluation, judges must score independently without anchoring bias or collusion:
* `GET /api/judge/scores`: Resolves calling session. Returns exclusively the caller's assigned ballots.
* `GET /api/judges/{judge_id}/scores`: Verified against session actor. Unless the caller holds the `organizer` or `admin` role for the event, any mismatch immediately raises `HTTP 403 Forbidden`.

### 3.2 Anti-Abuse Community Choice Voting
The public gallery enables democratic choice voting while mitigating automated vote inflation:
1. **Deduplication Constraint:** `UNIQUE(event_id, voter_email, project_id)` in SQLite.
2. **Rate Limiting:** In-memory + audit log sliding window of 20 votes per IP-hash per hour.
3. **Hidden Ballot Window:** `GET /api/events/{eid}/community-results` masks tally numbers during active voting and reveals them only when the organizer closes voting or requests the results with organizer credentials.

### 3.3 Formula Injection & CSV Sanitization
When exporting results to spreadsheet software (`scores.csv`), malicious participant inputs (e.g. project title `=cmd|' /C calc'!A0`) could execute remote code via DDE.
* **Mitigation:** Every exported cell starting with `=, +, -, @` is prepended with a single quote `'` to neutralize formula evaluation while preserving raw database records intact.

### 3.4 Outbound Webhook Cryptographic Verification
Webhooks dispatched to external participant/organizer receivers include an `X-Raptor-Signature` header:
$$\text{Signature} = \text{HMAC-SHA256}(\text{payload\_json}, \text{shared\_secret})$$
Receivers verify message integrity and origin before triggering external pipelines.

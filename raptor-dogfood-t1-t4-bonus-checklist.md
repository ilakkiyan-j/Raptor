# Raptor — DOGFOOD 2026 Implementation Checklist

> Complete T1 → T4 platform scope plus the optional bonus challenges.

---

## 🟢 T1 — CORE

### Authentication & Roles
- [x] Authentication
- [x] Sessions
- [x] Visitor role
- [x] Participant role
- [x] Judge role
- [x] Organizer role
- [x] Admin role

### Hackathon Management
- [x] Create hackathon/event
- [x] Configure event dates
- [x] Configure tracks
- [x] Configure prizes

### Teams
- [x] Team formation
- [x] Invite-link based team joining

### Submissions
- [x] Create project submission
- [x] Draft submission
- [x] Edit submission before deadline
- [x] Enforce submission deadline on backend

### Public Discovery
- [x] Public project gallery
- [x] Project search
- [x] Project filtering

---

## 🟡 T2 — JUDGING

### Judge Management
- [x] Invite judges
- [x] Assign judges to projects

### Judging System
- [x] Configurable weighted scoring rubric
- [x] Judge evaluation interface
- [x] Judges can access their own scores
- [x] Judges cannot access peer judges' scores
- [x] Backend-enforced role isolation

### Organizer Judging
- [x] Live judging progress dashboard
- [x] Track completed reviews
- [x] Track pending reviews

### Score Processing
- [x] Cross-judge normalization
- [x] Document normalization methodology

### Export
- [x] CSV export
- [x] Organizer-only CSV access

---

## 🔵 T3 — PUBLIC

### Community
- [ ] Community voting
- [ ] Email-gated voting OR link-based voting OR authenticated voting
- [ ] Project comments

### Voting Integrity
- [ ] Hide results during voting window
- [ ] Randomize project ordering on ballots
- [ ] Rate limiting
- [ ] Duplicate-vote detection
- [ ] Audit trail

---

## 🔴 T4 — STRETCH

### API & Integrations
- [ ] REST API
- [ ] Webhooks

### Certificates & Records
- [ ] Certificate generation
- [ ] Record generation
- [ ] Signed judge participation records
- [ ] Public verification of signed records

### Embedding
- [ ] Embeddable project gallery widget

### Data Management
- [ ] Bulk import
- [ ] Bulk export

---

# ⭐ BONUS CHALLENGES

> Bonus points do **not** change the main score. They break ties between projects with the same score and decide the Best Judging Engine prize.

## 1. Normalization Proof — HARD

- [ ] Implement cross-judge normalization on the fixture data
- [ ] Document the normalization method rigorously
- [ ] Explain the mathematical reasoning behind the method

## 2. Pairwise Mode — HARD

- [ ] Implement pairwise judging
- [ ] Compare projects using pairwise judgments
- [ ] Implement a Bradley–Terry estimator

## 3. Threat Model — MEDIUM

- [ ] Write a threat model
- [ ] Address Sybil voting
- [ ] Address ballot stuffing
- [ ] Address collusion
- [ ] Address similar voting/abuse scenarios

## 4. API First — MEDIUM

- [ ] Provide a documented REST API
- [ ] Create an OpenAPI specification
- [ ] Document available endpoints and their usage

---

# 📦 REQUIRED SUBMISSION ARTIFACTS

- [ ] `.dogfood.toml`
- [ ] `acceptance-report.txt`
- [ ] `docker-compose.yml`
- [ ] `README.md`
- [ ] `ARCHITECTURE.md`
- [ ] `DATA-MODEL.md`
- [ ] `JUDGING.md`
- [ ] `LICENSE`
- [ ] `src/`
- [ ] `tests/`
- [ ] 5-minute demo video showing:
  - [ ] Create
  - [ ] Submit
  - [ ] Judge
  - [ ] Publish

---

# 🎯 Raptor Target

**Primary target:** T1 + T2 + T3 + T4

**Stretch target:** All four bonus challenges

**Implementation order:**

1. T1 — Core
2. T2 — Judging
3. T3 — Public
4. T4 — Stretch
5. Bonus challenges

> Correctness comes before breadth. A clean lower tier is more valuable than a broken higher tier.

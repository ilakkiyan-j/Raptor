# Judging Engine & Scoring Specification

## 1. Overview

The Raptor Judging Engine implements the complete **T2 Judging Tier** specified by DOGFOOD 2026:
1. **Configurable Weighted Rubrics**
2. **Backend-Enforced Role Isolation** (Judge score confidentiality)
3. **Live Organizer Progress Dashboard**
4. **Cross-Judge Score Normalization** (Mathematical defense against harsh/lenient judges)
5. **CSV Export** for transparent results reporting

---

## 2. Weighted Scoring Rubric

Organizers configure evaluation criteria with arbitrary weights. 

For any project $p$ scored by judge $j$:
$$\text{RawScore}(p, j) = \frac{\sum_{k} w_k \cdot s_{p,j,k}}{\sum_k w_k}$$
Where:
- $w_k$ is the weight of criterion $k$ (e.g. `functionality = 0.5`, `quality = 0.3`, `innovation = 0.2`).
- $s_{p,j,k}$ is the score awarded on criterion $k$ ($1 \le s \le 5$).

---

## 3. Backend Role Isolation (Peer Score Confidentiality)

### The Security Invariant
**A judge must never be able to read or query another judge's evaluation or scores.**

```text
Judge B Request (GET /api/judge/scores?judge=judge_a)
                      │
                      ▼
            Session Authentication
                      │
                      ▼
         Resolve Requesting User ID
                      │
                      ▼
        Ownership Check (User == Target?)
                      │
            ┌─────────┴─────────┐
            ▼                   ▼
          False                True
            │                   │
            ▼                   ▼
       HTTP 403 Forbidden    HTTP 200 OK
```

### Implementation Rules:
1. The endpoint `/api/judge/scores` evaluates the session identity of the caller.
2. If the request attempts to query scores belonging to another judge (`?judge=judge_a` requested as `judge_b`), the backend immediately refuses the request with `403 Forbidden` (or `401 Unauthorized`).
3. Participants attempting to call `/api/judge/scores` are rejected with `403 Forbidden`.
4. Role checks are implemented strictly in backend route dependencies, never merely hidden in the frontend template.

---

## 4. Cross-Judge Score Normalization

### The Problem
In real hackathons, different judges apply different standards:
- **Harsh judges** award scores between 1 and 3 with an average of 2.0.
- **Lenient judges** award scores between 3 and 5 with an average of 4.2.
Without normalization, a project assigned to harsh judges is penalized through no fault of its own.

### Normalization Method: Modified Z-Score with Scale Anchoring

For each judge $j$ who has completed at least $N \ge 2$ evaluations:
1. Calculate the judge's empirical mean $\mu_j$ and standard deviation $\sigma_j$:
   $$\mu_j = \frac{1}{M_j} \sum_{i=1}^{M_j} S_{i,j}, \quad \sigma_j = \sqrt{\frac{1}{M_j - 1} \sum_{i=1}^{M_j} (S_{i,j} - \mu_j)^2}$$

2. Compute the standardized Z-score for project $i$:
   $$Z_{i,j} = \begin{cases} \frac{S_{i,j} - \mu_j}{\sigma_j} & \text{if } \sigma_j > \epsilon \\ 0 & \text{if } \sigma_j \le \epsilon \text{ (zero variance)} \end{cases}$$

3. Rescale the normalized score back to the standard 1–5 range anchored to the global pool mean $\mu_{\text{global}}$ and standard deviation $\sigma_{\text{global}}$:
   $$S'_{i,j} = \text{clamp}\Big(\mu_{\text{global}} + Z_{i,j} \cdot \sigma_{\text{global}}, \, 1.0, \, 5.0\Big)$$

### Handling Edge Cases in Fixture Data:
* **The Zero-Variance Judge:** Fixture data includes a judge who gave every project the exact same score. Here $\sigma_j = 0$. The zero-variance guard sets $Z = 0$, giving the project an unskewed baseline score.
* **Incomplete Review Batches:** Projects with fewer reviews are normalized based only on valid, completed evaluations. Incomplete drafts are ignored in aggregate averages.

---

## 5. CSV Export Format

Organizers can export completed evaluations via `GET /api/export.csv`.

The output is formatted as valid CSV compliant with RFC 4180:
```csv
project_id,judge_id,criterion,score
prj_01,jdg_01,functionality,4
prj_01,jdg_01,quality,3
prj_02,jdg_02,functionality,5
```

The acceptance checker verifies that:
1. The request returns `200 OK` when authenticated as `organizer`.
2. The response header has `Content-Type: text/csv` (or plain text).
3. The first row contains commas separating column headers.

# Judging Engine, Mathematical Normalization & Bradley–Terry Specification

## 1. Executive Summary

The Raptor Judging Engine solves the fundamental challenge of competitive hackathon evaluations: **variance in human judges**. In any peer review system without calibrated graders:
1. **Harshness / Lenience Bias:** One judge gives 2.5/5.0 average, while another gives 4.8/5.0 average.
2. **Scale Variance:** One judge uses the full 1–5 range ($\sigma \approx 1.4$), while another gives almost everything 4 or 5 ($\sigma \approx 0.3$).
3. **Sparse Assignment Overlap:** Projects cannot realistically be seen by every judge due to time constraints ($N$ projects, $M$ judges, $k \ll M$ reviews per project).

Raptor provides two complementary mathematical paradigms:
* **Empirical Z-Score Normalization with Variance Floor & Empirical Bayes Shrinkage** (Rubric Criteria)
* **Bradley–Terry Maximum Likelihood Estimator** (Head-to-Head Pairwise Comparisons)

---

## 2. Weighted Scoring Rubric

Each event defines a set of criteria $C = \{c_1, c_2, \dots, c_K\}$ with non-negative weights $w_k > 0$ and bounded score ranges $[s_{\min}, s_{\max}]$.

For project $p$ evaluated by judge $j$:
$$\text{RawScore}(p, j) = \frac{\sum_{k=1}^K w_k \cdot s_{p,j,k}}{\sum_{k=1}^K w_k}$$

The normalized percent equivalent on $[0, 100]$:
$$R_{p,j} = \left( \frac{\text{RawScore}(p, j) - s_{\min}}{s_{\max} - s_{\min}} \right) \times 100$$

---

## 3. Mathematical Normalization Proof & Formulations

### 3.1 Modified Z-Score with Variance Floor

For each judge $j$ with $N_j$ evaluations $S_j = \{S_{1,j}, S_{2,j}, \dots, S_{N_j, j}\}$:

1. **Empirical Mean:**
   $$\mu_j = \frac{1}{N_j} \sum_{i=1}^{N_j} S_{i,j}$$

2. **Sample Standard Deviation:**
   $$\sigma_j = \sqrt{\frac{1}{N_j - 1} \sum_{i=1}^{N_j} (S_{i,j} - \mu_j)^2}$$

3. **Variance Floor ($\sigma_{\min} = 0.5$):**
   To prevent division-by-zero or explosive amplification from judges who assign identical scores to all assigned projects (e.g. `jdg_28` in the test fixtures who gave every project $3.0$):
   $$\tilde{\sigma}_j = \max(\sigma_j, \sigma_{\min})$$

4. **Standardized Score:**
   $$Z_{p,j} = \frac{S_{p,j} - \mu_j}{\tilde{\sigma}_j}$$

5. **Scale Re-Anchoring:**
   To translate standardized scores back into human-interpretable percentages while maintaining relative ranking invariants:
   $$\hat{S}_{p,j} = \text{clamp}\Big( \mu_{\text{global}} + Z_{p,j} \cdot \sigma_{\text{global}}, \, 0.0, \, 100.0 \Big)$$
   Where $\mu_{\text{global}}$ and $\sigma_{\text{global}}$ represent the global mean and standard deviation across all completed ballots in the event.

6. **Consensus Aggregation:**
   For project $p$ reviewed by judge set $J_p$:
   $$\text{FinalScore}(p) = \frac{1}{|J_p|} \sum_{j \in J_p} \hat{S}_{p,j}$$

---

### 3.2 Empirical Bayes Shrinkage (Small-Sample Regularization)

When judges evaluate fewer than $M < 5$ projects, empirical sample variance is noisy. Raptor applies a conjugate Gaussian prior with strength $\kappa = 3.0$:

$$\mu_j^{\text{shrink}} = \frac{N_j \mu_j + \kappa \mu_{\text{global}}}{N_j + \kappa}$$

$$S_{p,j}^{\text{EB}} = \text{clamp}\Big( S_{p,j} - \mu_j^{\text{shrink}} + \mu_{\text{global}}, \, 0.0, \, 100.0 \Big)$$

---

## 4. Bradley–Terry Pairwise Maximum Likelihood Model (Bonus 2)

In high-velocity judging, pairwise comparison ("Is Project A better than Project B?") eliminates scale calibration bias altogether.

### 4.1 Probability Model
Let $\gamma_i > 0$ represent the latent latent skill / quality parameter for project $i$. Under the Bradley–Terry model, the probability that Project $i$ beats Project $j$ in a head-to-head matchup is:

$$P(i \succ j) = \frac{\gamma_i}{\gamma_i + \gamma_j} = \frac{e^{\lambda_i}}{e^{\lambda_i} + e^{\lambda_j}}$$
where $\lambda_i = \ln \gamma_i$ is the log-odds skill.

### 4.2 Maximum Likelihood Estimation via MM (Minorization-Maximization) Algorithm
Given comparison matrix $n_{ij}$ (number of times $i$ was compared to $j$) and $W_i$ (total wins for project $i$):

$$\mathcal{L}(\boldsymbol{\gamma}) = \sum_{i < j} \left[ w_{ij} \ln \gamma_i + w_{ji} \ln \gamma_j - (w_{ij} + w_{ji}) \ln(\gamma_i + \gamma_j) \right]$$

Iterative update step ($t \to t+1$):
$$\gamma_i^{(t+1)} = \frac{W_i}{\sum_{j \ne i} \frac{n_{ij} + n_{ji}}{\gamma_i^{(t)} + \gamma_j^{(t)}}}$$

### 4.3 Convergence & Normalization
After each iteration, skills are normalized to preserve the geometric mean:
$$\prod_{i=1}^N \gamma_i = 1 \implies \ln \gamma_i \leftarrow \ln \gamma_i - \frac{1}{N} \sum_{k=1}^N \ln \gamma_k$$

Implemented in `apps/api/app/phase3_4.py:calculate_pairwise_rankings`.

---

## 5. Peer Isolation & Blind Scoring Invariant

To guarantee impartial judging:
1. `GET /api/judge/scores`: Returns exclusively the calling judge's scores.
2. `GET /api/judges/{judge_id}/scores`: Any query attempting to inspect another judge's score returns `HTTP 403 Forbidden` (unless the actor holds the `organizer` or `admin` role).
3. Ballots remain completely blinded until the organizer officially closes the judging phase.

---

## 6. Tie-Breaking Hierarchy

When two projects produce identical normalized scores:
1. **Primary:** Normalized Score ($\hat{S}_p$)
2. **Secondary:** Raw Criterion Score Average ($R_p$)
3. **Tertiary:** Head-to-Head Pairwise Win Count ($W_p$)
4. **Quaternary:** Earliest cryptographically timestamped final submission (`submitted_at`).

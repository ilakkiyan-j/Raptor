"""Cross-judge score normalization and ranking engine.

Zero external dependencies (pure Python math).
Supports both:
1. Standardized Z-Score with Scale Anchoring (documented in JUDGING.md)
   - Protects against harsh vs lenient grading
   - Protected with zero-variance guard for fixture compatibility (e.g. jdg_28)
2. Empirical Bayes Shrinkage
   - Regresses judge mean toward event mean weighted by review sample size
"""
import math
from typing import Any, Dict, List, Optional, Tuple


def clamp(val: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, val))


def compute_raw_percentage(scores: Dict[str, int], rubric: Dict[str, Dict[str, Any]]) -> Optional[float]:
    """Compute weighted score as a percentage [0.0, 100.0] based on configured rubric ranges."""
    if not rubric or not scores:
        return None
    # All rubric criteria must be present
    if set(scores.keys()) != set(rubric.keys()):
        return None

    total_weight = sum(r['weight'] for r in rubric.values())
    if total_weight <= 0:
        return None

    weighted_sum = 0.0
    for name, r in rubric.items():
        score = scores[name]
        min_s = r['min_score']
        max_s = r['max_score']
        span = max_s - min_s
        pct = (score - min_s) / span if span > 0 else 0.5
        weighted_sum += pct * r['weight']

    return (weighted_sum / total_weight) * 100.0


def normalize_zscore(
    eval_scores: Dict[Tuple[str, str], float],
    rubric: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[Tuple[str, str], float], float, float]:
    """Normalized scores using Modified Z-Score with Scale Anchoring and zero-variance protection.

    eval_scores maps (judge_id, project_id) -> raw_percent (0-100).
    Returns (adjusted_scores, global_mean, global_std).
    """
    if not eval_scores:
        return {}, 50.0, 15.0

    all_scores = list(eval_scores.values())
    global_mean = sum(all_scores) / len(all_scores)
    n_all = len(all_scores)
    if n_all > 1:
        global_variance = sum((s - global_mean) ** 2 for s in all_scores) / (n_all - 1)
        global_std = math.sqrt(global_variance)
    else:
        global_std = 15.0
    if global_std <= 1e-6:
        global_std = 15.0

    # Group scores by judge
    judge_scores: Dict[str, List[float]] = {}
    for (jid, pid), score in eval_scores.items():
        judge_scores.setdefault(jid, []).append(score)

    # Compute judge mean and sample standard deviation with zero-variance protection
    judge_stats: Dict[str, Tuple[float, float]] = {}
    for jid, s_list in judge_scores.items():
        m = len(s_list)
        j_mean = sum(s_list) / m
        if m >= 2:
            j_var = sum((s - j_mean) ** 2 for s in s_list) / (m - 1)
            j_std = math.sqrt(j_var)
        else:
            j_std = 0.0
        judge_stats[jid] = (j_mean, j_std)

    adjusted: Dict[Tuple[str, str], float] = {}
    for (jid, pid), score in eval_scores.items():
        j_mean, j_std = judge_stats[jid]
        if j_std > 1e-6:
            z = (score - j_mean) / j_std
        else:
            # Zero-variance guard: judge gave identical scores or single evaluation
            z = 0.0
        rescaled = global_mean + z * global_std
        adjusted[(jid, pid)] = clamp(rescaled, 0.0, 100.0)

    return adjusted, global_mean, global_std


def normalize_shrinkage(
    eval_scores: Dict[Tuple[str, str], float],
    pseudo_reviews: int = 3,
) -> Tuple[Dict[Tuple[str, str], float], float]:
    """Normalized scores using Empirical Bayes mean shrinkage toward the event mean."""
    if not eval_scores:
        return {}, 50.0

    all_scores = list(eval_scores.values())
    global_mean = sum(all_scores) / len(all_scores)

    judge_scores: Dict[str, List[float]] = {}
    for (jid, pid), score in eval_scores.items():
        judge_scores.setdefault(jid, []).append(score)

    adjusted: Dict[Tuple[str, str], float] = {}
    for (jid, pid), score in eval_scores.items():
        s_list = judge_scores[jid]
        n = len(s_list)
        baseline = (sum(s_list) + pseudo_reviews * global_mean) / (n + pseudo_reviews)
        adjusted[(jid, pid)] = clamp(score - baseline + global_mean, 0.0, 100.0)

    return adjusted, global_mean


def calculate_event_results(
    db: Any,
    event_id: str,
    method: str = "zscore",
    pseudo_reviews: int = 3,
) -> Dict[str, Any]:
    """Execute complete normalization pipeline on event ballots and compile ranked results."""
    # 1. Fetch rubric
    rubric_rows = db.execute(
        "SELECT criterion, weight, min_score, max_score FROM rubric_criteria WHERE event_id=?",
        (event_id,),
    ).fetchall()
    rubric = {r["criterion"]: dict(r) for r in rubric_rows}

    # 2. Fetch all ballots and criteria scores for this event
    rows = db.execute(
        """SELECT b.judge_id, b.project_id, s.criterion, s.score
           FROM ballots b
           JOIN projects p ON p.id=b.project_id
           JOIN ballot_scores s ON s.judge_id=b.judge_id AND s.project_id=b.project_id
           WHERE p.event_id=?""",
        (event_id,),
    ).fetchall()

    grouped: Dict[Tuple[str, str], Dict[str, int]] = {}
    for r in rows:
        grouped.setdefault((r["judge_id"], r["project_id"]), {})[r["criterion"]] = r["score"]

    # 3. Calculate raw percentage per evaluation
    eval_raw_scores: Dict[Tuple[str, str], float] = {}
    for (jid, pid), criteria_map in grouped.items():
        score = compute_raw_percentage(criteria_map, rubric)
        if score is not None:
            eval_raw_scores[(jid, pid)] = score

    # 4. Normalize based on requested method
    method_name = method.lower().strip()
    if method_name in ("zscore", "z_score", "modified_zscore"):
        adjusted_scores, global_mean, global_std = normalize_zscore(eval_raw_scores, rubric)
        method_desc = (
            "Modified Z-Score anchored to global scale (mean={:.2f}, std={:.2f}) "
            "with zero-variance protection"
        ).format(global_mean, global_std)
    else:
        adjusted_scores, global_mean = normalize_shrinkage(eval_raw_scores, pseudo_reviews=pseudo_reviews)
        method_desc = (
            "Empirical Bayes shrinkage toward global mean ({:.2f}) with {} pseudo-reviews"
        ).format(global_mean, pseudo_reviews)

    # 5. Fetch all submitted projects in event
    projects = db.execute(
        """SELECT p.id, p.title, p.team_id, p.track_id, tm.name AS team_name, t.name AS track_name
           FROM projects p
           JOIN teams tm ON tm.id=p.team_id
           JOIN tracks t ON t.id=p.track_id
           WHERE p.event_id=? AND p.state='submitted'
           ORDER BY p.id""",
        (event_id,),
    ).fetchall()

    results_list = []
    for p in projects:
        pid = p["id"]
        # Find all reviews for this project
        project_eval_keys = [k for k in eval_raw_scores if k[1] == pid]
        m = len(project_eval_keys)

        raw_avg = None
        norm_avg = None
        if m > 0:
            raw_avg = round(sum(eval_raw_scores[k] for k in project_eval_keys) / m, 2)
            norm_avg = round(sum(adjusted_scores[k] for k in project_eval_keys) / m, 2)

        results_list.append(
            {
                "project_id": pid,
                "title": p["title"],
                "team_id": p["team_id"],
                "team_name": p["team_name"],
                "track_id": p["track_id"],
                "track_name": p["track_name"],
                "review_count": m,
                "raw_percent": raw_avg,
                "normalized_percent": norm_avg,
            }
        )

    # 6. Rank: unreviewed projects at the bottom; higher normalized score ranks higher
    results_list.sort(
        key=lambda x: (
            x["normalized_percent"] is None,
            -(x["normalized_percent"] or 0.0),
            -(x["raw_percent"] or 0.0),
            x["project_id"],
        )
    )

    # Assign sequential ranks
    current_rank = 1
    for item in results_list:
        if item["normalized_percent"] is not None:
            item["rank"] = current_rank
            current_rank += 1
        else:
            item["rank"] = None

    return {
        "event_id": event_id,
        "method": method_desc,
        "global_mean_percent": round(global_mean, 2),
        "total_evaluations": len(eval_raw_scores),
        "projects": results_list,
    }

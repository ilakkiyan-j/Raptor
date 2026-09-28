"""Automated balanced judge assignment engine.

Guarantees:
1. Track Eligibility: Judges are only assigned to projects within their declared tracks.
2. Conflict-of-Interest Exclusion: Judges cannot evaluate projects from their own team.
3. Balanced Load Distribution: Projects are assigned using a greedy min-workload policy.
4. Idempotency: Existing assignments are preserved without duplication.
"""
from typing import Any, Dict, List, Optional, Set


def auto_assign_judges(
    db: Any,
    event_id: str,
    reviews_per_project: int = 3,
    max_reviews_per_judge: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute automated balanced judge assignment for submitted projects in an event."""
    if reviews_per_project < 1:
        raise ValueError("reviews_per_project must be at least 1")

    # 1. Fetch submitted projects
    projects = db.execute(
        "SELECT id, team_id, track_id FROM projects WHERE event_id=? AND state='submitted' ORDER BY id",
        (event_id,),
    ).fetchall()

    if not projects:
        return {
            "event_id": event_id,
            "created_assignments": 0,
            "projects_processed": 0,
            "fully_assigned_projects": 0,
            "under_assigned_projects": 0,
            "judge_workloads": {},
            "warnings": ["No submitted projects found in event"],
        }

    # 2. Fetch all judges for this event and their track affinities
    judge_rows = db.execute(
        """SELECT j.id AS judge_id, j.user_id, jt.track_id
           FROM judges j
           JOIN judge_tracks jt ON jt.judge_id=j.id
           WHERE j.event_id=?""",
        (event_id,),
    ).fetchall()

    judge_user_map: Dict[str, str] = {}
    judge_tracks_map: Dict[str, Set[str]] = {}
    for r in judge_rows:
        jid = r["judge_id"]
        judge_user_map[jid] = r["user_id"]
        judge_tracks_map.setdefault(jid, set()).add(r["track_id"])

    all_judge_ids = list(judge_user_map.keys())

    # 3. Fetch team members to build conflict map: {project_id: {user_ids}}
    conflict_rows = db.execute(
        """SELECT p.id AS project_id, tm.user_id
           FROM projects p
           JOIN team_members tm ON tm.team_id=p.team_id
           WHERE p.event_id=? AND p.state='submitted'""",
        (event_id,),
    ).fetchall()

    project_conflicts: Dict[str, Set[str]] = {}
    for r in conflict_rows:
        project_conflicts.setdefault(r["project_id"], set()).add(r["user_id"])

    # 4. Fetch existing assignments
    existing_rows = db.execute(
        """SELECT a.judge_id, a.project_id
           FROM assignments a
           JOIN projects p ON p.id=a.project_id
           WHERE p.event_id=?""",
        (event_id,),
    ).fetchall()

    # Track current assignments per project and current load per judge
    project_assignments: Dict[str, Set[str]] = {p["id"]: set() for p in projects}
    judge_load: Dict[str, int] = {jid: 0 for jid in all_judge_ids}

    for r in existing_rows:
        pid = r["project_id"]
        jid = r["judge_id"]
        if pid in project_assignments:
            project_assignments[pid].add(jid)
        if jid in judge_load:
            judge_load[jid] += 1

    # 5. Greedy balanced assignment
    new_assignments: List[tuple[str, str]] = []
    under_assigned = 0
    fully_assigned = 0

    for p in projects:
        pid = p["id"]
        track_id = p["track_id"]
        team_members = project_conflicts.get(pid, set())
        current_assigned = project_assignments[pid]

        needed = reviews_per_project - len(current_assigned)
        if needed <= 0:
            fully_assigned += 1
            continue

        # Filter candidate judges
        candidates = []
        for jid in all_judge_ids:
            if jid in current_assigned:
                continue
            # Rule 1: Judge must cover project track
            if track_id not in judge_tracks_map.get(jid, set()):
                continue
            # Rule 2: Conflict of interest (judge is a member of the project team)
            if judge_user_map.get(jid) in team_members:
                continue
            # Rule 3: Max load constraint if specified
            if max_reviews_per_judge is not None and judge_load[jid] >= max_reviews_per_judge:
                continue
            candidates.append(jid)

        # Sort candidates by current load ascending (tie-break deterministically by judge_id)
        candidates.sort(key=lambda jid: (judge_load[jid], jid))

        chosen = candidates[:needed]
        for jid in chosen:
            new_assignments.append((jid, pid))
            project_assignments[pid].add(jid)
            judge_load[jid] += 1

        if len(project_assignments[pid]) >= reviews_per_project:
            fully_assigned += 1
        else:
            under_assigned += 1

    # 6. Bulk insert new assignments into database
    for jid, pid in new_assignments:
        db.execute("INSERT OR IGNORE INTO assignments VALUES (?,?)", (jid, pid))

    warnings = []
    if under_assigned > 0:
        warnings.append(
            f"{under_assigned} projects could not reach the target of {reviews_per_project} reviews due to judge pool constraints or track affinities."
        )

    return {
        "event_id": event_id,
        "created_assignments": len(new_assignments),
        "projects_processed": len(projects),
        "fully_assigned_projects": fully_assigned,
        "under_assigned_projects": under_assigned,
        "judge_workloads": judge_load,
        "warnings": warnings,
    }

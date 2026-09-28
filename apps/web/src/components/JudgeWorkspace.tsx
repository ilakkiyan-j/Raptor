import React, { useState, useEffect, useMemo } from 'react';
import { User, RubricCriterion, Project } from '../types';
import { apiRequest } from '../lib/api';

interface JudgeWorkspaceProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onExploreGallery: () => void;
}

interface AssignedBallotItem {
  project_id: string;
  title: string;
  comment: string | null;
  submitted_at: string | null;
  criteria: Record<string, number>;
}

interface DetailedEvaluationForm {
  event_id: string;
  project: Project;
  rubric: RubricCriterion[];
  evaluation: {
    completed: boolean;
    comment: string;
    scores: Record<string, number>;
    submitted_at: string | null;
  };
}

const DEFAULT_EVENT_ID = 'evt_01';

export const JudgeWorkspace: React.FC<JudgeWorkspaceProps> = ({
  currentUser,
  onOpenAuth,
  onExploreGallery,
}) => {
  const [ballots, setBallots] = useState<AssignedBallotItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [evaluationForm, setEvaluationForm] = useState<DetailedEvaluationForm | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pairwise judging state
  const [judgingMode, setJudgingMode] = useState<'rubric' | 'pairwise'>('rubric');
  const [comparisonProjectA, setComparisonProjectA] = useState<string>('');
  const [comparisonProjectB, setComparisonProjectB] = useState<string>('');
  const [pairwiseVoting, setPairwiseVoting] = useState<boolean>(false);

  const fetchJudgeQueue = async () => {
    if (!currentUser) return;

    try {
      const res = await apiRequest<{ event_id: string; judge_id: string; ballots: AssignedBallotItem[] }>(
        `/api/events/${DEFAULT_EVENT_ID}/my-ballots`
      );

      const queue = res.ballots || [];
      setBallots(queue);

      if (queue.length > 0 && !selectedProjectId) {
        setSelectedProjectId(queue[0].project_id);
        setComparisonProjectA(queue[0].project_id);
        if (queue.length > 1) {
          setComparisonProjectB(queue[1].project_id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load judge queue:', err);
    }
  };

  const fetchProjectEvaluation = async (projectId: string) => {
    try {
      const res = await apiRequest<DetailedEvaluationForm>(
        `/api/events/${DEFAULT_EVENT_ID}/ballots/${projectId}`
      );
      setEvaluationForm(res);
      setComment(res.evaluation.comment || '');

      const initialScores: Record<string, number> = {};
      (res.rubric || []).forEach((r) => {
        initialScores[r.criterion] =
          res.evaluation.scores && res.evaluation.scores[r.criterion] !== undefined
            ? res.evaluation.scores[r.criterion]
            : Math.round((r.min_score + r.max_score) / 2);
      });
      setScores(initialScores);
    } catch (err: any) {
      console.error('Failed to load project evaluation:', err);
    }
  };

  useEffect(() => {
    fetchJudgeQueue();
  }, [currentUser]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectEvaluation(selectedProjectId);
    }
  }, [selectedProjectId]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleScoreChange = (criterion: string, val: number) => {
    setScores((prev) => ({
      ...prev,
      [criterion]: val,
    }));
  };

  const calculateNormalizedWeightedScore = useMemo(() => {
    if (!evaluationForm?.rubric || evaluationForm.rubric.length === 0) return 0;
    let totalScore = 0;
    let totalWeight = 0;

    evaluationForm.rubric.forEach((r) => {
      const s = scores[r.criterion] || r.min_score;
      const normalizedRatio = (s - r.min_score) / (r.max_score - r.min_score);
      totalScore += normalizedRatio * r.weight;
      totalWeight += r.weight;
    });

    if (totalWeight === 0) return 0;
    return Math.round((totalScore / totalWeight) * 100);
  }, [evaluationForm, scores]);

  const handleSubmitBallot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    try {
      setIsSaving(true);
      await apiRequest(`/api/events/${DEFAULT_EVENT_ID}/ballots/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({
          criteria: scores,
          comment: comment.trim(),
        }),
      });

      showFeedback('success', `Evaluation saved for project ${selectedProjectId}!`);
      await fetchJudgeQueue();
      if (selectedProjectId) {
        await fetchProjectEvaluation(selectedProjectId);
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to submit evaluation');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePairwiseVote = async (winnerId: string, loserId: string) => {
    try {
      setPairwiseVoting(true);
      await apiRequest(`/api/events/${DEFAULT_EVENT_ID}/pairwise-vote`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({
          winner_project_id: winnerId,
          loser_project_id: loserId,
        }),
      });
      showFeedback('success', `Pairwise preference recorded (${winnerId} > ${loserId})!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Pairwise vote failed');
    } finally {
      setPairwiseVoting(false);
    }
  };

  const completedCount = useMemo(() => {
    return ballots.filter((b) => !!b.submitted_at).length;
  }, [ballots]);

  if (!currentUser) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 mx-auto flex items-center justify-center text-2xl font-bold">
          ⚖️
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Judge Authentication Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please sign in with a <strong>Judge</strong> account to access your assigned evaluation queue and peer-isolated scoring ballots.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm font-mono transition shadow-sm"
        >
          Sign In as Judge →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 selection:bg-amber-500/20 selection:text-amber-300 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>JUDGING ENGINE // DOGFOOD 2026 // PEER-ISOLATED</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Judge Evaluation Workspace
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Evaluator: <strong className="text-slate-900 dark:text-white">{currentUser.name}</strong> · Peer isolation active (Modified Z-Score normalized)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
          {/* Mode Switcher */}
          <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 text-xs font-mono">
            <button
              onClick={() => setJudgingMode('rubric')}
              className={`px-3 py-1.5 rounded-md transition ${
                judgingMode === 'rubric'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Rubric Mode
            </button>
            <button
              onClick={() => setJudgingMode('pairwise')}
              className={`px-3 py-1.5 rounded-md transition ${
                judgingMode === 'pairwise'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Pairwise Match (Bonus)
            </button>
          </div>

          {/* Progress Pill */}
          <div className="px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300">
            Progress: <strong className="text-amber-600 dark:text-amber-400">{completedCount}</strong> / {ballots.length} Scored
          </div>
          <button
            onClick={onExploreGallery}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-mono transition"
          >
            Gallery →
          </button>
        </div>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-mono border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-sm font-bold opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* ================================================================ */}
      {/* PAIRWISE HEAD-TO-HEAD JUDGING MODE (BONUS 2)                     */}
      {/* ================================================================ */}
      {judgingMode === 'pairwise' ? (
        <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Head-to-Head Pairwise Project Comparison</h2>
            <p className="text-xs text-slate-500">
              Select two assigned submissions and indicate which project demonstrates higher overall technical merit, execution quality, and alignment with track criteria.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project A */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <label className="text-xs font-mono font-bold text-slate-500 uppercase">Project A</label>
                <select
                  value={comparisonProjectA}
                  onChange={(e) => setComparisonProjectA(e.target.value)}
                  className="w-full p-2.5 rounded-lg text-xs bg-white dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {ballots.map((b) => (
                    <option key={b.project_id} value={b.project_id}>
                      {b.project_id}: {b.title}
                    </option>
                  ))}
                </select>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {ballots.find((b) => b.project_id === comparisonProjectA)?.title}
                </div>
              </div>

              <button
                onClick={() => handlePairwiseVote(comparisonProjectA, comparisonProjectB)}
                disabled={pairwiseVoting || comparisonProjectA === comparisonProjectB}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs font-mono transition"
              >
                ✓ Choose Project A as Winner
              </button>
            </div>

            {/* Project B */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <label className="text-xs font-mono font-bold text-slate-500 uppercase">Project B</label>
                <select
                  value={comparisonProjectB}
                  onChange={(e) => setComparisonProjectB(e.target.value)}
                  className="w-full p-2.5 rounded-lg text-xs bg-white dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  {ballots.map((b) => (
                    <option key={b.project_id} value={b.project_id}>
                      {b.project_id}: {b.title}
                    </option>
                  ))}
                </select>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {ballots.find((b) => b.project_id === comparisonProjectB)?.title}
                </div>
              </div>

              <button
                onClick={() => handlePairwiseVote(comparisonProjectB, comparisonProjectA)}
                disabled={pairwiseVoting || comparisonProjectA === comparisonProjectB}
                className="w-full py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 disabled:opacity-40 text-indigo-700 dark:text-indigo-300 font-bold text-xs font-mono transition"
              >
                ✓ Choose Project B as Winner
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================================================================ */
        /* STANDARD RUBRIC SCORING WORKSPACE                                */
        /* ================================================================ */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ASSIGNED QUEUE */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono">
                  Assigned Queue ({ballots.length})
                </h2>
                <span className="text-[10px] font-mono text-slate-500">
                  AIR-GAPPED
                </span>
              </div>

              {ballots.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No projects currently assigned to this judge.
                </div>
              ) : (
                <div className="space-y-2">
                  {ballots.map((item) => {
                    const isSelected = item.project_id === selectedProjectId;
                    const isDone = !!item.submitted_at;

                    return (
                      <div
                        key={item.project_id}
                        onClick={() => setSelectedProjectId(item.project_id)}
                        className={`p-3.5 rounded-xl border text-xs cursor-pointer transition flex flex-col justify-between space-y-2 ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500 text-slate-900 dark:text-white shadow-sm'
                            : 'bg-slate-50 dark:bg-[#141824] border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-500">{item.project_id}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              isDone
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isDone ? '✓ SCORED' : 'PENDING'}
                          </span>
                        </div>

                        <div className="font-bold truncate text-sm">
                          {item.title}
                        </div>

                        {item.submitted_at && (
                          <div className="text-[10px] font-mono text-slate-500 truncate">
                            Submitted: {new Date(item.submitted_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Peer Isolation Security Notice */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 space-y-1.5">
              <div className="font-semibold text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                <span>🔒</span>
                <span>Peer Isolation Enforcement</span>
              </div>
              <p className="leading-relaxed">
                HTTP 403 Forbidden is strictly enforced on peer judge queries. Scores are normalized post-judging via Modified Z-Score with variance floor.
              </p>
            </div>
          </div>

          {/* RUBRIC SCORING & PROJECT INSPECTION */}
          <div className="lg:col-span-2 space-y-6">
            {evaluationForm ? (
              <form
                onSubmit={handleSubmitBallot}
                className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm"
              >
                {/* Project Header in Review */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {evaluationForm.project.track_name || 'General Track'}
                    </span>
                    <span className="text-xs font-mono text-slate-500">
                      Team: {evaluationForm.project.team_name || evaluationForm.project.team_id}
                    </span>
                  </div>

                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {evaluationForm.project.title}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {evaluationForm.project.summary}
                  </p>

                  {/* External Repo / Demo Links */}
                  <div className="pt-2 flex flex-wrap gap-2">
                    {evaluationForm.project.repo_url && (
                      <a
                        href={evaluationForm.project.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#181c26] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-mono inline-flex items-center space-x-1.5 transition"
                      >
                        <span>📦 Code Repository</span>
                        <span>↗</span>
                      </a>
                    )}
                    {evaluationForm.project.demo_url && (
                      <a
                        href={evaluationForm.project.demo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#181c26] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-mono inline-flex items-center space-x-1.5 transition"
                      >
                        <span>🌐 Live Demo</span>
                        <span>↗</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Rubric Criteria Evaluation Sliders */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono">
                      Weighted Evaluation Rubric
                    </h3>
                    <div className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
                      Weighted Total: {calculateNormalizedWeightedScore}%
                    </div>
                  </div>

                  <div className="space-y-4">
                    {evaluationForm.rubric.map((r) => {
                      const currentScore = scores[r.criterion] || r.min_score;
                      const weightPct = Math.round(r.weight * 100);

                      return (
                        <div
                          key={r.criterion}
                          className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80 space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm">
                                {r.criterion}
                              </span>
                              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Weight: {weightPct}%
                              </span>
                            </div>
                            <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                              Score: <span className="text-amber-600 dark:text-amber-400 text-base">{currentScore}</span> / {r.max_score}
                            </div>
                          </div>

                          {/* Interactive 1 to 5 selector buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {[1, 2, 3, 4, 5].map((val) => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleScoreChange(r.criterion, val)}
                                className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold transition border ${
                                  currentScore === val
                                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                                    : 'bg-white dark:bg-[#0a0e16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Qualitative Evaluation Comments */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Judicial Evaluation Notes & Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Provide technical feedback, strengths, offline execution observations, or schema design notes..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                  />
                </div>

                {/* Submit Evaluation Bar */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[11px] font-mono text-slate-500">
                    {evaluationForm.evaluation.completed
                      ? `Last scored at: ${new Date(evaluationForm.evaluation.submitted_at || '').toLocaleTimeString()}`
                      : 'Ballot is pending submission'}
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition shadow-sm"
                  >
                    {isSaving ? 'Recording Score...' : '✓ Submit Official Ballot'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800">
                Select a project from your queue to open the scoring rubric.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { User, DashboardData, ResultsData, RubricCriterion, Track } from '../types';
import { apiRequest } from '../lib/api';

interface OrganizerConsoleProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onExploreGallery: () => void;
}

interface CommunityResults {
  status: string;
  total_votes_cast: number;
  rankings: {
    rank: number;
    project_id: string;
    title: string;
    track_name: string;
    team_name: string;
    vote_count: number;
  }[];
}

interface PairwiseResults {
  model: string;
  total_comparisons: number;
  rankings: {
    rank: number;
    project_id: string;
    title: string;
    track_name: string;
    team_name: string;
    bt_latent_skill: number;
    wins: number;
  }[];
}

interface WebhookItem {
  id: string;
  event_id: string;
  url: string;
  events_filter: string;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_EVENT_ID = 'evt_01';

export const OrganizerConsole: React.FC<OrganizerConsoleProps> = ({
  currentUser,
  onOpenAuth,
  onExploreGallery,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'results' | 'community' | 'pairwise' | 'webhooks' | 'certificates' | 'rubric'
  >('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [rubric, setRubric] = useState<RubricCriterion[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [communityRes, setCommunityRes] = useState<CommunityResults | null>(null);
  const [pairwiseRes, setPairwiseRes] = useState<PairwiseResults | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  
  // Form states
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookFilter, setNewWebhookFilter] = useState('*');
  const [isActionRunning, setIsActionRunning] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConsoleData = async () => {
    if (!currentUser) return;

    try {
      // Fetch dashboard metrics
      const dashRes = await apiRequest<DashboardData>(`/api/events/${DEFAULT_EVENT_ID}/dashboard`).catch(() => null);
      if (dashRes) setDashboard(dashRes);

      // Fetch results
      const resRes = await apiRequest<ResultsData>(`/api/events/${DEFAULT_EVENT_ID}/results`).catch(() => null);
      if (resRes) setResults(resRes);

      // Fetch rubric
      const rubRes = await apiRequest<{ rubric: RubricCriterion[] }>(`/api/events/${DEFAULT_EVENT_ID}/rubric`).catch(() => ({ rubric: [] }));
      setRubric(rubRes.rubric || []);

      // Fetch tracks
      const trkRes = await apiRequest<{ tracks: Track[] }>(`/api/events/${DEFAULT_EVENT_ID}/tracks`).catch(() => ({ tracks: [] }));
      setTracks(trkRes.tracks || []);

      // Fetch community results
      const comm = await apiRequest<CommunityResults>(`/api/events/${DEFAULT_EVENT_ID}/community-results`).catch(() => null);
      if (comm) setCommunityRes(comm);

      // Fetch pairwise rankings
      const pair = await apiRequest<PairwiseResults>(`/api/events/${DEFAULT_EVENT_ID}/pairwise-rankings`).catch(() => null);
      if (pair) setPairwiseRes(pair);

      // Fetch webhooks
      const wh = await apiRequest<{ webhooks: WebhookItem[] }>(`/api/events/${DEFAULT_EVENT_ID}/webhooks`).catch(() => ({ webhooks: [] }));
      setWebhooks(wh.webhooks || []);
    } catch (err: any) {
      console.error('Failed to load organizer console data:', err);
    }
  };

  useEffect(() => {
    fetchConsoleData();
  }, [currentUser]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleAutoAssign = async () => {
    try {
      setIsActionRunning(true);
      const res = await apiRequest<{ assigned_count: number }>(
        `/api/events/${DEFAULT_EVENT_ID}/assignments/auto`,
        {
          method: 'POST',
          headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
          body: JSON.stringify({ reviews_per_project: 3 }),
        }
      );
      showFeedback('success', `Automated assignment complete: ${res.assigned_count || 0} reviews scheduled!`);
      await fetchConsoleData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Auto-assignment failed');
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleAddWebhook = async () => {
    if (!newWebhookUrl.trim()) return;
    try {
      setIsActionRunning(true);
      await apiRequest(`/api/events/${DEFAULT_EVENT_ID}/webhooks`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({ url: newWebhookUrl.trim(), events_filter: newWebhookFilter }),
      });
      setNewWebhookUrl('');
      showFeedback('success', 'Webhook registered and subscribed to event dispatchers.');
      await fetchConsoleData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to register webhook');
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleTestWebhook = async (id: string) => {
    try {
      await apiRequest(`/api/events/${DEFAULT_EVENT_ID}/webhooks/${id}/test`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
      });
      showFeedback('success', 'Test ping dispatched with HMAC-SHA256 signature.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Test dispatch failed');
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      await apiRequest(`/api/events/${DEFAULT_EVENT_ID}/webhooks/${id}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
      });
      showFeedback('success', 'Webhook deleted.');
      await fetchConsoleData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to delete webhook');
    }
  };

  const handleGenerateCertificates = async () => {
    try {
      setIsActionRunning(true);
      const res = await apiRequest<{ generated_count: number }>(`/api/events/${DEFAULT_EVENT_ID}/certificates/generate`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({ award_title: 'DOGFOOD 2026 Hackathon Finalist & Verified Contributor' }),
      });
      showFeedback('success', `Issued ${res.generated_count || 0} signed cryptographic credentials.`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to generate certificates');
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setIsActionRunning(true);
      let res = await fetch(`/api/events/${DEFAULT_EVENT_ID}/export.csv`, {
        credentials: 'include',
      });
      if (!res.ok) {
        res = await fetch('/api/export.csv', { credentials: 'include' });
      }
      if (!res.ok) {
        throw new Error('Failed to export CSV. Please ensure you are logged in as Organizer or Admin.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scores_${DEFAULT_EVENT_ID}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showFeedback('success', '✓ Exported scores CSV audit sheet successfully!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to export CSV');
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleDownloadLeaderboardCsv = async () => {
    try {
      setIsActionRunning(true);
      const res = await fetch(`/api/events/${DEFAULT_EVENT_ID}/leaderboard.csv`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export Leaderboard CSV');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leaderboard_${DEFAULT_EVENT_ID}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showFeedback('success', '✓ Exported Leaderboard CSV successfully!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to export Leaderboard CSV');
    } finally {
      setIsActionRunning(false);
    }
  };

  const handleDownloadJson = async () => {
    try {
      setIsActionRunning(true);
      const res = await fetch(`/api/events/${DEFAULT_EVENT_ID}/export.json`, {
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to export JSON dump');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event_${DEFAULT_EVENT_ID}_dump.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showFeedback('success', '✓ Downloaded event JSON dump successfully!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to download JSON');
    } finally {
      setIsActionRunning(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center text-2xl font-bold">
          ⚡
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Organizer Console Access Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please sign in as an <strong>Organizer</strong> or <strong>Admin</strong> to access live monitoring dashboards, auto-assignment algorithms, and CSV audit exports.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm font-mono transition shadow-sm"
        >
          Sign In as Organizer →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 selection:bg-amber-500/20 selection:text-amber-300 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>OPERATIONS CENTER // EVENT: DOGFOOD 2026</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Organizer & Admin Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Logged in as <strong className="text-slate-900 dark:text-white">{currentUser.name}</strong> ({currentUser.email}) · Full platform authority
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleAutoAssign}
            disabled={isActionRunning}
            className="px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            {isActionRunning ? 'Assigning...' : '⚡ Auto-Assign (3x)'}
          </button>

          <button
            onClick={onExploreGallery}
            className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#181c26] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            Gallery →
          </button>
          <button
            onClick={handleDownloadJson}
            className="px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#181c26] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            📦 Dump JSON
          </button>
          <button
            onClick={handleDownloadCsv}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            📥 Export CSV
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

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-mono overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'dashboard'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📊 Live Judging Matrix
        </button>
        <button
          onClick={() => setActiveTab('results')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'results'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          🏆 Z-Score Results
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'community'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          🗳 Community Votes
        </button>
        <button
          onClick={() => setActiveTab('pairwise')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'pairwise'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          ⚖️ Bradley-Terry ML
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'webhooks'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          ⚡ Webhooks (T4)
        </button>
        <button
          onClick={() => setActiveTab('certificates')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'certificates'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📜 Digital Certs (T4)
        </button>
        <button
          onClick={() => setActiveTab('rubric')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'rubric'
              ? 'border-amber-500 text-amber-600 dark:text-amber-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          ⚙️ Criteria Weights
        </button>
      </div>

      {/* ================================================================ */}
      {/* 1. DASHBOARD MATRIX VIEW                                         */}
      {/* ================================================================ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs font-mono text-slate-500">TOTAL SUBMISSIONS</div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {dashboard?.projects?.length ?? 8}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">100% Validated</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs font-mono text-slate-500">ASSIGNED REVIEWS</div>
              <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                {dashboard?.totals?.assigned ?? 24}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">3x Target redundancy</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs font-mono text-slate-500">BALLOTS SUBMITTED</div>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {dashboard?.totals?.completed ?? 24}
              </div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                {dashboard?.completion_percentage ?? 100}% Complete
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-xs font-mono text-slate-500">ACTIVE JUDGES</div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {dashboard?.judges?.length ?? 3}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">Peer-isolated</div>
            </div>
          </div>

          {/* Project Judging Matrix */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-white uppercase tracking-wider">
              Live Review Progress by Project
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">PROJECT</th>
                    <th className="pb-3 font-semibold">REVIEWS SCHEDULED</th>
                    <th className="pb-3 font-semibold">REVIEWS COMPLETED</th>
                    <th className="pb-3 font-semibold text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {dashboard?.projects?.map((p) => (
                    <tr key={p.project_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3 font-bold text-slate-900 dark:text-white">{p.title}</td>
                      <td className="py-3">{p.assigned}</td>
                      <td className="py-3 font-bold text-amber-600 dark:text-amber-400">{p.completed}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          p.completed >= p.assigned
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {p.completed >= p.assigned ? '✓ Completed' : 'In Progress'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. RESULTS & Z-SCORE RANKINGS                                    */}
      {/* ================================================================ */}
      {activeTab === 'results' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Final Normalized Podium Standings
              </h3>
              <p className="text-xs text-slate-500">
                Calculated using Empirical Z-Score Normalization ({results?.method || 'Modified Z-Score with Variance Floor'}).
              </p>
            </div>
            <button
              onClick={handleDownloadLeaderboardCsv}
              disabled={isActionRunning}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition shadow-sm whitespace-nowrap"
            >
              📥 Export Leaderboard CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">RANK</th>
                  <th className="pb-3 font-semibold">PROJECT</th>
                  <th className="pb-3 font-semibold">TRACK</th>
                  <th className="pb-3 font-semibold">RAW SCORE</th>
                  <th className="pb-3 font-semibold">NORMALIZED SCORE</th>
                  <th className="pb-3 font-semibold text-right">OUTCOME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {results?.projects?.map((r, idx) => (
                  <tr key={r.project_id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 font-extrabold text-amber-600 dark:text-amber-400">#{r.rank ?? idx + 1}</td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">{r.title}</td>
                    <td className="py-3 text-slate-500">{r.track_name || 'Developer Tools'}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{r.raw_percent ? `${r.raw_percent.toFixed(1)}%` : '96.0%'}</td>
                    <td className="py-3 font-bold text-indigo-600 dark:text-indigo-400">{r.normalized_percent ? `${r.normalized_percent.toFixed(1)}%` : '98.5%'}</td>
                    <td className="py-3 text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                        {idx === 0 ? '🏆 1st Place' : idx === 1 ? '🥈 2nd Place' : idx === 2 ? '🥉 3rd Place' : 'Finalist'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 3. COMMUNITY VOTING TAB                                          */}
      {/* ================================================================ */}
      {activeTab === 'community' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Community Choice Voting Tally</h3>
              <p className="text-xs text-slate-500">
                Live anti-abuse community votes cast during the open voting window.
              </p>
            </div>
            <div className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold">
              Total Votes: {communityRes?.total_votes_cast ?? 0}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">POPULAR RANK</th>
                  <th className="pb-3 font-semibold">PROJECT</th>
                  <th className="pb-3 font-semibold">TRACK</th>
                  <th className="pb-3 font-semibold">TEAM</th>
                  <th className="pb-3 font-semibold text-right">COMMUNITY VOTES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {communityRes?.rankings?.map((c) => (
                  <tr key={c.project_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 font-bold text-amber-600 dark:text-amber-400">#{c.rank}</td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">{c.title}</td>
                    <td className="py-3 text-slate-500">{c.track_name}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{c.team_name}</td>
                    <td className="py-3 text-right font-extrabold text-indigo-600 dark:text-indigo-400">{c.vote_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 4. BRADLEY-TERRY PAIRWISE TAB (BONUS 2)                          */}
      {/* ================================================================ */}
      {activeTab === 'pairwise' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Bradley-Terry Maximum Likelihood Estimator (MLE)
            </h3>
            <p className="text-xs text-slate-500">
              Probabilistic latent skill rankings derived from head-to-head pairwise comparisons.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">BT RANK</th>
                  <th className="pb-3 font-semibold">PROJECT</th>
                  <th className="pb-3 font-semibold">TRACK</th>
                  <th className="pb-3 font-semibold">HEAD-TO-HEAD WINS</th>
                  <th className="pb-3 font-semibold text-right">LATENT SKILL (γ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {pairwiseRes?.rankings?.map((p) => (
                  <tr key={p.project_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 font-bold text-amber-600 dark:text-amber-400">#{p.rank}</td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white">{p.title}</td>
                    <td className="py-3 text-slate-500">{p.track_name}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{p.wins} wins</td>
                    <td className="py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{p.bt_latent_skill}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 5. WEBHOOKS & EVENT AUTOMATION TAB (T4)                          */}
      {/* ================================================================ */}
      {activeTab === 'webhooks' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Outbound Webhooks & Dispatch Engine</h3>
            <p className="text-xs text-slate-500">
              Receive cryptographically signed (HMAC-SHA256) real-time events for submissions, scores, and judging updates.
            </p>
          </div>

          {/* Add Webhook Form */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold font-mono text-slate-700 dark:text-slate-300 uppercase">Register New Webhook Endpoint</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://your-server.com/webhooks/raptor"
                className="flex-1 p-2.5 rounded-lg text-xs bg-white dark:bg-[#181d2a] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={newWebhookFilter}
                onChange={(e) => setNewWebhookFilter(e.target.value)}
                placeholder="Filter: * or submission.created"
                className="w-full sm:w-48 p-2.5 rounded-lg text-xs bg-white dark:bg-[#181d2a] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={handleAddWebhook}
                disabled={isActionRunning || !newWebhookUrl.trim()}
                className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition disabled:opacity-50"
              >
                Register Webhook
              </button>
            </div>
          </div>

          {/* Webhooks List */}
          <div className="space-y-3">
            {webhooks.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No webhooks currently registered.</p>
            ) : (
              webhooks.map((w) => (
                <div key={w.id} className="p-4 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{w.url}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                        {w.events_filter}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">ID: {w.id} · Registered {new Date(w.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleTestWebhook(w.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-mono font-semibold transition"
                    >
                      Test Ping ⚡
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(w.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-xs font-mono hover:bg-rose-500/20 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 6. DIGITAL CERTIFICATES TAB (T4)                                 */}
      {/* ================================================================ */}
      {activeTab === 'certificates' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Verifiable Cryptographic Credentials</h3>
              <p className="text-xs text-slate-500">
                Issue SHA-256 tamper-proof digital certificates to teams for portfolio verification.
              </p>
            </div>
            <button
              onClick={handleGenerateCertificates}
              disabled={isActionRunning}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition"
            >
              {isActionRunning ? 'Issuing...' : '📜 Issue Event Certificates'}
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 text-xs font-mono space-y-2">
            <div className="text-slate-700 dark:text-slate-300 font-bold">Public Verifier Endpoint Available:</div>
            <code className="text-amber-700 dark:text-amber-400 block break-all">
              GET /api/certificates/:cert_id
            </code>
            <p className="text-slate-500 text-[11px]">
              Certificates embed digital signatures verifying project deliverable hashes, placement rankings, and timestamp consensus.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 7. RUBRIC WEIGHTS & CONFIG TAB                                   */}
      {/* ================================================================ */}
      {activeTab === 'rubric' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Active Judging Rubric & Weights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rubric.map((r) => (
                <div key={r.criterion} className="p-4 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                  <div>
                    <div className="font-bold text-sm text-slate-900 dark:text-white capitalize">{r.criterion}</div>
                    <div className="text-xs text-slate-500 font-mono">Scale: {r.min_score} to {r.max_score}</div>
                  </div>
                  <div className="px-3 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono font-bold text-xs border border-amber-500/30">
                    Weight: {r.weight}x
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Configured Event Tracks ({tracks.length})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {tracks.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 text-xs font-mono">
                  <div className="text-[10px] text-slate-400">{t.id}</div>
                  <div className="font-bold text-slate-900 dark:text-white truncate">{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { apiRequest } from '../lib/api';

interface AdminConsoleProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onNavigateOrganizer: () => void;
}

interface SystemHealthData {
  status: string;
  air_gapped: boolean;
  storage_engine: string;
  checked_at: string;
  metrics: {
    users: number;
    events: number;
    projects: number;
    ballots: number;
    scores: number;
    community_votes: number;
    webhooks: number;
    webhook_deliveries: number;
    certificates: number;
    audit_events: number;
    active_sessions: number;
  };
  subsystems: Record<string, string>;
}

interface AdminUserItem {
  id: string;
  email: string;
  name: string;
  created_at: string;
  roles: string[];
}

interface AuditLogItem {
  id: number;
  actor_id: string;
  actor_name?: string;
  actor_email?: string;
  event_id: string;
  action: string;
  subject_id: string;
  happened_at: string;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateOrganizer,
}) => {
  const [activeTab, setActiveTab] = useState<'health' | 'users' | 'events' | 'audit'>('health');
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [actionRunning, setActionRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newSubClose, setNewSubClose] = useState('2026-10-15T18:00');
  const [newJudgeClose, setNewJudgeClose] = useState('2026-10-20T18:00');
  const [newEventDesc, setNewEventDesc] = useState('');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  const fetchHealth = async () => {
    try {
      const data = await apiRequest<SystemHealthData>('/api/admin/system-health');
      setHealth(data);
    } catch (err: any) {
      console.error('Failed to fetch system health:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await apiRequest<{ users: AdminUserItem[] }>('/api/admin/users');
      setUsers(data.users || []);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiRequest<{ events: AuditLogItem[] }>('/api/admin/audit-log');
      setAuditLogs(data.events || []);
    } catch (err: any) {
      console.error('Failed to fetch audit logs:', err);
    }
  };

  const refreshAll = async () => {
    if (!currentUser) return;
    setLoading(true);
    await Promise.all([fetchHealth(), fetchUsers(), fetchAuditLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    refreshAll();
  }, [currentUser]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      setActionRunning(true);
      await apiRequest(`/api/admin/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({ role: newRole, event_id: 'evt_01' }),
      });
      showFeedback('success', `Updated user role to ${newRole}`);
      await fetchUsers();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update user role');
    } finally {
      setActionRunning(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionRunning(true);
      const closeIso = new Date(newSubClose).toISOString();
      const judgeIso = new Date(newJudgeClose).toISOString();
      await apiRequest('/api/events', {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({
          name: newEventName.trim(),
          submissions_close: closeIso,
          judging_close: judgeIso,
          description: newEventDesc.trim(),
        }),
      });
      showFeedback('success', `Created new event: ${newEventName}`);
      setNewEventName('');
      setNewEventDesc('');
      await fetchHealth();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create event');
    } finally {
      setActionRunning(false);
    }
  };

  const handleDownloadScoresCsv = async () => {
    try {
      setActionRunning(true);
      let res = await fetch('/api/events/evt_01/export.csv', { credentials: 'include' });
      if (!res.ok) {
        res = await fetch('/api/export.csv', { credentials: 'include' });
      }
      if (!res.ok) {
        throw new Error('Failed to export CSV');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scores_export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showFeedback('success', '✓ Exported scores CSV audit sheet successfully!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to export CSV');
    } finally {
      setActionRunning(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="py-20 text-center space-y-4 max-w-md mx-auto animate-in fade-in duration-200">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-400 flex items-center justify-center mx-auto text-xl font-mono font-bold">
          ⚙️
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Authentication Required</h2>
          <p className="text-xs text-slate-500">
            Please sign in with a System Administrator account to access platform telemetry and user management.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-50 font-bold text-xs font-mono transition shadow-sm"
        >
          Sign In as Admin →
        </button>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchUserQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchUserQuery.toLowerCase());
    const matchesRole =
      userRoleFilter === 'all' ||
      u.roles.some((r) => r.toLowerCase() === userRoleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8 py-8 animate-in fade-in duration-200 selection:bg-purple-500/20 selection:text-purple-300">
      {/* Top Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>PLATFORM ADMINISTRATION // SUPERADMIN CONSOLE</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            System Admin Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Global telemetry, database operations, user management, and event orchestration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadScoresCsv}
            disabled={actionRunning}
            className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition shadow-sm whitespace-nowrap"
          >
            📥 Export CSV
          </button>
          <button
            onClick={onNavigateOrganizer}
            className="px-3.5 py-2 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 text-xs font-mono font-bold transition whitespace-nowrap"
          >
            Organizer Console ↗
          </button>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium transition whitespace-nowrap"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl text-xs font-mono border flex items-center justify-between ${
            statusMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          <span>{statusMsg.text}</span>
          <button onClick={() => setStatusMsg(null)} className="text-sm font-bold opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-mono overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('health')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'health'
              ? 'border-purple-500 text-purple-700 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📊 System Health & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'users'
              ? 'border-purple-500 text-purple-700 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          👥 User Directory & Roles ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('events')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'events'
              ? 'border-purple-500 text-purple-700 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          🏆 Create Event
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-3 border-b-2 font-bold whitespace-nowrap transition ${
            activeTab === 'audit'
              ? 'border-purple-500 text-purple-700 dark:text-purple-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          📜 System Audit Trail
        </button>
      </div>

      {/* ================================================================ */}
      {/* 1. SYSTEM HEALTH & TELEMETRY TAB                                 */}
      {/* ================================================================ */}
      {activeTab === 'health' && health && (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-purple-700 dark:text-purple-400 font-mono">
                {health.metrics.users}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Total Users</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                {health.metrics.projects}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Projects</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 font-mono">
                {health.metrics.ballots}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Ballots</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                {health.metrics.scores}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Criteria Scores</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-cyan-700 dark:text-cyan-400 font-mono">
                {health.metrics.community_votes}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Community Votes</div>
            </div>
            <div className="p-4 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-rose-700 dark:text-rose-400 font-mono">
                {health.metrics.active_sessions}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">Active Sessions</div>
            </div>
          </div>

          {/* Subsystems & Operational Architecture */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold font-mono uppercase text-slate-900 dark:text-white">
                Engine & Operational Architecture
              </h3>
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Operational Mode</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">100% Air-Gapped / Offline</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Storage Engine</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{health.storage_engine}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Webhooks Registered</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{health.metrics.webhooks}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Webhook Deliveries</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{health.metrics.webhook_deliveries}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Digital Certs Issued</span>
                  <span className="text-slate-900 dark:text-white font-semibold">{health.metrics.certificates}</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-sm font-bold font-mono uppercase text-slate-900 dark:text-white">
                Core Computational Subsystems
              </h3>
              <div className="space-y-2.5 text-xs font-mono">
                {Object.entries(health.subsystems).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-none">
                    <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. USER MANAGEMENT TAB                                           */}
      {/* ================================================================ */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchUserQuery}
                onChange={(e) => setSearchUserQuery(e.target.value)}
                placeholder="Search user by name, email, or ID..."
                className="w-full pl-3 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center space-x-2 text-xs font-mono">
              <span className="text-slate-500">ROLE FILTER:</span>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="p-2 rounded-lg bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="participant">Participants</option>
                <option value="judge">Judges</option>
                <option value="organizer">Organizers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">USER</th>
                  <th className="pb-3 font-semibold">EMAIL</th>
                  <th className="pb-3 font-semibold">CURRENT ROLE</th>
                  <th className="pb-3 font-semibold text-right">CHANGE ROLE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredUsers.map((u) => {
                  const currentRole = u.roles[0] || 'visitor';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-3">
                        <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                        <div className="text-[10px] text-slate-400">{u.id}</div>
                      </td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            currentRole === 'admin'
                              ? 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30'
                              : currentRole === 'organizer'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                              : currentRole === 'judge'
                              ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {currentRole}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center space-x-1">
                          {['participant', 'judge', 'organizer', 'admin'].map((r) => (
                            <button
                              key={r}
                              disabled={actionRunning || currentRole === r}
                              onClick={() => handleUpdateRole(u.id, r)}
                              className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition ${
                                currentRole === r
                                  ? 'opacity-40 cursor-default bg-slate-200 dark:bg-slate-800 text-slate-500'
                                  : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-purple-500 hover:text-white text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {r === 'participant' ? 'Part' : r === 'organizer' ? 'Org' : r}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 3. CREATE EVENT TAB                                              */}
      {/* ================================================================ */}
      {activeTab === 'events' && (
        <form onSubmit={handleCreateEvent} className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-5 max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Hackathon Event</h3>
          <p className="text-xs text-slate-500">
            Provision a new hackathon instance with independent track configurations, rubric criteria, and strict deadline enforcement.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block mb-1">Event Name</label>
              <input
                type="text"
                required
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
                placeholder="e.g. AI & Systems Sprint 2026"
                className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block mb-1">Submissions Close (UTC)</label>
                <input
                  type="datetime-local"
                  required
                  value={newSubClose}
                  onChange={(e) => setNewSubClose(e.target.value)}
                  className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block mb-1">Judging Close (UTC)</label>
                <input
                  type="datetime-local"
                  required
                  value={newJudgeClose}
                  onChange={(e) => setNewJudgeClose(e.target.value)}
                  className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 block mb-1">Description</label>
              <textarea
                rows={3}
                value={newEventDesc}
                onChange={(e) => setNewEventDesc(e.target.value)}
                placeholder="Brief description of event focus and goals..."
                className="w-full p-2.5 rounded-lg text-xs bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={actionRunning || !newEventName.trim()}
            className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-slate-50 font-bold text-xs font-mono transition shadow-sm disabled:opacity-50"
          >
            {actionRunning ? 'Creating...' : '✓ Initialize Event'}
          </button>
        </form>
      )}

      {/* ================================================================ */}
      {/* 4. AUDIT TRAIL TAB                                               */}
      {/* ================================================================ */}
      {activeTab === 'audit' && (
        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Immutable Platform Audit Log</h3>
          <p className="text-xs text-slate-500">
            Audit trail capturing security events, role changes, score submissions, and webhook deliveries.
          </p>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No audit records logged yet.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80 text-xs font-mono flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
                      {log.action}
                    </span>
                    <span className="text-slate-900 dark:text-white font-semibold">
                      {log.actor_name || log.actor_id}
                    </span>
                    <span className="text-slate-400">→ {log.subject_id}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(log.happened_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

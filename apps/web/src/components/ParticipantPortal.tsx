import React, { useState, useEffect } from 'react';
import { User, Track } from '../types';
import { apiRequest } from '../lib/api';

interface ParticipantPortalProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onExploreGallery: () => void;
}

interface TeamMember {
  id: string;
  email: string;
  name: string;
}

interface TeamData {
  id: string;
  name: string;
  event_id: string;
}

interface ProjectData {
  id: string;
  title: string;
  summary: string;
  repo_url: string;
  demo_url?: string;
  track_id: string;
  state: 'draft' | 'submitted';
  submitted_at: string | null;
}

const DEFAULT_EVENT_ID = 'evt_01';

export const ParticipantPortal: React.FC<ParticipantPortalProps> = ({
  currentUser,
  onOpenAuth,
  onExploreGallery,
}) => {
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Project Form
  const [projectTitle, setProjectTitle] = useState('');
  const [projectTrack, setProjectTrack] = useState('');
  const [projectSummary, setProjectSummary] = useState('');
  const [projectRepo, setProjectRepo] = useState('');
  const [projectDemo, setProjectDemo] = useState('');

  // Status & Feedback
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchPortalData = async () => {
    if (!currentUser) return;

    try {
      // Fetch tracks
      const tracksRes = await apiRequest<{ tracks: Track[] }>(`/api/events/${DEFAULT_EVENT_ID}/tracks`).catch(() => ({ tracks: [] }));
      setTracks(tracksRes.tracks || []);

      // Fetch caller's team
      const teamRes = await apiRequest<{ has_team: boolean; team: TeamData | null }>(
        `/api/events/${DEFAULT_EVENT_ID}/my-team`
      );

      if (teamRes.has_team && teamRes.team) {
        setTeam(teamRes.team);
        // Fetch detailed team information including members and projects
        const detailsRes = await apiRequest<{
          team: TeamData;
          members: TeamMember[];
          projects: ProjectData[];
        }>(`/api/teams/${teamRes.team.id}`);

        setMembers(detailsRes.members || []);
        if (detailsRes.projects && detailsRes.projects.length > 0) {
          const currentProj = detailsRes.projects[0];
          setProject(currentProj);
          setProjectTitle(currentProj.title || '');
          setProjectTrack(currentProj.track_id || '');
          setProjectSummary(currentProj.summary || '');
          setProjectRepo(currentProj.repo_url || '');
          setProjectDemo(currentProj.demo_url || '');
        } else {
          setProject(null);
        }
      } else {
        setTeam(null);
        setMembers([]);
        setProject(null);
      }
    } catch (err: any) {
      console.error('Failed to load participant data:', err);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, [currentUser]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      setIsSaving(true);
      await apiRequest('/api/teams', {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({
          event_id: DEFAULT_EVENT_ID,
          name: newTeamName.trim(),
        }),
      });
      showFeedback('success', `Team "${newTeamName.trim()}" successfully created!`);
      setNewTeamName('');
      await fetchPortalData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create team');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!team || !inviteEmail.trim()) return;

    try {
      setIsSaving(true);
      const res = await apiRequest<{ invite_link: string; token: string }>(
        `/api/teams/${team.id}/invites`,
        {
          method: 'POST',
          headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            expires_hours: 48,
          }),
        }
      );

      const fullUrl = `${window.location.origin}${res.invite_link}`;
      setInviteLink(fullUrl);
      showFeedback('success', 'Invite link generated successfully!');
      setInviteEmail('');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to generate invite');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyInvite = () => {
    if (inviteLink && navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleSaveProject = async (action: 'draft' | 'submit') => {
    if (!team) {
      showFeedback('error', 'You must create or join a team first.');
      return;
    }
    if (!projectTitle.trim()) {
      showFeedback('error', 'Project title is required.');
      return;
    }

    try {
      setIsSaving(true);
      const payload = {
        event_id: DEFAULT_EVENT_ID,
        team_id: team.id,
        track_id: projectTrack || (tracks[0] ? tracks[0].id : 'trk_01'),
        title: projectTitle.trim(),
        summary: projectSummary.trim(),
        repo_url: projectRepo.trim(),
      };

      await apiRequest('/api/projects', {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify(payload),
      });

      showFeedback(
        'success',
        action === 'submit'
          ? 'Project submitted successfully to DOGFOOD 2026!'
          : 'Project draft saved successfully!'
      );
      await fetchPortalData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center text-2xl font-bold">
          👤
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign In Required</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Please sign in as a <strong>Participant</strong> to manage your hackathon team, drafts, and project deliverables.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm font-mono transition shadow-sm"
        >
          Sign In as Participant →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-8 selection:bg-amber-500/20 selection:text-amber-300 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>PARTICIPANT WORKSPACE // DOGFOOD 2026</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Team & Project Submissions
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Logged in as <strong className="text-slate-900 dark:text-white">{currentUser.name}</strong> ({currentUser.email})
          </p>
        </div>

        <button
          onClick={onExploreGallery}
          className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-mono transition self-start sm:self-auto"
        >
          Browse Public Gallery →
        </button>
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

      {/* Grid: Left Column (Team Operations), Right Column (Project Submission Editor) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ================================================================ */}
        {/* 1. TEAM MANAGEMENT (1 Column)                                   */}
        {/* ================================================================ */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>👥</span>
              <span>Team Formation (1–4 Hackers)</span>
            </h2>

            {team ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Active Team</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white">{team.name}</div>
                  <div className="text-[11px] font-mono text-slate-500">ID: {team.id}</div>
                </div>

                {/* Team Roster */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Team Members ({members.length}/4)
                  </div>
                  <div className="space-y-1.5">
                    {members.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-lg bg-slate-100 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-200">{m.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">{m.email}</div>
                        </div>
                        {m.id === currentUser.id && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            YOU
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Generate Invite Link */}
                {members.length < 4 && (
                  <form onSubmit={handleGenerateInvite} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Invite Teammate via Link
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="teammate@example.com"
                        className="flex-1 px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={isSaving || !inviteEmail.trim()}
                        className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition whitespace-nowrap"
                      >
                        + Invite
                      </button>
                    </div>

                    {inviteLink && (
                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs font-mono">
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                          Share this 48h invite link:
                        </div>
                        <div className="p-2 rounded bg-white dark:bg-[#0f131c] border border-amber-500/30 text-[11px] text-slate-700 dark:text-slate-300 break-all select-all">
                          {inviteLink}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyInvite}
                          className="w-full py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition"
                        >
                          {copiedInvite ? '✓ Link Copied to Clipboard' : 'Copy Invite Link'}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  You are not currently in a team for DOGFOOD 2026. Create your team or ask your team leader for an invite link.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="e.g. Nightshift Vectors"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSaving || !newTeamName.trim()}
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs font-mono transition shadow-sm"
                >
                  Create Team →
                </button>
              </form>
            )}
          </div>

          {/* Submission Guidelines Reminder */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
              <span>⏱</span>
              <span>The One Command Rule</span>
            </div>
            <p className="leading-relaxed">
              All submitted repositories must start with <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#141824] text-amber-600 dark:text-amber-400 font-mono">docker compose up</code> on a laptop with zero cloud accounts.
            </p>
          </div>
        </div>

        {/* ================================================================ */}
        {/* 2. PROJECT SUBMISSION WORKSPACE (2 Columns)                      */}
        {/* ================================================================ */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span>🚀</span>
                  <span>Project Deliverable</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Draft and update your hackathon project before the submission deadline lock.
                </p>
              </div>

              {project && (
                <span
                  className={`text-xs font-mono px-3 py-1 rounded-full border self-start sm:self-auto ${
                    project.state === 'submitted'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  ● {project.state === 'submitted' ? 'SUBMITTED TO EVENT' : 'DRAFT IN PROGRESS'}
                </span>
              )}
            </div>

            <div className="space-y-5">
              {/* Title & Track Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Project Title *
                  </label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder="e.g. Glass Signal"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Competitive Track *
                  </label>
                  <select
                    value={projectTrack}
                    onChange={(e) => setProjectTrack(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    {tracks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary / Tagline */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Project Summary & Pitch *
                </label>
                <textarea
                  rows={4}
                  value={projectSummary}
                  onChange={(e) => setProjectSummary(e.target.value)}
                  placeholder="Describe your architecture, the problem it solves, how judges can run your code offline, and key innovation points..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Links Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Source Code Repository URL
                  </label>
                  <input
                    type="url"
                    value={projectRepo}
                    onChange={(e) => setProjectRepo(e.target.value)}
                    placeholder="https://github.com/..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Interactive Demo / Video Link
                  </label>
                  <input
                    type="url"
                    value={projectDemo}
                    onChange={(e) => setProjectDemo(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[11px] font-mono text-slate-500">
                  {project?.submitted_at
                    ? `Last saved at: ${new Date(project.submitted_at).toLocaleTimeString()}`
                    : 'Changes are preserved across sessions'}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleSaveProject('draft')}
                    disabled={isSaving || !team}
                    className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs transition"
                  >
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveProject('submit')}
                    disabled={isSaving || !team}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm"
                  >
                    {project?.state === 'submitted' ? 'Update Submission →' : 'Submit Project →'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

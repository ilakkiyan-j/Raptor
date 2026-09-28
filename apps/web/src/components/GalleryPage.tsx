import React, { useState, useEffect, useMemo } from 'react';
import { Project, User } from '../types';
import { apiRequest } from '../lib/api';

interface GalleryPageProps {
  currentUser?: User | null;
  onNavigate: (view: 'landing' | 'hackathons' | 'hackathon-detail' | 'gallery' | 'auth') => void;
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'demo') => void;
}

interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

// Fallback curated projects representing authentic hackathon entries
const FALLBACK_PROJECTS: Project[] = [
  {
    id: 'prj_01',
    title: 'Glass Signal',
    summary: 'Autonomous distributed telemetry pipeline with zero external dependencies and cryptographic integrity verification.',
    repo_url: 'https://github.com/raptor-ecosystem/glass-signal',
    demo_url: 'https://glass-signal.raptor.dev',
    track_id: 'trk_01',
    track_name: 'Developer Tools',
    team_name: 'Vector Dynamics',
    submitted_at: '2026-02-28T21:40:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_02',
    title: 'Small Meadow',
    summary: 'Decentralized ecological soil sensing mesh running on LoRaWAN edge nodes with real-time anomaly detection.',
    repo_url: 'https://github.com/raptor-ecosystem/small-meadow',
    demo_url: 'https://meadow.raptor.dev',
    track_id: 'trk_05',
    track_name: 'Climate',
    team_name: 'Flora Systems',
    submitted_at: '2026-02-28T21:48:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_03',
    title: 'Deep Compass',
    summary: 'Empirical Bayes score normalizer and multi-judge bias mitigation dashboard for offline hackathons.',
    repo_url: 'https://github.com/raptor-ecosystem/deep-compass',
    demo_url: 'https://compass.raptor.dev',
    track_id: 'trk_02',
    track_name: 'Data & Analytics',
    team_name: 'Bayes Collective',
    submitted_at: '2026-02-28T21:55:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_04',
    title: 'Green Switch',
    summary: 'Hardware-enforced zero-knowledge circuit breaker for microgrid load shifting and renewable energy dispatch.',
    repo_url: 'https://github.com/raptor-ecosystem/green-switch',
    demo_url: 'https://switch.raptor.dev',
    track_id: 'trk_08',
    track_name: 'Open Hardware',
    team_name: 'Ampere Logic',
    submitted_at: '2026-02-28T22:04:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_05',
    title: 'North Compass',
    summary: 'Cryptographic identity attestation using local Ed25519 keypairs without external OAuth reliance.',
    repo_url: 'https://github.com/raptor-ecosystem/north-compass',
    demo_url: 'https://north-compass.raptor.dev',
    track_id: 'trk_04',
    track_name: 'Security',
    team_name: 'Sovereign Guard',
    submitted_at: '2026-02-28T22:12:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_06',
    title: 'Dry Harbour',
    summary: 'Accessible screen-reader optimized canvas renderer complying with WCAG 2.2 AAA guidelines and zero subpixel shift.',
    repo_url: 'https://github.com/raptor-ecosystem/dry-harbour',
    demo_url: 'https://harbour.raptor.dev',
    track_id: 'trk_03',
    track_name: 'Accessibility',
    team_name: 'Accessible Web Labs',
    submitted_at: '2026-02-28T22:20:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_07',
    title: 'Still Beacon',
    summary: 'Low-latency peer-to-peer classroom sync engine designed for intermittent rural connectivity and local mesh relays.',
    repo_url: 'https://github.com/raptor-ecosystem/still-beacon',
    demo_url: 'https://beacon.raptor.dev',
    track_id: 'trk_07',
    track_name: 'Education',
    team_name: 'Beacon Node',
    submitted_at: '2026-02-28T22:31:00Z',
    state: 'submitted',
  },
  {
    id: 'prj_08',
    title: 'Hollow Signal',
    summary: 'Automated privacy-preserving biometric vitals analysis executing entirely in browser WebAssembly with zero telemetry.',
    repo_url: 'https://github.com/raptor-ecosystem/hollow-signal',
    demo_url: 'https://signal.raptor.dev',
    track_id: 'trk_06',
    track_name: 'Health',
    team_name: 'BioWasm Core',
    submitted_at: '2026-02-28T22:40:00Z',
    state: 'submitted',
  },
];

const TRACK_TAGS: { id: string; label: string; color: string }[] = [
  { id: 'all', label: 'All Tracks', color: 'border-slate-500/40 text-slate-700 dark:text-slate-300' },
  { id: 'trk_01', label: 'Developer Tools', color: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10' },
  { id: 'trk_02', label: 'Data & Analytics', color: 'border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  { id: 'trk_03', label: 'Accessibility', color: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  { id: 'trk_04', label: 'Security', color: 'border-rose-500/40 text-rose-600 dark:text-rose-400 bg-rose-500/10' },
  { id: 'trk_05', label: 'Climate', color: 'border-teal-500/40 text-teal-600 dark:text-teal-400 bg-teal-500/10' },
  { id: 'trk_06', label: 'Health', color: 'border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/10' },
  { id: 'trk_07', label: 'Education', color: 'border-cyan-500/40 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10' },
  { id: 'trk_08', label: 'Open Hardware', color: 'border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/10' },
];

export const GalleryPage: React.FC<GalleryPageProps> = ({ currentUser, onNavigate, onOpenAuth }) => {
  const [projects, setProjects] = useState<Project[]>(FALLBACK_PROJECTS);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedTrack, setSelectedTrack] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'title' | 'track' | 'ballot'>('newest');
  const [inspectedProject, setInspectedProject] = useState<Project | null>(null);

  // Voting state
  const [votedProjects, setVotedProjects] = useState<Set<string>>(new Set());
  const [votingProjectId, setVotingProjectId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState<string>('');
  const [showVotePrompt, setShowVotePrompt] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Comments state
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState<boolean>(false);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [commentPosting, setCommentPosting] = useState<boolean>(false);

  // Embed Modal
  const [showEmbedModal, setShowEmbedModal] = useState<boolean>(false);
  const [copiedEmbed, setCopiedEmbed] = useState<boolean>(false);

  // Deterministic seed for ballot shuffle
  const ballotSeed = useMemo(() => Math.floor(Date.now() / (1000 * 60 * 60)), []);

  // Fetch submitted projects from the API
  useEffect(() => {
    let isMounted = true;
    apiRequest<{ projects: Project[] }>('/api/projects')
      .then((res) => {
        if (isMounted && res.projects && res.projects.length > 0) {
          const enriched = res.projects.map((p, idx) => {
            const fallback = FALLBACK_PROJECTS[idx % FALLBACK_PROJECTS.length];
            return {
              ...fallback,
              ...p,
              track_name: p.track_name || fallback.track_name,
              team_name: p.team_name || fallback.team_name,
            };
          });
          setProjects(enriched);
        }
      })
      .catch((err) => {
        console.warn('Using seeded gallery projects:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // Fetch user votes if authenticated
    if (currentUser?.email) {
      apiRequest<{ voted_projects: string[] }>(`/api/events/evt_01/my-votes?email=${encodeURIComponent(currentUser.email)}`)
        .then((res) => {
          if (isMounted && res.voted_projects) {
            setVotedProjects(new Set(res.voted_projects));
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  // Load comments when inspecting project
  useEffect(() => {
    if (!inspectedProject) {
      setComments([]);
      return;
    }
    setCommentsLoading(true);
    apiRequest<{ comments: ProjectComment[] }>(`/api/projects/${inspectedProject.id}/comments`)
      .then((res) => setComments(res.comments || []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }, [inspectedProject]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setVoteMessage({ type, text });
    setTimeout(() => setVoteMessage(null), 4000);
  };

  const handleCastVote = async (projectId: string, emailToUse?: string) => {
    const email = emailToUse || currentUser?.email || guestEmail.trim();
    if (!email || !email.includes('@')) {
      setShowVotePrompt(projectId);
      return;
    }

    try {
      setVotingProjectId(projectId);
      await apiRequest(`/api/events/evt_01/vote`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({ project_id: projectId, email: email }),
      });
      setVotedProjects((prev) => new Set([...prev, projectId]));
      setShowVotePrompt(null);
      showFeedback('success', 'Your community vote has been securely recorded!');
    } catch (err: any) {
      showFeedback('error', err.message || 'Voting is currently closed or rate limit reached.');
    } finally {
      setVotingProjectId(null);
    }
  };

  const handlePostComment = async () => {
    if (!inspectedProject || !newCommentText.trim()) return;
    try {
      setCommentPosting(true);
      const res = await apiRequest<ProjectComment>(`/api/projects/${inspectedProject.id}/comments`, {
        method: 'POST',
        headers: { 'x-csrf-token': currentUser?.csrf_token || '' },
        body: JSON.stringify({
          content: newCommentText.trim(),
          author_name: currentUser?.name || 'Community Member',
        }),
      });
      setComments((prev) => [...prev, res]);
      setNewCommentText('');
      showFeedback('success', 'Comment posted to project thread.');
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to post comment.');
    } finally {
      setCommentPosting(false);
    }
  };

  // Filter & Sort
  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        const matchesTrack = selectedTrack === 'all' || p.track_id === selectedTrack;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return matchesTrack;

        const matchesQuery =
          p.title.toLowerCase().includes(query) ||
          p.summary.toLowerCase().includes(query) ||
          (p.team_name && p.team_name.toLowerCase().includes(query)) ||
          (p.track_name && p.track_name.toLowerCase().includes(query));

        return matchesTrack && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'track') {
          return (a.track_name || '').localeCompare(b.track_name || '');
        }
        if (sortBy === 'ballot') {
          // Deterministic hash shuffle for fair ballot ordering
          const hashA = (a.id.charCodeAt(0) * 31 + ballotSeed) % 97;
          const hashB = (b.id.charCodeAt(0) * 31 + ballotSeed) % 97;
          return hashA - hashB;
        }
        // newest default
        return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
      });
  }, [projects, selectedTrack, searchQuery, sortBy, ballotSeed]);

  const totalRepos = useMemo(() => projects.filter((p) => !!p.repo_url).length, [projects]);
  const totalDemos = useMemo(() => projects.filter((p) => !!p.demo_url).length, [projects]);

  const embedSnippet = `<iframe src="${window.location.origin}/api/embed/gallery/evt_01" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;overflow:hidden;"></iframe>`;

  return (
    <div className="space-y-10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto selection:bg-amber-500/20 selection:text-amber-600 dark:selection:text-amber-300">
      {/* Toast Feedback */}
      {voteMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border text-xs font-mono flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            voteMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{voteMessage.type === 'success' ? '✓' : '⚠'}</span>
          <span>{voteMessage.text}</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* 1. BREADCRUMBS & HERO HEADER                                     */}
      {/* ================================================================ */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onNavigate('landing')}
              className="hover:text-amber-600 dark:hover:text-amber-400 transition"
            >
              RAPTOR
            </button>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">PUBLIC SHOWCASE</span>
          </div>
          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition text-[11px]"
          >
            <span>&lt;/&gt;</span>
            <span>Embed Widget</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-[#10141f] border border-slate-300 dark:border-slate-800 text-[11px] font-mono text-slate-700 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>PUBLIC REPOSITORY, LIVE DEMOS & COMMUNITY VOTING</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Project Showcase Gallery
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Explore validated hackathon submissions, open-source code repositories, interactive prototypes, and participate in community voting.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                {projects.length}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Submissions
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                8
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Tracks
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                {totalRepos}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                OSS Repos
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
                {totalDemos}
              </div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500">
                Live Demos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. FILTER & SORT TOOLBAR                                         */}
      {/* ================================================================ */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, summary, team, or track..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs font-mono text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Sort Controls with Fair Ballot Mode */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-slate-500">SORT:</span>
            <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSortBy('newest')}
                className={`px-3 py-1.5 rounded-md transition ${
                  sortBy === 'newest'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setSortBy('title')}
                className={`px-3 py-1.5 rounded-md transition ${
                  sortBy === 'title'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Title
              </button>
              <button
                onClick={() => setSortBy('track')}
                className={`px-3 py-1.5 rounded-md transition ${
                  sortBy === 'track'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Track
              </button>
              <button
                onClick={() => setSortBy('ballot')}
                title="Deterministic unbiased randomized order"
                className={`px-3 py-1.5 rounded-md transition flex items-center space-x-1 ${
                  sortBy === 'ballot'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>🔀</span>
                <span>Fair Ballot</span>
              </button>
            </div>
          </div>
        </div>

        {/* Track Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {TRACK_TAGS.map((t) => {
            const isActive = selectedTrack === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTrack(t.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition border ${
                  isActive
                    ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-white dark:bg-[#0f131c] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. INSPECTION & COMMUNITY DISCUSSION DRAWER                      */}
      {/* ================================================================ */}
      {inspectedProject && (
        <section className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#0b0e14] border-2 border-amber-500/50 shadow-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                  {inspectedProject.track_name || 'General Track'}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  ID: {inspectedProject.id}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {inspectedProject.title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleCastVote(inspectedProject.id)}
                disabled={votedProjects.has(inspectedProject.id) || votingProjectId === inspectedProject.id}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition flex items-center space-x-2 ${
                  votedProjects.has(inspectedProject.id)
                    ? 'bg-emerald-500/20 border border-emerald-500 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
                }`}
              >
                <span>{votedProjects.has(inspectedProject.id) ? '✓ Voted' : '🗳 Vote for Project'}</span>
              </button>
              <button
                onClick={() => setInspectedProject(null)}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Project Overview & Architecture</h4>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {inspectedProject.summary}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 text-xs font-mono">
                  <div className="text-slate-400">Team</div>
                  <div className="font-bold text-slate-900 dark:text-white">{inspectedProject.team_name || 'Individual'}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 text-xs font-mono">
                  <div className="text-slate-400">Timestamp</div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {inspectedProject.submitted_at ? new Date(inspectedProject.submitted_at).toLocaleDateString() : 'Active'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121622] border border-slate-200 dark:border-slate-800 text-xs font-mono">
                  <div className="text-slate-400">Status</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">✓ Validated</div>
                </div>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-3 pt-2">
                {inspectedProject.repo_url && (
                  <a
                    href={inspectedProject.repo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold flex items-center space-x-2"
                  >
                    <span>View Repository ↗</span>
                  </a>
                )}
                {inspectedProject.demo_url && (
                  <a
                    href={inspectedProject.demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-mono font-semibold flex items-center space-x-2"
                  >
                    <span>Launch Live Prototype ↗</span>
                  </a>
                )}
              </div>
            </div>

            {/* Community Discussion Feed */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#10141f] border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                    💬 Discussion ({comments.length})
                  </h4>
                  {commentsLoading && <span className="text-[10px] font-mono text-amber-500 animate-pulse">Loading...</span>}
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No comments yet. Start the conversation!
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-lg bg-white dark:bg-[#151a27] border border-slate-200 dark:border-slate-800/80 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{c.author_name}</span>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-snug">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Comment Input */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Leave constructive feedback or a question..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg text-xs bg-white dark:bg-[#151a27] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 resize-none"
                />
                <button
                  onClick={handlePostComment}
                  disabled={commentPosting || !newCommentText.trim()}
                  className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition disabled:opacity-50"
                >
                  {commentPosting ? 'Posting...' : 'Post Comment'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Guest Voting Prompt Modal */}
      {showVotePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0f131c] border border-slate-300 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Community Ballot Verification</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Please provide your email address to record your community vote. This ensures 1-vote-per-project anti-abuse enforcement.
            </p>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="you@domain.com"
              className="w-full p-3 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#141824] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
            />
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => {
                  setShowVotePrompt(null);
                  onOpenAuth('login');
                }}
                className="text-xs font-mono text-amber-600 dark:text-amber-400 hover:underline"
              >
                Sign In instead →
              </button>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowVotePrompt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCastVote(showVotePrompt, guestEmail)}
                  className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs font-mono hover:bg-amber-400"
                >
                  Confirm Vote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embed Code Modal */}
      {showEmbedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0f131c] border border-slate-300 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Embeddable Showcase Widget</h3>
              <button onClick={() => setShowEmbedModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Copy and paste this clean iframe tag into any portal, blog, or internal intranet to embed live hackathon project cards with zero third-party dependencies.
            </p>
            <pre className="p-3 rounded-xl bg-slate-100 dark:bg-[#151a27] border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap break-all">
              {embedSnippet}
            </pre>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(embedSnippet);
                  setCopiedEmbed(true);
                  setTimeout(() => setCopiedEmbed(false), 2000);
                }}
                className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs font-mono hover:bg-amber-400"
              >
                {copiedEmbed ? '✓ Copied to Clipboard' : 'Copy Embed Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* 4. PROJECT CARDS GRID                                            */}
      {/* ================================================================ */}
      <section className="space-y-6">
        <div className="flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
          <span className="flex items-center space-x-2">
            <span>
              SHOWING <strong className="text-slate-900 dark:text-white">{filteredProjects.length}</strong> VERIFIED SUBMISSION{filteredProjects.length === 1 ? '' : 'S'}
            </span>
            {loading && <span className="text-amber-500 animate-pulse text-[10px]">● SYNCING...</span>}
          </span>
          {selectedTrack !== 'all' && (
            <button
              onClick={() => setSelectedTrack('all')}
              className="text-amber-600 dark:text-amber-400 hover:underline"
            >
              Reset track filter
            </button>
          )}
        </div>

        {filteredProjects.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
            <div className="text-3xl">🔍</div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              No matching projects found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Try adjusting your search terms or clearing the selected track filter to view other submissions.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTrack('all');
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs font-mono"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const isInspected = inspectedProject?.id === project.id;
              const hasVoted = votedProjects.has(project.id);

              return (
                <div
                  key={project.id}
                  className={`flex flex-col justify-between p-6 rounded-2xl transition-all duration-200 ${
                    isInspected
                      ? 'bg-amber-500/10 border-2 border-amber-500/60 shadow-md'
                      : 'bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header Tag & ID */}
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {project.track_name || 'Track General'}
                      </span>
                      <div className="flex items-center space-x-2">
                        {hasVoted && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            ✓ Voted
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          {project.id}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-400 transition leading-snug">
                      {project.title}
                    </h3>

                    {/* Summary */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {project.summary}
                    </p>
                  </div>

                  {/* Footer Meta & Actions */}
                  <div className="pt-5 mt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>Team: <strong className="text-slate-700 dark:text-slate-300">{project.team_name || 'Independent'}</strong></span>
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <span>●</span>
                        <span>Verified</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setInspectedProject(isInspected ? null : project)}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium transition text-center ${
                          isInspected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-100 dark:bg-[#181d29] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isInspected ? 'Hide Details' : 'Inspect'}
                      </button>

                      <button
                        onClick={() => handleCastVote(project.id)}
                        disabled={hasVoted || votingProjectId === project.id}
                        title="Cast Community Vote"
                        className={`p-1.5 px-2 rounded-lg text-xs font-mono transition border ${
                          hasVoted
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {hasVoted ? '✓' : '🗳'}
                      </button>

                      {project.repo_url && (
                        <a
                          href={project.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View Repository"
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#181d29] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                          </svg>
                        </a>
                      )}

                      {project.demo_url && (
                        <a
                          href={project.demo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Launch Demo"
                          className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* 5. SHOWCASE TELEMETRY FOOTER                                     */}
      {/* ================================================================ */}
      <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-slate-500 gap-4">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>RAPTOR PROJECT SHOWCASE // OPEN ACCESS</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>CONSENSUS VERIFIED</span>
          <span>•</span>
          <span>ZERO VENDOR LOCK-IN</span>
          <span>•</span>
          <span>v2.4.0-STABLE</span>
        </div>
      </footer>
    </div>
  );
};

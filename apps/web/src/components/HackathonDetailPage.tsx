import React, { useState } from 'react';
import { HackathonItem, User } from '../types';
import { RaptorLogo } from './RaptorLogo';

interface HackathonDetailPageProps {
  hackathon: HackathonItem;
  currentUser?: User | null;
  onBack: () => void;
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'demo') => void;
  onExploreGallery: () => void;
  onNavigate?: (view: any) => void;
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to execCommand
    }
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed', err);
    return false;
  }
};

export const HackathonDetailPage: React.FC<HackathonDetailPageProps> = ({
  hackathon,
  currentUser,
  onBack,
  onOpenAuth,
  onExploreGallery,
  onNavigate,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/#hackathon-${hackathon.id}`;
  const shareTitle = `${hackathon.name} on Raptor Platform`;
  const shareText = `Check out ${hackathon.name}: "${hackathon.tagline}" on Raptor! Prize pool: ${hackathon.prizePool}.`;

  const showToast = (text: string) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopiedLink(true);
      showToast('Event link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        showToast('Shared successfully!');
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  const handleShareClick = () => {
    setShowShareModal(true);
    handleCopyLink();
  };

  const handleRoleAction = () => {
    if (!currentUser) {
      onOpenAuth('demo');
      return;
    }
    const role = currentUser.roles?.[0]?.role?.toLowerCase();
    if (role === 'participant' && onNavigate) {
      onNavigate('participant');
    } else if (role === 'judge' && onNavigate) {
      onNavigate('judge');
    } else if ((role === 'organizer' || role === 'admin') && onNavigate) {
      onNavigate('organizer');
    } else {
      onOpenAuth('demo');
    }
  };

  const role = currentUser?.roles?.[0]?.role?.toLowerCase();
  const actionButtonText = !currentUser
    ? 'Enter Hackathon →'
    : role === 'participant'
    ? 'Go to My Team & Submissions →'
    : role === 'judge'
    ? 'Go to Judge Workspace →'
    : 'Go to Organizer Console →';

  const embedCode = `<iframe src="${window.location.origin}/api/embed/gallery/${hackathon.id}" width="100%" height="600" frameborder="0" style="border:none;border-radius:12px;overflow:hidden;"></iframe>`;

  return (
    <div className="space-y-12 py-8 selection:bg-amber-500/20 selection:text-amber-600 dark:selection:text-amber-300 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#151a27] text-slate-900 dark:text-white font-mono text-xs font-bold shadow-2xl border border-slate-300 dark:border-slate-700 flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-emerald-700 dark:text-emerald-400">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center space-x-3 text-xs">
          <button
            onClick={onBack}
            className="group flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0f131c] hover:bg-slate-200 dark:hover:bg-[#181c26] border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition font-mono"
          >
            <span className="group-hover:-translate-x-0.5 transition">←</span>
            <span>Back to Hackathons</span>
          </button>
          <span className="text-slate-400 dark:text-slate-600">/</span>
          <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate max-w-[200px] sm:max-w-none">
            {hackathon.name} ({hackathon.id})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleShareClick}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 dark:bg-[#0f131c] hover:bg-slate-200 dark:hover:bg-[#181c26] border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition font-mono font-medium shadow-sm"
            title="Share Hackathon Event"
          >
            <svg className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>{copiedLink ? 'Link Copied!' : 'Share Event'}</span>
          </button>

          <button
            onClick={handleRoleAction}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm"
          >
            {actionButtonText}
          </button>
        </div>
      </div>

      {/* Share Event Modal Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#0f131c] border border-slate-300 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                  <span>SHARE EVENT</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Share {hackathon.name}
                </h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                ✕
              </button>
            </div>

            {/* Direct Link Input */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-500 uppercase">Direct Event Link</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 p-2.5 rounded-xl text-xs font-mono bg-slate-50 dark:bg-[#141824] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:outline-none select-all"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
                >
                  {copiedLink ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Native Device Share (Mobile / Supported Browsers) */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs font-mono transition flex items-center justify-center space-x-2"
              >
                <span>📱 Share via System Share Sheet</span>
              </button>
            )}

            {/* Quick Social Channels */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-bold text-slate-500 uppercase">Share to Socials & Chat</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-mono">
                {/* 𝕏 / Twitter */}
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="font-bold text-sm">𝕏</span>
                  <span className="text-[10px] text-slate-500">Twitter</span>
                </a>

                {/* LinkedIn */}
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="font-bold text-sm text-sky-700 dark:text-sky-400">in</span>
                  <span className="text-[10px] text-slate-500">LinkedIn</span>
                </a>

                {/* WhatsApp */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="text-sm text-emerald-700 dark:text-emerald-400">💬</span>
                  <span className="text-[10px] text-slate-500">WhatsApp</span>
                </a>

                {/* Telegram */}
                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="text-sm text-cyan-700 dark:text-cyan-400">✈️</span>
                  <span className="text-[10px] text-slate-500">Telegram</span>
                </a>

                {/* Reddit */}
                <a
                  href={`https://reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareTitle)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="text-sm text-amber-700 dark:text-amber-400">🤖</span>
                  <span className="text-[10px] text-slate-500">Reddit</span>
                </a>

                {/* Email */}
                <a
                  href={`mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(shareText + '\n\n' + shareUrl)}`}
                  className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#141824] hover:bg-slate-200 dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 transition flex flex-col items-center justify-center space-y-1"
                >
                  <span className="text-sm text-slate-600">✉️</span>
                  <span className="text-[10px] text-slate-500">Email</span>
                </a>
              </div>
            </div>

            {/* Embed Widget Snippet */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="font-bold text-slate-500 uppercase">Embed Gallery Widget</span>
                <button
                  onClick={async () => {
                    const success = await copyToClipboard(embedCode);
                    if (success) {
                      setCopiedEmbed(true);
                      showToast('Embed code copied!');
                      setTimeout(() => setCopiedEmbed(false), 2000);
                    }
                  }}
                  className="text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {copiedEmbed ? '✓ Copied' : 'Copy HTML'}
                </button>
              </div>
              <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Hero Showcase Card */}
      <div className="rounded-3xl bg-gradient-to-br from-[#121622] via-[#0f131c] to-[#0a0e16] border border-slate-800 p-6 sm:p-10 space-y-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-4 relative z-10 max-w-4xl">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-mono px-3 py-1 rounded-full border ${hackathon.statusColor}`}>
              ● {hackathon.statusLabel}
            </span>
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-[#181c24] text-slate-400 border border-slate-800">
              EVENT ID: {hackathon.id}
            </span>
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              AIR-GAPPED COMPLIANT
            </span>
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              OPEN SOURCE
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight">
            {hackathon.name}
          </h1>

          <p className="text-base sm:text-xl font-medium text-amber-300 font-mono">
            "{hackathon.tagline}"
          </p>

          <p className="text-xs sm:text-base text-slate-300 leading-relaxed max-w-3xl">
            {hackathon.description}
          </p>
        </div>

        {/* Primary Action Toolbar */}
        <div className="pt-2 flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={handleRoleAction}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm font-mono transition shadow-lg amber-glow"
          >
            {actionButtonText}
          </button>
          <button
            onClick={onExploreGallery}
            className="px-6 py-3 rounded-xl bg-[#141824] hover:bg-[#1a2030] text-slate-200 border border-slate-700 text-xs sm:text-sm font-medium transition flex items-center space-x-2"
          >
            <span>Explore {hackathon.submissionCount} Submissions</span>
            <span className="text-slate-400">→</span>
          </button>
          <span className="text-xs font-mono text-slate-500 sm:ml-auto">
            Zero cloud external dependencies · Self-hostable
          </span>
        </div>
      </div>

      {/* 4 Stat Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase text-slate-500">Total Prize Pool</div>
          <div className="text-2xl font-black text-white">{hackathon.prizePool}</div>
          <div className="text-[11px] text-amber-400/90 font-mono">5 Tier Awards + Special Bounties</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase text-slate-500">Competitive Tracks</div>
          <div className="text-2xl font-black text-indigo-400">{hackathon.tracks.length} Tracks</div>
          <div className="text-[11px] text-slate-400 font-mono">Multi-discipline evaluation</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase text-slate-500">Seeded Submissions</div>
          <div className="text-2xl font-black text-emerald-400">{hackathon.submissionCount} Projects</div>
          <div className="text-[11px] text-emerald-400/90 font-mono">Verified repository payloads</div>
        </div>
        <div className="p-5 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-1">
          <div className="text-[10px] font-mono uppercase text-slate-500">Team Size</div>
          <div className="text-2xl font-black text-purple-400">1 to 4 People</div>
          <div className="text-[11px] text-slate-400 font-mono">Solo hackers welcome</div>
        </div>
      </div>

      {/* Official Timeline Milestones (Visual Stepper) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <span>⏱</span>
              <span>Official Event Timeline (UTC)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict cryptographic timestamp enforcement. Late submissions are automatically rejected by API.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#141824] text-slate-300 border border-slate-800 self-start sm:self-auto">
            ALL DATES IN UTC
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Milestone 1 */}
          <div className="p-5 rounded-xl bg-[#141824] border border-slate-800/80 space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 uppercase">Phase 01 // Kickoff</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">
                COMPLETED
              </span>
            </div>
            <div className="text-sm font-bold text-white">{hackathon.kickoffDate}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hacking period commences. Repositories created and team formation begins.
            </p>
          </div>

          {/* Milestone 2 */}
          <div className="p-5 rounded-xl bg-[#141824] border border-slate-800/80 space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 uppercase">Phase 02 // Freeze</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 text-[10px]">
                DEADLINE LOCK
              </span>
            </div>
            <div className="text-sm font-bold text-white">{hackathon.deadlineDate}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Submission drafts lock. Backend rejects any subsequent modification attempts.
            </p>
          </div>

          {/* Milestone 3 */}
          <div className="p-5 rounded-xl bg-[#141824] border border-amber-500/30 space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 uppercase font-semibold">Phase 03 // Judging</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 text-[10px] animate-pulse">
                ACTIVE
              </span>
            </div>
            <div className="text-sm font-bold text-white">{hackathon.judgingCloseDate}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Peer-isolated review batches, 1–5 rubric scoring, and Modified Z-Score normalization.
            </p>
          </div>

          {/* Milestone 4 */}
          <div className="p-5 rounded-xl bg-[#141824] border border-slate-800/80 space-y-2 relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 uppercase">Phase 04 // Winners</span>
              <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px]">
                UPCOMING
              </span>
            </div>
            <div className="text-sm font-bold text-white">{hackathon.winnersDate}</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Official winner roster published, CSV audit exports generated, and winning code forked.
            </p>
          </div>
        </div>
      </div>

      {/* Competitive Tracks Section */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>🎯</span>
            <span>Competitive Tracks ({hackathon.tracks.length})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Projects must register under one primary competitive track for domain-expert evaluation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {hackathon.tracks.map((track) => (
            <div
              key={track.id}
              className="p-4 rounded-xl bg-[#0f131c] border border-slate-800 hover:border-slate-700 transition space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-indigo-400 uppercase px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  {track.id}
                </span>
                <span className="text-[10px] font-mono text-slate-500">Track</span>
              </div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                {track.name}
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Specialized evaluation criteria, balanced judge distribution, and category honors.
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Prize Pool Breakdown Matrix */}
      <div className="space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <span>🏆</span>
            <span>Prize Distribution Matrix ({hackathon.prizePool})</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            All monetary bounties and honors awarded based on peer-isolated consensus results.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hackathon.prizes.map((prize, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-[#0f131c] border border-slate-800 hover:border-amber-500/40 transition space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-amber-400 font-extrabold px-2.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {prize.rank}
                </span>
                <span className="text-lg font-black text-white font-mono">
                  {prize.amount}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{prize.title}</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {prize.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation Rubric & Core Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rubric Card */}
        <div className="p-6 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>⚖️</span>
              <span>Weighted Evaluation Rubric</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              1–5 scale normalized with Modified Z-Score algorithm to prevent judge bias.
            </p>
          </div>

          <div className="space-y-2.5">
            {hackathon.rubric.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0a0e16] border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div className="space-y-0.5 pr-4">
                  <div className="font-semibold text-slate-200">{item.criterion}</div>
                  <div className="text-[11px] text-slate-500">{item.description}</div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 whitespace-nowrap">
                  {item.weight}
                </span>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-xl bg-[#141824] border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-amber-400 font-semibold">Bias Elimination Guarantee:</div>
            <div>Uniform judge variance floor: max(σ_j, 0.25)</div>
            <div>Anchor scaling maps relative distributions back onto intuitive 0–100% ranges.</div>
          </div>
        </div>

        {/* Rules Card */}
        <div className="p-6 rounded-2xl bg-[#0f131c] border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>📜</span>
              <span>Eligibility & Competition Rules</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Compliance with open source and offline air-gapped standards is mandatory.
            </p>
          </div>

          <ul className="space-y-3">
            {hackathon.rules.map((rule, idx) => (
              <li
                key={idx}
                className="p-3 rounded-xl bg-[#0a0e16] border border-slate-800/80 flex items-start space-x-3 text-xs text-slate-300"
              >
                <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 font-mono flex items-center justify-center flex-shrink-0 text-[11px] mt-0.5 font-bold">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{rule}</span>
              </li>
            ))}
          </ul>

          <div className="p-3.5 rounded-xl bg-[#141824] border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
            <div className="text-emerald-400 font-semibold">The One Command Rule:</div>
            <div>"docker compose up" boots a fully working, seeded portal on a laptop with Wi-Fi off.</div>
          </div>
        </div>
      </div>

      {/* Bottom Action Banner */}
      <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#141824] via-[#0f131c] to-[#0a0e16] border border-amber-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl font-bold text-white">Ready to participate in {hackathon.name}?</h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl leading-relaxed">
            Form your team, draft your submission, and test your air-gapped deployment before the deadline freeze.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onOpenAuth('demo')}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            Enter Hackathon Now →
          </button>
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl bg-[#0f131c] hover:bg-[#181c26] text-slate-300 border border-slate-800 text-xs font-mono transition whitespace-nowrap"
          >
            ← View All Hackathons
          </button>
        </div>
      </div>

      {/* Standard Telemetry Footer */}
      <footer className="border-t border-slate-800/80 pt-10 pb-8 text-xs text-slate-500 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <RaptorLogo size={24} />
            <span className="font-extrabold text-slate-300">RAPTOR</span>
            <span className="text-[10px] font-mono text-slate-600">v2.4.0-STABLE</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-mono text-slate-400">
            <span>EVENT: {hackathon.id}</span>
            <span>STATUS: OPERATIONAL</span>
            <span>RAPTOR OS // v2.4.0-STABLE</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 text-center sm:text-left">
          "Build the platform that will judge you." · Open-source hackathon submission and judging engine. 
          Apache-2.0 License.
        </p>
      </footer>
    </div>
  );
};

import React, { useState } from 'react';
import { Project } from '../types';
import { RaptorLogo } from './RaptorLogo';

interface LandingPageProps {
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'demo') => void;
  onExploreGallery: () => void;
  onExploreHackathons: () => void;
  onSelectProject?: (project: Project) => void;
  onSelectRoleDemo?: (token: string, role: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onOpenAuth,
  onExploreGallery,
  onExploreHackathons,
  onSelectRoleDemo,
}) => {
  // Interactive Hero Preview state
  const [demoScore, setDemoScore] = useState(4);
  const [copiedDocker, setCopiedDocker] = useState(false);

  // Active Role tab in Section 7
  const [activeRole, setActiveRole] = useState<'participant' | 'judge' | 'organizer' | 'admin' | 'visitor'>('judge');

  const handleCopyDocker = () => {
    navigator.clipboard.writeText('docker compose up --build');
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  return (
    <div className="space-y-20 py-8 selection:bg-amber-500/20 selection:text-amber-300">
      {/* ================================================================ */}
      {/* 1. HERO SECTION                                                  */}
      {/* ================================================================ */}
      <section className="relative text-center max-w-5xl mx-auto space-y-8 pt-4">
        {/* Telemetry pill */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-slate-100 dark:bg-[#10141f] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400">
            ENTERPRISE HACKATHON PLATFORM // PRODUCTION READY
          </span>
        </div>

        {/* Main Headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Build. Submit. Judge.
          </h1>
          <p className="text-lg sm:text-2xl text-slate-600 dark:text-slate-300 font-medium max-w-3xl mx-auto leading-relaxed">
            The open-source, self-hostable platform <br className="hidden sm:inline" />
            built specifically for hackathons.
          </p>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Multi-dimensional weighted rubrics, verifiable score normalization, peer isolation, and one-command sovereign deployment.
          </p>
        </div>

        {/* Hero CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onOpenAuth('register')}
            className="px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg amber-glow font-mono flex items-center space-x-2"
          >
            <span>Start a Hackathon</span>
            <span>→</span>
          </button>
          <button
            onClick={onExploreGallery}
            className="px-6 py-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#141824] dark:hover:bg-[#1a2030] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/80 font-medium text-xs sm:text-sm transition flex items-center space-x-2"
          >
            <span>Explore Public Gallery</span>
            <span>↗</span>
          </button>
        </div>

        {/* Quick CLI One-Liner */}
        <div className="pt-2">
          <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-lg bg-slate-100 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400 shadow-inner">
            <span className="text-amber-500 select-none">$</span>
            <span className="text-slate-800 dark:text-slate-200">docker compose up --build</span>
            <button
              onClick={handleCopyDocker}
              className="text-amber-500 hover:text-amber-600 dark:hover:text-amber-300 transition text-[11px] uppercase font-semibold pl-2 border-l border-slate-300 dark:border-slate-700"
            >
              {copiedDocker ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Hero Interactive Preview Mockup: The Cockpit */}
        <div className="pt-6 max-w-4xl mx-auto">
          <div className="rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden text-left relative">
            {/* Window Title Bar */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#0a0e16] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-3">
                  raptor-cockpit // interactive preview
                </span>
              </div>
              <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span>DEMO DATA - NOT LIVE</span>
              </div>
            </div>

            {/* Dashboard Content Mockup */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Telemetry Stat Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Prize Pool</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">$2,500 USD</div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono mt-0.5">5 Tier Awards</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Submissions</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">Team submissions</div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">Deadline controls</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Assigned Judges</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">Judge assignments</div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">Role Isolated</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] uppercase font-mono text-slate-500">Consensus Engine</div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">Empirical Bayes</div>
                  <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">Score normalization</div>
                </div>
              </div>

              {/* Interactive Rubric Simulator Card */}
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800/90 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      INTERACTIVE EVALUATION PREVIEW
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                      Project #14: Glass Signal (Vector Dynamics)
                    </h3>
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Track: <span className="text-slate-800 dark:text-slate-200">Developer Tools</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">1. Technical Execution (40%)</span>
                        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{demoScore} / 5</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        value={demoScore}
                        onChange={(e) => setDemoScore(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">2. Judging Integrity (25%)</span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">5 / 5</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-indigo-500 w-full" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-700 dark:text-slate-300 font-medium">3. Architecture & Resiliency (20%)</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">4 / 5</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden">
                        <div className="h-full bg-emerald-500 w-4/5" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5 rounded-lg bg-white dark:bg-[#141824] border border-slate-200 dark:border-slate-800 font-mono text-xs">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                      Empirical Bayes Shrinkage Preview
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Raw Mean:</span>
                      <span className="text-slate-900 dark:text-white font-bold">{((demoScore * 0.4) + (5 * 0.25) + (4 * 0.2) + 0.5).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Judge Variance:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">σ² = 0.14 (Calibrated)</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">Normalized Result:</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{(demoScore * 0.85 + 0.6).toFixed(2)} / 5.0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 2. THE PROBLEM                                                   */}
      {/* ================================================================ */}
      <section id="section-problem" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-rose-500 dark:text-rose-400">
            The Industry Bottleneck
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hackathon platforms stopped evolving.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Every existing platform converged on the same nine features and stopped. 
            Organizers are left stitching together fragile spreadsheets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-mono font-bold text-sm">
              01
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Limited Judging Configuration</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Market leaders cannot weight judging criteria. They force all categories into identical 
              1-to-5 scales, completely ignoring that architecture and correctness outrank superficial design.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-mono font-bold text-sm">
              02
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Unclear Score Normalization</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Platforms claim "normalization," but none document the algorithm. A harsh judge who awards 2s 
              destroys a team's chances compared to a generous peer awarding 5s across the board.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-mono font-bold text-sm">
              03
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Community Voting Challenges</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Public voting is treated as unfixable. Discord links and unauthenticated polls invite Sybil attacks, 
              ballot stuffing, and popularity contests rather than objective project evaluation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center font-mono font-bold text-sm">
              04
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Public API or Extensibility</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Walled gardens with zero webhook triggers. You cannot automate repo checks, feed telemetry into 
              bots, or run air-gapped events without dependable internet connectivity.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3. THE RAPTOR APPROACH                                           */}
      {/* ================================================================ */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-amber-500 dark:text-amber-400">
            Unified Architecture
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            The Raptor Approach
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            One platform. The entire hackathon lifecycle.
          </p>
        </div>

        {/* Comparison Visual: Legacy vs Raptor */}
        <div className="rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Legacy stack */}
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800/80 space-y-3">
              <div className="text-[11px] font-mono text-rose-500 uppercase font-semibold">
                Fragmented Legacy Stack
              </div>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="text-rose-500">✕</span>
                  <span>Google Forms for team registrations</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-rose-500">✕</span>
                  <span>Opaque cloud portal for project uploads</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-rose-500">✕</span>
                  <span>Manual Google Sheets for judge scoring</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-rose-500">✕</span>
                  <span>Internet dependency — fails when Wi-Fi drops</span>
                </li>
              </ul>
            </div>

            {/* Raptor Unified OS */}
            <div className="p-5 rounded-xl bg-amber-50/50 dark:bg-[#141824] border border-amber-500/30 space-y-3">
              <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 uppercase font-semibold">
                Raptor Unified Core
              </div>
              <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-2">
                <li className="flex items-center space-x-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Integrated team formation with shareable invite links</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Draft editing & strict backend deadline enforcement</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Verifiable score normalization (Z-score & Empirical Bayes)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>100% self-hosted & offline resilient readiness</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 4. HACKATHON LIFECYCLE                                           */}
      {/* ================================================================ */}
      <section id="section-lifecycle" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-emerald-500 dark:text-emerald-400">
            Step-By-Step Workflow
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Hackathon Lifecycle
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            A cohesive journey from initial event configuration to verified winner announcement.
          </p>
        </div>

        {/* 4 Horizontal Stepper Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 relative group hover:border-amber-500/40 transition shadow-sm">
            <div className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">01 // CREATE</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Event & Tracks</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure event dates, define competitive tracks, assign prize tiers, and customize criteria rubrics.
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Output: Event Manifest + Rules
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 relative group hover:border-amber-500/40 transition shadow-sm">
            <div className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">02 // SUBMIT</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Team & Drafts</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Assemble teams via invite code, draft submissions with repo URLs, and lock projects before deadline freeze.
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Output: Immutable Submission
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 relative group hover:border-amber-500/40 transition shadow-sm">
            <div className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">03 // JUDGE</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Scoring Engine</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Balanced judge assignments, strict peer isolation, 1–5 rubric sliders, and mathematical normalization.
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Output: Normalized Ballots
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 relative group hover:border-amber-500/40 transition shadow-sm">
            <div className="text-xs font-mono font-bold text-amber-500 dark:text-amber-400">04 // PUBLISH</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Showcase & CSV</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Instant public leaderboard generation, searchable project gallery, and one-click cryptographic CSV exports.
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Output: Winner Roster + CSV
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 5. JUDGING ENGINE                                                */}
      {/* ================================================================ */}
      <section id="section-judging" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-amber-500 dark:text-amber-400">
            Scientific Consensus
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            "Judging shouldn't be a black box."
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Raptor eliminates unfair judging bias with transparent, reproducible mathematics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-amber-500 dark:text-amber-400 uppercase">Feature 01</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Weighted Rubrics</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure floating-point multipliers for each criterion (e.g. Correctness 40%, Architecture 30%, UX 20%, Innovation 10%).
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-amber-500 dark:text-amber-400 uppercase">Feature 02</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Judge Assignment</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Greedy balanced auto-assigner matches judges to their preferred tracks while strictly eliminating conflicts of interest.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-emerald-500 uppercase">Feature 03</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Role Isolation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Enforced in the backend API (HTTP 403 Forbidden). Peer judges cannot inspect other judges' scores until the window closes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-amber-500 dark:text-amber-400 uppercase">Feature 04</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Score Normalization</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose between Modified Z-Score with scale anchoring or Empirical Bayes shrinkage with sequential ranking.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-amber-500 dark:text-amber-400 uppercase">Feature 05</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Progress Tracking</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Real-time organizer cockpit monitoring ballot completion percentages and identifying stalled review batches.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="text-xs font-mono text-emerald-500 uppercase">Feature 06</div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">CSV Export</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              One-click raw and normalized CSV downloads verified by automated consensus audit suites.
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 6. PUBLIC HACKATHON EXPERIENCE / GALLERY PREVIEW                 */}
      {/* ================================================================ */}
      <section id="section-gallery" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="text-xs uppercase font-mono tracking-wider text-indigo-500 dark:text-indigo-400">
              Public Engagement
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
              Project Showcase & Gallery
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Discover verified project submissions, open-source repositories, and evaluated prototypes.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onExploreGallery}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition shadow-sm font-mono"
            >
              Open Full Gallery →
            </button>
          </div>
        </div>

        {/* 3 Sample Fixture Cards Preview (Clean light and dark surface) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div
            onClick={onExploreGallery}
            className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 space-y-3 cursor-pointer transition shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                Developer Tools
              </span>
              <span className="text-[10px] font-mono text-slate-400">prj_01</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition">
              Glass Signal
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              Autonomous distributed telemetry pipeline with zero external dependencies and air-gapped cryptographic integrity.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Team: <strong className="text-slate-700 dark:text-slate-300">Vector Dynamics</strong></span>
              <span className="text-amber-500 group-hover:translate-x-0.5 transition">Explore →</span>
            </div>
          </div>

          <div
            onClick={onExploreGallery}
            className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 space-y-3 cursor-pointer transition shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                Climate
              </span>
              <span className="text-[10px] font-mono text-slate-400">prj_02</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition">
              Small Meadow
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              Decentralized ecological soil sensing mesh running on LoRaWAN edge nodes with real-time anomaly detection.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Team: <strong className="text-slate-700 dark:text-slate-300">Flora Systems</strong></span>
              <span className="text-amber-500 group-hover:translate-x-0.5 transition">Explore →</span>
            </div>
          </div>

          <div
            onClick={onExploreGallery}
            className="p-5 rounded-xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 space-y-3 cursor-pointer transition shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                Data & Analytics
              </span>
              <span className="text-[10px] font-mono text-slate-400">prj_03</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition">
              Deep Compass
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
              Empirical Bayes score normalizer and multi-judge bias mitigation dashboard for sovereign hackathons.
            </p>
            <div className="pt-2 flex items-center justify-between text-xs text-slate-500">
              <span>Team: <strong className="text-slate-700 dark:text-slate-300">Bayes Collective</strong></span>
              <span className="text-amber-500 group-hover:translate-x-0.5 transition">Explore →</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 7. BUILT FOR EVERY ROLE                                          */}
      {/* ================================================================ */}
      <section id="section-roles" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-amber-500 dark:text-amber-400">
            Tailored Experiences
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Built for Every Role
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Raptor provides focused, distraction-free workspaces for every stakeholder.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(['participant', 'judge', 'organizer', 'admin', 'visitor'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition ${
                activeRole === role
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Active Role Card View */}
        <div className="p-8 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          {activeRole === 'participant' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-emerald-500 dark:text-emerald-400 text-xs font-mono font-semibold">
                <span>●</span>
                <span>PARTICIPANT WORKSPACE</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Build with peace of mind.</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Generate instant team invite links to assemble 1 to 4 members. Save your project drafts, 
                update demo URLs and repos, and submit with cryptographic timestamping before deadline lock.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => onSelectRoleDemo ? onSelectRoleDemo('demo-pt-d7f97ed29e331c278823c9361109a54e', 'participant') : onOpenAuth('demo')}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-50 dark:text-slate-950 text-xs font-medium"
                >
                  Launch Participant Demo →
                </button>
              </div>
            </div>
          )}

          {activeRole === 'judge' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-indigo-500 dark:text-indigo-400 text-xs font-mono font-semibold">
                <span>●</span>
                <span>JUDGE SCORING COCKPIT</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Distraction-free, blind evaluation.</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Evaluators only see assigned projects matching their track expertise. Interactive 1–5 
                rubric sliders, private commentary, and verified backend peer isolation prevent groupthink.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => onSelectRoleDemo ? onSelectRoleDemo('demo-ja-c9e380efa065eb7f8187b4da697a180a', 'judge') : onOpenAuth('demo')}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-slate-50 text-xs font-medium"
                >
                  Launch Judge Demo →
                </button>
              </div>
            </div>
          )}

          {activeRole === 'organizer' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-amber-500 dark:text-amber-400 text-xs font-mono font-semibold">
                <span>●</span>
                <span>ORGANIZER OPERATIONS CENTER</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Complete event governance and live metrics.</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Trigger greedy balanced judge assignments, monitor real-time completion velocity, 
                compare Modified Z-Score vs Empirical Bayes leaderboard models, and export CSVs.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => onSelectRoleDemo ? onSelectRoleDemo('demo-org-29ced468c7410afa403da3619178b380', 'organizer') : onOpenAuth('demo')}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs"
                >
                  Launch Organizer Demo →
                </button>
              </div>
            </div>
          )}

          {activeRole === 'admin' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-purple-500 dark:text-purple-400 text-xs font-mono font-semibold">
                <span>●</span>
                <span>SYSTEM ADMINISTRATOR</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Full infrastructure autonomy.</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Self-host anywhere with zero external dependencies. Manage SQLite/PostgreSQL databases, 
                inspect raw server logs, trigger database migrations, and maintain complete offline integrity.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => onSelectRoleDemo ? onSelectRoleDemo('demo-adm-8849b2c31e9f1a23', 'admin') : onOpenAuth('demo')}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-50 text-xs font-medium"
                >
                  Launch Admin Demo →
                </button>
              </div>
            </div>
          )}

          {activeRole === 'visitor' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 text-sky-500 dark:text-sky-400 text-xs font-mono font-semibold">
                <span>●</span>
                <span>PUBLIC VISITOR</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Unrestricted showcase exploration.</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Browse submitted projects without an account, filter by track or keyword, 
                inspect repositories and live demos, and review the competitive prize pool.
              </p>
              <div className="pt-2 flex gap-3">
                <button
                  onClick={onExploreGallery}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-50 dark:text-slate-950 text-xs font-semibold shadow-sm transition"
                >
                  Open Public Gallery →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================ */}
      {/* 8. OPEN SOURCE + SELF HOSTED                                     */}
      {/* ================================================================ */}
      <section id="section-opensource" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-amber-500 dark:text-amber-400">
            Sovereign Infrastructure
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Your hackathon. Your infrastructure.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Open source • Self-hostable • Offline ready
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">The One-Command Rule</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Raptor boots a complete, seeded, fully working portal with zero external cloud accounts. Run locally or in production with Docker.
            </p>
            {/* Polished Terminal Window Frame with Copy */}
            <div className="dark-isolate rounded-xl bg-slate-900 border border-slate-700/80 overflow-hidden shadow-inner font-mono text-xs">
              <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                  <span className="ml-2 text-slate-400">local-terminal</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold">ONE COMMAND</span>
              </div>
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-200">
                  <span className="text-amber-400 select-none">$</span>
                  <span className="text-slate-100 font-semibold">docker compose up --build</span>
                </div>
                <button
                  onClick={handleCopyDocker}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-amber-400 border border-slate-700 transition uppercase font-semibold"
                >
                  {copiedDocker ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition"
              >
                View on GitHub →
              </a>
              <button
                onClick={() => onOpenAuth('demo')}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition"
              >
                Launch Demo →
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resilient & Self-Contained</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Venues often experience congested Wi-Fi. Raptor operates in pure local mode: 
              local SQLite database, embedded assets, and local HTTP ingress.
            </p>
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-2 font-mono">
              <li className="flex items-center space-x-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Zero hosted databases required</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>Zero external auth providers</span>
              </li>
              <li className="flex items-center space-x-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>OSI approved MIT / Apache-2.0 License</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 9. API / EXTENSIBILITY                                           */}
      {/* ================================================================ */}
      <section className="max-w-5xl mx-auto space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="text-xs uppercase font-mono tracking-wider text-indigo-500 dark:text-indigo-400">
            Developer Ecosystem
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Build around your hackathon.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            REST API • Webhooks • Embeddable Gallery • Bulk Import / Export
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 font-bold text-slate-700 dark:text-slate-300">REST API SPECIFICATION (OPENAPI 3.1)</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">HTTP/1.1 JSON READY</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800/80 space-y-2.5 text-slate-700 dark:text-slate-300 text-[11px]">
            <p><span className="text-amber-600 dark:text-amber-400 font-bold">GET</span> /api/projects?track=trk_01 <span className="text-slate-400">// Search & filter gallery</span></p>
            <p><span className="text-emerald-600 dark:text-emerald-400 font-bold">POST</span> /api/events/{'{eid}'}/ballots/{'{pid}'} <span className="text-slate-400">// Submit rubric scores</span></p>
            <p><span className="text-indigo-600 dark:text-indigo-400 font-bold">GET</span> /api/events/{'{eid}'}/results?method=shrinkage <span className="text-slate-400">// Normalized leaderboard</span></p>
            <p><span className="text-amber-600 dark:text-amber-400 font-bold">GET</span> /api/export.csv <span className="text-slate-400">// One-click audit export</span></p>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 10. FINAL CTA                                                    */}
      {/* ================================================================ */}
      <section className="max-w-5xl mx-auto">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white border border-amber-500/30 text-center space-y-6 relative overflow-hidden amber-glow shadow-xl">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to run your next hackathon?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Deploy Raptor on your local machine or server in less than 60 seconds. 
            Experience fair judging with zero external baggage.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onOpenAuth('register')}
              className="px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg font-mono"
            >
              Get Started Free →
            </button>
            <button
              onClick={onExploreHackathons}
              className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-sm transition"
            >
              Explore Hackathons →
            </button>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* DEVELOPER TELEMETRY FOOTER                                       */}
      {/* ================================================================ */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 pt-10 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <RaptorLogo size={24} />
            <span className="font-extrabold text-slate-800 dark:text-slate-300">RAPTOR</span>
            <span className="text-[10px] font-mono text-slate-400">v2.4.0-STABLE</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-mono text-slate-400">
            <span>UPTIME: 99.99%</span>
            <span>STATUS: OPERATIONAL</span>
            <span>RAPTOR OS // v2.4.0-STABLE</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center sm:text-left">
          Open-source hackathon submission and judging engine. Apache-2.0 License.
        </p>
      </footer>

    </div>
  );
};

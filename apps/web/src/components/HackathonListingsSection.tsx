import React, { useState } from 'react';
import { HackathonItem } from '../types';

export const HACKATHON_DATA: HackathonItem[] = [
  {
    id: 'evt_01',
    name: 'DOGFOOD 2026',
    tagline: 'Build the platform that will judge you.',
    description:
      'A 72-hour online hackathon run by Hackathon Raptors. Teams build an open-source, self-hostable submission and judging platform. The organizers intend to fork the winning project, self-host it, and run their future events on it.',
    prizePool: '$2,500 USD',
    status: 'active',
    statusLabel: 'JUDGING WINDOW ACTIVE',
    statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    kickoffDate: 'Fri 25 Sep, 18:00 UTC',
    deadlineDate: 'Mon 28 Sep, 18:00 UTC',
    judgingCloseDate: '28 Sep to 8 Oct 2026',
    winnersDate: 'Fri 9 Oct 2026',
    submissionCount: 41,
    tracks: [
      { id: 'trk_01', event_id: 'evt_01', name: 'Developer tools' },
      { id: 'trk_02', event_id: 'evt_01', name: 'Data and analytics' },
      { id: 'trk_03', event_id: 'evt_01', name: 'Accessibility' },
      { id: 'trk_04', event_id: 'evt_01', name: 'Security & Privacy' },
      { id: 'trk_05', event_id: 'evt_01', name: 'Climate' },
      { id: 'trk_06', event_id: 'evt_01', name: 'Health' },
      { id: 'trk_07', event_id: 'evt_01', name: 'Education' },
      { id: 'trk_08', event_id: 'evt_01', name: 'Open hardware' },
    ],
    prizes: [
      {
        rank: '1st Place',
        title: 'Grand Prize (Fork & Adoption)',
        amount: '$800 USD',
        description: 'The portal that gets forked and run by Hackathon Raptors.',
      },
      {
        rank: '2nd Place',
        title: 'Runner Up',
        amount: '$500 USD',
        description: 'Outstanding execution and architectural design.',
      },
      {
        rank: '3rd Place',
        title: 'Third Prize',
        amount: '$350 USD',
        description: 'High tier completion and judging integrity.',
      },
      {
        rank: '4th & 5th',
        title: 'Finalist Honors',
        amount: '$200 & $150 USD',
        description: 'Robust core platform capabilities and clean codebase.',
      },
      {
        rank: 'Special',
        title: 'Best Judging Engine Prize',
        amount: '$100 USD',
        description: 'Most defensible assignment, normalization math, and role isolation.',
      },
      {
        rank: 'Quest',
        title: 'Write Up Quest (4x $100)',
        amount: '$400 USD',
        description: 'Deep technical post-mortems on schemas and normalization math.',
      },
    ],
    rules: [
      'Open source under OSI approved license (MIT or Apache-2.0 preferred)',
      'Teams of 1 to 4 people. Solo hackers welcome.',
      'No hosted dependencies: must run 100% offline on a laptop.',
      'Role isolation strictly enforced in backend API (HTTP 403 Forbidden).',
      'The One Command Rule: docker compose up boots a fully seeded portal.',
    ],
    rubric: [
      {
        criterion: 'Tier Completion & Correctness',
        weight: '40%',
        description: 'Verified by acceptance report rather than README claims.',
      },
      {
        criterion: 'Judging Integrity',
        weight: '25%',
        description: 'Backend role isolation and documented score normalization.',
      },
      {
        criterion: 'Adoptability & Operability',
        weight: '20%',
        description: 'Could this run in production on Monday with zero cloud accounts.',
      },
      {
        criterion: 'Code Quality & Innovation',
        weight: '15%',
        description: 'Idiomatic by senior reviewer standards and defensible schema.',
      },
    ],
  },
  {
    id: 'evt_02',
    name: 'Autonomous AI Coding Jam',
    tagline: 'Air-gapped local SLMs & Multi-Agent orchestration',
    description:
      'Build specialized coding agents, local model evaluators, and self-healing pipelines that operate completely air-gapped without relying on external cloud LLM APIs.',
    prizePool: '$5,000 USD',
    isDemoEvent: true,
    status: 'upcoming',
    statusLabel: 'REGISTRATION OPEN',
    statusColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    kickoffDate: 'Fri 16 Oct, 18:00 UTC',
    deadlineDate: 'Mon 19 Oct, 18:00 UTC',
    judgingCloseDate: '19 Oct to 26 Oct 2026',
    winnersDate: 'Fri 30 Oct 2026',
    submissionCount: 24,
    tracks: [
      { id: 'trk_ai_1', event_id: 'evt_02', name: 'Local SLM Tool Calling' },
      { id: 'trk_ai_2', event_id: 'evt_02', name: 'Multi-Agent Coordination' },
      { id: 'trk_ai_3', event_id: 'evt_02', name: 'Deterministic Code Evaluators' },
      { id: 'trk_ai_4', event_id: 'evt_02', name: 'Air-Gapped Copilots' },
    ],
    prizes: [
      { rank: '1st Place', title: 'Grand Champion', amount: '$2,500 USD', description: 'Best overall autonomous coding agent.' },
      { rank: '2nd Place', title: 'Runner Up', amount: '$1,500 USD', description: 'Superior deterministic code evaluation pipeline.' },
      { rank: '3rd Place', title: 'Bronze Award', amount: '$1,000 USD', description: 'Most innovative air-gapped local SLM tooling.' },
    ],
    rules: [
      'All inference must execute locally via Ollama, llama.cpp, or vLLM.',
      'Teams of 1 to 4 developers.',
      'Permissive open source licensing.',
    ],
    rubric: [
      { criterion: 'Autonomous Execution', weight: '35%', description: 'Zero human intervention in task loop.' },
      { criterion: 'Deterministic Correctness', weight: '35%', description: 'Passes rigorous test harnesses.' },
      { criterion: 'Resource Footprint', weight: '30%', description: 'Low RAM and VRAM overhead.' },
    ],
  },
  {
    id: 'evt_03',
    name: 'Kernel & Enclave Security Jam',
    tagline: 'Hardware isolation, memory safety, and verifiable attestation',
    description:
      'Design secure enclaves, eBPF telemetry guardians, and microkernel isolation layers for high-assurance confidential computing environments.',
    prizePool: '$3,500 USD',
    isDemoEvent: true,
    status: 'upcoming',
    statusLabel: 'REGISTRATION OPEN',
    statusColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    kickoffDate: 'Fri 6 Nov, 18:00 UTC',
    deadlineDate: 'Mon 9 Nov, 18:00 UTC',
    judgingCloseDate: '9 Nov to 16 Nov 2026',
    winnersDate: 'Fri 20 Nov 2026',
    submissionCount: 16,
    tracks: [
      { id: 'trk_sec_1', event_id: 'evt_03', name: 'Hardware Enclaves & SGX' },
      { id: 'trk_sec_2', event_id: 'evt_03', name: 'eBPF Security Telemetry' },
      { id: 'trk_sec_3', event_id: 'evt_03', name: 'Memory-Safe Systems in Rust' },
    ],
    prizes: [
      { rank: '1st Place', title: 'Defensive Bastion Award', amount: '$2,000 USD', description: 'Zero-compromise memory isolation.' },
      { rank: '2nd Place', title: 'Attestation Champion', amount: '$1,000 USD', description: 'Verifiable cryptographic enclave proof.' },
      { rank: '3rd Place', title: 'Telemetry Guard', amount: '$500 USD', description: 'Ultra-low latency kernel monitoring.' },
    ],
    rules: [
      'Rust, C, or Zig preferred.',
      'Zero external telemetry or cloud reporting.',
      'Complete test vectors provided in repository.',
    ],
    rubric: [
      { criterion: 'Exploit Resistance', weight: '45%', description: 'Withstands adversarial test harness.' },
      { criterion: 'Zero Overhead', weight: '30%', description: 'Sub-microsecond interception latency.' },
      { criterion: 'Clean Architecture', weight: '25%', description: 'Idiomatic and auditable code.' },
    ],
  },
];

interface HackathonListingsSectionProps {
  onSelectHackathon: (hackathon: HackathonItem) => void;
}

export const HackathonListingsSection: React.FC<HackathonListingsSectionProps> = ({
  onSelectHackathon,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all');

  const filtered = HACKATHON_DATA.filter((h) => {
    if (filter === 'active') return h.status === 'active' || h.status === 'judging';
    if (filter === 'upcoming') return h.status === 'upcoming';
    return true;
  });

  return (
    <section id="section-hackathons" className="max-w-5xl mx-auto space-y-8 scroll-mt-24">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="text-xs uppercase font-mono tracking-wider text-amber-400">
            Available Events
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-1">
            Hackathon Listings
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Browse available hackathons, inspect timelines and prize pools, or enter to submit your project.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex rounded-lg bg-[#0a0e16] p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Events ({HACKATHON_DATA.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filter === 'active'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active (1)
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filter === 'upcoming'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Upcoming (2)
          </button>
        </div>
      </div>

      {/* Grid of Hackathon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((hackathon) => (
          <div
            key={hackathon.id}
            onClick={() => onSelectHackathon(hackathon)}
            className="group rounded-2xl bg-[#0f131c] border border-slate-800/90 hover:border-amber-500/50 hover:bg-[#141824] transition-all p-6 flex flex-col justify-between cursor-pointer space-y-5 shadow-lg relative overflow-hidden"
          >
            {/* Ambient subtle glow accent on card hover */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition" />

            <div className="space-y-3.5 relative z-10">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${hackathon.statusColor}`}>
                  ● {hackathon.statusLabel}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  {hackathon.id}
                </span>
              </div>

              <div>
                <h3 className="text-xl font-bold text-white group-hover:text-amber-300 transition">
                  {hackathon.name}
                </h3>
                <p className="text-xs text-amber-400/90 font-mono mt-0.5 line-clamp-1">
                  "{hackathon.tagline}"
                </p>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {hackathon.description}
              </p>

              {/* Stat Chips */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-slate-800/80">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Prize Pool</div>
                  <div className="font-extrabold text-white text-sm mt-0.5">{hackathon.prizePool}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0a0e16] border border-slate-800/80">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Submissions</div>
                  <div className="font-extrabold text-indigo-300 text-sm mt-0.5">{hackathon.submissionCount} Projects</div>
                </div>
              </div>

              <div className="text-[11px] font-mono text-slate-400 space-y-1 pt-1">
                <div>Deadline: <strong className="text-slate-300">{hackathon.deadlineDate}</strong></div>
                <div>Tracks: <strong className="text-slate-300">{hackathon.tracks.length} Competitive Tracks</strong></div>
              </div>
            </div>

            {/* Card Action Bar */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
              <span className="text-xs font-mono text-slate-500">
                Click to view full spec
              </span>
              <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition flex items-center space-x-1">
                <span>View Details</span>
                <span>→</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

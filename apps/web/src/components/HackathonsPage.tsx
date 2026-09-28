import React, { useState } from 'react';
import { HACKATHON_DATA } from './HackathonListingsSection';
import { HackathonItem } from '../types';
import { RaptorLogo } from './RaptorLogo';

interface HackathonsPageProps {
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'demo') => void;
  onExploreGallery: () => void;
  onSelectHackathon: (hackathon: HackathonItem) => void;
}

export const HackathonsPage: React.FC<HackathonsPageProps> = ({
  onOpenAuth,
  onExploreGallery,
  onSelectHackathon,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'upcoming'>('all');
  const [search, setSearch] = useState('');

  const filtered = HACKATHON_DATA.filter((h) => {
    if (filter === 'active' && !(h.status === 'active' || h.status === 'judging')) return false;
    if (filter === 'upcoming' && h.status !== 'upcoming') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = h.name.toLowerCase().includes(q);
      const matchTag = h.tagline.toLowerCase().includes(q);
      const matchTrack = h.tracks.some((t) => t.name.toLowerCase().includes(q));
      if (!matchName && !matchTag && !matchTrack) return false;
    }
    return true;
  });

  return (
    <div className="space-y-12 py-10 selection:bg-amber-500/20 selection:text-amber-300">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-8 space-y-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#10141f] border border-slate-800 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
            RAPTOR EVENT DIRECTORY // 3 CONFIGURED HACKATHONS
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              Hackathons Directory
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 max-w-2xl leading-relaxed">
              Explore live competitions, inspect track rubrics, and view prize distributions. 
              All hackathons hosted on Raptor are 100% self-hosted, air-gapped, and open source.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={onExploreGallery}
              className="px-4 py-2.5 rounded-lg bg-[#141824] hover:bg-[#1a2030] text-slate-300 hover:text-white border border-slate-700 font-medium text-xs transition whitespace-nowrap"
            >
              Browse Gallery →
            </button>
            <button
              onClick={() => onOpenAuth('demo')}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
            >
              + Host a Hackathon
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hackathons by name, track keywords, or description..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0f131c] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2.5 text-xs text-slate-500 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex rounded-xl bg-[#0a0e16] p-1 border border-slate-800 text-xs self-start sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Events ({HACKATHON_DATA.length})
          </button>
          <button
            onClick={() => setFilter('active')}
            className={`px-3.5 py-2 rounded-lg font-medium transition ${
              filter === 'active'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-3.5 py-2 rounded-lg font-medium transition ${
              filter === 'upcoming'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Upcoming
          </button>
        </div>
      </div>

      {/* Grid of Hackathon Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((hackathon) => (
          <div
            key={hackathon.id}
            onClick={() => onSelectHackathon(hackathon)}
            className="group rounded-2xl bg-[#0f131c] border border-slate-800 hover:border-amber-500/50 hover:bg-[#141824] transition-all p-6 flex flex-col justify-between cursor-pointer space-y-6 shadow-xl relative overflow-hidden"
          >
            {/* Ambient subtle glow accent on card hover */}
            <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition" />

            <div className="space-y-4 relative z-10">
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
                <p className="text-xs text-amber-400/90 font-mono mt-1 line-clamp-1">
                  "{hackathon.tagline}"
                </p>
              </div>

              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                {hackathon.description}
              </p>

              {/* Stat Chips */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-[#0a0e16] border border-slate-800/80">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Prize Pool</div>
                  <div className="font-extrabold text-white text-base mt-0.5">{hackathon.prizePool}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#0a0e16] border border-slate-800/80">
                  <div className="text-[10px] font-mono uppercase text-slate-500">Submissions</div>
                  <div className="font-extrabold text-indigo-300 text-base mt-0.5">{hackathon.submissionCount} Projects</div>
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
                Click to inspect full details
              </span>
              <span className="text-xs font-bold text-amber-400 group-hover:translate-x-1 transition flex items-center space-x-1 font-mono">
                <span>View Hackathon Page</span>
                <span>→</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Host Banner */}
      <div className="p-8 rounded-2xl bg-gradient-to-r from-[#141824] to-[#0f131c] border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-white">Want to organize your own hackathon?</h3>
          <p className="text-xs text-slate-400">
            Deploy Raptor in seconds on your infrastructure. Zero external cloud costs, complete judging integrity.
          </p>
        </div>

        <button
          onClick={() => onOpenAuth('demo')}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition shadow-sm whitespace-nowrap"
        >
          Host with Raptor →
        </button>
      </div>

      {/* Standard Telemetry Footer */}
      <footer className="border-t border-slate-800/80 pt-12 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs text-slate-500 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <RaptorLogo size={24} />
            <span className="font-extrabold text-slate-300">RAPTOR</span>
            <span className="text-[10px] font-mono text-slate-600">v2.4.0-STABLE</span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-mono text-slate-400">
            <span>UPTIME: 99.99%</span>
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

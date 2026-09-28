import React, { useState } from 'react';
import { User } from '../types';
import { RaptorLogo } from './RaptorLogo';

export type AppView =
  | 'landing'
  | 'hackathons'
  | 'hackathon-detail'
  | 'gallery'
  | 'auth'
  | 'participant'
  | 'judge'
  | 'organizer'
  | 'admin';

interface NavbarProps {
  currentUser: User | null;
  backendStatus: string;
  theme: 'dark' | 'light';
  currentView: AppView;
  onToggleTheme: () => void;
  onOpenAuth: (defaultTab?: 'login' | 'register' | 'demo') => void;
  onNavigate: (view: AppView) => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  theme,
  currentView,
  onToggleTheme,
  onOpenAuth,
  onNavigate,
  onSignOut,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleName = currentUser?.roles?.[0]?.role?.toLowerCase() || 'visitor';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#0a0e16]/90 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Raptor Brand */}
        <div className="flex items-center space-x-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('landing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center space-x-2.5 group transition cursor-pointer"
          >
            <RaptorLogo size={28} className="group-hover:scale-105 transition-transform" />
            <span className="font-extrabold tracking-tight text-slate-900 dark:text-white text-base font-mono">
              RAPTOR
            </span>
          </a>
        </div>

        {/* Center: Strict Role-Adaptive Navigation Links */}
        <nav className="hidden md:flex items-center space-x-6 text-xs font-medium text-slate-600 dark:text-slate-400">
          {/* 1. VISITOR NAVBAR (UNAUTHENTICATED) */}
          {(!currentUser || roleName === 'visitor') && (
            <>
              <button
                onClick={() => onNavigate('landing')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'landing' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Home
              </button>
              <button
                onClick={() => onNavigate('hackathons')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'hackathons' || currentView === 'hackathon-detail'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : ''
                }`}
              >
                Hackathons
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'gallery' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Project Gallery
              </button>
            </>
          )}

          {/* 2. PARTICIPANT NAVBAR */}
          {currentUser && roleName === 'participant' && (
            <>
              <button
                onClick={() => onNavigate('participant')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 flex items-center space-x-1.5 ${
                  currentView === 'participant' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>My Team & Submission</span>
              </button>
              <button
                onClick={() => onNavigate('hackathons')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'hackathons' || currentView === 'hackathon-detail'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : ''
                }`}
              >
                Hackathons
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'gallery' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Gallery
              </button>
            </>
          )}

          {/* 3. JUDGE NAVBAR */}
          {currentUser && roleName === 'judge' && (
            <>
              <button
                onClick={() => onNavigate('judge')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 flex items-center space-x-1.5 ${
                  currentView === 'judge' ? 'text-indigo-700 dark:text-indigo-400 font-bold' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                <span>Judge Workspace</span>
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'gallery' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Gallery
              </button>
              <button
                onClick={() => onNavigate('hackathons')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'hackathons' || currentView === 'hackathon-detail'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : ''
                }`}
              >
                Hackathons
              </button>
            </>
          )}

          {/* 4. ORGANIZER NAVBAR */}
          {currentUser && roleName === 'organizer' && (
            <>
              <button
                onClick={() => onNavigate('organizer')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 flex items-center space-x-1.5 ${
                  currentView === 'organizer' ? 'text-amber-700 dark:text-amber-400 font-bold' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                <span>Organizer Console</span>
              </button>
              <button
                onClick={() => onNavigate('hackathons')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'hackathons' || currentView === 'hackathon-detail'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : ''
                }`}
              >
                Hackathons
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'gallery' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Gallery
              </button>
            </>
          )}

          {/* 5. ADMIN NAVBAR */}
          {currentUser && roleName === 'admin' && (
            <>
              <button
                onClick={() => onNavigate('admin')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 flex items-center space-x-1.5 ${
                  currentView === 'admin' ? 'text-purple-700 dark:text-purple-400 font-bold' : ''
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                <span>Admin Console</span>
              </button>
              <button
                onClick={() => onNavigate('organizer')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'organizer' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Organizer Console
              </button>
              <button
                onClick={() => onNavigate('hackathons')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'hackathons' || currentView === 'hackathon-detail'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : ''
                }`}
              >
                Hackathons
              </button>
              <button
                onClick={() => onNavigate('gallery')}
                className={`hover:text-slate-900 dark:hover:text-white transition py-1 ${
                  currentView === 'gallery' ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''
                }`}
              >
                Gallery
              </button>
            </>
          )}
        </nav>

        {/* Right: Theme Toggle & Role-Specific Profile Actions */}
        <div className="flex items-center space-x-3">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 transition flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {currentUser ? (
            <div className="flex items-center space-x-2.5">
              <button
                onClick={() => {
                  if (roleName === 'participant') onNavigate('participant');
                  else if (roleName === 'judge') onNavigate('judge');
                  else if (roleName === 'organizer') onNavigate('organizer');
                  else if (roleName === 'admin') onNavigate('admin');
                }}
                className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#181c24] border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition flex items-center space-x-1.5"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    roleName === 'admin'
                      ? 'bg-purple-500'
                      : roleName === 'organizer'
                      ? 'bg-amber-500'
                      : roleName === 'judge'
                      ? 'bg-indigo-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span className="font-bold text-slate-900 dark:text-white capitalize">{roleName}</span>
                <span className="text-slate-400 truncate max-w-[100px] hidden sm:inline">({currentUser.name})</span>
              </button>
              <button
                onClick={onSignOut}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition font-medium"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenAuth('login')}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                  currentView === 'auth'
                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="text-xs font-medium px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-sm font-mono"
              >
                Get Started
              </button>
            </div>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0a0e16] px-4 py-4 space-y-3 animate-in fade-in duration-150">
          <nav className="flex flex-col space-y-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            {(!currentUser || roleName === 'visitor') && (
              <>
                <button
                  onClick={() => {
                    onNavigate('landing');
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left py-1.5 hover:text-amber-500 ${
                    currentView === 'landing' ? 'text-amber-500 font-bold' : ''
                  }`}
                >
                  Home
                </button>
                <button
                  onClick={() => {
                    onNavigate('hackathons');
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left py-1.5 hover:text-amber-500 ${
                    currentView === 'hackathons' || currentView === 'hackathon-detail' ? 'text-amber-500 font-bold' : ''
                  }`}
                >
                  Hackathons
                </button>
                <button
                  onClick={() => {
                    onNavigate('gallery');
                    setMobileMenuOpen(false);
                  }}
                  className={`text-left py-1.5 hover:text-amber-500 ${
                    currentView === 'gallery' ? 'text-amber-500 font-bold' : ''
                  }`}
                >
                  Project Gallery
                </button>
              </>
            )}

            {currentUser && roleName === 'participant' && (
              <>
                <button
                  onClick={() => {
                    onNavigate('participant');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 text-emerald-600 dark:text-emerald-400 font-bold"
                >
                  My Team & Submission
                </button>
                <button
                  onClick={() => {
                    onNavigate('hackathons');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Hackathons
                </button>
                <button
                  onClick={() => {
                    onNavigate('gallery');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Gallery
                </button>
              </>
            )}

            {currentUser && roleName === 'judge' && (
              <>
                <button
                  onClick={() => {
                    onNavigate('judge');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 text-indigo-600 dark:text-indigo-400 font-bold"
                >
                  Judge Workspace
                </button>
                <button
                  onClick={() => {
                    onNavigate('gallery');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Gallery
                </button>
                <button
                  onClick={() => {
                    onNavigate('hackathons');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Hackathons
                </button>
              </>
            )}

            {currentUser && roleName === 'organizer' && (
              <>
                <button
                  onClick={() => {
                    onNavigate('organizer');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 text-amber-600 dark:text-amber-400 font-bold"
                >
                  Organizer Console
                </button>
                <button
                  onClick={() => {
                    onNavigate('hackathons');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Hackathons
                </button>
                <button
                  onClick={() => {
                    onNavigate('gallery');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Gallery
                </button>
              </>
            )}

            {currentUser && roleName === 'admin' && (
              <>
                <button
                  onClick={() => {
                    onNavigate('admin');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 text-purple-600 dark:text-purple-400 font-bold"
                >
                  Admin Console
                </button>
                <button
                  onClick={() => {
                    onNavigate('organizer');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Organizer Console
                </button>
                <button
                  onClick={() => {
                    onNavigate('hackathons');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Hackathons
                </button>
                <button
                  onClick={() => {
                    onNavigate('gallery');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left py-1.5 hover:text-amber-500"
                >
                  Gallery
                </button>
              </>
            )}
          </nav>

          {!currentUser && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('login');
                }}
                className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth('register');
                }}
                className="flex-1 py-2 text-center text-xs font-medium rounded-lg bg-amber-500 text-slate-950 font-bold font-mono"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

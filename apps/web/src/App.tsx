import { useEffect, useState, useCallback, useRef } from 'react';
import { apiRequest } from './lib/api';
import { User } from './types';
import { Navbar, AppView } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { HackathonsPage } from './components/HackathonsPage';
import { HackathonDetailPage } from './components/HackathonDetailPage';
import { GalleryPage } from './components/GalleryPage';
import { AuthPage } from './components/AuthPage';
import { ParticipantPortal } from './components/ParticipantPortal';
import { JudgeWorkspace } from './components/JudgeWorkspace';
import { OrganizerConsole } from './components/OrganizerConsole';
import { AdminConsole } from './components/AdminConsole';
import { HackathonItem } from './types';
import { HACKATHON_DATA } from './components/HackathonListingsSection';
import { setSessionToken } from './lib/auth';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'raptor-theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function readStoredTheme(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (isTheme(saved)) return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [backendStatus, setBackendStatus] = useState<string>('checking...');
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [previousView, setPreviousView] = useState<AppView>('landing');
  const [selectedHackathon, setSelectedHackathon] = useState<HackathonItem | null>(() => HACKATHON_DATA[0]);
  const [authTab, setAuthTab] = useState<'demo' | 'login' | 'register'>('demo');

  // Theme management. Resolution order: explicit localStorage choice, then the
  // OS `prefers-color-scheme`, then dark.
  const [theme, setTheme] = useState<Theme>(readStoredTheme);
  const isExplicit = useRef(isTheme(localStorage.getItem(STORAGE_KEY)));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (event: MediaQueryListEvent) => {
      if (isExplicit.current) return;
      setTheme(event.matches ? 'light' : 'dark');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    isExplicit.current = true;
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  // Check backend health & current session
  const refreshUser = useCallback(() => {
    apiRequest<{ status: string }>('/api/health')
      .then((res) => setBackendStatus(res.status))
      .catch(() => setBackendStatus('offline'));

    apiRequest<User>('/me')
      .then((u) => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
  }, []);

  useEffect(() => {
    refreshUser();

    // Deep link support for shared hackathons
    const handleHashRouting = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#hackathon-')) {
        const id = hash.replace('#hackathon-', '');
        const found = HACKATHON_DATA.find((h) => h.id === id);
        if (found) {
          setSelectedHackathon(found);
          setCurrentView('hackathon-detail');
        }
      }
    };

    handleHashRouting();
    window.addEventListener('hashchange', handleHashRouting);
    return () => window.removeEventListener('hashchange', handleHashRouting);
  }, [refreshUser]);

  const handleOpenAuth = (tab: 'demo' | 'login' | 'register' = 'demo') => {
    setAuthTab(tab);
    if (currentView !== 'auth') {
      setPreviousView(currentView);
    }
    setCurrentView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    setSessionToken(null);
    setCurrentUser(null);
    refreshUser();
    setCurrentView('landing');
  };

  const handleNavigate = (view: AppView) => {
    if (currentView !== 'auth') {
      setPreviousView(currentView);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectHackathon = (hackathon: HackathonItem) => {
    setSelectedHackathon(hackathon);
    setCurrentView('hackathon-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExploreGallery = () => {
    handleNavigate('gallery');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-grid-pattern transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        backendStatus={backendStatus}
        theme={theme}
        currentView={currentView}
        onToggleTheme={toggleTheme}
        onOpenAuth={handleOpenAuth}
        onNavigate={handleNavigate}
        onSignOut={handleSignOut}
      />

      {/* Main View Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {currentView === 'auth' ? (
          <AuthPage
            initialTab={authTab}
            onBack={() => {
              setCurrentView(previousView);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSuccess={(role) => {
              refreshUser();
              if (role === 'participant') handleNavigate('participant');
              else if (role === 'judge') handleNavigate('judge');
              else if (role === 'organizer') handleNavigate('organizer');
              else if (role === 'admin') handleNavigate('admin');
              else handleNavigate('landing');
            }}
          />
        ) : currentView === 'participant' ? (
          <ParticipantPortal
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('demo')}
            onExploreGallery={handleExploreGallery}
          />
        ) : currentView === 'judge' ? (
          <JudgeWorkspace
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('demo')}
            onExploreGallery={handleExploreGallery}
          />
        ) : currentView === 'organizer' ? (
          <OrganizerConsole
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('demo')}
            onExploreGallery={handleExploreGallery}
          />
        ) : currentView === 'admin' ? (
          <AdminConsole
            currentUser={currentUser}
            onOpenAuth={() => handleOpenAuth('demo')}
            onNavigateOrganizer={() => handleNavigate('organizer')}
          />
        ) : currentView === 'hackathon-detail' && selectedHackathon ? (
          <HackathonDetailPage
            hackathon={selectedHackathon}
            currentUser={currentUser}
            onBack={() => handleNavigate('hackathons')}
            onOpenAuth={handleOpenAuth}
            onExploreGallery={handleExploreGallery}
            onNavigate={handleNavigate}
          />
        ) : currentView === 'hackathons' ? (
          <HackathonsPage
            onOpenAuth={handleOpenAuth}
            onExploreGallery={handleExploreGallery}
            onSelectHackathon={handleSelectHackathon}
          />
        ) : currentView === 'gallery' ? (
          <GalleryPage
            currentUser={currentUser}
            onNavigate={handleNavigate}
            onOpenAuth={handleOpenAuth}
          />
        ) : (
          <LandingPage
            onOpenAuth={handleOpenAuth}
            onExploreGallery={handleExploreGallery}
            onExploreHackathons={() => handleNavigate('hackathons')}
            onSelectRoleDemo={(token, role) => {
              setSessionToken(token);
              refreshUser();
              if (role === 'participant') handleNavigate('participant');
              else if (role === 'judge') handleNavigate('judge');
              else if (role === 'organizer') handleNavigate('organizer');
              else if (role === 'admin') handleNavigate('admin');
              else handleNavigate('landing');
            }}
          />
        )}
      </main>
    </div>
  );
}

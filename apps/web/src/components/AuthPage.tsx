import React, { useState } from 'react';
import { apiRequest } from '../lib/api';
import { setSessionToken } from '../lib/auth';
import { RaptorLogo } from './RaptorLogo';

interface AuthPageProps {
  initialTab?: 'demo' | 'login' | 'register';
  onBack: () => void;
  onSuccess: (role: string) => void;
}

const DEMO_ROLES = [
  {
    role: 'Participant',
    token: 'demo-pt-d7f97ed29e331c278823c9361109a54e',
    color: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    role: 'Judge',
    token: 'demo-ja-c9e380efa065eb7f8187b4da697a180a',
    color: 'hover:border-indigo-500/50 hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  {
    role: 'Organizer',
    token: 'demo-org-29ced468c7410afa403da3619178b380',
    color: 'hover:border-amber-500/50 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    role: 'Admin',
    token: 'demo-adm-8849b2c31e9f1a23',
    color: 'hover:border-purple-500/50 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  initialTab = 'login',
  onBack,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab === 'register' ? 'register' : 'login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regOrganization, setRegOrganization] = useState('');
  const [regRole, setRegRole] = useState<'participant' | 'judge' | 'organizer'>('participant');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSelectDemoRole = (token: string, roleName: string) => {
    setSessionToken(token);
    setSuccessMsg(`Switched to ${roleName} role`);
    setTimeout(() => {
      onSuccess(roleName.toLowerCase());
    }, 200);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const formData = new URLSearchParams();
      formData.append('username', loginEmail.trim());
      formData.append('password', loginPassword);

      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!res.ok) {
        throw new Error('Invalid email or password. You can also use the 1-Click Demo accounts below.');
      }

      const meRes = await apiRequest<{ roles?: Array<{ role: string }> }>('/me').catch(() => null);
      const detectedRole = meRes?.roles?.[0]?.role?.toLowerCase() || 'participant';

      setSuccessMsg('Authenticated successfully!');
      setTimeout(() => {
        onSuccess(detectedRole);
      }, 200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const data = await apiRequest<{ status: string; user_id: string; role: string }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name: regName.trim(),
            email: regEmail.trim(),
            password: regPassword,
            role: regRole,
            organization: regOrganization.trim(),
            event_id: 'evt_01',
          }),
        }
      );

      setSuccessMsg(`Account created for ${regName}!`);
      setTimeout(() => {
        onSuccess(data.role || regRole);
      }, 200);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 px-4 sm:px-6 selection:bg-amber-500/20 selection:text-amber-300 animate-in fade-in duration-200">
      {/* Back button */}
      <div className="max-w-md w-full mx-auto mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition font-mono"
        >
          <span>←</span>
          <span>Back</span>
        </button>
      </div>

      {/* Main Auth Card */}
      <div className="max-w-md w-full mx-auto bg-white dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mx-auto shadow-sm">
            <RaptorLogo size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {tab === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {tab === 'login'
              ? 'Sign in to access your hackathons and projects'
              : 'Join Raptor to submit projects and participate in events'}
          </p>
        </div>

        {/* Segmented Switcher */}
        <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-center rounded-lg transition ${
              tab === 'login'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 text-center rounded-lg transition ${
              tab === 'register'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Feedback Banners */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-600 dark:text-rose-400 flex items-start space-x-2">
            <span className="text-rose-500">⚠</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-600 dark:text-emerald-400 flex items-center space-x-2">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form: Sign In */}
        {tab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="name@example.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
              </div>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-50 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 font-semibold text-xs transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* Form: Register */
          <form onSubmit={handleRegisterSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Full name
              </label>
              <input
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <input
                type="email"
                required
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="ada@example.org"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300">
                Initial role
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRegRole('participant')}
                  className={`py-2 px-2 rounded-lg border text-center transition font-medium text-xs ${
                    regRole === 'participant'
                      ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'bg-slate-50 dark:bg-[#0a0e16] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Participant
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('judge')}
                  className={`py-2 px-2 rounded-lg border text-center transition font-medium text-xs ${
                    regRole === 'judge'
                      ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'bg-slate-50 dark:bg-[#0a0e16] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Judge
                </button>
                <button
                  type="button"
                  onClick={() => setRegRole('organizer')}
                  className={`py-2 px-2 rounded-lg border text-center transition font-medium text-xs ${
                    regRole === 'organizer'
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400 font-semibold'
                      : 'bg-slate-50 dark:bg-[#0a0e16] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Organizer
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>{regRole === 'organizer' ? 'Host Organization / Company' : 'Organization / University (Optional)'}</span>
                {regRole === 'organizer' && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-medium">Required for Organizers</span>
                )}
              </label>
              <input
                type="text"
                required={regRole === 'organizer'}
                value={regOrganization}
                onChange={(e) => setRegOrganization(e.target.value)}
                placeholder={regRole === 'organizer' ? 'e.g. Apex Innovation Labs / Hackathon raptors' : 'e.g. Stanford University, Google, Freelance'}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#0a0e16] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-50 dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-slate-950 font-semibold text-xs transition shadow-sm disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Divider for Demo Roles */}
        <div className="relative pt-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-wider text-slate-400">
            <span className="bg-white dark:bg-[#0f131c] px-3">
              or quick demo access
            </span>
          </div>
        </div>

        {/* 1-Click Demo Role Chips */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {DEMO_ROLES.map((d) => (
            <button
              key={d.role}
              type="button"
              onClick={() => handleSelectDemoRole(d.token, d.role)}
              className={`p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e16] text-xs font-mono transition flex items-center justify-between group ${d.color}`}
            >
              <div className="flex items-center space-x-2">
                <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
                <span className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-inherit">
                  {d.role}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 group-hover:translate-x-0.5 transition">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

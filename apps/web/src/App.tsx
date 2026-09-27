import { useEffect, useState } from 'react';
import { apiRequest } from './lib/api';
import { GalleryResponse } from './types';
import { Trophy, CheckCircle2, Server, LayoutGrid } from 'lucide-react';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<string>('checking...');
  const [gallery, setGallery] = useState<GalleryResponse | null>(null);

  useEffect(() => {
    // Probe backend health through the Vite proxy
    apiRequest<{ status: string }>('/api/health')
      .then((res) => setBackendStatus(res.status))
      .catch(() => setBackendStatus('offline (FastAPI not started yet)'));

    // Probe gallery endpoint
    apiRequest<GalleryResponse>('/api/gallery')
      .then((res) => setGallery(res))
      .catch(() => setGallery(null));
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-indigo-400" />
          <span className="text-xl font-bold tracking-tight">RAPTOR</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            DOGFOOD 2026
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1.5">
            <Server className="w-4 h-4" />
            <span>API: </span>
            <span
              className={`font-mono text-xs px-2 py-0.5 rounded ${
                backendStatus === 'ok'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}
            >
              {backendStatus}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Hackathon Platform Starter
          </h1>
          <p className="text-slate-400">
            Parallel development initialized. Frontend ready in <code className="text-indigo-400">apps/web</code>, backend ready in <code className="text-indigo-400">apps/api</code>.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              <span>Contract-First</span>
            </div>
            <p className="text-sm text-slate-400">
              Endpoints, payloads, and response interfaces frozen in <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">docs/SRS/12_api_specification.md</code>.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <LayoutGrid className="w-5 h-5" />
              <span>Fixture Data Ready</span>
            </div>
            <p className="text-sm text-slate-400">
              41 projects, 30 judges, and 8 tracks ready in <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">fixtures.json</code> for instant frontend mocking.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 space-y-3">
            <div className="flex items-center gap-2 text-purple-400 font-semibold">
              <Server className="w-5 h-5" />
              <span>Nginx Proxy (8080)</span>
            </div>
            <p className="text-sm text-slate-400">
              Docker Compose setup routes <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">/api</code> to FastAPI and <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">/</code> to React seamlessly.
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-200">Public Gallery Probe</h2>
            <span className="text-xs text-slate-400">
              {gallery ? `${gallery.total} projects returned` : 'Awaiting backend response'}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/20 text-slate-400 text-sm">
            {gallery && gallery.items.length > 0 ? (
              <ul className="divide-y divide-slate-800">
                {gallery.items.map((p) => (
                  <li key={p.id} className="py-2 flex justify-between">
                    <span className="font-medium text-slate-200">{p.title}</span>
                    <span className="text-xs text-slate-500">{p.track}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No projects loaded yet. Start the backend with <code className="text-slate-300">uvicorn app.main:app --reload</code> in <code className="text-slate-300">apps/api</code>.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-center text-xs text-slate-500">
        Raptor · DOGFOOD 2026 Submission Platform · Self-Hostable & Offline-First
      </footer>
    </div>
  );
}

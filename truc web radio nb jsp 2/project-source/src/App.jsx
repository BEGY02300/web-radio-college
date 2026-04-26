import { useState, useEffect, useCallback } from 'react';
import { REPO, SITE, isAdmin } from './lib/config.js';
import { logger } from './lib/logger.js';
import { listContents } from './lib/github-api.js';
import { logout, onAuthChanged } from './lib/auth.js';
import Header from './components/Header.jsx';
import AuthModal from './components/AuthModal.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import FolderCard from './components/FolderCard.jsx';
import FileCard from './components/FileCard.jsx';
import AdminPanel from './components/AdminPanel.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPath, setCurrentPath] = useState(() => {
    const p = new URL(window.location.href).searchParams.get('path');
    return p || REPO.rootPath;
  });
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let unsub = () => {};
    try { unsub = onAuthChanged(setUser); } catch (err) { logger.error('Auth indispo', { err: err.message }); }
    return () => unsub();
  }, []);

  const load = useCallback(async (path) => {
    setLoading(true); setError(null);
    try { setData(await listContents(path)); }
    catch (e) { logger.error('Chargement', { err: e.message }); setError(e.message); setData({ folders: [], files: [] }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(currentPath); }, [currentPath, load]);

  const navigate = (path) => {
    setCurrentPath(path); setExpandedFile(null);
    const url = new URL(window.location.href);
    if (path !== REPO.rootPath) url.searchParams.set('path', path); else url.searchParams.delete('path');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="pb-12 min-h-screen">
      <Header user={user} loading={loading}
        onLogin={() => setAuthOpen(true)}
        onLogout={async () => { await logout(); }}
        onOpenAdmin={() => setAdminOpen(true)}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <Breadcrumb path={currentPath} onNavigate={navigate} />
          {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><div className="spinner w-4 h-4" /> Chargement...</div>}
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-200 rounded-xl p-4 mb-4 fade-in">
            <div className="flex items-start gap-2">
              <i className="fas fa-triangle-exclamation mt-1"></i>
              <div className="flex-1">
                <div className="font-semibold">Impossible de charger le contenu</div>
                <div className="text-sm">{error}</div>
                <div className="text-xs mt-2 opacity-80">Ouvrez la console (F12) pour plus de détails.</div>
              </div>
              <button onClick={() => load(currentPath)} className="px-3 py-1 rounded bg-rose-600 text-white text-sm hover:bg-rose-700"><i className="fas fa-rotate mr-1" />Réessayer</button>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {data.folders.length > 0 && (
              <section className="mb-8">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  <i className="fas fa-folder mr-1"></i>Catégories ({data.folders.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.folders.map((f) => <FolderCard key={f.sha} folder={f} onOpen={navigate} />)}
                </div>
              </section>
            )}

            {data.files.length > 0 ? (
              <section>
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                  <i className="fas fa-podcast mr-1"></i>Podcasts & Reportages ({data.files.length})
                </h3>
                <div className="space-y-4">
                  {data.files.map((f) => (
                    <FileCard key={f.sha} file={f} user={user}
                      expanded={expandedFile === f.sha}
                      onToggleExpand={() => setExpandedFile(expandedFile === f.sha ? null : f.sha)}
                      onOpenAuth={() => setAuthOpen(true)} />
                  ))}
                </div>
              </section>
            ) : data.folders.length === 0 && (
              <div className="text-center py-20 text-slate-500">
                <i className="fas fa-inbox text-5xl mb-3 opacity-40"></i>
                <p className="font-medium">Aucun contenu disponible</p>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
        <p>🎙️ {SITE.title} — {SITE.description}</p>
        <p className="mt-1 opacity-70">Ouvrez la console (F12) pour voir les logs techniques.</p>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AdminPanel open={adminOpen && user && isAdmin(user.email)} onClose={() => setAdminOpen(false)} />
    </div>
  );
}

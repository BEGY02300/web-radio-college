import { SITE, isAdmin } from '../lib/config.js';

export default function Header({ user, onLogin, onLogout, onOpenAdmin, onToggleTheme }) {
  const adminUser = user && isAdmin(user.email);
  return (
    <header className="sticky top-0 z-40 backdrop-blur bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-lg">
            <i className="fas fa-microphone-lines text-xl"></i>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{SITE.title}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{SITE.subtitle}</p>
          </div>
        </div>
        <button onClick={onToggleTheme} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" aria-label="Thème">
          <i className="fas fa-moon dark:hidden"></i><i className="fas fa-sun hidden dark:inline"></i>
        </button>
        {adminUser && (
          <button onClick={onOpenAdmin} className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm">
            <i className="fas fa-user-shield"></i> Admin
          </button>
        )}
        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              {user.photoURL
                ? <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                : <div className="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">{(user.displayName || user.email)[0].toUpperCase()}</div>}
              <span className="text-sm font-medium truncate max-w-[140px]">{user.displayName || user.email}</span>
              {adminUser && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>}
            </div>
            <button onClick={onLogout} className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 transition" title="Déconnexion">
              <i className="fas fa-right-from-bracket"></i>
            </button>
          </div>
        ) : (
          <button onClick={onLogin} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-brand-600 hover:bg-brand-700 text-white transition shadow-sm">
            <i className="fas fa-right-to-bracket"></i><span className="hidden sm:inline">Se connecter</span>
          </button>
        )}
      </div>
    </header>
  );
}

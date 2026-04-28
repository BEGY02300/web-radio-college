import { useState, useEffect } from 'react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, translateError } from '../lib/auth.js';

export default function AuthModal({ open, onClose }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState('error');

  useEffect(() => { if (open) { setMsg(null); setPassword(''); } }, [open, mode]);
  if (!open) return null;

  const handleGoogle = async () => {
    setBusy(true); setMsg(null);
    try { await loginWithGoogle(); onClose(); }
    catch (err) { setMsgType('error'); setMsg(translateError(err.code)); }
    finally { setBusy(false); }
  };
  const handleEmail = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (mode === 'login') await loginWithEmail(email, password);
      else if (mode === 'register') await registerWithEmail(email, password, displayName);
      else { await resetPassword(email); setMsgType('success'); setMsg('Email envoyé !'); setBusy(false); return; }
      onClose();
    } catch (err) { setMsgType('error'); setMsg(translateError(err.code)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold">{mode === 'login' ? '🔑 Connexion' : mode === 'register' ? '✨ Créer un compte' : '🔓 Mot de passe oublié'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><i className="fas fa-xmark" /></button>
        </div>
        <div className="p-6 space-y-4">
          {mode !== 'reset' && (<>
            <button onClick={handleGoogle} disabled={busy} className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continuer avec Google
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /><span className="text-xs text-slate-500">ou</span><div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /></div>
          </>)}
          <form onSubmit={handleEmail} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium mb-1">Votre nom (affiché)</label>
                <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
            {mode !== 'reset' && (
              <div>
                <label className="block text-sm font-medium mb-1">Mot de passe</label>
                <input type="password" required minLength="6" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
            )}
            {msg && <div className={'text-sm rounded-lg p-3 ' + (msgType === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200')}>{msg}</div>}
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-50">
              {busy && <i className="fas fa-circle-notch fa-spin mr-2" />}
              {mode === 'login' ? 'Se connecter' : mode === 'register' ? 'Créer mon compte' : 'Envoyer l\'email'}
            </button>
          </form>
          <div className="text-center text-sm space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            {mode === 'login' && (<>
              <div><button onClick={() => setMode('reset')} className="text-brand-600 hover:underline">Mot de passe oublié ?</button></div>
              <div>Pas de compte ? <button onClick={() => setMode('register')} className="text-brand-600 hover:underline font-medium">Créer un compte</button></div>
            </>)}
            {mode === 'register' && <div>Déjà inscrit ? <button onClick={() => setMode('login')} className="text-brand-600 hover:underline font-medium">Se connecter</button></div>}
            {mode === 'reset' && <div><button onClick={() => setMode('login')} className="text-brand-600 hover:underline">← Retour</button></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  APP PRINCIPALE — WEB RADIO COLLÈGE                                ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Dépôt codé en dur (voir js/config.js)                            ║
 * ║  Auth Firebase + commentaires Supabase                             ║
 * ║  Logs détaillés dans la console navigateur (F12 → Console)        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';

import { REPO, SITE, isAdmin } from './config.js';
import { logger } from './logger.js';
import { listContents, humanFileSize, mediaId } from './github-api.js';
import {
  loginWithEmail, registerWithEmail, resetPassword,
  loginWithGoogle, loginWithApple, loginWithGitHub, loginWithYahoo,
  sendSmsCode, verifySmsCode,
  logout, onAuthChanged, translateError, isAuthReady, getInitError,
} from './auth.js';
import {
  getCommentsForMedia, postComment, deleteComment, getAllComments,
} from './comments.js';

const html = htm.bind(React.createElement);

// ═══════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════
function Header({ user, onLogin, onLogout, onOpenAdmin, onToggleTheme, loading }) {
  const adminUser = user && isAdmin(user.email, user.phoneNumber);
  return html`
    <header class="sticky top-0 z-40 backdrop-blur bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-lg">
            <i class="fas fa-microphone-lines text-xl"></i>
          </div>
          <div class="min-w-0">
            <h1 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">${SITE.title}</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${SITE.subtitle}</p>
          </div>
        </div>

        <button onClick=${onToggleTheme} class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Thème" aria-label="Basculer le thème">
          <i class="fas fa-moon dark:hidden"></i>
          <i class="fas fa-sun hidden dark:inline"></i>
        </button>

        ${adminUser && html`
          <button onClick=${onOpenAdmin} class="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-white transition shadow-sm">
            <i class="fas fa-user-shield"></i> Admin
          </button>
        `}

        ${user ? html`
          <div class="flex items-center gap-2">
            <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              ${user.photoURL
                ? html`<img src=${user.photoURL} alt="" class="w-6 h-6 rounded-full" referrerpolicy="no-referrer" />`
                : html`<div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">${(user?.displayName || user?.email || '?')[0].toUpperCase()}</div>`}
              <span class="text-sm font-medium truncate max-w-[140px]">${user?.displayName || user?.email || ''}</span>
              ${adminUser && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
            </div>
            <button onClick=${onLogout} class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 transition" title="Déconnexion">
              <i class="fas fa-right-from-bracket"></i>
            </button>
          </div>
        ` : html`
          <button onClick=${onLogin} class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-brand-600 hover:bg-brand-700 text-white transition shadow-sm">
            <i class="fas fa-right-to-bracket"></i>
            <span class="hidden sm:inline">Se connecter</span>
          </button>
        `}
      </div>
    </header>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MODAL DE CONNEXION (Email • Google • Apple/Game Center • Phone •
//                    GitHub • Yahoo)
// ═══════════════════════════════════════════════════════════════════
function AuthModal({ open, onClose }) {
  // Onglets : 'quick' (boutons OAuth + phone) | 'email' (login/register/reset) | 'phone' (SMS) | 'code' (OTP)
  const [tab, setTab] = useState('quick');
  const [emailMode, setEmailMode] = useState('login'); // login | register | reset

  // Email form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Phone form
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState('error');

  useEffect(() => {
    if (open) {
      setMsg(null); setCode(''); setPassword('');
      setTab('quick'); setEmailMode('login');
    }
  }, [open]);

  if (!open) return null;

  const showError = (err) => {
    setMsgType('error');
    setMsg(translateError(err.code) + (err.code ? ` (${err.code})` : ''));
  };

  // ── Fournisseurs OAuth (popup) ──
  const oauth = (fn, label) => async () => {
    setBusy(true); setMsg(null);
    try { await fn(); onClose(); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  // ── Email ──
  const handleEmail = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (emailMode === 'login') await loginWithEmail(email, password);
      else if (emailMode === 'register') await registerWithEmail(email, password, displayName);
      else if (emailMode === 'reset') {
        await resetPassword(email);
        setMsgType('success'); setMsg('Email de réinitialisation envoyé !');
        setBusy(false); return;
      }
      onClose();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  // ── Phone ──
  const handleSendSms = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const conf = await sendSmsCode(phone, 'recaptcha-container');
      setConfirmation(conf);
      setTab('code');
      setMsgType('success'); setMsg('SMS envoyé ! Saisissez le code à 6 chiffres reçu.');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await verifySmsCode(confirmation, code.trim(), displayName.trim() || null);
      onClose();
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const msgBlock = msg && html`
    <div class=${'text-sm rounded-lg p-3 ' + (msgType === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200')}>
      ${msg}
    </div>
  `;

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick=${onClose}>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 class="text-xl font-bold">
            ${tab === 'quick' ? '🔑 Se connecter'
              : tab === 'email' ? (emailMode === 'login' ? '📧 Connexion email' : emailMode === 'register' ? '✨ Créer un compte' : '🔓 Mot de passe oublié')
              : tab === 'phone' ? '📱 Connexion par SMS'
              : '🔐 Code de vérification'}
          </h2>
          <button onClick=${onClose} class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Fermer">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div class="p-5 space-y-3">
          ${tab === 'quick' && html`
            <p class="text-sm text-slate-500 dark:text-slate-400 text-center mb-1">
              Choisissez votre méthode de connexion
            </p>

            <!-- Google -->
            <button onClick=${oauth(loginWithGoogle, 'Google')} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continuer avec Google
            </button>

            <!-- Apple / Game Center -->
            <button onClick=${oauth(loginWithApple, 'Apple')} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-black text-white hover:bg-slate-900 font-medium transition disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Continuer avec Apple / Game Center
            </button>

            <!-- GitHub -->
            <button onClick=${oauth(loginWithGitHub, 'GitHub')} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-medium transition disabled:opacity-50">
              <i class="fab fa-github text-xl"></i>
              Continuer avec GitHub
            </button>

            <!-- Yahoo -->
            <button onClick=${oauth(loginWithYahoo, 'Yahoo')} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition disabled:opacity-50">
              <i class="fab fa-yahoo text-xl"></i>
              Continuer avec Yahoo
            </button>

            <div class="flex items-center gap-3 my-2">
              <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
              <span class="text-xs text-slate-500">ou</span>
              <div class="flex-1 h-px bg-slate-200 dark:bg-slate-700"></div>
            </div>

            <!-- Téléphone -->
            <button onClick=${() => { setTab('phone'); setMsg(null); }} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50">
              <i class="fas fa-mobile-screen text-lg"></i>
              Continuer avec un numéro de téléphone
            </button>

            <!-- Email -->
            <button onClick=${() => { setTab('email'); setMsg(null); }} disabled=${busy} class="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-50">
              <i class="fas fa-envelope text-lg"></i>
              Continuer avec email + mot de passe
            </button>

            ${msgBlock}
          `}

          ${tab === 'email' && html`
            <button onClick=${() => { setTab('quick'); setMsg(null); }} class="text-sm text-slate-500 hover:text-brand-600 mb-2"><i class="fas fa-arrow-left mr-1"></i>Autres méthodes</button>

            <form onSubmit=${handleEmail} class="space-y-3">
              ${emailMode === 'register' && html`
                <div>
                  <label for="auth-name" class="block text-sm font-medium mb-1">Votre nom (affiché sur les commentaires)</label>
                  <input id="auth-name" name="name" type="text" autocomplete="name" required value=${displayName} onInput=${(e) => setDisplayName(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              `}
              <div>
                <label for="auth-email" class="block text-sm font-medium mb-1">Email</label>
                <input id="auth-email" name="email" type="email" autocomplete="email" required value=${email} onInput=${(e) => setEmail(e.target.value)}
                  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              ${emailMode !== 'reset' && html`
                <div>
                  <label for="auth-pwd" class="block text-sm font-medium mb-1">Mot de passe</label>
                  <input id="auth-pwd" name="password" type="password" autocomplete=${emailMode === 'register' ? 'new-password' : 'current-password'} required minlength="6"
                    value=${password} onInput=${(e) => setPassword(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                </div>
              `}

              ${msgBlock}

              <button type="submit" disabled=${busy} class="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>` : ''}
                ${emailMode === 'login' ? 'Se connecter' : emailMode === 'register' ? 'Créer mon compte' : 'Envoyer l\'email'}
              </button>
            </form>

            <div class="text-center text-sm space-y-2 pt-3 border-t border-slate-200 dark:border-slate-700">
              ${emailMode === 'login' && html`
                <div><button onClick=${() => setEmailMode('reset')} class="text-brand-600 hover:underline">Mot de passe oublié ?</button></div>
                <div>Pas de compte ? <button onClick=${() => setEmailMode('register')} class="text-brand-600 hover:underline font-medium">Créer un compte</button></div>
              `}
              ${emailMode === 'register' && html`<div>Déjà inscrit ? <button onClick=${() => setEmailMode('login')} class="text-brand-600 hover:underline font-medium">Se connecter</button></div>`}
              ${emailMode === 'reset' && html`<div><button onClick=${() => setEmailMode('login')} class="text-brand-600 hover:underline">← Retour à la connexion</button></div>`}
            </div>
          `}

          ${tab === 'phone' && html`
            <button onClick=${() => { setTab('quick'); setMsg(null); }} class="text-sm text-slate-500 hover:text-brand-600 mb-2"><i class="fas fa-arrow-left mr-1"></i>Autres méthodes</button>
            <p class="text-sm text-slate-500 dark:text-slate-400">Recevez un code par SMS. Aucun mot de passe requis.</p>
            <form onSubmit=${handleSendSms} class="space-y-3">
              <div>
                <label for="auth-name2" class="block text-sm font-medium mb-1">Votre nom <span class="text-slate-400">(optionnel)</span></label>
                <input id="auth-name2" name="name" type="text" autocomplete="name" value=${displayName} onInput=${(e) => setDisplayName(e.target.value)} placeholder="Ex. Jean Dupont"
                  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              <div>
                <label for="auth-phone" class="block text-sm font-medium mb-1">Numéro de téléphone</label>
                <input id="auth-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required value=${phone} onInput=${(e) => setPhone(e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                <p class="text-xs text-slate-500 mt-1">Format international (+33…). Un numéro FR commençant par 0 est accepté.</p>
              </div>
              ${msgBlock}
              <button type="submit" disabled=${busy} class="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>Envoi...` : html`<i class="fas fa-paper-plane mr-2"></i>Recevoir le code par SMS`}
              </button>
            </form>
          `}

          ${tab === 'code' && html`
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Un code à 6 chiffres a été envoyé au <strong>${phone}</strong>.
            </p>
            <form onSubmit=${handleVerifyCode} class="space-y-3">
              <div>
                <label for="auth-code" class="block text-sm font-medium mb-1">Code SMS</label>
                <input id="auth-code" name="otp" type="text" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required
                  value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  class="w-full px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              </div>
              ${msgBlock}
              <button type="submit" disabled=${busy || code.length !== 6} class="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>Vérification...` : html`<i class="fas fa-check mr-2"></i>Valider le code`}
              </button>
              <button type="button" onClick=${() => { setTab('phone'); setCode(''); setMsg(null); }} class="w-full text-sm text-slate-500 hover:text-brand-600">
                ← Changer de numéro
              </button>
            </form>
          `}

          <!-- Conteneur invisible requis par Firebase reCAPTCHA -->
          <div id="recaptcha-container"></div>

          <p class="text-xs text-slate-400 text-center pt-2 border-t border-slate-200 dark:border-slate-700">
            🔒 Connexion uniquement requise pour laisser un commentaire.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// BREADCRUMB
// ═══════════════════════════════════════════════════════════════════
function Breadcrumb({ path, onNavigate }) {
  const segments = path.split('/').filter(Boolean);
  // Ignorer le segment "rootPath" pour l'affichage, tout en gardant la navigation
  const rootSegs = REPO.rootPath.split('/').filter(Boolean);
  const displaySegs = segments.slice(rootSegs.length);
  return html`
    <nav aria-label="Fil d'Ariane" class="flex items-center gap-1 text-sm flex-wrap">
      <button onClick=${() => onNavigate(REPO.rootPath)} class="px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-500 font-medium">
        <i class="fas fa-house mr-1"></i>Accueil
      </button>
      ${displaySegs.map((seg, i) => {
        const target = [...rootSegs, ...displaySegs.slice(0, i + 1)].join('/');
        const isLast = i === displaySegs.length - 1;
        return html`
          <span key=${i} class="flex items-center gap-1">
            <i class="fas fa-chevron-right text-xs text-slate-400"></i>
            <button onClick=${() => !isLast && onNavigate(target)} disabled=${isLast} class=${'px-2 py-1 rounded ' + (isLast ? 'text-slate-700 dark:text-slate-200 font-medium' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-brand-600 dark:text-brand-500')}>
              ${decodeURIComponent(seg)}
            </button>
          </span>
        `;
      })}
    </nav>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🎧 LECTEUR AUDIO CUSTOM (style moderne, type Spotify)
// ═══════════════════════════════════════════════════════════════════
function AudioPlayer({ src, cover, title }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVolume, setShowVolume] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onLoaded = () => { setDuration(a.duration); setLoading(false); };
    const onTime = () => setTime(a.currentTime);
    const onEnd = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('waiting', onWaiting);
    a.addEventListener('playing', onPlaying);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('waiting', onWaiting);
      a.removeEventListener('playing', onPlaying);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };
  const seek = (e) => {
    const a = audioRef.current; if (!a || !duration) return;
    a.currentTime = Number(e.target.value);
  };
  const skip = (delta) => {
    const a = audioRef.current; if (!a) return;
    a.currentTime = Math.max(0, Math.min(duration, a.currentTime + delta));
  };
  const onVolume = (e) => {
    const v = Number(e.target.value);
    setVolume(v); setMuted(v === 0);
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
  };
  const toggleMute = () => {
    const m = !muted; setMuted(m);
    if (audioRef.current) audioRef.current.muted = m;
  };

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  const progress = duration ? (time / duration) * 100 : 0;

  return html`
    <div class="audio-player rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
      <div class="flex items-center gap-3 p-3">
        <!-- Cover -->
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center shadow">
          ${cover
            ? html`<img src=${cover} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => e.target.style.display='none'} />`
            : html`<i class="fas fa-music text-2xl text-slate-400"></i>`}
        </div>

        <!-- Bouton Play -->
        <button onClick=${toggle} class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white text-slate-900 hover:scale-105 active:scale-95 transition flex items-center justify-center shadow-xl flex-shrink-0">
          ${loading ? html`<i class="fas fa-circle-notch fa-spin text-lg"></i>`
            : playing ? html`<i class="fas fa-pause text-xl"></i>`
            : html`<i class="fas fa-play text-xl ml-1"></i>`}
        </button>

        <!-- Skip -10s -->
        <button onClick=${() => skip(-10)} class="hidden sm:flex w-9 h-9 rounded-full hover:bg-white/10 items-center justify-center" title="-10s">
          <i class="fas fa-rotate-left text-sm"></i>
        </button>
        <!-- Skip +30s -->
        <button onClick=${() => skip(30)} class="hidden sm:flex w-9 h-9 rounded-full hover:bg-white/10 items-center justify-center" title="+30s">
          <i class="fas fa-rotate-right text-sm"></i>
        </button>

        <!-- Progress + temps -->
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="text-xs sm:text-sm font-medium truncate" title=${title}>${title || ''}</div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] sm:text-xs font-mono text-slate-300 tabular-nums w-10 text-right">${fmt(time)}</span>
            <div class="flex-1 relative group">
              <div class="h-1 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-emerald-400 to-brand-400 transition-all" style=${{ width: progress + '%' }}></div>
              </div>
              <input type="range" min="0" max=${duration || 0} step="0.01" value=${time} onInput=${seek}
                class="absolute inset-0 w-full opacity-0 cursor-pointer" aria-label="Progression" />
            </div>
            <span class="text-[10px] sm:text-xs font-mono text-slate-300 tabular-nums w-10">${fmt(duration)}</span>
          </div>
        </div>

        <!-- Volume -->
        <div class="relative flex-shrink-0" onMouseEnter=${() => setShowVolume(true)} onMouseLeave=${() => setShowVolume(false)}>
          <button onClick=${toggleMute} class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" title="Volume">
            <i class=${'fas ' + (muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high')}></i>
          </button>
          ${showVolume && html`
            <div class="absolute bottom-full right-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
              <input type="range" min="0" max="1" step="0.01" value=${muted ? 0 : volume} onInput=${onVolume}
                class="w-24 accent-brand-500" aria-label="Volume" orient="horizontal" />
            </div>
          `}
        </div>
      </div>

      <audio ref=${audioRef} src=${src} preload="metadata" class="hidden"></audio>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// ▶ PLAYER YOUTUBE NON-RÉPERTORIÉ (sans branding YT excessif)
// ═══════════════════════════════════════════════════════════════════
function YouTubePlayer({ youTubeId, title, cover }) {
  const [show, setShow] = useState(false);
  // Paramètres pour minimiser le branding YT
  const ytSrc = `https://www.youtube-nocookie.com/embed/${youTubeId}?rel=0&modestbranding=1&showinfo=0&playsinline=1&autoplay=1`;

  if (!show) {
    // Vignette cliquable (cover si fournie, sinon thumb YT)
    const thumb = cover || `https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`;
    return html`
      <button onClick=${() => setShow(true)} class="relative w-full aspect-video rounded-lg overflow-hidden bg-black group">
        <img src=${thumb} alt=${title || ''} class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" referrerpolicy="no-referrer" />
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
            <i class="fas fa-play text-2xl ml-1"></i>
          </div>
        </div>
      </button>
    `;
  }
  return html`
    <div class="aspect-video rounded-lg overflow-hidden bg-black">
      <iframe
        src=${ytSrc}
        title=${title || 'Vidéo'}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        class="w-full h-full border-0"
      ></iframe>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 📁 FOLDER CARD DÉPLIANT (clic = ouvre + déroule contenu)
// ═══════════════════════════════════════════════════════════════════
function FolderCard({ folder, user, onOpenAuth }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [expandedFile, setExpandedFile] = useState(null);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (data.files.length || data.folders.length) return; // déjà chargé
    setLoading(true); setErr(null);
    try {
      const r = await listContents(folder.path);
      setData(r);
    } catch (e) {
      setErr(e.message);
    } finally { setLoading(false); }
  };

  return html`
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition">
      <button onClick=${toggle} class="w-full text-left p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
        <div class="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl flex-shrink-0">
          <i class=${'fas ' + (open ? 'fa-folder-open' : 'fa-folder')}></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate">${folder.name}</div>
          <div class="text-xs text-slate-500">
            ${open ? (loading ? 'Chargement…' : `${data.folders.length} sous-dossier(s) • ${data.files.length} média(s)`) : 'Cliquer pour ouvrir'}
          </div>
        </div>
        <i class=${'fas fa-chevron-down text-slate-400 transition-transform ' + (open ? 'rotate-180' : '')}></i>
      </button>

      ${open && html`
        <div class="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/30 fade-in">
          ${loading && html`<div class="text-center py-6"><div class="spinner w-8 h-8 mx-auto"></div></div>`}
          ${err && html`<div class="text-rose-600 text-sm">${err}</div>`}
          ${!loading && !err && data.folders.length === 0 && data.files.length === 0 && html`
            <div class="text-center text-slate-500 text-sm py-4"><i class="fas fa-folder-open text-2xl mb-2 block opacity-30"></i>Dossier vide</div>
          `}
          ${data.folders.length > 0 && html`
            <div class="space-y-2 mb-3">
              ${data.folders.map((sub) => html`<${FolderCard} key=${sub.sha} folder=${sub} user=${user} onOpenAuth=${onOpenAuth} />`)}
            </div>
          `}
          ${data.files.length > 0 && html`
            <div class="space-y-3">
              ${data.files.map((f) => html`
                <${FileCard} key=${f.sha} file=${f} user=${user}
                  expanded=${expandedFile === f.sha}
                  onToggleExpand=${() => setExpandedFile(expandedFile === f.sha ? null : f.sha)}
                  onOpenAuth=${onOpenAuth}
                />
              `)}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// FILE CARD + COMMENTAIRES
// ═══════════════════════════════════════════════════════════════════
function FileCard({ file, user, onOpenAuth, expanded, onToggleExpand }) {
  const isAudio   = file.mediaType === 'audio';
  const isVideo   = file.mediaType === 'video';
  const isYouTube = file.mediaType === 'youtube';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const mId = mediaId(file);
  // Nom propre (sans extension) pour l'affichage
  const cleanName = isYouTube ? file.name : file.name.replace(/\.[^.]+$/, '');

  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const data = await getCommentsForMedia(mId);
      setComments(data);
    } catch (err) {
      logger.error('Chargement commentaires impossible', { err: err.message });
    } finally { setLoadingComments(false); }
  }, [mId]);

  useEffect(() => {
    if (expanded && comments.length === 0 && !loadingComments) loadComments();
  }, [expanded]); // eslint-disable-line

  const handlePost = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    setPosting(true);
    try {
      await postComment({ mediaId: mId, mediaName: file.name, user, content: newComment });
      setNewComment('');
      await loadComments();
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally { setPosting(false); }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await deleteComment(commentId);
      setComments((c) => c.filter((x) => x.id !== commentId));
    } catch (err) { alert('Erreur : ' + err.message); }
  };

  // Couleur du badge selon le type
  const typeColor = isAudio ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : isYouTube ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400';
  const typeIcon = isAudio ? 'fa-podcast' : isYouTube ? 'fa-play' : 'fa-film';
  const typeLabel = isAudio ? 'Podcast' : isYouTube ? 'Vidéo' : 'Reportage';

  return html`
    <article class="media-card bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="p-4">
        <div class="flex items-start gap-3 mb-3">
          <div class=${'w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0 overflow-hidden ' + typeColor}>
            ${file.cover
              ? html`<img src=${file.cover} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
              : html`<i class=${'fas ' + typeIcon}></i>`}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-semibold truncate" title=${cleanName}>${cleanName}</div>
            <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              ${!isYouTube && html`<span class="uppercase font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">${ext}</span>`}
              ${!isYouTube && file.size > 0 && html`<span>${humanFileSize(file.size)}</span><span>•</span>`}
              <span class="capitalize">${typeLabel}</span>
              ${file.cover && html`<span class="text-emerald-600 dark:text-emerald-400" title=${'Cover : ' + file.coverName}><i class="fas fa-image text-[10px]"></i></span>`}
            </div>
          </div>
        </div>

        <!-- Lecteur intégré -->
        <div>
          ${isAudio && html`<${AudioPlayer} src=${file.downloadUrl} cover=${file.cover} title=${cleanName} />`}
          ${isVideo && html`
            <video src=${file.downloadUrl} controls playsinline preload="metadata"
              poster=${file.cover || undefined}
              class="w-full max-h-96 rounded-lg bg-black"></video>
          `}
          ${isYouTube && html`<${YouTubePlayer} youTubeId=${file.youTubeId} title=${cleanName} cover=${file.cover} />`}
        </div>

        <div class="mt-3 flex items-center gap-2 flex-wrap">
          ${!isYouTube && html`
            <a href=${file.downloadUrl} download=${file.name} rel="noopener noreferrer" onClick=${() => logger.info('📥 Téléchargement', { file: file.name })} class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white transition">
              <i class="fas fa-download"></i> Télécharger
            </a>
          `}
          ${isYouTube && html`
            <a href=${file.downloadUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition">
              <i class="fas fa-external-link-alt"></i> Ouvrir directement
            </a>
          `}
          <button onClick=${onToggleExpand} class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
            <i class=${'fas ' + (expanded ? 'fa-comment-slash' : 'fa-comments')}></i>
            ${expanded ? 'Masquer les commentaires' : 'Commentaires'}
            ${comments.length > 0 && html`<span class="bg-brand-600 text-white text-xs px-1.5 py-0.5 rounded-full">${comments.length}</span>`}
          </button>
        </div>
      </div>

      <!-- Zone commentaires -->
      ${expanded && html`
        <div class="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4 fade-in">
          ${user ? html`
            <form onSubmit=${handlePost} class="mb-4 flex gap-2">
              <div class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                ${(user.displayName || user.email)[0].toUpperCase()}
              </div>
              <div class="flex-1 flex gap-2">
                <textarea value=${newComment} onInput=${(e) => setNewComment(e.target.value)} placeholder="Laissez un commentaire..." rows="2" maxlength="2000" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
                <button type="submit" disabled=${posting || !newComment.trim()} class="self-end px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap">
                  ${posting ? html`<i class="fas fa-circle-notch fa-spin"></i>` : html`<i class="fas fa-paper-plane mr-1"></i>Publier`}
                </button>
              </div>
            </form>
          ` : html`
            <div class="mb-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
              <p class="text-sm text-slate-600 dark:text-slate-400 mb-2">Connectez-vous pour laisser un commentaire.</p>
              <button onClick=${onOpenAuth} class="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium">
                <i class="fas fa-right-to-bracket mr-1"></i>Se connecter
              </button>
            </div>
          `}

          ${loadingComments ? html`
            <div class="text-center text-slate-500 py-4"><div class="spinner w-6 h-6 mx-auto"></div></div>
          ` : comments.length === 0 ? html`
            <div class="text-center text-slate-500 text-sm py-4"><i class="fas fa-comment-dots text-2xl mb-2 block opacity-30"></i>Aucun commentaire pour le moment. Soyez le premier !</div>
          ` : html`
            <ul class="space-y-3">
              ${comments.map((c) => {
                const canDelete = user && (isAdmin(user.email, user.phoneNumber) || user.uid === c.user_uid);
                const cIsAdmin = isAdmin(c.user_email, c.user_phone);
                return html`
                  <li key=${c.id} class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div class="flex items-start gap-3">
                      <div class=${'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (cIsAdmin ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white')}>
                        ${(c.user_name || c.user_email || '?')[0].toUpperCase()}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-baseline gap-2 flex-wrap">
                          <span class="font-semibold text-sm">${c.user_name || c.user_email}</span>
                          ${cIsAdmin && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
                          <span class="text-xs text-slate-500">${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                        </div>
                        <p class="text-sm mt-1 whitespace-pre-wrap break-words">${c.content}</p>
                      </div>
                      ${canDelete && html`
                        <button onClick=${() => handleDelete(c.id)} class="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600 flex-shrink-0" title="Supprimer">
                          <i class="fas fa-trash text-xs"></i>
                        </button>
                      `}
                    </div>
                  </li>
                `;
              })}
            </ul>
          `}
        </div>
      `}
    </article>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// PANNEAU ADMIN
// ═══════════════════════════════════════════════════════════════════
function AdminPanel({ open, onClose }) {
  const [allComments, setAllComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllComments(500);
      setAllComments(data);
    } catch (err) { alert('Erreur : ' + err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  if (!open) return null;

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await deleteComment(id);
      setAllComments((c) => c.filter((x) => x.id !== id));
    } catch (err) { alert('Erreur : ' + err.message); }
  };

  const filtered = search
    ? allComments.filter((c) => (c.content + ' ' + c.user_email + ' ' + c.media_name).toLowerCase().includes(search.toLowerCase()))
    : allComments;

  // Group by media
  const byMedia = {};
  filtered.forEach((c) => {
    const k = c.media_id;
    if (!byMedia[k]) byMedia[k] = { media_name: c.media_name, comments: [] };
    byMedia[k].comments.push(c);
  });

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick=${onClose}>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick=${(e) => e.stopPropagation()}>
        <div class="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <i class="fas fa-user-shield text-amber-500"></i>
            Panneau d'administration
            <span class="text-sm font-normal text-slate-500">(${allComments.length} commentaires)</span>
          </h2>
          <div class="flex items-center gap-2">
            <button onClick=${load} class="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600" title="Rafraîchir">
              <i class=${'fas fa-rotate ' + (loading ? 'fa-spin' : '')}></i>
            </button>
            <button onClick=${onClose} class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Fermer">
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>

        <div class="p-4 border-b border-slate-200 dark:border-slate-700">
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input value=${search} onInput=${(e) => setSearch(e.target.value)} placeholder="Rechercher un commentaire, un email, un média..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4">
          ${loading ? html`
            <div class="text-center py-10"><div class="spinner w-10 h-10 mx-auto"></div></div>
          ` : Object.keys(byMedia).length === 0 ? html`
            <div class="text-center py-10 text-slate-500"><i class="fas fa-inbox text-4xl mb-2 block opacity-30"></i>Aucun commentaire</div>
          ` : html`
            <div class="space-y-6">
              ${Object.entries(byMedia).map(([mId, grp]) => html`
                <section key=${mId}>
                  <h3 class="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                    <i class="fas fa-file-audio mr-1 text-brand-500"></i>${grp.media_name}
                    <span class="ml-2 text-xs font-normal text-slate-500">${grp.comments.length} commentaire(s)</span>
                  </h3>
                  <ul class="space-y-2">
                    ${grp.comments.map((c) => html`
                      <li key=${c.id} class="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div class="flex items-start gap-3">
                          <div class=${'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (isAdmin(c.user_email, c.user_phone) ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white')}>
                            ${(c.user_name || '?')[0].toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-baseline gap-2 flex-wrap text-sm">
                              <span class="font-semibold">${c.user_name}</span>
                              <span class="text-xs text-slate-500">${c.user_email}</span>
                              ${isAdmin(c.user_email, c.user_phone) && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
                              <span class="text-xs text-slate-500">• ${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                            </div>
                            <p class="text-sm mt-1 whitespace-pre-wrap break-words">${c.content}</p>
                          </div>
                          <button onClick=${() => handleDelete(c.id)} class="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600" title="Supprimer">
                            <i class="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      </li>
                    `)}
                  </ul>
                </section>
              `)}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
function App() {
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
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

  // Thème
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Firebase Auth listener
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthChanged((u) => { setUser(u); setAuthLoaded(true); });
    } catch (err) {
      logger.error('Auth non disponible', { err: err.message });
      setAuthLoaded(true);
    }
    return () => unsub();
  }, []);

  // Chargement du dossier courant
  const load = useCallback(async (path) => {
    setLoading(true); setError(null);
    try {
      const result = await listContents(path);
      setData(result);
    } catch (e) {
      logger.error('Échec du chargement', { error: e.message });
      setError(e.message);
      setData({ folders: [], files: [] });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(currentPath); }, [currentPath, load]);

  const navigate = (path) => {
    setCurrentPath(path);
    setExpandedFile(null);
    const url = new URL(window.location.href);
    if (path !== REPO.rootPath) url.searchParams.set('path', path);
    else url.searchParams.delete('path');
    window.history.replaceState({}, '', url.toString());
  };

  return html`
    <div class="pb-12 min-h-screen">
      <${Header}
        user=${user}
        loading=${loading}
        onLogin=${() => setAuthOpen(true)}
        onLogout=${async () => { await logout(); }}
        onOpenAdmin=${() => setAdminOpen(true)}
        onToggleTheme=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <main class="max-w-6xl mx-auto px-4 py-6">
        <div class="mb-5 flex items-center justify-between gap-3 flex-wrap">
          <${Breadcrumb} path=${currentPath} onNavigate=${navigate} />
          ${loading && html`<div class="flex items-center gap-2 text-sm text-slate-500"><div class="spinner w-4 h-4"></div> Chargement...</div>`}
        </div>

        ${error && html`
          <div class="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700 text-rose-800 dark:text-rose-200 rounded-xl p-4 mb-4 fade-in">
            <div class="flex items-start gap-2">
              <i class="fas fa-triangle-exclamation mt-1"></i>
              <div class="flex-1">
                <div class="font-semibold">Impossible de charger le contenu</div>
                <div class="text-sm">${error}</div>
                <div class="text-xs mt-2 text-rose-700/80 dark:text-rose-300/80">Ouvrez la console du navigateur (F12) pour plus de détails.</div>
              </div>
              <button onClick=${() => load(currentPath)} class="px-3 py-1 rounded bg-rose-600 text-white text-sm hover:bg-rose-700"><i class="fas fa-rotate mr-1"></i>Réessayer</button>
            </div>
          </div>
        `}

        ${!loading && !error && html`
          ${data.folders.length > 0 && html`
            <section class="mb-8">
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                <i class="fas fa-folder mr-1"></i>Catégories (${data.folders.length})
              </h3>
              <div class="space-y-3">
                ${data.folders.map((f) => html`<${FolderCard} key=${f.sha} folder=${f} user=${user} onOpenAuth=${() => setAuthOpen(true)} />`)}
              </div>
            </section>
          `}

          ${data.files.length > 0 ? html`
            <section>
              <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                <i class="fas fa-podcast mr-1"></i>Podcasts & Reportages (${data.files.length})
              </h3>
              <div class="space-y-4">
                ${data.files.map((f) => html`
                  <${FileCard}
                    key=${f.sha}
                    file=${f}
                    user=${user}
                    expanded=${expandedFile === f.sha}
                    onToggleExpand=${() => setExpandedFile(expandedFile === f.sha ? null : f.sha)}
                    onOpenAuth=${() => setAuthOpen(true)}
                  />
                `)}
              </div>
            </section>
          ` : (data.folders.length === 0 ? html`
            <div class="text-center py-20 text-slate-500">
              <i class="fas fa-inbox text-5xl mb-3 opacity-40"></i>
              <p class="font-medium">Aucun contenu disponible</p>
              <p class="text-sm mt-1">Ce dossier ne contient aucun podcast ni reportage pour l'instant.</p>
            </div>
          ` : '')}
        `}
      </main>

      <footer class="max-w-6xl mx-auto px-4 py-6 text-center text-xs text-slate-500 border-t border-slate-200 dark:border-slate-800">
        <p>🎙️ ${SITE.title} — ${SITE.description}</p>
        <p class="mt-1 opacity-70">Source : <a href=${'https://github.com/' + REPO.owner + '/' + REPO.repo} target="_blank" rel="noopener noreferrer" class="hover:underline">github.com/${REPO.owner}/${REPO.repo}</a> • Ouvrez la console (F12) pour voir les logs techniques.</p>
      </footer>

      <${AuthModal} open=${authOpen} onClose=${() => setAuthOpen(false)} />
      <${AdminPanel} open=${adminOpen && user && isAdmin(user.email, user.phoneNumber)} onClose=${() => setAdminOpen(false)} />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════════════════════════
logger.info(`🎙️ ${SITE.title} démarre`, {
  version: '3.0.0',
  repo: `${REPO.owner}/${REPO.repo}@${REPO.branch}`,
  rootPath: REPO.rootPath,
  authProviders: ['email', 'google', 'apple', 'phone', 'github', 'yahoo'],
});
logger.debug('User agent', { ua: navigator.userAgent });

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);

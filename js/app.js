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
  loginWithEmailOrUsername, registerWithEmail, resetPassword,
  loginWithGoogle, loginWithGitHub, loginWithYahoo,
  sendSmsCode, verifySmsCode,
  linkProvider, linkEmailPassword, linkPhoneStart, unlinkProvider,
  updateUserProfile,
  logout, onAuthChanged, translateError, isAuthReady, getInitError,
} from './auth.js';
import {
  getCommentsForMedia, postComment, deleteComment, getAllComments,
} from './comments.js';
import {
  getProfile, upsertProfile, syncProfileFromUser,
  reportComment, getAllReports, banUser, unbanUser, isUserBanned,
  REPORT_THRESHOLD,
} from './profile.js';
import { isAllowedImageUrl, COMMENT_MAX_LEN } from './moderation.js';

const html = htm.bind(React.createElement);

// ═══════════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════════
function Header({ user, profile, onLogin, onLogout, onOpenAdmin, onOpenProfile, onToggleTheme, loading }) {
  const adminUser = user && isAdmin(user.email, user.phoneNumber);
  const avatar = profile?.avatar_url || user?.photoURL;
  const displayHandle = profile?.username || user?.displayName || user?.email || (user?.phoneNumber ? '📱 ' + user.phoneNumber.slice(-4) : '');
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
            <button onClick=${onOpenProfile} class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Mon profil">
              ${avatar
                ? html`<img src=${avatar} alt="" class="w-6 h-6 rounded-full object-cover" referrerpolicy="no-referrer" />`
                : html`<div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">${(displayHandle || '?')[0].toUpperCase()}</div>`}
              <span class="text-sm font-medium truncate max-w-[140px]">${displayHandle}</span>
              ${adminUser && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
            </button>
            <button onClick=${onOpenProfile} class="sm:hidden p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition" title="Mon profil" aria-label="Mon profil">
              ${avatar
                ? html`<img src=${avatar} alt="" class="w-6 h-6 rounded-full object-cover" referrerpolicy="no-referrer" />`
                : html`<i class="fas fa-user"></i>`}
            </button>
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

  // ── Email / pseudo ──
  const handleEmail = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      if (emailMode === 'login') await loginWithEmailOrUsername(email, password);
      else if (emailMode === 'register') await registerWithEmail(email, password, displayName);
      else if (emailMode === 'reset') {
        await resetPassword(email);
        setMsgType('success'); setMsg('Si un compte existe, un email de réinitialisation a été envoyé.');
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
                <label for="auth-email" class="block text-sm font-medium mb-1">
                  ${emailMode === 'register' ? 'Email' : 'Email ou pseudo'}
                </label>
                <input id="auth-email" name=${emailMode === 'register' ? 'email' : 'username'} type=${emailMode === 'register' ? 'email' : 'text'}
                  autocomplete=${emailMode === 'register' ? 'email' : 'username'} required value=${email} onInput=${(e) => setEmail(e.target.value)}
                  placeholder=${emailMode === 'register' ? 'votre@email.fr' : 'pseudo ou email'}
                  class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                ${emailMode === 'login' && html`<p class="text-xs text-slate-500 mt-1">💡 Vous pouvez vous connecter avec votre pseudo OU votre email.</p>`}
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
            🔒 Connexion uniquement requise pour laisser un commentaire. Fermer la fenêtre vous laisse continuer la navigation normalement.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 👤 MODAL PROFIL UTILISATEUR (avatar, bio, pseudo, providers liés)
// ═══════════════════════════════════════════════════════════════════
function ProfileModal({ open, onClose, user, profile, onProfileUpdate }) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState('error');

  // Lien provider
  const [linkPhone, setLinkPhone] = useState('');
  const [linkCode, setLinkCode] = useState('');
  const [linkConf, setLinkConf] = useState(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPwd, setLinkPwd] = useState('');

  useEffect(() => {
    if (open && profile) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setAvatarUrl(profile.avatar_url || '');
      setMsg(null); setLinkPhone(''); setLinkCode(''); setLinkConf(null);
      setLinkEmail(''); setLinkPwd('');
    }
  }, [open, profile]);

  if (!open || !user) return null;

  const providers = (user.providerData || []).map((p) => p.providerId);
  const hasGoogle = providers.includes('google.com');
  const hasGitHub = providers.includes('github.com');
  const hasYahoo  = providers.includes('yahoo.com');
  const hasEmail  = providers.includes('password');
  const hasPhone  = providers.includes('phone');

  const handleSave = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const updated = await upsertProfile(user.uid, {
        username: username.trim(),
        bio: bio,
        avatar_url: avatarUrl.trim() || null,
      });
      // Sync displayName Firebase
      try { await updateUserProfile({ displayName: updated.username }); } catch (e) {}
      setMsgType('success'); setMsg('✓ Profil enregistré');
      onProfileUpdate?.(updated);
    } catch (err) {
      setMsgType('error'); setMsg(err.message || 'Erreur enregistrement');
    } finally { setBusy(false); }
  };

  const wrap = (fn) => async () => {
    setBusy(true); setMsg(null);
    try { await fn(); setMsgType('success'); setMsg('✓ Action effectuée'); }
    catch (err) { setMsgType('error'); setMsg(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };

  const handleLinkPhone = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const conf = await linkPhoneStart(linkPhone, 'profile-recaptcha');
      setLinkConf(conf);
      setMsgType('success'); setMsg('SMS envoyé. Saisissez le code à 6 chiffres.');
    } catch (err) { setMsgType('error'); setMsg(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };
  const handleConfirmPhone = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await linkConf.confirm(linkCode.trim());
      setLinkConf(null); setLinkPhone(''); setLinkCode('');
      setMsgType('success'); setMsg('✓ Téléphone lié au compte');
    } catch (err) { setMsgType('error'); setMsg(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };

  const handleLinkEmail = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await linkEmailPassword(linkEmail.trim(), linkPwd);
      setLinkEmail(''); setLinkPwd('');
      setMsgType('success'); setMsg('✓ Email/mot de passe lié au compte');
    } catch (err) { setMsgType('error'); setMsg(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };

  const msgBlock = msg && html`
    <div class=${'text-sm rounded-lg p-3 ' + (msgType === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200')}>
      ${msg}
    </div>
  `;

  const ProviderRow = ({ id, label, icon, linked, color }) => html`
    <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
      <div class="flex items-center gap-3">
        <i class=${icon + ' text-lg ' + color}></i>
        <span class="font-medium text-sm">${label}</span>
        ${linked && html`<span class="text-xs bg-emerald-500 text-white px-1.5 py-0.5 rounded">lié</span>`}
      </div>
      ${linked
        ? html`<button onClick=${wrap(() => unlinkProvider(id))} disabled=${busy || providers.length <= 1} class="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 disabled:opacity-50" title=${providers.length <= 1 ? 'Au moins une méthode requise' : 'Retirer'}>Retirer</button>`
        : id === 'google.com' ? html`<button onClick=${wrap(() => linkProvider('google'))} disabled=${busy} class="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Lier</button>`
        : id === 'github.com' ? html`<button onClick=${wrap(() => linkProvider('github'))} disabled=${busy} class="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Lier</button>`
        : id === 'yahoo.com'  ? html`<button onClick=${wrap(() => linkProvider('yahoo'))}  disabled=${busy} class="text-xs px-2 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">Lier</button>`
        : html`<span class="text-xs text-slate-400">utilise le formulaire ci-dessous</span>`}
    </div>
  `;

  const adminUser = isAdmin(user.email, user.phoneNumber);

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm fade-in" onClick=${onClose}>
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <i class="fas fa-user-circle text-brand-500"></i>
            Mon profil
            ${adminUser && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
          </h2>
          <button onClick=${onClose} class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg" aria-label="Fermer">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div class="p-5 space-y-5">
          <!-- Aperçu -->
          <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50">
            <div class="w-20 h-20 rounded-full overflow-hidden bg-brand-600 text-white flex items-center justify-center text-3xl font-bold flex-shrink-0">
              ${avatarUrl
                ? html`<img src=${avatarUrl} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
                : (username || '?')[0].toUpperCase()}
            </div>
            <div class="min-w-0">
              <div class="font-bold text-lg truncate">@${username || '...'}</div>
              <div class="text-xs text-slate-500 break-all">${user.email || user.phoneNumber || ''}</div>
              <div class="text-xs text-slate-400 mt-1">UID: <code class="font-mono">${user.uid.slice(0, 12)}…</code></div>
            </div>
          </div>

          <!-- Formulaire profil -->
          <form onSubmit=${handleSave} class="space-y-3">
            <div>
              <label for="prof-username" class="block text-sm font-medium mb-1">Pseudo unique <span class="text-rose-500">*</span></label>
              <input id="prof-username" type="text" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9._-]+"
                value=${username} onInput=${(e) => setUsername(e.target.value)}
                class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              <p class="text-xs text-slate-500 mt-1">3-20 caractères : lettres, chiffres, point, tiret, underscore. Insultes/contenus interdits filtrés automatiquement.</p>
            </div>
            <div>
              <label for="prof-avatar" class="block text-sm font-medium mb-1">URL de l'avatar (png, jpg, jpeg, gif, webp)</label>
              <input id="prof-avatar" type="url" placeholder="https://exemple.fr/photo.webp"
                value=${avatarUrl} onInput=${(e) => setAvatarUrl(e.target.value)}
                class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
              <p class="text-xs text-slate-500 mt-1">Hébergez votre image sur GitHub, Imgur, etc. Seules les extensions image autorisées sont acceptées.</p>
            </div>
            <div>
              <label for="prof-bio" class="block text-sm font-medium mb-1">Bio <span class="text-slate-400">(max 300 caractères)</span></label>
              <textarea id="prof-bio" rows="3" maxlength="300" value=${bio} onInput=${(e) => setBio(e.target.value)}
                placeholder="Présentez-vous en quelques mots…"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none resize-none"></textarea>
              <p class="text-xs text-slate-500 mt-1">${bio.length}/300 — Liens de phishing, contenu sexuel/violent/haineux interdit (modération automatique).</p>
            </div>

            ${msgBlock}

            <button type="submit" disabled=${busy} class="w-full py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition disabled:opacity-50">
              ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>` : html`<i class="fas fa-save mr-2"></i>`}
              Enregistrer mon profil
            </button>
          </form>

          <!-- Méthodes de connexion liées -->
          <div class="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <h3 class="font-bold text-sm uppercase tracking-wider text-slate-500">
              <i class="fas fa-link mr-1"></i>Méthodes de connexion liées
            </h3>
            <p class="text-xs text-slate-500">Liez plusieurs méthodes pour ne jamais perdre l'accès à votre compte.</p>
            <${ProviderRow} id="google.com" label="Google"  icon="fab fa-google"  color="text-blue-500"   linked=${hasGoogle} />
            <${ProviderRow} id="github.com" label="GitHub"  icon="fab fa-github"  color="text-slate-700 dark:text-slate-200" linked=${hasGitHub} />
            <${ProviderRow} id="yahoo.com"  label="Yahoo"   icon="fab fa-yahoo"   color="text-purple-500" linked=${hasYahoo} />
            <${ProviderRow} id="phone"      label="Téléphone (SMS)" icon="fas fa-mobile-screen" color="text-emerald-500" linked=${hasPhone} />
            <${ProviderRow} id="password"   label="Email + mot de passe" icon="fas fa-envelope" color="text-amber-500" linked=${hasEmail} />
          </div>

          <!-- Lier email/mot de passe -->
          ${!hasEmail && html`
            <form onSubmit=${handleLinkEmail} class="space-y-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <h4 class="text-sm font-semibold"><i class="fas fa-envelope mr-1 text-amber-500"></i>Lier un email + mot de passe</h4>
              <input type="email" required autocomplete="email" placeholder="email@exemple.fr"
                value=${linkEmail} onInput=${(e) => setLinkEmail(e.target.value)}
                class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
              <input type="password" required minlength="6" autocomplete="new-password" placeholder="Mot de passe (6+ caractères)"
                value=${linkPwd} onInput=${(e) => setLinkPwd(e.target.value)}
                class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
              <button type="submit" disabled=${busy} class="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-50">Lier</button>
            </form>
          `}

          <!-- Lier téléphone -->
          ${!hasPhone && html`
            <div class="space-y-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <h4 class="text-sm font-semibold"><i class="fas fa-mobile-screen mr-1 text-emerald-500"></i>Lier un numéro de téléphone</h4>
              ${!linkConf ? html`
                <form onSubmit=${handleLinkPhone} class="space-y-2">
                  <input type="tel" required autocomplete="tel" inputmode="tel" placeholder="+33 6 12 34 56 78"
                    value=${linkPhone} onInput=${(e) => setLinkPhone(e.target.value)}
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm" />
                  <button type="submit" disabled=${busy} class="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">Recevoir un code SMS</button>
                </form>
              ` : html`
                <form onSubmit=${handleConfirmPhone} class="space-y-2">
                  <input type="text" required autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
                    value=${linkCode} onInput=${(e) => setLinkCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    class="w-full px-3 py-2 text-center text-lg tracking-[0.4em] font-mono rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                  <button type="submit" disabled=${busy || linkCode.length !== 6} class="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">Valider le code</button>
                </form>
              `}
              <div id="profile-recaptcha"></div>
            </div>
          `}
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
            <div class="flex-1 relative h-4 flex items-center group">
              <!-- Piste visible -->
              <div class="absolute inset-x-0 h-2 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-emerald-400 to-brand-400 transition-all" style=${{ width: progress + '%' }}></div>
              </div>
              <!-- Petit cercle qui suit -->
              <div class="absolute w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none transition-all"
                style=${{ left: `calc(${progress}% - 6px)`, opacity: duration ? 1 : 0.3 }}></div>
              <!-- Slider invisible par-dessus -->
              <input type="range" min="0" max=${duration || 0} step="0.01" value=${time} onInput=${seek}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Progression" />
            </div>
            <span class="text-[10px] sm:text-xs font-mono text-slate-300 tabular-nums w-10">${fmt(duration)}</span>
          </div>
        </div>

        <!-- Volume (slider TOUJOURS visible sur desktop) -->
        <div class="hidden md:flex items-center gap-2 flex-shrink-0">
          <button onClick=${toggleMute} class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" title="Couper le son">
            <i class=${'fas ' + (muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high')}></i>
          </button>
          <input type="range" min="0" max="1" step="0.01" value=${muted ? 0 : volume} onInput=${onVolume}
            class="w-20 accent-brand-400" aria-label="Volume" />
        </div>
        <!-- Mobile : juste l'icône avec popover au tap -->
        <div class="md:hidden relative flex-shrink-0">
          <button onClick=${() => setShowVolume(!showVolume)} class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" title="Volume">
            <i class=${'fas ' + (muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high')}></i>
          </button>
          ${showVolume && html`
            <div class="absolute bottom-full right-0 mb-2 bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl z-10">
              <input type="range" min="0" max="1" step="0.01" value=${muted ? 0 : volume} onInput=${onVolume}
                class="w-24 accent-brand-400" aria-label="Volume" />
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
// 🎬 LECTEUR VIDÉO CUSTOM (avec cover overlay avant lecture)
// ═══════════════════════════════════════════════════════════════════
function VideoPlayer({ src, cover, title }) {
  const videoRef = useRef(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    setStarted(true);
    // Petit délai pour laisser React monter le <video>
    setTimeout(() => { videoRef.current?.play().catch(() => {}); }, 30);
  };

  if (!started && cover) {
    // Pré-vue avec cover et bouton play stylisé
    return html`
      <button onClick=${handlePlay} class="relative w-full aspect-video rounded-lg overflow-hidden bg-black group">
        <img src=${cover} alt=${title || ''} class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition" referrerpolicy="no-referrer" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 text-slate-900 flex items-center justify-center shadow-2xl group-hover:scale-110 transition">
            <i class="fas fa-play text-2xl sm:text-3xl ml-1"></i>
          </div>
        </div>
      </button>
    `;
  }

  return html`
    <video ref=${videoRef} src=${src} controls playsinline preload="metadata"
      poster=${cover || undefined}
      class="w-full max-h-96 rounded-lg bg-black"></video>
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
  const [revealed, setRevealed] = useState({}); // commentId -> bool

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

  const [postError, setPostError] = useState(null);
  const handlePost = async (e) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    setPosting(true); setPostError(null);
    try {
      await postComment({ mediaId: mId, mediaName: file.name, user, content: newComment });
      setNewComment('');
      await loadComments();
    } catch (err) {
      setPostError(err.message || 'Erreur lors de la publication.');
    } finally { setPosting(false); }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try {
      await deleteComment(commentId);
      setComments((c) => c.filter((x) => x.id !== commentId));
    } catch (err) { alert('Erreur : ' + err.message); }
  };

  const handleReport = async (commentId) => {
    if (!user) { onOpenAuth(); return; }
    const reason = prompt('Pourquoi signalez-vous ce commentaire ? (insulte, spam, lien dangereux…)');
    if (reason === null) return;
    try {
      const r = await reportComment({ commentId, reporterUid: user.uid, reason });
      if (r.duplicated) alert('Vous avez déjà signalé ce commentaire.');
      else alert('Signalement enregistré. Merci !');
      await loadComments();
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
          ${isVideo && html`<${VideoPlayer} src=${file.downloadUrl} cover=${file.cover} title=${cleanName} />`}
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
            <form onSubmit=${handlePost} class="mb-4">
              <div class="flex gap-2">
                <div class="w-9 h-9 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 overflow-hidden">
                  ${user.photoURL
                    ? html`<img src=${user.photoURL} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
                    : (user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
                <div class="flex-1 flex gap-2">
                  <textarea value=${newComment} onInput=${(e) => setNewComment(e.target.value.slice(0, COMMENT_MAX_LEN))} placeholder=${'Laissez un commentaire (max ' + COMMENT_MAX_LEN + ' caractères)…'} rows="2" maxlength=${COMMENT_MAX_LEN} class="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"></textarea>
                  <button type="submit" disabled=${posting || !newComment.trim()} class="self-end px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap">
                    ${posting ? html`<i class="fas fa-circle-notch fa-spin"></i>` : html`<i class="fas fa-paper-plane mr-1"></i>Publier`}
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between mt-1 text-xs">
                <span class=${'text-slate-500 ' + (newComment.length >= COMMENT_MAX_LEN * 0.9 ? 'text-amber-600' : '')}>${newComment.length}/${COMMENT_MAX_LEN}</span>
                <span class="text-slate-400">🛡️ Modération automatique active (anti‑insultes, anti‑spam, anti‑phishing)</span>
              </div>
              ${postError && html`<div class="mt-2 text-xs rounded-lg p-2 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-200"><i class="fas fa-shield-halved mr-1"></i>${postError}</div>`}
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
                const ownComment = user && user.uid === c.user_uid;
                const hidden = c.auto_hidden && !revealed[c.id] && !isAdmin(user?.email, user?.phoneNumber);
                return html`
                  <li key=${c.id} class=${'border rounded-lg p-3 ' + (c.auto_hidden ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700')}>
                    ${hidden ? html`
                      <div class="text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between gap-2 flex-wrap">
                        <span><i class="fas fa-eye-slash mr-1"></i>Commentaire masqué automatiquement (${c.report_count} signalements ≥ ${REPORT_THRESHOLD}).</span>
                        <button onClick=${() => setRevealed((r) => ({ ...r, [c.id]: true }))} class="text-xs underline hover:no-underline">Afficher quand même</button>
                      </div>
                    ` : html`
                      <div class="flex items-start gap-3">
                        <div class=${'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (cIsAdmin ? 'bg-amber-500 text-white' : 'bg-brand-600 text-white')}>
                          ${(c.user_name || c.user_email || '?')[0].toUpperCase()}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-baseline gap-2 flex-wrap">
                            <span class="font-semibold text-sm">${c.user_name || c.user_email}</span>
                            ${cIsAdmin && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
                            <span class="text-xs text-slate-500">${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                            ${c.report_count > 0 && html`<span class="text-xs text-rose-500" title=${c.report_count + ' signalement(s)'}><i class="fas fa-flag"></i> ${c.report_count}</span>`}
                          </div>
                          <p class="text-sm mt-1 whitespace-pre-wrap break-words">${c.content}</p>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                          ${user && !ownComment && html`
                            <button onClick=${() => handleReport(c.id)} class="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600" title="Signaler">
                              <i class="fas fa-flag text-xs"></i>
                            </button>
                          `}
                          ${canDelete && html`
                            <button onClick=${() => handleDelete(c.id)} class="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600" title="Supprimer">
                              <i class="fas fa-trash text-xs"></i>
                            </button>
                          `}
                        </div>
                      </div>
                    `}
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
  const [tab, setTab] = useState('comments'); // comments | reports
  const [allComments, setAllComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [data, reps] = await Promise.all([
        getAllComments(500),
        getAllReports().catch(() => []),
      ]);
      setAllComments(data);
      setReports(reps);
    } catch (err) { alert('Erreur : ' + err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  if (!open) return null;

  const handleBan = async (uid, name) => {
    const reason = prompt(`Bannir ${name || uid} ? Motif :`, 'Comportement abusif');
    if (reason === null) return;
    try {
      await banUser(uid, { reason });
      alert('Utilisateur banni.');
    } catch (err) { alert('Erreur : ' + err.message); }
  };
  const handleUnban = async (uid) => {
    if (!confirm('Débannir cet utilisateur ?')) return;
    try { await unbanUser(uid); alert('Utilisateur débanni.'); }
    catch (err) { alert('Erreur : ' + err.message); }
  };

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

        <div class="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <div class="flex gap-2">
            <button onClick=${() => setTab('comments')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'comments' ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600')}>
              <i class="fas fa-comments mr-1"></i>Commentaires (${allComments.length})
            </button>
            <button onClick=${() => setTab('reports')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'reports' ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600')}>
              <i class="fas fa-flag mr-1"></i>Signalements (${reports.length})
            </button>
          </div>
          ${tab === 'comments' && html`
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input value=${search} onInput=${(e) => setSearch(e.target.value)} placeholder="Rechercher un commentaire, un email, un média..." class="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
            </div>
          `}
        </div>

        <div class="flex-1 overflow-auto p-4">
          ${tab === 'reports' ? html`
            ${loading ? html`<div class="text-center py-10"><div class="spinner w-10 h-10 mx-auto"></div></div>`
              : reports.length === 0 ? html`<div class="text-center py-10 text-slate-500"><i class="fas fa-flag-checkered text-4xl mb-2 block opacity-30"></i>Aucun signalement</div>`
              : html`
                <div class="space-y-2">
                  ${(() => {
                    // Grouper par commentaire signalé
                    const grouped = {};
                    reports.forEach((r) => {
                      if (!grouped[r.comment_id]) grouped[r.comment_id] = [];
                      grouped[r.comment_id].push(r);
                    });
                    return Object.entries(grouped).map(([cid, reps]) => {
                      const com = allComments.find((c) => c.id === cid);
                      return html`
                        <div key=${cid} class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <div class="flex items-start justify-between gap-2 flex-wrap">
                            <div class="flex-1 min-w-0">
                              <div class="text-xs text-amber-700 dark:text-amber-300 font-bold mb-1">
                                <i class="fas fa-flag"></i> ${reps.length} signalement(s) — ${com ? 'par ' + (com.user_name || com.user_email || com.user_uid?.slice(0,8)) : 'commentaire supprimé'}
                              </div>
                              ${com ? html`<p class="text-sm whitespace-pre-wrap break-words">${com.content}</p>` : ''}
                              <ul class="mt-2 space-y-1 text-xs">
                                ${reps.map((r) => html`<li key=${r.id}>• <span class="font-mono">${r.reporter_uid?.slice(0,8)}</span> — "${r.reason || '(pas de motif)'}" — ${new Date(r.created_at).toLocaleString('fr-FR')}</li>`)}
                              </ul>
                            </div>
                            <div class="flex flex-col gap-1">
                              ${com && html`<button onClick=${async () => { if (confirm('Supprimer ce commentaire ?')) { await deleteComment(com.id); load(); } }} class="text-xs px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white">Supprimer</button>`}
                              ${com && html`<button onClick=${() => handleBan(com.user_uid, com.user_name)} class="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-800 text-white">Bannir l'auteur</button>`}
                              ${com && html`<button onClick=${() => handleUnban(com.user_uid)} class="text-xs px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600">Débannir</button>`}
                            </div>
                          </div>
                        </div>
                      `;
                    });
                  })()}
                </div>
              `}
          ` : loading ? html`
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
                              <span class="text-xs text-slate-500">${c.user_email || c.user_phone || ''}</span>
                              ${isAdmin(c.user_email, c.user_phone) && html`<span class="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>`}
                              <span class="text-xs text-slate-500">• ${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                              <span class="text-xs text-slate-400 font-mono" title="UID Firebase">${c.user_uid?.slice(0, 8)}…</span>
                            </div>
                            <p class="text-sm mt-1 whitespace-pre-wrap break-words">${c.content}</p>
                          </div>
                          <div class="flex items-center gap-1">
                            <button onClick=${() => handleBan(c.user_uid, c.user_name)} class="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600" title="Bannir cet utilisateur">
                              <i class="fas fa-ban text-xs"></i>
                            </button>
                            <button onClick=${async () => { try { await deleteComment(c.id); setAllComments((arr) => arr.filter((x) => x.id !== c.id)); } catch (e) { alert('Erreur: ' + e.message); } }} class="p-1.5 rounded hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-600" title="Supprimer">
                              <i class="fas fa-trash text-xs"></i>
                            </button>
                          </div>
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
  const [profile, setProfile] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
      unsub = onAuthChanged(async (u) => {
        setUser(u);
        setAuthLoaded(true);
        if (u) {
          // Sync profil Supabase + cache local
          try {
            const p = await syncProfileFromUser(u);
            setProfile(p);
            const banned = await isUserBanned(u.uid);
            setIsBanned(banned);
            if (banned) logger.warn('🚫 Cet utilisateur est banni');
          } catch (e) {
            logger.warn('Sync profil impossible', { err: e.message });
          }
        } else {
          setProfile(null); setIsBanned(false);
        }
      });
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
        profile=${profile}
        loading=${loading}
        onLogin=${() => setAuthOpen(true)}
        onLogout=${async () => { await logout(); }}
        onOpenAdmin=${() => setAdminOpen(true)}
        onOpenProfile=${() => setProfileOpen(true)}
        onToggleTheme=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      ${isBanned && html`
        <div class="max-w-6xl mx-auto px-4 mt-3">
          <div class="bg-rose-100 dark:bg-rose-900/40 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 rounded-xl p-4 fade-in">
            <div class="font-bold flex items-center gap-2"><i class="fas fa-ban"></i>Compte suspendu</div>
            <div class="text-sm mt-1">Votre compte a été suspendu par un administrateur. Vous pouvez naviguer mais vous ne pouvez plus poster de commentaires.</div>
          </div>
        </div>
      `}

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
      <${ProfileModal} open=${profileOpen} onClose=${() => setProfileOpen(false)}
        user=${user} profile=${profile}
        onProfileUpdate=${(p) => setProfile(p)} />
      <${AdminPanel} open=${adminOpen && user && isAdmin(user.email, user.phoneNumber)} onClose=${() => setAdminOpen(false)} />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════════════════════════
logger.info(`🎙️ ${SITE.title} démarre`, {
  version: '4.0.0',
  repo: `${REPO.owner}/${REPO.repo}@${REPO.branch}`,
  rootPath: REPO.rootPath,
  authProviders: ['email/username', 'google', 'phone', 'github', 'yahoo'],
  features: ['profile (avatar/bio/pseudo)', 'reports', 'bans', 'auto-moderation', 'cover-images', 'youtube-embed'],
});
logger.debug('User agent', { ua: navigator.userAgent });

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);

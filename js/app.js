/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  WEB RADIO COLLÈGE — APP PRINCIPALE v5.0                           ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Interface premium • 3 sections (Podcasts/Reportages/Vidéos)       ║
 * ║  Lecteurs custom (audio + vidéo) avec contrôles riches             ║
 * ║  Recherche, favoris, historique, toasts, profil avec upload        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';

import { REPO, REPO_POOL, SECTIONS, SITE, ADSENSE, isAdmin } from './config.js';
import { logger } from './logger.js';
import { listContents, listContentsRecursive, humanFileSize, mediaId, clearCache } from './github-api.js';
import {
  loginWithEmailOrUsername, registerWithEmail, resetPassword,
  loginWithGoogle, loginWithGitHub, loginWithYahoo,
  sendSmsCode, verifySmsCode,
  linkProvider, linkEmailPassword, linkPhoneStart, unlinkProvider,
  updateUserProfile,
  logout, onAuthChanged, translateError,
} from './auth.js';
import {
  getCommentsForMedia, postComment, deleteComment, getAllComments,
} from './comments.js';
import {
  upsertProfile, syncProfileFromUser,
  uploadAvatar, deleteAvatar,
  reportComment, getAllReports, banUser, unbanUser, isUserBanned,
  REPORT_THRESHOLD,
} from './profile.js';
import { COMMENT_MAX_LEN } from './moderation.js';
import {
  getFavorites, isFavorite, toggleFavorite, getFavoritesDetailed,
  addToHistory, getHistory, getPrefs, setPref,
  subscribeToasts, toast, toastSuccess, toastError, toastInfo, toastWarn, dismissToast,
} from './ui-store.js';

const html = htm.bind(React.createElement);

// ═══════════════════════════════════════════════════════════════════
// 🔔 TOAST CONTAINER
// ═══════════════════════════════════════════════════════════════════
function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribeToasts((evt) => {
    if (evt.kind === 'add') setToasts((arr) => [...arr, evt.toast]);
    else if (evt.kind === 'remove') setToasts((arr) => arr.filter((t) => t.id !== evt.id));
  }), []);

  const colors = {
    success: 'bg-emerald-500 border-emerald-400',
    error:   'bg-rose-500 border-rose-400',
    warn:    'bg-amber-500 border-amber-400',
    info:    'bg-brand-500 border-brand-400',
  };
  const icons = {
    success: 'fa-circle-check', error: 'fa-circle-xmark',
    warn: 'fa-triangle-exclamation', info: 'fa-circle-info',
  };

  return html`
    <div class="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      ${toasts.map((t) => html`
        <div key=${t.id} class=${'toast-in pointer-events-auto rounded-xl shadow-2xl border text-white p-3 pr-2 flex items-start gap-3 ' + (colors[t.type] || colors.info)}>
          <i class=${'fas ' + (icons[t.type] || icons.info) + ' text-lg mt-0.5'}></i>
          <div class="flex-1 min-w-0">
            ${t.title && html`<div class="font-semibold text-sm">${t.title}</div>`}
            ${t.message && html`<div class="text-sm opacity-95 break-words">${t.message}</div>`}
          </div>
          <button onClick=${() => dismissToast(t.id)} class="p-1.5 hover:bg-white/20 rounded-lg" aria-label="Fermer"><i class="fas fa-xmark text-xs"></i></button>
        </div>
      `)}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🪪 HEADER
// ═══════════════════════════════════════════════════════════════════
function Header({ user, profile, onLogin, onLogout, onOpenAdmin, onOpenProfile, onOpenFavorites, onToggleTheme, onSearch, searchQuery, theme }) {
  const adminUser = user && isAdmin(user.email, user.phoneNumber);
  const avatar = profile?.avatar_url || user?.photoURL;
  const handle = profile?.username || user?.displayName || (user?.email?.split('@')[0]) || (user?.phoneNumber ? '📱' + user.phoneNumber.slice(-4) : '');

  return html`
    <header class="sticky top-0 z-40 glass border-b-2 border-ink-700/80">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <a href="#" onClick=${(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} class="flex items-center gap-3 flex-shrink-0 group">
          <div class="w-11 h-11 rounded-xl bg-ink-700 border-2 border-ink-700 flex items-center justify-center shadow-md group-hover:scale-105 transition">
            <i class="fas fa-microphone-lines text-xl text-paper-50"></i>
          </div>
          <div class="hidden sm:block min-w-0">
            <h1 class="font-display text-lg font-bold leading-tight text-ink-700">${SITE.title}</h1>
            <p class="text-[11px] text-ink-400 leading-tight font-hand text-base">${SITE.subtitle}</p>
          </div>
        </a>

        <!-- Recherche style "papier" -->
        <div class="flex-1 max-w-md mx-2 relative">
          <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 text-sm pointer-events-none"></i>
          <input type="search" value=${searchQuery} onInput=${(e) => onSearch(e.target.value)}
            placeholder="Rechercher un podcast, une vidéo…"
            class="paper-input w-full pl-9 pr-3 py-2 text-sm placeholder-ink-300" />
        </div>

        <!-- Favoris -->
        <button onClick=${onOpenFavorites} class="hidden sm:flex paper-btn p-2.5" title="Favoris" aria-label="Favoris">
          <i class="fas fa-heart text-rose-500"></i>
        </button>

        <!-- Thème -->
        <button onClick=${onToggleTheme} class="paper-btn p-2.5" title=${theme === 'dark' ? 'Mode clair' : 'Mode sombre'} aria-label="Basculer le thème">
          <i class=${'fas ' + (theme === 'dark' ? 'fa-sun text-amber-500' : 'fa-moon text-ink-600')}></i>
        </button>

        ${adminUser && html`
          <button onClick=${onOpenAdmin} class="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-600 text-white transition border-2 border-ink-700 font-medium">
            <i class="fas fa-user-shield"></i>
            <span class="hidden lg:inline">Admin</span>
          </button>
        `}

        ${user ? html`
          <div class="flex items-center gap-2">
            <button onClick=${onOpenProfile} class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full paper-btn" title="Mon profil">
              ${avatar
                ? html`<img src=${avatar} alt="" class="w-8 h-8 rounded-full object-cover border border-ink-700" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
                : html`<div class="w-8 h-8 rounded-full bg-ink-700 flex items-center justify-center text-xs font-bold text-paper-50 border border-ink-700">${(handle || '?')[0].toUpperCase()}</div>`}
              <span class="hidden md:inline text-sm font-medium truncate max-w-[120px] text-ink-700">@${handle}</span>
              ${adminUser && html`<span class="hidden lg:inline text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>`}
            </button>
            <button onClick=${onLogout} class="paper-btn p-2.5" title="Déconnexion" aria-label="Déconnexion">
              <i class="fas fa-right-from-bracket text-ink-600"></i>
            </button>
          </div>
        ` : html`
          <button onClick=${onLogin} class="paper-btn-primary flex items-center gap-2 px-4 py-2 text-sm font-medium">
            <i class="fas fa-right-to-bracket"></i>
            <span class="hidden sm:inline">Se connecter</span>
          </button>
        `}
      </div>
    </header>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 📢 EMPLACEMENT GOOGLE ADSENSE (réutilisable)
// ═══════════════════════════════════════════════════════════════════
//   Tant qu'aucun slot n'est défini dans config.ADSENSE.slots, on affiche
//   un cadre "réservé" discret en mode papier (utile à la mise en page).
//   Dès qu'un slot est renseigné, on injecte la vraie balise <ins>.
function AdSlot({ slot = 'header', label = 'Espace publicitaire', format = 'auto', className = '' }) {
  const slotId = ADSENSE && ADSENSE.slots ? ADSENSE.slots[slot] : null;
  const adRef = useRef(null);

  useEffect(() => {
    if (!ADSENSE || !ADSENSE.enabled || !slotId) return;
    try {
      // Pousse l'annonce une fois le DOM monté
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      logger.warn('AdSense push échoué', { err: e.message });
    }
  }, [slotId]);

  // Aucun slot configuré → emplacement réservé (placeholder graphique)
  if (!ADSENSE || !ADSENSE.enabled || !slotId) {
    return html`
      <aside class=${`my-8 ${className}`} aria-label="Emplacement publicitaire (réservé)">
        <div class="paper-card-soft px-4 py-6 text-center">
          <p class="annotation">${label}</p>
          <p class="text-[11px] uppercase tracking-widest text-ink-300 mt-1">
            Slot AdSense « ${slot} » à configurer
          </p>
        </div>
      </aside>
    `;
  }

  // Slot configuré → vraie balise AdSense
  return html`
    <aside class=${`my-8 flex justify-center ${className}`} aria-label="Annonce">
      <ins
        ref=${adRef}
        class="adsbygoogle"
        style=${{ display: 'block', width: '100%', minHeight: '90px' }}
        data-ad-client=${ADSENSE.client}
        data-ad-slot=${slotId}
        data-ad-format=${format}
        data-full-width-responsive="true"></ins>
    </aside>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🌟 HERO (page d'accueil)
// ═══════════════════════════════════════════════════════════════════
function Hero({ onScrollTo, totals }) {
  return html`
    <section class="relative overflow-hidden mb-10 pt-10 sm:pt-14 pb-10 sm:pb-14 -mx-4 px-4 sm:px-6">
      <div class="hero-glow paper" style=${{ top: '-120px', left: '-100px' }}></div>
      <div class="hero-glow paper" style=${{ bottom: '-220px', right: '-120px', opacity: 0.25 }}></div>

      <div class="relative max-w-5xl mx-auto text-center fade-in">
        <!-- Badge "En direct" style papier -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full paper-card-soft mb-6 shadow-sm">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600"></span>
          </span>
          <span class="text-xs font-semibold tracking-wide uppercase text-ink-700">En direct du collège</span>
        </div>

        <h1 class="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold leading-[1.05] mb-5 tracking-tight text-ink-800">
          ${SITE.title}
        </h1>
        <p class="font-hand text-2xl sm:text-3xl text-ink-600 mb-3">${SITE.tagline}</p>
        <p class="text-sm sm:text-base text-ink-500 mb-10 max-w-2xl mx-auto leading-relaxed">${SITE.description}</p>

        <!-- 3 grandes cartes sections — style papier wireframe -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          ${SECTIONS.map((s) => html`
            <button key=${s.id} onClick=${() => onScrollTo(s.id)}
              class="group paper-card p-5 sm:p-6 text-left media-card hover:bg-paper-100">
              <!-- En-tête de carte avec barre titre style maquette -->
              <div class="flex items-center gap-3 pb-3 border-b border-ink-700/30 mb-3">
                <div class="w-10 h-10 rounded-lg bg-ink-700 text-paper-50 flex items-center justify-center text-lg flex-shrink-0">
                  <i class=${'fas ' + s.icon}></i>
                </div>
                <div class="font-display text-base sm:text-lg font-extrabold text-ink-800">${s.label}</div>
              </div>
              <p class="text-xs sm:text-sm text-ink-500 mb-3">${s.subtitle}</p>
              <div class="flex items-center justify-between">
                <span class="font-hand text-lg text-ink-700">
                  ${totals[s.id] ?? '…'} média${(totals[s.id] || 0) > 1 ? 's' : ''}
                </span>
                <span class="text-ink-600 group-hover:translate-x-1 transition-transform">
                  <i class="fas fa-arrow-right"></i>
                </span>
              </div>
            </button>
          `)}
        </div>

        <p class="annotation mt-8 text-base">
          <i class="fas fa-arrow-down mr-1"></i>
          Cliquez sur une section pour découvrir les contenus
        </p>
      </div>
    </section>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🎵 LECTEUR AUDIO PREMIUM
// ═══════════════════════════════════════════════════════════════════
function AudioPlayer({ src, cover, title, onPlay }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(getPrefs().volume);
  const [muted, setMuted] = useState(getPrefs().muted);
  const [rate, setRate] = useState(getPrefs().playbackRate);
  const [loading, setLoading] = useState(true);
  const [showRateMenu, setShowRateMenu] = useState(false);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    a.volume = muted ? 0 : volume;
    a.playbackRate = rate;
    const onLoaded = () => { setDuration(a.duration); setLoading(false); };
    const onTime = () => setTime(a.currentTime);
    const onEnd = () => setPlaying(false);
    const onWait = () => setLoading(true);
    const onPlayE = () => setLoading(false);
    a.addEventListener('loadedmetadata', onLoaded);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('waiting', onWait);
    a.addEventListener('playing', onPlayE);
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('waiting', onWait);
      a.removeEventListener('playing', onPlayE);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play().catch((e) => toastError(e.message)); setPlaying(true); onPlay?.(); }
    else { a.pause(); setPlaying(false); }
  };
  const seek = (e) => { const a = audioRef.current; if (a) a.currentTime = +e.target.value; };
  const skip = (d) => { const a = audioRef.current; if (a) a.currentTime = Math.max(0, Math.min(duration || 0, a.currentTime + d)); };
  const onVol = (e) => {
    const v = +e.target.value;
    setVolume(v); setMuted(v === 0); setPref('volume', v); setPref('muted', v === 0);
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
  };
  const toggleMute = () => {
    const m = !muted; setMuted(m); setPref('muted', m);
    if (audioRef.current) audioRef.current.muted = m;
  };
  const setSpeed = (r) => {
    setRate(r); setPref('playbackRate', r); setShowRateMenu(false);
    if (audioRef.current) audioRef.current.playbackRate = r;
  };

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };
  const progress = duration ? (time / duration) * 100 : 0;
  const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

  return html`
    <div class="audio-player rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-xl border border-white/5">
      <div class="flex items-center gap-3 p-3">
        <!-- Cover -->
        <div class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-700 flex items-center justify-center shadow relative">
          ${cover
            ? html`<img src=${cover} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => e.target.style.display='none'} />`
            : html`<i class="fas fa-music text-2xl text-slate-400"></i>`}
          ${playing && html`<div class="absolute inset-0 flex items-end p-1 gap-0.5 bg-black/30">
            ${[0, 1, 2].map((i) => html`<span key=${i} class="flex-1 bg-white/80 rounded-sm" style=${{ height: '40%', animation: `pulse-soft ${0.7 + i * 0.2}s ease-in-out infinite` }}></span>`)}
          </div>`}
        </div>

        <!-- Play -->
        <button onClick=${toggle} class="play-btn w-12 h-12 sm:w-14 sm:h-14 rounded-full gradient-brand text-white hover:scale-105 active:scale-95 transition flex items-center justify-center flex-shrink-0">
          ${loading ? html`<i class="fas fa-circle-notch fa-spin text-lg"></i>`
            : playing ? html`<i class="fas fa-pause text-xl"></i>`
            : html`<i class="fas fa-play text-xl ml-1"></i>`}
        </button>

        <!-- Skip -->
        <button onClick=${() => skip(-10)} class="hidden sm:flex w-10 h-10 rounded-full hover:bg-white/10 items-center justify-center" title="-10s" aria-label="Reculer 10 secondes">
          <i class="fas fa-rotate-left text-sm"></i>
        </button>
        <button onClick=${() => skip(30)} class="hidden sm:flex w-10 h-10 rounded-full hover:bg-white/10 items-center justify-center" title="+30s" aria-label="Avancer 30 secondes">
          <i class="fas fa-rotate-right text-sm"></i>
        </button>

        <!-- Progression -->
        <div class="flex-1 min-w-0 flex flex-col gap-1">
          <div class="text-xs sm:text-sm font-medium truncate" title=${title}>${title || ''}</div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] sm:text-xs font-mono text-slate-300 tabular-nums w-10 text-right">${fmt(time)}</span>
            <div class="flex-1 relative h-4 flex items-center group">
              <div class="absolute inset-x-0 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-brand-400 to-accent-400 transition-all" style=${{ width: progress + '%' }}></div>
              </div>
              <div class="absolute w-3 h-3 bg-white rounded-full shadow-lg pointer-events-none transition-all opacity-0 group-hover:opacity-100"
                style=${{ left: `calc(${progress}% - 6px)`, opacity: duration ? 1 : 0 }}></div>
              <input type="range" min="0" max=${duration || 0} step="0.01" value=${time} onInput=${seek}
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer slider-modern" aria-label="Progression" />
            </div>
            <span class="text-[10px] sm:text-xs font-mono text-slate-300 tabular-nums w-10">${fmt(duration)}</span>
          </div>
        </div>

        <!-- Vitesse -->
        <div class="hidden md:block relative flex-shrink-0">
          <button onClick=${() => setShowRateMenu(!showRateMenu)} class="px-2.5 py-1 rounded-lg hover:bg-white/10 text-xs font-mono font-bold tabular-nums" title="Vitesse de lecture">
            ${rate}×
          </button>
          ${showRateMenu && html`
            <div class="absolute bottom-full right-0 mb-2 bg-slate-900 border border-white/10 rounded-xl p-1 shadow-2xl z-10 min-w-[80px]">
              ${SPEEDS.map((s) => html`
                <button key=${s} onClick=${() => setSpeed(s)} class=${'w-full px-3 py-1.5 rounded-lg text-xs text-left font-mono ' + (s === rate ? 'bg-brand-500 text-white' : 'hover:bg-white/10')}>
                  ${s}×
                </button>
              `)}
            </div>
          `}
        </div>

        <!-- Volume -->
        <div class="hidden md:flex items-center gap-2 flex-shrink-0">
          <button onClick=${toggleMute} class="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center" title="Couper le son" aria-label="Mute">
            <i class=${'fas ' + (muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high')}></i>
          </button>
          <input type="range" min="0" max="1" step="0.01" value=${muted ? 0 : volume} onInput=${onVol} class="w-20 slider-modern accent-brand-400" aria-label="Volume" />
        </div>
      </div>

      <audio ref=${audioRef} src=${src} preload="metadata" class="hidden"></audio>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🎬 LECTEUR VIDÉO CUSTOM
//   • Cover/poster TOUJOURS visible au-dessus de la vidéo
//   • Lecteur dessous avec contrôles natifs (compatibilité max)
//   • Fullscreen, raccourcis, persistance volume/mute
// ═══════════════════════════════════════════════════════════════════
function VideoPlayer({ src, cover, title, onPlay }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Réinitialiser quand la source change (évite mémoïsation buggée)
  useEffect(() => {
    setStarted(false);
    setPlaying(false);
    setHasError(false);
    setImgError(false);
  }, [src]);

  const start = () => {
    setStarted(true);
    onPlay?.();
    // play() asynchrone après mount du <video>
    setTimeout(() => {
      const v = videoRef.current;
      if (!v) return;
      const prefs = getPrefs();
      v.volume = prefs.muted ? 0 : prefs.volume;
      v.muted = !!prefs.muted;
      v.play().catch((e) => {
        logger.warn('Autoplay bloqué', { err: e.message });
        // pas une erreur fatale, l'utilisateur peut cliquer play
      });
    }, 50);
  };

  // Listeners sur le <video> une fois monté
  useEffect(() => {
    if (!started) return;
    const v = videoRef.current; if (!v) return;
    const onPlayE = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onErr = () => { setHasError(true); logger.error('Erreur vidéo', { src }); };
    const onVolChange = () => {
      // Persister vol/mute
      setPref('volume', v.volume);
      setPref('muted', v.muted);
    };
    v.addEventListener('play', onPlayE);
    v.addEventListener('pause', onPause);
    v.addEventListener('error', onErr);
    v.addEventListener('volumechange', onVolChange);
    return () => {
      v.removeEventListener('play', onPlayE);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('error', onErr);
      v.removeEventListener('volumechange', onVolChange);
    };
  }, [started]);

  const toggleFullscreen = () => {
    const c = containerRef.current; if (!c) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else c.requestFullscreen?.();
  };

  const showCover = cover && !imgError;

  return html`
    <div ref=${containerRef} class="rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-xl">
      <!-- ═══ Cover/Poster TOUJOURS au-dessus ═══ -->
      <div class="relative w-full aspect-video bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden">
        ${showCover ? html`
          <img src=${cover} alt=${title || ''} referrerpolicy="no-referrer"
            onError=${() => setImgError(true)}
            class=${'absolute inset-0 w-full h-full object-cover transition-all duration-500 ' + (started && playing ? 'opacity-30 scale-105 blur-sm' : 'opacity-100')} />
        ` : html`
          <div class="absolute inset-0 gradient-reportages flex items-center justify-center">
            <i class=${'fas fa-film text-6xl text-white/30 ' + (started && playing ? 'opacity-30' : '')}></i>
          </div>
        `}

        <!-- Overlay sombre + titre -->
        ${(!started || !playing) && html`
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none"></div>
        `}

        ${title && (!started || !playing) && html`
          <div class="absolute top-3 left-3 right-3 z-10 pointer-events-none">
            <div class="text-white font-semibold text-sm sm:text-base line-clamp-2 drop-shadow-lg">${title}</div>
          </div>
        `}

        <!-- Bouton play OU vidéo -->
        ${!started ? html`
          <button onClick=${start}
            class="absolute inset-0 flex items-center justify-center group cursor-pointer focus:outline-none">
            <div class="play-btn w-20 h-20 sm:w-24 sm:h-24 rounded-full gradient-brand text-white flex items-center justify-center shadow-2xl group-hover:scale-110 group-active:scale-95 transition-transform">
              <i class="fas fa-play text-3xl sm:text-4xl ml-2"></i>
            </div>
          </button>
        ` : html`
          <video ref=${videoRef} src=${src} playsinline webkit-playsinline preload="metadata"
            poster=${cover || undefined} controls
            class="absolute inset-0 w-full h-full bg-black"
            crossorigin="anonymous"
          ></video>
        `}

        <!-- Bouton fullscreen quand lecture en cours -->
        ${started && html`
          <button onClick=${toggleFullscreen}
            class="absolute top-3 right-3 z-20 w-10 h-10 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white flex items-center justify-center transition opacity-70 hover:opacity-100"
            title="Plein écran" aria-label="Plein écran">
            <i class="fas fa-expand text-sm"></i>
          </button>
        `}
      </div>

      ${hasError && html`
        <div class="p-3 bg-rose-500/10 border-t border-rose-500/30 text-rose-300 text-sm">
          <i class="fas fa-triangle-exclamation mr-1"></i>
          Impossible de lire cette vidéo. Vérifiez le format ou téléchargez le fichier.
        </div>
      `}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// ▶️ LECTEUR YOUTUBE (style minimaliste)
// ═══════════════════════════════════════════════════════════════════
function YouTubePlayer({ youTubeId, title, cover, onPlay }) {
  const [show, setShow] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(cover || `https://img.youtube.com/vi/${youTubeId}/maxresdefault.jpg`);
  const ytSrc = `https://www.youtube-nocookie.com/embed/${youTubeId}?rel=0&modestbranding=1&showinfo=0&playsinline=1&autoplay=1`;

  // Reset si l'ID change
  useEffect(() => {
    setShow(false);
    setThumbSrc(cover || `https://img.youtube.com/vi/${youTubeId}/maxresdefault.jpg`);
  }, [youTubeId, cover]);

  return html`
    <div class="rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-xl">
      <div class="relative w-full aspect-video bg-black">
        ${!show ? html`
          <button onClick=${() => { setShow(true); onPlay?.(); }}
            class="absolute inset-0 group cursor-pointer focus:outline-none">
            <img src=${thumbSrc} alt=${title || ''}
              class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
              referrerpolicy="no-referrer"
              onError=${() => setThumbSrc(`https://img.youtube.com/vi/${youTubeId}/hqdefault.jpg`)} />
            <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>
            ${title && html`
              <div class="absolute top-3 left-3 right-3 text-left">
                <div class="text-white font-semibold text-sm sm:text-base line-clamp-2 drop-shadow-lg">${title}</div>
              </div>
            `}
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="play-btn w-20 h-20 sm:w-24 sm:h-24 rounded-full gradient-videos text-white flex items-center justify-center shadow-2xl group-hover:scale-110 group-active:scale-95 transition-transform">
                <i class="fas fa-play text-3xl sm:text-4xl ml-2"></i>
              </div>
            </div>
            <div class="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-600 text-white text-[11px] font-semibold shadow-lg">
              <i class="fab fa-youtube"></i>YouTube
            </div>
          </button>
        ` : html`
          <iframe src=${ytSrc} title=${title || 'Vidéo'} loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen referrerpolicy="strict-origin-when-cross-origin"
            class="absolute inset-0 w-full h-full border-0"></iframe>
        `}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🃏 MEDIA CARD (avec lecteur intégré + commentaires + favoris)
// ═══════════════════════════════════════════════════════════════════
function MediaCard({ file, user, onOpenAuth, sectionGradient }) {
  const [expanded, setExpanded] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const isAudio   = file.mediaType === 'audio';
  const isVideo   = file.mediaType === 'video';
  const isYouTube = file.mediaType === 'youtube';
  const ext = (file.ext || '').toLowerCase();
  const mId = mediaId(file);
  const cleanName = isYouTube ? file.name.replace(/\.[^.]+$/, '') : file.name.replace(/\.[^.]+$/, '');
  const [fav, setFav] = useState(isFavorite(mId));

  // Comments state
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [revealed, setRevealed] = useState({});

  useEffect(() => {
    const onChange = () => setFav(isFavorite(mId));
    window.addEventListener('wrc:favorites-changed', onChange);
    return () => window.removeEventListener('wrc:favorites-changed', onChange);
  }, [mId]);

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    try { setComments(await getCommentsForMedia(mId)); }
    catch (err) { logger.error('Chargement commentaires', { err: err.message }); }
    finally { setLoadingComments(false); }
  }, [mId]);

  useEffect(() => { if (expanded && comments.length === 0 && !loadingComments) loadComments(); }, [expanded]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!user) { onOpenAuth(); return; }
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      await postComment({ mediaId: mId, mediaName: file.name, user, content: newComment });
      setNewComment('');
      toastSuccess('Commentaire publié');
      await loadComments();
    } catch (err) { toastError(err.message); }
    finally { setPosting(false); }
  };

  const handleDelete = async (cid) => {
    if (!confirm('Supprimer ce commentaire ?')) return;
    try { await deleteComment(cid); setComments((c) => c.filter((x) => x.id !== cid)); toastSuccess('Supprimé'); }
    catch (err) { toastError(err.message); }
  };

  const handleReport = async (cid) => {
    if (!user) { onOpenAuth(); return; }
    const reason = prompt('Pourquoi signalez-vous ce commentaire ?');
    if (reason === null) return;
    try {
      const r = await reportComment({ commentId: cid, reporterUid: user.uid, reason });
      if (r.duplicated) toastInfo('Vous avez déjà signalé ce commentaire.');
      else toastSuccess('Signalement enregistré. Merci !');
      await loadComments();
    } catch (err) { toastError(err.message); }
  };

  const onPlay = () => {
    setShowPlayer(true);
    addToHistory({ id: mId, name: cleanName, cover: file.cover, type: file.mediaType });
  };
  const handleFav = () => {
    toggleFavorite(mId, { name: cleanName, cover: file.cover, type: file.mediaType });
  };

  const typeLabel = isAudio ? 'Podcast' : isYouTube ? 'YouTube' : 'Vidéo';
  const typeIcon  = isAudio ? 'fa-podcast' : isYouTube ? 'fa-play' : 'fa-film';

  return html`
    <article class="media-card paper-card overflow-hidden">
      <div class="p-4">
        <!-- Header carte style maquette -->
        <div class="flex items-start gap-3 mb-3 pb-3 border-b border-ink-700/20">
          <div class="w-14 h-14 rounded-xl bg-ink-700 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden border border-ink-700">
            ${file.cover
              ? html`<img src=${file.cover} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
              : html`<i class=${'fas ' + typeIcon + ' text-paper-50'}></i>`}
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-display font-bold text-base sm:text-lg line-clamp-2 leading-tight text-ink-800" title=${cleanName}>${cleanName}</h3>
            <div class="text-xs text-ink-500 mt-1.5 flex items-center gap-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-700 text-paper-50 text-[10px] font-medium">
                <i class=${'fas ' + typeIcon + ' text-[9px]'}></i> ${typeLabel}
              </span>
              ${!isYouTube && ext && html`<span class="font-mono uppercase text-[10px] px-1.5 py-0.5 rounded bg-paper-200 text-ink-700">${ext}</span>`}
              ${!isYouTube && file.size > 0 && html`<span class="text-[10px] text-ink-500">${humanFileSize(file.size)}</span>`}
              ${file.cover && html`<span class="text-emerald-600 text-[10px]" title=${'Cover : ' + file.coverName}><i class="fas fa-image"></i></span>`}
            </div>
          </div>
          <button onClick=${handleFav} class=${'p-2.5 rounded-lg transition flex-shrink-0 border ' + (fav ? 'bg-rose-100 text-rose-600 border-rose-300' : 'paper-btn text-ink-500 hover:text-rose-500')} title=${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-label="Favori">
            <i class=${'fas fa-heart ' + (fav ? 'scale-110' : 'opacity-70')}></i>
          </button>
        </div>

        <!-- Lecteur (lazy) -->
        <div class="my-3">
          ${isAudio && html`<${AudioPlayer} src=${file.downloadUrl} cover=${file.cover} title=${cleanName} onPlay=${onPlay} />`}
          ${isVideo && html`<${VideoPlayer} src=${file.downloadUrl} cover=${file.cover} title=${cleanName} onPlay=${onPlay} />`}
          ${isYouTube && file.youTubeId && html`<${YouTubePlayer} youTubeId=${file.youTubeId} title=${cleanName} cover=${file.cover} onPlay=${onPlay} />`}
          ${isYouTube && !file.youTubeId && html`
            <div class="rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 text-sm">
              <i class="fas fa-triangle-exclamation mr-1"></i>Lien YouTube invalide dans <code>${file.name}</code>
            </div>
          `}
        </div>

        <!-- Actions style papier -->
        <div class="flex items-center gap-2 flex-wrap">
          ${!isYouTube && html`
            <a href=${file.downloadUrl} download=${file.name} rel="noopener noreferrer"
              onClick=${() => logger.info('📥 Téléchargement', { file: file.name })}
              class="paper-btn-primary inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
              <i class="fas fa-download"></i><span class="hidden sm:inline">Télécharger</span>
            </a>
          `}
          ${isYouTube && file.youTubeId && html`
            <a href=${'https://youtu.be/' + file.youTubeId} target="_blank" rel="noopener noreferrer"
              class="paper-btn inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
              <i class="fab fa-youtube text-red-600"></i><span class="hidden sm:inline">Sur YouTube</span>
            </a>
          `}
          <button onClick=${() => setExpanded(!expanded)} class="paper-btn inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium">
            <i class=${'fas ' + (expanded ? 'fa-comment-slash' : 'fa-comments')}></i>
            <span class="hidden sm:inline">${expanded ? 'Masquer' : 'Commentaires'}</span>
            ${comments.length > 0 && html`<span class="bg-ink-700 text-paper-50 text-[10px] px-1.5 py-0.5 rounded-full font-bold">${comments.length}</span>`}
          </button>
        </div>
      </div>

      <!-- Zone commentaires papier -->
      ${expanded && html`
        <div class="border-t-2 border-ink-700/30 bg-paper-100/50 p-4 fade-in">
          ${user ? html`
            <form onSubmit=${handlePost} class="mb-4">
              <div class="flex gap-2">
                <div class="w-9 h-9 rounded-full bg-ink-700 text-paper-50 flex items-center justify-center text-sm font-bold flex-shrink-0 border border-ink-700">
                  ${(user.displayName || user.email || '?')[0].toUpperCase()}
                </div>
                <div class="flex-1 flex gap-2">
                  <textarea value=${newComment} onInput=${(e) => setNewComment(e.target.value.slice(0, COMMENT_MAX_LEN))}
                    placeholder=${'Votre commentaire (max ' + COMMENT_MAX_LEN + ' caractères)…'} rows="2" maxlength=${COMMENT_MAX_LEN}
                    class="paper-input flex-1 px-3 py-2 text-sm resize-none"></textarea>
                  <button type="submit" disabled=${posting || !newComment.trim()} class="paper-btn-primary self-end px-4 py-2 text-sm font-medium disabled:opacity-50">
                    ${posting ? html`<i class="fas fa-circle-notch fa-spin"></i>` : html`<i class="fas fa-paper-plane"></i>`}
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between mt-1.5 text-[11px]">
                <span class=${'text-ink-500 ' + (newComment.length >= COMMENT_MAX_LEN * 0.9 ? 'text-amber-600 font-bold' : '')}>${newComment.length}/${COMMENT_MAX_LEN}</span>
                <span class="font-hand text-sm text-ink-500">🛡️ Modération automatique active</span>
              </div>
            </form>
          ` : html`
            <div class="mb-4 paper-card-soft p-4 text-center">
              <p class="text-sm text-ink-600 mb-2">Connectez-vous pour laisser un commentaire.</p>
              <button onClick=${onOpenAuth} class="paper-btn-primary px-4 py-2 text-sm font-medium">
                <i class="fas fa-right-to-bracket mr-1"></i>Se connecter
              </button>
            </div>
          `}

          ${loadingComments ? html`<div class="text-center py-4"><div class="spinner w-6 h-6 mx-auto"></div></div>`
            : comments.length === 0 ? html`<div class="text-center text-ink-500 text-sm py-4"><i class="fas fa-comment-dots text-2xl mb-2 block opacity-30"></i><span class="font-hand text-base">Aucun commentaire pour le moment.</span></div>`
            : html`
              <ul class="space-y-2">
                ${comments.map((c) => {
                  const canDelete = user && (isAdmin(user.email, user.phoneNumber) || user.uid === c.user_uid);
                  const cIsAdmin = isAdmin(c.user_email, c.user_phone);
                  const ownComment = user && user.uid === c.user_uid;
                  const hidden = c.auto_hidden && !revealed[c.id] && !isAdmin(user?.email, user?.phoneNumber);
                  return html`
                    <li key=${c.id} class=${'rounded-xl p-3 border ' + (c.auto_hidden ? 'bg-rose-50 border-rose-300' : 'paper-card-soft')}>
                      ${hidden ? html`
                        <div class="text-sm text-rose-700 flex items-center justify-between gap-2 flex-wrap">
                          <span><i class="fas fa-eye-slash mr-1"></i>Commentaire masqué (${c.report_count} signalements).</span>
                          <button onClick=${() => setRevealed((r) => ({ ...r, [c.id]: true }))} class="text-xs underline">Afficher quand même</button>
                        </div>
                      ` : html`
                        <div class="flex items-start gap-3">
                          <div class=${'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border border-ink-700 ' + (cIsAdmin ? 'bg-amber-500 text-white' : 'bg-ink-700 text-paper-50')}>
                            ${(c.user_name || c.user_email || '?')[0].toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-baseline gap-2 flex-wrap">
                              <span class="font-semibold text-sm text-ink-800">${c.user_name || c.user_email}</span>
                              ${cIsAdmin && html`<span class="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>`}
                              <span class="text-[11px] text-ink-400">${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                              ${c.report_count > 0 && html`<span class="text-[11px] text-rose-600" title=${c.report_count + ' signalement(s)'}><i class="fas fa-flag"></i> ${c.report_count}</span>`}
                            </div>
                            <p class="text-sm mt-1 whitespace-pre-wrap break-words text-ink-700">${c.content}</p>
                          </div>
                          <div class="flex items-center gap-1 flex-shrink-0">
                            ${user && !ownComment && html`
                              <button onClick=${() => handleReport(c.id)} class="p-1.5 rounded hover:bg-amber-100 text-ink-400 hover:text-amber-600" title="Signaler">
                                <i class="fas fa-flag text-xs"></i>
                              </button>
                            `}
                            ${canDelete && html`
                              <button onClick=${() => handleDelete(c.id)} class="p-1.5 rounded hover:bg-rose-100 text-ink-400 hover:text-rose-600" title="Supprimer">
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
// 📂 FOLDER ITEM (sous-dossiers cliquables)
// ═══════════════════════════════════════════════════════════════════
function FolderItem({ folder, onNavigate, sectionGradient }) {
  return html`
    <button onClick=${() => onNavigate(folder.path)}
      class="media-card group paper-card-soft p-4 text-left hover:bg-paper-100 w-full">
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-xl bg-ink-700 text-paper-50 flex items-center justify-center text-xl flex-shrink-0">
          <i class="fas fa-folder"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-display font-bold truncate text-ink-800">${folder.name}</div>
          <div class="font-hand text-sm text-ink-500">Cliquez pour ouvrir</div>
        </div>
        <i class="fas fa-arrow-right text-ink-500 group-hover:translate-x-1 transition"></i>
      </div>
    </button>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 📜 SECTION (Podcasts / Reportages / Vidéos)
// ═══════════════════════════════════════════════════════════════════
function Section({ section, user, onOpenAuth, searchQuery, onCount }) {
  const [data, setData] = useState({ folders: [], files: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [path, setPath] = useState(`${REPO.rootPath}/${section.folder}`);
  const [sortBy, setSortBy] = useState('name'); // name | date | size

  const load = useCallback(async (p) => {
    setLoading(true); setError(null);
    try {
      const r = await listContents(p);
      // Filtrer par type accepté
      r.files = r.files.filter((f) => section.accept.includes(f.mediaType));
      setData(r);
      onCount?.(section.id, r.files.length);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [section]);

  useEffect(() => { load(path); }, [path, load]);

  // Filtre + tri
  const visibleFiles = useMemo(() => {
    let arr = data.files.slice();
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      arr = arr.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (sortBy === 'name') arr.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    else if (sortBy === 'size') arr.sort((a, b) => (b.size || 0) - (a.size || 0));
    return arr;
  }, [data.files, searchQuery, sortBy]);

  const isSubfolder = path !== `${REPO.rootPath}/${section.folder}`;

  return html`
    <section id=${'section-' + section.id} class="mb-14 fade-in scroll-mt-24">
      <!-- Header section style "papier" : barre titre + ligne ink -->
      <div class="paper-card p-5 sm:p-6 mb-6">
        <div class="flex items-center gap-4 flex-wrap pb-4 border-b-2 border-ink-700/80 mb-3">
          <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-ink-700 text-paper-50 flex items-center justify-center text-2xl shadow-md flex-shrink-0">
            <i class=${'fas ' + section.icon}></i>
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-ink-800">${section.label}</h2>
            <p class="font-hand text-base sm:text-lg text-ink-500 mt-0.5">${section.subtitle}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-ink-700 text-paper-50 text-xs font-bold">
            <i class="fas fa-circle-play"></i>${data.files.length} média${data.files.length > 1 ? 's' : ''}
          </span>
          ${data.folders.length > 0 && html`
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md paper-card-soft text-ink-700 text-xs font-bold">
              <i class="fas fa-folder"></i>${data.folders.length} dossier${data.folders.length > 1 ? 's' : ''}
            </span>
          `}
          ${data.files.length > 1 && html`
            <select value=${sortBy} onChange=${(e) => setSortBy(e.target.value)}
              class="paper-input px-3 py-1.5 text-xs font-medium cursor-pointer">
              <option value="name">Trier par nom</option>
              <option value="size">Trier par taille</option>
            </select>
          `}
          ${isSubfolder && html`
            <button onClick=${() => setPath(`${REPO.rootPath}/${section.folder}`)}
              class="paper-btn px-3 py-1.5 text-xs font-medium">
              <i class="fas fa-arrow-up mr-1"></i>Retour
            </button>
          `}
        </div>
      </div>

      ${isSubfolder && html`
        <div class="text-xs text-slate-500 mb-3 font-mono">📂 ${path.replace(REPO.rootPath + '/', '')}</div>
      `}

      <!-- Loading -->
      ${loading && html`
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          ${[0, 1, 2].map((i) => html`<div key=${i} class="h-40 rounded-2xl paper-card-soft shimmer"></div>`)}
        </div>
      `}

      <!-- Erreur -->
      ${error && html`
        <div class="paper-card p-4 border-rose-600 text-rose-700">
          <i class="fas fa-triangle-exclamation mr-1"></i>${error}
          <button onClick=${() => load(path)} class="ml-3 underline text-sm">Réessayer</button>
        </div>
      `}

      <!-- Vide -->
      ${!loading && !error && data.folders.length === 0 && data.files.length === 0 && html`
        <div class="text-center py-16 rounded-2xl border-2 border-dashed border-ink-700/30 bg-paper-100/50">
          <i class=${'fas ' + section.icon + ' text-5xl text-ink-300 mb-3'}></i>
          <p class="font-display font-bold text-ink-600">${data.missing ? 'Dossier introuvable' : 'Aucun contenu pour le moment'}</p>
          <p class="font-hand text-base text-ink-500 mt-2">
            Ajoutez des fichiers dans <code class="font-mono bg-paper-200 px-2 py-0.5 rounded text-xs text-ink-700">${path}</code> sur GitHub.
          </p>
        </div>
      `}

      <!-- Sous-dossiers -->
      ${!loading && data.folders.length > 0 && html`
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          ${data.folders.map((f) => html`<${FolderItem} key=${f.sha} folder=${f} sectionGradient=${section.gradient} onNavigate=${setPath} />`)}
        </div>
      `}

      <!-- Médias -->
      ${!loading && visibleFiles.length > 0 && html`
        <div class="grid grid-cols-1 ${section.id === 'reportages' || section.id === 'videos' ? 'lg:grid-cols-2' : 'md:grid-cols-2 xl:grid-cols-3'} gap-4">
          ${visibleFiles.map((f) => html`
            <${MediaCard} key=${f.sha} file=${f} user=${user} onOpenAuth=${onOpenAuth} sectionGradient=${section.gradient} />
          `)}
        </div>
      `}
      ${!loading && searchQuery && visibleFiles.length === 0 && data.files.length > 0 && html`
        <div class="text-center py-8 text-slate-500 text-sm">
          <i class="fas fa-magnifying-glass text-2xl mb-2 opacity-50"></i>
          <p>Aucun résultat pour "<strong>${searchQuery}</strong>" dans ${section.label}.</p>
        </div>
      `}
    </section>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🔐 MODAL DE CONNEXION
// ═══════════════════════════════════════════════════════════════════
function AuthModal({ open, onClose }) {
  const [tab, setTab] = useState('quick');
  const [emailMode, setEmailMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState('error');

  useEffect(() => { if (open) { setMsg(null); setCode(''); setPassword(''); setTab('quick'); setEmailMode('login'); } }, [open]);
  if (!open) return null;

  const showError = (err) => { setMsgType('error'); setMsg(translateError(err.code) + (err.code ? ` (${err.code})` : '')); };
  const oauth = (fn) => async () => {
    setBusy(true); setMsg(null);
    try { await fn(); onClose(); toastSuccess('Connexion réussie'); }
    catch (err) { showError(err); }
    finally { setBusy(false); }
  };

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
      onClose(); toastSuccess(emailMode === 'register' ? 'Compte créé !' : 'Connexion réussie');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const handleSendSms = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const conf = await sendSmsCode(phone, 'recaptcha-container');
      setConfirmation(conf); setTab('code');
      setMsgType('success'); setMsg('SMS envoyé !');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };
  const handleVerifyCode = async (e) => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await verifySmsCode(confirmation, code.trim(), displayName.trim() || null);
      onClose(); toastSuccess('Connexion réussie');
    } catch (err) { showError(err); }
    finally { setBusy(false); }
  };

  const msgBlock = msg && html`<div class=${'text-sm rounded-xl p-3 ' + (msgType === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-300 border border-rose-500/30')}>${msg}</div>`;

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-800/60 backdrop-blur-sm fade-in" onClick=${onClose}>
      <div class="paper-card w-full max-w-md max-h-[95vh] overflow-y-auto scale-in" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b-2 border-ink-700 flex items-center justify-between sticky top-0 bg-paper-50 z-10 rounded-t-2xl">
          <h2 class="text-xl font-display font-bold flex items-center gap-2 text-ink-800">
            <i class="fas fa-key text-ink-700"></i>
            ${tab === 'quick' ? 'Se connecter' : tab === 'email' ? (emailMode === 'login' ? 'Connexion' : emailMode === 'register' ? 'Créer un compte' : 'Mot de passe oublié') : tab === 'phone' ? 'Connexion SMS' : 'Code de vérification'}
          </h2>
          <button onClick=${onClose} class="paper-btn p-2" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="p-5 space-y-3">
          ${tab === 'quick' && html`
            <p class="font-hand text-base text-ink-500 text-center mb-2">Choisissez votre méthode</p>
            <button onClick=${oauth(loginWithGoogle)} disabled=${busy} class="paper-btn w-full flex items-center justify-center gap-3 py-3 font-medium disabled:opacity-50">
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span class="text-ink-800">Google</span>
            </button>
            <button onClick=${oauth(loginWithGitHub)} disabled=${busy} class="paper-btn w-full flex items-center justify-center gap-3 py-3 font-medium disabled:opacity-50">
              <i class="fab fa-github text-xl text-ink-800"></i><span class="text-ink-800">GitHub</span>
            </button>
            <button onClick=${oauth(loginWithYahoo)} disabled=${busy} class="paper-btn w-full flex items-center justify-center gap-3 py-3 font-medium disabled:opacity-50">
              <i class="fab fa-yahoo text-xl text-purple-700"></i><span class="text-ink-800">Yahoo</span>
            </button>
            <div class="flex items-center gap-3 my-2"><div class="flex-1 h-px bg-ink-700/20"></div><span class="text-xs text-ink-400 font-hand text-base">ou</span><div class="flex-1 h-px bg-ink-700/20"></div></div>
            <button onClick=${() => { setTab('phone'); setMsg(null); }} disabled=${busy} class="paper-btn-primary w-full flex items-center justify-center gap-3 py-3 font-medium disabled:opacity-50">
              <i class="fas fa-mobile-screen text-lg"></i>Téléphone (SMS)
            </button>
            <button onClick=${() => { setTab('email'); setMsg(null); }} disabled=${busy} class="paper-btn-primary w-full flex items-center justify-center gap-3 py-3 font-medium disabled:opacity-50">
              <i class="fas fa-envelope text-lg"></i>Email / Pseudo + mot de passe
            </button>
            ${msgBlock}
          `}

          ${tab === 'email' && html`
            <button onClick=${() => { setTab('quick'); setMsg(null); }} class="text-sm text-ink-500 hover:text-ink-800 mb-2"><i class="fas fa-arrow-left mr-1"></i>Autres méthodes</button>
            <form onSubmit=${handleEmail} class="space-y-3">
              ${emailMode === 'register' && html`
                <div>
                  <label for="auth-name" class="block text-sm font-medium mb-1 text-ink-700">Votre nom</label>
                  <input id="auth-name" type="text" autocomplete="name" required value=${displayName} onInput=${(e) => setDisplayName(e.target.value)} class="paper-input w-full px-3 py-2.5" />
                </div>
              `}
              <div>
                <label for="auth-email" class="block text-sm font-medium mb-1 text-ink-700">${emailMode === 'register' ? 'Email' : 'Email ou pseudo'}</label>
                <input id="auth-email" type=${emailMode === 'register' ? 'email' : 'text'} autocomplete=${emailMode === 'register' ? 'email' : 'username'} required value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder=${emailMode === 'register' ? 'votre@email.fr' : 'pseudo ou email'} class="paper-input w-full px-3 py-2.5" />
                ${emailMode === 'login' && html`<p class="text-xs text-ink-500 mt-1 font-hand text-base">💡 Connexion par pseudo OU email.</p>`}
              </div>
              ${emailMode !== 'reset' && html`
                <div>
                  <label for="auth-pwd" class="block text-sm font-medium mb-1 text-ink-700">Mot de passe</label>
                  <input id="auth-pwd" type="password" autocomplete=${emailMode === 'register' ? 'new-password' : 'current-password'} required minlength="6" value=${password} onInput=${(e) => setPassword(e.target.value)} class="paper-input w-full px-3 py-2.5" />
                </div>
              `}
              ${msgBlock}
              <button type="submit" disabled=${busy} class="paper-btn-primary w-full py-3 font-medium disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>` : ''}
                ${emailMode === 'login' ? 'Se connecter' : emailMode === 'register' ? 'Créer mon compte' : 'Envoyer l\'email'}
              </button>
            </form>
            <div class="text-center text-sm space-y-2 pt-3 border-t border-ink-700/20 text-ink-700">
              ${emailMode === 'login' && html`
                <div><button onClick=${() => setEmailMode('reset')} class="underline hover:text-ink-800">Mot de passe oublié ?</button></div>
                <div>Pas de compte ? <button onClick=${() => setEmailMode('register')} class="underline font-medium hover:text-ink-800">Créer un compte</button></div>
              `}
              ${emailMode === 'register' && html`<div>Déjà inscrit ? <button onClick=${() => setEmailMode('login')} class="underline font-medium hover:text-ink-800">Se connecter</button></div>`}
              ${emailMode === 'reset' && html`<div><button onClick=${() => setEmailMode('login')} class="underline hover:text-ink-800">← Retour</button></div>`}
            </div>
          `}

          ${tab === 'phone' && html`
            <button onClick=${() => { setTab('quick'); setMsg(null); }} class="text-sm text-ink-500 hover:text-ink-800 mb-2"><i class="fas fa-arrow-left mr-1"></i>Autres méthodes</button>
            <p class="text-sm text-ink-600 font-hand text-base">Recevez un code par SMS. Aucun mot de passe.</p>
            <form onSubmit=${handleSendSms} class="space-y-3">
              <div>
                <label for="auth-name2" class="block text-sm font-medium mb-1 text-ink-700">Votre nom <span class="text-ink-400">(optionnel)</span></label>
                <input id="auth-name2" type="text" autocomplete="name" value=${displayName} onInput=${(e) => setDisplayName(e.target.value)} placeholder="Ex. Jean Dupont" class="paper-input w-full px-3 py-2.5" />
              </div>
              <div>
                <label for="auth-phone" class="block text-sm font-medium mb-1 text-ink-700">Numéro</label>
                <input id="auth-phone" type="tel" autocomplete="tel" inputmode="tel" required value=${phone} onInput=${(e) => setPhone(e.target.value)} placeholder="+33 6 12 34 56 78" class="paper-input w-full px-3 py-2.5" />
                <p class="text-xs text-ink-500 mt-1">Format international (+33…) ou FR commençant par 0.</p>
              </div>
              ${msgBlock}
              <button type="submit" disabled=${busy} class="paper-btn-primary w-full py-3 font-medium disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>Envoi…` : html`<i class="fas fa-paper-plane mr-2"></i>Recevoir le code`}
              </button>
            </form>
          `}

          ${tab === 'code' && html`
            <p class="text-sm text-ink-600">Code à 6 chiffres envoyé au <strong class="text-ink-800">${phone}</strong>.</p>
            <form onSubmit=${handleVerifyCode} class="space-y-3">
              <input type="text" autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required value=${code} onInput=${(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" class="paper-input w-full px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono" />
              ${msgBlock}
              <button type="submit" disabled=${busy || code.length !== 6} class="paper-btn-primary w-full py-3 font-medium disabled:opacity-50">
                ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>` : html`<i class="fas fa-check mr-2"></i>`}Valider
              </button>
              <button type="button" onClick=${() => { setTab('phone'); setCode(''); setMsg(null); }} class="w-full text-sm text-ink-500 hover:text-ink-800">← Changer de numéro</button>
            </form>
          `}

          <div id="recaptcha-container"></div>
          <p class="text-xs text-ink-500 text-center pt-2 border-t border-ink-700/20 font-hand text-base">🔒 Connexion requise uniquement pour commenter.</p>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 👤 PROFIL MODAL (avec UPLOAD d'avatar)
// ═══════════════════════════════════════════════════════════════════
// Avatars par défaut (couleurs + initiales) — choix rapide pour ceux qui ne veulent pas uploader
const DEFAULT_AVATAR_GRADIENTS = [
  { id: 'grad-1', from: '#0ea5e9', to: '#8b5cf6', label: 'Océan' },
  { id: 'grad-2', from: '#10b981', to: '#06b6d4', label: 'Émeraude' },
  { id: 'grad-3', from: '#f43f5e', to: '#f97316', label: 'Coucher' },
  { id: 'grad-4', from: '#8b5cf6', to: '#ec4899', label: 'Néon' },
  { id: 'grad-5', from: '#fbbf24', to: '#f43f5e', label: 'Feu' },
  { id: 'grad-6', from: '#1e293b', to: '#475569', label: 'Ardoise' },
];
// Génère un SVG dataURL avec gradient + initiale
function gradientAvatarDataUrl(from, to, letter) {
  const safe = (letter || '?').slice(0, 1).toUpperCase().replace(/[<>&"']/g, '');
  const id = 'g' + Math.abs((from + to).split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 0));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
    </linearGradient></defs>
    <rect width="200" height="200" fill="url(#${id})"/>
    <text x="100" y="100" text-anchor="middle" dominant-baseline="central"
      font-family="Inter,system-ui,sans-serif" font-weight="700" font-size="100" fill="#ffffff">${safe}</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function ProfileModal({ open, onClose, user, profile, onProfileUpdate }) {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarTab, setAvatarTab] = useState('upload'); // 'upload' | 'url' | 'preset'
  const [externalUrl, setExternalUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      setExternalUrl('');
      setAvatarTab('upload');
      setLinkPhone(''); setLinkCode(''); setLinkConf(null); setLinkEmail(''); setLinkPwd('');
    }
  }, [open, profile]);

  if (!open || !user) return null;

  const providers = (user.providerData || []).map((p) => p.providerId);
  const has = (id) => providers.includes(id);

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const oldAvatar = profile?.avatar_url;
      const url = await uploadAvatar(user.uid, file);
      setAvatarUrl(url);
      // Sauve immédiatement dans le profil
      const updated = await upsertProfile(user.uid, { avatar_url: url });
      try { await updateUserProfile({ photoURL: url }); } catch (e) {}
      onProfileUpdate?.(updated);
      // Supprime l'ancien (best effort)
      if (oldAvatar && oldAvatar.includes('/storage/v1/object/public/')) {
        deleteAvatar(oldAvatar);
      }
      toastSuccess('Avatar mis à jour !');
    } catch (err) { toastError(err.message); }
    finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleAvatarFile(file);
  };

  // Choisir un avatar depuis une URL externe
  const handleSetExternalUrl = async (e) => {
    e?.preventDefault?.();
    const url = externalUrl.trim();
    if (!url) return;
    setBusy(true);
    try {
      const oldAvatar = profile?.avatar_url;
      // upsertProfile validera l'URL (whitelist)
      const updated = await upsertProfile(user.uid, { avatar_url: url });
      setAvatarUrl(updated.avatar_url || '');
      try { await updateUserProfile({ photoURL: updated.avatar_url }); } catch (e) {}
      onProfileUpdate?.(updated);
      if (oldAvatar && oldAvatar.includes('/storage/v1/object/public/')) deleteAvatar(oldAvatar);
      setExternalUrl('');
      toastSuccess('Avatar mis à jour depuis l\'URL !');
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  };

  // Choisir un avatar par défaut (gradient)
  const handlePresetAvatar = async (preset) => {
    setBusy(true);
    try {
      const initial = (username || user.displayName || user.email || '?')[0];
      const dataUrl = gradientAvatarDataUrl(preset.from, preset.to, initial);
      const oldAvatar = profile?.avatar_url;
      const updated = await upsertProfile(user.uid, { avatar_url: dataUrl });
      setAvatarUrl(updated.avatar_url || '');
      try { await updateUserProfile({ photoURL: updated.avatar_url }); } catch (e) {}
      onProfileUpdate?.(updated);
      if (oldAvatar && oldAvatar.includes('/storage/v1/object/public/')) deleteAvatar(oldAvatar);
      toastSuccess('Avatar défini !');
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  };

  // Supprimer l'avatar
  const handleRemoveAvatar = async () => {
    if (!confirm('Supprimer votre photo de profil ?')) return;
    setBusy(true);
    try {
      const oldAvatar = profile?.avatar_url;
      const updated = await upsertProfile(user.uid, { avatar_url: null });
      setAvatarUrl('');
      try { await updateUserProfile({ photoURL: '' }); } catch (e) {}
      onProfileUpdate?.(updated);
      if (oldAvatar && oldAvatar.includes('/storage/v1/object/public/')) deleteAvatar(oldAvatar);
      toastSuccess('Photo supprimée');
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const updated = await upsertProfile(user.uid, { username: username.trim(), bio });
      try { await updateUserProfile({ displayName: updated.username }); } catch (e) {}
      onProfileUpdate?.(updated);
      toastSuccess('Profil enregistré');
    } catch (err) { toastError(err.message); }
    finally { setBusy(false); }
  };

  const wrap = (fn, ok) => async () => {
    setBusy(true);
    try { await fn(); toastSuccess(ok || 'OK'); }
    catch (err) { toastError(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };

  const handleLinkPhone = async (e) => {
    e.preventDefault(); setBusy(true);
    try { setLinkConf(await linkPhoneStart(linkPhone, 'profile-recaptcha')); toastInfo('SMS envoyé'); }
    catch (err) { toastError(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };
  const handleConfirmPhone = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await linkConf.confirm(linkCode.trim()); setLinkConf(null); setLinkPhone(''); setLinkCode(''); toastSuccess('Téléphone lié'); }
    catch (err) { toastError(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };
  const handleLinkEmail = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await linkEmailPassword(linkEmail.trim(), linkPwd); setLinkEmail(''); setLinkPwd(''); toastSuccess('Email lié'); }
    catch (err) { toastError(translateError(err.code) || err.message); }
    finally { setBusy(false); }
  };

  const Provider = ({ id, label, icon, color, linked }) => html`
    <div class="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-slate-800/40">
      <div class="flex items-center gap-3">
        <i class=${icon + ' text-lg ' + color}></i>
        <span class="font-medium text-sm">${label}</span>
        ${linked && html`<span class="text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">lié</span>`}
      </div>
      ${linked
        ? html`<button onClick=${wrap(() => unlinkProvider(id), 'Provider retiré')} disabled=${busy || providers.length <= 1} class="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-rose-500/20 hover:text-rose-400 disabled:opacity-40">Retirer</button>`
        : id === 'google.com' ? html`<button onClick=${wrap(() => linkProvider('google'), 'Google lié')} disabled=${busy} class="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50">Lier</button>`
        : id === 'github.com' ? html`<button onClick=${wrap(() => linkProvider('github'), 'GitHub lié')} disabled=${busy} class="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50">Lier</button>`
        : id === 'yahoo.com'  ? html`<button onClick=${wrap(() => linkProvider('yahoo'), 'Yahoo lié')}  disabled=${busy} class="text-xs px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50">Lier</button>`
        : html`<span class="text-[11px] text-slate-500">via formulaire</span>`}
    </div>
  `;

  const adminUser = isAdmin(user.email, user.phoneNumber);

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-800/60 backdrop-blur-sm fade-in" onClick=${onClose}>
      <div class="paper-card w-full max-w-2xl max-h-[95vh] overflow-y-auto scale-in" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b-2 border-ink-700 flex items-center justify-between sticky top-0 bg-paper-50 z-10 rounded-t-2xl">
          <h2 class="text-xl font-display font-bold flex items-center gap-2 text-ink-800">
            <i class="fas fa-user-circle text-ink-700"></i>Mon profil
            ${adminUser && html`<span class="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">ADMIN</span>`}
          </h2>
          <button onClick=${onClose} class="paper-btn p-2" aria-label="Fermer"><i class="fas fa-xmark"></i></button>
        </div>

        <div class="p-5 space-y-5">
          <!-- ═══ Avatar : aperçu + 3 méthodes au choix ═══ -->
          <div class="paper-card-soft overflow-hidden">
            <!-- Aperçu -->
            <div class="flex items-center gap-4 p-5">
              <div class="relative flex-shrink-0">
                <div class=${'w-24 h-24 rounded-full overflow-hidden bg-ink-700 text-paper-50 flex items-center justify-center text-4xl font-bold border-2 ' + (dragOver ? 'border-ink-700 scale-105' : 'border-ink-700/50') + ' transition'}
                  onDragOver=${(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave=${() => setDragOver(false)}
                  onDrop=${handleDrop}>
                  ${avatarUrl
                    ? html`<img src=${avatarUrl} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onError=${(e) => { e.target.style.display='none'; }} />`
                    : (username || '?')[0].toUpperCase()}
                </div>
                ${avatarUrl && html`
                  <button onClick=${handleRemoveAvatar} disabled=${busy} title="Supprimer la photo"
                    class="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center border-2 border-paper-50 transition disabled:opacity-50">
                    <i class="fas fa-xmark text-xs"></i>
                  </button>
                `}
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-display font-bold text-xl truncate text-ink-800">@${username || '...'}</div>
                <div class="text-sm text-ink-500 break-all">${user.email || user.phoneNumber || ''}</div>
                <div class="font-hand text-base text-ink-500 mt-2"><i class="fas fa-info-circle mr-1"></i>Choisissez une méthode ci-dessous pour changer votre photo.</div>
              </div>
            </div>

            <!-- Onglets méthode -->
            <div class="px-3 pb-3">
              <div class="flex gap-1 p-1 bg-paper-200 rounded-xl border border-ink-700/20">
                <button type="button" onClick=${() => setAvatarTab('upload')}
                  class=${'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition ' + (avatarTab === 'upload' ? 'bg-ink-700 text-paper-50 shadow' : 'text-ink-600 hover:bg-paper-100')}>
                  <i class="fas fa-upload mr-1"></i>Uploader
                </button>
                <button type="button" onClick=${() => setAvatarTab('url')}
                  class=${'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition ' + (avatarTab === 'url' ? 'bg-ink-700 text-paper-50 shadow' : 'text-ink-600 hover:bg-paper-100')}>
                  <i class="fas fa-link mr-1"></i>URL
                </button>
                <button type="button" onClick=${() => setAvatarTab('preset')}
                  class=${'flex-1 py-2 px-2 rounded-lg text-xs font-medium transition ' + (avatarTab === 'preset' ? 'bg-ink-700 text-paper-50 shadow' : 'text-ink-600 hover:bg-paper-100')}>
                  <i class="fas fa-palette mr-1"></i>Palette
                </button>
              </div>

              <!-- Onglet UPLOAD -->
              ${avatarTab === 'upload' && html`
                <div class="mt-3 fade-in">
                  <button type="button" onClick=${() => fileInputRef.current?.click()} disabled=${uploading}
                    class=${'w-full p-5 rounded-xl border-2 border-dashed transition flex flex-col items-center gap-2 ' + (dragOver ? 'border-ink-700 bg-paper-200' : 'border-ink-700/30 bg-paper-100 hover:border-ink-700 hover:bg-paper-200') + (uploading ? ' opacity-50 cursor-wait' : ' cursor-pointer')}
                    onDragOver=${(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave=${() => setDragOver(false)}
                    onDrop=${handleDrop}>
                    ${uploading
                      ? html`<i class="fas fa-circle-notch fa-spin text-2xl text-ink-700"></i><span class="text-sm font-medium text-ink-700">Envoi en cours…</span>`
                      : html`<i class="fas fa-cloud-arrow-up text-2xl text-ink-700"></i>
                          <span class="text-sm font-semibold text-ink-800">Glissez une image ou cliquez ici</span>
                          <span class="font-hand text-base text-ink-500">PNG, JPEG, WebP, GIF • max 2 Mo</span>`}
                  </button>
                  <input ref=${fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden"
                    onChange=${(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }} />
                </div>
              `}

              <!-- Onglet URL -->
              ${avatarTab === 'url' && html`
                <form onSubmit=${handleSetExternalUrl} class="mt-3 space-y-2 fade-in">
                  <input type="url" required value=${externalUrl} onInput=${(e) => setExternalUrl(e.target.value)}
                    placeholder="https://example.com/mon-image.png"
                    class="paper-input w-full px-3 py-2.5 text-sm" />
                  <button type="submit" disabled=${busy || !externalUrl.trim()}
                    class="paper-btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-50">
                    ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-1"></i>` : html`<i class="fas fa-check mr-1"></i>`}Utiliser cette URL
                  </button>
                  <p class="font-hand text-base text-ink-500">
                    <i class="fas fa-shield-halved mr-1"></i>
                    Domaines autorisés : googleusercontent, githubusercontent, gravatar, imgur…
                  </p>
                </form>
              `}

              <!-- Onglet PRESET -->
              ${avatarTab === 'preset' && html`
                <div class="mt-3 grid grid-cols-3 gap-2 fade-in">
                  ${DEFAULT_AVATAR_GRADIENTS.map((g) => html`
                    <button key=${g.id} type="button" onClick=${() => handlePresetAvatar(g)} disabled=${busy}
                      class="group rounded-xl overflow-hidden border border-ink-700/30 hover:border-ink-700 transition disabled:opacity-50">
                      <div class="aspect-square flex items-center justify-center text-white text-2xl font-bold"
                        style=${{ background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)` }}>
                        ${(username || user.displayName || user.email || '?')[0].toUpperCase()}
                      </div>
                      <div class="text-[10px] py-1 bg-paper-100 text-center text-ink-600 group-hover:text-ink-800 group-hover:bg-paper-200">${g.label}</div>
                    </button>
                  `)}
                </div>
              `}
            </div>
          </div>

          <!-- Formulaire profil -->
          <form onSubmit=${handleSave} class="space-y-3">
            <div>
              <label for="prof-username" class="block text-sm font-medium mb-1 text-ink-700">Pseudo <span class="text-rose-600">*</span></label>
              <input id="prof-username" type="text" required minlength="3" maxlength="20" pattern="[a-zA-Z0-9._-]+" value=${username} onInput=${(e) => setUsername(e.target.value)} class="paper-input w-full px-3 py-2.5" />
              <p class="text-xs text-ink-500 mt-1">3-20 caractères. Lettres, chiffres, point, tiret, underscore.</p>
            </div>
            <div>
              <label for="prof-bio" class="block text-sm font-medium mb-1 text-ink-700">Bio <span class="text-ink-400">(${bio.length}/200)</span></label>
              <textarea id="prof-bio" rows="3" maxlength="200" value=${bio} onInput=${(e) => setBio(e.target.value)} placeholder="Présentez-vous…" class="paper-input w-full px-3 py-2.5 resize-none"></textarea>
            </div>
            <button type="submit" disabled=${busy} class="paper-btn-primary w-full py-3 font-medium disabled:opacity-50">
              ${busy ? html`<i class="fas fa-circle-notch fa-spin mr-2"></i>` : html`<i class="fas fa-save mr-2"></i>`}Enregistrer
            </button>
          </form>

          <!-- Providers -->
          <div class="space-y-2 pt-4 border-t-2 border-ink-700/30">
            <h3 class="font-display font-bold text-sm uppercase tracking-wider text-ink-700"><i class="fas fa-link mr-1"></i>Méthodes liées</h3>
            <p class="font-hand text-base text-ink-500">Liez plusieurs méthodes pour ne jamais perdre l'accès.</p>
            <${Provider} id="google.com" label="Google" icon="fab fa-google" color="text-blue-600" linked=${has('google.com')} />
            <${Provider} id="github.com" label="GitHub" icon="fab fa-github" color="text-ink-800" linked=${has('github.com')} />
            <${Provider} id="yahoo.com"  label="Yahoo"  icon="fab fa-yahoo"  color="text-purple-600" linked=${has('yahoo.com')} />
            <${Provider} id="phone"      label="Téléphone" icon="fas fa-mobile-screen" color="text-emerald-600" linked=${has('phone')} />
            <${Provider} id="password"   label="Email + mot de passe" icon="fas fa-envelope" color="text-amber-600" linked=${has('password')} />
          </div>

          ${!has('password') && html`
            <form onSubmit=${handleLinkEmail} class="space-y-2 p-3 paper-card-soft">
              <h4 class="text-sm font-semibold text-ink-800"><i class="fas fa-envelope mr-1 text-amber-600"></i>Lier un email + mot de passe</h4>
              <input type="email" required autocomplete="email" placeholder="email@exemple.fr" value=${linkEmail} onInput=${(e) => setLinkEmail(e.target.value)} class="paper-input w-full px-3 py-2 text-sm" />
              <input type="password" required minlength="6" autocomplete="new-password" placeholder="Mot de passe (6+)" value=${linkPwd} onInput=${(e) => setLinkPwd(e.target.value)} class="paper-input w-full px-3 py-2 text-sm" />
              <button type="submit" disabled=${busy} class="paper-btn-primary w-full py-2 text-sm font-medium disabled:opacity-50">Lier</button>
            </form>
          `}
          ${!has('phone') && html`
            <div class="space-y-2 p-3 paper-card-soft">
              <h4 class="text-sm font-semibold text-ink-800"><i class="fas fa-mobile-screen mr-1 text-emerald-600"></i>Lier un téléphone</h4>
              ${!linkConf ? html`
                <form onSubmit=${handleLinkPhone} class="space-y-2">
                  <input type="tel" required autocomplete="tel" inputmode="tel" placeholder="+33 6 12 34 56 78" value=${linkPhone} onInput=${(e) => setLinkPhone(e.target.value)} class="paper-input w-full px-3 py-2 text-sm" />
                  <button type="submit" disabled=${busy} class="paper-btn-primary w-full py-2 text-sm font-medium disabled:opacity-50">Recevoir le SMS</button>
                </form>
              ` : html`
                <form onSubmit=${handleConfirmPhone} class="space-y-2">
                  <input type="text" required autocomplete="one-time-code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" value=${linkCode} onInput=${(e) => setLinkCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" class="paper-input w-full px-3 py-2 text-center text-lg tracking-[0.4em] font-mono" />
                  <button type="submit" disabled=${busy || linkCode.length !== 6} class="paper-btn-primary w-full py-2 text-sm font-medium disabled:opacity-50">Valider</button>
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
// ❤️ MODAL FAVORIS + HISTORIQUE
// ═══════════════════════════════════════════════════════════════════
function FavoritesModal({ open, onClose }) {
  const [tab, setTab] = useState('favorites');
  const [favorites, setFavorites] = useState(getFavoritesDetailed());
  const [history, setHistory] = useState(getHistory());

  useEffect(() => {
    const onF = () => setFavorites(getFavoritesDetailed());
    const onH = () => setHistory(getHistory());
    window.addEventListener('wrc:favorites-changed', onF);
    window.addEventListener('wrc:history-changed', onH);
    if (open) { onF(); onH(); }
    return () => {
      window.removeEventListener('wrc:favorites-changed', onF);
      window.removeEventListener('wrc:history-changed', onH);
    };
  }, [open]);

  if (!open) return null;
  const list = tab === 'favorites' ? favorites : history;

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md fade-in" onClick=${onClose}>
      <div class="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 scale-in" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b border-white/5 flex items-center justify-between">
          <h2 class="text-xl font-display font-bold flex items-center gap-2">
            <i class=${'fas ' + (tab === 'favorites' ? 'fa-heart text-rose-400' : 'fa-clock-rotate-left text-brand-400')}></i>
            ${tab === 'favorites' ? 'Mes favoris' : 'Mon historique'}
          </h2>
          <button onClick=${onClose} class="p-2 hover:bg-white/5 rounded-lg"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="px-5 pt-3 flex gap-2">
          <button onClick=${() => setTab('favorites')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'favorites' ? 'bg-rose-500 text-white' : 'bg-slate-800 hover:bg-slate-700')}>
            <i class="fas fa-heart mr-1"></i>Favoris (${favorites.length})
          </button>
          <button onClick=${() => setTab('history')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'history' ? 'bg-brand-500 text-white' : 'bg-slate-800 hover:bg-slate-700')}>
            <i class="fas fa-clock-rotate-left mr-1"></i>Historique (${history.length})
          </button>
        </div>
        <div class="flex-1 overflow-auto p-5">
          ${list.length === 0 ? html`
            <div class="text-center py-12 text-slate-500">
              <i class=${'fas ' + (tab === 'favorites' ? 'fa-heart-crack' : 'fa-clock') + ' text-4xl mb-3 opacity-30'}></i>
              <p>${tab === 'favorites' ? 'Aucun favori. Cliquez sur ❤️ pour en ajouter.' : 'Aucune lecture récente.'}</p>
            </div>
          ` : html`
            <ul class="space-y-2">
              ${list.map((it, i) => html`
                <li key=${(it.id || '') + i} class="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-slate-800 transition">
                  <div class="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 gradient-brand flex items-center justify-center text-white">
                    ${it.cover
                      ? html`<img src=${it.cover} alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" />`
                      : html`<i class=${'fas ' + (it.type === 'audio' ? 'fa-music' : it.type === 'video' ? 'fa-film' : 'fa-play')}></i>`}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">${it.name || it.id}</div>
                    <div class="text-[11px] text-slate-500">
                      ${tab === 'favorites' ? 'Ajouté le ' + new Date(it.added).toLocaleDateString('fr-FR') : 'Écouté le ' + new Date(it.playedAt).toLocaleString('fr-FR')}
                    </div>
                  </div>
                  ${tab === 'favorites' && html`
                    <button onClick=${() => toggleFavorite(it.id, it)} class="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400" title="Retirer">
                      <i class="fas fa-heart-crack"></i>
                    </button>
                  `}
                </li>
              `)}
            </ul>
          `}
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// 🛡️ ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════
function AdminPanel({ open, onClose }) {
  const [tab, setTab] = useState('comments');
  const [allComments, setAllComments] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [cms, reps] = await Promise.all([getAllComments(500), getAllReports().catch(() => [])]);
      setAllComments(cms); setReports(reps);
    } catch (err) { toastError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);
  if (!open) return null;

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ?')) return;
    try { await deleteComment(id); setAllComments((c) => c.filter((x) => x.id !== id)); toastSuccess('Supprimé'); }
    catch (err) { toastError(err.message); }
  };
  const handleBan = async (uid, name) => {
    const reason = prompt(`Bannir ${name || uid} ? Motif :`, 'Comportement abusif');
    if (reason === null) return;
    try { await banUser(uid, { reason }); toastSuccess('Banni'); }
    catch (err) { toastError(err.message); }
  };
  const handleUnban = async (uid) => {
    if (!confirm('Débannir ?')) return;
    try { await unbanUser(uid); toastSuccess('Débanni'); }
    catch (err) { toastError(err.message); }
  };

  const filtered = search ? allComments.filter((c) => (c.content + ' ' + (c.user_email || '') + ' ' + (c.media_name || '')).toLowerCase().includes(search.toLowerCase())) : allComments;
  const byMedia = {};
  filtered.forEach((c) => { if (!byMedia[c.media_id]) byMedia[c.media_id] = { media_name: c.media_name, comments: [] }; byMedia[c.media_id].comments.push(c); });

  return html`
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md fade-in" onClick=${onClose}>
      <div class="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10 scale-in" onClick=${(e) => e.stopPropagation()}>
        <div class="p-5 border-b border-white/5 flex items-center justify-between gap-3">
          <h2 class="text-xl font-display font-bold flex items-center gap-2"><i class="fas fa-user-shield text-amber-400"></i>Administration</h2>
          <div class="flex items-center gap-2">
            <button onClick=${load} class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700"><i class=${'fas fa-rotate ' + (loading ? 'fa-spin' : '')}></i></button>
            <button onClick=${onClose} class="p-2 hover:bg-white/5 rounded-lg"><i class="fas fa-xmark"></i></button>
          </div>
        </div>
        <div class="px-5 pt-4 space-y-3">
          <div class="flex gap-2">
            <button onClick=${() => setTab('comments')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'comments' ? 'bg-brand-500 text-white' : 'bg-slate-800 hover:bg-slate-700')}>
              <i class="fas fa-comments mr-1"></i>Commentaires (${allComments.length})
            </button>
            <button onClick=${() => setTab('reports')} class=${'px-3 py-1.5 rounded-lg text-sm font-medium ' + (tab === 'reports' ? 'bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700')}>
              <i class="fas fa-flag mr-1"></i>Signalements (${reports.length})
            </button>
            <button onClick=${() => { clearCache(); toastSuccess('Cache GitHub vidé'); }} class="ml-auto px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700">
              <i class="fas fa-broom mr-1"></i>Vider cache
            </button>
          </div>
          ${tab === 'comments' && html`
            <div class="relative">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input value=${search} onInput=${(e) => setSearch(e.target.value)} placeholder="Rechercher…" class="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-slate-800" />
            </div>
          `}
        </div>
        <div class="flex-1 overflow-auto p-5">
          ${loading ? html`<div class="text-center py-10"><div class="spinner w-10 h-10 mx-auto"></div></div>`
          : tab === 'reports' ? (reports.length === 0 ? html`<div class="text-center py-10 text-slate-500"><i class="fas fa-flag-checkered text-4xl mb-2 opacity-30"></i><p>Aucun signalement</p></div>` : html`
            <div class="space-y-3">
              ${(() => {
                const grouped = {};
                reports.forEach((r) => { if (!grouped[r.comment_id]) grouped[r.comment_id] = []; grouped[r.comment_id].push(r); });
                return Object.entries(grouped).map(([cid, reps]) => {
                  const com = allComments.find((c) => c.id === cid);
                  return html`
                    <div key=${cid} class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
                      <div class="flex items-start justify-between gap-3 flex-wrap">
                        <div class="flex-1 min-w-0">
                          <div class="text-xs text-amber-300 font-bold mb-2">
                            <i class="fas fa-flag"></i> ${reps.length} signalement(s) — ${com ? 'par ' + (com.user_name || com.user_email || com.user_uid?.slice(0,8)) : 'commentaire supprimé'}
                          </div>
                          ${com ? html`<p class="text-sm whitespace-pre-wrap break-words bg-slate-900/60 p-2 rounded-lg">${com.content}</p>` : ''}
                          <ul class="mt-2 space-y-1 text-xs text-slate-400">
                            ${reps.map((r) => html`<li key=${r.id}>• <span class="font-mono">${r.reporter_uid?.slice(0,8)}</span> — "${r.reason || '(pas de motif)'}" — ${new Date(r.created_at).toLocaleString('fr-FR')}</li>`)}
                          </ul>
                        </div>
                        <div class="flex flex-col gap-1.5">
                          ${com && html`<button onClick=${() => handleDelete(com.id)} class="text-xs px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white">Supprimer</button>`}
                          ${com && html`<button onClick=${() => handleBan(com.user_uid, com.user_name)} class="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">Bannir</button>`}
                          ${com && html`<button onClick=${() => handleUnban(com.user_uid)} class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700">Débannir</button>`}
                        </div>
                      </div>
                    </div>
                  `;
                });
              })()}
            </div>
          `)
          : Object.keys(byMedia).length === 0 ? html`<div class="text-center py-10 text-slate-500"><i class="fas fa-inbox text-4xl mb-2 opacity-30"></i><p>Aucun commentaire</p></div>`
          : html`
            <div class="space-y-5">
              ${Object.entries(byMedia).map(([mid, grp]) => html`
                <section key=${mid}>
                  <h3 class="text-sm font-bold text-slate-300 mb-2 pb-2 border-b border-white/5">
                    <i class="fas fa-file-audio mr-1 text-brand-400"></i>${grp.media_name}
                    <span class="ml-2 text-xs font-normal text-slate-500">${grp.comments.length} commentaire(s)</span>
                  </h3>
                  <ul class="space-y-2">
                    ${grp.comments.map((c) => html`
                      <li key=${c.id} class="bg-slate-800/40 border border-white/5 rounded-xl p-3">
                        <div class="flex items-start gap-3">
                          <div class=${'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' + (isAdmin(c.user_email, c.user_phone) ? 'bg-amber-500 text-white' : 'gradient-brand text-white')}>
                            ${(c.user_name || '?')[0].toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-baseline gap-2 flex-wrap text-sm">
                              <span class="font-semibold">${c.user_name}</span>
                              <span class="text-xs text-slate-500">${c.user_email || c.user_phone || ''}</span>
                              ${isAdmin(c.user_email, c.user_phone) && html`<span class="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">ADMIN</span>`}
                              <span class="text-[11px] text-slate-500">• ${new Date(c.created_at).toLocaleString('fr-FR')}</span>
                              <span class="text-[10px] text-slate-600 font-mono">${c.user_uid?.slice(0, 8)}…</span>
                            </div>
                            <p class="text-sm mt-1 whitespace-pre-wrap break-words">${c.content}</p>
                          </div>
                          <div class="flex items-center gap-1">
                            <button onClick=${() => handleBan(c.user_uid, c.user_name)} class="p-1.5 rounded-lg hover:bg-amber-500/20 text-slate-400 hover:text-amber-400" title="Bannir"><i class="fas fa-ban text-xs"></i></button>
                            <button onClick=${() => handleDelete(c.id)} class="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Supprimer"><i class="fas fa-trash text-xs"></i></button>
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
// 🚀 APP PRINCIPALE
// ═══════════════════════════════════════════════════════════════════
function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isBanned, setIsBanned] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [search, setSearch] = useState('');
  const [counts, setCounts] = useState({});

  // Theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.body.className = theme === 'dark'
      ? 'bg-slate-950 text-slate-100 min-h-screen overflow-x-hidden'
      : 'bg-slate-50 text-slate-900 min-h-screen overflow-x-hidden';
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auth
  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthChanged(async (u) => {
        setUser(u);
        if (u) {
          try {
            const p = await syncProfileFromUser(u);
            setProfile(p);
            const banned = await isUserBanned(u.uid);
            setIsBanned(banned);
            if (banned) toastWarn('Votre compte est suspendu', 'Compte banni');
          } catch (e) { logger.warn('Sync profil échoué', { err: e.message }); }
        } else { setProfile(null); setIsBanned(false); }
      });
    } catch (err) { logger.error('Auth indisponible', { err: err.message }); }
    return () => unsub();
  }, []);

  const onCount = (id, n) => setCounts((c) => ({ ...c, [id]: n }));
  const scrollTo = (id) => {
    const el = document.getElementById('section-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return html`
    <div class="min-h-screen">
      <${Header}
        user=${user} profile=${profile} theme=${theme}
        searchQuery=${search} onSearch=${setSearch}
        onLogin=${() => setAuthOpen(true)}
        onLogout=${async () => { await logout(); toastInfo('Déconnecté'); }}
        onOpenAdmin=${() => setAdminOpen(true)}
        onOpenProfile=${() => setProfileOpen(true)}
        onOpenFavorites=${() => setFavoritesOpen(true)}
        onToggleTheme=${() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      ${isBanned && html`
        <div class="max-w-7xl mx-auto px-4 mt-3">
          <div class="bg-rose-500/20 border border-rose-500/40 text-rose-200 rounded-2xl p-4 fade-in">
            <div class="font-bold flex items-center gap-2"><i class="fas fa-ban"></i>Compte suspendu</div>
            <div class="text-sm mt-1">Vous pouvez naviguer mais vous ne pouvez plus poster.</div>
          </div>
        </div>
      `}

      <main class="max-w-7xl mx-auto px-4 py-6">
        <${Hero} onScrollTo=${scrollTo} totals=${counts} />

        <${AdSlot} slot="header" label="Bannière sponsorisée" />

        ${SECTIONS.map((s, idx) => html`
          <${Section} key=${s.id} section=${s} user=${user}
            onOpenAuth=${() => setAuthOpen(true)}
            searchQuery=${search}
            onCount=${onCount} />
          ${idx === 0 && html`<${AdSlot} slot="inFeed" label="Annonce — entre les sections" />`}
        `)}

        <${AdSlot} slot="footer" label="Bannière bas de page" />
      </main>

      <footer class="max-w-7xl mx-auto px-4 py-8 text-center text-xs text-ink-400 border-t border-ink-700/20 mt-12">
        <p class="font-display font-bold text-ink-700 mb-1">${SITE.title} • ${SITE.subtitle}</p>
        <p class="opacity-70">${SITE.description}</p>
        <p class="mt-2 opacity-60">
          Source : <a href=${'https://github.com/' + REPO.owner + '/' + REPO.repo} target="_blank" rel="noopener noreferrer" class="hover:text-ink-700 hover:underline">github.com/${REPO.owner}/${REPO.repo}</a>
          • ${(REPO_POOL && REPO_POOL.length) || 1} dépôt(s) en pool • v6.0
        </p>
      </footer>

      <${AuthModal} open=${authOpen} onClose=${() => setAuthOpen(false)} />
      <${ProfileModal} open=${profileOpen} onClose=${() => setProfileOpen(false)} user=${user} profile=${profile} onProfileUpdate=${setProfile} />
      <${FavoritesModal} open=${favoritesOpen} onClose=${() => setFavoritesOpen(false)} />
      <${AdminPanel} open=${adminOpen && user && isAdmin(user.email, user.phoneNumber)} onClose=${() => setAdminOpen(false)} />
      <${ToastContainer} />
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════
// MOUNT
// ═══════════════════════════════════════════════════════════════════
logger.info(`🎙️ ${SITE.title} v5.0 démarre`, {
  repo: `${REPO.owner}/${REPO.repo}@${REPO.branch}`,
  rootPath: REPO.rootPath,
  sections: SECTIONS.map((s) => s.folder),
  authProviders: ['email/username', 'google', 'phone', 'github', 'yahoo'],
  features: ['profil-upload', 'favoris', 'historique', 'recherche', 'toasts', 'lecteurs-custom'],
});

const root = createRoot(document.getElementById('root'));
root.render(html`<${App} />`);

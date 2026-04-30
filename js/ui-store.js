/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  STORE LOCAL — Favoris, Historique, Préférences                    ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Stocke côté client (localStorage) :                               ║
 * ║   • Favoris (liste de mediaIds)                                    ║
 * ║   • Historique de lecture (10 derniers, avec timestamps)           ║
 * ║   • Préférences (volume, vitesse de lecture, thème)                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { logger } from './logger.js';

const KEY_FAVORITES = 'wrc:favorites';
const KEY_HISTORY = 'wrc:history';
const KEY_PREFS = 'wrc:prefs';
const HISTORY_MAX = 20;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { logger.warn('localStorage plein', { err: e.message }); }
}

// ═══════════════════════════════════════════════════════════════════
// ❤️ FAVORIS
// ═══════════════════════════════════════════════════════════════════
export function getFavorites() { return read(KEY_FAVORITES, []); }
export function isFavorite(mediaId) { return getFavorites().includes(mediaId); }
export function toggleFavorite(mediaId, mediaInfo = {}) {
  const list = read(KEY_FAVORITES, []);
  const idx = list.findIndex((f) => (typeof f === 'string' ? f : f.id) === mediaId);
  if (idx >= 0) {
    list.splice(idx, 1);
    logger.info('💔 Favori retiré', { mediaId });
  } else {
    list.push({ id: mediaId, name: mediaInfo.name, cover: mediaInfo.cover, type: mediaInfo.type, added: Date.now() });
    logger.success('❤️ Ajouté aux favoris', { mediaId });
  }
  write(KEY_FAVORITES, list);
  // Notifier les composants
  window.dispatchEvent(new CustomEvent('wrc:favorites-changed'));
  return list;
}
export function getFavoritesDetailed() { return read(KEY_FAVORITES, []).filter((f) => typeof f === 'object'); }

// ═══════════════════════════════════════════════════════════════════
// 🕐 HISTORIQUE
// ═══════════════════════════════════════════════════════════════════
export function addToHistory(mediaInfo) {
  if (!mediaInfo?.id) return;
  let list = read(KEY_HISTORY, []);
  list = list.filter((h) => h.id !== mediaInfo.id); // dédup
  list.unshift({ ...mediaInfo, playedAt: Date.now() });
  list = list.slice(0, HISTORY_MAX);
  write(KEY_HISTORY, list);
  window.dispatchEvent(new CustomEvent('wrc:history-changed'));
}
export function getHistory() { return read(KEY_HISTORY, []); }
export function clearHistory() { write(KEY_HISTORY, []); window.dispatchEvent(new CustomEvent('wrc:history-changed')); }

// ═══════════════════════════════════════════════════════════════════
// ⚙️ PRÉFÉRENCES
// ═══════════════════════════════════════════════════════════════════
const DEFAULT_PREFS = { volume: 0.8, muted: false, playbackRate: 1, theme: 'dark', autoplay: false };
export function getPrefs() { return { ...DEFAULT_PREFS, ...read(KEY_PREFS, {}) }; }
export function setPref(key, value) {
  const p = getPrefs();
  p[key] = value;
  write(KEY_PREFS, p);
}

// ═══════════════════════════════════════════════════════════════════
// 🔔 TOAST SYSTEM
// ═══════════════════════════════════════════════════════════════════
let toastListeners = new Set();
let toastIdCounter = 0;
export function subscribeToasts(fn) { toastListeners.add(fn); return () => toastListeners.delete(fn); }
export function toast({ title, message, type = 'info', duration = 4000 }) {
  const id = ++toastIdCounter;
  const t = { id, title, message, type, duration };
  toastListeners.forEach((fn) => fn({ kind: 'add', toast: t }));
  if (duration > 0) {
    setTimeout(() => {
      toastListeners.forEach((fn) => fn({ kind: 'remove', id }));
    }, duration);
  }
  return id;
}
export function dismissToast(id) {
  toastListeners.forEach((fn) => fn({ kind: 'remove', id }));
}

// Helpers pratiques
export const toastSuccess = (msg, title = 'Succès') => toast({ title, message: msg, type: 'success' });
export const toastError = (msg, title = 'Erreur') => toast({ title, message: msg, type: 'error', duration: 6000 });
export const toastInfo = (msg, title = '') => toast({ title, message: msg, type: 'info' });
export const toastWarn = (msg, title = 'Attention') => toast({ title, message: msg, type: 'warn' });

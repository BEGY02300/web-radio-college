/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  PROFILS UTILISATEUR + SIGNALEMENTS + BAN (via Supabase)            ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Tables Supabase utilisées (créer via supabase-setup.sql) :         ║
 * ║   - profiles (user_uid, username unique, avatar_url, bio…)          ║
 * ║   - reports (signalements de commentaires)                          ║
 * ║   - bans (utilisateurs bannis)                                      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { logger } from './logger.js';
import { SUPABASE_CONFIG } from './config.js';
import { validateUsername, validateBio, isAllowedImageUrl, sanitizeText } from './moderation.js';

let supabase = null;
let initError = null;

function init() {
  if (supabase || initError) return;
  try {
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.startsWith('REMPLACEZ')) {
      throw new Error('Configuration Supabase manquante — remplissez env.js');
    }
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: false },
    });
  } catch (e) {
    initError = e;
    logger.error('Profile service: init Supabase échoué', { err: e.message });
  }
}
function ensure() { if (!supabase && !initError) init(); if (initError) throw initError; }

// ═══════════════════════════════════════════════════════════════════
// 👤 PROFILS
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère le profil d'un user (par UID Firebase). null si pas encore créé.
 */
export async function getProfile(uid) {
  if (!uid) return null;
  ensure();
  const { data, error } = await supabase
    .from('profiles').select('*').eq('user_uid', uid).maybeSingle();
  if (error) { logger.error('getProfile', { err: error.message }); throw error; }
  return data;
}

/**
 * Vérifie si un pseudo est libre (case-insensitive).
 */
export async function isUsernameAvailable(username, exceptUid = null) {
  ensure();
  const v = validateUsername(username);
  if (!v.ok) return { ok: false, error: v.error };
  // case-insensitive lookup
  const { data, error } = await supabase
    .from('profiles').select('user_uid, username')
    .ilike('username', v.value);
  if (error) throw error;
  const taken = (data || []).find((r) => r.user_uid !== exceptUid);
  return { ok: !taken, value: v.value };
}

/**
 * Récupère un profil par pseudo (case-insensitive).
 */
export async function getProfileByUsername(username) {
  ensure();
  const { data, error } = await supabase
    .from('profiles').select('*').ilike('username', String(username).trim()).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Crée ou met à jour le profil de l'utilisateur courant.
 * @param {object} fields - { username?, avatar_url?, bio?, email?, phone? }
 */
export async function upsertProfile(uid, fields = {}) {
  ensure();
  if (!uid) throw new Error('UID requis');

  const payload = { user_uid: uid, updated_at: new Date().toISOString() };

  if (fields.username !== undefined) {
    const check = await isUsernameAvailable(fields.username, uid);
    if (!check.ok) throw new Error(check.error || 'Pseudo déjà pris');
    payload.username = check.value;
  }

  if (fields.bio !== undefined) {
    const v = validateBio(fields.bio);
    if (!v.ok) throw new Error(v.error);
    payload.bio = v.value;
  }

  if (fields.avatar_url !== undefined) {
    if (fields.avatar_url && !isAllowedImageUrl(fields.avatar_url)) {
      throw new Error('URL d\'image invalide ou domaine non autorisé.');
    }
    payload.avatar_url = fields.avatar_url || null;
  }

  if (fields.email !== undefined) payload.email = fields.email || null;
  if (fields.phone !== undefined) payload.phone = fields.phone || null;
  if (fields.providers !== undefined) payload.providers = fields.providers;

  logger.db('upsert profile', { uid, fields: Object.keys(payload) });

  const { data, error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'user_uid' })
    .select().single();
  if (error) {
    logger.error('upsertProfile', { err: error.message });
    throw error;
  }
  logger.success('✓ Profil enregistré', { username: data.username });
  return data;
}

/**
 * Synchronise le profil quand l'utilisateur change de méthode liée.
 * À appeler après chaque login ou linkProvider.
 */
export async function syncProfileFromUser(user) {
  if (!user) return null;
  const providers = (user.providerData || []).map((p) => p.providerId);
  const existing = await getProfile(user.uid).catch(() => null);

  // Si pas de profil, on en crée un avec un pseudo proposé
  if (!existing) {
    let suggestedName =
      (user.displayName || user.email?.split('@')[0] || (user.phoneNumber ? 'user' + user.phoneNumber.slice(-4) : `user${user.uid.slice(0,5)}`))
        .replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 20);
    if (suggestedName.length < 3) suggestedName = 'user_' + user.uid.slice(0, 6);

    // Trouver un pseudo libre (suffixe numérique si pris)
    let candidate = suggestedName;
    for (let i = 0; i < 50; i++) {
      const r = await isUsernameAvailable(candidate, user.uid);
      if (r.ok) break;
      candidate = (suggestedName + Math.floor(Math.random() * 9999)).slice(0, 20);
    }
    return upsertProfile(user.uid, {
      username: candidate,
      email: user.email || null,
      phone: user.phoneNumber || null,
      avatar_url: isAllowedImageUrl(user.photoURL) ? user.photoURL : null,
      providers,
    });
  }

  // Sinon, on met juste à jour les champs techniques
  return upsertProfile(user.uid, {
    email: user.email || existing.email,
    phone: user.phoneNumber || existing.phone,
    providers,
  });
}

// ═══════════════════════════════════════════════════════════════════
// 🚫 BANS (admin uniquement)
// ═══════════════════════════════════════════════════════════════════
export async function isUserBanned(uid) {
  if (!uid) return false;
  ensure();
  const { data, error } = await supabase
    .from('bans').select('user_uid, until').eq('user_uid', uid).maybeSingle();
  if (error) { logger.error('isUserBanned', { err: error.message }); return false; }
  if (!data) return false;
  if (data.until && new Date(data.until) < new Date()) return false;
  return true;
}

export async function banUser(uid, { reason, until } = {}) {
  ensure();
  const { error } = await supabase.from('bans').upsert({
    user_uid: uid,
    reason: sanitizeText(reason || '', 200),
    until: until || null,
    created_at: new Date().toISOString(),
  }, { onConflict: 'user_uid' });
  if (error) throw error;
  logger.warn('🚫 User banni', { uid, reason });
}

export async function unbanUser(uid) {
  ensure();
  const { error } = await supabase.from('bans').delete().eq('user_uid', uid);
  if (error) throw error;
  logger.success('✓ User débanni', { uid });
}

// ═══════════════════════════════════════════════════════════════════
// 🚩 SIGNALEMENTS (report)
// ═══════════════════════════════════════════════════════════════════
const REPORTS_BEFORE_AUTO_HIDE = 3;

export async function reportComment({ commentId, reporterUid, reason }) {
  ensure();
  if (!commentId || !reporterUid) throw new Error('Paramètres manquants');
  const payload = {
    comment_id: commentId,
    reporter_uid: reporterUid,
    reason: sanitizeText(reason || '', 200),
    created_at: new Date().toISOString(),
  };
  // Empêcher les doublons (un user = un signalement par commentaire)
  const { data: existing } = await supabase
    .from('reports').select('id')
    .eq('comment_id', commentId).eq('reporter_uid', reporterUid).maybeSingle();
  if (existing) {
    logger.info('Déjà signalé par cet utilisateur');
    return { duplicated: true };
  }
  const { error } = await supabase.from('reports').insert(payload);
  if (error) { logger.error('reportComment', { err: error.message }); throw error; }
  logger.warn('🚩 Commentaire signalé', { commentId });
  return { ok: true };
}

export async function getReportCount(commentId) {
  ensure();
  const { count, error } = await supabase
    .from('reports').select('*', { count: 'exact', head: true })
    .eq('comment_id', commentId);
  if (error) return 0;
  return count || 0;
}

/** (Admin) Liste tous les signalements groupés par commentaire. */
export async function getAllReports() {
  ensure();
  const { data, error } = await supabase
    .from('reports').select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export const REPORT_THRESHOLD = REPORTS_BEFORE_AUTO_HIDE;

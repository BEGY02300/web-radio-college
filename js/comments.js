/**
 * Service de gestion des commentaires via Supabase + modération.
 *
 * Pipeline d'envoi :
 *   1) sanitize + bad words + liens + rate limit  (moderation.js)
 *   2) check ban utilisateur (profile.js)
 *   3) insert avec user_uid / user_email / user_phone / user_name
 *
 * Lecture : retourne aussi report_count pour cacher auto les contenus signalés.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { logger } from './logger.js';
import { SUPABASE_CONFIG } from './config.js';
import { validateComment, sanitizeText } from './moderation.js';
import { isUserBanned, getProfile, REPORT_THRESHOLD } from './profile.js';

let supabase = null;
let initError = null;

function init() {
  if (supabase || initError) return;
  try {
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.startsWith('REMPLACEZ')) {
      throw new Error('Configuration Supabase manquante — remplissez env.js ou .env');
    }
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: false },
    });
    logger.db('Supabase initialisé', { url: SUPABASE_CONFIG.url });
  } catch (err) {
    initError = err;
    logger.error('Échec initialisation Supabase', { message: err.message });
  }
}
function ensureInit() {
  if (!supabase && !initError) init();
  if (initError) throw initError;
}

/**
 * Récupère les commentaires d'un média + le nombre de signalements.
 */
export async function getCommentsForMedia(mediaId) {
  ensureInit();
  logger.db(`Chargement des commentaires pour : ${mediaId}`);
  const { data, error } = await supabase
    .from('comments').select('*')
    .eq('media_id', mediaId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Erreur Supabase (getCommentsForMedia)', { error: error.message });
    throw error;
  }

  // Récupérer les signalements pour cacher automatiquement les contenus très signalés
  const ids = (data || []).map((c) => c.id);
  let reportCounts = {};
  if (ids.length) {
    const { data: reps } = await supabase
      .from('reports').select('comment_id').in('comment_id', ids);
    (reps || []).forEach((r) => {
      reportCounts[r.comment_id] = (reportCounts[r.comment_id] || 0) + 1;
    });
  }

  const enriched = (data || []).map((c) => ({
    ...c,
    report_count: reportCounts[c.id] || 0,
    auto_hidden: (reportCounts[c.id] || 0) >= REPORT_THRESHOLD,
  }));

  logger.success(`✓ ${enriched.length} commentaire(s) chargé(s)`);
  return enriched;
}

/**
 * Poste un nouveau commentaire — passe par toute la chaîne de modération.
 */
export async function postComment({ mediaId, mediaName, user, content }) {
  ensureInit();
  if (!user) throw new Error('Connexion requise');

  // 1) Vérifier ban
  const banned = await isUserBanned(user.uid);
  if (banned) {
    const err = new Error('Votre compte ne peut plus poster de commentaires.');
    err.code = 'banned';
    throw err;
  }

  // 2) Modération (sanitize + bad words + liens + rate limit)
  const v = validateComment({ text: content, userId: user.uid });
  if (!v.ok) {
    const err = new Error(v.error);
    err.code = 'moderation';
    throw err;
  }

  // 3) Préfère le pseudo Supabase si dispo (sinon displayName Firebase)
  let userName = user.displayName;
  try {
    const prof = await getProfile(user.uid);
    if (prof?.username) userName = prof.username;
  } catch (e) {}
  if (!userName) {
    if (user.phoneNumber) {
      // Masque le numéro pour l'affichage : +33•••••••XX
      userName = user.phoneNumber.slice(0, 3) + '•••••••' + user.phoneNumber.slice(-2);
    } else if (user.email) {
      userName = user.email.split('@')[0];
    } else userName = 'Anonyme';
  }

  const payload = {
    media_id: mediaId,
    media_name: sanitizeText(mediaName, 200),
    user_uid: user.uid,
    user_email: user.email || null,
    user_phone: user.phoneNumber || null,
    user_name: sanitizeText(userName, 50),
    content: v.value,
  };
  logger.db('📝 Envoi commentaire', { uid: payload.user_uid, name: payload.user_name });

  const { data, error } = await supabase.from('comments').insert(payload).select().single();
  if (error) {
    logger.error('Erreur Supabase (postComment)', { error: error.message });
    throw error;
  }
  logger.success('✓ Commentaire publié', { id: data.id });
  return data;
}

export async function deleteComment(commentId) {
  ensureInit();
  logger.db(`🗑️ Suppression commentaire : ${commentId}`);
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) {
    logger.error('Erreur Supabase (deleteComment)', { error: error.message });
    throw error;
  }
  logger.success('✓ Commentaire supprimé');
}

export async function getAllComments(limit = 200) {
  ensureInit();
  logger.db(`[ADMIN] Chargement tous commentaires (limite ${limit})`);
  const { data, error } = await supabase
    .from('comments').select('*')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) {
    logger.error('Erreur Supabase (getAllComments)', { error: error.message });
    throw error;
  }

  // Joindre report_count
  const ids = (data || []).map((c) => c.id);
  let reportCounts = {};
  if (ids.length) {
    const { data: reps } = await supabase
      .from('reports').select('comment_id').in('comment_id', ids);
    (reps || []).forEach((r) => {
      reportCounts[r.comment_id] = (reportCounts[r.comment_id] || 0) + 1;
    });
  }
  const enriched = (data || []).map((c) => ({
    ...c, report_count: reportCounts[c.id] || 0,
  }));
  logger.success(`✓ ${enriched.length} commentaire(s) au total`);
  return enriched;
}

export async function getCommentCounts() {
  ensureInit();
  const { data, error } = await supabase.from('comments').select('media_id, media_name');
  if (error) throw error;
  const counts = {};
  (data || []).forEach((c) => {
    if (!counts[c.media_id]) counts[c.media_id] = { media_name: c.media_name, count: 0 };
    counts[c.media_id].count++;
  });
  return counts;
}

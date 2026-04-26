/**
 * Service de gestion des commentaires via Supabase.
 *
 * Table attendue : `comments`
 *   - id            (uuid, default gen_random_uuid(), primary)
 *   - media_id      (text)    ← identifiant stable du média (chemin dans le repo)
 *   - media_name    (text)    ← nom du fichier pour l'affichage admin
 *   - user_uid      (text)    ← Firebase UID
 *   - user_email    (text)    ← peut être null si connexion par téléphone
 *   - user_phone    (text)    ← peut être null si connexion par email
 *   - user_name     (text)
 *   - content       (text)
 *   - created_at    (timestamptz default now())
 *
 * Voir README pour la création de la table et des RLS policies.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { logger } from './logger.js';
import { SUPABASE_CONFIG } from './config.js';

let supabase = null;
let initError = null;

function init() {
  if (supabase || initError) return;
  try {
    if (!SUPABASE_CONFIG.url || SUPABASE_CONFIG.url.startsWith('REMPLACEZ')) {
      throw new Error('Configuration Supabase manquante — remplissez env.js ou .env');
    }
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: false }, // on utilise Firebase Auth, pas Supabase Auth
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
 * Récupère les commentaires d'un média.
 */
export async function getCommentsForMedia(mediaId) {
  ensureInit();
  logger.db(`Chargement des commentaires pour : ${mediaId}`);
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('media_id', mediaId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('Erreur Supabase (getCommentsForMedia)', { error: error.message });
    throw error;
  }
  logger.success(`✓ ${data.length} commentaire(s) chargé(s)`);
  return data;
}

/**
 * Poste un nouveau commentaire.
 */
export async function postComment({ mediaId, mediaName, user, content }) {
  ensureInit();
  const payload = {
    media_id: mediaId,
    media_name: mediaName,
    user_uid: user.uid,
    user_email: user.email || null,
    user_phone: user.phoneNumber || null,
    user_name: user.displayName || (user.phoneNumber ? user.phoneNumber.replace(/(?<=^\+\d{2})\d+(?=\d{2}$)/, '•••••') : (user.email ? user.email.split('@')[0] : 'Anonyme')),
    content: String(content).trim().slice(0, 2000),
  };
  logger.db('Envoi d\'un commentaire', payload);
  const { data, error } = await supabase.from('comments').insert(payload).select().single();
  if (error) {
    logger.error('Erreur Supabase (postComment)', { error: error.message });
    throw error;
  }
  logger.success('✓ Commentaire publié', { id: data.id });
  return data;
}

/**
 * Supprime un commentaire (admin ou auteur).
 */
export async function deleteComment(commentId) {
  ensureInit();
  logger.db(`Suppression commentaire : ${commentId}`);
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) {
    logger.error('Erreur Supabase (deleteComment)', { error: error.message });
    throw error;
  }
  logger.success('✓ Commentaire supprimé');
}

/**
 * (Admin) Récupère TOUS les commentaires, toutes médias confondus.
 */
export async function getAllComments(limit = 200) {
  ensureInit();
  logger.db(`[ADMIN] Chargement de tous les commentaires (limite ${limit})`);
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.error('Erreur Supabase (getAllComments)', { error: error.message });
    throw error;
  }
  logger.success(`✓ ${data.length} commentaire(s) au total`);
  return data;
}

/**
 * (Admin) Compte les commentaires par média.
 */
export async function getCommentCounts() {
  ensureInit();
  const { data, error } = await supabase
    .from('comments')
    .select('media_id, media_name');
  if (error) throw error;
  const counts = {};
  data.forEach((c) => {
    if (!counts[c.media_id]) counts[c.media_id] = { media_name: c.media_name, count: 0 };
    counts[c.media_id].count++;
  });
  return counts;
}

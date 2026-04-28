import { createClient } from '@supabase/supabase-js';
import { logger } from './logger.js';
import { SUPABASE_CONFIG } from './config.js';

let supabase = null, initError = null;
function init() {
  if (supabase || initError) return;
  try {
    if (!SUPABASE_CONFIG.url) throw new Error('Config Supabase manquante — voir .env');
    supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, { auth: { persistSession: false } });
    logger.db('Supabase initialisé', { url: SUPABASE_CONFIG.url });
  } catch (err) { initError = err; logger.error('Init Supabase', { message: err.message }); }
}
function ensure() { if (!supabase && !initError) init(); if (initError) throw initError; }

export async function getCommentsForMedia(mediaId) {
  ensure();
  logger.db(`Chargement commentaires : ${mediaId}`);
  const { data, error } = await supabase.from('comments').select('*').eq('media_id', mediaId).order('created_at', { ascending: false });
  if (error) { logger.error('getCommentsForMedia', { error: error.message }); throw error; }
  logger.success(`✓ ${data.length} commentaire(s)`);
  return data;
}
export async function postComment({ mediaId, mediaName, user, content }) {
  ensure();
  const p = { media_id: mediaId, media_name: mediaName, user_uid: user.uid, user_email: user.email, user_name: user.displayName || user.email.split('@')[0], content: String(content).trim().slice(0, 2000) };
  logger.db('Envoi commentaire', p);
  const { data, error } = await supabase.from('comments').insert(p).select().single();
  if (error) throw error;
  logger.success('Commentaire publié', { id: data.id });
  return data;
}
export async function deleteComment(id) {
  ensure(); logger.db(`Suppression : ${id}`);
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
  logger.success('Commentaire supprimé');
}
export async function getAllComments(limit = 200) {
  ensure(); logger.db('[ADMIN] Chargement tous commentaires');
  const { data, error } = await supabase.from('comments').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  logger.success(`✓ ${data.length} commentaire(s)`);
  return data;
}

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  CONFIGURATION DE L'APPLICATION - WEB RADIO COLLÈGE                ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  👉 C'EST ICI QUE VOUS MODIFIEZ LES PARAMÈTRES DE L'APPLICATION    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════
// 📁 DÉPÔT GITHUB SOURCE DES MÉDIAS (codé en dur, pas de config UI)
// ═══════════════════════════════════════════════════════════════════
export const REPO = {
  owner:    'BEGY02300',          // ← propriétaire du dépôt GitHub
  repo:     'web-radio-coll-ge',  // ← nom du dépôt
  branch:   '1',                  // ← branche à lire
  rootPath: 'medias',             // ← dossier racine contenant les médias
};

// ═══════════════════════════════════════════════════════════════════
// 👑 ADMINISTRATEURS DU SITE
// ═══════════════════════════════════════════════════════════════════
//
//  ╔══════════════════════════════════════════════════════════════╗
//  ║  👉 POUR AJOUTER UN ADMIN :                                   ║
//  ║     - ajoutez son email dans ADMIN_EMAILS  OU                 ║
//  ║     - ajoutez son numéro dans ADMIN_PHONES (format E.164)     ║
//  ║  Les admins peuvent voir, supprimer et modérer TOUS les       ║
//  ║  commentaires de TOUS les utilisateurs.                       ║
//  ╚══════════════════════════════════════════════════════════════╝
//
export const ADMIN_EMAILS = [
  'techsaga.fr@gmail.com',
  // 'autre-admin@exemple.fr',        // ← décommentez et remplacez
];

// ⚠️ Depuis que l'auth se fait uniquement par SMS, un admin doit avoir
//    son NUMÉRO enregistré ici (format international +33…). L'email reste
//    utile si vous basculez plus tard sur une auth email.
export const ADMIN_PHONES = [
  // '+33612345678',                  // ← ajoutez le numéro de techsaga
  // '+33700000000',
];

// ═══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE (authentification)
// ═══════════════════════════════════════════════════════════════════
// Les valeurs sont lues depuis .env au build, OU depuis window.__ENV
// pour la version standalone (voir env.js).
const ENV = typeof window !== 'undefined' ? (window.__ENV || {}) : {};

export const FIREBASE_CONFIG = {
  apiKey:            ENV.FIREBASE_API_KEY            || 'REMPLACEZ_PAR_VOTRE_API_KEY',
  authDomain:        ENV.FIREBASE_AUTH_DOMAIN        || 'REMPLACEZ_PAR_VOTRE_AUTH_DOMAIN',
  projectId:         ENV.FIREBASE_PROJECT_ID         || 'REMPLACEZ_PAR_VOTRE_PROJECT_ID',
  storageBucket:     ENV.FIREBASE_STORAGE_BUCKET     || '',
  messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID|| '',
  appId:             ENV.FIREBASE_APP_ID             || 'REMPLACEZ_PAR_VOTRE_APP_ID',
};

// ═══════════════════════════════════════════════════════════════════
// 🗄️ SUPABASE (stockage des commentaires)
// ═══════════════════════════════════════════════════════════════════
export const SUPABASE_CONFIG = {
  url:     ENV.SUPABASE_URL      || 'REMPLACEZ_PAR_VOTRE_URL_SUPABASE',
  anonKey: ENV.SUPABASE_ANON_KEY || 'REMPLACEZ_PAR_VOTRE_CLE_ANON',
};

// ═══════════════════════════════════════════════════════════════════
// 🎨 INFOS SITE
// ═══════════════════════════════════════════════════════════════════
export const SITE = {
  title:       'Web Radio Collège',
  subtitle:    'Podcasts & Reportages',
  description: 'Écoutez et téléchargez les podcasts et reportages de notre web radio.',
};

// ═══════════════════════════════════════════════════════════════════
// 🐞 DEBUG
// ═══════════════════════════════════════════════════════════════════
// true  = logs détaillés dans la console du navigateur (F12)
// false = logs silencieux (prod)
export const DEBUG_CONSOLE = true;

// Helper : vérifie si un utilisateur est admin (email OU téléphone)
export function isAdmin(email, phone) {
  if (email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(email).toLowerCase())) {
    return true;
  }
  if (phone && ADMIN_PHONES.includes(String(phone).trim())) {
    return true;
  }
  return false;
}

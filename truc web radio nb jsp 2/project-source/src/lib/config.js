/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  CONFIGURATION DE L'APPLICATION - WEB RADIO COLLÈGE                ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  👉 C'EST ICI QUE VOUS MODIFIEZ LES PARAMÈTRES                     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

// ═══════════════════════════════════════════════════════════════════
// 📁 DÉPÔT GITHUB DES MÉDIAS (codé en dur)
// ═══════════════════════════════════════════════════════════════════
export const REPO = {
  owner:    'BEGY02300',
  repo:     'web-radio-coll-ge',
  branch:   '1',
  rootPath: 'medias',
};

// ═══════════════════════════════════════════════════════════════════
// 👑 ADMINISTRATEURS
// ═══════════════════════════════════════════════════════════════════
// 👉 Ajoutez ici les emails des admins (ils peuvent modérer TOUS les commentaires)
export const ADMIN_EMAILS = [
  'techsaga.fr@gmail.com',
  // 'autre-admin@exemple.fr',
];

// ═══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE — depuis .env (variables VITE_*)
// ═══════════════════════════════════════════════════════════════════
export const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// ═══════════════════════════════════════════════════════════════════
// 🗄️ SUPABASE — depuis .env
// ═══════════════════════════════════════════════════════════════════
export const SUPABASE_CONFIG = {
  url:     import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
};

// ═══════════════════════════════════════════════════════════════════
// 🎨 INFOS SITE
// ═══════════════════════════════════════════════════════════════════
export const SITE = {
  title:       'Web Radio Collège',
  subtitle:    'Podcasts & Reportages',
  description: 'Écoutez et téléchargez les podcasts et reportages de notre web radio.',
};

export const DEBUG_CONSOLE = import.meta.env.MODE !== 'production' || true;

export function isAdmin(email) {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

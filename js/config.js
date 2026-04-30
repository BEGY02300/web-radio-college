/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  CONFIGURATION DE L'APPLICATION — WEB RADIO COLLÈGE v6             ║
 * ║  + Système MULTI-DÉPÔTS GitHub (stripe) pour héberger 100 Go       ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  👉 C'EST ICI QUE VOUS MODIFIEZ LES PARAMÈTRES                     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  🧩 PRINCIPE DU "STRIPING" SUR PLUSIEURS DÉPÔTS GITHUB           │
 * ├─────────────────────────────────────────────────────────────────┤
 * │  GitHub limite chaque dépôt :                                    │
 * │     • 100 Mo / fichier   (HARD limit)                            │
 * │     • ~1 Go recommandé / dépôt   (limite molle)                  │
 * │     • 5 Go / dépôt   (limite dure avant blocage)                 │
 * │                                                                  │
 * │  ➜  Pour 100 Go on RÉPARTIT le contenu sur ~25 dépôts.           │
 * │      Chaque dépôt = un "shard" (tranche, comme un RAID-0).       │
 * │                                                                  │
 * │  L'application interroge en parallèle TOUS les dépôts de         │
 * │  chaque section, agrège les fichiers et les présente comme       │
 * │  une seule liste unifiée.                                        │
 * │                                                                  │
 * │  STRUCTURE DE CHAQUE DÉPÔT (identique) :                         │
 * │      medias/                                                     │
 * │       ├─ podcasts/                                               │
 * │       ├─ reportages/                                             │
 * │       └─ videos/                                                 │
 * │                                                                  │
 * │  Vous N'avez PAS besoin de remplir les 3 sous-dossiers dans      │
 * │  chaque dépôt — uniquement ceux dédiés au shard.                 │
 * └─────────────────────────────────────────────────────────────────┘
 */

// ═══════════════════════════════════════════════════════════════════
// 📁 DÉPÔT GITHUB PRINCIPAL (rétro-compatibilité)
// ═══════════════════════════════════════════════════════════════════
export const REPO = {
  owner:    'BEGY02300',
  repo:     'web-radio-coll-ge',
  branch:   '1',
  rootPath: 'medias',
};

// ═══════════════════════════════════════════════════════════════════
// 🧱 POOL DE DÉPÔTS — STRIPING (jusqu'à 100 Go cumulés)
// ═══════════════════════════════════════════════════════════════════
//
//   👉 Ajoutez UNE ligne par dépôt GitHub utilisé pour héberger
//      des médias. Tous les dépôts doivent être PUBLICS et avoir
//      la même structure : medias/podcasts, medias/reportages, medias/videos.
//
//   Conseil de dimensionnement :
//      • ~4 Go max par dépôt (marge sous la limite 5 Go)
//      • 25 dépôts × 4 Go ≈ 100 Go
//
//   Vous pouvez DÉDIER un dépôt à une section pour mieux organiser :
//      sections: ['podcasts']  → ce dépôt n'est lu que pour la
//      section "podcasts" (gain de requêtes API GitHub).
//      Omettez ou laissez vide pour interroger les 3 sections.
//
export const REPO_POOL = [
  // Dépôt 1 — historique principal (toutes sections)
  { owner: 'BEGY02300', repo: 'web-radio-coll-ge',  branch: '1',    rootPath: 'medias', label: 'Pool 01', sections: [] },

  // ─── Pool podcasts ───
  // { owner: 'BEGY02300', repo: 'wrc-podcasts-01', branch: 'main', rootPath: 'medias', label: 'Podcasts 01', sections: ['podcasts'] },
  // { owner: 'BEGY02300', repo: 'wrc-podcasts-02', branch: 'main', rootPath: 'medias', label: 'Podcasts 02', sections: ['podcasts'] },
  // { owner: 'BEGY02300', repo: 'wrc-podcasts-03', branch: 'main', rootPath: 'medias', label: 'Podcasts 03', sections: ['podcasts'] },

  // ─── Pool reportages (vidéos lourdes) ───
  // { owner: 'BEGY02300', repo: 'wrc-reportages-01', branch: 'main', rootPath: 'medias', label: 'Reportages 01', sections: ['reportages'] },
  // { owner: 'BEGY02300', repo: 'wrc-reportages-02', branch: 'main', rootPath: 'medias', label: 'Reportages 02', sections: ['reportages'] },
  // { owner: 'BEGY02300', repo: 'wrc-reportages-03', branch: 'main', rootPath: 'medias', label: 'Reportages 03', sections: ['reportages'] },

  // ─── Pool vidéos / shorts (liens YouTube, peu de poids) ───
  // { owner: 'BEGY02300', repo: 'wrc-videos-01', branch: 'main', rootPath: 'medias', label: 'Vidéos 01', sections: ['videos'] },
];

// Helper : retourne tous les dépôts qui peuvent contenir une section donnée
export function reposForSection(sectionId) {
  if (!REPO_POOL.length) return [REPO];
  return REPO_POOL.filter((r) => !r.sections || r.sections.length === 0 || r.sections.includes(sectionId));
}

// ═══════════════════════════════════════════════════════════════════
// 🗂️ SCHÉMA DES 3 SECTIONS PRINCIPALES (FIXE)
// ═══════════════════════════════════════════════════════════════════
export const SECTIONS = [
  {
    id: 'podcasts',
    folder: 'podcasts',
    label: 'Podcasts',
    subtitle: 'Audio à écouter',
    icon: 'fa-microphone-lines',
    gradient: 'gradient-podcasts',
    accept: ['audio'],
    color: 'emerald',
  },
  {
    id: 'reportages',
    folder: 'reportages',
    label: 'Reportages',
    subtitle: 'Vidéos hébergées',
    icon: 'fa-film',
    gradient: 'gradient-reportages',
    accept: ['video'],
    color: 'rose',
  },
  {
    id: 'videos',
    folder: 'videos',
    label: 'Vidéos',
    subtitle: 'YouTube non répertoriées',
    icon: 'fa-play',
    gradient: 'gradient-videos',
    accept: ['youtube', 'video'],
    color: 'violet',
  },
];

// ═══════════════════════════════════════════════════════════════════
// 👑 ADMINISTRATEURS
// ═══════════════════════════════════════════════════════════════════
export const ADMIN_EMAILS = [
  'techsaga.fr@gmail.com',
];

export const ADMIN_PHONES = [
  // '+33612345678',
];

// ═══════════════════════════════════════════════════════════════════
// 📢 GOOGLE ADSENSE
// ═══════════════════════════════════════════════════════════════════
export const ADSENSE = {
  enabled:   true,
  client:    'ca-pub-6205152848310463',
  // Slots à créer dans la console AdSense → "Annonces > Par unité d'annonce".
  // Tant qu'ils valent null, l'app affiche des emplacements "réservés".
  slots: {
    header:   null,   // bannière sous le hero
    inFeed:   null,   // entre les sections
    sidebar:  null,   // (futur) colonne latérale
    footer:   null,   // bannière au-dessus du footer
  },
};

// ═══════════════════════════════════════════════════════════════════
// 🔥 FIREBASE
// ═══════════════════════════════════════════════════════════════════
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
// 🗄️ SUPABASE
// ═══════════════════════════════════════════════════════════════════
export const SUPABASE_CONFIG = {
  url:     ENV.SUPABASE_URL      || 'REMPLACEZ_PAR_VOTRE_URL_SUPABASE',
  anonKey: ENV.SUPABASE_ANON_KEY || 'REMPLACEZ_PAR_VOTRE_CLE_ANON',
  avatarBucket: 'avatars',
};

// ═══════════════════════════════════════════════════════════════════
// 🎨 INFOS SITE
// ═══════════════════════════════════════════════════════════════════
export const SITE = {
  title:       'Web Radio Collège',
  subtitle:    'Podcasts, reportages & vidéos',
  description: 'Votre radio collégienne. Podcasts, reportages et vidéos en un seul endroit.',
  tagline:     'L\'actu du collège, racontée par les élèves.',
};

// ═══════════════════════════════════════════════════════════════════
// 🐞 DEBUG
// ═══════════════════════════════════════════════════════════════════
export const DEBUG_CONSOLE = true;

// Helper admin
export function isAdmin(email, phone) {
  if (email && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(email).toLowerCase())) return true;
  if (phone && ADMIN_PHONES.includes(String(phone).trim())) return true;
  return false;
}

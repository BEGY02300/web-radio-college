/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  MODÉRATION : anti-insultes, anti-phishing, anti-spam, sanitize    ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Toutes les fonctions sont synchrones, sans dépendance réseau.     ║
 * ║  Utilisable côté client AVANT envoi à Supabase.                    ║
 * ║                                                                    ║
 * ║  ⚠️ Cette modération est une PREMIÈRE BARRIÈRE. Le panneau admin   ║
 * ║     reste indispensable pour gérer les cas complexes.              ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { logger } from './logger.js';

// ═══════════════════════════════════════════════════════════════════
// 🛡️ 1. ANTI-INSULTES (FR + variantes obfusquées)
// ═══════════════════════════════════════════════════════════════════
//
// 👉 POUR AJOUTER UN MOT INTERDIT : ajoutez-le simplement dans BAD_WORDS
//    en minuscules. La détection gère automatiquement :
//      - majuscules / minuscules
//      - accents (é, è, ê → e)
//      - séparateurs (m.e.r.d.e, m e r d e, m_e_r_d_e, m-e-r-d-e)
//      - leet speak basique (3=e, 1=i/l, 0=o, 4=a, 5=s, 7=t, 8=b, @=a, $=s)
//      - répétitions (mmmerde, merrrde, merdeeee)
//
const BAD_WORDS = [
  // — insultes courantes FR
  'merde','merdique','con','conne','connard','connasse','connard','conard',
  'pute','putain','putes','enculé','encule','enculer','enculee','enculée',
  'salope','salopard','batard','bâtard','batards','bâtards',
  'fdp','fils de pute','fils de p','filsdepute','filsdep',
  'ntm','nique ta mere','nique ta mère','niquetamere','niquetamère',
  'ntn','nique ton','niquer','niques','nique',
  'pd','pédé','pede','pedo','pédophile','pedophile','pédocriminel',
  'tarlouze','tapette','tafiole','tafiolle',
  'bite','biteux','couille','couilles','cul','culs','chatte',
  'gland','glandu','glandeur','queutard','queutarde',
  'bouffon','bouffonne','tg','ta gueule','tagueule','ferme ta gueule',
  'cassos','cas social','cassoss','clochard','clocharde',
  'crasseux','crasseuse','crevard','crevarde',
  'pisse','pisseuse','pisseux','chier','chié','chiée',
  'racaille','rebeu','feuj','negro','négro','nègre','negre',
  'youpin','bougnoul','bougnoule','chinetoque','niakoué','niakoue',
  'pédale','pedale','goudou','gouine','transpute',
  // — anglais
  'fuck','fucking','fucker','motherfucker','mf','wtf','stfu',
  'bitch','asshole','bastard','dickhead','cunt','slut','whore',
  'nigger','nigga','retard','retarded','faggot','fag',
  // — variantes leet déjà fixes
  'fuk','fck','f4ck','sh1t','shit','b1tch','b!tch','a$$',
];

// Liste blanche pour éviter les faux positifs (mots contenant un sous-mot interdit)
const SAFE_PHRASES = [
  'concombre','concept','concert','content','contenir','contact','context',
  'contenu','contre','conseil','console','consoler','constitution',
  'constant','condamn','conduire','conduit','confiance','conformer',
  'congénital','congelé','constipé','consigne','consultant','conversation',
  'conviction','convoi','controle','convive','convoquer','contour',
  'connect','connait','connection','connaître','connaissance',
  'condom','condition',
  'putamine','putschiste',
  'salopette',  // /!\ contient 'salope'
  'bourgeois','douce','douche','souche',
  'pedagog','pédagog','pédiatre','pediatre','pedicure','pédicure',
];

// Map de normalisation leet
const LEET_MAP = {
  '0':'o','1':'i','2':'z','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','9':'g',
  '@':'a','$':'s','€':'e','£':'l','!':'i','|':'i','¡':'i',
  'à':'a','á':'a','â':'a','ä':'a','ã':'a','å':'a','ą':'a',
  'ç':'c','č':'c',
  'è':'e','é':'e','ê':'e','ë':'e','ę':'e',
  'ì':'i','í':'i','î':'i','ï':'i',
  'ñ':'n',
  'ò':'o','ó':'o','ô':'o','ö':'o','õ':'o','ø':'o',
  'ù':'u','ú':'u','û':'u','ü':'u',
  'ý':'y','ÿ':'y',
  'ß':'s',
};

/**
 * Normalise un texte pour la détection d'insultes :
 *  - minuscule
 *  - retire accents/leet
 *  - retire séparateurs (espaces, points, tirets, _, etc.) entre lettres
 *  - écrase les répétitions (aaa → a)
 */
export function normalizeForBadWords(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();
  // Remplacement leet/accents
  s = s.split('').map((c) => LEET_MAP[c] || c).join('');
  // Retire les caractères non alphabétiques (zéro-width, séparateurs, ponctuation, espaces)
  s = s.replace(/[^a-z]/g, '');
  // Écrase les répétitions de 3+ caractères identiques (aaa → a)
  s = s.replace(/(.)\1{2,}/g, '$1');
  return s;
}

/**
 * Détecte la présence d'au moins un mot interdit dans le texte.
 * @returns {{ ok: boolean, found: string[] }}
 */
export function checkBadWords(text) {
  const original = String(text || '').toLowerCase();
  const normalized = normalizeForBadWords(text);
  const found = [];

  for (const w of BAD_WORDS) {
    const nw = normalizeForBadWords(w);
    if (!nw) continue;
    // Match dans le texte normalisé
    if (normalized.includes(nw)) {
      // Vérifier si ce match correspond à un mot "safe" (faux positif)
      const safe = SAFE_PHRASES.some((sp) => {
        const nsp = normalizeForBadWords(sp);
        return nsp.includes(nw) && original.includes(sp);
      });
      if (!safe) found.push(w);
    }
  }
  return { ok: found.length === 0, found: [...new Set(found)] };
}

// ═══════════════════════════════════════════════════════════════════
// 🔗 2. ANTI-PHISHING / LIENS DANGEREUX
// ═══════════════════════════════════════════════════════════════════
const SAFE_DOMAINS = [
  'youtube.com','youtu.be','youtube-nocookie.com',
  'github.com','githubusercontent.com',
  'firebaseapp.com','google.com','google.fr',
  'wikipedia.org','wikimedia.org',
  'soundcloud.com','spotify.com',
  'vimeo.com',
  'genspark.ai','netlify.app','vercel.app','cloudflare.com',
  'supabase.co','supabase.in',
  'googleusercontent.com','gstatic.com',
];

// Domaines explicitement interdits (raccourcisseurs, hébergeurs scam, etc.)
const BLOCKED_DOMAINS = [
  'bit.ly','tinyurl.com','goo.gl','t.co','rb.gy','rebrand.ly','cutt.ly',
  'is.gd','ow.ly','buff.ly','adf.ly','shorte.st',
  // Discord scams récurrents
  'dlscord.com','dlscord.gift','dliscord.com',
  // Steam/Roblox phishing classiques
  'steamcommunlty.com','steamcommumity.com','rolblox.com','robux-free',
  // Crypto scams
  'metamask-login','metamask.help','phantom-wallet','airdrop',
];

export function isSafeUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:','https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (BLOCKED_DOMAINS.some((d) => host === d || host.endsWith('.' + d))) return false;
    return SAFE_DOMAINS.some((d) => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

/**
 * Détecte les liens du texte et retourne ceux qui sont suspects.
 */
export function checkSuspiciousLinks(text) {
  const urls = String(text || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  const suspicious = urls.filter((u) => !isSafeUrl(u));
  return { ok: suspicious.length === 0, suspicious };
}

// ═══════════════════════════════════════════════════════════════════
// 🤖 3. RATE LIMITING (anti-bot, anti-spam)
// ═══════════════════════════════════════════════════════════════════
const lastPostByUser = new Map(); // uid -> timestamp dernier post
const recentPostsByUser = new Map(); // uid -> [timestamps]

const MIN_DELAY_MS = 5000;        // 5s minimum entre 2 posts
const MAX_PER_MINUTE = 5;         // 5 commentaires / minute max

export function checkRateLimit(userId) {
  if (!userId) return { ok: false, reason: 'Utilisateur non identifié' };
  const now = Date.now();

  // Délai minimum
  const last = lastPostByUser.get(userId) || 0;
  const delta = now - last;
  if (delta < MIN_DELAY_MS) {
    const wait = Math.ceil((MIN_DELAY_MS - delta) / 1000);
    return { ok: false, reason: `Patientez ${wait}s avant de re-poster.` };
  }

  // Burst limit (60s glissantes)
  const arr = (recentPostsByUser.get(userId) || []).filter((t) => now - t < 60000);
  if (arr.length >= MAX_PER_MINUTE) {
    return { ok: false, reason: `Limite atteinte (${MAX_PER_MINUTE} messages/min).` };
  }

  // OK : enregistre
  arr.push(now);
  lastPostByUser.set(userId, now);
  recentPostsByUser.set(userId, arr);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// 🔥 4. SANITIZE (anti-XSS) — sans HTML, on échappe tout
// ═══════════════════════════════════════════════════════════════════
/**
 * Nettoie un texte utilisateur : retire tout HTML, normalise sauts de ligne,
 * supprime caractères de contrôle, limite la longueur.
 */
export function sanitizeText(text, maxLen = 2000) {
  if (text == null) return '';
  let s = String(text);
  // Retirer caractères de contrôle (sauf \n et \t)
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Échapper HTML (sécurité défense en profondeur — React échappe déjà)
  s = s.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');
  // Normaliser espaces / sauts de ligne
  s = s.replace(/\r\n?/g, '\n');
  // Couper espaces de bord
  s = s.trim();
  // Limiter longueur
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

// ═══════════════════════════════════════════════════════════════════
// 🖼️ 5. IMAGES AUTORISÉES
// ═══════════════════════════════════════════════════════════════════
export function isAllowedImageUrl(url) {
  if (!url) return false;
  if (!isSafeUrl(url)) return false;
  return /\.(png|jpg|jpeg|gif|webp|avif)(\?.*)?$/i.test(url);
}

// ═══════════════════════════════════════════════════════════════════
// 🛂 6. VALIDATION COMPLÈTE D'UN COMMENTAIRE
// ═══════════════════════════════════════════════════════════════════
export const COMMENT_MAX_LEN = 500;

/**
 * Pipeline complet : sanitize + bad words + liens + rate limit.
 * Retourne { ok, error, value } où value = texte sanitizé prêt pour la BDD.
 */
export function validateComment({ text, userId }) {
  const value = sanitizeText(text, COMMENT_MAX_LEN);
  if (!value) return { ok: false, error: 'Le commentaire est vide.' };
  if (value.length > COMMENT_MAX_LEN) {
    return { ok: false, error: `Maximum ${COMMENT_MAX_LEN} caractères.` };
  }

  const bw = checkBadWords(value);
  if (!bw.ok) {
    logger.warn('🛡️ Commentaire refusé (insultes)', { found: bw.found });
    return { ok: false, error: `Langage inapproprié détecté. Reformulez votre message.`, found: bw.found };
  }

  const links = checkSuspiciousLinks(value);
  if (!links.ok) {
    logger.warn('🔗 Lien suspect refusé', { suspicious: links.suspicious });
    return { ok: false, error: `Lien suspect bloqué : ${links.suspicious[0]}` };
  }

  const rl = checkRateLimit(userId);
  if (!rl.ok) return { ok: false, error: rl.reason };

  return { ok: true, value };
}

// ═══════════════════════════════════════════════════════════════════
// 👤 7. VALIDATION PSEUDO + BIO (profil)
// ═══════════════════════════════════════════════════════════════════
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
export const BIO_MAX_LEN = 200;

const RESERVED_NAMES = [
  'admin','administrator','administrateur','root','moderator','moderateur',
  'modo','mod','staff','support','help','contact','official','officiel',
  'firebase','google','apple','github','yahoo','techsaga',
  'system','null','undefined','anonymous','anon','user','test',
];

export function validateUsername(name) {
  const v = String(name || '').trim();
  if (!v) return { ok: false, error: 'Pseudo requis.' };
  if (v.length < USERNAME_MIN) return { ok: false, error: `Au moins ${USERNAME_MIN} caractères.` };
  if (v.length > USERNAME_MAX) return { ok: false, error: `Maximum ${USERNAME_MAX} caractères.` };
  if (!USERNAME_REGEX.test(v)) {
    return { ok: false, error: 'Seuls lettres, chiffres, point, tiret et underscore sont autorisés.' };
  }
  if (RESERVED_NAMES.includes(v.toLowerCase())) {
    return { ok: false, error: 'Pseudo réservé, choisissez-en un autre.' };
  }
  const bw = checkBadWords(v);
  if (!bw.ok) return { ok: false, error: 'Pseudo contient un terme interdit.' };
  return { ok: true, value: v };
}

export function validateBio(text) {
  const value = sanitizeText(text, BIO_MAX_LEN);
  if (value.length > BIO_MAX_LEN) {
    return { ok: false, error: `Bio trop longue (${BIO_MAX_LEN} max).` };
  }
  const bw = checkBadWords(value);
  if (!bw.ok) return { ok: false, error: 'Bio contient un terme interdit.' };
  const links = checkSuspiciousLinks(value);
  if (!links.ok) return { ok: false, error: 'Bio contient un lien suspect.' };
  // Bloquer numéros de tel dans la bio
  if (/(\+\d{1,3}[\s.-]?)?(\d[\s.-]?){9,}/.test(value)) {
    return { ok: false, error: 'Pas de numéro de téléphone dans la bio.' };
  }
  return { ok: true, value };
}

// Helpers pour debug
export const __moderationDebug = {
  BAD_WORDS, SAFE_PHRASES, SAFE_DOMAINS, BLOCKED_DOMAINS,
  normalizeForBadWords, checkBadWords, checkSuspiciousLinks,
  validateComment, validateUsername, validateBio,
};
if (typeof window !== 'undefined') window.__moderation = __moderationDebug;

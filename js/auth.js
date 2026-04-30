/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  AUTHENTIFICATION MULTI-PROVIDERS — WEB RADIO COLLÈGE              ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Méthodes activées (5) :                                           ║
 * ║   📧 Email + mot de passe   (avec login par pseudo aussi)          ║
 * ║   🔵 Google                                                        ║
 * ║   📱 Téléphone (SMS / OTP)                                         ║
 * ║   🐙 GitHub                                                        ║
 * ║   🟣 Yahoo                                                         ║
 * ║                                                                    ║
 * ║  Apple/Game Center supprimé sur demande utilisateur.               ║
 * ║                                                                    ║
 * ║  Fonctions de LIAISON (utilisateur déjà connecté) :                ║
 * ║   - linkGoogle / linkGitHub / linkYahoo / linkPhone / linkEmail    ║
 * ║   - unlinkProvider(providerId)                                     ║
 * ║                                                                    ║
 * ║  Reset mot de passe : par email OU par pseudo (lookup Supabase).   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { logger } from './logger.js';
import { FIREBASE_CONFIG, isAdmin } from './config.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signOut, onAuthStateChanged, updateProfile,
  // Email
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail,
  // OAuth
  GoogleAuthProvider, OAuthProvider, GithubAuthProvider,
  signInWithPopup, linkWithPopup, linkWithPhoneNumber, linkWithCredential,
  EmailAuthProvider, unlink,
  // Phone
  RecaptchaVerifier, signInWithPhoneNumber,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

let firebaseApp = null;
let firebaseAuth = null;
let recaptchaVerifier = null;
let initialized = false;
let initError = null;

function init() {
  if (initialized) return;
  try {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.startsWith('REMPLACEZ')) {
      throw new Error('Configuration Firebase manquante — remplissez env.js (ou .env)');
    }
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(firebaseApp);
    firebaseAuth.languageCode = 'fr';
    initialized = true;
    logger.auth('🔥 Firebase initialisé', { projectId: FIREBASE_CONFIG.projectId });
  } catch (err) {
    initError = err;
    logger.error('Échec initialisation Firebase', { message: err.message });
  }
}

function ensureInit() {
  if (!initialized && !initError) init();
  if (initError) throw initError;
}

export function isAuthReady() { return initialized; }
export function getInitError() { return initError; }
export function getCurrentUser() { return initialized ? firebaseAuth.currentUser : null; }
export function getFirebaseAuth() { ensureInit(); return firebaseAuth; }

// ═══════════════════════════════════════════════════════════════════
// 📧 EMAIL + MOT DE PASSE (login par email OU pseudo)
// ═══════════════════════════════════════════════════════════════════

/**
 * Connexion par email/pseudo + mot de passe.
 * Si emailOrUsername ne contient pas de "@", on cherche d'abord
 * dans les profils Supabase pour récupérer l'email associé.
 */
export async function loginWithEmailOrUsername(emailOrUsername, password) {
  ensureInit();
  let email = String(emailOrUsername || '').trim();
  if (!email.includes('@')) {
    logger.auth(`🔍 Pseudo détecté, lookup email pour "${email}"`);
    // Import paresseux pour éviter dépendance circulaire
    const { getProfileByUsername } = await import('./profile.js');
    const profile = await getProfileByUsername(email);
    if (!profile || !profile.email) {
      const err = new Error('Aucun compte trouvé pour ce pseudo');
      err.code = 'auth/user-not-found';
      throw err;
    }
    email = profile.email;
    logger.auth(`✓ Email trouvé pour pseudo : ${email.replace(/(.{2}).*(@.*)/, '$1•••$2')}`);
  }
  logger.auth(`📧 Connexion : ${email}`);
  try {
    const r = await signInWithEmailAndPassword(firebaseAuth, email, password);
    logger.success('✓ Connexion email réussie', { email: r.user.email });
    return r.user;
  } catch (err) {
    logger.error('Échec connexion email', { code: err.code });
    throw err;
  }
}
// Alias rétro-compatible
export const loginWithEmail = loginWithEmailOrUsername;

export async function registerWithEmail(email, password, displayName) {
  ensureInit();
  logger.auth(`📧 Inscription email : ${email}`);
  try {
    const r = await createUserWithEmailAndPassword(firebaseAuth, email, password);
    if (displayName) {
      try { await updateProfile(r.user, { displayName }); } catch (e) {}
    }
    logger.success('✓ Compte créé', { email: r.user.email });
    return r.user;
  } catch (err) {
    logger.error('Échec inscription', { code: err.code });
    throw err;
  }
}

/** Reset par email direct OU par pseudo (lookup Supabase). */
export async function resetPassword(emailOrUsername) {
  ensureInit();
  let email = String(emailOrUsername || '').trim();
  if (!email.includes('@')) {
    const { getProfileByUsername } = await import('./profile.js');
    const profile = await getProfileByUsername(email);
    if (!profile || !profile.email) {
      const err = new Error('Aucun compte trouvé');
      err.code = 'auth/user-not-found';
      throw err;
    }
    email = profile.email;
  }
  logger.auth(`📧 Reset mot de passe : ${email}`);
  await sendPasswordResetEmail(firebaseAuth, email);
  logger.success('✓ Email de réinitialisation envoyé');
}

// ═══════════════════════════════════════════════════════════════════
// 🌐 OAUTH GÉNÉRIQUE (Google, GitHub, Yahoo)
// ═══════════════════════════════════════════════════════════════════

function buildProvider(kind) {
  if (kind === 'google') {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  }
  if (kind === 'github') {
    const p = new GithubAuthProvider();
    p.addScope('read:user'); p.addScope('user:email');
    return p;
  }
  if (kind === 'yahoo') {
    const p = new OAuthProvider('yahoo.com');
    p.addScope('profile'); p.addScope('email');
    return p;
  }
  throw new Error('Provider inconnu : ' + kind);
}

async function popupOAuth(kind, label) {
  ensureInit();
  logger.auth(`${label} : ouverture du popup…`);
  try {
    const provider = buildProvider(kind);
    const r = await signInWithPopup(firebaseAuth, provider);
    logger.success(`✓ Connexion ${label} réussie`, {
      uid: r.user.uid, email: r.user.email, providerId: r.providerId,
    });
    return r.user;
  } catch (err) {
    logger.error(`Échec ${label}`, { code: err.code, message: err.message });
    throw err;
  }
}

export const loginWithGoogle = () => popupOAuth('google', '🔵 Google');
export const loginWithGitHub = () => popupOAuth('github', '🐙 GitHub');
export const loginWithYahoo  = () => popupOAuth('yahoo',  '🟣 Yahoo');

// ═══════════════════════════════════════════════════════════════════
// 🔗 LIAISON DE PROVIDERS (compte déjà connecté)
// ═══════════════════════════════════════════════════════════════════

export async function linkProvider(kind) {
  ensureInit();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Connexion requise');
  const labels = { google: '🔵 Google', github: '🐙 GitHub', yahoo: '🟣 Yahoo' };
  logger.auth(`🔗 Liaison ${labels[kind] || kind}…`);
  const provider = buildProvider(kind);
  const r = await linkWithPopup(user, provider);
  logger.success(`✓ ${labels[kind]} lié au compte`, { uid: r.user.uid });
  return r.user;
}

export async function linkEmailPassword(email, password) {
  ensureInit();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Connexion requise');
  const cred = EmailAuthProvider.credential(email, password);
  const r = await linkWithCredential(user, cred);
  logger.success('✓ Email/mot de passe lié au compte', { email });
  return r.user;
}

/**
 * Lier un téléphone au compte courant. Retourne un ConfirmationResult
 * dont .confirm(code) terminera la liaison.
 */
export async function linkPhoneStart(phone, recaptchaContainerId = 'recaptcha-container') {
  ensureInit();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Connexion requise');
  const e164 = normalizePhone(phone);
  const verifier = getRecaptcha(recaptchaContainerId);
  logger.auth(`📱 Liaison téléphone : ${e164}`);
  return linkWithPhoneNumber(user, e164, verifier);
}

export async function unlinkProvider(providerId) {
  ensureInit();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Connexion requise');
  if ((user.providerData || []).length <= 1) {
    throw new Error('Impossible de retirer la dernière méthode de connexion.');
  }
  await unlink(user, providerId);
  logger.success(`✓ Provider retiré : ${providerId}`);
}

// ═══════════════════════════════════════════════════════════════════
// 📱 TÉLÉPHONE (SMS / OTP) — version corrigée
// ═══════════════════════════════════════════════════════════════════

/**
 * (Re)crée le verifier reCAPTCHA invisible. On le détruit à chaque tentative
 * pour éviter les états bloqués entre 2 envois.
 */
function getRecaptcha(containerId) {
  ensureInit();
  // Toujours nettoyer l'ancien
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (e) {}
    recaptchaVerifier = null;
  }
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Élément #${containerId} introuvable pour le reCAPTCHA`);
  // Vider le contenu existant (Firebase rajoute un iframe à chaque init)
  el.innerHTML = '';
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, el, {
    size: 'invisible',
    callback: () => logger.auth('✔️ reCAPTCHA validé'),
    'expired-callback': () => logger.warn('reCAPTCHA expiré — nouvel essai nécessaire'),
  });
  logger.auth('reCAPTCHA invisible prêt');
  return recaptchaVerifier;
}

export function normalizePhone(raw, defaultCountry = '+33') {
  if (!raw) return '';
  let p = String(raw).trim().replace(/[\s().-]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0')) return defaultCountry + p.slice(1);
  return defaultCountry + p;
}

export async function sendSmsCode(phone, recaptchaContainerId = 'recaptcha-container') {
  ensureInit();
  const e164 = normalizePhone(phone);
  logger.auth(`📱 Envoi SMS vers ${e164}`);
  try {
    const verifier = getRecaptcha(recaptchaContainerId);
    // Render avant l'envoi (force la résolution du widget)
    await verifier.render();
    const confirmation = await signInWithPhoneNumber(firebaseAuth, e164, verifier);
    logger.success('✉️ SMS envoyé');
    return confirmation;
  } catch (err) {
    logger.error('Échec envoi SMS', { code: err.code, message: err.message });
    try { recaptchaVerifier?.clear(); } catch (e) {}
    recaptchaVerifier = null;
    throw err;
  }
}

export async function verifySmsCode(confirmation, code, displayName) {
  ensureInit();
  logger.auth('🔐 Vérification du code SMS…');
  try {
    const r = await confirmation.confirm(code);
    if (displayName && !r.user.displayName) {
      try { await updateProfile(r.user, { displayName }); } catch (e) {}
    }
    logger.success('✅ Connexion téléphone réussie', { phone: r.user.phoneNumber });
    return r.user;
  } catch (err) {
    logger.error('Code SMS invalide', { code: err.code });
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 🚪 DÉCONNEXION + OBSERVER
// ═══════════════════════════════════════════════════════════════════
export async function logout() {
  ensureInit();
  const who = firebaseAuth.currentUser?.email || firebaseAuth.currentUser?.phoneNumber;
  await signOut(firebaseAuth);
  logger.auth('👋 Déconnexion', { who });
}

export function onAuthChanged(callback) {
  ensureInit();
  return onAuthStateChanged(firebaseAuth, (user) => {
    if (user) {
      const admin = isAdmin(user.email, user.phoneNumber);
      logger.auth(`État auth : connecté (${user.email || user.phoneNumber}) ${admin ? '👑 ADMIN' : ''}`);
    } else {
      logger.auth('État auth : déconnecté');
    }
    callback(user);
  });
}

// ═══════════════════════════════════════════════════════════════════
// 🔄 Met à jour displayName et photoURL Firebase
// ═══════════════════════════════════════════════════════════════════
export async function updateUserProfile({ displayName, photoURL }) {
  ensureInit();
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Connexion requise');
  const fields = {};
  if (displayName !== undefined) fields.displayName = displayName;
  if (photoURL !== undefined) fields.photoURL = photoURL;
  await updateProfile(user, fields);
  logger.success('✓ Profil Firebase mis à jour', fields);
}

// ═══════════════════════════════════════════════════════════════════
// TRADUCTION DES ERREURS
// ═══════════════════════════════════════════════════════════════════
export function translateError(code) {
  const map = {
    // Email
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-disabled': 'Compte désactivé.',
    'auth/user-not-found': 'Aucun compte associé à cet email/pseudo.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email/pseudo ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password': 'Mot de passe trop faible (6 caractères min).',
    // Popup OAuth
    'auth/popup-closed-by-user': 'Fenêtre fermée avant la connexion.',
    'auth/popup-blocked': 'Popup bloquée. Autorisez les popups pour ce site.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
    'auth/account-exists-with-different-credential': 'Un compte existe déjà avec une autre méthode pour cet email. Connectez-vous avec la méthode initiale puis liez celle-ci dans votre profil.',
    'auth/credential-already-in-use': 'Ce compte est déjà lié à un autre utilisateur.',
    'auth/operation-not-allowed': 'Méthode désactivée dans Firebase Console (Authentication → Sign-in method).',
    'auth/unauthorized-domain': 'Ce domaine n\'est pas autorisé. Ajoutez-le dans Firebase → Authentication → Settings → Authorized domains.',
    'auth/provider-already-linked': 'Cette méthode est déjà liée à votre compte.',
    'auth/no-such-provider': 'Méthode non liée à votre compte.',
    // Phone
    'auth/invalid-phone-number': 'Numéro invalide. Format attendu : +33612345678',
    'auth/missing-phone-number': 'Veuillez saisir un numéro.',
    'auth/quota-exceeded': 'Quota SMS dépassé pour aujourd\'hui.',
    'auth/invalid-verification-code': 'Code SMS incorrect.',
    'auth/code-expired': 'Code expiré, redemandez un SMS.',
    'auth/captcha-check-failed': 'Vérification reCAPTCHA échouée. Rechargez la page.',
    'auth/missing-verification-code': 'Saisissez le code reçu par SMS.',
    'auth/missing-verification-id': 'Demandez d\'abord l\'envoi du SMS.',
    'auth/invalid-app-credential': 'Erreur reCAPTCHA — domaine non autorisé dans Firebase.',
    'auth/billing-not-enabled': 'Facturation Firebase désactivée — activez Blaze pour les SMS.',
    // Réseau
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
  };
  return map[code] || 'Une erreur est survenue. Réessayez.';
}

export { isAdmin };

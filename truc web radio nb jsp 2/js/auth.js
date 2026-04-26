/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  AUTHENTIFICATION MULTI-PROVIDERS — WEB RADIO COLLÈGE              ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Méthodes activées :                                               ║
 * ║   📧 Email + mot de passe                                          ║
 * ║   🔵 Google (popup)                                                ║
 * ║   🍎 Apple ID (= Game Center pour les comptes iOS)                 ║
 * ║   📱 Téléphone (SMS / OTP)                                         ║
 * ║   🐙 GitHub                                                        ║
 * ║   🟣 Yahoo                                                         ║
 * ║                                                                    ║
 * ║  Tous les fournisseurs OAuth utilisent signInWithPopup.            ║
 * ║                                                                    ║
 * ║  Prérequis Firebase Console (à activer dans Authentication →       ║
 * ║  Sign-in method) :                                                 ║
 * ║   - Email/Password                                                 ║
 * ║   - Google (cocher "support email")                                ║
 * ║   - Apple (créer Service ID + clé p8 — voir README)                ║
 * ║   - Phone (+ ajouter numéros de test si besoin)                    ║
 * ║   - GitHub (créer OAuth App sur github.com/settings/developers)   ║
 * ║   - Yahoo (créer OAuth app sur developer.yahoo.com)                ║
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
  signInWithPopup,
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

// ═══════════════════════════════════════════════════════════════════
// 📧 EMAIL + MOT DE PASSE
// ═══════════════════════════════════════════════════════════════════
export async function loginWithEmail(email, password) {
  ensureInit();
  logger.auth(`📧 Connexion email : ${email}`);
  try {
    const r = await signInWithEmailAndPassword(firebaseAuth, email, password);
    logger.success('✓ Connexion email réussie', { email: r.user.email });
    return r.user;
  } catch (err) {
    logger.error('Échec connexion email', { code: err.code });
    throw err;
  }
}

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

export async function resetPassword(email) {
  ensureInit();
  logger.auth(`📧 Reset mot de passe : ${email}`);
  await sendPasswordResetEmail(firebaseAuth, email);
  logger.success('✓ Email de réinitialisation envoyé');
}

// ═══════════════════════════════════════════════════════════════════
// 🌐 OAUTH GÉNÉRIQUE (Google, Apple, GitHub, Yahoo)
// ═══════════════════════════════════════════════════════════════════
async function popupOAuth(provider, label) {
  ensureInit();
  logger.auth(`${label} : ouverture du popup…`);
  try {
    const r = await signInWithPopup(firebaseAuth, provider);
    logger.success(`✓ Connexion ${label} réussie`, {
      uid: r.user.uid,
      email: r.user.email,
      provider: r.providerId,
    });
    return r.user;
  } catch (err) {
    logger.error(`Échec ${label}`, { code: err.code, message: err.message });
    throw err;
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return popupOAuth(provider, '🔵 Google');
}

export async function loginWithApple() {
  // Apple Sign-In = la méthode utilisée pour les comptes Game Center sur le web
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  provider.setCustomParameters({ locale: 'fr_FR' });
  return popupOAuth(provider, '🍎 Apple');
}

export async function loginWithGitHub() {
  const provider = new GithubAuthProvider();
  provider.addScope('read:user');
  provider.addScope('user:email');
  return popupOAuth(provider, '🐙 GitHub');
}

export async function loginWithYahoo() {
  const provider = new OAuthProvider('yahoo.com');
  provider.addScope('profile');
  provider.addScope('email');
  return popupOAuth(provider, '🟣 Yahoo');
}

// ═══════════════════════════════════════════════════════════════════
// 📱 TÉLÉPHONE (SMS / OTP)
// ═══════════════════════════════════════════════════════════════════
function getRecaptcha(containerId) {
  ensureInit();
  if (recaptchaVerifier) return recaptchaVerifier;
  const el = document.getElementById(containerId);
  if (!el) throw new Error(`Élément #${containerId} introuvable pour le reCAPTCHA`);
  recaptchaVerifier = new RecaptchaVerifier(firebaseAuth, el, {
    size: 'invisible',
    callback: () => logger.auth('✔️ reCAPTCHA validé'),
    'expired-callback': () => logger.warn('reCAPTCHA expiré — nouvel essai nécessaire'),
  });
  logger.auth('reCAPTCHA invisible initialisé');
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
    const confirmation = await signInWithPhoneNumber(firebaseAuth, e164, verifier);
    logger.success('✉️ SMS envoyé');
    return confirmation;
  } catch (err) {
    logger.error('Échec envoi SMS', { code: err.code });
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
// TRADUCTION DES ERREURS
// ═══════════════════════════════════════════════════════════════════
export function translateError(code) {
  const map = {
    // Email
    'auth/invalid-email': 'Adresse email invalide.',
    'auth/user-disabled': 'Compte désactivé.',
    'auth/user-not-found': 'Aucun compte associé à cet email.',
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password': 'Mot de passe trop faible (6 caractères min).',
    // Popup OAuth
    'auth/popup-closed-by-user': 'Fenêtre fermée avant la connexion.',
    'auth/popup-blocked': 'Popup bloquée. Autorisez les popups pour ce site.',
    'auth/cancelled-popup-request': 'Connexion annulée.',
    'auth/account-exists-with-different-credential': 'Un compte existe déjà avec une autre méthode pour cet email. Connectez-vous avec la méthode initiale.',
    'auth/operation-not-allowed': 'Méthode désactivée dans Firebase. Activez-la dans Authentication → Sign-in method.',
    'auth/unauthorized-domain': 'Ce domaine n\'est pas autorisé. Ajoutez-le dans Authentication → Settings → Authorized domains.',
    // Phone
    'auth/invalid-phone-number': 'Numéro invalide. Format attendu : +33612345678',
    'auth/missing-phone-number': 'Veuillez saisir un numéro.',
    'auth/quota-exceeded': 'Quota SMS dépassé.',
    'auth/invalid-verification-code': 'Code SMS incorrect.',
    'auth/code-expired': 'Code expiré, redemandez un SMS.',
    'auth/captcha-check-failed': 'Vérification reCAPTCHA échouée.',
    // Réseau
    'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
    'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
  };
  return map[code] || 'Une erreur est survenue. Réessayez.';
}

export { isAdmin };

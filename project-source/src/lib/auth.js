import { initializeApp } from 'firebase/app';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut,
  onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import { logger } from './logger.js';
import { FIREBASE_CONFIG, isAdmin } from './config.js';

let firebaseApp = null, firebaseAuth = null, initialized = false, initError = null;

function init() {
  if (initialized) return;
  try {
    if (!FIREBASE_CONFIG.apiKey) throw new Error('Config Firebase manquante — voir .env');
    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(firebaseApp);
    initialized = true;
    logger.auth('Firebase initialisé', { projectId: FIREBASE_CONFIG.projectId });
  } catch (err) {
    initError = err;
    logger.error('Échec init Firebase', { message: err.message });
  }
}
function ensure() { if (!initialized && !initError) init(); if (initError) throw initError; }

export async function loginWithGoogle() {
  ensure(); logger.auth('Connexion Google...');
  try {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    const r = await signInWithPopup(firebaseAuth, p);
    logger.success('Connexion Google', { email: r.user.email, admin: isAdmin(r.user.email) });
    return r.user;
  } catch (err) { logger.error('Échec Google', { code: err.code }); throw err; }
}
export async function loginWithEmail(email, password) {
  ensure(); logger.auth(`Connexion email : ${email}`);
  try { const r = await signInWithEmailAndPassword(firebaseAuth, email, password); logger.success('Connecté', { email }); return r.user; }
  catch (err) { logger.error('Échec email', { code: err.code }); throw err; }
}
export async function registerWithEmail(email, password, displayName) {
  ensure(); logger.auth(`Inscription : ${email}`);
  const r = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (displayName) await updateProfile(r.user, { displayName });
  logger.success('Compte créé', { email });
  return r.user;
}
export async function resetPassword(email) { ensure(); await sendPasswordResetEmail(firebaseAuth, email); logger.success('Email reset envoyé'); }
export async function logout() { ensure(); const e = firebaseAuth.currentUser?.email; await signOut(firebaseAuth); logger.auth('Déconnexion', { email: e }); }
export function onAuthChanged(cb) {
  ensure();
  return onAuthStateChanged(firebaseAuth, (u) => {
    if (u) logger.auth(`Connecté : ${u.email} ${isAdmin(u.email) ? '👑 ADMIN' : ''}`);
    else logger.auth('Déconnecté');
    cb(u);
  });
}
export function translateError(code) {
  const m = { 'auth/invalid-email':'Email invalide.','auth/user-not-found':'Aucun compte.','auth/wrong-password':'Mot de passe incorrect.','auth/invalid-credential':'Email/mdp incorrect.','auth/email-already-in-use':'Email déjà utilisé.','auth/weak-password':'Mot de passe trop faible (6+).','auth/popup-closed-by-user':'Fenêtre fermée.','auth/popup-blocked':'Popup bloquée.','auth/network-request-failed':'Erreur réseau.','auth/too-many-requests':'Trop de tentatives.' };
  return m[code] || 'Erreur : réessayez.';
}
export { isAdmin };

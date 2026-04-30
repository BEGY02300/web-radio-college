/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  VARIABLES D'ENVIRONNEMENT — À REMPLIR AVEC VOS VRAIES CLÉS        ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  ⚠️ Ce fichier est chargé AVANT l'app et expose les clés sur le    ║
 * ║     client. C'est NORMAL pour Firebase et Supabase anon : ces      ║
 * ║     clés sont conçues pour être publiques (la sécurité est gérée   ║
 * ║     côté serveur via les Authorized domains et les Row-Level       ║
 * ║     Security policies).                                            ║
 * ║                                                                    ║
 * ║  📍 Où trouver les valeurs :                                       ║
 * ║   • Firebase   : Firebase Console → ⚙ Paramètres → Vos applis     ║
 * ║   • Supabase   : Project Settings → API                            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
window.__ENV = {
  // ─── Firebase Auth ────────────────────────────────────────────────
  FIREBASE_API_KEY:             'REMPLACEZ_PAR_VOTRE_API_KEY',
  FIREBASE_AUTH_DOMAIN:         'votre-projet.firebaseapp.com',
  FIREBASE_PROJECT_ID:          'votre-projet',
  FIREBASE_STORAGE_BUCKET:      'votre-projet.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '123456789',
  FIREBASE_APP_ID:              '1:123456789:web:abc',

  // ─── Supabase (commentaires + profils + storage avatars) ──────────
  SUPABASE_URL:      'https://votreprojet.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbG...VOTRE_CLE_ANON',
};

/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  🔑 CLÉS API (version standalone sans build)                       ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Remplissez ce fichier avec vos vraies clés API pour la version   ║
 * ║  standalone (sans npm run build).                                  ║
 * ║                                                                    ║
 * ║  ⚠️  NE COMMITEZ JAMAIS CE FICHIER AVEC DE VRAIES CLÉS             ║
 * ║      (ajoutez env.js au .gitignore si vous mettez des prod keys)  ║
 * ║                                                                    ║
 * ║  Pour la version React+Vite (project-source/), utilisez .env      ║
 * ║  voir project-source/.env.example                                  ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
window.__ENV = {
  // ─── FIREBASE (Authentification par téléphone) ──────────────────
  // 1) Créez un projet sur https://console.firebase.google.com
  // 2) Authentication → Sign-in method → activez "Phone"
  // 3) Authentication → Settings → Authorized domains : ajoutez
  //    localhost + votre domaine de production (ex: web-radio.netlify.app)
  // 4) ⚙️ Paramètres → Général → Vos applications → "</> Web" → copiez la config
  FIREBASE_API_KEY:             '',
  FIREBASE_AUTH_DOMAIN:         '',  // ex: web-radio-college.firebaseapp.com
  FIREBASE_PROJECT_ID:          '',  // ex: web-radio-college
  FIREBASE_STORAGE_BUCKET:      '',
  FIREBASE_MESSAGING_SENDER_ID: '',
  FIREBASE_APP_ID:              '',

  // ─── SUPABASE (stockage des commentaires) ───────────────────────
  // Récupérez ces valeurs sur https://app.supabase.com
  // → votre projet → ⚙️ Settings → API
  SUPABASE_URL:      '',  // ex: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',  // la clé "anon public"
};

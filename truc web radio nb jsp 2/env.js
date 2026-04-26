/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  🔑 CLÉS API (version standalone sans build)                      ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Remplissez ce fichier avec vos vraies clés API pour la version   ║
 * ║  standalone (sans npm run build).                                 ║
 * ║                                                                   ║
 * ║  ⚠️  NE COMMITEZ JAMAIS CE FICHIER AVEC DE VRAIES CLÉS            ║
 * ║      (ajoutez env.js au .gitignore si vous mettez des prod keys)  ║
 * ║                                                                   ║
 * ║  Pour la version React+Vite (project-source/), utilisez .env      ║
 * ║  voir project-source/.env.example                                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
window.__ENV = {
  // ─── FIREBASE (Authentification par téléphone) ──────────────────
  // 1) Créez un projet sur https://console.firebase.google.com
  // 2) Authentication → Sign-in method → activez "Phone"
  // 3) Authentication → Settings → Authorized domains : ajoutez
  //    localhost + votre domaine de production (ex: web-radio.netlify.app)
  // 4) ⚙️ Paramètres → Général → Vos applications → "</> Web" → copiez la config
  FIREBASE_API_KEY:             'AIzaSyBTYks3qLdV-GeaLivmE8aP7QbMtbl4Z5M',
  FIREBASE_AUTH_DOMAIN:         'authentication-pour-le-site.firebaseapp.com',  // ex: web-radio-college.firebaseapp.com
  FIREBASE_PROJECT_ID:          'authentication-pour-le-site',  // ex: web-radio-college
  FIREBASE_STORAGE_BUCKET:      'authentication-pour-le-site.firebasestorage.app',
  FIREBASE_MESSAGING_SENDER_ID: '815553918707',
  FIREBASE_APP_ID:              '1:815553918707:web:819bae9f05960a70f4a986',

  // ─── SUPABASE (stockage des commentaires) ───────────────────────
  // Récupérez ces valeurs sur https://app.supabase.com
  // → votre projet → ⚙️ Settings → API
  SUPABASE_URL:      'https://uitjkjvvvzyuyhrjpyyf.supabase.co',  // ex: https://xxxx.supabase.co
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpdGpranZ2dnp5dXlocmpweXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDAwMDUsImV4cCI6MjA5MjI3NjAwNX0.ohjUcQa0-oj6ptDOaamEbmyxhJnZQayvn5wAp-hdHxA',  
};

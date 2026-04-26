# 🎙️ Web Radio Collège

> Application web pour diffuser podcasts & reportages d'un dépôt GitHub public, avec **système de commentaires** (Firebase Auth par **téléphone** + Supabase).

## 🆕 Nouveautés (v3.0)
- 🔐 **6 méthodes de connexion** : Email, 🔵 Google, 🍎 Apple/Game Center, 📱 Téléphone, 🐙 GitHub, 🟣 Yahoo
- 🎧 **Lecteur audio custom** type Spotify (cover, play/pause stylisé, progression, volume, skip ±10/30s) — fini le lecteur Chrome moche
- 📁 **Dossiers dépliants** — clic = déroule les médias dedans (récursif, lazy load)
- 🖼️ **Covers automatiques** — `episode01.mp3` + `episode01.webp` = la cover s'affiche automatiquement
- 🎥 **YouTube non répertorié** — créez un fichier `.url` ou `.txt` avec un lien YouTube → lecteur intégré minimaliste (mode `nocookie`, sans vidéos suggérées)
- 🌿 **Détection automatique de la branche** — fallback auto sur `main`/`master` si la branche configurée n'existe pas
- 📊 Logs console F12 enrichis (tableaux `console.table`, groupes pliables)

![Status](https://img.shields.io/badge/status-ready-green) ![No Backend](https://img.shields.io/badge/backend-serverless-orange) ![Admin](https://img.shields.io/badge/admin-techsaga.fr%40gmail.com-amber)

---

## 🎯 Ce que fait l'application

- 📻 Liste automatiquement les **podcasts (audio)** et **reportages (vidéo)** depuis le dépôt GitHub **BEGY02300/web-radio-coll-ge**, branche `1`, dossier `medias/`
- ▶️ Lecteur intégré (audio + vidéo)
- 📥 Téléchargement direct
- 💬 **Commentaires** par média (connexion requise)
- 🔐 Connexion via 6 fournisseurs : Email, Google, Apple/Game Center, SMS, GitHub, Yahoo
- 👑 **Panneau admin** pour `techsaga.fr@gmail.com` ou numéros listés dans `ADMIN_PHONES`
- 🎧 **Lecteur audio custom** moderne (cover, contrôles riches)
- 🖼️ **Covers d'épisode** détectées automatiquement
- 🎥 Support **YouTube non répertorié** sans branding YT
- 🌓 Mode sombre
- 🔍 Détection **automatique** des nouveaux fichiers — vous poussez un MP3, il apparaît
- 🐞 Debug **console navigateur (F12)** — tous les logs y sont affichés

---

## 📁 Où modifier quoi ? (cheat sheet)

| Je veux…                                          | Fichier à ouvrir                                  | Ligne à modifier                                 |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| **Ajouter un admin (email)**                      | `js/config.js`                                    | Tableau `ADMIN_EMAILS = [...]`                   |
| **Ajouter un admin (téléphone)** ⭐               | `js/config.js`                                    | Tableau `ADMIN_PHONES = ['+33612345678', ...]`   |
| **Changer de dépôt GitHub**                       | idem                                              | Objet `REPO = { owner, repo, branch, rootPath }` |
| **Renseigner Firebase / Supabase (standalone)**   | `env.js`                                          | Remplir toutes les valeurs `FIREBASE_*` et `SUPABASE_*` |
| **Renseigner Firebase / Supabase (Vite)**         | `project-source/.env` (copie de `.env.example`)   | Remplir toutes les valeurs `VITE_*`              |
| **Activer/désactiver le debug console**           | `js/config.js` → `DEBUG_CONSOLE = true/false`     | `true` = logs affichés en F12                    |
| **Changer le nom du site**                        | `js/config.js` → `SITE.title / subtitle`          | —                                                |

### ➕ Exemple : ajouter un admin par téléphone (⭐ recommandé)

Depuis la v2.1, comme la connexion se fait UNIQUEMENT par SMS, vous devez enregistrer le **numéro** de vos admins.

Ouvrez `js/config.js`, trouvez ce bloc :

```js
export const ADMIN_PHONES = [
  // '+33612345678',        // ← décommentez et remplacez par le numéro de techsaga
];
```

Remplacez par les numéros réels (format international, **sans espaces**) :

```js
export const ADMIN_PHONES = [
  '+33612345678',   // techsaga
  '+33701020304',   // prof principal
];
```

> 💡 Le numéro doit correspondre **exactement** à ce que Firebase affiche après connexion. Pour le vérifier : connectez-vous une première fois, puis F12 → Console → tapez `firebase.auth().currentUser.phoneNumber`.

### ➕ Ajouter un admin par email (si vous rebasculez plus tard sur auth email)

```js
export const ADMIN_EMAILS = [
  'techsaga.fr@gmail.com',
  'prof@college.fr',
  'moderateur@college.fr',
];
```

Sauvegardez. C'est tout. Les utilisateurs connectés avec un de ces emails verront le bouton **Admin** 👑 dans le header.

---

## 🗂️ Structure du projet

```
.
├── index.html                      # ⭐ Entrée standalone (React via CDN ESM)
├── env.js                          # 🔑 Clés API (Firebase + Supabase) — REMPLIR
├── favicon.svg
├── supabase-setup.sql              # 📜 Script SQL pour créer la table commentaires
├── README.md                       # 📖 Ce fichier
├── js/
│   ├── config.js                   # ⚙️ Configuration centrale (admins, repo, etc.)
│   ├── logger.js                   # 🐞 Logger → console F12 du navigateur
│   ├── github-api.js               # 📡 Service GitHub API + cache
│   ├── auth.js                     # 🔐 Firebase Auth
│   ├── comments.js                 # 🗄️ Supabase (commentaires)
│   └── app.js                      # 🎨 Application React (via htm)
│
└── project-source/                 # ⭐ Version React + Vite (build optimisé)
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    ├── .env.example                # Template .env (à copier en .env)
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── components/             # Header, FileCard, AuthModal, AdminPanel, etc.
        ├── lib/                    # config, logger, github-api, auth, comments
        └── styles/index.css
```

---

## 🚀 INSTALLATION PAS-À-PAS (30 minutes)

### 📋 Étape 1 — Préparer le dépôt GitHub des médias (5 min)

1. Créez un compte GitHub si vous n'en avez pas : https://github.com/join
2. Créez un dépôt **public** nommé `web-radio-coll-ge` sous votre compte `BEGY02300` (ou choisissez un autre nom et mettez-le à jour dans `js/config.js`)
3. Créez la branche `1` (via **Branches → New branch** sur GitHub) — *ou laissez `main`, l'app fait un fallback automatique*
4. Créez un dossier `medias/` à la racine (ajoutez un fichier vide `medias/.gitkeep` pour l'initialiser)
5. Ajoutez-y vos podcasts/reportages — voir le guide d'organisation ci-dessous

#### 📂 Comment organiser le dépôt ? (lecteur intelligent)

L'app **détecte automatiquement** la structure suivante. **Aucune modification de code n'est nécessaire** quand vous ajoutez/renommez des fichiers.

```
medias/
├── podcasts/                      ← devient une catégorie pliable
│   ├── episode-01.mp3
│   ├── episode-01.webp            ← 🖼️ COVER auto (même nom que le mp3)
│   ├── episode-02.mp3
│   └── episode-02.jpg             ← idem (jpg, png, webp, gif fonctionnent)
│
├── reportages/                    ← deuxième catégorie pliable
│   ├── visite-college.mp4
│   ├── visite-college.png         ← cover du reportage
│   ├── interview-prof.mp4
│   └── ma-video-yt.url            ← 🎥 lien YouTube non répertorié (voir ci-dessous)
│
└── special/                       ← autant de dossiers que vous voulez
    └── intro.mp3
```

##### 🖼️ Covers automatiques

Si vous mettez un fichier image (`.webp`, `.jpg`, `.png`, `.gif`, `.avif`) avec **exactement le même nom** que votre média, il devient automatiquement la cover affichée dans le lecteur.

| Fichier média        | Fichier cover         | Résultat                     |
| -------------------- | --------------------- | ---------------------------- |
| `episode-01.mp3`     | `episode-01.webp`     | ✅ cover utilisée            |
| `interview.mp4`      | `interview.png`       | ✅ cover utilisée + poster   |
| `tuto.mp3`           | (rien)                | 🎵 icône par défaut          |

##### 🎥 Vidéos YouTube non répertoriées

Pour intégrer une vidéo YouTube non répertoriée **sans afficher la card YouTube classique** :

1. Créez un fichier texte `ma-video.url` (ou `.txt`) dans le dossier voulu
2. Mettez **uniquement le lien YouTube** dedans :
   ```
   https://www.youtube.com/watch?v=dQw4w9WgXcQ
   ```
3. (Optionnel) Ajoutez `ma-video.webp` à côté pour une cover personnalisée

L'app affichera un **lecteur YouTube minimaliste** (mode `nocookie`, sans vidéos suggérées, sans logo YT visible). Si vous mettez une cover, elle s'affiche en vignette à la place de la miniature YouTube par défaut.

> 💡 **Astuce** : les fichiers `.url`/`.txt` n'ont aucun coût de stockage et sont parfaits pour des vidéos lourdes que vous ne voulez pas héberger sur GitHub.

### 🔥 Étape 2 — Configurer Firebase Authentication (15 min)

L'app supporte **6 méthodes de connexion** (toutes optionnelles — activez seulement celles que vous voulez offrir à vos utilisateurs) :

| Méthode             | Provider Firebase | Difficulté    | Notes                                       |
| ------------------- | ----------------- | ------------- | ------------------------------------------- |
| 📧 Email + mot de passe | `Email/Password` | ⭐ Facile     | Aucune config externe                       |
| 🔵 Google           | `Google`          | ⭐ Facile     | Aucune config externe                       |
| 📱 Téléphone (SMS)  | `Phone`           | ⭐⭐ Moyen     | Quota SMS Firebase, ajouter numéros de test |
| 🍎 Apple / Game Center | `Apple`        | ⭐⭐⭐ Avancé  | Compte développeur Apple ($99/an) + clé p8 |
| 🐙 GitHub           | `GitHub`          | ⭐⭐ Moyen     | OAuth App à créer sur github.com            |
| 🟣 Yahoo            | `Yahoo`           | ⭐⭐ Moyen     | OAuth App à créer sur developer.yahoo.com   |

> 💡 **Pour démarrer rapidement, activez juste Email + Google + Phone**. Les autres providers peuvent être ajoutés plus tard.

#### 2.1 — Création du projet Firebase

1. Allez sur https://console.firebase.google.com/
2. **Ajouter un projet** → nommez-le `web-radio-college` → **Continuer** (désactivez Google Analytics si vous voulez) → **Créer le projet**
3. Dans le menu de gauche : **Build → Authentication → Commencer**

#### 2.2 — Activer les méthodes de connexion (Sign-in method)

**📧 Email/Password** — cliquez dessus → activez → enregistrez.

**🔵 Google** — cliquez dessus → activez → choisissez un email de support → enregistrez.

**📱 Phone** — cliquez dessus → activez → enregistrez.
- 💡 *Pour tester sans consommer de SMS* : ajoutez un **numéro de test** (ex: `+33612345678`) avec un **code fictif** (ex: `123456`) en bas de l'onglet. Firebase acceptera ce code sans envoyer de vrai SMS.

**🍎 Apple** *(optionnel)* — voir https://firebase.google.com/docs/auth/web/apple
- Nécessite un compte Apple Developer (99 $/an)
- Créer un **Service ID** sur https://developer.apple.com/account/resources/identifiers
- Créer une **clé privée Sign in with Apple** (`.p8`)
- Coller Service ID + Team ID + Key ID + clé privée dans Firebase
- ⚠️ Apple = méthode utilisée par **Game Center** sur le web (les comptes Game Center sont liés à un Apple ID)

**🐙 GitHub** *(optionnel)* — voir https://firebase.google.com/docs/auth/web/github-auth
- Aller sur https://github.com/settings/developers → **New OAuth App**
- **Authorization callback URL** : `https://VOTRE-PROJET.firebaseapp.com/__/auth/handler`
- Copier **Client ID** + **Client Secret** dans Firebase

**🟣 Yahoo** *(optionnel)* — voir https://firebase.google.com/docs/auth/web/yahoo-oauth
- Aller sur https://developer.yahoo.com/apps/create/ → créer une app
- **Redirect URI** : `https://VOTRE-PROJET.firebaseapp.com/__/auth/handler`
- Copier Client ID + Client Secret dans Firebase

#### 2.3 — Authorized domains

Onglet **Settings → Authorized domains** :
- Ajoutez le domaine où votre site sera hébergé (ex: `monprojet.netlify.app`, `monuser.github.io`).
- `localhost` est déjà autorisé pour le dev.
- ⚠️ **Sans ce domaine, vous aurez l'erreur `auth/unauthorized-domain` lors du popup OAuth**.

#### 2.4 — Récupérer la config Firebase

⚙️ **Paramètres du projet → Général → Vos applications → Web (icône `</>`)** → enregistrez l'app → copiez la section `firebaseConfig` :

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "web-radio-college.firebaseapp.com",
  projectId: "web-radio-college",
  storageBucket: "web-radio-college.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123..."
};
```

### 🗄️ Étape 3 — Configurer Supabase (5 min)

1. Allez sur https://app.supabase.com/ → **New project**
2. Donnez un nom (ex: `web-radio-comments`), un mot de passe BDD fort, choisissez une région proche
3. Attendez ~2 min que le projet soit prêt
4. Cliquez sur **SQL Editor** (icône éclair ⚡ à gauche) → **New query**
5. Copiez/collez le **contenu complet du fichier `supabase-setup.sql`** de ce projet → **Run** ▶️
6. Récupérez les clés : ⚙️ **Project Settings → API** → copiez :
   - **Project URL** (ex: `https://xxxxx.supabase.co`)
   - **anon public** key (c'est la "clé publique", OK dans le navigateur)

### ⚙️ Étape 4 — Renseigner les clés dans votre projet

#### Si vous utilisez la **version standalone** (dossier racine) :

Ouvrez `env.js` et remplissez :

```js
window.__ENV = {
  FIREBASE_API_KEY:             'AIzaSy...',
  FIREBASE_AUTH_DOMAIN:         'web-radio-college.firebaseapp.com',
  FIREBASE_PROJECT_ID:          'web-radio-college',
  FIREBASE_STORAGE_BUCKET:      'web-radio-college.appspot.com',
  FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  FIREBASE_APP_ID:              '1:1234567890:web:abc123...',

  SUPABASE_URL:      'https://xxxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1...',
};
```

#### Si vous utilisez la **version Vite** (`project-source/`) :

```bash
cd project-source
cp .env.example .env
```

Puis éditez `.env` :

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=web-radio-college.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=web-radio-college
VITE_FIREBASE_STORAGE_BUCKET=web-radio-college.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123...

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

### ▶️ Étape 5 — Tester en local

#### Version standalone
Ouvrez simplement `index.html` avec un **serveur web local** (nécessaire pour les imports ES modules) :

```bash
# Option 1 : Python
python3 -m http.server 8000

# Option 2 : Node.js
npx serve .

# Option 3 : VS Code → extension "Live Server" (clic droit → Open with Live Server)
```

Puis allez sur http://localhost:8000

#### Version Vite
```bash
cd project-source
npm install
npm run dev
# → http://localhost:5173
```

---

## 🌐 MISE EN LIGNE (déploiement)

### 🟢 Option A — Netlify (le plus simple, gratuit, HTTPS auto)

#### Version standalone (drag & drop)
1. Rendez-vous sur https://app.netlify.com/drop
2. Connectez-vous (GitHub, email, etc.)
3. **Glissez-déposez** le dossier racine contenant `index.html`, `env.js`, `favicon.svg`, le dossier `js/`
4. URL instantanée : `https://xxxxx.netlify.app`
5. **⚠️ IMPORTANT** : allez dans votre console Firebase → **Authentication → Settings → Authorized domains** → ajoutez `xxxxx.netlify.app`

#### Version Vite (build)
```bash
cd project-source
npm install
npm run build
# → le dossier dist/ est prêt
```
Glissez le dossier `dist/` sur Netlify Drop. Ou :

1. Poussez `project-source/` sur GitHub
2. Netlify → **Add new site → Import from Git** → choisir le repo
3. Build command : `npm run build`
4. Publish directory : `dist`
5. **Environment variables** (onglet Site settings) : ajoutez toutes les `VITE_*` de votre `.env`
6. **Deploy**

### 🟢 Option B — Vercel

1. https://vercel.com/new → importer le dépôt GitHub contenant `project-source/`
2. **Root Directory** : `project-source`
3. Framework : **Vite** (auto-détecté)
4. **Environment Variables** : ajoutez les `VITE_*`
5. **Deploy**
6. Ajoutez le domaine Vercel dans Firebase → Authorized domains

### 🟢 Option C — GitHub Pages (gratuit, lié à votre compte)

Pour la version standalone :

1. Créez un dépôt public (ex: `web-radio-deploy`)
2. Uploadez `index.html`, `env.js`, `favicon.svg`, dossier `js/`
3. Dépôt → **Settings → Pages → Source : Deploy from a branch → main / root → Save**
4. URL : `https://BEGY02300.github.io/web-radio-deploy/`
5. Ajoutez ce domaine dans Firebase → Authorized domains

⚠️ **Note** : pour la version Vite sur GitHub Pages sous un sous-chemin, éditez `project-source/vite.config.js` :
```js
base: '/web-radio-deploy/',
```
puis `npm run build` et publiez `dist/`.

### 🟢 Option D — Cloudflare Pages

1. https://dash.cloudflare.com → Pages → **Create application**
2. Connectez GitHub → sélectionnez votre dépôt
3. Build command : `npm run build` (ou rien pour standalone)
4. Output directory : `dist` (ou `/` pour standalone)
5. Variables d'environnement : ajoutez les `VITE_*`
6. URL : `https://votre-projet.pages.dev`

---

## 🧪 Console de debug (F12)

### Comment y accéder
1. Ouvrez le site dans un navigateur
2. Pressez **F12** (ou `Ctrl+Maj+I` sur Chrome/Firefox, `Cmd+Opt+I` sur macOS)
3. Cliquez sur l'onglet **Console**

### Ce que vous verrez

```
🎙️ WEB RADIO COLLÈGE
Console de debug active. Tapez __logger.logs pour voir l'historique, ou __logger.exportJSON() pour exporter en JSON.

ℹ️  INFO    18:29:25.450  🎙️ Web Radio Collège démarre {version: 2.0.0, repo: BEGY02300/web-radio-coll-ge@1, rootPath: medias}
ℹ️  INFO    18:29:25.596  📂 Exploration du dossier : medias
🌐 API     18:29:25.600  GET https://api.github.com/repos/BEGY02300/web-radio-coll-ge/contents/medias?ref=1
🔍 DEBUG   18:29:25.856  ↳ HTTP 200 en 255ms • Rate limit: 58/60
📊 Résultat pour "medias"     ← tableau repliable
  📁 3 dossier(s) trouvé(s)
  🎬 12 média(s) audio/vidéo détecté(s)
✅ SUCCESS 18:29:25.860  ✓ 3 dossier(s) + 12 média(s)
🔐 AUTH    18:29:26.123  Firebase initialisé
🔐 AUTH    18:29:27.001  État auth : connecté en tant que user@mail.fr
🗄️  DB      18:29:30.456  Chargement des commentaires pour : BEGY02300/web-radio-coll-ge/1/medias/podcast1.mp3
✅ SUCCESS 18:29:30.612  ✓ 2 commentaire(s) chargé(s)
```

### Commandes utiles dans la console
```js
__logger.logs              // voir tout l'historique
__logger.exportJSON()      // télécharger les logs en .json
__logger.clear()           // effacer
sessionStorage.clear()     // vider le cache GitHub (force rafraîchissement)
```

### Niveaux de logs
- 🔍 **DEBUG** (gris) — détails techniques
- ℹ️ **INFO** (bleu) — événements normaux
- 🌐 **API** (violet) — appels GitHub
- ✅ **SUCCESS** (vert) — opérations réussies
- ⚠️ **WARN** (orange) — avertissements
- ❌ **ERROR** (rouge) — erreurs
- 🔐 **AUTH** (rose) — événements d'authentification
- 🗄️ **DB** (cyan) — opérations Supabase

---

## 🔒 Sécurité

| Mesure | Implémentation |
|---|---|
| **CSP stricte** | `Content-Security-Policy` limitant les origines scripts/médias/APIs |
| **Sanitation chemins GitHub** | Regex whitelist `[a-zA-Z0-9_.\-/]` + suppression `..` |
| **Rate-limit client** | 200 ms min entre requêtes GitHub |
| **Firebase rules** | Authentification obligatoire pour commenter |
| **Supabase RLS** | Row Level Security activée (voir `supabase-setup.sql`) |
| **Échappement XSS** | React échappe automatiquement tout contenu dynamique |
| **`.env` hors Git** | `.gitignore` exclut les clés sensibles |
| **Clé `anon` Supabase** | Conçue pour être publique (combinée avec RLS) |

⚠️ **Important** : la clé `anon` de Supabase est **faite pour être exposée côté client** (c'est son usage normal). La sécurité repose sur les **RLS policies** configurées dans le SQL.

---

## ❓ FAQ / Dépannage

**Q : "Configuration Firebase manquante" dans la console**  
R : Vous n'avez pas rempli `env.js` (standalone) ou `.env` (Vite). Voir Étape 4.

**Q : "Ressource introuvable (404)"**  
R : Le dépôt GitHub `BEGY02300/web-radio-coll-ge` n'existe pas, ou la branche `1` n'existe pas, ou le dossier `medias/` est absent. Créez-les. Videz ensuite le cache : `sessionStorage.clear()`.

**Q : "auth/unauthorized-domain" à la connexion**  
R : Firebase Console → Authentication → Settings → Authorized domains → ajoutez votre domaine de production.

**Q : Les commentaires ne se postent pas**  
R : Vérifiez dans la console F12 (onglet **Network**) la réponse Supabase. Le plus souvent : la table `comments` n'a pas été créée ou les RLS policies ne sont pas actives. Re-exécutez `supabase-setup.sql`.

**Q : Comment vider tout le cache GitHub ?**  
R : Dans la console F12, tapez : `sessionStorage.clear()` puis rechargez.

**Q : Comment ajouter d'autres admins ?**  
R : Éditez `js/config.js` (ou `project-source/src/lib/config.js`), tableau `ADMIN_EMAILS`. Rechargez.

**Q : J'ajoute un MP3 sur GitHub, il n'apparaît pas**  
R : Le cache dure 5 minutes. Soit attendez, soit `sessionStorage.clear()` + rechargez.

**Q : Limite GitHub "60 requêtes/heure"**  
R : Limite IP partagée. Chaque navigation = 1 requête. Avec le cache (5 min), c'est largement suffisant pour un collège.

---

## 📊 Données stockées

### Supabase (table `comments`)
| Champ       | Type        | Description                         |
| ----------- | ----------- | ----------------------------------- |
| `id`        | uuid        | Clé primaire auto                   |
| `media_id`  | text        | Chemin unique du média dans le repo |
| `media_name`| text        | Nom affiché du fichier              |
| `user_uid`  | text        | Firebase UID de l'auteur            |
| `user_email`| text        | Email de l'auteur                   |
| `user_name` | text        | Nom affiché                         |
| `content`   | text        | Le commentaire (max 2000 car.)      |
| `created_at`| timestamptz | Date automatique                    |

### localStorage du navigateur (utilisateur)
- `theme` : `'dark'` ou `'light'`
- Cache de la session Firebase (géré par Firebase SDK)

### sessionStorage du navigateur
- `gh:BEGY02300/web-radio-coll-ge@1:...` — cache des réponses GitHub (5 min)

---

## 🛣️ Améliorations possibles

- [ ] Notifications email à l'admin lors d'un nouveau commentaire (via Supabase Edge Functions)
- [ ] Signalement de commentaires inappropriés
- [ ] Modération a priori (commentaires en attente de validation)
- [ ] Playlist / lecture en file d'attente
- [ ] PWA (installable, hors-ligne)
- [ ] Statistiques d'écoute (par média)
- [ ] Partage sur réseaux sociaux

---

## 📄 Licence

MIT — Libre d'utilisation, modification, distribution.

---

**🎙️ Bon podcast !** — Pour toute question technique, ouvrez la console F12.

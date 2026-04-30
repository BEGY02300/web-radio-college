# 🎙️ Web Radio Collège — v6.0

Site statique (HTML / CSS / JS modules + React via CDN) destiné à diffuser **podcasts**, **reportages vidéo** et **vidéos YouTube** d'un collège, avec :

- Style éditorial **« papier crème »** inspiré de la maquette wireframe (fond beige, traits ink fins, cartes arrondies, ombre décalée).
- **Striping multi-dépôts GitHub** pour héberger gratuitement jusqu'à ~100 Go de médias.
- **Google AdSense** prêt à être activé (script + meta + emplacements `<ins>`).
- Authentification Firebase (e-mail/pseudo, Google, GitHub, Yahoo, SMS).
- Commentaires + modération + signalements via Supabase.

---

## ✅ Fonctionnalités terminées

| Domaine | État |
|---|---|
| Charte graphique « papier crème » (palette, cartes, boutons, scrollbar) | ✅ |
| 3 sections fixes : Podcasts, Reportages, Vidéos | ✅ |
| Lecteurs audio / vidéo / YouTube custom | ✅ |
| Détection automatique des covers (même nom de fichier) | ✅ |
| Cache GitHub (mémoire + sessionStorage, TTL 5 min) **par dépôt** | ✅ |
| Throttling 200 ms + fallback de branche | ✅ |
| **Pool multi-dépôts (striping)** + agrégation parallèle | ✅ |
| Auth Firebase (5 méthodes) + reCAPTCHA | ✅ |
| Profils Supabase (pseudo, bio, avatar upload/URL/preset) | ✅ |
| Commentaires + filtre profanité + anti-spam | ✅ |
| Signalements + auto-masquage à 3 reports | ✅ |
| Panneau admin (commentaires, signalements, bans) | ✅ |
| Favoris + historique (localStorage) | ✅ |
| Toasts, modes clair/sombre | ✅ |
| **Google AdSense** : script async + meta vérification + composant `AdSlot` réutilisable | ✅ |
| CSP élargie pour AdSense + Stripe Payment Links | ✅ |

---

## 🧱 Système multi-dépôts GitHub (« stripe »)

### Pourquoi ?
GitHub impose :
- **100 Mo / fichier** (limite dure)
- **~1 Go / dépôt** recommandé
- **5 Go / dépôt** limite haute avant risque de blocage
- **60 requêtes API / heure** sans token

➜ Pour stocker ~100 Go on **répartit** les fichiers sur ~25 dépôts publics (≈ 4 Go chacun, marge de sécurité), comme un RAID-0.

### Structure attendue dans CHAQUE dépôt

```
<repo>/
└── medias/
    ├── podcasts/        ← .mp3 .m4a .ogg .wav
    │   ├── episode-01.mp3
    │   └── episode-01.webp     ← cover (même nom de base)
    ├── reportages/      ← .mp4 .webm .mov
    │   ├── visite.mp4
    │   └── visite.jpg          ← poster
    └── videos/          ← liens YouTube .url ou .txt
        ├── interview.url       ← contient https://youtu.be/XXXXX
        └── interview.webp      ← miniature
```

> Chaque dépôt n'a **pas besoin** de remplir les 3 sous-dossiers. Vous pouvez **dédier** un dépôt à une section (voir la clé `sections` ci-dessous).

### Configuration : `js/config.js → REPO_POOL`

```js
export const REPO_POOL = [
  // Dépôt principal (toutes sections)
  { owner: 'BEGY02300', repo: 'web-radio-coll-ge',  branch: '1',    rootPath: 'medias', label: 'Pool 01', sections: [] },

  // Dépôts dédiés Podcasts
  { owner: 'BEGY02300', repo: 'wrc-podcasts-01',    branch: 'main', rootPath: 'medias', label: 'Podcasts 01', sections: ['podcasts'] },
  { owner: 'BEGY02300', repo: 'wrc-podcasts-02',    branch: 'main', rootPath: 'medias', label: 'Podcasts 02', sections: ['podcasts'] },

  // Dépôts dédiés Reportages (vidéos lourdes)
  { owner: 'BEGY02300', repo: 'wrc-reportages-01',  branch: 'main', rootPath: 'medias', label: 'Reportages 01', sections: ['reportages'] },
  { owner: 'BEGY02300', repo: 'wrc-reportages-02',  branch: 'main', rootPath: 'medias', label: 'Reportages 02', sections: ['reportages'] },

  // Dépôt vidéos YouTube (poids quasi nul)
  { owner: 'BEGY02300', repo: 'wrc-videos-01',      branch: 'main', rootPath: 'medias', label: 'Vidéos 01',   sections: ['videos'] },
];
```

| Champ | Description |
|---|---|
| `owner` | Pseudo GitHub propriétaire du dépôt |
| `repo` | Nom du dépôt (public !) |
| `branch` | Branche cible (fallback automatique sur la branche par défaut) |
| `rootPath` | Dossier racine des médias (`medias` recommandé) |
| `label` | Nom affiché dans la console pour le debug |
| `sections` | `[]` ou absent = lu pour les 3 sections ; sinon liste blanche (`['podcasts']`, `['reportages']`, …) |

### Plan recommandé pour 100 Go

| Section | Volume estimé | Nombre de dépôts (×4 Go) |
|---|---|---|
| 🎵 Podcasts (audio) | ~20 Go | 5 dépôts |
| 🎬 Reportages (vidéos) | ~75 Go | 19 dépôts |
| ▶️ Vidéos (YouTube `.url`) | < 100 Mo | 1 dépôt |
| **Total** | **~95 Go** | **~25 dépôts** |

### Comment téléverser

1. Créer un nouveau dépôt **public** sur GitHub.
2. Créer la structure `medias/podcasts/`, `medias/reportages/`, `medias/videos/`.
3. Glisser-déposer les fichiers dans l'interface web (≤ 100 Mo / fichier).
4. Quand le dépôt approche de **4 Go**, en créer un nouveau et l'ajouter dans `REPO_POOL`.
5. Vider le cache : bouton dans le panneau admin ou `clearCache()` dans la console.

L'application interroge **tous** les dépôts du pool **en parallèle** via `Promise.allSettled`, fusionne les résultats, déduplique les dossiers, et affiche tout dans une seule liste triée alphabétiquement.

---

## 📢 Google AdSense

### Étapes déjà effectuées
- `<meta name="google-adsense-account" content="ca-pub-6205152848310463">` dans `<head>`.
- `<script async src="https://pagead2.googlesyndication.com/...">` dans `<head>` avec `crossorigin="anonymous"`.
- CSP élargie (`pagead2.googlesyndication.com`, `googlesyndication.com`, `doubleclick.net`).
- Composant React **`AdSlot`** réutilisable (`js/app.js`).
- 3 emplacements posés dans la page :
  - **`header`** → sous le hero
  - **`inFeed`** → entre la 1re et la 2e section
  - **`footer`** → au-dessus du footer

### Activer les vraies annonces (4 étapes)
1. Aller sur https://www.google.com/adsense/ → **Annonces > Par unité d'annonce > Bannière**.
2. Créer 3 unités : *Header*, *In-Feed*, *Footer* — récupérer le `data-ad-slot` (10 chiffres).
3. Dans `js/config.js` :
   ```js
   export const ADSENSE = {
     enabled: true,
     client: 'ca-pub-6205152848310463',
     slots: {
       header:  '1234567890',
       inFeed:  '2345678901',
       sidebar: null,
       footer:  '3456789012',
     },
   };
   ```
4. Publier le site (onglet **Publish**) — AdSense valide automatiquement le domaine.

> Tant qu'un slot vaut `null`, `AdSlot` affiche un **placeholder** discret « Espace publicitaire » au lieu de la vraie balise. Aucune erreur console.

---

## 💳 Paiements (Stripe)

> **Limite** : un site 100 % statique ne peut pas signer de paiements (clé secrète + webhooks indispensables).

Solutions possibles :
1. **Stripe Payment Links** (recommandé, 0 backend) — coller un lien `https://buy.stripe.com/...` dans un bouton « Soutenir la radio ». La CSP autorise déjà `js.stripe.com`, `hooks.stripe.com`, `buy.stripe.com`.
2. **Edge Function Supabase / Netlify Functions** — créer un endpoint `/create-checkout-session` (hors scope de cet agent statique).

---

## 🌐 Entrées fonctionnelles (URI)

Le site est une **SPA** statique servie depuis `/`. Aucune route serveur.

| Chemin | Action |
|---|---|
| `/` | Page d'accueil (hero + 3 sections + AdSlots) |
| `#section-podcasts` | Ancre vers la section Podcasts |
| `#section-reportages` | Ancre vers la section Reportages |
| `#section-videos` | Ancre vers la section Vidéos |
| Modal **AuthModal** | Connexion (5 méthodes) |
| Modal **ProfileModal** | Édition pseudo / bio / avatar |
| Modal **FavoritesModal** | Favoris + historique (localStorage) |
| Modal **AdminPanel** | Réservé aux admins (`techsaga.fr@gmail.com`) |

API consommées :
- `GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}` (par dépôt du pool)
- `GET https://raw.githubusercontent.com/...` (médias + covers + .url YouTube)
- Supabase REST (profils, commentaires, signalements, bans, bucket `avatars`)
- Firebase Auth + reCAPTCHA

---

## 🧰 Modèles de données

### Pool dépôts (`REPO_POOL`)
```ts
type RepoEntry = {
  owner: string; repo: string; branch: string;
  rootPath: string; label?: string;
  sections?: ('podcasts'|'reportages'|'videos')[]; // [] ou absent = toutes
};
```

### Tables Supabase (voir `supabase-setup.sql`)
- **profiles** : `uid` (PK), `username` (unique CI), `bio`, `avatar_url`, `created_at`, `updated_at`
- **reports** : `id`, `comment_id`, `reporter_uid`, `reason`, `created_at` (anti-doublon)
- **bans** : `uid` (PK), `reason`, `until` (nullable = ban permanent)
- **comments** : `id`, `media_id`, `user_uid`, `display_name`, `content`, `hidden`, `created_at`

`media_id` = `${owner}/${repo}@${branch}:${path}` ➜ inclut désormais le **dépôt d'origine** (utile pour le striping).

---

## 🚧 Non terminé / pistes

- [ ] Bouton « Vider le cache pool » dans le panneau admin (actuellement via console).
- [ ] Affichage du **dépôt source** sur chaque carte (badge `repo._repo.label`).
- [ ] Page `/ads.txt` à publier pour AdSense (`google.com, pub-6205152848310463, DIRECT, f08c47fec0942fa0`).
- [ ] Bouton « Soutenir » avec Stripe Payment Link.
- [ ] PWA / service-worker pour mise en cache offline des covers.
- [ ] Tri par date (utilise `sha` GitHub : nécessite un appel `commits` supplémentaire).

---

## 📦 Prochaines étapes recommandées

1. **Créer 1 ou 2 dépôts shards** sur GitHub avec la structure `medias/...` et les ajouter dans `REPO_POOL`.
2. **Renseigner `env.js`** avec les vraies clés Firebase + Supabase.
3. **Créer les 3 unités AdSense** et coller leurs `data-ad-slot` dans `config.js`.
4. **Publier** via l'onglet *Publish* puis valider le domaine dans la console AdSense.
5. **Ajouter `ads.txt`** à la racine du domaine après validation.

---

## 🗂️ Arborescence simplifiée

```
.
├── index.html                ← AdSense script + meta + CSP, palette papier
├── env.js                    ← Vos clés Firebase / Supabase
├── favicon.svg
├── netlify.toml
├── supabase-setup.sql        ← SQL des tables profiles/reports/bans
└── js/
    ├── config.js             ← REPO_POOL + ADSENSE + SITE
    ├── github-api.js         ← Fetch parallèle multi-dépôts + cache
    ├── app.js                ← Composants React (Hero, Section, AdSlot, …)
    ├── auth.js               ← Firebase Auth (5 méthodes)
    ├── profile.js            ← Profils Supabase + avatars
    ├── comments.js           ← Commentaires + modération
    ├── moderation.js         ← Anti-spam + profanité
    ├── ui-store.js           ← Favoris / historique / toasts
    └── logger.js             ← Console enrichie (DEBUG_CONSOLE)
```

---

## 🎨 Palette « papier crème »

| Token | Hex | Usage |
|---|---|---|
| `paper-50` | `#fbf8f1` | Fond cartes |
| `paper-100` | `#f5f1e8` | Fond page |
| `paper-300` | `#e0d5b6` | Bord doux |
| `ink-700` | `#1f1d18` | Boutons primaires |
| `ink-500` | `#4a463c` | Texte secondaire |

Polices : **Inter** (corps), **Sora** (titres), **Caveat** (annotations manuscrites).

---

**Version** : 6.0 — *cream/beige editorial + GitHub striping + AdSense ready*
**Admin** : `techsaga.fr@gmail.com`

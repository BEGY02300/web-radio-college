/**
 * Service GitHub API - lecture d'un dépôt public
 * Tous les logs sortent dans la console du navigateur (F12)
 *
 * Stratégie : tente la branche configurée, puis fallback automatique
 * vers la branche par défaut du dépôt (main/master) si 404.
 */
import { logger } from './logger.js';
import { REPO } from './config.js';

const GITHUB_API = 'https://api.github.com';

// Branche effective (peut être corrigée automatiquement si 404)
let effectiveBranch = REPO.branch;
let branchResolved = false;

export const MEDIA_EXTENSIONS = {
  audio: ['mp3','wav','ogg','m4a','flac','aac','opus','weba'],
  video: ['mp4','webm','mov','mkv','avi','m4v','ogv'],
  image: ['webp','jpg','jpeg','png','gif','avif'],
  link:  ['url','txt'],   // fichiers contenant un lien YouTube non répertorié
};
export const ALL_MEDIA_EXT = [...MEDIA_EXTENSIONS.audio, ...MEDIA_EXTENSIONS.video];

export function getMediaType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  if (MEDIA_EXTENSIONS.audio.includes(ext)) return 'audio';
  if (MEDIA_EXTENSIONS.video.includes(ext)) return 'video';
  return null;
}

function getExt(filename) {
  return (filename.split('.').pop() || '').toLowerCase();
}
function getBaseName(filename) {
  const i = filename.lastIndexOf('.');
  return i > 0 ? filename.slice(0, i) : filename;
}
function isImage(filename) {
  return MEDIA_EXTENSIONS.image.includes(getExt(filename));
}
function isLinkFile(filename) {
  return MEDIA_EXTENSIONS.link.includes(getExt(filename));
}

// Convertit un lien YouTube standard en ID
export function extractYouTubeId(url) {
  if (!url) return null;
  const s = String(url).trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

const CACHE_TTL = 5 * 60 * 1000;
const memCache = new Map();
const cacheKey = (path) => `gh:${REPO.owner}/${REPO.repo}@${effectiveBranch}:${path}`;

function getCache(key) {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.t < CACHE_TTL) return mem.v;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t < CACHE_TTL) {
      memCache.set(key, { v, t });
      return v;
    }
  } catch (e) {}
  return null;
}
function setCache(key, value) {
  const payload = { v: value, t: Date.now() };
  memCache.set(key, payload);
  try { sessionStorage.setItem(key, JSON.stringify(payload)); } catch (e) {}
}

function sanitizeSegment(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_.\-/]/g, '').replace(/\.{2,}/g, '.');
}

let lastRequestAt = 0;
async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < 200) await new Promise((r) => setTimeout(r, 200 - elapsed));
  lastRequestAt = Date.now();
}

async function ghFetch(url) {
  await throttle();
  logger.api('GET ' + url);
  const t0 = performance.now();
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
  const elapsed = Math.round(performance.now() - t0);
  const remaining = res.headers.get('x-ratelimit-remaining');
  const limit = res.headers.get('x-ratelimit-limit');
  logger.debug(`↳ HTTP ${res.status} en ${elapsed}ms • Rate limit: ${remaining || '?'}/${limit || '?'}`);

  if (res.status === 403) {
    const reset = res.headers.get('x-ratelimit-reset');
    const resetDate = reset ? new Date(+reset * 1000).toLocaleTimeString() : '?';
    throw new Error(`Quota GitHub dépassé. Réinitialisation à ${resetDate}.`);
  }
  if (res.status === 404) {
    const err = new Error('Ressource introuvable (404). Vérifiez le dépôt/branche/chemin.');
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} : ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Résout la branche effective : tente REPO.branch, sinon bascule sur
 * la branche par défaut du dépôt (main/master/...).
 */
async function resolveBranch() {
  if (branchResolved) return effectiveBranch;

  // Étape 1 : tester la branche demandée
  try {
    const url = `${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}/branches/${encodeURIComponent(REPO.branch)}`;
    await ghFetch(url);
    effectiveBranch = REPO.branch;
    branchResolved = true;
    logger.success(`🌿 Branche "${REPO.branch}" trouvée sur le dépôt`);
    return effectiveBranch;
  } catch (e) {
    if (e.status !== 404) throw e;
    logger.warn(`⚠️ Branche "${REPO.branch}" introuvable — recherche de la branche par défaut…`);
  }

  // Étape 2 : fallback sur la branche par défaut du dépôt
  try {
    const repoInfo = await ghFetch(`${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}`);
    effectiveBranch = repoInfo.default_branch || 'main';
    branchResolved = true;
    logger.success(`🌿 Fallback : utilisation de la branche par défaut "${effectiveBranch}"`);
    logger.warn(`👉 Astuce : modifiez js/config.js → REPO.branch = "${effectiveBranch}" pour éviter ce fallback`);
    return effectiveBranch;
  } catch (e) {
    logger.error(`❌ Impossible de résoudre la branche : ${e.message}`);
    throw new Error(`Dépôt introuvable ou privé : ${REPO.owner}/${REPO.repo}`);
  }
}

export function getEffectiveBranch() {
  return effectiveBranch;
}

/**
 * Liste le contenu d'un dossier du dépôt.
 * @param {string} path - chemin relatif à la racine du dépôt (ex: "medias" ou "medias/podcasts")
 */
export async function listContents(path = REPO.rootPath) {
  path = sanitizeSegment(path);

  // Résolution paresseuse de la branche
  await resolveBranch();

  const key = cacheKey(path);
  const cached = getCache(key);
  if (cached) {
    logger.debug(`⚡ Cache HIT : ${path || '/'} (${cached.folders.length} dossiers, ${cached.files.length} médias)`);
    return cached;
  }

  logger.info(`📂 Exploration du dossier : ${path || '/'} (branche ${effectiveBranch})`);
  const url = `${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}/contents/${path}?ref=${encodeURIComponent(effectiveBranch)}`;
  let data;
  try {
    data = await ghFetch(url);
  } catch (e) {
    if (e.status === 404 && path === REPO.rootPath) {
      logger.warn(`⚠️ Dossier racine "${path}" introuvable sur "${effectiveBranch}" — tentative à la racine du dépôt…`);
      // Fallback : lister la racine du dépôt
      const rootUrl = `${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}/contents/?ref=${encodeURIComponent(effectiveBranch)}`;
      data = await ghFetch(rootUrl);
      logger.warn(`👉 Créez un dossier "${REPO.rootPath}" dans votre dépôt, ou modifiez js/config.js → REPO.rootPath`);
    } else {
      throw e;
    }
  }
  if (!Array.isArray(data)) throw new Error('Le chemin pointe vers un fichier, pas un dossier.');

  const folders = [];
  const mediaItems = []; // audio/vidéo/lien YouTube
  const imagesByBaseName = {}; // ex: 'episode01' -> {name, downloadUrl}
  const linksByBaseName = {};  // .url ou .txt avec lien YouTube
  const ignoredFiles = [];

  // 1ère passe : indexer covers et fichiers de liens
  for (const item of data) {
    if (item.type !== 'file') continue;
    if (isImage(item.name)) {
      imagesByBaseName[getBaseName(item.name).toLowerCase()] = {
        name: item.name, path: item.path,
        downloadUrl: item.download_url,
      };
    } else if (isLinkFile(item.name)) {
      linksByBaseName[getBaseName(item.name).toLowerCase()] = {
        name: item.name, path: item.path,
        downloadUrl: item.download_url,
      };
    }
  }

  // 2ème passe : dossiers + fichiers média (avec association cover/lien)
  for (const item of data) {
    if (item.type === 'dir') {
      folders.push({ name: item.name, path: item.path, sha: item.sha });
    } else if (item.type === 'file') {
      const mediaType = getMediaType(item.name);
      if (mediaType) {
        const base = getBaseName(item.name).toLowerCase();
        const cover = imagesByBaseName[base] || null;
        mediaItems.push({
          name: item.name,
          path: item.path,
          size: item.size,
          sha: item.sha,
          mediaType,
          downloadUrl: item.download_url,
          htmlUrl: item.html_url,
          cover: cover ? cover.downloadUrl : null,
          coverName: cover ? cover.name : null,
        });
      } else if (!isImage(item.name) && !isLinkFile(item.name)) {
        ignoredFiles.push(item.name);
      }
    }
  }

  // 3ème passe : pour chaque fichier .url/.txt orphelin (sans média associé),
  //              télécharger son contenu pour voir si c'est un lien YouTube
  const youTubeFetches = [];
  for (const [base, link] of Object.entries(linksByBaseName)) {
    // Si déjà associé à un média (même nom), on ne crée pas d'entrée
    const hasMedia = mediaItems.some((m) => getBaseName(m.name).toLowerCase() === base);
    if (hasMedia) continue;
    youTubeFetches.push(
      fetch(link.downloadUrl)
        .then((r) => r.text())
        .then((text) => {
          const ytId = extractYouTubeId(text);
          if (ytId) {
            const cover = imagesByBaseName[base] || null;
            mediaItems.push({
              name: link.name.replace(/\.(url|txt)$/i, ''),
              path: link.path,
              size: 0,
              sha: link.path,
              mediaType: 'youtube',
              youTubeId: ytId,
              downloadUrl: `https://www.youtube.com/watch?v=${ytId}`,
              cover: cover ? cover.downloadUrl : null,
              coverName: cover ? cover.name : null,
            });
            logger.info(`▶ YouTube détecté : "${link.name}" → ${ytId}`);
          }
        })
        .catch((e) => logger.warn(`Lecture impossible de ${link.name}`, { err: e.message }))
    );
  }
  if (youTubeFetches.length) await Promise.all(youTubeFetches);

  folders.sort((a,b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));
  mediaItems.sort((a,b) => a.name.localeCompare(b.name, 'fr', { numeric: true }));

  // Tableau récapitulatif dans la console
  const audioCount = mediaItems.filter((f) => f.mediaType === 'audio').length;
  const videoCount = mediaItems.filter((f) => f.mediaType === 'video').length;
  const ytCount    = mediaItems.filter((f) => f.mediaType === 'youtube').length;
  const coverCount = mediaItems.filter((f) => f.cover).length;

  logger.group(`📊 Résultat pour "${path || '/'}"`, () => {
    console.log(`  📁 ${folders.length} dossier(s) trouvé(s)`);
    console.log(`  🎵 ${audioCount} audio • 🎬 ${videoCount} vidéo • ▶ ${ytCount} YouTube`);
    console.log(`  🖼️  ${coverCount} cover(s) associée(s) automatiquement`);
    if (ignoredFiles.length) console.log(`  ⏭️  ${ignoredFiles.length} fichier(s) ignoré(s) :`, ignoredFiles);
    if (folders.length) console.table(folders.map((f) => ({ nom: f.name, chemin: f.path })));
    if (mediaItems.length) console.table(mediaItems.map((f) => ({
      nom: f.name, type: f.mediaType, cover: f.coverName || '—', taille_ko: Math.round((f.size||0)/1024),
    })));
  });

  const result = { folders, files: mediaItems, total: data.length, ignored: ignoredFiles.length };
  setCache(key, result);
  logger.success(`✓ ${folders.length} dossier(s) + ${mediaItems.length} média(s)`, { path: path || '/' });
  return result;
}

export async function getRepoInfo() {
  const key = cacheKey('__info__');
  const cached = getCache(key);
  if (cached) return cached;
  const data = await ghFetch(`${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}`);
  const info = {
    defaultBranch: data.default_branch,
    description: data.description,
    stargazers: data.stargazers_count,
    htmlUrl: data.html_url,
    private: data.private,
  };
  setCache(key, info);
  return info;
}

export function humanFileSize(bytes) {
  if (!bytes && bytes !== 0) return '–';
  const units = ['o','Ko','Mo','Go','To'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

// Identifiant stable pour une resource média (utilisé comme clé pour les commentaires)
export function mediaId(file) {
  return `${REPO.owner}/${REPO.repo}/${effectiveBranch}/${file.path}`;
}

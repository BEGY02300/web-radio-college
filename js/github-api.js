/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  SERVICE GITHUB API — Web Radio Collège v6                         ║
 * ║  + Support MULTI-DÉPÔTS (striping) pour héberger jusqu'à 100 Go    ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║  Lecture de dépôts PUBLICS, sans token, sans backend.              ║
 * ║   • Cache mémoire + sessionStorage (TTL 5 min) PAR dépôt           ║
 * ║   • Throttling 200 ms entre requêtes                               ║
 * ║   • Fallback automatique de branche                                ║
 * ║   • Détection automatique des covers (même nom, ext image)         ║
 * ║   • Support des fichiers YouTube via .url / .txt                   ║
 * ║   • Listing PARALLÈLE de tous les dépôts d'une section,            │
 * ║     puis fusion + tri unifié.                                      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */
import { logger } from './logger.js';
import { REPO, REPO_POOL, reposForSection } from './config.js';

const GITHUB_API = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

// Extensions reconnues
const AUDIO_EXT = ['mp3', 'm4a', 'ogg', 'wav', 'flac', 'aac', 'opus'];
const VIDEO_EXT = ['mp4', 'webm', 'mov', 'mkv', 'm4v'];
const IMAGE_EXT = ['webp', 'jpg', 'jpeg', 'png', 'gif', 'avif'];
const YT_EXT    = ['url', 'txt'];

const ALL_MEDIA_EXT = [...AUDIO_EXT, ...VIDEO_EXT, ...YT_EXT];

function getExt(name) {
  const m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}
function getBaseName(name) {
  return String(name).replace(/\.[^.]+$/, '');
}
export function getMediaType(filename) {
  const ext = getExt(filename);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (YT_EXT.includes(ext))    return 'youtube';
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// CACHE (mémoire + sessionStorage) — clé incluant le dépôt
// ═══════════════════════════════════════════════════════════════════
const CACHE_TTL_MS = 5 * 60 * 1000;
const memCache = new Map();

function cacheKey(repoCfg, path) {
  return `gh:${repoCfg.owner}/${repoCfg.repo}@${repoCfg.branch}:${path}`;
}
function getCache(repoCfg, path) {
  const k = cacheKey(repoCfg, path);
  if (memCache.has(k)) {
    const v = memCache.get(k);
    if (Date.now() - v.t < CACHE_TTL_MS) return v.data;
  }
  try {
    const raw = sessionStorage.getItem(k);
    if (raw) {
      const v = JSON.parse(raw);
      if (Date.now() - v.t < CACHE_TTL_MS) {
        memCache.set(k, v);
        return v.data;
      }
    }
  } catch (e) {}
  return null;
}
function setCache(repoCfg, path, data) {
  const k = cacheKey(repoCfg, path);
  const v = { t: Date.now(), data };
  memCache.set(k, v);
  try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}
export function clearCache() {
  memCache.clear();
  try {
    Object.keys(sessionStorage).forEach((k) => { if (k.startsWith('gh:')) sessionStorage.removeItem(k); });
  } catch (e) {}
  logger.info('🗑️ Cache GitHub vidé');
}

// ═══════════════════════════════════════════════════════════════════
// THROTTLE GLOBAL
// ═══════════════════════════════════════════════════════════════════
let lastReq = 0;
async function throttle(min = 200) {
  const wait = lastReq + min - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
}

function sanitizeSegment(s) { return String(s || '').replace(/^\/+|\/+$/g, '').replace(/\\/g, '/'); }

// ═══════════════════════════════════════════════════════════════════
// FETCH GÉNÉRIQUE
// ═══════════════════════════════════════════════════════════════════
async function ghFetch(url) {
  await throttle();
  const t0 = performance.now();
  logger.api(`GET ${url}`);
  let res;
  try { res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } }); }
  catch (e) { logger.error('Erreur réseau', { err: e.message }); throw new Error('Erreur réseau (vérifiez votre connexion)'); }
  const dt = Math.round(performance.now() - t0);
  const remaining = res.headers.get('x-ratelimit-remaining');
  const limit     = res.headers.get('x-ratelimit-limit');
  logger.debug(`↳ HTTP ${res.status} en ${dt}ms${remaining ? ` • Rate limit: ${remaining}/${limit}` : ''}`);

  if (res.status === 403) {
    const reset = res.headers.get('x-ratelimit-reset');
    const min = reset ? Math.max(1, Math.ceil((+reset * 1000 - Date.now()) / 60000)) : 60;
    throw new Error(`Quota GitHub dépassé (60/h). Patientez ~${min} min.`);
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} sur ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════
// RÉSOLUTION DE BRANCHE PAR DÉPÔT (fallback automatique)
// ═══════════════════════════════════════════════════════════════════
const branchCache = new Map();
async function resolveBranchFor(repoCfg) {
  const key = `${repoCfg.owner}/${repoCfg.repo}@${repoCfg.branch}`;
  if (branchCache.has(key)) return branchCache.get(key);
  // 1) Tester la branche configurée
  try {
    await ghFetch(`${GITHUB_API}/repos/${repoCfg.owner}/${repoCfg.repo}/branches/${repoCfg.branch}`);
    logger.success(`🌿 ${repoCfg.owner}/${repoCfg.repo} → branche "${repoCfg.branch}" trouvée`);
    branchCache.set(key, repoCfg.branch);
    return repoCfg.branch;
  } catch (e) {
    if (e.status !== 404) throw e;
    logger.warn(`⚠️ ${repoCfg.repo}: branche "${repoCfg.branch}" introuvable — recherche du défaut…`);
  }
  // 2) Fallback : branche par défaut
  const info = await ghFetch(`${GITHUB_API}/repos/${repoCfg.owner}/${repoCfg.repo}`);
  const fallback = info.default_branch || 'main';
  branchCache.set(key, fallback);
  logger.warn(`👉 ${repoCfg.repo}: fallback → "${fallback}"`);
  return fallback;
}

// ═══════════════════════════════════════════════════════════════════
// LISTING D'UN DOSSIER POUR UN DÉPÔT DONNÉ
// ═══════════════════════════════════════════════════════════════════
async function listContentsForRepo(repoCfg, path) {
  path = sanitizeSegment(path) || repoCfg.rootPath;
  const cached = getCache(repoCfg, path);
  if (cached) {
    logger.debug(`📦 Cache HIT ${repoCfg.repo}:${path}`, { folders: cached.folders.length, files: cached.files.length });
    return cached;
  }

  const branch = await resolveBranchFor(repoCfg);
  let raw;
  try {
    raw = await ghFetch(`${GITHUB_API}/repos/${repoCfg.owner}/${repoCfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`);
  } catch (e) {
    if (e.status === 404) {
      logger.warn(`📭 ${repoCfg.repo} : dossier "${path}" introuvable sur ${branch}`);
      const empty = { folders: [], files: [], total: 0, ignored: 0, missing: true, repo: repoCfg };
      setCache(repoCfg, path, empty);
      return empty;
    }
    throw e;
  }

  if (!Array.isArray(raw)) raw = [raw];

  const folders = [];
  const mediaItems = [];
  const imagesByBase = {};
  let ignored = 0;

  raw.forEach((item) => {
    if (item.type === 'dir') {
      folders.push({
        type: 'dir', name: item.name, path: item.path, sha: item.sha, url: item.html_url,
        _repo: repoCfg,
      });
    } else if (item.type === 'file') {
      const ext = getExt(item.name);
      const mediaType = getMediaType(item.name);
      const downloadUrl = item.download_url
        || `${RAW_BASE}/${repoCfg.owner}/${repoCfg.repo}/${branch}/${encodeURIComponent(item.path).replace(/%2F/g, '/')}`;
      if (mediaType) {
        mediaItems.push({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size || 0,
          ext,
          mediaType,
          downloadUrl,
          rawApi: item.url,
          baseName: getBaseName(item.name),
          // Info de provenance (utile UI / debug)
          _repo: { owner: repoCfg.owner, repo: repoCfg.repo, branch, label: repoCfg.label || repoCfg.repo },
        });
      } else if (IMAGE_EXT.includes(ext)) {
        const base = getBaseName(item.name);
        imagesByBase[base] = downloadUrl;
      } else {
        ignored++;
      }
    }
  });

  // Associer covers
  let coverCount = 0;
  mediaItems.forEach((m) => {
    if (imagesByBase[m.baseName]) { m.cover = imagesByBase[m.baseName]; m.coverName = m.baseName; coverCount++; }
  });

  // Résoudre YouTube IDs
  const ytFiles = mediaItems.filter((m) => m.mediaType === 'youtube');
  if (ytFiles.length) {
    await Promise.all(ytFiles.map(async (yt) => {
      try {
        const txt = await fetch(yt.downloadUrl).then((r) => r.text());
        const id = extractYouTubeId(txt);
        if (id) { yt.youTubeId = id; yt.downloadUrl = `https://youtu.be/${id}`; }
        else    { yt.youTubeId = null; yt.error = 'Lien YouTube invalide'; }
      } catch (e) { yt.error = e.message; }
    }));
  }

  folders.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  mediaItems.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const result = { folders, files: mediaItems, total: folders.length + mediaItems.length, ignored, repo: repoCfg };
  setCache(repoCfg, path, result);
  logger.success(`✓ ${repoCfg.repo}: ${folders.length} dossier(s) + ${mediaItems.length} média(s)`, { path });
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// LISTING UNIFIÉ — interroge TOUS les dépôts du pool en parallèle
// ═══════════════════════════════════════════════════════════════════
//   sectionId : 'podcasts' | 'reportages' | 'videos' | undefined
//   path      : chemin RELATIF à rootPath ('podcasts', 'podcasts/saison-1', …)
//
//   ⚠️ Comme chaque dépôt peut avoir son propre rootPath, on construit
//      le chemin complet pour chacun.
// ═══════════════════════════════════════════════════════════════════
export async function listContents(path = REPO.rootPath, sectionId = null) {
  const repos = sectionId ? reposForSection(sectionId)
                          : (REPO_POOL && REPO_POOL.length ? REPO_POOL : [REPO]);

  // Si path est juste rootPath (page de section), on liste rootPath/<sectionFolder> dans chaque dépôt.
  // Sinon path est déjà absolu (sous-dossier), on l'utilise tel quel pour le dépôt PRINCIPAL.
  // Pour l'agrégation : on se base sur le suffixe relatif au rootPath du repo principal.
  const mainRoot = REPO.rootPath || 'medias';
  const rel = path.startsWith(mainRoot)
    ? path.slice(mainRoot.length).replace(/^\/+/, '')
    : path;

  const settled = await Promise.allSettled(
    repos.map((rc) => {
      const fullPath = rel ? `${rc.rootPath}/${rel}` : rc.rootPath;
      return listContentsForRepo(rc, fullPath);
    })
  );

  // Fusionner les résultats
  const folders = [];
  const files = [];
  let ignored = 0;
  let missingAll = true;
  const errors = [];

  settled.forEach((s, idx) => {
    if (s.status === 'fulfilled') {
      const r = s.value;
      if (!r.missing) missingAll = false;
      folders.push(...r.folders);
      files.push(...r.files);
      ignored += r.ignored || 0;
    } else {
      errors.push({ repo: repos[idx], error: s.reason });
      logger.error(`Erreur dépôt ${repos[idx].repo}`, { msg: s.reason && s.reason.message });
    }
  });

  // Dédupliquer dossiers (même nom dans plusieurs dépôts → un seul)
  const seenDirs = new Set();
  const mergedFolders = folders.filter((f) => {
    if (seenDirs.has(f.name)) return false;
    seenDirs.add(f.name);
    return true;
  });

  // Tri global
  mergedFolders.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  files.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const audioCount = files.filter((m) => m.mediaType === 'audio').length;
  const videoCount = files.filter((m) => m.mediaType === 'video').length;
  const ytCount    = files.filter((m) => m.mediaType === 'youtube').length;

  console.groupCollapsed(`%c📊 [POOL] Résultat unifié pour "${path}" (section: ${sectionId || '—'})`, 'color:#0ea5e9;font-weight:600');
  console.log(`  🧱 ${repos.length} dépôt(s) interrogé(s)`);
  console.log(`  📁 ${mergedFolders.length} dossier(s) — 🎵 ${audioCount} audio • 🎬 ${videoCount} vidéo • ▶ ${ytCount} YouTube`);
  if (errors.length) console.log(`  ❌ ${errors.length} dépôt(s) en erreur`);
  console.groupEnd();

  return {
    folders: mergedFolders,
    files,
    total: mergedFolders.length + files.length,
    ignored,
    missing: missingAll,
    repos,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════════════
// LISTING RÉCURSIF (recherche globale)
// ═══════════════════════════════════════════════════════════════════
export async function listContentsRecursive(path = REPO.rootPath, maxDepth = 3, sectionId = null) {
  const out = { folders: [], files: [] };
  async function walk(p, depth) {
    if (depth > maxDepth) return;
    const r = await listContents(p, sectionId);
    out.folders.push(...r.folders.map((f) => ({ ...f, _parent: p })));
    out.files.push(...r.files.map((f) => ({ ...f, _parent: p })));
    for (const sub of r.folders) {
      await walk(sub.path, depth + 1);
    }
  }
  await walk(path, 0);
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// EXTRACTION D'ID YOUTUBE
// ═══════════════════════════════════════════════════════════════════
function extractYouTubeId(text) {
  if (!text) return null;
  const t = String(text).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(t)) return t;
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return m[1];
  }
  const lineMatch = t.match(/URL\s*=\s*([^\r\n]+)/i);
  if (lineMatch) return extractYouTubeId(lineMatch[1]);
  return null;
}

// ═══════════════════════════════════════════════════════════════════
// FORMAT TAILLE
// ═══════════════════════════════════════════════════════════════════
export function humanFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const u = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0; let n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

// ═══════════════════════════════════════════════════════════════════
// MEDIA ID STABLE (pour Supabase) — inclut le dépôt d'origine
// ═══════════════════════════════════════════════════════════════════
export function mediaId(file) {
  const r = file._repo || REPO;
  return `${r.owner}/${r.repo}@${r.branch}:${file.path}`;
}

import { logger } from './logger.js';
import { REPO } from './config.js';

const GITHUB_API = 'https://api.github.com';

export const MEDIA_EXTENSIONS = {
  audio: ['mp3','wav','ogg','m4a','flac','aac','opus','weba'],
  video: ['mp4','webm','mov','mkv','avi','m4v','ogv'],
};

export function getMediaType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  if (MEDIA_EXTENSIONS.audio.includes(ext)) return 'audio';
  if (MEDIA_EXTENSIONS.video.includes(ext)) return 'video';
  return null;
}

const CACHE_TTL = 5 * 60 * 1000;
const memCache = new Map();
const cacheKey = (path) => `gh:${REPO.owner}/${REPO.repo}@${REPO.branch}:${path}`;

function getCache(key) {
  const mem = memCache.get(key);
  if (mem && Date.now() - mem.t < CACHE_TTL) return mem.v;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t < CACHE_TTL) { memCache.set(key, { v, t }); return v; }
  } catch (e) {}
  return null;
}
function setCache(key, value) {
  memCache.set(key, { v: value, t: Date.now() });
  try { sessionStorage.setItem(key, JSON.stringify({ v: value, t: Date.now() })); } catch (e) {}
}
function sanitize(s) { return String(s || '').replace(/[^a-zA-Z0-9_.\-/]/g, '').replace(/\.{2,}/g, '.'); }

let lastAt = 0;
async function throttle() {
  const e = Date.now() - lastAt;
  if (e < 200) await new Promise((r) => setTimeout(r, 200 - e));
  lastAt = Date.now();
}

async function ghFetch(url) {
  await throttle();
  logger.api('GET ' + url);
  const t0 = performance.now();
  const res = await fetch(url, { headers: { 'Accept': 'application/vnd.github+json' } });
  logger.debug(`↳ HTTP ${res.status} en ${Math.round(performance.now()-t0)}ms • Rate: ${res.headers.get('x-ratelimit-remaining')||'?'}/${res.headers.get('x-ratelimit-limit')||'?'}`);
  if (res.status === 403) throw new Error('Quota GitHub dépassé.');
  if (res.status === 404) throw new Error('Ressource introuvable (404).');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listContents(path = REPO.rootPath) {
  path = sanitize(path);
  const key = cacheKey(path);
  const cached = getCache(key);
  if (cached) { logger.debug(`⚡ Cache HIT : ${path}`); return cached; }
  logger.info(`📂 Exploration : ${path || '/'}`);
  const url = `${GITHUB_API}/repos/${REPO.owner}/${REPO.repo}/contents/${path}?ref=${encodeURIComponent(REPO.branch)}`;
  const data = await ghFetch(url);
  if (!Array.isArray(data)) throw new Error('Le chemin est un fichier, pas un dossier.');
  const folders = [], files = [], ignored = [];
  for (const item of data) {
    if (item.type === 'dir') folders.push({ name: item.name, path: item.path, sha: item.sha });
    else if (item.type === 'file') {
      const mt = getMediaType(item.name);
      if (mt) files.push({ name: item.name, path: item.path, size: item.size, sha: item.sha, mediaType: mt, downloadUrl: item.download_url });
      else ignored.push(item.name);
    }
  }
  folders.sort((a,b) => a.name.localeCompare(b.name));
  files.sort((a,b) => a.name.localeCompare(b.name));
  logger.group(`📊 Résultat "${path || '/'}"`, () => {
    console.log(`  📁 ${folders.length} dossier(s) • 🎬 ${files.length} média(s) • ⏭️ ${ignored.length} ignoré(s)`);
    if (folders.length) console.table(folders.map(f => ({ nom: f.name, chemin: f.path })));
    if (files.length) console.table(files.map(f => ({ nom: f.name, type: f.mediaType, taille_ko: Math.round(f.size/1024) })));
  });
  const result = { folders, files, total: data.length };
  setCache(key, result);
  logger.success(`✓ ${folders.length} dossier(s) + ${files.length} média(s)`);
  return result;
}

export function humanFileSize(bytes) {
  if (!bytes && bytes !== 0) return '–';
  const units = ['o','Ko','Mo','Go','To'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function mediaId(file) {
  return `${REPO.owner}/${REPO.repo}/${REPO.branch}/${file.path}`;
}

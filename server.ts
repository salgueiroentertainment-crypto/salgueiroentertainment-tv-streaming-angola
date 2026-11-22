import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { once } from 'node:events';
import { resolveMx } from 'node:dns/promises';
import { GoogleGenAI } from '@google/genai';

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'throwawaymail.com',
  'fakeinbox.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'example.com',
  'example.org',
  'test.com',
  'teste.com',
  'fake.com',
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MEDIA_VAULT_DIR = path.resolve(__dirname, 'media_vault');
const MEDIA_VIDEOS_DIR = path.join(MEDIA_VAULT_DIR, 'videos');
const MEDIA_IMAGES_DIR = path.join(MEDIA_VAULT_DIR, 'images');
const MEDIA_SUBTITLES_DIR = path.join(MEDIA_VAULT_DIR, 'subtitles');
const MEDIA_CHUNKS_DIR = path.join(MEDIA_VAULT_DIR, '.chunks');
const DOMAIN_CONFIG_PATH = path.join(MEDIA_VAULT_DIR, 'domain-config.json');
const CATALOG_MOVIES_PATH = path.join(MEDIA_VAULT_DIR, 'catalog-movies.json');
const CHANNEL_LOGOS_PATH = path.join(MEDIA_VAULT_DIR, 'channel-logos.json');
const MOVIE_ARTWORKS_PATH = path.join(MEDIA_VAULT_DIR, 'movie-artworks.json');

interface ServerMediaDomainConfig {
  customDomain: string;
  displayLabel: string;
  streamingEnabled: boolean;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_DOMAIN_CONFIG: ServerMediaDomainConfig = {
  customDomain: 'media.salgueirostreaming.ao',
  displayLabel: 'Salgueiro Media Cloud Angola',
  streamingEnabled: true,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Salgueiro Araujo',
};

function ensureMediaVaultDirs() {
  fs.mkdirSync(MEDIA_VIDEOS_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_IMAGES_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_SUBTITLES_DIR, { recursive: true });
  fs.mkdirSync(MEDIA_CHUNKS_DIR, { recursive: true });
  if (!fs.existsSync(DOMAIN_CONFIG_PATH)) {
    fs.writeFileSync(DOMAIN_CONFIG_PATH, JSON.stringify(DEFAULT_DOMAIN_CONFIG, null, 2), 'utf8');
  }
  if (!fs.existsSync(CATALOG_MOVIES_PATH)) {
    fs.writeFileSync(CATALOG_MOVIES_PATH, JSON.stringify([], null, 2), 'utf8');
  }
  if (!fs.existsSync(CHANNEL_LOGOS_PATH)) {
    fs.writeFileSync(CHANNEL_LOGOS_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
  if (!fs.existsSync(MOVIE_ARTWORKS_PATH)) {
    fs.writeFileSync(MOVIE_ARTWORKS_PATH, JSON.stringify({}, null, 2), 'utf8');
  }
}

async function cleanupOrphanedUploadChunks(maxAgeMs = 24 * 60 * 60 * 1000) {
  try {
    const entries = await fs.promises.readdir(MEDIA_CHUNKS_DIR).catch(() => []);
    const cutoff = Date.now() - maxAgeMs;
    for (const entry of entries) {
      const full = path.join(MEDIA_CHUNKS_DIR, entry);
      const st = await fs.promises.stat(full).catch(() => null);
      if (st && st.isFile() && st.mtimeMs < cutoff) {
        await fs.promises.unlink(full).catch(() => {});
      }
    }
  } catch {
    // non-fatal background cleanup
  }
}

function readServerCatalogMovies(): any[] {
  ensureMediaVaultDirs();
  try {
    const raw = fs.readFileSync(CATALOG_MOVIES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeServerCatalogMovies(items: any[]): void {
  ensureMediaVaultDirs();
  fs.writeFileSync(CATALOG_MOVIES_PATH, JSON.stringify(items, null, 2), 'utf8');
}

function readServerChannelLogos(): Record<string, string> {
  ensureMediaVaultDirs();
  try {
    const raw = fs.readFileSync(CHANNEL_LOGOS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeServerChannelLogos(logos: Record<string, string>): void {
  ensureMediaVaultDirs();
  fs.writeFileSync(CHANNEL_LOGOS_PATH, JSON.stringify(logos, null, 2), 'utf8');
}

export interface ServerMovieArtworkEntry {
  thumbnailUrl: string;
  bannerUrl: string;
  originalTitle?: string;
  source?: string;
}

function readServerMovieArtworks(): Record<string, ServerMovieArtworkEntry> {
  ensureMediaVaultDirs();
  try {
    const raw = fs.readFileSync(MOVIE_ARTWORKS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeServerMovieArtworks(artworks: Record<string, ServerMovieArtworkEntry>): void {
  ensureMediaVaultDirs();
  fs.writeFileSync(MOVIE_ARTWORKS_PATH, JSON.stringify(artworks, null, 2), 'utf8');
}

function safeDecodeUriComponent(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function readDomainConfig(): ServerMediaDomainConfig {
  ensureMediaVaultDirs();
  try {
    const raw = fs.readFileSync(DOMAIN_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      customDomain: typeof parsed.customDomain === 'string' && parsed.customDomain.trim()
        ? parsed.customDomain.trim()
        : DEFAULT_DOMAIN_CONFIG.customDomain,
      displayLabel: typeof parsed.displayLabel === 'string' && parsed.displayLabel.trim()
        ? parsed.displayLabel.trim()
        : DEFAULT_DOMAIN_CONFIG.displayLabel,
      streamingEnabled: parsed.streamingEnabled !== false,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : 'admin',
    };
  } catch {
    return { ...DEFAULT_DOMAIN_CONFIG };
  }
}

function writeDomainConfig(config: Partial<ServerMediaDomainConfig>): ServerMediaDomainConfig {
  const current = readDomainConfig();
  const next: ServerMediaDomainConfig = {
    customDomain: (config.customDomain ?? current.customDomain)
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '') || DEFAULT_DOMAIN_CONFIG.customDomain,
    displayLabel: (config.displayLabel ?? current.displayLabel).trim() || DEFAULT_DOMAIN_CONFIG.displayLabel,
    streamingEnabled: config.streamingEnabled ?? current.streamingEnabled,
    updatedAt: new Date().toISOString(),
    updatedBy: (config.updatedBy ?? current.updatedBy).trim() || 'admin',
  };
  fs.writeFileSync(DOMAIN_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function sanitizeMediaFolder(raw: unknown): 'videos' | 'images' | 'subtitles' {
  if (raw === 'images') return 'images';
  if (raw === 'subtitles') return 'subtitles';
  return 'videos';
}

function sanitizeFilename(raw: string): string {
  const base = path.basename(raw || 'media.mp4').trim();
  const ext = path.extname(base).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.mp4';
  const nameWithoutExt = base.slice(0, base.length - path.extname(base).length);
  const safeStem = nameWithoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'filme';
  return `${safeStem}${ext}`;
}

function getMimeTypeForFile(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
    case '.mpeg4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.mov':
      return 'video/quicktime';
    case '.avi':
      return 'video/x-msvideo';
    case '.mpg':
    case '.mpeg':
      return 'video/mpeg';
    case '.ts':
    case '.m2ts':
      return 'video/mp2t';
    case '.flv':
      return 'video/x-flv';
    case '.m3u8':
      return 'application/vnd.apple.mpegurl';
    case '.vtt':
      return 'text/vtt; charset=utf-8';
    case '.srt':
      return 'application/x-subrip; charset=utf-8';
    case '.mp3':
      return 'audio/mpeg';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function stripTimestampPrefix(filename: string): string {
  return path.basename(filename).replace(/^\d{10,}_/, '');
}

function normalizeVaultMatchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isHiddenOrSidecarVaultEntry(name: string): boolean {
  return (
    name.startsWith('.') ||
    name.endsWith('.meta.json') ||
    name.endsWith('.probe.json') ||
    name.includes('.faststart.')
  );
}

interface MatchedVaultVideo {
  filename: string;
  fullPath: string;
  streamPath: string;
  size: number;
  mimeType: string;
  matchReason: 'exact' | 'exact-stem' | 'tokens' | 'fuzzy';
  score: number;
}

function findMatchingVaultVideoFile(hint: string, allowFuzzy = true): MatchedVaultVideo | null {
  const cleanHint = safeDecodeUriComponent(String(hint || '')).trim();
  if (!cleanHint || !fs.existsSync(MEDIA_VIDEOS_DIR)) return null;

  let extractedBase = cleanHint;
  if (cleanHint.includes('/')) {
    try {
      const p = cleanHint.startsWith('http')
        ? new URL(cleanHint).pathname
        : cleanHint.split('?')[0];
      extractedBase = path.basename(p);
    } catch {
      extractedBase = path.basename(cleanHint);
    }
  }

  const hintLower = path.basename(extractedBase).toLowerCase();
  const hintStem = stripTimestampPrefix(extractedBase);
  const hintStemLower = hintStem.toLowerCase();
  const hintSanitizedStem = stripTimestampPrefix(sanitizeFilename(extractedBase)).toLowerCase();
  const hintNoExtNorm = normalizeVaultMatchText(hintStem.replace(/\.[^/.]+$/, ''));
  const hintTokens = hintNoExtNorm.split(/\s+/).filter((t) => t.length >= 2);

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(MEDIA_VIDEOS_DIR).filter((n) => !isHiddenOrSidecarVaultEntry(n));
  } catch {
    return null;
  }

  let best: (MatchedVaultVideo & { mtimeMs: number }) | null = null;

  for (const name of entries) {
    const fullPath = path.join(MEDIA_VIDEOS_DIR, name);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size === 0) continue;

    const nameLower = name.toLowerCase();
    const fileStemLower = stripTimestampPrefix(name).toLowerCase();
    const fileNoExtNorm = normalizeVaultMatchText(
      stripTimestampPrefix(name).replace(/\.[^/.]+$/, '')
    );

    let score = 0;
    let matchReason: MatchedVaultVideo['matchReason'] | null = null;

    if (nameLower === hintLower) {
      score = 1000;
      matchReason = 'exact';
    } else if (
      hintStemLower &&
      (fileStemLower === hintStemLower || (hintSanitizedStem && fileStemLower === hintSanitizedStem))
    ) {
      score = 950;
      matchReason = 'exact-stem';
    } else if (allowFuzzy && hintNoExtNorm.length >= 3) {
      if (fileNoExtNorm === hintNoExtNorm) {
        score = 900;
        matchReason = 'tokens';
      } else if (hintTokens.length > 0) {
        const fileTokenSet = new Set(fileNoExtNorm.split(/\s+/).filter((t) => t.length >= 2));
        let matchedCount = 0;
        for (const tok of hintTokens) {
          if (fileTokenSet.has(tok) || fileNoExtNorm.includes(tok)) {
            matchedCount++;
          }
        }
        const coverage = matchedCount / hintTokens.length;
        if (coverage === 1) {
          score = 840 + Math.min(50, hintTokens.length * 10);
          matchReason = 'tokens';
        } else if (coverage >= 0.65 && matchedCount >= 2) {
          score = Math.round(620 + coverage * 150);
          matchReason = 'fuzzy';
        }
      }
    }

    if (score > 0 && matchReason) {
      if (
        !best ||
        score > best.score ||
        (score === best.score && stat.mtimeMs > best.mtimeMs)
      ) {
        best = {
          filename: name,
          fullPath,
          streamPath: `/stream/media/videos/${encodeURIComponent(name)}`,
          size: stat.size,
          mimeType: getMimeTypeForFile(name),
          matchReason,
          score,
          mtimeMs: stat.mtimeMs,
        };
      }
    }
  }

  if (!best) return null;
  return {
    filename: best.filename,
    fullPath: best.fullPath,
    streamPath: best.streamPath,
    size: best.size,
    mimeType: best.mimeType,
    matchReason: best.matchReason,
    score: best.score,
  };
}

function resolveVaultFilePath(folder: string, filename: string): string | null {
  if (folder !== 'videos' && folder !== 'images' && folder !== 'subtitles') return null;
  const cleanName = path.basename(filename);
  if (!cleanName || cleanName.includes('..')) return null;
  const targetDir =
    folder === 'images'
      ? MEDIA_IMAGES_DIR
      : folder === 'subtitles'
        ? MEDIA_SUBTITLES_DIR
        : MEDIA_VIDEOS_DIR;
  const resolved = path.resolve(targetDir, cleanName);
  if (!resolved.startsWith(targetDir + path.sep)) return null;
  return resolved;
}

function unwrapProxyOrTranscodeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/api/proxy?') || trimmed.startsWith('/api/transcode?')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) return inner.trim();
    } catch {
      // ignore
    }
  }
  return trimmed;
}

interface LocalStreamInspection {
  isVaultPath: boolean;
  resolvedPath: string | null;
  exists: boolean;
  resolvedStreamPath?: string;
}

function inspectLocalStreamTarget(rawUrl: string): LocalStreamInspection {
  const trimmed = unwrapProxyOrTranscodeUrl(rawUrl);
  let pathname = trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return { isVaultPath: false, resolvedPath: null, exists: false };
    }
  }
  const match = pathname.match(/^\/(?:stream\/media|api\/media\/stream)\/(videos|images|subtitles)\/([^/?#]+)$/);
  if (!match) {
    return { isVaultPath: false, resolvedPath: null, exists: false };
  }
  const requestedFilename = safeDecodeUriComponent(match[2]);
  const resolved = resolveVaultFilePath(match[1], requestedFilename);
  if (!resolved) {
    return { isVaultPath: true, resolvedPath: null, exists: false };
  }
  if (fs.existsSync(resolved)) {
    return {
      isVaultPath: true,
      resolvedPath: resolved,
      exists: true,
      resolvedStreamPath: `/stream/media/${match[1]}/${encodeURIComponent(path.basename(resolved))}`,
    };
  }
  // Smart stem fallback if file exists in vault under a different timestamp prefix
  if (match[1] === 'videos') {
    const matched = findMatchingVaultVideoFile(requestedFilename, false);
    if (matched) {
      return {
        isVaultPath: true,
        resolvedPath: matched.fullPath,
        exists: true,
        resolvedStreamPath: matched.streamPath,
      };
    }
  }
  return {
    isVaultPath: true,
    resolvedPath: resolved,
    exists: false,
  };
}

function resolveLocalStreamFile(rawUrl: string): string | null {
  const inspected = inspectLocalStreamTarget(rawUrl);
  return inspected.exists ? inspected.resolvedPath : null;
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('stremio://')) {
    return 'https://' + trimmed.slice('stremio://'.length);
  }
  return trimmed;
}

function isSafePublicUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(normalizeExternalUrl(rawUrl));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function rewriteM3U8(content: string, baseUrl: string): string {
  const lines = content.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Rewrite URI="..." attributes inside HLS tags (#EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP, etc.)
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uriValue: string) => {
          try {
            const resolved = new URL(uriValue, baseUrl).toString();
            return `URI="/api/proxy?url=${encodeURIComponent(resolved)}"`;
          } catch {
            return `URI="${uriValue}"`;
          }
        });
      }

      // Rewrite segment or variant playlist URLs
      try {
        const resolved = new URL(trimmed, baseUrl).toString();
        return `/api/proxy?url=${encodeURIComponent(resolved)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

async function startServer() {
  ensureMediaVaultDirs();
  void cleanupOrphanedUploadChunks();
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // CORS helper for API and media streaming routes
  const applyCorsHeaders = (res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Range, X-File-Name, X-File-Folder, X-Upload-Id, X-Chunk-Index, X-Total-Chunks, X-Chunk-Size, X-Total-Size, X-Chunk-Bytes, X-Manual-Finalize, X-Skip-Errors'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length, Content-Type');
  };

  app.use('/api', (req, res, next) => {
    applyCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use('/stream', (req, res, next) => {
    applyCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const remoteProbeCache = new Map<string, { ts: number; result: any }>();
  const findBestResponseCache = new Map<string, { ts: number; payload: any }>();

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      ffmpeg: true,
      mediaDomain: readDomainConfig(),
      server: 'Salgueiro Streaming Media Engine',
    });
  });

  // Fast Stream Warmup Endpoint: primes OS file cache / .probe.json for vault movies OR warms TCP/TLS + head bytes for online streams
  app.get('/api/media/warmup', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ ok: false, error: 'Missing url' });
      return;
    }
    const clean = unwrapProxyOrTranscodeUrl(rawUrl);
    const localInspection = inspectLocalStreamTarget(clean);

    if (localInspection.exists && localInspection.resolvedPath) {
      try {
        // Pre-warm first 256KB into OS page cache + ensure .probe.json exists
        const fh = await fs.promises.open(localInspection.resolvedPath, 'r');
        try {
          const buf = Buffer.allocUnsafe(256 * 1024);
          await fh.read(buf, 0, buf.length, 0);
        } finally {
          await fh.close();
        }
        const probeRes = await probeMediaTarget(localInspection.resolvedStreamPath || clean).catch(() => null);
        res.json({
          ok: true,
          warmed: true,
          local: true,
          streamPath: localInspection.resolvedStreamPath || clean,
          probeInfo: probeRes?.ok ? probeRes.info : null,
        });
        return;
      } catch {
        res.json({ ok: true, warmed: false, local: true });
        return;
      }
    }

    const remote = isSafePublicUrl(clean);
    if (!remote) {
      res.json({ ok: true, warmed: false, local: false });
      return;
    }

    try {
      const check = await probeCandidateStreamUrl(remote.toString());
      res.json({
        ok: true,
        warmed: check.alive,
        local: false,
        latencyMs: check.latencyMs,
        isHls: check.isHls,
        isMpegTs: check.isMpegTs,
      });
    } catch {
      res.json({ ok: true, warmed: false, local: false });
    }
  });

  // Media Storage Domain Config API
  app.get('/api/media/domain-config', (req: Request, res: Response) => {
    const config = readDomainConfig();
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    res.json({
      ...config,
      runtimeOrigin: `${proto}://${host}`,
    });
  });

  app.post('/api/media/domain-config', (req: Request, res: Response) => {
    const { customDomain, displayLabel, streamingEnabled, updatedBy } = req.body || {};
    const saved = writeDomainConfig({
      customDomain: typeof customDomain === 'string' ? customDomain : undefined,
      displayLabel: typeof displayLabel === 'string' ? displayLabel : undefined,
      streamingEnabled: typeof streamingEnabled === 'boolean' ? streamingEnabled : undefined,
      updatedBy: typeof updatedBy === 'string' ? updatedBy : undefined,
    });
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    res.json({
      ...saved,
      runtimeOrigin: `${proto}://${host}`,
    });
  });

  // Server-backed catalog persistence for movies uploaded to the platform domain
  app.get('/api/media/catalog', (_req: Request, res: Response) => {
    res.json({ movies: readServerCatalogMovies() });
  });

  app.post('/api/media/catalog', (req: Request, res: Response) => {
    const movie = req.body;
    if (!movie || typeof movie !== 'object' || !movie.id || !movie.title) {
      res.status(400).json({ error: 'Dados do filme inválidos.' });
      return;
    }
    const existing = readServerCatalogMovies();
    const filtered = existing.filter((m) => m && m.id !== movie.id);
    const updated = [movie, ...filtered];
    writeServerCatalogMovies(updated);
    findBestResponseCache.clear();

    // Immediately prepare & warm vault video in background so it is ready to play right after publish
    if (typeof movie.videoUrl === 'string' && movie.videoUrl.trim()) {
      const localCheck = inspectLocalStreamTarget(unwrapProxyOrTranscodeUrl(movie.videoUrl));
      if (localCheck.exists && localCheck.resolvedPath) {
        void prepareVaultVideoForInstantPlayback(localCheck.resolvedPath).catch(() => {});
      }
    }

    res.json({ ok: true, movie });
  });

  app.delete('/api/media/catalog/:id', (req: Request, res: Response) => {
    const id = req.params.id;
    const existing = readServerCatalogMovies();
    const updated = existing.filter((m) => m && m.id !== id);
    writeServerCatalogMovies(updated);
    findBestResponseCache.clear();
    res.json({ ok: true });
  });

  const buildUploadSuccessResponse = (
    req: Request,
    folder: 'videos' | 'images' | 'subtitles',
    finalFilename: string,
    size: number,
    extra: Record<string, any> = {}
  ) => {
    const cfg = readDomainConfig();
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const platformOrigin = `${proto}://${host}`;
    const streamPath = `/stream/media/${folder}/${encodeURIComponent(finalFilename)}`;
    return {
      ok: true,
      completed: true,
      filename: finalFilename,
      folder,
      size,
      mimeType: getMimeTypeForFile(finalFilename),
      streamPath,
      domainStreamUrl: `https://${cfg.customDomain}${streamPath}`,
      platformStreamUrl: `${platformOrigin}${streamPath}`,
      ...extra,
    };
  };

  // Cached probe + MP4 faststart instant-playback preparation helpers
  interface ServerProbeResult {
    format: string;
    duration: number;
    videoCodec: string;
    audioCodec: string;
    width: number;
    height: number;
    is10Bit: boolean;
    hasSkippedChunks: boolean;
    needsVideoTranscode: boolean;
    needsAudioTranscode: boolean;
    needsRemux: boolean;
    faststartApplied?: boolean;
    audioTracks: { index: number; codec: string; lang: string; title: string }[];
    subtitleTracks: { index: number; codec: string; lang: string; title: string }[];
  }

  const readCachedLocalProbe = (localFile: string, stat: fs.Stats): ServerProbeResult | null => {
    try {
      const cachePath = `${localFile}.probe.json`;
      if (!fs.existsSync(cachePath)) return null;
      const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (
        parsed &&
        parsed.info &&
        parsed.size === stat.size &&
        Math.abs(Number(parsed.mtimeMs || 0) - stat.mtimeMs) < 5
      ) {
        return parsed.info as ServerProbeResult;
      }
    } catch {
      // ignore corrupted probe sidecar
    }
    return null;
  };

  const writeCachedLocalProbe = (localFile: string, stat: fs.Stats, info: ServerProbeResult) => {
    try {
      fs.writeFileSync(
        `${localFile}.probe.json`,
        JSON.stringify({
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          info,
          cachedAt: new Date().toISOString(),
        }),
        'utf8'
      );
    } catch {
      // non-fatal
    }
  };

  const hasMp4MoovAtEnd = async (filePath: string): Promise<boolean> => {
    let fh: fs.promises.FileHandle | null = null;
    try {
      fh = await fs.promises.open(filePath, 'r');
      const st = await fh.stat();
      let offset = 0;
      let sawMdat = false;
      const hdr = Buffer.alloc(16);
      for (let box = 0; box < 64 && offset + 8 <= st.size; box++) {
        const { bytesRead } = await fh.read(hdr, 0, 16, offset);
        if (bytesRead < 8) break;
        const size32 = hdr.readUInt32BE(0);
        const type = hdr.toString('ascii', 4, 8);
        let boxSize = size32;
        if (size32 === 1) {
          if (bytesRead < 16) break;
          boxSize = Number(hdr.readBigUInt64BE(8));
        } else if (size32 === 0) {
          boxSize = st.size - offset;
        }
        if (!Number.isFinite(boxSize) || boxSize < 8) break;
        if (type === 'moov') {
          return sawMdat;
        }
        if (type === 'mdat') {
          sawMdat = true;
        }
        offset += boxSize;
      }
    } catch {
      return false;
    } finally {
      if (fh) {
        await fh.close().catch(() => {});
      }
    }
    return false;
  };

  const probeMediaTarget = (
    rawUrl: string
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    missingFile?: boolean;
    isLocalVault: boolean;
    localFile: string | null;
    fileSizeBytes?: number;
    cached?: boolean;
    info?: ServerProbeResult;
  }> => {
    const localInspection = inspectLocalStreamTarget(rawUrl);
    if (localInspection.isVaultPath && !localInspection.exists) {
      return Promise.resolve({
        ok: false,
        status: 404,
        error: 'Ficheiro de vídeo não encontrado no servidor.',
        missingFile: true,
        isLocalVault: true,
        localFile: null,
      });
    }
    const localFile = localInspection.exists ? localInspection.resolvedPath : null;
    const target = localFile ? null : isSafePublicUrl(rawUrl);
    if (!localFile && !target) {
      return Promise.resolve({
        ok: false,
        status: 400,
        error: 'Invalid media URL',
        isLocalVault: false,
        localFile: null,
      });
    }

    let fileSizeBytes: number | undefined;
    let localStat: fs.Stats | null = null;
    if (localFile) {
      try {
        localStat = fs.statSync(localFile);
        fileSizeBytes = localStat.size;
        const cachedInfo = readCachedLocalProbe(localFile, localStat);
        if (cachedInfo) {
          return Promise.resolve({
            ok: true,
            status: 200,
            isLocalVault: true,
            localFile,
            fileSizeBytes,
            cached: true,
            info: cachedInfo,
          });
        }
      } catch {
        // ignore stat errors
      }
    }

    const ffprobeArgs = localFile
      ? ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', localFile]
      : [
          '-v',
          'quiet',
          '-user_agent',
          BROWSER_UA,
          '-print_format',
          'json',
          '-show_format',
          '-show_streams',
          target!.toString(),
        ];

    return new Promise((resolve) => {
      const ffprobe = spawn('ffprobe', ffprobeArgs);
      let stdout = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            ffprobe.kill('SIGKILL');
          } catch {}
          resolve({
            ok: false,
            status: 504,
            error: 'Probe timeout',
            isLocalVault: Boolean(localFile),
            localFile,
            fileSizeBytes,
          });
        }
      }, 9500);

      ffprobe.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      ffprobe.on('error', (err) => {
        clearTimeout(timeout);
        if (!settled) {
          settled = true;
          resolve({
            ok: false,
            status: 500,
            error: err.message,
            isLocalVault: Boolean(localFile),
            localFile,
            fileSizeBytes,
          });
        }
      });

      ffprobe.on('close', (code) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        if (code !== 0 || !stdout) {
          if (localFile && fs.existsSync(`${localFile}.meta.json`)) {
            resolve({
              ok: true,
              status: 200,
              isLocalVault: true,
              localFile,
              fileSizeBytes,
              info: {
                format: path.extname(localFile).replace('.', '') || 'mp4',
                duration: 0,
                videoCodec: 'unknown',
                audioCodec: 'unknown',
                width: 0,
                height: 0,
                is10Bit: false,
                needsVideoTranscode: false,
                needsAudioTranscode: false,
                needsRemux: true,
                hasSkippedChunks: true,
                audioTracks: [],
                subtitleTracks: [],
              },
            });
            return;
          }
          resolve({
            ok: false,
            status: 502,
            error: 'Could not probe media stream',
            isLocalVault: Boolean(localFile),
            localFile,
            fileSizeBytes,
          });
          return;
        }
        try {
          const info = JSON.parse(stdout);
          const streams: any[] = Array.isArray(info.streams) ? info.streams : [];
          const videoStream = streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
          const audioStreams = streams.filter((s) => s.codec_type === 'audio');
          const subtitleStreams = streams.filter((s) => s.codec_type === 'subtitle');

          const videoCodec = String(videoStream?.codec_name || 'unknown').toLowerCase();
          const hasAudio = audioStreams.length > 0;
          const audioCodec = hasAudio ? String(audioStreams[0]?.codec_name || 'unknown').toLowerCase() : 'none';
          const pixFmt = String(videoStream?.pix_fmt || '').toLowerCase();
          const profile = String(videoStream?.profile || '').toLowerCase();
          const is10Bit = pixFmt.includes('10') || profile.includes('10');
          const isUnsupportedChroma =
            videoCodec === 'h264' &&
            Boolean(pixFmt) &&
            !['yuv420p', 'yuvj420p', 'nv12'].includes(pixFmt);
          const formatName = String(info.format?.format_name || '').toLowerCase();

          let hasSkippedChunks = false;
          if (localFile) {
            try {
              const metaPath = `${localFile}.meta.json`;
              if (fs.existsSync(metaPath)) {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                hasSkippedChunks = Number(meta?.skippedChunksCount || 0) > 0;
              }
            } catch {
              // ignore
            }
          }

          const needsVideoTranscode =
            Boolean(videoStream) &&
            (!['h264', 'vp8', 'vp9', 'av1'].includes(videoCodec) || is10Bit || isUnsupportedChroma);
          const needsAudioTranscode =
            hasAudio && !['aac', 'mp3', 'opus', 'vorbis'].includes(audioCodec);
          const needsRemux =
            hasSkippedChunks ||
            formatName.includes('matroska') ||
            formatName.includes('avi') ||
            formatName.includes('mpeg') ||
            formatName.includes('flv') ||
            formatName.includes('asf');

          const parsedInfo: ServerProbeResult = {
            format: formatName,
            duration: info.format?.duration ? Number(info.format.duration) : 0,
            videoCodec,
            audioCodec,
            width: videoStream?.width || 0,
            height: videoStream?.height || 0,
            is10Bit,
            hasSkippedChunks,
            needsVideoTranscode,
            needsAudioTranscode,
            needsRemux,
            audioTracks: audioStreams.map((a, idx) => ({
              index: idx,
              codec: a.codec_name,
              lang: a.tags?.language || 'und',
              title: a.tags?.title || `Faixa ${idx + 1}`,
            })),
            subtitleTracks: subtitleStreams.map((s, idx) => ({
              index: idx,
              codec: s.codec_name,
              lang: s.tags?.language || 'und',
              title: s.tags?.title || `Legenda ${idx + 1}`,
            })),
          };

          if (localFile && localStat) {
            writeCachedLocalProbe(localFile, localStat, parsedInfo);
          }

          resolve({
            ok: true,
            status: 200,
            isLocalVault: Boolean(localFile),
            localFile,
            fileSizeBytes,
            info: parsedInfo,
          });
        } catch {
          resolve({
            ok: false,
            status: 500,
            error: 'Invalid probe output',
            isLocalVault: Boolean(localFile),
            localFile,
            fileSizeBytes,
          });
        }
      });
    });
  };

  const preparingVaultVideos = new Map<
    string,
    Promise<{ prepared: boolean; faststarted: boolean; probeInfo?: ServerProbeResult }>
  >();

  const prepareVaultVideoForInstantPlayback = (
    finalPath: string
  ): Promise<{ prepared: boolean; faststarted: boolean; probeInfo?: ServerProbeResult }> => {
    const existing = preparingVaultVideos.get(finalPath);
    if (existing) return existing;

    const task = (async () => {
      try {
        if (!fs.existsSync(finalPath)) {
          return { prepared: false, faststarted: false };
        }
        const streamPath = `/stream/media/videos/${encodeURIComponent(path.basename(finalPath))}`;
        const probed = await probeMediaTarget(streamPath);
        if (!probed.ok || !probed.info) {
          return { prepared: false, faststarted: false };
        }

        let faststarted = false;
        const ext = path.extname(finalPath).toLowerCase();
        const isNativeMp4 = ext === '.mp4' || ext === '.m4v';
        if (
          isNativeMp4 &&
          !probed.info.hasSkippedChunks &&
          !probed.info.needsVideoTranscode &&
          !probed.info.needsAudioTranscode &&
          !probed.info.needsRemux
        ) {
          const moovAtEnd = await hasMp4MoovAtEnd(finalPath);
          if (moovAtEnd) {
            const tmpFaststart = `${finalPath}.faststart.mp4`;
            const okFaststart = await new Promise<boolean>((resolve) => {
              const ff = spawn('ffmpeg', [
                '-y',
                '-hide_banner',
                '-loglevel',
                'error',
                '-i',
                finalPath,
                '-c',
                'copy',
                '-movflags',
                '+faststart',
                tmpFaststart,
              ]);
              const timer = setTimeout(() => {
                try {
                  ff.kill('SIGKILL');
                } catch {}
                resolve(false);
              }, 120000);
              ff.on('error', () => {
                clearTimeout(timer);
                resolve(false);
              });
              ff.on('close', (code) => {
                clearTimeout(timer);
                resolve(code === 0);
              });
            });

            if (okFaststart) {
              const stNew = await fs.promises.stat(tmpFaststart).catch(() => null);
              if (stNew && stNew.size > 0) {
                try {
                  await fs.promises.rename(tmpFaststart, finalPath);
                } catch {
                  await fs.promises.copyFile(tmpFaststart, finalPath);
                  await fs.promises.unlink(tmpFaststart).catch(() => {});
                }
                const swappedStat = await fs.promises.stat(finalPath).catch(() => null);
                if (swappedStat) {
                  probed.info.faststartApplied = true;
                  writeCachedLocalProbe(finalPath, swappedStat, probed.info);
                }
                faststarted = true;
              } else {
                await fs.promises.unlink(tmpFaststart).catch(() => {});
              }
            } else {
              await fs.promises.unlink(tmpFaststart).catch(() => {});
            }
          }
        }

        // Prime first 256KB into OS page cache so initial playback starts with zero disk-read delay
        try {
          const fh = await fs.promises.open(finalPath, 'r');
          try {
            const warmBuf = Buffer.allocUnsafe(256 * 1024);
            await fh.read(warmBuf, 0, warmBuf.length, 0);
          } finally {
            await fh.close();
          }
        } catch {
          // non-fatal
        }

        return { prepared: true, faststarted, probeInfo: probed.info };
      } catch {
        return { prepared: false, faststarted: false };
      } finally {
        preparingVaultVideos.delete(finalPath);
      }
    })();

    preparingVaultVideos.set(finalPath, task);
    return task;
  };

  // Track cancelled uploads, assembly jobs, & per-upload staging setup / chunk indices
  interface AssemblyJobState {
    uploadId: string;
    status: 'assembling' | 'completed' | 'error';
    assembledChunks: number;
    totalChunks: number;
    result?: any;
    error?: string;
    updatedAt: number;
  }
  const uploadAssemblyJobs = new Map<string, AssemblyJobState>();
  const cancelledUploads = new Map<string, number>();
  const stagingInitPromises = new Map<string, Promise<string>>();
  const uploadChunkIndicesMap = new Map<string, Set<number>>();

  const isUploadCancelled = (uploadId: string): boolean => {
    const ts = cancelledUploads.get(uploadId);
    if (!ts) return false;
    if (Date.now() - ts > 60 * 60 * 1000) {
      cancelledUploads.delete(uploadId);
      return false;
    }
    return true;
  };

  const getStagingPath = (uploadId: string) =>
    path.join(MEDIA_CHUNKS_DIR, `${uploadId}.staging`);

  const getIndexLogPath = (uploadId: string) =>
    path.join(MEDIA_CHUNKS_DIR, `${uploadId}.idx`);

  const ensureStagingFileInitialized = async (uploadId: string, totalSize: number): Promise<string> => {
    const stagingPath = getStagingPath(uploadId);
    const existing = stagingInitPromises.get(uploadId);
    if (existing) {
      return existing;
    }
    const initPromise = (async () => {
      ensureMediaVaultDirs();
      const fh = await fs.promises.open(stagingPath, fs.existsSync(stagingPath) ? 'r+' : 'w+');
      try {
        if (Number.isFinite(totalSize) && totalSize > 0) {
          const st = await fh.stat();
          if (st.size !== totalSize) {
            await fh.truncate(totalSize);
          }
        }
      } finally {
        await fh.close();
      }
      return stagingPath;
    })();
    stagingInitPromises.set(uploadId, initPromise);
    try {
      return await initPromise;
    } catch (err) {
      stagingInitPromises.delete(uploadId);
      throw err;
    }
  };

  const loadRecordedChunkIndices = async (uploadId: string, totalChunks?: number): Promise<Set<number>> => {
    const cached = uploadChunkIndicesMap.get(uploadId);
    const set = new Set<number>(cached ? Array.from(cached) : []);
    const idxPath = getIndexLogPath(uploadId);
    if (fs.existsSync(idxPath)) {
      try {
        const raw = await fs.promises.readFile(idxPath, 'utf8');
        for (const line of raw.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const idx = Number(trimmed);
          if (Number.isInteger(idx) && idx >= 0 && (!totalChunks || idx < totalChunks)) {
            set.add(idx);
          }
        }
      } catch {
        // ignore read race
      }
    }
    uploadChunkIndicesMap.set(uploadId, set);
    return set;
  };

  const recordChunkWritten = async (uploadId: string, chunkIndex: number): Promise<void> => {
    let set = uploadChunkIndicesMap.get(uploadId);
    if (!set) {
      set = new Set<number>();
      uploadChunkIndicesMap.set(uploadId, set);
    }
    if (!set.has(chunkIndex)) {
      set.add(chunkIndex);
      await fs.promises.appendFile(getIndexLogPath(uploadId), `${chunkIndex}\n`, 'utf8');
    }
  };

  const cleanupUploadTempFiles = async (uploadId: string): Promise<number> => {
    let removed = 0;
    stagingInitPromises.delete(uploadId);
    uploadChunkIndicesMap.delete(uploadId);
    const staticFiles = [
      getStagingPath(uploadId),
      getIndexLogPath(uploadId),
      path.join(MEDIA_CHUNKS_DIR, `${uploadId}.done.json`),
    ];
    for (const f of staticFiles) {
      if (fs.existsSync(f)) {
        await fs.promises.unlink(f).catch(() => {});
        removed++;
      }
    }
    try {
      const entries = await fs.promises.readdir(MEDIA_CHUNKS_DIR);
      const prefix = `${uploadId}_c`;
      const matching = entries.filter((e) => e.startsWith(prefix));
      for (let i = 0; i < matching.length; i += 100) {
        await Promise.all(
          matching.slice(i, i + 100).map(async (e) => {
            await fs.promises.unlink(path.join(MEDIA_CHUNKS_DIR, e)).catch(() => {});
            removed++;
          })
        );
      }
    } catch {
      // non-fatal
    }
    return removed;
  };

  // Cancel active chunked upload and clean temporary blocks on platform domain
  app.post('/api/media/upload/cancel', async (req: Request, res: Response) => {
    const uploadId = String(req.body?.uploadId || req.query.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!uploadId) {
      res.status(400).json({ error: 'uploadId inválido.' });
      return;
    }
    cancelledUploads.set(uploadId, Date.now());
    const job = uploadAssemblyJobs.get(uploadId);
    if (job && job.status === 'assembling') {
      job.status = 'error';
      job.error = 'Upload cancelado pelo administrador.';
      job.updatedAt = Date.now();
    }
    const removed = await cleanupUploadTempFiles(uploadId);
    res.json({ ok: true, cancelled: true, uploadId, cleanedFiles: removed });
  });

  // Upload Movie or Image into Server Media Domain Vault (direct offset block writes, parallel chunks, skip-error tolerance, or single stream)
  app.post('/api/media/upload', async (req: Request, res: Response) => {
    // Disable request timeout so large movie uploads are never cut off before 100%
    req.setTimeout(0);
    res.setTimeout(0);
    ensureMediaVaultDirs();
    const rawFilename = String(req.headers['x-file-name'] || req.query.filename || 'filme.mp4');
    const folder = sanitizeMediaFolder(req.headers['x-file-folder'] || req.query.folder);
    const uploadId = String(req.headers['x-upload-id'] || req.query.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const chunkIndex = Number(req.headers['x-chunk-index'] ?? req.query.chunkIndex ?? 0);
    const totalChunks = Number(req.headers['x-total-chunks'] ?? req.query.totalChunks ?? 1);
    const chunkSizeHeader = Number(req.headers['x-chunk-size'] ?? req.query.chunkSize ?? 0);
    const totalSizeHeader = Number(req.headers['x-total-size'] ?? req.query.totalSize ?? 0);
    const expectedChunkBytes = Number(req.headers['x-chunk-bytes'] ?? req.query.chunkBytes ?? 0);
    const manualFinalize = String(req.headers['x-manual-finalize'] || req.query.manualFinalize || '') === 'true';

    const safeBase = sanitizeFilename(safeDecodeUriComponent(rawFilename));
    const isChunked = Boolean(uploadId) && Number.isFinite(totalChunks) && totalChunks > 1;

    if (uploadId && isUploadCancelled(uploadId)) {
      res.status(410).json({ ok: false, cancelled: true, error: 'Upload cancelado pelo administrador.' });
      return;
    }

    if (isChunked) {
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
        res.status(400).json({ error: 'Índice de bloco inválido.' });
        return;
      }

      const useDirectOffsetStaging =
        Number.isFinite(chunkSizeHeader) && chunkSizeHeader > 0 && Number.isFinite(totalSizeHeader) && totalSizeHeader > 0;
      const chunkFinalPath = path.join(MEDIA_CHUNKS_DIR, `${uploadId}_c${chunkIndex}.part`);
      const chunkTmpPath = `${chunkFinalPath}.tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let aborted = false;
      let ended = false;

      const cleanupTmp = () => {
        fs.unlink(chunkTmpPath, () => {});
      };

      req.on('data', (chunk: Buffer) => {
        if (!aborted) {
          if (isUploadCancelled(uploadId)) {
            aborted = true;
            chunks.length = 0;
            return;
          }
          chunks.push(chunk);
          totalBytes += chunk.length;
        }
      });

      req.on('close', () => {
        if (!ended && !req.complete) {
          aborted = true;
          chunks.length = 0;
          cleanupTmp();
        }
      });

      req.on('error', (err) => {
        aborted = true;
        chunks.length = 0;
        cleanupTmp();
        if (!res.headersSent) {
          res.status(500).json({ error: err.message || 'Erro ao receber bloco de vídeo.' });
        }
      });

      req.on('end', async () => {
        ended = true;
        if (aborted || isUploadCancelled(uploadId)) {
          chunks.length = 0;
          cleanupTmp();
          if (!res.headersSent && isUploadCancelled(uploadId)) {
            res.status(410).json({ ok: false, cancelled: true, error: 'Upload cancelado pelo administrador.' });
          }
          return;
        }
        if (totalBytes === 0) {
          res.status(400).json({ error: 'Bloco vazio recebido pelo servidor.' });
          return;
        }
        if (Number.isFinite(expectedChunkBytes) && expectedChunkBytes > 0 && totalBytes !== expectedChunkBytes) {
          res.status(400).json({ error: `Bloco incompleto recebido (${totalBytes}/${expectedChunkBytes} bytes).` });
          return;
        }

        try {
          ensureMediaVaultDirs();
          const buf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, totalBytes);
          chunks.length = 0;

          if (useDirectOffsetStaging) {
            const stagingPath = await ensureStagingFileInitialized(uploadId, totalSizeHeader);
            if (isUploadCancelled(uploadId)) {
              res.status(410).json({ ok: false, cancelled: true, error: 'Upload cancelado.' });
              return;
            }
            const offset = chunkIndex * chunkSizeHeader;
            const fh = await fs.promises.open(stagingPath, 'r+');
            try {
              let written = 0;
              while (written < buf.length) {
                const { bytesWritten } = await fh.write(buf, written, buf.length - written, offset + written);
                if (bytesWritten <= 0) {
                  throw new Error('Falha ao escrever bytes do bloco no domínio.');
                }
                written += bytesWritten;
              }
            } finally {
              await fh.close();
            }
            await recordChunkWritten(uploadId, chunkIndex);
          } else {
            await fs.promises.writeFile(chunkTmpPath, buf);
            try {
              await fs.promises.rename(chunkTmpPath, chunkFinalPath);
            } catch {
              await fs.promises.copyFile(chunkTmpPath, chunkFinalPath);
              cleanupTmp();
            }
            const writtenStat = await fs.promises.stat(chunkFinalPath).catch(() => null);
            if (!writtenStat || writtenStat.size === 0) {
              throw new Error('Bloco gravado com 0 bytes no disco.');
            }
          }
        } catch (err: any) {
          cleanupTmp();
          if (!res.headersSent) {
            res.status(500).json({ error: err?.message || 'Erro ao gravar bloco de vídeo no servidor.' });
          }
          return;
        }

        // Parallel chunk mode waits for explicit /api/media/upload/finalize
        if (manualFinalize || chunkIndex + 1 < totalChunks) {
          res.json({
            ok: true,
            saved: true,
            directStaged: useDirectOffsetStaging,
            chunkIndex,
            totalChunks,
            bytes: totalBytes,
            completed: false,
          });
          return;
        }

        // Fallback sequential last-chunk assembly
        const chunkPaths: string[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const cp = path.join(MEDIA_CHUNKS_DIR, `${uploadId}_c${i}.part`);
          if (!fs.existsSync(cp)) {
            res.status(400).json({ error: `Bloco ${i + 1}/${totalChunks} em falta para montagem final.` });
            return;
          }
          chunkPaths.push(cp);
        }

        const finalFilename = `${Date.now()}_${safeBase}`;
        const finalPath = resolveVaultFilePath(folder, finalFilename);
        if (!finalPath) {
          res.status(400).json({ error: 'Caminho de destino inválido.' });
          return;
        }

        try {
          const dest = fs.createWriteStream(finalPath, { highWaterMark: 2 * 1024 * 1024 });
          let destErr: Error | null = null;
          dest.once('error', (err) => {
            destErr = err;
          });
          for (const cp of chunkPaths) {
            if (destErr) throw destErr;
            const rs = fs.createReadStream(cp, { highWaterMark: 2 * 1024 * 1024 });
            for await (const part of rs) {
              if (destErr) throw destErr;
              if (!dest.write(part)) {
                await once(dest, 'drain');
              }
            }
          }
          await new Promise<void>((resolve, reject) => {
            if (destErr) {
              reject(destErr);
              return;
            }
            dest.once('error', reject);
            dest.end(() => resolve());
          });

          for (const cp of chunkPaths) {
            fs.unlink(cp, () => {});
          }

          const stat = fs.statSync(finalPath);
          if (folder === 'videos') {
            void prepareVaultVideoForInstantPlayback(finalPath).catch(() => {});
          }
          res.json(buildUploadSuccessResponse(req, folder, finalFilename, stat.size));
        } catch (err) {
          fs.unlink(finalPath, () => {});
          res.status(500).json({
            error: err instanceof Error ? err.message : 'Erro ao montar o filme completo no domínio.',
          });
        }
      });
      return;
    }

    const finalFilename = `${Date.now()}_${safeBase}`;
    const finalPath = resolveVaultFilePath(folder, finalFilename);
    if (!finalPath) {
      res.status(400).json({ error: 'Invalid destination path' });
      return;
    }

    const writeStream = fs.createWriteStream(finalPath);
    let aborted = false;
    let receivedBytes = 0;

    req.on('data', (d: Buffer) => {
      receivedBytes += d.length;
    });

    req.on('close', () => {
      if (!req.complete) {
        aborted = true;
        writeStream.destroy();
        fs.unlink(finalPath, () => {});
      }
    });

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      if (aborted) return;
      if (receivedBytes === 0 && (!fs.existsSync(finalPath) || fs.statSync(finalPath).size === 0)) {
        fs.unlink(finalPath, () => {});
        if (!res.headersSent) {
          res.status(400).json({ error: 'O ficheiro enviado está vazio.' });
        }
        return;
      }
      const stat = fs.statSync(finalPath);
      if (folder === 'videos') {
        void prepareVaultVideoForInstantPlayback(finalPath).catch(() => {});
      }
      res.json(buildUploadSuccessResponse(req, folder, finalFilename, stat.size));
    });

    writeStream.on('error', (err) => {
      fs.unlink(finalPath, () => {});
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Erro ao guardar ficheiro no domínio.' });
      }
    });
  });

  // Background assembly receipt helpers

  const getUploadDoneReceiptPath = (uploadId: string) =>
    path.join(MEDIA_CHUNKS_DIR, `${uploadId}.done.json`);

  const readUploadDoneReceipt = (uploadId: string): any | null => {
    try {
      const p = getUploadDoneReceiptPath(uploadId);
      if (!fs.existsSync(p)) return null;
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      return parsed && parsed.streamPath ? parsed : null;
    } catch {
      return null;
    }
  };

  const writeUploadDoneReceipt = (uploadId: string, payload: any) => {
    try {
      ensureMediaVaultDirs();
      fs.writeFileSync(getUploadDoneReceiptPath(uploadId), JSON.stringify(payload), 'utf8');
    } catch {
      // non-fatal
    }
  };

  // Check which chunks already arrived on disk (supports O(1) single-chunk check and async scan for multi-GB uploads)
  app.get('/api/media/upload/status', async (req: Request, res: Response) => {
    ensureMediaVaultDirs();
    const uploadId = String(req.query.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const totalChunks = Number(req.query.totalChunks ?? 0);
    const chunkIndexParam = req.query.chunkIndex;
    if (!uploadId) {
      res.status(400).json({ error: 'uploadId inválido.' });
      return;
    }

    const doneReceipt = readUploadDoneReceipt(uploadId);
    if (doneReceipt) {
      res.json({
        ok: true,
        uploadId,
        alreadyFinalized: true,
        hasChunk: true,
        result: doneReceipt,
        receivedChunks:
          Number.isInteger(totalChunks) && totalChunks > 0
            ? Array.from({ length: totalChunks }, (_, idx) => idx)
            : [],
        receivedCount: totalChunks,
        totalChunks,
      });
      return;
    }

    // O(1) single chunk check (used by retry logic to avoid scanning thousands of files)
    if (chunkIndexParam !== undefined && chunkIndexParam !== '') {
      const idx = Number(chunkIndexParam);
      if (!Number.isInteger(idx) || idx < 0) {
        res.status(400).json({ error: 'chunkIndex inválido.' });
        return;
      }
      const recorded = await loadRecordedChunkIndices(uploadId, totalChunks || undefined);
      let hasChunk = recorded.has(idx);
      if (!hasChunk) {
        const cp = path.join(MEDIA_CHUNKS_DIR, `${uploadId}_c${idx}.part`);
        const st = await fs.promises.stat(cp).catch(() => null);
        hasChunk = Boolean(st && st.size > 0);
      }
      res.json({
        ok: true,
        uploadId,
        chunkIndex: idx,
        hasChunk,
      });
      return;
    }

    const receivedSet = await loadRecordedChunkIndices(uploadId, totalChunks || undefined);
    const prefix = `${uploadId}_c`;
    try {
      const entries = await fs.promises.readdir(MEDIA_CHUNKS_DIR);
      const matching = entries.filter((entry) => entry.startsWith(prefix) && entry.endsWith('.part'));
      const STAT_BATCH = 200;
      for (let b = 0; b < matching.length; b += STAT_BATCH) {
        const batch = matching.slice(b, b + STAT_BATCH);
        const stats = await Promise.all(
          batch.map(async (entry) => {
            const idxStr = entry.slice(prefix.length, entry.length - '.part'.length);
            const idx = Number(idxStr);
            if (!Number.isInteger(idx) || idx < 0) return null;
            if (Number.isInteger(totalChunks) && totalChunks > 0 && idx >= totalChunks) return null;
            if (receivedSet.has(idx)) return idx;
            const st = await fs.promises.stat(path.join(MEDIA_CHUNKS_DIR, entry)).catch(() => null);
            return st && st.size > 0 ? idx : null;
          })
        );
        for (const idx of stats) {
          if (idx !== null) receivedSet.add(idx);
        }
      }
    } catch {
      // fallback empty
    }
    const receivedChunks = Array.from(receivedSet).sort((a, b) => a - b);

    res.json({
      ok: true,
      uploadId,
      receivedChunks,
      receivedCount: receivedChunks.length,
      totalChunks,
    });
  });

  // Poll status of background file assembly
  app.get('/api/media/upload/finalize-status/:uploadId', (req: Request, res: Response) => {
    const uploadId = String(req.params.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const job = uploadAssemblyJobs.get(uploadId);
    if (!job) {
      const doneReceipt = readUploadDoneReceipt(uploadId);
      if (doneReceipt) {
        res.json(doneReceipt);
        return;
      }
      res.status(404).json({ error: 'Tarefa de montagem não encontrada.' });
      return;
    }
    if (job.status === 'completed' && job.result) {
      res.json(job.result);
      return;
    }
    if (job.status === 'error') {
      res.status(500).json({ ok: false, status: 'error', error: job.error || 'Falha ao montar o filme.' });
      return;
    }
    res.status(202).json({
      ok: true,
      assembling: true,
      status: job.status,
      assembledChunks: job.assembledChunks,
      totalChunks: job.totalChunks,
    });
  });

  // Finalize Parallel Chunked Upload (with async assembly & fault-tolerant skipMissingChunks option)
  app.post('/api/media/upload/finalize', async (req: Request, res: Response) => {
    // Disable request timeout so large movie file assembly never times out
    req.setTimeout(0);
    res.setTimeout(0);
    ensureMediaVaultDirs();
    const uploadId = String(req.body?.uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const rawFilename = String(req.body?.filename || 'filme.mp4');
    const folder = sanitizeMediaFolder(req.body?.folder);
    const totalChunks = Number(req.body?.totalChunks ?? 0);
    const requestedChunkSize = Number(req.body?.chunkSize ?? 0);
    const requestedTotalSize = Number(req.body?.totalSize ?? 0);
    const skipMissingChunks = req.body?.skipMissingChunks !== false;
    const preferAsync = req.body?.async === true;

    if (!uploadId || !Number.isInteger(totalChunks) || totalChunks < 1) {
      res.status(400).json({ error: 'Parâmetros de finalização inválidos.' });
      return;
    }

    if (isUploadCancelled(uploadId)) {
      res.status(410).json({ ok: false, cancelled: true, error: 'Upload cancelado pelo administrador.' });
      return;
    }

    // Return existing completed/assembling job state idempotently (memory or disk receipt)
    const existingJob = uploadAssemblyJobs.get(uploadId);
    if (existingJob) {
      if (existingJob.status === 'completed' && existingJob.result) {
        res.json(existingJob.result);
        return;
      }
      if (existingJob.status === 'assembling') {
        res.status(202).json({
          ok: true,
          assembling: true,
          status: 'assembling',
          assembledChunks: existingJob.assembledChunks,
          totalChunks: existingJob.totalChunks,
        });
        return;
      }
    } else {
      const doneReceipt = readUploadDoneReceipt(uploadId);
      if (doneReceipt) {
        res.json(doneReceipt);
        return;
      }
    }

    const safeBase = sanitizeFilename(safeDecodeUriComponent(rawFilename));
    const stagingPath = getStagingPath(uploadId);

    // Fast path: chunks were already written directly at byte offsets into .staging!
    if (fs.existsSync(stagingPath)) {
      const recordedSet = await loadRecordedChunkIndices(uploadId, totalChunks);
      const missingIndices: number[] = [];
      for (let i = 0; i < totalChunks; i++) {
        if (!recordedSet.has(i)) {
          missingIndices.push(i);
        }
      }
      if (recordedSet.size === 0) {
        res.status(400).json({
          ok: false,
          code: 'NO_CHUNKS_FOUND',
          error: 'Nenhum bloco válido foi recebido para concluir o upload.',
        });
        return;
      }
      if (!skipMissingChunks && missingIndices.length > 0) {
        res.status(400).json({
          ok: false,
          code: 'MISSING_CHUNK',
          missingChunkIndex: missingIndices[0],
          error: `Bloco ${missingIndices[0] + 1}/${totalChunks} em falta para montagem final.`,
        });
        return;
      }

      const finalFilename = `${Date.now()}_${safeBase}`;
      const finalPath = resolveVaultFilePath(folder, finalFilename);
      if (!finalPath) {
        res.status(400).json({ error: 'Caminho de destino inválido.' });
        return;
      }

      try {
        if (stagingInitPromises.has(uploadId)) {
          await stagingInitPromises.get(uploadId)?.catch(() => {});
        }
        if (Number.isFinite(requestedTotalSize) && requestedTotalSize > 0) {
          const st = await fs.promises.stat(stagingPath);
          if (st.size !== requestedTotalSize) {
            await fs.promises.truncate(stagingPath, requestedTotalSize);
          }
        }
        try {
          await fs.promises.rename(stagingPath, finalPath);
        } catch {
          await fs.promises.copyFile(stagingPath, finalPath);
          await fs.promises.unlink(stagingPath).catch(() => {});
        }
        await fs.promises.unlink(getIndexLogPath(uploadId)).catch(() => {});
        stagingInitPromises.delete(uploadId);
        uploadChunkIndicesMap.delete(uploadId);

        if (missingIndices.length > 0 && folder === 'videos') {
          await fs.promises
            .writeFile(
              `${finalPath}.meta.json`,
              JSON.stringify({
                skippedChunksCount: missingIndices.length,
                assembledChunksCount: recordedSet.size,
                totalChunks,
                createdAt: new Date().toISOString(),
              }),
              'utf8'
            )
            .catch(() => {});
        }

        const stat = await fs.promises.stat(finalPath);
        if (folder === 'videos') {
          void prepareVaultVideoForInstantPlayback(finalPath).catch(() => {});
        }
        const payload = buildUploadSuccessResponse(req, folder, finalFilename, stat.size, {
          assembledChunksCount: recordedSet.size,
          skippedChunksCount: missingIndices.length,
          instantStaged: true,
        });
        writeUploadDoneReceipt(uploadId, payload);
        uploadAssemblyJobs.set(uploadId, {
          uploadId,
          status: 'completed',
          assembledChunks: recordedSet.size,
          totalChunks,
          result: payload,
          updatedAt: Date.now(),
        });
        res.json(payload);
        return;
      } catch (err: any) {
        res.status(500).json({
          error: err?.message || 'Erro ao finalizar e gravar o filme no domínio.',
        });
        return;
      }
    }

    const chunkPlan: Array<{ index: number; path: string; valid: boolean; size: number }> = [];
    const availableChunkPaths: string[] = [];
    const skippedChunkIndices: number[] = [];
    let inferredChunkSize = Number.isFinite(requestedChunkSize) && requestedChunkSize > 0 ? requestedChunkSize : 0;

    const existingSet = new Set(await fs.promises.readdir(MEDIA_CHUNKS_DIR).catch(() => []));
    const CHECK_BATCH = 250;
    for (let start = 0; start < totalChunks; start += CHECK_BATCH) {
      const end = Math.min(totalChunks, start + CHECK_BATCH);
      const batchIndices = Array.from({ length: end - start }, (_, k) => start + k);
      const results = await Promise.all(
        batchIndices.map(async (i) => {
          const name = `${uploadId}_c${i}.part`;
          const cp = path.join(MEDIA_CHUNKS_DIR, name);
          if (!existingSet.has(name)) {
            return { i, cp, valid: false, size: 0 };
          }
          const st = await fs.promises.stat(cp).catch(() => null);
          const sz = st && st.size > 0 ? st.size : 0;
          return { i, cp, valid: sz > 0, size: sz };
        })
      );

      for (const item of results) {
        if (item.valid) {
          if (!inferredChunkSize && item.i < totalChunks - 1) {
            inferredChunkSize = item.size;
          }
          availableChunkPaths.push(item.cp);
          chunkPlan.push({ index: item.i, path: item.cp, valid: true, size: item.size });
        } else if (skipMissingChunks) {
          skippedChunkIndices.push(item.i);
          chunkPlan.push({ index: item.i, path: item.cp, valid: false, size: 0 });
          fs.unlink(item.cp, () => {});
        } else {
          res.status(400).json({
            ok: false,
            code: 'MISSING_CHUNK',
            missingChunkIndex: item.i,
            error: `Bloco ${item.i + 1}/${totalChunks} em falta para montagem final.`,
          });
          return;
        }
      }
    }

    if (availableChunkPaths.length === 0) {
      res.status(400).json({
        ok: false,
        code: 'NO_CHUNKS_FOUND',
        error: 'Nenhum bloco válido foi recebido para concluir o upload.',
      });
      return;
    }

    const finalFilename = `${Date.now()}_${safeBase}`;
    const finalPath = resolveVaultFilePath(folder, finalFilename);
    if (!finalPath) {
      res.status(400).json({ error: 'Caminho de destino inválido.' });
      return;
    }

    const job: AssemblyJobState = {
      uploadId,
      status: 'assembling',
      assembledChunks: 0,
      totalChunks: chunkPlan.length,
      updatedAt: Date.now(),
    };
    uploadAssemblyJobs.set(uploadId, job);

    const writeZeroPadding = async (dest: fs.WriteStream, byteCount: number, isDestErr: () => Error | null) => {
      if (byteCount <= 0) return;
      const ZERO_SLICE_SIZE = Math.min(byteCount, 512 * 1024);
      const zeroBuf = Buffer.alloc(ZERO_SLICE_SIZE);
      let remaining = byteCount;
      while (remaining > 0) {
        const err = isDestErr();
        if (err) throw err;
        const toWrite = remaining >= zeroBuf.length ? zeroBuf : zeroBuf.subarray(0, remaining);
        if (!dest.write(toWrite)) {
          await once(dest, 'drain');
        }
        remaining -= toWrite.length;
      }
    };

    const getPadByteCountForChunk = (chunkIdx: number): number => {
      if (inferredChunkSize <= 0) return 0;
      if (Number.isFinite(requestedTotalSize) && requestedTotalSize > 0) {
        const remaining = requestedTotalSize - chunkIdx * inferredChunkSize;
        return remaining > 0 ? Math.min(inferredChunkSize, remaining) : 0;
      }
      return chunkIdx < totalChunks - 1 ? inferredChunkSize : 0;
    };

    const runAssembly = async () => {
      try {
        const dest = fs.createWriteStream(finalPath, { highWaterMark: 1024 * 1024 });
        let destErr: Error | null = null;
        dest.once('error', (err) => {
          destErr = err;
        });

        for (let idx = 0; idx < chunkPlan.length; idx++) {
          const entry = chunkPlan[idx];
          if (!entry.valid) {
            const padBytes = getPadByteCountForChunk(entry.index);
            await writeZeroPadding(dest, padBytes, () => destErr);
            job.assembledChunks = idx + 1;
            job.updatedAt = Date.now();
            continue;
          }

          try {
            if (destErr) throw destErr;
            const rs = fs.createReadStream(entry.path, { highWaterMark: 1024 * 1024 });
            for await (const part of rs) {
              if (destErr) throw destErr;
              if (!dest.write(part)) {
                await once(dest, 'drain');
              }
            }
          } catch (chunkErr) {
            if (!skipMissingChunks) {
              throw chunkErr;
            }
            skippedChunkIndices.push(entry.index);
            const padBytes = getPadByteCountForChunk(entry.index);
            await writeZeroPadding(dest, padBytes, () => destErr);
          }
          job.assembledChunks = idx + 1;
          job.updatedAt = Date.now();
        }
        await new Promise<void>((resolve, reject) => {
          if (destErr) {
            reject(destErr);
            return;
          }
          dest.once('error', reject);
          dest.end(() => resolve());
        });

        // Unlink assembled .part files in controlled batches so multi-thousand chunk cleanup never spikes file descriptors
        const UNLINK_BATCH = 100;
        for (let b = 0; b < availableChunkPaths.length; b += UNLINK_BATCH) {
          await Promise.all(
            availableChunkPaths.slice(b, b + UNLINK_BATCH).map((cp) => fs.promises.unlink(cp).catch(() => {}))
          );
        }

        if (skippedChunkIndices.length > 0 && folder === 'videos') {
          await fs.promises
            .writeFile(
              `${finalPath}.meta.json`,
              JSON.stringify({
                skippedChunksCount: skippedChunkIndices.length,
                assembledChunksCount: availableChunkPaths.length,
                totalChunks,
                createdAt: new Date().toISOString(),
              }),
              'utf8'
            )
            .catch(() => {});
        }

        const stat = await fs.promises.stat(finalPath);
        if (folder === 'videos') {
          void prepareVaultVideoForInstantPlayback(finalPath).catch(() => {});
        }
        const payload = buildUploadSuccessResponse(req, folder, finalFilename, stat.size, {
          assembledChunksCount: availableChunkPaths.length,
          skippedChunksCount: skippedChunkIndices.length,
        });
        writeUploadDoneReceipt(uploadId, payload);
        job.status = 'completed';
        job.result = payload;
        job.updatedAt = Date.now();
        return payload;
      } catch (err) {
        fs.unlink(finalPath, () => {});
        job.status = 'error';
        job.error = err instanceof Error ? err.message : 'Erro ao montar o filme final no domínio.';
        job.updatedAt = Date.now();
        throw err;
      }
    };

    // For larger files or when client requests async assembly, return 202 immediately so gateway never times out
    if (preferAsync || availableChunkPaths.length > 25) {
      void runAssembly().catch(() => {});
      res.status(202).json({
        ok: true,
        assembling: true,
        status: 'assembling',
        uploadId,
        assembledChunks: 0,
        totalChunks: chunkPlan.length,
      });
      return;
    }

    try {
      const payload = await runAssembly();
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao montar o filme final no domínio.',
      });
    }
  });

  // List stored movies and images in the domain vault
  app.get('/api/media/files', (_req: Request, res: Response) => {
    ensureMediaVaultDirs();
    const listFolder = (folder: 'videos' | 'images', dir: string) => {
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((name) => !isHiddenOrSidecarVaultEntry(name))
        .map((name) => {
          const full = path.join(dir, name);
          const stat = fs.statSync(full);
          if (!stat.isFile() || stat.size === 0) return null;
          return {
            filename: name,
            folder,
            size: stat.size,
            mimeType: getMimeTypeForFile(name),
            createdAt: stat.birthtime.toISOString(),
            streamPath: `/stream/media/${folder}/${encodeURIComponent(name)}`,
          };
        })
        .filter(Boolean);
    };

    const files = [
      ...listFolder('videos', MEDIA_VIDEOS_DIR),
      ...listFolder('images', MEDIA_IMAGES_DIR),
    ].sort((a: any, b: any) => (a.createdAt < b.createdAt ? 1 : -1));

    const totalBytes = files.reduce((sum: number, f: any) => sum + (f.size || 0), 0);
    res.json({ files, totalBytes, domainConfig: readDomainConfig() });
  });

  // Locate an uploaded movie file in the platform domain vault by URL, filename, or title
  app.get('/api/media/locate', async (req: Request, res: Response) => {
    ensureMediaVaultDirs();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const url = typeof req.query.url === 'string' ? req.query.url.trim() : '';

    let matchedPath: string | null = null;
    let matchedFilename = '';
    let matchedStreamPath = '';
    let matchReason = 'exact';
    let recovered = false;

    if (url) {
      const inspected = inspectLocalStreamTarget(unwrapProxyOrTranscodeUrl(url));
      if (inspected.exists && inspected.resolvedPath) {
        matchedPath = inspected.resolvedPath;
        matchedFilename = path.basename(inspected.resolvedPath);
        matchedStreamPath =
          inspected.resolvedStreamPath ||
          `/stream/media/videos/${encodeURIComponent(matchedFilename)}`;
      }
    }

    if (!matchedPath) {
      for (const candidateHint of [url, q, title].filter(Boolean)) {
        const matched = findMatchingVaultVideoFile(candidateHint, true);
        if (matched) {
          matchedPath = matched.fullPath;
          matchedFilename = matched.filename;
          matchedStreamPath = matched.streamPath;
          matchReason = matched.matchReason;
          recovered = Boolean(url && matchedStreamPath !== url);
          break;
        }
      }
    }

    if (!matchedPath || !fs.existsSync(matchedPath)) {
      res.json({
        ok: true,
        found: false,
      });
      return;
    }

    const stat = fs.statSync(matchedPath);
    const cfg = readDomainConfig();
    const host = req.get('host') || `localhost:${PORT}`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const probeRes = await probeMediaTarget(matchedStreamPath).catch(() => null);

    res.json({
      ok: true,
      found: true,
      recovered,
      matchReason,
      filename: matchedFilename,
      size: stat.size,
      mimeType: getMimeTypeForFile(matchedFilename),
      streamPath: matchedStreamPath,
      domainStreamUrl: `https://${cfg.customDomain}${matchedStreamPath}`,
      platformStreamUrl: `${proto}://${host}${matchedStreamPath}`,
      probeInfo: probeRes?.ok ? probeRes.info : null,
    });
  });

  // Prepare an uploaded video immediately for error-free, zero-delay playback (probe cache + MP4 faststart)
  app.post('/api/media/prepare', async (req: Request, res: Response) => {
    ensureMediaVaultDirs();
    const rawTarget = String(req.body?.streamPath || req.body?.url || '').trim();
    if (!rawTarget) {
      res.status(400).json({ error: 'Caminho ou URL do ficheiro em falta.' });
      return;
    }
    let inspected = inspectLocalStreamTarget(unwrapProxyOrTranscodeUrl(rawTarget));
    if (!inspected.exists) {
      const matched = findMatchingVaultVideoFile(rawTarget, true);
      if (matched) {
        inspected = {
          isVaultPath: true,
          resolvedPath: matched.fullPath,
          exists: true,
          resolvedStreamPath: matched.streamPath,
        };
      }
    }
    if (!inspected.exists || !inspected.resolvedPath) {
      res.status(404).json({ error: 'Ficheiro de vídeo não encontrado no servidor.' });
      return;
    }
    const result = await prepareVaultVideoForInstantPlayback(inspected.resolvedPath);
    res.json({
      ok: true,
      streamPath:
        inspected.resolvedStreamPath ||
        `/stream/media/videos/${encodeURIComponent(path.basename(inspected.resolvedPath))}`,
      prepared: result.prepared,
      faststarted: result.faststarted,
      probeInfo: result.probeInfo || null,
    });
  });

  // Delete a stored file from the domain vault
  app.delete('/api/media/files/:folder/:filename', (req: Request, res: Response) => {
    const folder = req.params.folder;
    const filename = safeDecodeUriComponent(req.params.filename);
    const resolved = resolveVaultFilePath(folder, filename);
    if (!resolved || !fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Ficheiro não encontrado no domínio.' });
      return;
    }
    fs.unlinkSync(resolved);
    if (fs.existsSync(`${resolved}.meta.json`)) {
      fs.unlink(`${resolved}.meta.json`, () => {});
    }
    if (fs.existsSync(`${resolved}.probe.json`)) {
      fs.unlink(`${resolved}.probe.json`, () => {});
    }
    res.json({ ok: true });
  });

  // HTTP 206 Partial Content Range Streaming Handler
  const handleMediaRangeStream = (req: Request, res: Response) => {
    const folder = req.params.folder;
    const filename = safeDecodeUriComponent(req.params.filename);
    let filePath = resolveVaultFilePath(folder, filename);
    let effectiveFilename = filename;
    if ((!filePath || !fs.existsSync(filePath)) && folder === 'videos') {
      const matched = findMatchingVaultVideoFile(filename, false);
      if (matched) {
        filePath = matched.fullPath;
        effectiveFilename = matched.filename;
      }
    }
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).send('Media file not found');
      return;
    }

    const stat = fs.statSync(filePath);
    const total = stat.size;
    if (total === 0) {
      res.status(404).send('Media file is empty');
      return;
    }
    const mimeType = getMimeTypeForFile(effectiveFilename);
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Accel-Buffering', 'no');

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (!match || (!match[1] && !match[2])) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      let start: number;
      let end: number;
      if (!match[1] && match[2]) {
        // Suffix byte range: bytes=-500
        const suffixLen = parseInt(match[2], 10);
        start = Math.max(0, total - suffixLen);
        end = total - 1;
      } else {
        start = parseInt(match[1], 10);
        end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
      }
      if (isNaN(start) || isNaN(end) || start > end || start >= total || start < 0) {
        res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
      res.setHeader('Content-Length', String(chunkSize));
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.socket?.setNoDelay(true);
      const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
      res.on('close', () => {
        if (!res.writableEnded) {
          stream.destroy();
        }
      });
      stream.on('error', () => {
        if (!res.headersSent) res.status(500);
        if (!res.writableEnded) res.end();
      });
      stream.pipe(res);
      return;
    }

    res.status(200);
    res.setHeader('Content-Length', String(total));
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.socket?.setNoDelay(true);
    const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    res.on('close', () => {
      if (!res.writableEnded) {
        stream.destroy();
      }
    });
    stream.on('error', () => {
      if (!res.headersSent) res.status(500);
      if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
  };

  app.get('/stream/media/:folder/:filename', handleMediaRangeStream);
  app.head('/stream/media/:folder/:filename', handleMediaRangeStream);
  app.get('/api/media/stream/:folder/:filename', handleMediaRangeStream);
  app.head('/api/media/stream/:folder/:filename', handleMediaRangeStream);

  // Real Email Domain & MX Record Validator
  app.get('/api/validate-email', async (req: Request, res: Response) => {
    const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ valid: false, reason: 'Formato de e-mail inválido.' });
      return;
    }

    const domain = email.split('@')[1] || '';
    const tld = domain.split('.').pop() || '';
    if (!/^[a-z]{2,}$/.test(tld)) {
      res.status(400).json({ valid: false, reason: 'Domínio de e-mail inválido.' });
      return;
    }

    if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      res.status(400).json({
        valid: false,
        reason: 'E-mails temporários ou descartáveis não são aceites. Utilize uma conta de e-mail real.',
      });
      return;
    }

    try {
      const mxRecords = await resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        res.status(400).json({
          valid: false,
          reason: `O domínio "@${domain}" não possui servidor de e-mail ativo (sem registos MX).`,
        });
        return;
      }
      res.json({ valid: true, domain, mxCount: mxRecords.length });
    } catch {
      res.status(400).json({
        valid: false,
        reason: `O domínio "@${domain}" não é um provedor de e-mail válido ou não responde.`,
      });
    }
  });

  // Stremio Addon Protocol / Metadata Proxy
  app.get('/api/addon-proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const target = isSafePublicUrl(rawUrl);
    if (!target) {
      res.status(400).json({ error: 'Invalid addon URL' });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const upstream = await fetch(target.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'application/json, text/plain, */*',
        },
      });
      clearTimeout(timer);

      if (!upstream.ok) {
        res.status(upstream.status).json({ error: `Upstream addon error (${upstream.status})` });
        return;
      }

      const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';
      const bodyText = await upstream.text();
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=120');
      res.send(bodyText);
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : 'Addon fetch failed';
      res.status(502).json({ error: message });
    }
  });

  // (probeMediaTarget & prepareVaultVideoForInstantPlayback defined earlier in startServer)

  // Media Stream Probe via ffprobe (inspects codecs, dimensions, duration, audio tracks)
  app.get('/api/probe', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const result = await probeMediaTarget(rawUrl);
    if (!result.ok || !result.info) {
      res.status(result.status || 500).json({
        error: result.error || 'Could not probe media stream',
        ...(result.missingFile ? { missingFile: true } : {}),
      });
      return;
    }
    res.json(result.info);
  });

  // HTTPS Streaming Proxy (fixes Mixed Content http:// IPTV streams, CORS blocks & HLS playlist rewriting)
  const IPTV_VLC_UA = 'VLC/3.0.20 LibVLC/3.0.20';

  app.get('/api/proxy', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const target = isSafePublicUrl(rawUrl);
    if (!target) {
      res.status(400).send('Invalid stream URL');
      return;
    }

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        controller.abort();
      }
    });
    const connectTimer = setTimeout(() => controller.abort(), 16000);

    const baseHeaders: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      Accept: '*/*',
      Connection: 'keep-alive',
    };
    if (typeof req.headers.range === 'string') {
      baseHeaders['Range'] = req.headers.range;
    }

    const attemptFetch = async (headers: Record<string, string>) =>
      fetch(target.toString(), {
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });

    const drainBodyQuietly = async (r: globalThis.Response) => {
      try {
        await r.body?.cancel();
      } catch {
        // ignore
      }
    };

    const fetchWithOptionalRetry = async () => {
      let upstream = await attemptFetch(baseHeaders);

      // Some IPTV/media origin servers reject Range requests on live/dynamic endpoints
      if (
        baseHeaders['Range'] &&
        (upstream.status === 400 || upstream.status === 405 || upstream.status === 416 || upstream.status === 501) &&
        !controller.signal.aborted
      ) {
        await drainBodyQuietly(upstream);
        const { Range: _omit, ...noRangeHeaders } = baseHeaders;
        upstream = await attemptFetch(noRangeHeaders);
      }

      // Retry blocked/server-error responses with matching Referer + Origin
      if (
        (upstream.status === 401 || upstream.status === 403 || upstream.status === 406 || upstream.status === 458 || upstream.status >= 500) &&
        !controller.signal.aborted
      ) {
        await drainBodyQuietly(upstream);
        upstream = await attemptFetch({
          ...baseHeaders,
          Referer: `${target.origin}/`,
          Origin: target.origin,
        });
      }

      // Final IPTV fallback: emulate VLC LibVLC User-Agent without Origin/Referer
      if (
        (upstream.status === 401 || upstream.status === 403 || upstream.status === 406 || upstream.status === 458) &&
        !controller.signal.aborted
      ) {
        await drainBodyQuietly(upstream);
        const { Range: _omit, ...noRange } = baseHeaders;
        upstream = await attemptFetch({
          ...noRange,
          'User-Agent': IPTV_VLC_UA,
        });
      }

      return upstream;
    };

    try {
      const upstream = await fetchWithOptionalRetry();
      clearTimeout(connectTimer);

      const finalUrl = upstream.url || target.toString();
      let decodedFinalUrl = finalUrl;
      try {
        decodedFinalUrl = decodeURIComponent(finalUrl);
      } catch {
        decodedFinalUrl = finalUrl;
      }
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const contentDisposition = (upstream.headers.get('content-disposition') || '').toLowerCase();
      const contentLengthHeader = Number(upstream.headers.get('content-length') || '0');
      const hasContentRange = upstream.headers.has('content-range');
      const isExplicitM3U8 =
        contentType.includes('mpegurl') ||
        finalUrl.toLowerCase().includes('.m3u8') ||
        target.pathname.toLowerCase().endsWith('.m3u8');

      const looksLikeBinaryMedia =
        upstream.status === 206 ||
        hasContentRange ||
        contentType.startsWith('video/') ||
        contentType.startsWith('audio/') ||
        contentType.startsWith('image/') ||
        (upstream.headers.has('content-length') && contentLengthHeader > 2 * 1024 * 1024) ||
        /\.(ts|mp4|m4v|mkv|avi|webm|mov|mp3|aac|flv)(?=[\?"'&\s]|$)/i.test(decodedFinalUrl) ||
        /\.(ts|mp4|m4v|mkv|avi|webm|mov|mp3|aac|flv)(?=[\?"'&\s]|$)/i.test(contentDisposition);

      const maybeTextPlaylist =
        upstream.ok && (isExplicitM3U8 || !looksLikeBinaryMedia);

      if (isExplicitM3U8 && upstream.ok) {
        const text = await upstream.text();
        if (text.trimStart().startsWith('#EXTM3U')) {
          const rewritten = rewriteM3U8(text, finalUrl);
          res.status(200);
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(rewritten);
          return;
        }
        res.status(upstream.status).send(text);
        return;
      }

      let prefetchedFirstChunk: Uint8Array | null = null;
      let bodyReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      if (maybeTextPlaylist && upstream.body) {
        bodyReader = upstream.body.getReader();
        const firstRead = await bodyReader.read();
        if (firstRead.value && firstRead.value.length > 0) {
          const headText = new TextDecoder('utf-8', { fatal: false }).decode(
            firstRead.value.subarray(0, 64)
          );
          if (headText.trimStart().startsWith('#EXTM3U')) {
            const chunks: Uint8Array[] = [firstRead.value];
            let totalLen = firstRead.value.length;
            while (!firstRead.done && totalLen < 4 * 1024 * 1024) {
              const nextRead = await bodyReader.read();
              if (nextRead.value) {
                chunks.push(nextRead.value);
                totalLen += nextRead.value.length;
              }
              if (nextRead.done) break;
            }
            const merged = Buffer.concat(chunks.map((c) => Buffer.from(c)));
            const fullText = merged.toString('utf8');
            const rewritten = rewriteM3U8(fullText, finalUrl);
            res.status(200);
            res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(rewritten);
            return;
          }
          prefetchedFirstChunk = firstRead.value;
        }
      }

      res.status(upstream.status);
      const passthroughHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control',
        'etag',
        'last-modified',
      ];
      for (const h of passthroughHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (!upstream.body) {
        res.end();
        return;
      }

      res.setHeader('X-Accel-Buffering', 'no');
      res.socket?.setNoDelay(true);
      res.socket?.setKeepAlive(true, 15000);

      let nodeStream: Readable;
      if (bodyReader) {
        let pushedFirst = false;
        nodeStream = new Readable({
          highWaterMark: 1024 * 1024,
          async read() {
            try {
              if (!pushedFirst && prefetchedFirstChunk) {
                pushedFirst = true;
                this.push(Buffer.from(prefetchedFirstChunk));
                prefetchedFirstChunk = null;
                return;
              }
              const { done, value } = await bodyReader!.read();
              if (done) {
                this.push(null);
              } else if (value) {
                this.push(Buffer.from(value));
              }
            } catch (readErr) {
              this.destroy(readErr as Error);
            }
          },
        });
      } else {
        nodeStream = Readable.fromWeb(upstream.body as any, { highWaterMark: 1024 * 1024 });
      }

      res.on('close', () => {
        if (!res.writableEnded) {
          nodeStream.destroy();
          bodyReader?.cancel().catch(() => {});
        }
      });
      nodeStream.on('error', () => {
        if (!res.headersSent) res.status(502);
        if (!res.writableEnded) res.end();
      });
      nodeStream.pipe(res);
    } catch (err) {
      clearTimeout(connectTimer);
      if ((err as Error)?.name === 'AbortError' && (res.writableEnded || res.destroyed)) return;
      if (!res.headersSent) {
        res.status((err as Error)?.name === 'AbortError' ? 504 : 502).send('Stream proxy error');
      }
    }
  });

  // On-the-fly FFmpeg Codec Remux / Transcode Endpoint (H.265/MKV/AVI/MPEG/DDP5.1 -> H.264+AAC Fragmented MP4)
  app.get('/api/transcode', (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const localInspection = inspectLocalStreamTarget(rawUrl);
    if (localInspection.isVaultPath && !localInspection.exists) {
      res.status(404).send('Media file not found on server');
      return;
    }
    const localFile = localInspection.exists ? localInspection.resolvedPath : null;
    const target = localFile ? null : isSafePublicUrl(rawUrl);
    if (!localFile && !target) {
      res.status(400).send('Invalid media URL');
      return;
    }

    const requestedVcodec: 'copy' | 'libx264' = req.query.vcodec === 'copy' ? 'copy' : 'libx264';
    const startSec = Number(req.query.t);
    const hasStart = Number.isFinite(startSec) && startSec > 0;
    const isLite = req.query.lite === '1';
    const isLiveStream =
      req.query.live === '1' ||
      (!localFile &&
        (/\.(m3u8|ts)(\?|$)/i.test(rawUrl) || /:\d{4,5}\/(play|live|stream|ch|ts)\b/i.test(rawUrl)));

    let activeFfmpeg: ReturnType<typeof spawn> | null = null;
    let clientAborted = false;

    const killActive = () => {
      if (activeFfmpeg && !activeFfmpeg.killed) {
        try {
          activeFfmpeg.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    };

    res.on('close', () => {
      if (!res.writableEnded) {
        clientAborted = true;
        killActive();
      }
    });

    const isHlsInput = !localFile && /\.m3u8(\?|$)/i.test(rawUrl);

    const runFfmpeg = (
      mode: 'copy' | 'libx264',
      allowFallbackToX264: boolean,
      userAgent = BROWSER_UA,
      allowVlcUaRetry = !localFile
    ) => {
      if (clientAborted || res.destroyed || res.writableEnded) return;

      const args: string[] = [
        '-hide_banner',
        '-loglevel',
        'error',
        '-analyzeduration',
        isLiveStream ? '1500000' : '1200000',
        '-probesize',
        isLiveStream ? '3000000' : '3000000',
        '-fflags',
        '+genpts+discardcorrupt+flush_packets',
        '-err_detect',
        'ignore_err',
      ];

      if (!localFile) {
        args.push(
          '-user_agent',
          userAgent,
          '-rw_timeout',
          '15000000',
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5'
        );
        if (isLiveStream && !isHlsInput) {
          args.push('-reconnect_at_eof', '1');
        }
      }

      if (hasStart) {
        args.push('-ss', String(Math.floor(startSec)));
      }

      args.push('-i', localFile || target!.toString());
      args.push(
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-sn',
        '-dn',
        '-avoid_negative_ts',
        'make_zero',
        '-max_interleave_delta',
        '0'
      );

      if (mode === 'copy') {
        args.push('-c:v', 'copy');
      } else {
        const videoFilter = isLite
          ? "scale='min(1280,iw)':-2,scale=trunc(iw/2)*2:trunc(ih/2)*2"
          : 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
        const rateControl = isLiveStream
          ? isLite
            ? ['-tune', 'zerolatency', '-maxrate', '2000k', '-bufsize', '4000k']
            : ['-tune', 'zerolatency']
          : isLite
            ? ['-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-maxrate', '2600k', '-bufsize', '5200k']
            : ['-g', '48', '-keyint_min', '48', '-sc_threshold', '0', '-maxrate', '8500k', '-bufsize', '17000k'];

        args.push(
          '-threads',
          '0',
          '-vf',
          videoFilter,
          '-c:v',
          'libx264',
          '-preset',
          isLiveStream ? 'ultrafast' : 'superfast',
          ...rateControl,
          '-pix_fmt',
          'yuv420p',
          '-profile:v',
          'high',
          '-level',
          '4.1',
          '-crf',
          isLite ? (isLiveStream ? '25' : '24') : '21'
        );
      }

      args.push(
        '-c:a',
        'aac',
        '-b:a',
        isLite ? '128k' : '192k',
        '-ac',
        '2',
        '-ar',
        '48000',
        '-max_muxing_queue_size',
        '4096',
        '-flush_packets',
        '1',
        '-movflags',
        'frag_keyframe+empty_moov+default_base_moof',
        '-f',
        'mp4',
        'pipe:1'
      );

      const ffmpeg = spawn('ffmpeg', args);
      activeFfmpeg = ffmpeg;

      let sentAnyBytes = false;
      const stderrChunks: string[] = [];

      ffmpeg.stderr?.on('data', (chunk: Buffer) => {
        if (stderrChunks.length < 16) {
          stderrChunks.push(chunk.toString('utf8'));
        }
      });

      ffmpeg.stdout?.on('data', (chunk: Buffer) => {
        if (clientAborted || res.destroyed || res.writableEnded) return;
        if (!sentAnyBytes) {
          sentAnyBytes = true;
          res.status(200);
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Accel-Buffering', 'no');
          res.socket?.setNoDelay(true);
          res.socket?.setKeepAlive(true, 15000);
        }
        const canContinue = res.write(chunk);
        if (!canContinue) {
          ffmpeg.stdout?.pause();
          res.once('drain', () => {
            if (!clientAborted && !res.destroyed && !res.writableEnded) {
              ffmpeg.stdout?.resume();
            }
          });
        }
      });

      ffmpeg.on('error', (err) => {
        if (clientAborted) return;
        if (!sentAnyBytes && mode === 'copy' && allowFallbackToX264) {
          runFfmpeg('libx264', false, userAgent, allowVlcUaRetry);
          return;
        }
        if (!res.headersSent) {
          res.status(500).send(err.message || 'FFmpeg spawn error');
        } else if (!res.writableEnded) {
          res.end();
        }
      });

      ffmpeg.on('close', (code) => {
        if (activeFfmpeg === ffmpeg) {
          activeFfmpeg = null;
        }
        if (clientAborted) return;
        if (!sentAnyBytes) {
          const stderrText = stderrChunks.join('').trim();
          if (allowVlcUaRetry && userAgent !== IPTV_VLC_UA && /\b(401|403|406|458|forbidden)\b/i.test(stderrText)) {
            console.warn('[transcode] retrying remote stream with IPTV VLC User-Agent');
            runFfmpeg(mode, allowFallbackToX264, IPTV_VLC_UA, false);
            return;
          }
          if (mode === 'copy' && allowFallbackToX264) {
            console.warn('[transcode] vcodec=copy exited with no output, auto-falling back to libx264:', stderrText);
            runFfmpeg('libx264', false, userAgent, false);
            return;
          }
          console.error(`[transcode] ffmpeg exited (code=${code}) before producing bytes:`, stderrText);
          if (!res.headersSent) {
            res.status(500).send(stderrText || 'FFmpeg could not transcode media stream');
          } else if (!res.writableEnded) {
            res.end();
          }
          return;
        }
        if (!res.writableEnded) {
          res.end();
        }
      });
    };

    runFfmpeg(requestedVcodec, requestedVcodec === 'copy');
  });

  // ---------------------------------------------------------------------------
  // Automatic Brazilian Portuguese (pt-BR) Subtitle Generation via FFmpeg + Gemini
  // ---------------------------------------------------------------------------
  const parseVttTimestampToMs = (raw: string): number | null => {
    const cleaned = raw.trim().replace(',', '.');
    const parts = cleaned.split(':');
    if (parts.length === 2) {
      const mins = Number(parts[0]);
      const secs = Number(parts[1]);
      if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
      return Math.round((mins * 60 + secs) * 1000);
    }
    if (parts.length === 3) {
      const hrs = Number(parts[0]);
      const mins = Number(parts[1]);
      const secs = Number(parts[2]);
      if (!Number.isFinite(hrs) || !Number.isFinite(mins) || !Number.isFinite(secs)) return null;
      return Math.round((hrs * 3600 + mins * 60 + secs) * 1000);
    }
    return null;
  };

  const formatMsToVtt = (ms: number): string => {
    const clamped = Math.max(0, Math.round(ms));
    const hrs = Math.floor(clamped / 3600000);
    const mins = Math.floor((clamped % 3600000) / 60000);
    const secs = Math.floor((clamped % 60000) / 1000);
    const millis = clamped % 1000;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  };

  const normalizeAndOffsetVttCues = (rawModelText: string, offsetSec: number): string[] => {
    const stripped = rawModelText
      .replace(/^```(?:webvtt|vtt|srt)?\s*/i, '')
      .replace(/```$/i, '')
      .replace(/\r\n/g, '\n')
      .trim();

    const blocks = stripped.split(/\n{2,}/);
    const cues: string[] = [];
    const offsetMs = Math.round(offsetSec * 1000);

    for (const block of blocks) {
      const lines = block
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => l.trim() !== '' && !/^WEBVTT/i.test(l.trim()) && !/^NOTE\b/i.test(l.trim()));

      if (lines.length === 0) continue;

      const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeLineIdx === -1) continue;

      const timeLine = lines[timeLineIdx];
      const arrowParts = timeLine.split('-->');
      if (arrowParts.length < 2) continue;

      const startMs = parseVttTimestampToMs(arrowParts[0]);
      const endToken = arrowParts[1].trim().split(/\s+/)[0] || '';
      const endMs = parseVttTimestampToMs(endToken);
      if (startMs === null || endMs === null || endMs <= startMs) continue;

      const textLines = lines.slice(timeLineIdx + 1).filter((l) => l.trim().length > 0);
      if (textLines.length === 0) continue;

      cues.push(`${formatMsToVtt(startMs + offsetMs)} --> ${formatMsToVtt(endMs + offsetMs)}\n${textLines.join('\n')}`);
    }

    return cues;
  };

  const probeMediaAudioAndDuration = (inputTarget: string, isLocal: boolean) =>
    new Promise<{ duration: number; hasAudio: boolean }>((resolve, reject) => {
      const args = isLocal
        ? ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', inputTarget]
        : ['-v', 'quiet', '-user_agent', BROWSER_UA, '-print_format', 'json', '-show_format', '-show_streams', inputTarget];
      const ffprobe = spawn('ffprobe', args);
      let stdout = '';
      const timer = setTimeout(() => {
        ffprobe.kill('SIGKILL');
        reject(new Error('Tempo limite excedido ao analisar o vídeo.'));
      }, 12000);

      ffprobe.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });
      ffprobe.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ffprobe.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0 || !stdout) {
          reject(new Error('Não foi possível analisar o ficheiro de vídeo.'));
          return;
        }
        try {
          const parsed = JSON.parse(stdout);
          const streams: any[] = Array.isArray(parsed.streams) ? parsed.streams : [];
          const hasAudio = streams.some((s) => s.codec_type === 'audio');
          const dur = parsed.format?.duration ? Number(parsed.format.duration) : 0;
          resolve({ duration: Number.isFinite(dur) ? dur : 0, hasAudio });
        } catch {
          reject(new Error('Resposta de análise inválida.'));
        }
      });
    });

  const extractAudioSliceMp3 = (
    inputTarget: string,
    isLocal: boolean,
    startSec: number,
    durationSec: number
  ): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      const args = ['-hide_banner', '-loglevel', 'error'];
      if (!isLocal) {
        args.push('-user_agent', BROWSER_UA);
      }
      if (startSec > 0) {
        args.push('-ss', String(Math.floor(startSec)));
      }
      args.push(
        '-i',
        inputTarget,
        '-t',
        String(Math.floor(durationSec)),
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '24k',
        '-f',
        'mp3',
        'pipe:1'
      );

      const ffmpeg = spawn('ffmpeg', args);
      const chunks: Buffer[] = [];
      let stderrMsg = '';
      const timer = setTimeout(() => {
        ffmpeg.kill('SIGKILL');
        reject(new Error('Tempo limite excedido ao extrair áudio do filme.'));
      }, 90000);

      ffmpeg.stdout.on('data', (d: Buffer) => chunks.push(d));
      ffmpeg.stderr.on('data', (d: Buffer) => {
        stderrMsg += d.toString('utf8');
      });
      ffmpeg.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      ffmpeg.on('close', (code) => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        if (code !== 0 || buf.length < 256) {
          reject(new Error(stderrMsg.trim() || 'Falha ao extrair faixa de áudio para legendagem.'));
          return;
        }
        resolve(buf);
      });
    });

  app.post('/api/subtitles/auto-generate', async (req: Request, res: Response) => {
    try {
      const { mediaId, title, videoUrl, targetLang = 'pt-BR' } = req.body || {};
      const cleanVideoUrl = typeof videoUrl === 'string' ? unwrapProxyOrTranscodeUrl(videoUrl) : '';
      if (!cleanVideoUrl) {
        res.status(400).json({ error: 'URL do vídeo em falta para gerar legendas.' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'Chave de IA do servidor (GEMINI_API_KEY) não configurada.' });
        return;
      }

      const localFile = resolveLocalStreamFile(cleanVideoUrl);
      const remoteUrl = localFile ? null : isSafePublicUrl(cleanVideoUrl);
      if (!localFile && !remoteUrl) {
        res.status(400).json({ error: 'Fonte de vídeo inválida ou inacessível para legendagem.' });
        return;
      }

      const inputTarget = localFile || remoteUrl!.toString();
      const probe = await probeMediaAudioAndDuration(inputTarget, Boolean(localFile));
      if (!probe.hasAudio) {
        res.status(400).json({ error: 'Este filme não contém faixa de áudio para transcrição automática.' });
        return;
      }

      const totalDuration = probe.duration > 0 ? probe.duration : 600;
      const SLICE_SECONDS = 600; // 10 minutes per chunk (~1.8MB MP3 @ 24kbps)
      const MAX_SLICES = 18; // Up to 3 hours of video
      const sliceCount = Math.min(MAX_SLICES, Math.max(1, Math.ceil(totalDuration / SLICE_SECONDS)));

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const allCues: string[] = [];
      const movieTitle = typeof title === 'string' && title.trim() ? title.trim() : 'Filme';

      for (let i = 0; i < sliceCount; i++) {
        const startSec = i * SLICE_SECONDS;
        const remaining = totalDuration - startSec;
        if (remaining <= 1) break;
        const sliceLen = Math.min(SLICE_SECONDS, Math.ceil(remaining));

        const audioBuf = await extractAudioSliceMp3(inputTarget, Boolean(localFile), startSec, sliceLen);
        const base64Audio = audioBuf.toString('base64');

        const promptText = `Você é um legendador profissional de cinema em Português do Brasil (pt-BR).
Analise todo o áudio deste trecho de "${movieTitle}" (trecho ${i + 1} de ${sliceCount}, duração ~${sliceLen}s) e gere legendas completas, naturais e perfeitamente sincronizadas em Português (Brasil) (${targetLang}).
- Se o áudio estiver noutro idioma (inglês, espanhol, francês, etc.), traduza os diálogos para Português do Brasil fluido e natural.
- Se o áudio já estiver em português, transcreva com ortografia brasileira correta.
- Os timestamps devem começar em 00:00:00.000 relativos ao início DESTE clipe de áudio (formato exato HH:MM:SS.mmm --> HH:MM:SS.mmm).
- Quebre falas longas em linhas curtas (máximo 2 linhas por legenda, ~42 caracteres por linha).
- Responda APENAS com o conteúdo WebVTT começando por WEBVTT, sem explicações e sem blocos de código markdown.`;

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: 'audio/mp3',
                    data: base64Audio,
                  },
                },
                { text: promptText },
              ],
            },
          ],
        });

        const rawText = aiResponse.text || '';
        const chunkCues = normalizeAndOffsetVttCues(rawText, startSec);
        allCues.push(...chunkCues);
      }

      if (allCues.length === 0) {
        res.status(422).json({
          error: 'Não foram detetadas falas suficientes para criar legendas neste áudio.',
        });
        return;
      }

      const vttContent = `WEBVTT\nKind: captions\nLanguage: pt-BR\n\n${allCues.join('\n\n')}\n`;
      const rawId = typeof mediaId === 'string' && mediaId.trim() ? mediaId.trim() : movieTitle;
      const safeStem = rawId
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || `sub_${Date.now()}`;
      const vttFilename = `${safeStem}_pt-BR.vtt`;
      const vttPath = resolveVaultFilePath('subtitles', vttFilename);

      if (!vttPath) {
        res.status(500).json({ error: 'Caminho de destino inválido para gravar legenda.' });
        return;
      }

      ensureMediaVaultDirs();
      fs.writeFileSync(vttPath, vttContent, 'utf8');

      const streamSubUrl = `/stream/media/subtitles/${encodeURIComponent(vttFilename)}`;
      const label = 'Português (Brasil) • Auto IA';

      // Update server catalog-movies.json if this movie is stored there
      if (typeof mediaId === 'string' && mediaId.trim()) {
        const existingMovies = readServerCatalogMovies();
        let changed = false;
        const updatedMovies = existingMovies.map((m) => {
          if (m && m.id === mediaId) {
            changed = true;
            const prevSubs = Array.isArray(m.generatedSubtitles) ? m.generatedSubtitles : [];
            const filtered = prevSubs.filter((s: any) => s?.lang !== 'pt-BR');
            return {
              ...m,
              subtitles: Array.from(new Set([...(Array.isArray(m.subtitles) ? m.subtitles : []), 'Português (Brasil)'])),
              generatedSubtitles: [
                {
                  lang: 'pt-BR',
                  label,
                  url: streamSubUrl,
                  generatedAt: new Date().toISOString(),
                },
                ...filtered,
              ],
            };
          }
          return m;
        });
        if (changed) {
          writeServerCatalogMovies(updatedMovies);
        }
      }

      res.json({
        ok: true,
        mediaId,
        lang: 'pt-BR',
        label,
        url: streamSubUrl,
        cuesCount: allCues.length,
        vttContent,
      });
    } catch (err) {
      console.error('Auto-subtitle generation error:', err);
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao gerar legendas automáticas em Português (Brasil).',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Online Portuguese Subtitle Search Endpoint (OpenSubtitles v3 + Wyzie + Local)
  // ---------------------------------------------------------------------------
  app.get('/api/subtitles/search-online', async (req: Request, res: Response) => {
    try {
      const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
      let imdbId = typeof req.query.imdbId === 'string' ? req.query.imdbId.trim() : '';
      const rawType = typeof req.query.type === 'string' ? req.query.type : 'movie';
      const year = Number(req.query.year);
      const stremioType = rawType === 'series' ? 'series' : 'movie';

      if (!imdbId && title) {
        const resolved = await resolveImdbIdServerSide(
          title,
          stremioType,
          Number.isFinite(year) && year > 1900 ? year : undefined
        );
        if (resolved?.imdbId) {
          imdbId = resolved.imdbId;
        }
      }

      const foundSubtitles: Array<{
        id: string;
        label: string;
        lang: 'pt-BR' | 'pt-PT' | 'pt';
        url: string;
        source: string;
        format?: string;
      }> = [];

      // 1. Query OpenSubtitles v3 public Stremio addon if imdbId available
      if (imdbId && /^tt\d+/i.test(imdbId)) {
        try {
          const lookupId = stremioType === 'series' && !imdbId.includes(':') ? `${imdbId}:1:1` : imdbId;
          const openSubUrl = `https://opensubtitles-v3.strem.io/subtitles/${stremioType}/${encodeURIComponent(lookupId)}.json`;
          const subRes = await fetch(openSubUrl, {
            headers: { 'User-Agent': BROWSER_UA },
            signal: AbortSignal.timeout(6000),
          });
          if (subRes.ok) {
            const data: any = await subRes.json();
            const list = Array.isArray(data?.subtitles) ? data.subtitles : [];
            for (const item of list) {
              const langRaw = String(item.lang || '').toLowerCase();
              const isPtBr = langRaw.includes('br') || langRaw === 'pob';
              const isPtPt = langRaw.includes('pt') || langRaw === 'por';
              if (isPtBr || isPtPt) {
                const normalizedLang = isPtBr ? 'pt-BR' : 'pt-PT';
                const flag = isPtBr ? '🇧🇷' : '🇵🇹';
                const langName = isPtBr ? 'Português (Brasil)' : 'Português (Portugal)';
                foundSubtitles.push({
                  id: `opensub-${item.id || Math.random().toString(36).slice(2, 8)}`,
                  label: `${flag} ${langName} - OpenSubtitles v3`,
                  lang: normalizedLang,
                  url: item.url,
                  source: 'OpenSubtitles v3',
                  format: item.format || 'srt',
                });
              }
            }
          }
        } catch {
          // ignore external network timeout
        }
      }

      // 2. Query Wyzie Subtitles API (covers massive collection of pt-BR / pt-PT subs)
      if (imdbId && /^tt\d+/i.test(imdbId)) {
        try {
          const wyzieUrl = `https://sub.wyzie.ru/search?id=${encodeURIComponent(imdbId)}`;
          const wyzieRes = await fetch(wyzieUrl, {
            headers: { 'User-Agent': BROWSER_UA },
            signal: AbortSignal.timeout(5000),
          });
          if (wyzieRes.ok) {
            const list: any = await wyzieRes.json();
            if (Array.isArray(list)) {
              for (const sub of list) {
                const subLang = String(sub.display || sub.lang || '').toLowerCase();
                const isBr = subLang.includes('bra') || subLang.includes('br') || subLang.includes('pob');
                const isPt = subLang.includes('portug') || subLang.includes('pt') || subLang.includes('por');
                if (isBr || isPt) {
                  const normalizedLang = isBr ? 'pt-BR' : 'pt-PT';
                  const flag = isBr ? '🇧🇷' : '🇵🇹';
                  const langName = isBr ? 'Português (Brasil)' : 'Português (Portugal)';
                  foundSubtitles.push({
                    id: `wyzie-${sub.id || Math.random().toString(36).slice(2, 8)}`,
                    label: `${flag} ${langName} - ${sub.display || 'Wyzie Subs'}`,
                    lang: normalizedLang,
                    url: sub.url,
                    source: 'Wyzie Subtitles',
                    format: 'srt',
                  });
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }

      // 3. Check locally stored / generated subtitles in media_vault/subtitles
      try {
        const localSubs = fs.readdirSync(MEDIA_SUBTITLES_DIR);
        const titleStem = sanitizeFilename(title || '').replace(/\.[^/.]+$/, '').toLowerCase();
        for (const f of localSubs) {
          if (f.endsWith('.vtt') || f.endsWith('.srt')) {
            const fLower = f.toLowerCase();
            if (titleStem && fLower.includes(titleStem.slice(0, 16))) {
              const isBr = fLower.includes('br') || fLower.includes('pt');
              foundSubtitles.push({
                id: `vault-sub-${f}`,
                label: `🇧🇷 Português (Brasil) - Servidor Local (${f})`,
                lang: isBr ? 'pt-BR' : 'pt-PT',
                url: `/stream/media/subtitles/${encodeURIComponent(f)}`,
                source: 'Servidor Local Salgueiro',
                format: f.endsWith('.vtt') ? 'vtt' : 'srt',
              });
            }
          }
        }
      } catch {}

      // Deduplicate by URL
      const seen = new Set<string>();
      const deduped = foundSubtitles.filter((s) => {
        if (!s.url || seen.has(s.url)) return false;
        seen.add(s.url);
        return true;
      });

      res.json({ ok: true, subtitles: deduped });
    } catch (err) {
      console.error('Online subtitle search error:', err);
      res.json({ ok: true, subtitles: [] });
    }
  });

  // ---------------------------------------------------------------------------
  // Server-Side IPTV Channel Health Checker (removes dead/unresponsive channels)
  // ---------------------------------------------------------------------------
  app.post('/api/iptv/check-channels', async (req: Request, res: Response) => {
    try {
      const channels = Array.isArray(req.body?.channels) ? req.body.channels : [];
      if (channels.length === 0) {
        res.json({ results: [] });
        return;
      }

      const capped = channels.slice(0, 300);
      const urlProbeCache = new Map<string, Promise<{ alive: boolean; status?: number; reason?: string }>>();

      const probeSingleUrl = async (rawUrl: string): Promise<{ alive: boolean; status?: number; reason?: string }> => {
        const trimmed = String(rawUrl || '').trim();
        if (!trimmed) return { alive: false, reason: 'URL vazio' };

        const localFile = resolveLocalStreamFile(trimmed);
        if (localFile) {
          return fs.existsSync(localFile)
            ? { alive: true, status: 200 }
            : { alive: false, status: 404, reason: 'Ficheiro local inexistente' };
        }

        const target = isSafePublicUrl(trimmed);
        if (!target) {
          return { alive: false, reason: 'URL inválido ou privado' };
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        try {
          let upstream = await fetch(target.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'User-Agent': BROWSER_UA,
              Accept: '*/*',
            },
          });

          if (upstream.status === 403 && !controller.signal.aborted) {
            upstream = await fetch(target.toString(), {
              method: 'GET',
              redirect: 'follow',
              signal: controller.signal,
              headers: {
                'User-Agent': BROWSER_UA,
                Referer: `${target.origin}/`,
                Origin: target.origin,
                Accept: '*/*',
              },
            });
          }

          if (!upstream.ok) {
            controller.abort();
            clearTimeout(timer);
            return { alive: false, status: upstream.status, reason: `HTTP ${upstream.status}` };
          }

          const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
          let headText = '';
          if (upstream.body) {
            const reader = upstream.body.getReader();
            try {
              const { value } = await reader.read();
              if (value) {
                headText = new TextDecoder('utf-8', { fatal: false }).decode(value.slice(0, 512));
              }
            } finally {
              reader.cancel().catch(() => {});
            }
          }
          controller.abort();
          clearTimeout(timer);

          const headLower = headText.trimStart().toLowerCase();
          if (headLower.startsWith('<!doctype html') || headLower.startsWith('<html')) {
            return { alive: false, status: upstream.status, reason: 'Página HTML em vez de stream' };
          }
          const expectsM3U8 =
            contentType.includes('mpegurl') ||
            target.pathname.toLowerCase().endsWith('.m3u8');
          if (expectsM3U8 && headText.trim().length > 0 && !headText.includes('#EXT')) {
            return { alive: false, status: upstream.status, reason: 'Playlist M3U8 inválida' };
          }

          return { alive: true, status: upstream.status };
        } catch (err) {
          clearTimeout(timer);
          const msg = (err as Error)?.name === 'AbortError' ? 'Timeout sem resposta' : 'Erro de ligação';
          return { alive: false, reason: msg };
        }
      };

      const checkChannel = (ch: { id: string; videoUrl: string }) => {
        const urlKey = String(ch.videoUrl || '').trim();
        let cached = urlProbeCache.get(urlKey);
        if (!cached) {
          cached = probeSingleUrl(urlKey);
          urlProbeCache.set(urlKey, cached);
        }
        return cached.then((probe) => ({
          id: String(ch.id),
          alive: probe.alive,
          status: probe.status,
          reason: probe.reason,
        }));
      };

      const results: { id: string; alive: boolean; status?: number; reason?: string }[] = [];
      const BATCH_SIZE = 10;
      for (let i = 0; i < capped.length; i += BATCH_SIZE) {
        const batch = capped.slice(i, i + BATCH_SIZE);
        const batchRes = await Promise.all(batch.map(checkChannel));
        results.push(...batchRes);
      }

      res.json({ results });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao verificar estado dos canais.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Web Original Movie / Series Cover & Banner Artwork Search
  // ---------------------------------------------------------------------------
  interface ArtworkSearchResult {
    id: string;
    title: string;
    originalTitle: string;
    year: number;
    posterUrl: string;
    bannerUrl: string;
    synopsis: string;
    genres: string[];
    imdbScore: number;
    type: 'movie' | 'series';
    source: string;
  }

  const findMovieArtworkOnWeb = async (
    rawQuery: string,
    requestedType: 'movie' | 'series' | 'all' = 'all'
  ): Promise<{ query: string; results: ArtworkSearchResult[] }> => {
    const cleanedQuery = rawQuery
      .replace(/\.(mp4|mkv|avi|mpeg|mpg|mov|webm|ts|m4v)$/i, '')
      .replace(/[\._]+/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|hdr|bluray|bdrip|webrip|web-dl|dvdrip|hdrip|x264|x265|hevc|aac|ac3|dublado|legendado|pt-br|pt-pt|international\s*premiere)\b/gi, ' ')
      .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanedQuery || cleanedQuery.length < 2) {
      return { query: cleanedQuery, results: [] };
    }

    const fetchWithTimeout = async (url: string, timeoutMs = 5500) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        });
        clearTimeout(timer);
        if (!r.ok) return null;
        return await r.json();
      } catch {
        clearTimeout(timer);
        return null;
      }
    };

    const queryCinemeta = async (mediaType: 'movie' | 'series'): Promise<ArtworkSearchResult[]> => {
      const data = await fetchWithTimeout(
        `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/search=${encodeURIComponent(cleanedQuery)}.json`
      );
      const metas = Array.isArray(data?.metas) ? data.metas : [];
      return metas
        .filter((m: any) => m && m.poster)
        .slice(0, 8)
        .map((m: any) => {
          const yearMatch = String(m.releaseInfo || m.year || '').match(/\d{4}/);
          const poster = String(m.poster).replace('/poster/small/', '/poster/medium/');
          const fallbackMetahubBg =
            typeof m.id === 'string' && m.id.startsWith('tt')
              ? `https://images.metahub.space/background/medium/${m.id}/img`
              : poster;
          const banner = String(m.background || fallbackMetahubBg).replace('/background/small/', '/background/medium/');
          return {
            id: `cinemeta-${m.id || m.name}`,
            title: String(m.name || cleanedQuery),
            originalTitle: String(m.name || cleanedQuery),
            year: yearMatch ? Number(yearMatch[0]) : 2025,
            posterUrl: poster,
            bannerUrl: banner,
            synopsis: typeof m.description === 'string' ? m.description : '',
            genres: Array.isArray(m.genres) ? m.genres.slice(0, 4).map(String) : ['Internacional'],
            imdbScore: m.imdbRating && Number.isFinite(Number(m.imdbRating)) ? Number(m.imdbRating) : 7.8,
            type: mediaType,
            source: 'Cinemeta / IMDb',
          };
        });
    };

    const queryItunes = async (media: 'movie' | 'tvShow'): Promise<ArtworkSearchResult[]> => {
      const data = await fetchWithTimeout(
        `https://itunes.apple.com/search?term=${encodeURIComponent(cleanedQuery)}&media=${media}&limit=6`
      );
      const items = Array.isArray(data?.results) ? data.results : [];
      return items
        .filter((it: any) => it && (it.artworkUrl100 || it.artworkUrl60))
        .map((it: any) => {
          const rawArt = String(it.artworkUrl100 || it.artworkUrl60);
          const hiResPoster = rawArt.replace(/\/\d+x\d+bb\./, '/600x900bb.');
          const hiResBanner = rawArt.replace(/\/\d+x\d+bb\./, '/1200x675bb.');
          const yearMatch = String(it.releaseDate || '').match(/\d{4}/);
          return {
            id: `itunes-${it.trackId || it.collectionId || Math.random()}`,
            title: String(it.trackName || it.collectionName || cleanedQuery),
            originalTitle: String(it.trackName || it.collectionName || cleanedQuery),
            year: yearMatch ? Number(yearMatch[0]) : 2025,
            posterUrl: hiResPoster,
            bannerUrl: hiResBanner,
            synopsis: String(it.longDescription || it.shortDescription || ''),
            genres: it.primaryGenreName ? ['Internacional', String(it.primaryGenreName)] : ['Internacional'],
            imdbScore: 8.0,
            type: media === 'tvShow' ? 'series' : 'movie',
            source: 'Apple TV / iTunes',
          };
        });
    };

    const queryTvMaze = async (): Promise<ArtworkSearchResult[]> => {
      const data = await fetchWithTimeout(
        `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(cleanedQuery)}`
      );
      const list = Array.isArray(data) ? data : [];
      const top = list.filter((entry: any) => entry?.show?.image?.original || entry?.show?.image?.medium).slice(0, 4);
      const mapped = await Promise.all(
        top.map(async (entry: any, idx: number): Promise<ArtworkSearchResult> => {
          const s = entry.show;
          const yearMatch = String(s.premiered || '').match(/\d{4}/);
          const cleanSummary = String(s.summary || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          const poster = String(s.image?.original || s.image?.medium);
          let banner = poster;
          if (idx === 0 && s.id) {
            const imgs = await fetchWithTimeout(`https://api.tvmaze.com/shows/${s.id}/images`, 3000);
            if (Array.isArray(imgs)) {
              const bgImg = imgs.find((im: any) => im?.type === 'background' && im?.resolutions?.original?.url);
              const bannerImg = imgs.find((im: any) => im?.type === 'banner' && im?.resolutions?.original?.url);
              banner = bgImg?.resolutions?.original?.url || bannerImg?.resolutions?.original?.url || poster;
            }
          }
          return {
            id: `tvmaze-${s.id}`,
            title: String(s.name || cleanedQuery),
            originalTitle: String(s.name || cleanedQuery),
            year: yearMatch ? Number(yearMatch[0]) : 2025,
            posterUrl: poster,
            bannerUrl: banner,
            synopsis: cleanSummary,
            genres: Array.isArray(s.genres) && s.genres.length > 0 ? s.genres.slice(0, 4) : ['Internacional'],
            imdbScore: s.rating?.average ? Number(s.rating.average) : 7.8,
            type: 'series' as const,
            source: 'TVMaze',
          };
        })
      );
      return mapped;
    };

    const queryWikipediaArtwork = async (lang: 'en' | 'pt'): Promise<ArtworkSearchResult[]> => {
      const searchSuffix = lang === 'en' ? 'film' : 'filme';
      const searchTerm = `${cleanedQuery} ${searchSuffix}`;
      const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        searchTerm
      )}&gsrlimit=4&prop=pageimages|extracts&piprop=original|thumbnail&pithumbsize=900&exintro=1&explaintext=1&exchars=260&format=json&origin=*`;
      const data = await fetchWithTimeout(apiUrl, 4500);
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      return (pages as any[])
        .filter((p) => p && (p.original?.source || p.thumbnail?.source))
        .map((p) => {
          const img = String(p.original?.source || p.thumbnail?.source);
          return {
            id: `wiki-${lang}-${p.pageid}`,
            title: String(p.title || cleanedQuery).replace(/\s*\([^)]*\)$/, ''),
            originalTitle: String(p.title || cleanedQuery).replace(/\s*\([^)]*\)$/, ''),
            year: 2025,
            posterUrl: img,
            bannerUrl: img,
            synopsis: typeof p.extract === 'string' ? p.extract : '',
            genres: ['Internacional'],
            imdbScore: 7.8,
            type: 'movie' as const,
            source: `Wikipedia (${lang.toUpperCase()})`,
          };
        });
    };

    const tasks: Promise<ArtworkSearchResult[]>[] = [
      queryCinemeta(requestedType === 'series' ? 'series' : 'movie'),
      queryItunes(requestedType === 'series' ? 'tvShow' : 'movie'),
    ];
    if (requestedType === 'all') {
      tasks.push(queryCinemeta('series'));
      tasks.push(queryTvMaze());
    } else if (requestedType === 'series') {
      tasks.push(queryTvMaze());
    }
    tasks.push(queryWikipediaArtwork('en'));
    tasks.push(queryWikipediaArtwork('pt'));

    const settled = await Promise.allSettled(tasks);
    const merged: ArtworkSearchResult[] = [];
    const seenPoster = new Set<string>();

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        for (const item of outcome.value) {
          const key = item.posterUrl.trim();
          if (key && !seenPoster.has(key)) {
            seenPoster.add(key);
            merged.push(item);
          }
        }
      }
    }

    return {
      query: cleanedQuery,
      results: merged.slice(0, 18),
    };
  };

  app.get('/api/movies/search-artwork', async (req: Request, res: Response) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
    const requestedType = req.query.type === 'series' ? 'series' : req.query.type === 'movie' ? 'movie' : 'all';

    const { query, results } = await findMovieArtworkOnWeb(rawQuery, requestedType);
    res.json({
      ok: true,
      query,
      results,
    });
  });

  app.post('/api/movies/batch-search-artwork', async (req: Request, res: Response) => {
    const itemsInput: Array<{ id: string; title: string; originalTitle?: string; type?: string }> = Array.isArray(
      req.body?.movies
    )
      ? req.body.movies.filter((m: any) => m && typeof m.id === 'string' && typeof m.title === 'string')
      : [];

    if (itemsInput.length === 0) {
      res.json({ ok: true, artworks: {} });
      return;
    }

    try {
      const artworks: Record<string, ServerMovieArtworkEntry> = {};
      const CONCURRENCY = 4;
      let cursor = 0;

      const worker = async () => {
        while (cursor < itemsInput.length) {
          const m = itemsInput[cursor++];
          if (!m) break;
          const q = (m.originalTitle || m.title).trim();
          const mType = m.type === 'series' ? 'series' : 'movie';
          const { results } = await findMovieArtworkOnWeb(q, mType);
          const best = results[0];
          if (best && best.posterUrl) {
            artworks[m.id] = {
              thumbnailUrl: best.posterUrl,
              bannerUrl: best.bannerUrl || best.posterUrl,
              originalTitle: best.originalTitle || best.title,
              source: best.source,
            };
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, itemsInput.length) }, () => worker()));
      res.json({ ok: true, artworks });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao procurar capas e banners na web.',
      });
    }
  });

  app.get('/api/movies/artworks', (_req: Request, res: Response) => {
    res.json({ ok: true, artworks: readServerMovieArtworks() });
  });

  app.post('/api/movies/artworks', (req: Request, res: Response) => {
    const incoming = req.body?.artworks;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      res.status(400).json({ error: 'Formato inválido de capas e banners.' });
      return;
    }
    const existing = readServerMovieArtworks();
    const merged: Record<string, ServerMovieArtworkEntry> = { ...existing };
    for (const [k, v] of Object.entries(incoming as Record<string, any>)) {
      if (typeof k === 'string' && v && typeof v.thumbnailUrl === 'string' && v.thumbnailUrl.trim()) {
        merged[k] = {
          thumbnailUrl: v.thumbnailUrl.trim(),
          bannerUrl: typeof v.bannerUrl === 'string' && v.bannerUrl.trim() ? v.bannerUrl.trim() : v.thumbnailUrl.trim(),
          originalTitle: typeof v.originalTitle === 'string' ? v.originalTitle : undefined,
          source: typeof v.source === 'string' ? v.source : undefined,
        };
      }
    }
    writeServerMovieArtworks(merged);
    res.json({ ok: true, artworks: merged });
  });

  // ---------------------------------------------------------------------------
  // Web TV Channel Logo Search & Matching (iptv-org + Wikimedia Commons + Wikipedia)
  // ---------------------------------------------------------------------------
  interface IptvOrgChannelEntry {
    id: string;
    name: string;
    normName: string;
    altNamesNorm: string[];
    country: string;
    logoUrl: string;
    format: string;
  }

  let iptvOrgIndexCache: { fetchedAt: number; entries: IptvOrgChannelEntry[] } | null = null;
  let iptvOrgIndexInFlight: Promise<IptvOrgChannelEntry[]> | null = null;

  const normalizeChannelToken = (raw: string): string =>
    raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const extractChannelSearchMeta = (rawName: string) => {
    const lower = rawName.toLowerCase();
    let countryHint = '';
    if (/\bangola\b/i.test(lower)) countryHint = 'AO';
    else if (/\bportugal\b/i.test(lower)) countryHint = 'PT';
    else if (/\b(brasil|brazil)\b/i.test(lower)) countryHint = 'BR';
    else if (/\b(mozambique|mocambique|moçambique)\b/i.test(lower)) countryHint = 'MZ';
    else if (/\bfrance\b/i.test(lower)) countryHint = 'FR';
    else if (/\b(spain|espanha)\b/i.test(lower)) countryHint = 'ES';
    else if (/\b(uk|united kingdom)\b/i.test(lower)) countryHint = 'GB';
    else if (/\b(usa|united states|us)\b/i.test(lower)) countryHint = 'US';

    const cleanName = rawName
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\((?:\d{3,4}p|4k|uhd|fhd|hd|sd|geo-blocked|not 24\/7|portugal|brasil|brazil|angola|usa|uk|france|spain|opt-\d+|backup)\)/gi, ' ')
      .replace(/\b(1080p|720p|576p|480p|360p|2160p|4k|uhd|fhd|hd|sd|h264|h265|hevc)\b/gi, ' ')
      .replace(/\s+(angola|portugal|brazil|brasil)\s*$/i, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const core = cleanName || rawName.trim();
    const normCore = normalizeChannelToken(core);
    const aliases: string[] = [core];

    if (/^tpa(\s*[12])?$/i.test(normCore) || /\btpa\s*1\b/i.test(normCore)) {
      aliases.push('Televisão Pública de Angola');
      aliases.push('TPA Angola');
    } else if (/^rtp(\s*[123]|africa|internacional)?$/i.test(normCore)) {
      aliases.push(core.toUpperCase());
      aliases.push('Rádio e Televisão de Portugal');
    } else if (/\bzimbo\b/i.test(normCore)) {
      aliases.push('TV Zimbo');
    }

    return { cleanName: core, normCore, countryHint, aliases };
  };

  const loadIptvOrgChannelIndex = async (): Promise<IptvOrgChannelEntry[]> => {
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (iptvOrgIndexCache && Date.now() - iptvOrgIndexCache.fetchedAt < SIX_HOURS_MS) {
      return iptvOrgIndexCache.entries;
    }
    if (iptvOrgIndexInFlight) {
      return iptvOrgIndexInFlight;
    }

    iptvOrgIndexInFlight = (async () => {
      try {
        const fetchJson = async (url: string) => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          try {
            const r = await fetch(url, {
              signal: controller.signal,
              headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
            });
            clearTimeout(timer);
            if (!r.ok) return null;
            return await r.json();
          } catch {
            clearTimeout(timer);
            return null;
          }
        };

        const [channelsRaw, logosRaw] = await Promise.all([
          fetchJson('https://iptv-org.github.io/api/channels.json'),
          fetchJson('https://iptv-org.github.io/api/logos.json'),
        ]);

        const logoByChannel = new Map<string, { url: string; format: string }>();
        if (Array.isArray(logosRaw)) {
          for (const item of logosRaw) {
            if (!item?.channel || !item?.url) continue;
            const urlStr = String(item.url);
            if (!/^https?:\/\//i.test(urlStr)) continue;
            const fmt = String(item.format || '').toUpperCase();
            const existing = logoByChannel.get(item.channel);
            // Prefer PNG/SVG/WEBP, avoid tiny or broken formats
            const rank = (f: string) => (f === 'PNG' ? 4 : f === 'SVG' ? 3 : f === 'WEBP' ? 2 : 1);
            if (!existing || rank(fmt) > rank(existing.format)) {
              logoByChannel.set(item.channel, { url: urlStr, format: fmt || 'IMG' });
            }
          }
        }

        const entries: IptvOrgChannelEntry[] = [];
        if (Array.isArray(channelsRaw)) {
          for (const ch of channelsRaw) {
            if (!ch?.id || !ch?.name) continue;
            const logoInfo = logoByChannel.get(ch.id);
            if (!logoInfo) continue;
            const altList = Array.isArray(ch.alt_names) ? ch.alt_names : [];
            entries.push({
              id: String(ch.id),
              name: String(ch.name),
              normName: normalizeChannelToken(String(ch.name)),
              altNamesNorm: altList.map((a: any) => normalizeChannelToken(String(a))).filter(Boolean),
              country: String(ch.country || '').toUpperCase(),
              logoUrl: logoInfo.url,
              format: logoInfo.format,
            });
          }
        }

        iptvOrgIndexCache = { fetchedAt: Date.now(), entries };
        return entries;
      } finally {
        iptvOrgIndexInFlight = null;
      }
    })();

    return iptvOrgIndexInFlight;
  };

  interface ChannelLogoCandidate {
    id: string;
    channelName: string;
    logoUrl: string;
    source: string;
    country?: string;
    score: number;
  }

  const scoreChannelMatch = (
    entry: IptvOrgChannelEntry,
    normQuery: string,
    queryTokens: string[],
    countryHint: string
  ): number => {
    if (!normQuery) return 0;
    const compactQ = normQuery.replace(/\s+/g, '');
    const compactName = entry.normName.replace(/\s+/g, '');

    let baseScore = 0;
    if (entry.normName === normQuery || compactName === compactQ) {
      baseScore = 100;
    } else if (entry.altNamesNorm.some((a) => a === normQuery || a.replace(/\s+/g, '') === compactQ)) {
      baseScore = 94;
    } else if (
      entry.normName.startsWith(`${normQuery} `) ||
      normQuery.startsWith(`${entry.normName} `)
    ) {
      baseScore = 78;
    } else if (queryTokens.length >= 2) {
      const entryTokens = entry.normName.split(' ');
      const matchedCount = queryTokens.filter((t) => entryTokens.includes(t)).length;
      if (matchedCount === queryTokens.length) {
        baseScore = 76;
      } else if (matchedCount >= Math.max(2, queryTokens.length - 1)) {
        baseScore = 55;
      }
    } else if (queryTokens.length === 1 && queryTokens[0].length >= 4) {
      if (entry.normName.includes(queryTokens[0])) {
        baseScore = 62;
      }
    }

    if (baseScore === 0) return 0;
    if (countryHint && entry.country === countryHint) {
      baseScore += 18;
    }
    // Slight preference for lusophone / international clear logos
    if (!countryHint && ['AO', 'PT', 'BR', 'US', 'GB'].includes(entry.country)) {
      baseScore += 4;
    }
    return baseScore;
  };

  const fetchWebJsonTimeout = async (url: string, timeoutMs = 5500) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!r.ok) return null;
      return await r.json();
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  const searchWikimediaAndWikipediaLogos = async (
    queryTerm: string,
    cleanName: string
  ): Promise<ChannelLogoCandidate[]> => {
    const results: ChannelLogoCandidate[] = [];

    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      `${queryTerm} logo`
    )}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=480&format=json`;
    const ptWikiUrl = `https://pt.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      queryTerm
    )}&gsrlimit=5&prop=pageimages&pithumbsize=500&format=json`;
    const enWikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      `${queryTerm} TV channel`
    )}&gsrlimit=4&prop=pageimages&pithumbsize=500&format=json`;

    const [commonsData, ptWikiData, enWikiData] = await Promise.all([
      fetchWebJsonTimeout(commonsUrl),
      fetchWebJsonTimeout(ptWikiUrl),
      fetchWebJsonTimeout(enWikiUrl),
    ]);

    const normClean = normalizeChannelToken(cleanName);
    const cleanTokens = normClean.split(' ').filter((t) => t.length >= 2);

    const commonsPages = commonsData?.query?.pages ? Object.values(commonsData.query.pages) : [];
    for (const p of commonsPages as any[]) {
      const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
      const url = String(info?.thumburl || info?.url || '');
      const mime = String(info?.mime || '');
      const title = String(p?.title || '').replace(/^File:/i, '');
      if (!url || !/^https?:\/\//i.test(url)) continue;
      if (!mime.startsWith('image/') && !/\.(png|svg|jpg|jpeg|webp)$/i.test(url)) continue;
      const normTitle = normalizeChannelToken(title);
      const tokenHits = cleanTokens.filter((t) => normTitle.includes(t)).length;
      if (cleanTokens.length > 0 && tokenHits === 0) continue;
      const hasLogoWord = normTitle.includes('logo') || normTitle.includes('logotipo');
      results.push({
        id: `commons-${p.pageid || title}`,
        channelName: title.replace(/\.[a-z0-9]+$/i, ''),
        logoUrl: url,
        source: 'Wikimedia Commons',
        score: 70 + tokenHits * 8 + (hasLogoWord ? 10 : 0),
      });
    }

    const pushWikiPages = (data: any, label: string) => {
      const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
      for (const p of pages as any[]) {
        const thumbUrl = String(p?.thumbnail?.source || '');
        const pageTitle = String(p?.title || '');
        if (!thumbUrl || !/^https?:\/\//i.test(thumbUrl)) continue;
        const normTitle = normalizeChannelToken(pageTitle);
        const tokenHits = cleanTokens.filter((t) => normTitle.includes(t)).length;
        if (cleanTokens.length > 0 && tokenHits === 0) continue;
        results.push({
          id: `${label}-${p.pageid || pageTitle}`,
          channelName: pageTitle,
          logoUrl: thumbUrl,
          source: label,
          score: 68 + tokenHits * 7,
        });
      }
    };

    pushWikiPages(ptWikiData, 'Wikipedia PT');
    pushWikiPages(enWikiData, 'Wikipedia EN');

    return results;
  };

  const searchChannelLogosOnWeb = async (
    rawName: string,
    options?: { quickBatch?: boolean }
  ): Promise<{ cleanName: string; results: ChannelLogoCandidate[] }> => {
    const meta = extractChannelSearchMeta(rawName);
    const iptvEntries = await loadIptvOrgChannelIndex().catch(() => []);
    const queryTokens = meta.normCore.split(' ').filter(Boolean);

    const iptvMatches: ChannelLogoCandidate[] = [];
    for (const entry of iptvEntries) {
      const sc = scoreChannelMatch(entry, meta.normCore, queryTokens, meta.countryHint);
      if (sc >= 55) {
        iptvMatches.push({
          id: `iptv-org-${entry.id}`,
          channelName: entry.name,
          logoUrl: entry.logoUrl,
          source: `iptv-org (${entry.country || 'Global'})`,
          country: entry.country,
          score: sc,
        });
      }
    }
    iptvMatches.sort((a, b) => b.score - a.score);

    const topIptvScore = iptvMatches[0]?.score || 0;
    let webFallbackMatches: ChannelLogoCandidate[] = [];

    // Always run Wikimedia/Wikipedia for interactive single search, or in batch when iptv-org had no strong match
    if (!options?.quickBatch || topIptvScore < 85) {
      const searchAlias = meta.aliases.find((a) => a !== meta.cleanName) || meta.cleanName;
      webFallbackMatches = await searchWikimediaAndWikipediaLogos(searchAlias, meta.cleanName).catch(() => []);
    }

    const combined = [...iptvMatches.slice(0, 12), ...webFallbackMatches].sort((a, b) => b.score - a.score);
    const deduped: ChannelLogoCandidate[] = [];
    const seenUrls = new Set<string>();
    for (const item of combined) {
      if (!seenUrls.has(item.logoUrl)) {
        seenUrls.add(item.logoUrl);
        deduped.push(item);
      }
    }

    return {
      cleanName: meta.cleanName,
      results: deduped.slice(0, 16),
    };
  };

  app.get('/api/channels/search-logo', async (req: Request, res: Response) => {
    const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!rawName || rawName.length < 2) {
      res.json({ ok: true, query: rawName, cleanName: rawName, results: [] });
      return;
    }

    try {
      const { cleanName, results } = await searchChannelLogosOnWeb(rawName, { quickBatch: false });
      res.json({ ok: true, query: rawName, cleanName, results });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao procurar logótipo do canal na web.',
      });
    }
  });

  app.post('/api/channels/search-logos', async (req: Request, res: Response) => {
    const channelsInput: Array<{ id: string; name: string }> = Array.isArray(req.body?.channels)
      ? req.body.channels.filter((c: any) => c && typeof c.name === 'string' && c.name.trim().length > 0)
      : [];

    if (channelsInput.length === 0) {
      res.json({ ok: true, logos: {} });
      return;
    }

    try {
      // Pre-warm index once before fanning out concurrent lookups
      await loadIptvOrgChannelIndex().catch(() => []);

      const logos: Record<string, { logoUrl: string; matchedName: string; source: string }> = {};
      const CONCURRENCY = 6;
      let cursor = 0;

      const worker = async () => {
        while (cursor < channelsInput.length) {
          const item = channelsInput[cursor++];
          if (!item) break;
          const { results } = await searchChannelLogosOnWeb(item.name, { quickBatch: true });
          const best = results[0];
          if (best && best.logoUrl) {
            logos[String(item.id)] = {
              logoUrl: best.logoUrl,
              matchedName: best.channelName,
              source: best.source,
            };
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, channelsInput.length) }, () => worker()));
      res.json({ ok: true, logos });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao procurar logótipos de canais na web.',
      });
    }
  });

  app.get('/api/channels/logos', (_req: Request, res: Response) => {
    res.json({ ok: true, logos: readServerChannelLogos() });
  });

  app.post('/api/channels/logos', (req: Request, res: Response) => {
    const incoming = req.body?.logos;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      res.status(400).json({ error: 'Formato inválido de logótipos.' });
      return;
    }
    const existing = readServerChannelLogos();
    const merged: Record<string, string> = { ...existing };
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof k === 'string' && typeof v === 'string' && v.trim()) {
        merged[k] = v.trim();
      }
    }
    writeServerChannelLogos(merged);
    res.json({ ok: true, logos: merged });
  });

  // ---------------------------------------------------------------------------
  // IMDb ID Resolution & Intelligent Best-Server Discovery / Benchmarking
  // ---------------------------------------------------------------------------
  const cleanSearchTitleForWeb = (rawTitle: string): string =>
    rawTitle
      .replace(/\.(mp4|mkv|avi|mpeg|mpg|mov|webm|ts|m4v|wmv|flv)$/i, '')
      .replace(/[\._]+/g, ' ')
      .replace(/\b(1080p|720p|2160p|4k|hdr|bluray|bdrip|webrip|web-dl|dvdrip|hdrip|x264|x265|hevc|aac|aac5\.1|ac3|eac3|dts|dublado|legendado|dual\s*audio|pt-br|pt-pt|yts|rarbg)\b/gi, ' ')
      .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
      .replace(/\b(19\d{2}|20\d{2})\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const resolveImdbIdServerSide = async (
    rawTitle: string,
    type: 'movie' | 'series' | 'all' = 'all',
    preferredYear?: number
  ): Promise<{ imdbId: string; title: string; year?: number; type: 'movie' | 'series' } | null> => {
    const cleaned = cleanSearchTitleForWeb(rawTitle);
    if (!cleaned || cleaned.length < 2) return null;

    const queryTokens = normalizeChannelToken(cleaned).split(' ').filter((t) => t.length >= 2);
    const searchTypes: Array<'movie' | 'series'> =
      type === 'series' ? ['series'] : type === 'movie' ? ['movie'] : ['movie', 'series'];

    const fetchCinemeta = async (mediaType: 'movie' | 'series') => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(
          `https://v3-cinemeta.strem.io/catalog/${mediaType}/top/search=${encodeURIComponent(cleaned)}.json`,
          {
            signal: controller.signal,
            headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
          }
        );
        clearTimeout(timer);
        if (!res.ok) return [];
        const data = await res.json().catch(() => null);
        return Array.isArray(data?.metas)
          ? data.metas.slice(0, 8).map((m: any) => ({ ...m, _mediaType: mediaType }))
          : [];
      } catch {
        clearTimeout(timer);
        return [];
      }
    };

    const candidates = (await Promise.all(searchTypes.map(fetchCinemeta))).flat();
    let bestMatch: { imdbId: string; title: string; year?: number; type: 'movie' | 'series'; score: number } | null = null;

    for (const m of candidates) {
      const id = String(m?.imdb_id || m?.id || '');
      if (!/^tt\d+$/i.test(id)) continue;
      const candidateName = String(m?.name || '');
      const normCand = normalizeChannelToken(candidateName);
      const normQuery = normalizeChannelToken(cleaned);
      const candTokens = normCand.split(' ').filter((t) => t.length >= 2);
      const yearMatch = String(m?.releaseInfo || m?.year || '').match(/\d{4}/);
      const candYear = yearMatch ? Number(yearMatch[0]) : undefined;

      let score = 0;
      if (normCand === normQuery) score += 100;
      else if (normCand.startsWith(normQuery) || normQuery.startsWith(normCand)) score += 75;
      else if (queryTokens.length > 0) {
        const hits = queryTokens.filter((t) => candTokens.includes(t)).length;
        score += (hits / Math.max(queryTokens.length, candTokens.length)) * 70;
      }

      if (preferredYear && candYear) {
        const diff = Math.abs(preferredYear - candYear);
        if (diff === 0) score += 20;
        else if (diff === 1) score += 10;
      }

      if (score >= 45 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          imdbId: id,
          title: candidateName,
          year: candYear,
          type: m._mediaType,
          score,
        };
      }
    }

    return bestMatch
      ? {
          imdbId: bestMatch.imdbId,
          title: bestMatch.title,
          year: bestMatch.year,
          type: bestMatch.type,
        }
      : null;
  };

  app.get('/api/movies/resolve-imdb', async (req: Request, res: Response) => {
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const rawType = typeof req.query.type === 'string' ? req.query.type : 'all';
    const type: 'movie' | 'series' | 'all' =
      rawType === 'series' ? 'series' : rawType === 'movie' ? 'movie' : 'all';
    const yearNum = Number(req.query.year);
    const match = await resolveImdbIdServerSide(
      title,
      type,
      Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : undefined
    );
    res.json({ ok: true, match });
  });

  interface IptvOrgStreamIndexEntry {
    id: string;
    name: string;
    normName: string;
    altNamesNorm: string[];
    country: string;
    streams: Array<{ url: string; quality?: string }>;
  }

  let iptvOrgStreamsCache: { fetchedAt: number; entries: IptvOrgStreamIndexEntry[] } | null = null;
  let iptvOrgStreamsInFlight: Promise<IptvOrgStreamIndexEntry[]> | null = null;

  const loadIptvOrgStreamsIndex = async (): Promise<IptvOrgStreamIndexEntry[]> => {
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (iptvOrgStreamsCache && Date.now() - iptvOrgStreamsCache.fetchedAt < SIX_HOURS_MS) {
      return iptvOrgStreamsCache.entries;
    }
    if (iptvOrgStreamsInFlight) {
      return iptvOrgStreamsInFlight;
    }

    iptvOrgStreamsInFlight = (async () => {
      try {
        const [channelsRaw, streamsRaw] = await Promise.all([
          fetchWebJsonTimeout('https://iptv-org.github.io/api/channels.json', 12000),
          fetchWebJsonTimeout('https://iptv-org.github.io/api/streams.json', 14000),
        ]);

        const streamsByChannel = new Map<string, Array<{ url: string; quality?: string }>>();
        if (Array.isArray(streamsRaw)) {
          for (const st of streamsRaw) {
            if (!st?.channel || !st?.url) continue;
            const urlStr = String(st.url).trim();
            if (!/^https?:\/\//i.test(urlStr)) continue;
            const chId = String(st.channel);
            const list = streamsByChannel.get(chId) || [];
            if (!list.some((x) => x.url === urlStr)) {
              list.push({
                url: urlStr,
                quality: st.quality ? String(st.quality) : undefined,
              });
              streamsByChannel.set(chId, list);
            }
          }
        }

        const entries: IptvOrgStreamIndexEntry[] = [];
        if (Array.isArray(channelsRaw)) {
          for (const ch of channelsRaw) {
            if (!ch?.id || !ch?.name) continue;
            const chStreams = streamsByChannel.get(String(ch.id));
            if (!chStreams || chStreams.length === 0) continue;
            const altList = Array.isArray(ch.alt_names) ? ch.alt_names : [];
            entries.push({
              id: String(ch.id),
              name: String(ch.name),
              normName: normalizeChannelToken(String(ch.name)),
              altNamesNorm: altList.map((a: any) => normalizeChannelToken(String(a))).filter(Boolean),
              country: String(ch.country || '').toUpperCase(),
              streams: chStreams,
            });
          }
        }

        iptvOrgStreamsCache = { fetchedAt: Date.now(), entries };
        return entries;
      } finally {
        iptvOrgStreamsInFlight = null;
      }
    })();

    return iptvOrgStreamsInFlight;
  };

  const discoverIptvOrgChannelStreams = async (
    channelName: string,
    maxMatches = 8
  ): Promise<Array<{ url: string; channelName: string; country: string; quality?: string; matchScore: number }>> => {
    const meta = extractChannelSearchMeta(channelName);
    const entries = await loadIptvOrgStreamsIndex().catch(() => []);
    if (entries.length === 0) return [];

    const searchQueries = Array.from(new Set([meta.normCore, ...meta.aliases.map(normalizeChannelToken)].filter(Boolean)));
    const scored: Array<{ entry: IptvOrgStreamIndexEntry; score: number }> = [];

    for (const entry of entries) {
      let bestScore = 0;
      for (const q of searchQueries) {
        const tokens = q.split(' ').filter(Boolean);
        const s = scoreChannelMatch(
          {
            id: entry.id,
            name: entry.name,
            normName: entry.normName,
            altNamesNorm: entry.altNamesNorm,
            country: entry.country,
            logoUrl: '',
            format: '',
          },
          q,
          tokens,
          meta.countryHint
        );
        if (s > bestScore) bestScore = s;
      }
      if (bestScore >= 60) {
        scored.push({ entry, score: bestScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const discovered: Array<{ url: string; channelName: string; country: string; quality?: string; matchScore: number }> = [];
    const seenUrls = new Set<string>();

    for (const item of scored.slice(0, 6)) {
      for (const st of item.entry.streams) {
        if (!seenUrls.has(st.url)) {
          seenUrls.add(st.url);
          discovered.push({
            url: st.url,
            channelName: item.entry.name,
            country: item.entry.country,
            quality: st.quality,
            matchScore: item.score,
          });
          if (discovered.length >= maxMatches) return discovered;
        }
      }
    }

    return discovered;
  };

  const searchArchiveOrgMovieStreams = async (
    rawTitle: string
  ): Promise<Array<{ url: string; label: string; quality?: string }>> => {
    const cleaned = cleanSearchTitleForWeb(rawTitle);
    if (!cleaned || cleaned.length < 3) return [];
    const queryTokens = normalizeChannelToken(cleaned).split(' ').filter((t) => t.length >= 2);
    if (queryTokens.length === 0) return [];

    const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
      `title:("${cleaned}") AND mediatype:(movies)`
    )}&fl[]=identifier&fl[]=title&rows=4&output=json`;
    const searchData = await fetchWebJsonTimeout(searchUrl, 4500);
    const docs = Array.isArray(searchData?.response?.docs) ? searchData.response.docs : [];
    if (docs.length === 0) return [];

    const matchedDocs = docs.filter((d: any) => {
      const tNorm = normalizeChannelToken(String(d?.title || ''));
      const hits = queryTokens.filter((tok) => tNorm.includes(tok)).length;
      return hits === queryTokens.length;
    });
    if (matchedDocs.length === 0) return [];

    const streams: Array<{ url: string; label: string; quality?: string }> = [];
    for (const doc of matchedDocs.slice(0, 2)) {
      const id = String(doc.identifier || '').trim();
      if (!id) continue;
      const meta = await fetchWebJsonTimeout(`https://archive.org/metadata/${encodeURIComponent(id)}/files`, 4000);
      const files = Array.isArray(meta?.result) ? meta.result : [];
      const mp4File = files.find(
        (f: any) =>
          typeof f?.name === 'string' &&
          /\.mp4$/i.test(f.name) &&
          Number(f.size || 0) > 2 * 1024 * 1024
      );
      if (mp4File) {
        streams.push({
          url: `https://archive.org/download/${encodeURIComponent(id)}/${mp4File.name
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`,
          label: `Internet Archive • ${String(doc.title || cleaned)}`,
          quality: 'MP4 Web',
        });
      }
    }
    return streams;
  };

  interface RemoteProbeCheckResult {
    alive: boolean;
    status?: number;
    latencyMs: number;
    contentType: string;
    detectedQuality?: string;
    isHls: boolean;
    isMpegTs: boolean;
    needsProxy: boolean;
    needsTranscode: boolean;
    needsRemux?: boolean;
    reason?: string;
  }

  const probeCandidateStreamUrl = async (rawUrl: string): Promise<RemoteProbeCheckResult> => {
    const trimmed = String(rawUrl || '').trim();
    const target = isSafePublicUrl(trimmed);
    if (!target) {
      return {
        alive: false,
        latencyMs: 9999,
        contentType: '',
        isHls: false,
        isMpegTs: false,
        needsProxy: false,
        needsTranscode: false,
        reason: 'URL inválido ou privado',
      };
    }

    const cacheEntry = remoteProbeCache.get(target.toString());
    if (cacheEntry && Date.now() - cacheEntry.ts < 60000) {
      return cacheEntry.result;
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      let upstream = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: '*/*',
          Range: 'bytes=0-65535',
        },
      });

      if (
        (upstream.status === 416 || upstream.status === 400 || upstream.status === 405 || upstream.status === 501) &&
        !controller.signal.aborted
      ) {
        try {
          await upstream.body?.cancel();
        } catch {}
        upstream = await fetch(target.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: '*/*',
          },
        });
      }

      if ((upstream.status === 401 || upstream.status === 403 || upstream.status === 406) && !controller.signal.aborted) {
        try {
          await upstream.body?.cancel();
        } catch {}
        upstream = await fetch(target.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': BROWSER_UA,
            Referer: `${target.origin}/`,
            Origin: target.origin,
            Accept: '*/*',
          },
        });
      }

      if ((upstream.status === 401 || upstream.status === 403 || upstream.status === 406) && !controller.signal.aborted) {
        try {
          await upstream.body?.cancel();
        } catch {}
        upstream = await fetch(target.toString(), {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
          headers: {
            'User-Agent': IPTV_VLC_UA,
            Accept: '*/*',
          },
        });
      }

      const latencyMs = Math.max(1, Date.now() - startedAt);
      if (!upstream.ok) {
        controller.abort();
        clearTimeout(timer);
        return {
          alive: false,
          status: upstream.status,
          latencyMs,
          contentType: '',
          isHls: false,
          isMpegTs: false,
          needsProxy: false,
          needsTranscode: false,
          reason: `HTTP ${upstream.status}`,
        };
      }

      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const contentDisposition = (upstream.headers.get('content-disposition') || '').toLowerCase();
      const finalUrl = (upstream.url || target.toString()).toLowerCase();
      let decodedFinalUrl = finalUrl;
      try {
        decodedFinalUrl = decodeURIComponent(finalUrl);
      } catch {
        decodedFinalUrl = finalUrl;
      }
      let headText = '';
      if (upstream.body) {
        const reader = upstream.body.getReader();
        try {
          const collected: Uint8Array[] = [];
          let totalBytes = 0;
          while (totalBytes < 4096) {
            const { done, value } = await reader.read();
            if (value) {
              collected.push(value);
              totalBytes += value.length;
            }
            if (done) break;
          }
          if (collected.length > 0) {
            headText = new TextDecoder('utf-8', { fatal: false }).decode(
              Buffer.concat(collected.map((c) => Buffer.from(c))).subarray(0, 4096)
            );
          }
        } finally {
          reader.cancel().catch(() => {});
        }
      }
      controller.abort();
      clearTimeout(timer);

      const headLower = headText.trimStart().toLowerCase();
      if (headLower.startsWith('<!doctype html') || headLower.startsWith('<html')) {
        return {
          alive: false,
          status: upstream.status,
          latencyMs,
          contentType,
          isHls: false,
          isMpegTs: false,
          needsProxy: false,
          needsTranscode: false,
          reason: 'Página HTML em vez de stream',
        };
      }

      const isHls =
        contentType.includes('mpegurl') ||
        finalUrl.includes('.m3u8') ||
        headText.trimStart().startsWith('#EXTM3U');

      if ((contentType.includes('mpegurl') || finalUrl.endsWith('.m3u8')) && headText.trim().length > 0 && !headText.includes('#EXT')) {
        return {
          alive: false,
          status: upstream.status,
          latencyMs,
          contentType,
          isHls: false,
          isMpegTs: false,
          needsProxy: false,
          needsTranscode: false,
          reason: 'Playlist M3U8 inválida',
        };
      }

      let detectedQuality: string | undefined;
      const resMatches = Array.from(headText.matchAll(/RESOLUTION=\d+x(\d+)/gi)).map((m) => Number(m[1]));
      if (resMatches.length > 0) {
        const maxH = Math.max(...resMatches);
        if (maxH >= 2160) detectedQuality = '4K';
        else if (maxH >= 1080) detectedQuality = '1080p';
        else if (maxH >= 720) detectedQuality = '720p';
        else if (maxH >= 480) detectedQuality = '480p';
      } else {
        const urlQual = `${decodedFinalUrl} ${contentDisposition}`.match(/\b(2160p|4k|1080p|720p|480p)\b/i);
        if (urlQual) detectedQuality = urlQual[1].toUpperCase();
      }

      const isMpegTs =
        !isHls &&
        (contentType.includes('mp2t') ||
          finalUrl.includes('.ts') ||
          /:\d{4,5}\/(play|live|stream|ch|ts)\b/i.test(finalUrl));
      const hintSource = `${decodedFinalUrl} ${contentDisposition}`;
      const isMatroska =
        !isHls &&
        (contentType.includes('matroska') || /\.(mkv|m2ts|mts|asf)(?=[\?"'&\s]|$)/i.test(hintSource));
      const hasLegacyOrHevcHint =
        /\b(x265|h\.?265|hevc|10bit|10-bit|divx|xvid)\b/i.test(hintSource) ||
        /\.(avi|mpg|mpeg|wmv|vob|flv|3gp|ogv)(?=[\?"'&\s]|$)/i.test(hintSource);
      const needsTranscode = !isHls && hasLegacyOrHevcHint;
      const needsRemux = !isHls && !needsTranscode && isMatroska;
      const isHttpPlain = target.protocol === 'http:';
      const corsHeader = upstream.headers.get('access-control-allow-origin');
      const needsProxy = isHttpPlain || (!corsHeader && (isHls || isMpegTs));

      const finalResult: RemoteProbeCheckResult = {
        alive: true,
        status: upstream.status,
        latencyMs,
        contentType,
        detectedQuality,
        isHls,
        isMpegTs,
        needsProxy,
        needsTranscode,
        needsRemux,
      };
      if (remoteProbeCache.size >= 200) {
        const firstKey = remoteProbeCache.keys().next().value;
        if (firstKey) remoteProbeCache.delete(firstKey);
      }
      remoteProbeCache.set(target.toString(), { ts: Date.now(), result: finalResult });
      return finalResult;
    } catch (err) {
      clearTimeout(timer);
      return {
        alive: false,
        latencyMs: Math.max(1, Date.now() - startedAt),
        contentType: '',
        isHls: false,
        isMpegTs: false,
        needsProxy: false,
        needsTranscode: false,
        reason: (err as Error)?.name === 'AbortError' ? 'Timeout sem resposta' : 'Erro de ligação',
      };
    }
  };

  interface RankedPlaybackServer {
    id: string;
    label: string;
    source: string;
    url: string;
    playbackUrl: string;
    engine: 'html5' | 'hls' | 'mpegts' | 'proxy' | 'transcode' | 'auto' | 'torrent';
    vcodec?: 'copy' | 'libx264';
    latencyMs: number;
    quality: string;
    alive: boolean;
    recommended: boolean;
    reason: string;
    score: number;
    isLocalVault?: boolean;
  }

  app.post('/api/servers/find-best', async (req: Request, res: Response) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const originalTitle = typeof req.body?.originalTitle === 'string' ? req.body.originalTitle.trim() : '';
      const rawType = typeof req.body?.type === 'string' ? req.body.type : 'movie';
      const contentType: 'movie' | 'series' | 'live_tv' =
        rawType === 'live_tv' ? 'live_tv' : rawType === 'series' ? 'series' : 'movie';
      const year = typeof req.body?.year === 'number' ? req.body.year : undefined;
      const incomingImdbId = typeof req.body?.imdbId === 'string' ? req.body.imdbId.trim() : '';
      const currentUrl = typeof req.body?.currentUrl === 'string' ? req.body.currentUrl.trim() : '';
      const searchWeb = req.body?.searchWeb !== false;
      const rawCandidates: Array<{ url: string; label?: string; source?: string; quality?: string }> = Array.isArray(
        req.body?.candidateUrls
      )
        ? req.body.candidateUrls
        : [];

      const lookupTitle = originalTitle || title;
      const forceWeb = Boolean(req.body?.forceWebMovieSearch);
      const cacheKey = `${contentType}|${lookupTitle.toLowerCase()}|${currentUrl}|${rawCandidates.length}|${searchWeb}`;
      if (!forceWeb && rawCandidates.length === 0) {
        const cached = findBestResponseCache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 30000) {
          res.json(cached.payload);
          return;
        }
      }
      const normalizedCurrentRaw = currentUrl ? unwrapProxyOrTranscodeUrl(currentUrl) : '';
      const localInspect = normalizedCurrentRaw ? inspectLocalStreamTarget(normalizedCurrentRaw) : { isVaultPath: false, exists: false, resolvedPath: null };
      let vaultPath: string | null = null;
      let resolvedStreamPath: string | null = null;

      if (localInspect.isVaultPath && localInspect.exists) {
        vaultPath = localInspect.resolvedStreamPath || normalizedCurrentRaw;
        if (vaultPath.startsWith('http://') || vaultPath.startsWith('https://')) {
          try {
            vaultPath = new URL(vaultPath).pathname;
          } catch {
            // keep
          }
        }
        if (localInspect.resolvedStreamPath) {
          resolvedStreamPath = localInspect.resolvedStreamPath;
        }
      } else if (contentType !== 'live_tv') {
        // Fallback locator: find uploaded movie file by filename/title/originalTitle inside media_vault/videos
        const hints = [normalizedCurrentRaw, title, originalTitle].filter(Boolean);
        for (const h of hints) {
          const matchedVault = findMatchingVaultVideoFile(h, true);
          if (matchedVault) {
            vaultPath = matchedVault.streamPath;
            resolvedStreamPath = matchedVault.streamPath;
            break;
          }
        }
        if (!vaultPath && localInspect.isVaultPath) {
          if (normalizedCurrentRaw.startsWith('http://') || normalizedCurrentRaw.startsWith('https://')) {
            try {
              vaultPath = new URL(normalizedCurrentRaw).pathname;
            } catch {
              vaultPath = normalizedCurrentRaw;
            }
          } else {
            vaultPath = normalizedCurrentRaw;
          }
        }
      }

      let resolvedImdbId: string | null = /^tt\d+$/i.test(incomingImdbId) ? incomingImdbId : null;
      let probeInfo: ServerProbeResult | null = null;
      let vaultExists = false;

      const servers: RankedPlaybackServer[] = [];

      // 1. Inspect Local Vault Movie (admin-uploaded files) & rank optimal playback servers
      if (vaultPath) {
        const vaultProbe = await probeMediaTarget(vaultPath);
        if (vaultProbe.ok && vaultProbe.info) {
          vaultExists = true;
          probeInfo = vaultProbe.info;
          const p = vaultProbe.info;
          const qualLabel =
            p.height >= 2160
              ? '4K UHD'
              : p.height >= 1080
                ? '1080p Full HD'
                : p.height >= 720
                  ? '720p HD'
                  : p.height > 0
                    ? `${p.height}p`
                    : 'Original';

          const directSafe =
            !p.hasSkippedChunks &&
            !p.needsVideoTranscode &&
            !p.needsAudioTranscode &&
            !p.needsRemux;
          const remuxBest = !directSafe && !p.needsVideoTranscode;
          const transcodeBest = !directSafe && p.needsVideoTranscode;

          servers.push({
            id: 'vault-direct',
            label: 'Salgueiro Vault Direto (HTTP 206)',
            source: 'Servidor Local do Administrador',
            url: vaultPath,
            playbackUrl: vaultPath,
            engine: 'html5',
            latencyMs: 2,
            quality: `${qualLabel} (${p.videoCodec.toUpperCase()}/${p.audioCodec.toUpperCase()})`,
            alive: true,
            recommended: directSafe,
            reason: directSafe
              ? 'Codec nativo 100% compatível com o browser (latência zero)'
              : p.hasSkippedChunks
                ? 'Ficheiro com blocos recuperados — Remux FFmpeg é mais estável'
                : 'Contentor/codec requer ajuste FFmpeg para reprodução universal',
            score: directSafe ? 1200 : 750,
            isLocalVault: true,
          });

          servers.push({
            id: 'vault-remux',
            label: 'Salgueiro FFmpeg Remux (Stream Copy + AAC)',
            source: 'Servidor Local + FFmpeg Remux',
            url: vaultPath,
            playbackUrl: `/api/transcode?vcodec=copy&url=${encodeURIComponent(vaultPath)}`,
            engine: 'transcode',
            vcodec: 'copy',
            latencyMs: 4,
            quality: `${qualLabel} • Stream Copy + AAC`,
            alive: true,
            recommended: remuxBest,
            reason: remuxBest
              ? 'Melhor servidor: mantém vídeo original sem recodificar e normaliza contentor/áudio/blocos'
              : 'Remux rápido com reparação automática de frames',
            score: remuxBest ? 1250 : p.needsVideoTranscode ? 820 : 980,
            isLocalVault: true,
          });

          servers.push({
            id: 'vault-transcode',
            label: 'Salgueiro FFmpeg Transcoder (H.264 + AAC)',
            source: 'Servidor Local + FFmpeg Universal',
            url: vaultPath,
            playbackUrl: `/api/transcode?vcodec=libx264&url=${encodeURIComponent(vaultPath)}`,
            engine: 'transcode',
            vcodec: 'libx264',
            latencyMs: 6,
            quality: `${qualLabel} • H.264 High + AAC 2.0`,
            alive: true,
            recommended: transcodeBest,
            reason: transcodeBest
              ? `Melhor servidor: converte ${p.videoCodec.toUpperCase()} ${p.is10Bit ? '10-bit ' : ''}para H.264 + AAC universal`
              : 'Compatibilidade garantida em qualquer browser ou Smart TV',
            score: transcodeBest ? 1280 : 920,
            isLocalVault: true,
          });
        } else {
          // Local vault file missing (e.g. server reset) — keep diagnostic entry as offline
          servers.push({
            id: 'vault-missing',
            label: 'Servidor Local (Ficheiro em Falta)',
            source: 'Armazenamento Local',
            url: vaultPath,
            playbackUrl: vaultPath,
            engine: 'html5',
            latencyMs: 0,
            quality: 'Indisponível',
            alive: false,
            recommended: false,
            reason: 'Ficheiro local não encontrado — a procurar alternativas na web...',
            score: -100,
            isLocalVault: true,
          });
        }
      }

      // 2. Discover Web Sources when searchWeb=true (or when primary vault file is missing / external)
      const remoteQueue: Array<{
        url: string;
        label: string;
        source: string;
        quality?: string;
        priorityBoost: number;
      }> = [];
      const seenCandidateUrls = new Set<string>();

      const pushRemoteCandidate = (
        url: string,
        label: string,
        source: string,
        priorityBoost: number,
        quality?: string
      ) => {
        const clean = unwrapProxyOrTranscodeUrl(String(url || '').trim());
        if (!clean || clean.startsWith('/stream/media/') || clean.startsWith('/api/media/stream/')) return;
        if (/pengu/i.test(clean) || /pengu/i.test(label) || /pengu/i.test(source)) return;
        if (seenCandidateUrls.has(clean)) return;
        seenCandidateUrls.add(clean);
        remoteQueue.push({ url: clean, label, source, quality, priorityBoost });
      };

      if (normalizedCurrentRaw && !vaultPath && /^https?:\/\//i.test(normalizedCurrentRaw)) {
        pushRemoteCandidate(
          normalizedCurrentRaw,
          contentType === 'live_tv' ? 'Servidor Principal do Canal' : 'Servidor Principal do Filme',
          'Servidor Principal',
          450
        );
      } else if (normalizedCurrentRaw && normalizedCurrentRaw.startsWith('magnet:')) {
        servers.push({
          id: `magnet-${servers.length}`,
          label: 'WebTorrent P2P (Magnet)',
          source: 'Rede P2P',
          url: normalizedCurrentRaw,
          playbackUrl: normalizedCurrentRaw,
          engine: 'torrent',
          latencyMs: 50,
          quality: 'P2P',
          alive: true,
          recommended: false,
          reason: 'Reprodução peer-to-peer via WebTorrent',
          score: 500,
        });
      }

      for (const c of rawCandidates.slice(0, 14)) {
        if (!c?.url) continue;
        if (c.url.startsWith('magnet:')) {
          servers.push({
            id: `addon-magnet-${servers.length}`,
            label: c.label || 'Addon Torrent P2P',
            source: c.source || 'Addon Stremio',
            url: c.url,
            playbackUrl: c.url,
            engine: 'torrent',
            latencyMs: 80,
            quality: c.quality || 'P2P',
            alive: true,
            recommended: false,
            reason: 'Stream P2P via Addon',
            score: 480,
          });
          continue;
        }
        pushRemoteCandidate(c.url, c.label || 'Servidor Addon / Alternativo', c.source || 'Addon Web', 60, c.quality);
      }

      if (searchWeb && lookupTitle) {
        if (contentType === 'live_tv') {
          const webChannelStreams = await discoverIptvOrgChannelStreams(lookupTitle, 10).catch(() => []);
          for (let idx = 0; idx < webChannelStreams.length; idx++) {
            const st = webChannelStreams[idx];
            pushRemoteCandidate(
              st.url,
              `${st.channelName}${st.country ? ` (${st.country})` : ''}`,
              'iptv-org Web Directory',
              Math.round(st.matchScore * 0.6),
              st.quality
            );
          }
        } else {
          // Fast movie loading: skip slow web scraping whenever the movie's configured primary server responds
          let skipSlowMovieWebLookup = false;
          if (!forceWeb && vaultExists) {
            skipSlowMovieWebLookup = true;
          } else if (!forceWeb && normalizedCurrentRaw && /^https?:\/\//i.test(normalizedCurrentRaw)) {
            const primaryQuickCheck = await probeCandidateStreamUrl(normalizedCurrentRaw);
            if (primaryQuickCheck.alive) {
              skipSlowMovieWebLookup = true;
            }
          }

          if (!skipSlowMovieWebLookup) {
            const [imdbMatch, archiveStreams] = await Promise.all([
              resolvedImdbId ? Promise.resolve(null) : resolveImdbIdServerSide(lookupTitle, contentType, year),
              (!vaultExists || forceWeb)
                ? searchArchiveOrgMovieStreams(lookupTitle).catch(() => [])
                : Promise.resolve([]),
            ]);
            if (imdbMatch?.imdbId) {
              resolvedImdbId = imdbMatch.imdbId;
            }
            for (const arc of archiveStreams) {
              pushRemoteCandidate(arc.url, arc.label, 'Internet Archive (Web)', 45, arc.quality);
            }
          }
        }
      }

      // 3. Concurrently probe remote HTTP/HTTPS candidates & compute latency/engine recommendation
      const limitedRemote = remoteQueue.slice(0, 12);
      const remoteResults = await Promise.all(
        limitedRemote.map(async (item, idx) => {
          const check = await probeCandidateStreamUrl(item.url);
          if (!check.alive) {
            return {
              id: `remote-dead-${idx}`,
              label: item.label,
              source: item.source,
              url: item.url,
              playbackUrl: item.url,
              engine: 'auto' as const,
              latencyMs: check.latencyMs,
              quality: item.quality || 'Offline',
              alive: false,
              recommended: false,
              reason: check.reason || 'Sem resposta do servidor',
              score: -500 - check.latencyMs,
            };
          }

          let engine: RankedPlaybackServer['engine'] = 'auto';
          let playbackUrl = item.url;
          let vcodec: 'copy' | 'libx264' | undefined;
          let modeReason = `Online em ${check.latencyMs}ms`;

          if (check.needsTranscode) {
            engine = 'transcode';
            vcodec = 'libx264';
            playbackUrl = `/api/transcode?vcodec=libx264&url=${encodeURIComponent(item.url)}${
              contentType === 'live_tv' ? '&live=1' : ''
            }`;
            modeReason = `Online (${check.latencyMs}ms) • Via Transcodificador H.264`;
          } else if (check.needsRemux) {
            engine = 'transcode';
            vcodec = 'copy';
            playbackUrl = `/api/transcode?vcodec=copy&url=${encodeURIComponent(item.url)}${
              contentType === 'live_tv' ? '&live=1' : ''
            }`;
            modeReason = `Online (${check.latencyMs}ms) • Remux Rápido (Qualidade Original)`;
          } else if (check.isMpegTs) {
            engine = 'mpegts';
            playbackUrl = `/api/proxy?url=${encodeURIComponent(item.url)}`;
            modeReason = `Online (${check.latencyMs}ms) • Stream IPTV MPEG-TS + Proxy HTTPS`;
          } else if (check.isHls) {
            engine = 'hls';
            playbackUrl = check.needsProxy ? `/api/proxy?url=${encodeURIComponent(item.url)}` : item.url;
            modeReason = check.needsProxy
              ? `Online (${check.latencyMs}ms) • HLS Adaptativo + Proxy HTTPS`
              : `Online (${check.latencyMs}ms) • HLS Adaptativo Direto`;
          } else if (check.needsProxy) {
            engine = 'proxy';
            playbackUrl = `/api/proxy?url=${encodeURIComponent(item.url)}`;
            modeReason = `Online (${check.latencyMs}ms) • Via Salgueiro Proxy HTTPS`;
          }

          const qualStr = check.detectedQuality || item.quality || (check.isHls ? 'HLS Auto' : 'HD');
          let qualScore = 0;
          if (/4k|2160/i.test(qualStr)) qualScore = 45;
          else if (/1080/i.test(qualStr)) qualScore = 35;
          else if (/720/i.test(qualStr)) qualScore = 25;
          else if (/480/i.test(qualStr)) qualScore = 10;

          const httpsBonus = item.url.startsWith('https://') ? 15 : 0;
          const latencyScore = Math.max(0, 200 - Math.round(check.latencyMs / 15));
          const totalScore = 700 + item.priorityBoost + qualScore + httpsBonus + latencyScore;

          return {
            id: `remote-${idx}`,
            label: item.label,
            source: item.source,
            url: item.url,
            playbackUrl,
            engine,
            vcodec,
            latencyMs: check.latencyMs,
            quality: qualStr,
            alive: true,
            recommended: false,
            reason: modeReason,
            score: totalScore,
          };
        })
      );

      servers.push(...remoteResults);

      // Sort: alive first, then highest score
      servers.sort((a, b) => {
        if (a.alive !== b.alive) return a.alive ? -1 : 1;
        return b.score - a.score;
      });

      const aliveServers = servers.filter((s) => s.alive);
      if (aliveServers.length > 0) {
        // Ensure exactly one #1 recommended winner
        for (const s of servers) {
          s.recommended = s.id === aliveServers[0].id;
        }
      }

      const payload = {
        ok: true,
        resolvedImdbId,
        resolvedStreamPath,
        vaultExists,
        probeInfo,
        bestServer: aliveServers[0] || null,
        servers,
      };
      if (!forceWeb && rawCandidates.length === 0 && (aliveServers.length > 0 || vaultExists)) {
        if (findBestResponseCache.size >= 80) {
          const firstKey = findBestResponseCache.keys().next().value;
          if (firstKey) findBestResponseCache.delete(firstKey);
        }
        findBestResponseCache.set(cacheKey, { ts: Date.now(), payload });
      }
      res.json(payload);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao procurar o melhor servidor de reprodução.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Online User Geolocation & Angola Province Detection
  // ---------------------------------------------------------------------------
  const ANGOLA_PROVINCES = [
    'Luanda',
    'Benguela',
    'Huambo',
    'Huíla',
    'Cabinda',
    'Uíge',
    'Malanje',
    'Namibe',
    'Zaire',
    'Bié',
    'Lunda Norte',
    'Lunda Sul',
    'Moxico',
    'Cuanza Norte',
    'Cuanza Sul',
    'Cunene',
    'Cuando Cubango',
    'Bengo',
  ];

  const normalizeAngolaProvince = (region?: string, city?: string): string => {
    const raw = `${region || ''} ${city || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    for (const prov of ANGOLA_PROVINCES) {
      const pNorm = prov.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (raw.includes(pNorm)) return prov;
    }
    if (raw.includes('lubango')) return 'Huíla';
    if (raw.includes('lobito')) return 'Benguela';
    if (raw.includes('kwanza sul') || raw.includes('sumbe')) return 'Cuanza Sul';
    if (raw.includes('kwanza norte') || raw.includes('ndalatando')) return 'Cuanza Norte';
    if (raw.includes('kuando kubango') || raw.includes('menongue')) return 'Cuando Cubango';
    if (raw.includes('mocamedes') || raw.includes('tombwa')) return 'Namibe';
    if (raw.includes('soyo') || raw.includes('mbanza kongo')) return 'Zaire';
    if (raw.includes('dundo')) return 'Lunda Norte';
    if (raw.includes('saurimo')) return 'Lunda Sul';
    if (raw.includes('luena')) return 'Moxico';
    if (raw.includes('kuito')) return 'Bié';
    if (raw.includes('ondjiva')) return 'Cunene';
    if (raw.includes('caxito')) return 'Bengo';
    return (region || city || 'Luanda').trim() || 'Luanda';
  };

  app.get('/api/presence/geo', async (req: Request, res: Response) => {
    const forwarded = String(req.headers['x-forwarded-for'] || '');
    const rawIp = (forwarded.split(',')[0] || req.socket.remoteAddress || '').replace('::ffff:', '').trim();

    const isPrivateIp =
      !rawIp ||
      rawIp === '127.0.0.1' ||
      rawIp === '::1' ||
      rawIp.startsWith('10.') ||
      rawIp.startsWith('192.168.') ||
      rawIp.startsWith('fc') ||
      rawIp.startsWith('fe80') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(rawIp);

    if (!isPrivateIp) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(rawIp)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.success !== false) {
            const country = String(geoData.country || 'Angola');
            const countryCode = String(geoData.country_code || 'AO');
            const city = String(geoData.city || geoData.region || 'Luanda');
            const province =
              countryCode === 'AO'
                ? normalizeAngolaProvince(geoData.region, geoData.city)
                : String(geoData.region || city || country);
            res.json({
              city,
              province,
              country,
              countryCode,
              detected: true,
            });
            return;
          }
        }
      } catch {
        // Fallback below
      }
    }

    res.json({
      city: 'Luanda',
      province: 'Luanda',
      country: 'Angola',
      countryCode: 'AO',
      detected: false,
    });
  });

  // Real-time server presence store (complements Firestore online_presence)
  interface ServerPresenceEntry {
    sessionId: string;
    email: string;
    userName: string;
    role: string;
    isGuest: boolean;
    deviceName: string;
    city: string;
    province: string;
    country: string;
    currentView: string;
    lastSeenMs: number;
    startedAt: string;
  }
  const serverPresenceMap = new Map<string, ServerPresenceEntry>();
  const PRESENCE_TTL_MS = 85000;

  const pruneExpiredServerPresence = () => {
    const now = Date.now();
    for (const [sid, entry] of serverPresenceMap.entries()) {
      if (!entry || now - entry.lastSeenMs > PRESENCE_TTL_MS) {
        serverPresenceMap.delete(sid);
      }
    }
  };

  app.post('/api/presence/heartbeat', (req: Request, res: Response) => {
    const body = req.body || {};
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim().slice(0, 180) : '';
    if (!sessionId) {
      res.status(400).json({ error: 'sessionId em falta.' });
      return;
    }
    pruneExpiredServerPresence();
    const now = Date.now();
    serverPresenceMap.set(sessionId, {
      sessionId,
      email: String(body.email || '').slice(0, 200),
      userName: String(body.userName || 'Visitante Angola').slice(0, 120),
      role: String(body.role || 'guest').slice(0, 40),
      isGuest: Boolean(body.isGuest),
      deviceName: String(body.deviceName || 'Web').slice(0, 80),
      city: String(body.city || 'Luanda').slice(0, 120),
      province: String(body.province || 'Luanda').slice(0, 120),
      country: String(body.country || 'Angola').slice(0, 120),
      currentView: String(body.currentView || 'Início').slice(0, 180),
      lastSeenMs: now,
      startedAt: String(body.startedAt || new Date(now).toISOString()).slice(0, 64),
    });
    res.json({ ok: true, onlineCount: serverPresenceMap.size });
  });

  app.post('/api/presence/leave', (req: Request, res: Response) => {
    let sessionId = '';
    if (req.body && typeof req.body === 'object' && typeof req.body.sessionId === 'string') {
      sessionId = req.body.sessionId.trim();
    } else if (typeof req.body === 'string') {
      try {
        const parsed = JSON.parse(req.body);
        if (parsed && typeof parsed.sessionId === 'string') sessionId = parsed.sessionId.trim();
      } catch {}
    }
    if (sessionId) {
      serverPresenceMap.delete(sessionId);
    }
    res.json({ ok: true });
  });

  app.get('/api/presence/online', (_req: Request, res: Response) => {
    pruneExpiredServerPresence();
    const sessions = Array.from(serverPresenceMap.values()).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
    res.json({
      count: sessions.length,
      sessions,
    });
  });

  const resolveRequestOrigin = (req: Request): string => {
    const queryOrigin = typeof req.query.origin === 'string' ? req.query.origin.trim() : '';
    if (/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(queryOrigin)) {
      return queryOrigin.replace(/\/+$/, '');
    }
    const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000').split(',')[0].trim();
    return `${proto}://${host}`;
  };

  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  app.get('/api/install/ios-mobileconfig', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    const iconPath = path.resolve(__dirname, 'public', 'pwa-192x192.png');
    let iconBase64 = '';
    try {
      if (fs.existsSync(iconPath)) {
        iconBase64 = fs.readFileSync(iconPath).toString('base64');
      }
    } catch {
      iconBase64 = '';
    }

    const iconXml = iconBase64
      ? `<key>Icon</key>\n      <data>${iconBase64}</data>`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      ${iconXml}
      <key>IgnoreManifestScope</key>
      <false/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>Salgueiro TV</string>
      <key>PayloadDescription</key>
      <string>Atalho WebApp Salgueiro Streaming Angola no Ecrã Principal</string>
      <key>PayloadDisplayName</key>
      <string>Salgueiro Streaming Angola</string>
      <key>PayloadIdentifier</key>
      <string>ao.salgueirostreaming.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>7cd45045-0770-4495-ba20-6a8f375b2495</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${escapeXml(origin)}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Instala a aplicação Salgueiro Streaming Angola no iPhone / iPad</string>
  <key>PayloadDisplayName</key>
  <string>Salgueiro Streaming Angola</string>
  <key>PayloadIdentifier</key>
  <string>ao.salgueirostreaming.profile</string>
  <key>PayloadOrganization</key>
  <string>Salgueiro Streaming Angola</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

    res.setHeader('Content-Type', 'application/x-apple-aspen-config; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Salgueiro-Streaming-iOS.mobileconfig"');
    res.send(xml);
  });

  app.get('/api/install/desktop-launcher', (req: Request, res: Response) => {
    const osParam = String(req.query.os || 'windows').toLowerCase();
    const origin = resolveRequestOrigin(req);

    if (osParam === 'mac' || osParam === 'macos') {
      const macScript = `#!/bin/bash
# Instalador & Lançador macOS — Salgueiro Streaming Angola
APP_URL="${origin}"
DESKTOP_LINK="$HOME/Desktop/Salgueiro Streaming.webloc"
cat > "$DESKTOP_LINK" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>URL</key>
  <string>${origin}</string>
</dict>
</plist>
EOF

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$APP_URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$APP_URL"
else
  open "$APP_URL"
fi
`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="Salgueiro-Streaming-macOS.command"');
      res.send(macScript);
      return;
    }

    if (osParam === 'linux') {
      const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=Salgueiro Streaming Angola
Comment=Filmes, Séries e TV ao Vivo em 4K UHD
Exec=sh -c 'if command -v google-chrome >/dev/null 2>&1; then exec google-chrome --app="${origin}"; elif command -v chromium >/dev/null 2>&1; then exec chromium --app="${origin}"; elif command -v microsoft-edge >/dev/null 2>&1; then exec microsoft-edge --app="${origin}"; else exec xdg-open "${origin}"; fi'
Icon=video-display
Terminal=false
Categories=AudioVideo;Video;TV;
StartupNotify=true
`;
      res.setHeader('Content-Type', 'application/x-desktop; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="salgueiro-streaming.desktop"');
      res.send(desktopEntry);
      return;
    }

    // Default: Windows (.cmd launcher + Desktop shortcut creator)
    const winCmd = `@echo off
setlocal
set "APP_URL=${origin}"
set "SHORTCUT=%USERPROFILE%\\Desktop\\Salgueiro Streaming.url"
echo [InternetShortcut] > "%SHORTCUT%"
echo URL=%APP_URL% >> "%SHORTCUT%"

where msedge >nul 2>&1
if %errorlevel%==0 (
  start "" msedge --app="%APP_URL%"
  exit /b 0
)

where chrome >nul 2>&1
if %errorlevel%==0 (
  start "" chrome --app="%APP_URL%"
  exit /b 0
)

if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (
  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="%APP_URL%"
  exit /b 0
)

if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (
  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="%APP_URL%"
  exit /b 0
)

start "" "%APP_URL%"
`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Instalar-Salgueiro-Streaming-Windows.cmd"');
    res.send(winCmd.replace(/\n/g, '\r\n'));
  });

  app.get('/api/install/android-launcher', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    const html = `<!DOCTYPE html>
<html lang="pt-PT">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Salgueiro Streaming Angola — Android App</title>
  <meta http-equiv="refresh" content="0; url=${escapeXml(origin)}" />
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0c0d10;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px}
    .card{max-width:420px;background:#161a22;border:1px solid #2d3139;border-radius:20px;padding:28px}
    a{display:inline-block;margin-top:16px;padding:12px 24px;background:#7b5be4;color:#fff;text-decoration:none;border-radius:12px;font-weight:700}
  </style>
</head>
<body>
  <div class="card">
    <h2>Salgueiro Streaming Angola</h2>
    <p>A abrir a aplicação otimizada para Android &amp; Smart TV...</p>
    <a href="${escapeXml(origin)}">Abrir Salgueiro Streaming</a>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Salgueiro-Streaming-Android.html"');
    res.send(html);
  });

  app.get('/api/install/tv-playlist', (req: Request, res: Response) => {
    const origin = resolveRequestOrigin(req);
    const lines = [
      '#EXTM3U',
      `#PLAYLIST:Salgueiro Streaming Angola (${origin})`,
      '#EXTINF:-1 tvg-name="TPA 1" group-title="Angola",TPA 1 Angola',
      'https://streamer.tpa.ao/hls/tpa1.m3u8',
      '#EXTINF:-1 tvg-name="TPA 2" group-title="Angola",TPA 2 Angola',
      'https://streamer.tpa.ao/hls/tpa2.m3u8',
      '#EXTINF:-1 tvg-name="TV Zimbo" group-title="Angola",TV Zimbo',
      'https://stream.tvzimbo.ao/hls/live.m3u8',
    ];
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="salgueiro-smart-tv.m3u"');
    res.send(lines.join('\n') + '\n');
  });

  const distPath = path.resolve(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  let pendingBuild: Promise<unknown> | null = null;

  const ensureClientBuild = () => {
    if (fs.existsSync(indexHtmlPath)) {
      return Promise.resolve();
    }
    if (!pendingBuild) {
      console.log('dist/index.html not found, running Vite build...');
      pendingBuild = import('vite')
        .then(({ build }) => build())
        .finally(() => {
          pendingBuild = null;
        });
    }
    return pendingBuild;
  };

  if (!fs.existsSync(indexHtmlPath)) {
    void ensureClientBuild().catch((err) => {
      console.error('Initial Vite build failed:', err);
    });
  }

  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/stream/')) {
      next();
      return;
    }
    ensureClientBuild()
      .then(() => next())
      .catch(next);
  });

  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response, next: NextFunction) => {
    ensureClientBuild()
      .then(() => {
        res.sendFile(indexHtmlPath);
      })
      .catch(next);
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Salgueiro Streaming server running on http://0.0.0.0:${PORT}`);
  });
  // Extend upload lifetime: disable timeouts so file uploads never get cut off before reaching 100%
  server.timeout = 0;
  server.requestTimeout = 0;
  server.keepAliveTimeout = 14400000; // 4 hours keep-alive for multi-GB uninterrupted uploads
  server.headersTimeout = 14460000;
}

startServer();

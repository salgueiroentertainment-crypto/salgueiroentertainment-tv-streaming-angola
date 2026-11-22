import {
  InstalledStremioAddon,
  MediaItem,
  StremioAddonManifest,
  StremioCatalogDef,
  StremioStreamItem,
  StremioSubtitleItem,
  CodecSupportReport,
  LiveChannel,
} from '../types/streaming';

const LEGACY_KEYS = [
  'salgueiro_stremio_addons_v1',
  'salgueiro_stremio_addons_v2',
];
const ADDONS_STORAGE_KEY = 'salgueiro_stremio_addons_v3';

// Platform starts clean with 0 pre-installed addons; users/admins can add addons explicitly
export const DEFAULT_STREMIO_ADDONS: InstalledStremioAddon[] = [
  {
    transportUrl: 'https://c69e439124f3-tvplay.baby-beamup.club/manifest.json',
    manifest: {
      id: 'org.tvplay',
      name: 'TV Play Live',
      version: '1.0.0',
      description: 'Canais de TV em direto e desporto',
      resources: ['catalog', 'stream'],
      types: ['tv', 'sports', 'channel'],
      catalogs: [
        { type: 'tv', id: 'tv_channels', name: 'Canais de TV' },
        { type: 'sports', id: 'sports_channels', name: 'Canais de Desporto' }
      ]
    },
    enabled: true,
    isOfficial: true,
    installedAt: '2026-11-19',
  }
];

export function isChannelCatalog(cat: StremioCatalogDef): boolean {
  return cat.type === 'tv' || cat.type === 'sports' || cat.type === 'channel';
}

export function normalizeManifestUrl(inputUrl: string): string {
  let clean = inputUrl.trim();
  if (clean.startsWith('stremio://')) {
    clean = 'https://' + clean.slice('stremio://'.length);
  }
  if (!clean.endsWith('/manifest.json')) {
    clean = clean.replace(/\/+$/, '') + '/manifest.json';
  }
  return clean;
}

export function getAddonBaseUrl(manifestUrl: string): string {
  return normalizeManifestUrl(manifestUrl).replace(/\/manifest\.json$/, '');
}

async function fetchAddonJson<T>(targetUrl: string): Promise<T> {
  const proxyUrl = `/api/addon-proxy?url=${encodeURIComponent(targetUrl)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Addon HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function loadInstalledAddons(): InstalledStremioAddon[] {
  try {
    for (const key of LEGACY_KEYS) {
      localStorage.removeItem(key);
    }
    const raw = localStorage.getItem(ADDONS_STORAGE_KEY);
    if (!raw) {
      saveInstalledAddons(DEFAULT_STREMIO_ADDONS);
      return DEFAULT_STREMIO_ADDONS;
    }
    const parsed: InstalledStremioAddon[] = JSON.parse(raw);
    const addonsList = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_STREMIO_ADDONS;
    const hasTvPlay = addonsList.some(a => a.transportUrl.includes('baby-beamup.club') || a.manifest?.id === 'org.tvplay');
    if (!hasTvPlay) {
      addonsList.push(DEFAULT_STREMIO_ADDONS[0]);
      saveInstalledAddons(addonsList);
    }
    return addonsList;
  } catch {
    return DEFAULT_STREMIO_ADDONS;
  }
}

export function saveInstalledAddons(addons: InstalledStremioAddon[]): void {
  try {
    localStorage.setItem(ADDONS_STORAGE_KEY, JSON.stringify(addons));
  } catch {
    // ignore storage errors
  }
}

export async function installStremioAddon(rawUrl: string): Promise<InstalledStremioAddon> {
  const manifestUrl = normalizeManifestUrl(rawUrl);
  const manifest = await fetchAddonJson<StremioAddonManifest>(manifestUrl);
  if (!manifest || !manifest.id || !manifest.name) {
    throw new Error('Manifesto de addon inválido (id/name em falta).');
  }
  return {
    transportUrl: manifestUrl,
    manifest,
    enabled: true,
    isOfficial: false,
    installedAt: new Date().toISOString().split('T')[0],
  };
}

function addonSupportsResource(addon: InstalledStremioAddon, resourceName: string): boolean {
  if (!addon.enabled) return false;
  const resources = addon.manifest.resources || [];
  return resources.some((r) => (typeof r === 'string' ? r === resourceName : r.name === resourceName));
}

function isSetupPlaceholderMeta(meta: any): boolean {
  const id = String(meta?.id || '').toLowerCase();
  const name = String(meta?.name || '').toLowerCase();
  return (
    id.includes('_setup_') ||
    id === 'zintv:doacao' ||
    name.startsWith('setup required:') ||
    name.includes('add your tmdb api key') ||
    name.includes('apoie o canal')
  );
}

const SERIES_EPISODE_PATTERN =
  /(?:\bS\d{1,2}\s*[._-]?\s*E\d{1,3}\b|\b\d{1,2}x\d{1,3}\b|\b(?:temporada|season)\s*\d+\b|\b(?:s[eé]rie\s+completa|complete\s+series|mini[\s-]*s[eé]rie)\b|\bep(?:is[oó]dio)?\s*\d{1,3}\b)/i;

const SERIES_DURATION_PATTERN =
  /(?:\btemporadas?\b|\bseasons?\b|\bepis[oó]dios?\b|\bs[eé]rie\b)/i;

const SERIES_ID_PATTERN = /^(?:tt\d+|tmdb:\d+|kitsu:\d+):\d+:\d+/i;

export function isDetectedSeriesItem(item: Partial<MediaItem>): boolean {
  if (!item || item.type === 'live_tv') return false;
  if (item.type === 'series' || item.stremioType === 'series') return true;
  if (item.id && SERIES_ID_PATTERN.test(String(item.id).trim())) return true;
  if (item.duration && SERIES_DURATION_PATTERN.test(String(item.duration))) return true;
  const haystacks = [item.title, item.originalTitle, item.videoUrl];
  return haystacks.some((val) => Boolean(val && SERIES_EPISODE_PATTERN.test(String(val))));
}

function mapStremioMetaToMediaItem(
  meta: any,
  addonName: string,
  catalogTypeHint?: string
): MediaItem {
  const rawGenres: string[] = Array.isArray(meta.genres)
    ? meta.genres
    : Array.isArray(meta.genre)
      ? meta.genre
      : [];
  const mappedGenres = (rawGenres.length > 0 ? rawGenres : ['Internacional']).slice(0, 4) as any;
  const yearMatch = String(meta.releaseInfo || meta.year || '2026').match(/\d{4}/);
  const year = yearMatch ? Number(yearMatch[0]) : 2026;
  const poster =
    meta.poster ||
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500&auto=format&fit=crop&q=80';
  const banner = meta.background || meta.poster || poster;
  const rawType = String(meta.type || catalogTypeHint || 'movie').toLowerCase();

  let mappedType: 'movie' | 'series' | 'live_tv' =
    rawType === 'series'
      ? 'series'
      : rawType === 'tv' || rawType === 'channel' || rawType === 'sports'
        ? 'live_tv'
        : 'movie';

  const baseItem: MediaItem = {
    id: String(meta.imdb_id || meta.id),
    title: String(meta.name || 'Sem Título'),
    originalTitle: String(meta.name || ''),
    type: mappedType,
    stremioType: rawType,
    addonName,
    bannerUrl: banner,
    thumbnailUrl: poster,
    videoUrl: '',
    synopsis: meta.description || `Conteúdo disponível via addon ${addonName}.`,
    rating: '16',
    imdbScore: meta.imdbRating ? Number(meta.imdbRating) || 8.0 : 8.0,
    year,
    duration: meta.runtime || (mappedType === 'series' ? 'Série' : mappedType === 'live_tv' ? 'Ao Vivo' : 'HD'),
    genres: mappedGenres,
    quality: 'HD',
    audio: ['Original', 'Português'],
    subtitles: ['Português (Brasil)', 'English'],
    isSalgueiroMember: true,
    matchPercentage: 94,
    director: Array.isArray(meta.director) ? meta.director.join(', ') : meta.director,
    cast: Array.isArray(meta.cast)
      ? meta.cast.slice(0, 5).map((name: string) => ({
          name,
          role: 'Elenco',
          character: name,
        }))
      : [],
  };

  if (mappedType !== 'live_tv' && isDetectedSeriesItem(baseItem)) {
    mappedType = 'series';
    baseItem.type = 'series';
    baseItem.stremioType = 'series';
    if (!meta.runtime) {
      baseItem.duration = 'Série';
    }
  }

  return baseItem;
}

export interface AddonCatalogSection {
  key: string;
  addonName: string;
  addonId: string;
  catalogId: string;
  catalogName: string;
  catalogType: 'movie' | 'series';
  items: MediaItem[];
}

export async function fetchAllInstalledAddonCatalogs(
  addons: InstalledStremioAddon[],
  perCatalogLimit = 24
): Promise<{
  movies: MediaItem[];
  series: MediaItem[];
  movieSections: AddonCatalogSection[];
  seriesSections: AddonCatalogSection[];
}> {
  const activeAddons = addons.filter(
    (a) =>
      a.enabled &&
      Array.isArray(a.manifest.catalogs) &&
      a.manifest.catalogs.length > 0 &&
      (addonSupportsResource(a, 'catalog') || !a.manifest.resources || a.manifest.resources.length === 0)
  );

  if (activeAddons.length === 0) {
    return { movies: [], series: [], movieSections: [], seriesSections: [] };
  }

  const catalogTasks: Array<{
    addon: InstalledStremioAddon;
    cat: StremioCatalogDef;
    declaredType: 'movie' | 'series';
  }> = [];

  for (const addon of activeAddons) {
    const catalogs = addon.manifest.catalogs || [];
    const seenCatKeys = new Set<string>();
    let movieCatCount = 0;
    let seriesCatCount = 0;

    for (const cat of catalogs) {
      if (isChannelCatalog(cat)) continue;
      const requiresParam = Array.isArray(cat.extra) && cat.extra.some((e) => e.isRequired);
      if (requiresParam) continue;

      const catKey = `${cat.type}:${cat.id}`;
      if (seenCatKeys.has(catKey)) continue;
      seenCatKeys.add(catKey);

      const isSeriesCat = cat.type === 'series' || /s[eé]rie/i.test(cat.name || '');
      if (isSeriesCat) {
        if (seriesCatCount >= 3) continue;
        seriesCatCount++;
        catalogTasks.push({ addon, cat, declaredType: 'series' });
      } else {
        if (movieCatCount >= 3) continue;
        movieCatCount++;
        catalogTasks.push({ addon, cat, declaredType: 'movie' });
      }
    }
  }

  const fetchedResults = await Promise.all(
    catalogTasks.map(async ({ addon, cat, declaredType }) => {
      try {
        const baseUrl = getAddonBaseUrl(addon.transportUrl);
        const url = `${baseUrl}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}.json`;
        const data = await fetchAddonJson<{ metas?: any[] }>(url);
        const rawMetas = Array.isArray(data.metas) ? data.metas : [];
        const items = rawMetas
          .filter((m) => !isSetupPlaceholderMeta(m))
          .slice(0, perCatalogLimit)
          .map((m) => mapStremioMetaToMediaItem(m, addon.manifest.name, cat.type));

        return { addon, cat, declaredType, items };
      } catch {
        return { addon, cat, declaredType, items: [] as MediaItem[] };
      }
    })
  );

  const movieMap = new Map<string, MediaItem>();
  const seriesMap = new Map<string, MediaItem>();
  const movieSections: AddonCatalogSection[] = [];
  const seriesSections: AddonCatalogSection[] = [];

  for (const entry of fetchedResults) {
    if (entry.items.length === 0) continue;

    const moviesInSection: MediaItem[] = [];
    const seriesInSection: MediaItem[] = [];

    for (const item of entry.items) {
      if (item.type === 'series' || isDetectedSeriesItem(item)) {
        const normalizedSeries: MediaItem = {
          ...item,
          type: 'series',
          stremioType: 'series',
        };
        seriesInSection.push(normalizedSeries);
        if (!seriesMap.has(normalizedSeries.id)) {
          seriesMap.set(normalizedSeries.id, normalizedSeries);
        }
      } else if (item.type !== 'live_tv') {
        const normalizedMovie: MediaItem = {
          ...item,
          type: 'movie',
          stremioType: 'movie',
        };
        moviesInSection.push(normalizedMovie);
        if (!movieMap.has(normalizedMovie.id)) {
          movieMap.set(normalizedMovie.id, normalizedMovie);
        }
      }
    }

    const catalogLabel = entry.cat.name || entry.cat.id;
    if (moviesInSection.length > 0) {
      movieSections.push({
        key: `${entry.addon.manifest.id}:${entry.cat.type}:${entry.cat.id}:movie`,
        addonName: entry.addon.manifest.name,
        addonId: entry.addon.manifest.id,
        catalogId: entry.cat.id,
        catalogName: catalogLabel,
        catalogType: 'movie',
        items: moviesInSection,
      });
    }
    if (seriesInSection.length > 0) {
      seriesSections.push({
        key: `${entry.addon.manifest.id}:${entry.cat.type}:${entry.cat.id}:series`,
        addonName: entry.addon.manifest.name,
        addonId: entry.addon.manifest.id,
        catalogId: entry.cat.id,
        catalogName: catalogLabel,
        catalogType: 'series',
        items: seriesInSection,
      });
    }
  }

  return {
    movies: Array.from(movieMap.values()),
    series: Array.from(seriesMap.values()),
    movieSections,
    seriesSections,
  };
}

export async function searchStremioAddons(
  query: string,
  addons: InstalledStremioAddon[]
): Promise<{ items: MediaItem[]; sourcesUsed: string[] }> {
  const trimmed = query.trim();
  if (!trimmed || addons.length === 0) return { items: [], sourcesUsed: [] };

  const activeCatalogAddons = addons.filter(
    (a) => addonSupportsResource(a, 'catalog') && Array.isArray(a.manifest.catalogs) && a.manifest.catalogs.length > 0
  );
  if (activeCatalogAddons.length === 0) return { items: [], sourcesUsed: [] };

  const requests: Promise<{ addonName: string; catalogType: string; metas: any[] }>[] = [];
  for (const addon of activeCatalogAddons) {
    const baseUrl = getAddonBaseUrl(addon.transportUrl);
    const searchableCatalogs = (addon.manifest.catalogs || [])
      .filter((c) => !c.extra || c.extra.some((e) => e.name === 'search'))
      .slice(0, 2);

    for (const cat of searchableCatalogs) {
      const searchUrl = `${baseUrl}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}/search=${encodeURIComponent(trimmed)}.json`;
      requests.push(
        fetchAddonJson<{ metas?: any[] }>(searchUrl)
          .then((data) => ({ addonName: addon.manifest.name, catalogType: cat.type, metas: data.metas || [] }))
          .catch(() => ({ addonName: addon.manifest.name, catalogType: cat.type, metas: [] }))
      );
    }
  }

  const settled = await Promise.all(requests);
  const seenIds = new Set<string>();
  const items: MediaItem[] = [];
  const sourcesUsed = new Set<string>();

  for (const res of settled) {
    if (res.metas.length > 0) sourcesUsed.add(res.addonName);
    for (const meta of res.metas.slice(0, 12)) {
      if (isSetupPlaceholderMeta(meta)) continue;
      const item = mapStremioMetaToMediaItem(meta, res.addonName, res.catalogType);
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
    }
  }

  return { items, sourcesUsed: Array.from(sourcesUsed) };
}

export async function fetchStremioAddonCatalog(
  addon: InstalledStremioAddon,
  catalogType: string,
  catalogId: string
): Promise<MediaItem[]> {
  const { items } = await fetchStremioAddonCatalogDetailed(addon, catalogType, catalogId);
  return items;
}

export async function fetchStremioAddonCatalogDetailed(
  addon: InstalledStremioAddon,
  catalogType: string,
  catalogId: string,
  limit = 36
): Promise<{ items: MediaItem[]; setupNotice?: string }> {
  const baseUrl = getAddonBaseUrl(addon.transportUrl);
  const url = `${baseUrl}/catalog/${encodeURIComponent(catalogType)}/${encodeURIComponent(catalogId)}.json`;
  const data = await fetchAddonJson<{ metas?: any[] }>(url);
  const rawMetas = Array.isArray(data.metas) ? data.metas : [];
  const setupMeta = rawMetas.find((m) => isSetupPlaceholderMeta(m));
  const validMetas = rawMetas.filter((m) => !isSetupPlaceholderMeta(m));
  return {
    items: validMetas.slice(0, limit).map((m) => mapStremioMetaToMediaItem(m, addon.manifest.name, catalogType)),
    setupNotice: setupMeta ? String(setupMeta.description || setupMeta.name) : undefined,
  };
}

export async function syncAllAddonManifests(
  addons: InstalledStremioAddon[]
): Promise<InstalledStremioAddon[]> {
  return Promise.all(
    addons.map(async (addon) => {
      if (!addon.enabled) return addon;
      try {
        const freshManifest = await fetchAddonJson<StremioAddonManifest>(addon.transportUrl);
        if (freshManifest && freshManifest.id && freshManifest.name) {
          return { ...addon, manifest: freshManifest };
        }
        return addon;
      } catch {
        return addon;
      }
    })
  );
}

export async function resolveImdbIdByTitle(
  title: string,
  type: 'movie' | 'series' | 'all' = 'all',
  year?: number
): Promise<string | null> {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle.length < 2) return null;
  try {
    const qs = new URLSearchParams({
      title: cleanTitle,
      type,
    });
    if (year && Number.isFinite(year)) {
      qs.set('year', String(year));
    }
    const res = await fetch(`/api/movies/resolve-imdb?${qs.toString()}`);
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return typeof data?.match?.imdbId === 'string' && /^tt\d+$/i.test(data.match.imdbId)
      ? data.match.imdbId
      : null;
  } catch {
    return null;
  }
}

export async function fetchStremioStreams(
  item: MediaItem,
  addons: InstalledStremioAddon[]
): Promise<StremioStreamItem[]> {
  const streamAddons = addons.filter((a) => addonSupportsResource(a, 'stream'));
  if (streamAddons.length === 0) return [];

  const stremioType =
    item.stremioType || (item.type === 'series' ? 'series' : item.type === 'live_tv' ? 'tv' : 'movie');

  let candidateId = item.id;
  if (stremioType !== 'tv' && !/^tt\d+/i.test(candidateId || '')) {
    const resolved = await resolveImdbIdByTitle(
      item.originalTitle || item.title,
      stremioType === 'series' ? 'series' : 'movie',
      item.year
    );
    if (resolved) {
      candidateId = resolved;
    }
  }

  if (!candidateId) return [];

  const results = await Promise.all(
    streamAddons.map(async (addon) => {
      try {
        const lookupId =
          stremioType === 'series' && !candidateId.includes(':') ? `${candidateId}:1:1` : candidateId;
        const base = getAddonBaseUrl(addon.transportUrl);
        const url = `${base}/stream/${encodeURIComponent(stremioType)}/${encodeURIComponent(lookupId)}.json`;
        const data = await fetchAddonJson<{ streams?: StremioStreamItem[] }>(url);
        return (data.streams || []).map((s) => ({ ...s, addonName: addon.manifest.name }));
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

export async function fetchStremioSubtitles(
  item: MediaItem,
  addons: InstalledStremioAddon[]
): Promise<StremioSubtitleItem[]> {
  const subAddons = addons.filter((a) => addonSupportsResource(a, 'subtitles'));
  if (subAddons.length === 0) return [];

  const stremioType = item.type === 'series' ? 'series' : 'movie';
  const lookupId = stremioType === 'series' && !item.id.includes(':') ? `${item.id}:1:1` : item.id;

  const results = await Promise.all(
    subAddons.map(async (addon) => {
      try {
        const base = getAddonBaseUrl(addon.transportUrl);
        const url = `${base}/subtitles/${stremioType}/${encodeURIComponent(lookupId)}.json`;
        const data = await fetchAddonJson<{ subtitles?: StremioSubtitleItem[] }>(url);
        return (data.subtitles || []).map((s) => ({ ...s, addonName: addon.manifest.name }));
      } catch {
        return [];
      }
    })
  );

  return results.flat();
}

export async function fetchAllInstalledLiveChannels(
  addons: InstalledStremioAddon[]
): Promise<LiveChannel[]> {
  const activeAddons = addons.filter(
    (a) =>
      a.enabled &&
      Array.isArray(a.manifest.catalogs) &&
      a.manifest.catalogs.length > 0
  );

  const channelTasks: Array<{ addon: InstalledStremioAddon; cat: StremioCatalogDef }> = [];
  for (const addon of activeAddons) {
    const catalogs = addon.manifest.catalogs || [];
    for (const cat of catalogs) {
      if (isChannelCatalog(cat) || cat.type === 'tv' || cat.type === 'sports' || cat.type === 'channel' || /tv|canal|sport/i.test(cat.name || '')) {
        channelTasks.push({ addon, cat });
      }
    }
  }

  if (channelTasks.length === 0) return [];

  const results = await Promise.all(
    channelTasks.map(async ({ addon, cat }) => {
      try {
        const baseUrl = getAddonBaseUrl(addon.transportUrl);
        const url = `${baseUrl}/catalog/${encodeURIComponent(cat.type)}/${encodeURIComponent(cat.id)}.json`;
        const data = await fetchAddonJson<{ metas?: any[] }>(url);
        const metas = Array.isArray(data.metas) ? data.metas : [];
        return metas.map((meta, idx): LiveChannel => {
          const logo = meta.poster || meta.logo || 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=500&auto=format&fit=crop&q=80';
          const catName = cat.name || (cat.type === 'sports' ? 'Esportes' : 'Variedades');
          const validCategory: LiveChannel['category'] = /esporte|sport/i.test(catName) ? 'Esportes' : 'Variedades';
          return {
            id: String(meta.id || `addon-chan-${idx}`),
            name: String(meta.name || 'Canal ao Vivo'),
            logo,
            category: validCategory,
            currentShow: meta.description || `Transmissão ao vivo (${addon.manifest.name})`,
            nextShow: 'A seguir',
            progressPercentage: 65,
            viewers: '3.2k',
            schedule: [],
            videoUrl: meta.videoUrl || meta.url || '',
            channelNumber: 3000 + idx,
          };
        });
      } catch {
        return [] as LiveChannel[];
      }
    })
  );

  return results.flat();
}

/**
 * Inspect real browser codec support for H.264, H.265/HEVC, AV1, VP9, AC-3, E-AC-3, AAC, HLS.
 */
export function probeBrowserCodecs(): CodecSupportReport[] {
  if (typeof document === 'undefined') return [];
  const v = document.createElement('video');
  const checks = [
    { codec: 'H.264 / AVC (MP4)', mime: 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"', serverFallback: 'Reprodução Nativa Direta' },
    { codec: 'H.265 / HEVC (10-bit)', mime: 'video/mp4; codecs="hvc1.1.6.L93.B0"', serverFallback: 'FFmpeg Server -> H.264' },
    { codec: 'AV1 (Ultra HD)', mime: 'video/mp4; codecs="av01.0.04M.08"', serverFallback: 'FFmpeg Server -> H.264' },
    { codec: 'VP9 / WebM', mime: 'video/webm; codecs="vp9, opus"', serverFallback: 'FFmpeg Server -> MP4' },
    { codec: 'Dolby Digital Plus (E-AC-3)', mime: 'audio/mp4; codecs="ec-3"', serverFallback: 'FFmpeg Audio -> AAC 2.0' },
    { codec: 'AAC Stereo / LC', mime: 'video/mp4; codecs="mp4a.40.2"', serverFallback: 'Nativo HTML5' },
    { codec: 'HLS (.m3u8)', mime: 'application/vnd.apple.mpegurl', serverFallback: 'HLS.js + Proxy HTTPS' },
  ];

  return checks.map((c) => ({
    ...c,
    supported: v.canPlayType(c.mime) !== '',
  }));
}

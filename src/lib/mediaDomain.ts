export interface MediaDomainConfig {
  customDomain: string;
  displayLabel: string;
  streamingEnabled: boolean;
  runtimeOrigin?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface VaultMediaFile {
  filename: string;
  folder: 'videos' | 'images';
  size: number;
  mimeType: string;
  createdAt: string;
  streamPath: string;
}

export interface VaultFilesResponse {
  files: VaultMediaFile[];
  totalBytes: number;
  domainConfig: MediaDomainConfig;
}

export const DEFAULT_MEDIA_DOMAIN_CONFIG: MediaDomainConfig = {
  customDomain: 'media.salgueirostreaming.ao',
  displayLabel: 'Salgueiro Media Cloud Angola',
  streamingEnabled: true,
};

export function normalizeDomainName(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export function isValidDomainName(domain: string): boolean {
  const clean = normalizeDomainName(domain);
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+(:[0-9]{1,5})?$/.test(
    clean
  );
}

export function isVaultStreamUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  return (
    trimmed.startsWith('/stream/media/') ||
    trimmed.startsWith('/api/media/stream/') ||
    /\/(?:stream\/media|api\/media\/stream)\/(videos|images)\//i.test(trimmed)
  );
}

export function getRuntimeOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
}

export function buildCustomDomainStreamUrl(streamPath: string, customDomain?: string): string {
  const cleanPath = streamPath.startsWith('/') ? streamPath : `/${streamPath}`;
  const cleanDomain = normalizeDomainName(customDomain || DEFAULT_MEDIA_DOMAIN_CONFIG.customDomain);
  return `https://${cleanDomain}${cleanPath}`;
}

export function buildRuntimeStreamUrl(streamPath: string): string {
  if (!streamPath) return '';
  if (streamPath.startsWith('http://') || streamPath.startsWith('https://')) {
    return streamPath;
  }
  const cleanPath = streamPath.startsWith('/') ? streamPath : `/${streamPath}`;
  return `${getRuntimeOrigin()}${cleanPath}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}

export async function fetchMediaDomainConfig(): Promise<MediaDomainConfig> {
  const res = await fetch('/api/media/domain-config');
  if (!res.ok) {
    throw new Error('Não foi possível obter a configuração do domínio.');
  }
  return res.json();
}

export async function updateMediaDomainConfig(
  payload: Partial<MediaDomainConfig>
): Promise<MediaDomainConfig> {
  const res = await fetch('/api/media/domain-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error('Falha ao guardar domínio de armazenamento.');
  }
  return res.json();
}

export async function listVaultMediaFiles(): Promise<VaultFilesResponse> {
  const res = await fetch('/api/media/files');
  if (!res.ok) {
    throw new Error('Falha ao listar ficheiros do domínio.');
  }
  return res.json();
}

export async function deleteVaultMediaFile(
  folder: 'videos' | 'images',
  filename: string
): Promise<void> {
  const res = await fetch(`/api/media/files/${folder}/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Falha ao eliminar ficheiro do domínio.');
  }
}

export interface UploadProgressTelemetry {
  percent: number;
  speedMBps: number;
  etaSeconds: number;
  completedChunks: number;
  totalChunks: number;
  skippedChunks: number;
  loadedBytes?: number;
  totalBytes?: number;
  statusMessage?: string;
}

export interface WebArtworkResult {
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

export async function searchOriginalMovieArtwork(
  query: string,
  type: 'movie' | 'series' | 'all' | string = 'all'
): Promise<WebArtworkResult[]> {
  const res = await fetch(
    `/api/movies/search-artwork?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}`
  );
  if (!res.ok) {
    throw new Error('Não foi possível procurar capas na web.');
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.results) ? data.results : [];
}

export interface MovieArtworkOverride {
  thumbnailUrl: string;
  bannerUrl: string;
  originalTitle?: string;
  source?: string;
}

export async function batchSearchMovieArtworksOnWeb(
  movies: Array<{ id: string; title: string; originalTitle?: string; type?: string }>
): Promise<Record<string, MovieArtworkOverride>> {
  const res = await fetch('/api/movies/batch-search-artwork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ movies }),
  });
  if (!res.ok) {
    throw new Error('Não foi possível procurar capas e banners na web.');
  }
  const data = await res.json().catch(() => ({}));
  return data?.artworks && typeof data.artworks === 'object' ? data.artworks : {};
}

export async function fetchServerMovieArtworks(): Promise<Record<string, MovieArtworkOverride>> {
  try {
    const res = await fetch('/api/movies/artworks');
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return data?.artworks && typeof data.artworks === 'object' ? data.artworks : {};
  } catch {
    return {};
  }
}

export async function saveServerMovieArtworks(
  artworks: Record<string, MovieArtworkOverride>
): Promise<void> {
  await fetch('/api/movies/artworks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artworks }),
  });
}

export interface ChannelLogoResult {
  id: string;
  channelName: string;
  logoUrl: string;
  source: string;
  country?: string;
  score: number;
}

export interface BatchChannelLogoMatch {
  logoUrl: string;
  matchedName: string;
  source: string;
}

export async function searchChannelLogoOnWeb(name: string): Promise<ChannelLogoResult[]> {
  const res = await fetch(`/api/channels/search-logo?name=${encodeURIComponent(name)}`);
  if (!res.ok) {
    throw new Error('Não foi possível procurar logótipo do canal na web.');
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.results) ? data.results : [];
}

export async function batchSearchChannelLogosOnWeb(
  channels: Array<{ id: string; name: string }>
): Promise<Record<string, BatchChannelLogoMatch>> {
  const res = await fetch('/api/channels/search-logos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels }),
  });
  if (!res.ok) {
    throw new Error('Não foi possível procurar logótipos dos canais na web.');
  }
  const data = await res.json().catch(() => ({}));
  return data?.logos && typeof data.logos === 'object' ? data.logos : {};
}

export async function fetchServerChannelLogos(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/channels/logos');
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return data?.logos && typeof data.logos === 'object' ? data.logos : {};
  } catch {
    return {};
  }
}

export async function saveServerChannelLogos(logos: Record<string, string>): Promise<void> {
  await fetch('/api/channels/logos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logos }),
  });
}

export class UploadCancelledError extends Error {
  isCancelled = true;
  constructor(message = 'Upload cancelado pelo administrador.') {
    super(message);
    this.name = 'AbortError';
  }
}

export function isUploadCancelledError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  return (err as any).isCancelled === true || (err as any).name === 'AbortError';
}

export async function cancelMediaUpload(uploadId: string): Promise<void> {
  if (!uploadId) return;
  try {
    await fetch('/api/media/upload/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId }),
      keepalive: true,
    });
  } catch {
    // non-fatal cleanup request
  }
}

async function waitForBrowserOnline(onWaiting?: (msg: string) => void, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new UploadCancelledError();
  if (typeof navigator === 'undefined' || navigator.onLine !== false) return;
  if (onWaiting) {
    onWaiting('Sem internet de momento — upload em pausa segura a aguardar ligação para continuar até 100%...');
  }
  await new Promise<void>((resolve, reject) => {
    let iv: ReturnType<typeof setInterval> | null = null;
    const cleanup = () => {
      window.removeEventListener('online', onOnline);
      if (signal) signal.removeEventListener('abort', onAbort);
      if (iv) clearInterval(iv);
    };
    const onOnline = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      reject(new UploadCancelledError());
    };
    window.addEventListener('online', onOnline);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    // Fallback check every 3s in case 'online' event didn't fire
    iv = setInterval(() => {
      if (signal?.aborted) {
        onAbort();
        return;
      }
      if (navigator.onLine) {
        onOnline();
      }
    }, 3000);
  });
}

async function fetchUploadStatusDetails(
  uploadId: string,
  totalChunks: number,
  chunkIndex?: number,
  signal?: AbortSignal
): Promise<{ receivedSet: Set<number>; alreadyFinalized: boolean; hasChunk?: boolean; result?: any }> {
  try {
    const qs = new URLSearchParams({
      uploadId,
      totalChunks: String(totalChunks),
    });
    if (typeof chunkIndex === 'number') {
      qs.set('chunkIndex', String(chunkIndex));
    }
    const res = await fetch(`/api/media/upload/status?${qs.toString()}`, { signal });
    if (!res.ok) return { receivedSet: new Set(), alreadyFinalized: false };
    const data = await res.json().catch(() => ({}));
    if (data?.alreadyFinalized && data?.result?.streamPath) {
      return {
        receivedSet: new Set<number>(Array.from({ length: totalChunks }, (_, i) => i)),
        alreadyFinalized: true,
        hasChunk: true,
        result: data.result,
      };
    }
    if (typeof chunkIndex === 'number' && typeof data?.hasChunk === 'boolean') {
      const set = new Set<number>();
      if (data.hasChunk) set.add(chunkIndex);
      return {
        receivedSet: set,
        alreadyFinalized: false,
        hasChunk: data.hasChunk,
      };
    }
    if (Array.isArray(data.receivedChunks)) {
      return {
        receivedSet: new Set<number>(data.receivedChunks.map(Number)),
        alreadyFinalized: false,
      };
    }
  } catch {
    // ignore
  }
  return { receivedSet: new Set(), alreadyFinalized: false };
}

function buildChunkUploadUrl(params: {
  filename: string;
  folder: string;
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  manualFinalize?: boolean;
}): string {
  const qs = new URLSearchParams({
    filename: params.filename,
    folder: params.folder,
    uploadId: params.uploadId,
    chunkIndex: String(params.chunkIndex),
    totalChunks: String(params.totalChunks),
  });
  if (params.manualFinalize) {
    qs.set('manualFinalize', 'true');
  }
  return `/api/media/upload?${qs.toString()}`;
}

async function readBlobAsBuffer(blob: Blob): Promise<ArrayBuffer> {
  try {
    return await blob.arrayBuffer();
  } catch {
    await new Promise((r) => setTimeout(r, 150));
    try {
      return await blob.arrayBuffer();
    } catch {
      throw new Error('Não foi possível ler os dados deste bloco do ficheiro local.');
    }
  }
}

function uploadChunkWithXhr(
  url: string,
  payloadBuffer: ArrayBuffer,
  headers: Record<string, string>,
  onChunkProgress: (loaded: number) => void,
  signal?: AbortSignal
): Promise<any> {
  if (signal?.aborted) {
    return Promise.reject(new UploadCancelledError());
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    // 0 = Sem limite de tempo: o upload nunca é interrompido por expiração de tempo até atingir 100%
    xhr.timeout = 0;
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    let lastProgressTimestamp = Date.now();
    let userAborted = false;

    const handleExternalAbort = () => {
      userAborted = true;
      clearInterval(watchdogTimer);
      try {
        xhr.abort();
      } catch {}
      reject(new UploadCancelledError());
    };

    if (signal) {
      signal.addEventListener('abort', handleExternalAbort, { once: true });
    }

    const cleanupSignal = () => {
      if (signal) signal.removeEventListener('abort', handleExternalAbort);
    };

    // Watchdog ultra-estendido (15 minutos sem qualquer progresso): só reinicia se a ligação estagnar totalmente
    const watchdogTimer = setInterval(() => {
      if (Date.now() - lastProgressTimestamp > 900000) {
        clearInterval(watchdogTimer);
        cleanupSignal();
        try {
          xhr.abort();
        } catch {}
        reject(new Error('Ligação estagnada há mais de 15 minutos. A restabelecer bloco automaticamente...'));
      }
    }, 15000);

    xhr.upload.onprogress = (ev) => {
      lastProgressTimestamp = Date.now();
      if (ev.lengthComputable) {
        onChunkProgress(ev.loaded);
      }
    };

    xhr.onprogress = () => {
      lastProgressTimestamp = Date.now();
    };

    xhr.onload = () => {
      clearInterval(watchdogTimer);
      cleanupSignal();
      if (userAborted || signal?.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (!parsed || parsed.ok !== true) {
            reject(new Error(parsed?.error || 'O servidor não confirmou a gravação do bloco.'));
            return;
          }
          resolve(parsed);
        } catch {
          reject(new Error('Resposta inesperada do servidor ao gravar bloco (proxy/sessão).'));
        }
      } else {
        let serverMsg = `Erro HTTP ${xhr.status} ao enviar bloco`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.cancelled) {
            reject(new UploadCancelledError(parsed.error));
            return;
          }
          if (parsed?.error) serverMsg = parsed.error;
        } catch {}
        reject(new Error(serverMsg));
      }
    };

    xhr.ontimeout = () => {
      clearInterval(watchdogTimer);
      cleanupSignal();
      if (userAborted || signal?.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      reject(new Error('A restabelecer conexão para concluir bloco a 100%...'));
    };

    xhr.onerror = () => {
      clearInterval(watchdogTimer);
      cleanupSignal();
      if (userAborted || signal?.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      reject(new Error('Oscilação de rede ao enviar bloco. A retomar...'));
    };

    xhr.onabort = () => {
      clearInterval(watchdogTimer);
      cleanupSignal();
      if (userAborted || signal?.aborted) {
        reject(new UploadCancelledError());
        return;
      }
      reject(new Error('Envio reiniciado automaticamente para garantir conclusão a 100%.'));
    };

    xhr.send(payloadBuffer);
  });
}

async function uploadChunkWithFetchFallback(
  url: string,
  payloadBuffer: ArrayBuffer,
  headers: Record<string, string>,
  signal?: AbortSignal
): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: payloadBuffer,
    signal,
  });
  const data = await res.json().catch(() => null);
  if (data?.cancelled) {
    throw new UploadCancelledError(data.error);
  }
  if (!res.ok) {
    throw new Error(data?.error || `Erro HTTP ${res.status} ao enviar bloco.`);
  }
  if (!data || data.ok !== true) {
    throw new Error('O servidor não confirmou a gravação do bloco.');
  }
  return data;
}

function waitAbortableMs(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new UploadCancelledError());
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(t);
      reject(new UploadCancelledError());
    };
    const t = setTimeout(() => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function readBlobWithLocalRetry(blob: Blob, signal?: AbortSignal): Promise<ArrayBuffer> {
  let lastErr: unknown;
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) throw new UploadCancelledError();
    try {
      return await readBlobAsBuffer(blob);
    } catch (err) {
      lastErr = err;
      if (i < 2) {
        await waitAbortableMs(250 * (i + 1), signal);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Bloco ilegível no disco local.');
}

async function uploadChunkWithRetry(
  url: string,
  blob: Blob,
  headers: Record<string, string>,
  onChunkProgress: (loaded: number) => void,
  onStatusUpdate?: (status: string) => void,
  options?: { uploadId: string; chunkIndex: number; totalChunks: number; maxRetries?: number; signal?: AbortSignal }
): Promise<any> {
  const signal = options?.signal;
  if (signal?.aborted) throw new UploadCancelledError();
  let payloadBuffer: ArrayBuffer | null = null;
  const maxRetries = options?.maxRetries ?? 120;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new UploadCancelledError();
    await waitForBrowserOnline(onStatusUpdate, signal);
    try {
      if (!payloadBuffer) {
        payloadBuffer = await readBlobWithLocalRetry(blob, signal);
      }
      // Every 3rd failed XHR attempt, try fetch as an alternative transport
      if (attempt > 0 && attempt % 3 === 2) {
        const res = await uploadChunkWithFetchFallback(url, payloadBuffer, headers, signal);
        onChunkProgress(blob.size);
        return res;
      }
      return await uploadChunkWithXhr(url, payloadBuffer, headers, onChunkProgress, signal);
    } catch (err) {
      if (signal?.aborted || isUploadCancelledError(err)) {
        throw new UploadCancelledError();
      }
      lastErr = err;
      // O(1) check if server already saved this chunk before retrying
      if (options && options.totalChunks > 1) {
        const status = await fetchUploadStatusDetails(options.uploadId, options.totalChunks, options.chunkIndex, signal);
        if (status.hasChunk || status.receivedSet.has(options.chunkIndex)) {
          return { ok: true, chunkIndex: options.chunkIndex, totalChunks: options.totalChunks, recovered: true };
        }
      }
      if (attempt < maxRetries) {
        const delay = Math.min(4000, 400 + attempt * 500);
        if (onStatusUpdate) {
          onStatusUpdate(
            `A restabelecer bloco ${(options?.chunkIndex ?? 0) + 1}/${
              options?.totalChunks ?? 1
            } (tentativa ${attempt + 1}/${maxRetries})...`
          );
        }
        await waitAbortableMs(delay, signal);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Falha ao enviar bloco para o domínio.');
}

/**
 * Uploads a video or image file (up to multi-GB movies: 700MB - 3GB+) to the Server Media Vault
 * using adaptive 4MB direct-staged parallel chunks (up to 6 workers), infinite timeout (timeout = 0),
 * Wake Lock, keepalive pings, O(1) chunk verification, true skip-on-error block tolerance, AbortSignal cancel, and instant finalize.
 */
export async function uploadMediaToDomain(
  file: File,
  folder: 'videos' | 'images',
  onProgress?: (percent: number, telemetry?: UploadProgressTelemetry) => void,
  options?: { skipChunkErrors?: boolean; signal?: AbortSignal; onUploadIdReady?: (uploadId: string) => void }
): Promise<{
  streamPath: string;
  domainStreamUrl?: string;
  platformStreamUrl?: string;
  filename: string;
  size: number;
  mimeType: string;
  skippedChunksCount?: number;
}> {
  if (!file || file.size === 0) {
    throw new Error('O ficheiro selecionado está vazio (0 bytes) ou não pode ser lido.');
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    throw new UploadCancelledError();
  }

  const skipChunkErrors = options?.skipChunkErrors !== false;
  const totalSize = file.size;
  // Adaptive chunk size: cap at 2MB for multi-GB movies (>= 40MB) so slower links never hit proxy request timeouts; 1MB for >= 5MB; 512KB for small files
  const CHUNK_SIZE =
    totalSize >= 40 * 1024 * 1024
      ? 2 * 1024 * 1024
      : totalSize >= 5 * 1024 * 1024
        ? 1024 * 1024
        : 512 * 1024;
  const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (options?.onUploadIdReady) {
    options.onUploadIdReady(uploadId);
  }

  const startedAtMs = Date.now();
  const chunkLoadedBytes = new Array<number>(totalChunks).fill(0);
  const skippedIndicesSet = new Set<number>();
  const succeededIndicesSet = new Set<number>();
  let completedChunks = 0;
  let skippedChunks = 0;
  let highestProgress = 0;
  let currentStatusMsg = '';
  let singleChunkResult: any = null;
  let lastEmitAtMs = 0;

  const emitProgress = (forcePct?: number, immediate = false) => {
    if (signal?.aborted) return;
    const now = Date.now();
    if (!immediate && forcePct === undefined && now - lastEmitAtMs < 120) {
      return;
    }
    lastEmitAtMs = now;

    const totalLoaded = chunkLoadedBytes.reduce((acc, val) => acc + val, 0);
    const elapsedSec = Math.max(0.25, (now - startedAtMs) / 1000);
    const speedMBps = totalLoaded / (1024 * 1024) / elapsedSec;
    const remainingBytes = Math.max(0, totalSize - totalLoaded);
    const etaSeconds = speedMBps > 0.01 ? Math.ceil(remainingBytes / (speedMBps * 1024 * 1024)) : 0;

    const rawPct = forcePct !== undefined ? forcePct : (totalLoaded / totalSize) * 97;
    const clamped = Math.max(highestProgress, Math.min(99, Math.round(rawPct)));
    highestProgress = clamped;

    if (onProgress) {
      onProgress(clamped, {
        percent: clamped,
        speedMBps: Number(speedMBps.toFixed(2)),
        etaSeconds,
        completedChunks,
        totalChunks,
        skippedChunks,
        loadedBytes: totalLoaded,
        totalBytes: totalSize,
        statusMessage: currentStatusMsg,
      });
    }
  };

  // Prevent system sleep and keep session active while uploading multi-GB movies
  let wakeLockSentinel: any = null;
  try {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen').catch(() => null);
    }
  } catch {}

  const keepAliveInterval = setInterval(() => {
    if (!signal?.aborted) {
      fetch('/api/health').catch(() => {});
    }
  }, 25000);

  try {
    if (totalChunks === 1) {
      const singleUrl = buildChunkUploadUrl({
        filename: file.name,
        folder,
        uploadId,
        chunkIndex: 0,
        totalChunks: 1,
      });
      singleChunkResult = await uploadChunkWithRetry(
        singleUrl,
        file,
        {
          'Content-Type': 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
          'X-File-Folder': folder,
          'X-Upload-Id': uploadId,
          'X-Chunk-Index': '0',
          'X-Total-Chunks': '1',
          'X-Chunk-Bytes': String(file.size),
        },
        (loaded) => {
          chunkLoadedBytes[0] = loaded;
          emitProgress();
        },
        (msg) => {
          currentStatusMsg = msg;
          emitProgress(undefined, true);
        },
        { uploadId, chunkIndex: 0, totalChunks: 1, maxRetries: 15, signal }
      );
      completedChunks = 1;
      if (!singleChunkResult || !singleChunkResult.streamPath) {
        throw new Error('O servidor não retornou o link de streaming do ficheiro.');
      }
      if (onProgress) {
        onProgress(100, {
          percent: 100,
          speedMBps: Number(((totalSize / (1024 * 1024)) / Math.max(0.2, (Date.now() - startedAtMs) / 1000)).toFixed(2)),
          etaSeconds: 0,
          completedChunks: 1,
          totalChunks: 1,
          skippedChunks: 0,
          loadedBytes: totalSize,
          totalBytes: totalSize,
          statusMessage: '100% Gravado no domínio da plataforma!',
        });
      }
      return {
        streamPath: singleChunkResult.streamPath,
        domainStreamUrl: singleChunkResult.domainStreamUrl,
        platformStreamUrl: singleChunkResult.platformStreamUrl,
        filename: singleChunkResult.filename,
        size: singleChunkResult.size,
        mimeType: singleChunkResult.mimeType,
        skippedChunksCount: 0,
      };
    }

    const perBlockRetries = skipChunkErrors ? 4 : 60;

    const uploadChunkBatch = async (indices: number[], allowSkip: boolean) => {
      if (indices.length === 0) return;
      let cursor = 0;
      const MAX_WORKERS = Math.min(4, indices.length);

      const worker = async () => {
        while (true) {
          if (signal?.aborted) throw new UploadCancelledError();
          const pos = cursor++;
          if (pos >= indices.length) break;
          const idx = indices[pos];

          const start = idx * CHUNK_SIZE;
          const end = Math.min(totalSize, start + CHUNK_SIZE);
          const slice = file.slice(start, end);
          const chunkUrl = buildChunkUploadUrl({
            filename: file.name,
            folder,
            uploadId,
            chunkIndex: idx,
            totalChunks,
            manualFinalize: true,
          });

          try {
            await uploadChunkWithRetry(
              chunkUrl,
              slice,
              {
                'Content-Type': 'application/octet-stream',
                'X-File-Name': encodeURIComponent(file.name),
                'X-File-Folder': folder,
                'X-Upload-Id': uploadId,
                'X-Chunk-Index': String(idx),
                'X-Total-Chunks': String(totalChunks),
                'X-Chunk-Size': String(CHUNK_SIZE),
                'X-Total-Size': String(totalSize),
                'X-Chunk-Bytes': String(slice.size),
                'X-Manual-Finalize': 'true',
              },
              (loadedInChunk) => {
                chunkLoadedBytes[idx] = Math.min(slice.size, loadedInChunk);
                emitProgress();
              },
              (msg) => {
                currentStatusMsg = msg;
                emitProgress();
              },
              {
                uploadId,
                chunkIndex: idx,
                totalChunks,
                maxRetries: idx === 0 || idx === totalChunks - 1 ? Math.max(perBlockRetries, 8) : perBlockRetries,
                signal,
              }
            );
            chunkLoadedBytes[idx] = slice.size;
            succeededIndicesSet.add(idx);
            if (skippedIndicesSet.delete(idx)) {
              skippedChunks = skippedIndicesSet.size;
            }
            completedChunks = Math.min(totalChunks, succeededIndicesSet.size + skippedIndicesSet.size);
            currentStatusMsg = '';
            emitProgress(undefined, true);
          } catch (err) {
            if (signal?.aborted || isUploadCancelledError(err)) {
              throw new UploadCancelledError();
            }
            if (!allowSkip) {
              throw err;
            }
            skippedIndicesSet.add(idx);
            skippedChunks = skippedIndicesSet.size;
            chunkLoadedBytes[idx] = slice.size;
            completedChunks = Math.min(totalChunks, succeededIndicesSet.size + skippedIndicesSet.size);
            currentStatusMsg = `Bloco ${idx + 1} ignorado automaticamente (${skippedChunks} saltado(s)) — upload a continuar...`;
            emitProgress(undefined, true);
          }
        }
      };

      await Promise.all(Array.from({ length: MAX_WORKERS }, () => worker()));
    };

    const ensureServerHasChunksBeforeFinalize = async (): Promise<any | null> => {
      for (let recoveryPass = 0; recoveryPass < 3; recoveryPass++) {
        if (signal?.aborted) throw new UploadCancelledError();
        const status = await fetchUploadStatusDetails(uploadId, totalChunks, undefined, signal);
        if (status.alreadyFinalized && status.result?.streamPath) {
          return status.result;
        }
        // If server restarted and lost all temp chunks, reset skip set so everything is re-uploaded cleanly
        if (status.receivedSet.size === 0 && succeededIndicesSet.size > 0) {
          skippedIndicesSet.clear();
          skippedChunks = 0;
          succeededIndicesSet.clear();
        }
        const missingIndices: number[] = [];
        for (let i = 0; i < totalChunks; i++) {
          if (!status.receivedSet.has(i) && !(skipChunkErrors && skippedIndicesSet.has(i))) {
            missingIndices.push(i);
          }
        }
        if (missingIndices.length === 0) {
          return null;
        }
        const isFullReset = missingIndices.length === totalChunks;
        currentStatusMsg = isFullReset
          ? `A recuperar blocos no domínio (${missingIndices.length} blocos)...`
          : `A sincronizar ${missingIndices.length} bloco(s) em falta no domínio...`;
        for (const mIdx of missingIndices) {
          chunkLoadedBytes[mIdx] = 0;
        }
        emitProgress(undefined, true);
        // CRITICAL: Always honor skipChunkErrors across every recovery pass so errored blocks are never fatal
        await uploadChunkBatch(missingIndices, skipChunkErrors);
      }
      return null;
    };

    // Initial fast parallel upload pass
    const allIndices = Array.from({ length: totalChunks }, (_, i) => i);
    await uploadChunkBatch(allIndices, skipChunkErrors);

    if (signal?.aborted) throw new UploadCancelledError();
    if (succeededIndicesSet.size === 0) {
      throw new Error('Todos os blocos do vídeo falharam no envio.');
    }

    currentStatusMsg = 'A verificar integridade dos blocos gravados no domínio...';
    emitProgress(97, true);

    const earlyDoneResult = await ensureServerHasChunksBeforeFinalize();
    if (earlyDoneResult && earlyDoneResult.streamPath) {
      if (onProgress) {
        onProgress(100, {
          percent: 100,
          speedMBps: Number(((totalSize / (1024 * 1024)) / Math.max(0.2, (Date.now() - startedAtMs) / 1000)).toFixed(2)),
          etaSeconds: 0,
          completedChunks: totalChunks,
          totalChunks,
          skippedChunks: earlyDoneResult.skippedChunksCount ?? skippedIndicesSet.size,
          loadedBytes: totalSize,
          totalBytes: totalSize,
          statusMessage: '100% Concluído com integridade total',
        });
      }
      return {
        streamPath: earlyDoneResult.streamPath,
        domainStreamUrl: earlyDoneResult.domainStreamUrl,
        platformStreamUrl: earlyDoneResult.platformStreamUrl,
        filename: earlyDoneResult.filename,
        size: earlyDoneResult.size,
        mimeType: earlyDoneResult.mimeType,
        skippedChunksCount: earlyDoneResult.skippedChunksCount ?? skippedIndicesSet.size,
      };
    }

    currentStatusMsg =
      skippedIndicesSet.size > 0
        ? `A montar filme final (${skippedIndicesSet.size} bloco(s) com erro ignorados)...`
        : 'Todos os blocos recebidos! A finalizar e gravar o filme completo a 100%...';
    emitProgress(98, true);

    // Start async assembly on server (auto-recovers if server lost chunks due to restart/instance switch)
    let finData: any = null;
    let finErr: any = null;
    let chunkRecoveryCycles = 0;

    for (let attempt = 0; attempt < 25; attempt++) {
      if (signal?.aborted) throw new UploadCancelledError();
      await waitForBrowserOnline((m) => {
        currentStatusMsg = m;
        emitProgress(98, true);
      }, signal);
      try {
        const finRes = await fetch('/api/media/upload/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            uploadId,
            filename: file.name,
            folder,
            totalChunks,
            chunkSize: CHUNK_SIZE,
            totalSize,
            skipMissingChunks: skipChunkErrors,
            async: true,
          }),
        });
        const payload = await finRes.json().catch(() => ({}));
        if (payload?.cancelled || finRes.status === 410) {
          throw new UploadCancelledError(payload?.error);
        }
        if (finRes.status === 200 && payload.streamPath) {
          finData = payload;
          break;
        }
        if (finRes.status === 202 || payload.assembling) {
          // Poll background assembly progress until 100% completed (tolerates transient poll network drops)
          let consecutivePollErrors = 0;
          while (true) {
            await waitAbortableMs(900, signal);
            await waitForBrowserOnline(undefined, signal);
            try {
              const pollRes = await fetch(`/api/media/upload/finalize-status/${encodeURIComponent(uploadId)}`, { signal });
              const pollPayload = await pollRes.json().catch(() => ({}));
              consecutivePollErrors = 0;
              if (pollRes.status === 200 && pollPayload.streamPath) {
                finData = pollPayload;
                break;
              }
              if (pollRes.status === 202 || pollPayload.assembling) {
                const assembled = Number(pollPayload.assembledChunks || 0);
                const total = Number(pollPayload.totalChunks || totalChunks);
                currentStatusMsg = `A gravar ficheiro final no domínio (${assembled}/${total} blocos montados)...`;
                emitProgress(99, true);
                continue;
              }
              if (pollRes.status >= 502 && pollRes.status <= 504) {
                continue;
              }
              if (!pollRes.ok) {
                throw new Error(pollPayload.error || 'Erro ao montar o filme no domínio.');
              }
            } catch (pollErr) {
              if (signal?.aborted || isUploadCancelledError(pollErr)) {
                throw new UploadCancelledError();
              }
              consecutivePollErrors++;
              if (consecutivePollErrors >= 20) {
                throw pollErr;
              }
              await waitAbortableMs(1200, signal);
            }
          }
          if (finData?.streamPath) break;
        }

        // If server reports missing/no chunks (e.g. server restarted or routed to fresh instance), self-heal by re-uploading missing chunks!
        const isMissingChunksErr =
          finRes.status === 400 &&
          (payload?.code === 'NO_CHUNKS_FOUND' ||
            payload?.code === 'MISSING_CHUNK' ||
            String(payload?.error || '').includes('Nenhum bloco válido') ||
            String(payload?.error || '').includes('em falta'));

        if (isMissingChunksErr) {
          if (chunkRecoveryCycles < 2) {
            chunkRecoveryCycles++;
            currentStatusMsg = `Servidor sem os blocos temporários (recuperação ${chunkRecoveryCycles}/2). A reenviar blocos...`;
            emitProgress(97, true);
            const recoveredDone = await ensureServerHasChunksBeforeFinalize();
            if (recoveredDone && recoveredDone.streamPath) {
              finData = recoveredDone;
              break;
            }
            continue;
          }
          throw new Error(
            payload?.error ||
              'Nenhum bloco válido foi recebido no servidor após tentativas de recuperação. Verifique a estabilidade da ligação e tente novamente.'
          );
        }

        throw new Error(payload.error || 'O servidor não conseguiu montar o ficheiro final.');
      } catch (err) {
        if (signal?.aborted || isUploadCancelledError(err)) {
          await cancelMediaUpload(uploadId);
          throw new UploadCancelledError();
        }
        finErr = err;
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('Nenhum bloco válido') || msg.includes('recuperação')) {
          break;
        }
        currentStatusMsg = 'A concluir montagem final no domínio da plataforma...';
        emitProgress(99, true);
        if (attempt < 24) {
          await waitAbortableMs(2000, signal);
        }
      }
    }

    if (!finData || !finData.streamPath) {
      throw finErr instanceof Error ? finErr : new Error('O servidor não conseguiu montar o ficheiro final.');
    }

    const finalSkippedCount = finData.skippedChunksCount ?? skippedIndicesSet.size;

    if (onProgress) {
      onProgress(100, {
        percent: 100,
        speedMBps: Number(((totalSize / (1024 * 1024)) / Math.max(0.2, (Date.now() - startedAtMs) / 1000)).toFixed(2)),
        etaSeconds: 0,
        completedChunks: totalChunks,
        totalChunks,
        skippedChunks: finalSkippedCount,
        loadedBytes: totalSize,
        totalBytes: totalSize,
        statusMessage:
          finalSkippedCount > 0
            ? `100% Gravado no domínio (${finalSkippedCount} bloco(s) com erro ignorados)`
            : '100% Gravado no domínio da plataforma!',
      });
    }

    return {
      streamPath: finData.streamPath,
      domainStreamUrl: finData.domainStreamUrl,
      platformStreamUrl: finData.platformStreamUrl,
      filename: finData.filename,
      size: finData.size,
      mimeType: finData.mimeType,
      skippedChunksCount: finalSkippedCount,
    };
  } catch (err) {
    if (signal?.aborted || isUploadCancelledError(err)) {
      void cancelMediaUpload(uploadId);
      throw new UploadCancelledError();
    }
    throw err;
  } finally {
    clearInterval(keepAliveInterval);
    try {
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        await wakeLockSentinel.release();
      }
    } catch {}
  }
}

export interface LocateMovieFileResponse {
  ok: boolean;
  found: boolean;
  recovered?: boolean;
  matchReason?: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  streamPath?: string;
  domainStreamUrl?: string;
  platformStreamUrl?: string;
  probeInfo?: any;
}

export async function locateUploadedMovieFile(params: {
  query?: string;
  url?: string;
  title?: string;
}): Promise<LocateMovieFileResponse> {
  const qs = new URLSearchParams();
  if (params.query) qs.set('q', params.query);
  if (params.url) qs.set('url', params.url);
  if (params.title) qs.set('title', params.title);
  const res = await fetch(`/api/media/locate?${qs.toString()}`);
  if (!res.ok) {
    return { ok: false, found: false };
  }
  return res.json().catch(() => ({ ok: false, found: false }));
}

export async function prepareUploadedMovieForPlayback(streamPathOrUrl: string): Promise<{
  ok: boolean;
  streamPath?: string;
  prepared?: boolean;
  faststarted?: boolean;
  probeInfo?: any;
}> {
  if (!streamPathOrUrl.trim()) return { ok: false };
  try {
    const res = await fetch('/api/media/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamPath: streamPathOrUrl }),
    });
    if (!res.ok) return { ok: false };
    return res.json().catch(() => ({ ok: false }));
  } catch {
    return { ok: false };
  }
}

export async function fetchServerCatalogMovies<T = any>(): Promise<T[]> {
  const res = await fetch('/api/media/catalog');
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.movies) ? data.movies : [];
}

export async function saveServerCatalogMovie(movie: any): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('/api/media/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movie),
      });
      if (res.ok) return;
      const err = await res.json().catch(() => ({}));
      lastError = new Error(err?.error || 'Falha ao guardar filme no catálogo do domínio.');
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Erro de rede ao guardar filme no catálogo.');
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Falha ao guardar filme no catálogo do domínio.');
}

export async function deleteServerCatalogMovie(id: string): Promise<void> {
  await fetch(`/api/media/catalog/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export interface PlaybackServerCandidate {
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

export interface FindBestServersResponse {
  ok: boolean;
  resolvedImdbId: string | null;
  resolvedStreamPath?: string | null;
  vaultExists: boolean;
  probeInfo: any;
  bestServer: PlaybackServerCandidate | null;
  servers: PlaybackServerCandidate[];
}

const bestServersMemoryCache = new Map<string, { ts: number; data: FindBestServersResponse }>();
const warmedTargetsMemoryCache = new Map<string, number>();

function buildServerCacheKey(type: 'movie' | 'series' | 'live_tv', title: string, currentUrl?: string): string {
  return `${type}|${title.trim().toLowerCase()}|${(currentUrl || '').trim()}`;
}

export function getCachedBestPlaybackServers(params: {
  title: string;
  originalTitle?: string;
  type: 'movie' | 'series' | 'live_tv';
  currentUrl?: string;
}): FindBestServersResponse | null {
  const key = buildServerCacheKey(params.type, params.originalTitle || params.title || '', params.currentUrl);
  const entry = bestServersMemoryCache.get(key);
  if (entry && Date.now() - entry.ts < 45000) {
    return entry.data;
  }
  return null;
}

export function warmUpPlaybackTarget(rawUrl?: string | null): void {
  if (!rawUrl || typeof window === 'undefined') return;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('magnet:') || trimmed.startsWith('blob:')) return;
  const lastWarmed = warmedTargetsMemoryCache.get(trimmed) || 0;
  if (Date.now() - lastWarmed < 30000) return;
  if (warmedTargetsMemoryCache.size >= 40) {
    const oldest = warmedTargetsMemoryCache.keys().next().value;
    if (oldest) warmedTargetsMemoryCache.delete(oldest);
  }
  warmedTargetsMemoryCache.set(trimmed, Date.now());
  fetch(`/api/media/warmup?url=${encodeURIComponent(trimmed)}`).catch(() => {});
}

export async function findBestPlaybackServers(params: {
  title: string;
  originalTitle?: string;
  type: 'movie' | 'series' | 'live_tv';
  year?: number;
  imdbId?: string;
  currentUrl?: string;
  candidateUrls?: Array<{ url: string; label?: string; source?: string; quality?: string }>;
  searchWeb?: boolean;
  forceWebMovieSearch?: boolean;
  signal?: AbortSignal;
}): Promise<FindBestServersResponse> {
  const key = buildServerCacheKey(params.type, params.originalTitle || params.title || '', params.currentUrl);
  if (!params.forceWebMovieSearch && (!params.candidateUrls || params.candidateUrls.length === 0)) {
    const cached = bestServersMemoryCache.get(key);
    if (cached && Date.now() - cached.ts < 45000) {
      return cached.data;
    }
  }

  const res = await fetch('/api/servers/find-best', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      title: params.title,
      originalTitle: params.originalTitle,
      type: params.type,
      year: params.year,
      imdbId: params.imdbId,
      currentUrl: params.currentUrl,
      candidateUrls: params.candidateUrls || [],
      searchWeb: params.searchWeb !== false,
      forceWebMovieSearch: Boolean(params.forceWebMovieSearch),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || 'Não foi possível procurar servidores de reprodução.');
  }
  const data: FindBestServersResponse = await res.json();
  if (data?.ok && (data.bestServer || data.vaultExists)) {
    if (bestServersMemoryCache.size >= 40) {
      const oldest = bestServersMemoryCache.keys().next().value;
      if (oldest) bestServersMemoryCache.delete(oldest);
    }
    bestServersMemoryCache.set(key, { ts: Date.now(), data });
  }
  return data;
}

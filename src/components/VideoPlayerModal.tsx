import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  ChevronLeft,
  Settings,
  MessageSquare,
  Sparkles,
  Users,
  Sliders,
  Check,
  Link,
  Plus,
  Globe,
  Languages,
  Cpu,
  Zap,
  Activity,
  Server,
  Subtitles,
  RefreshCw,
  Search,
} from 'lucide-react';
import Hls from 'hls.js';
import * as dashjs from 'dashjs';
import flvjs from 'flv.js';
import shaka from 'shaka-player';
import mpegts from 'mpegts.js';
import Parser from 'srt-parser-2';
import {
  MediaItem,
  LiveChannel,
  InstalledStremioAddon,
  CodecSupportReport,
} from '../types/streaming';
import { probeBrowserCodecs, fetchStremioStreams, fetchStremioSubtitles } from '../lib/stremioAddons';
import {
  findBestPlaybackServers,
  getCachedBestPlaybackServers,
  PlaybackServerCandidate,
  warmUpPlaybackTarget,
} from '../lib/mediaDomain';

interface TrackInfo {
  id: number | string;
  name: string;
  lang?: string;
}

interface ExternalSubtitle {
  id: string;
  label: string;
  url: string;
  lang?: string;
}

interface OnlineSubtitleResult {
  id: string;
  label: string;
  lang: string;
  url: string;
  source: string;
  format?: string;
}

interface QualityLevel {
  id: number;
  label: string;
  width?: number;
  height?: number;
  bitrate?: number;
}

interface StreamProbeInfo {
  format: string;
  duration: number;
  videoCodec: string;
  audioCodec: string;
  width: number;
  height: number;
  is10Bit: boolean;
  hasSkippedChunks?: boolean;
  needsVideoTranscode: boolean;
  needsAudioTranscode: boolean;
  needsRemux: boolean;
  audioTracks: { index: number; codec: string; lang: string; title: string }[];
  subtitleTracks: { index: number; codec: string; lang: string; title: string }[];
}

interface VideoPlayerModalProps {
  media: MediaItem | null;
  channel?: LiveChannel | null;
  isGuest?: boolean;
  installedAddons?: InstalledStremioAddon[];
  onClose: () => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
  onGuestLimitReached?: (mediaTitle: string) => void;
  onStreamError?: (id: string) => void;
  onSubtitleGenerated?: (
    mediaId: string,
    sub: { lang: string; label: string; url: string; generatedAt: string }
  ) => void;
}

export type PlaybackEngine =
  | 'auto'
  | 'hls'
  | 'mpegts'
  | 'dash'
  | 'shaka'
  | 'flv'
  | 'proxy'
  | 'transcode'
  | 'html5'
  | 'torrent';

function unwrapRawUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith('/api/proxy?') || trimmed.startsWith('/api/transcode?')) {
    try {
      const parsed = new URL(trimmed, 'http://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) return inner;
    } catch {
      // ignore parse failure
    }
  }
  return trimmed;
}

function isLocalVaultPath(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  return trimmed.startsWith('/stream/media/') || trimmed.startsWith('/api/media/stream/');
}

function extractVaultPathFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (isLocalVaultPath(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.pathname.startsWith('/stream/media/') ||
      parsed.pathname.startsWith('/api/media/stream/')
    ) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // ignore
  }
  return null;
}

function isRemoteHttpUrl(rawUrl: string): boolean {
  const clean = unwrapRawUrl(rawUrl);
  return clean.startsWith('http://') || clean.startsWith('https://');
}

function isServerAddressableMedia(rawUrl: string): boolean {
  return isRemoteHttpUrl(rawUrl) || isLocalVaultPath(unwrapRawUrl(rawUrl));
}

function toProxyUrl(rawUrl: string): string {
  const clean = unwrapRawUrl(rawUrl);
  if (isLocalVaultPath(clean)) return clean;
  const vaultPath = extractVaultPathFromUrl(clean);
  if (vaultPath) return vaultPath;
  if (!isRemoteHttpUrl(clean)) return rawUrl;
  return `/api/proxy?url=${encodeURIComponent(clean)}`;
}

function toTranscodeUrl(
  rawUrl: string,
  vcodec: 'copy' | 'libx264',
  startSec = 0,
  isLiveStream = false,
  isLiteMode = false
): string {
  const clean = unwrapRawUrl(rawUrl);
  if (!isServerAddressableMedia(clean)) return rawUrl;
  const base = `/api/transcode?vcodec=${vcodec}&url=${encodeURIComponent(clean)}${isLiveStream ? '&live=1' : ''}${isLiteMode ? '&lite=1' : ''}`;
  return startSec > 0 ? `${base}&t=${Math.floor(startSec)}` : base;
}

function detectRawIptvTs(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('.mp4') || lower.includes('.mkv') || lower.includes('.mpd')) {
    return false;
  }
  return (
    lower.includes('.ts') ||
    /:\d{4,5}\/(play|live|stream|ch|ts)\b/i.test(url) ||
    /:\d{4,5}\/?$/.test(url) ||
    /\/\d+\/\d+\/\d+/.test(url)
  );
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  media,
  channel,
  isGuest = false,
  installedAddons,
  onClose,
  onOpenRegister,
  onOpenLogin,
  onGuestLimitReached,
  onStreamError,
  onSubtitleGenerated,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<dashjs.MediaPlayerClass | null>(null);
  const flvRef = useRef<flvjs.Player | null>(null);
  const shakaRef = useRef<any>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const torrentClientRef = useRef<any>(null);

  const [selectedEngine, setSelectedEngine] = useState<PlaybackEngine>('auto');
  const [cascadeStage, setCascadeStage] = useState<number>(0); // 0: primary, 1: HTTPS proxy, 2: FFmpeg remux, 3: FFmpeg H.264+AAC
  const [transcodeOffsetSec, setTranscodeOffsetSec] = useState<number>(0);
  const [activeEngineName, setActiveEngineName] = useState<string>('Multi-Engine Auto');

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showExperimentalNotification, setShowExperimentalNotification] = useState(false);

  // Dynamic Menus
  const [showXRay, setShowXRay] = useState(false);
  const [showAudioSubtitles, setShowAudioSubtitles] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Track States & Telemetry
  const [audioTracks, setAudioTracks] = useState<TrackInfo[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<TrackInfo[]>([]);
  const [externalSubtitles, setExternalSubtitles] = useState<ExternalSubtitle[]>([]);
  const [selectedAudioId, setSelectedAudioId] = useState<number | string>(-1);
  const [selectedAudioLang, setSelectedAudioLang] = useState<'pt-BR' | 'pt-PT' | 'original'>('pt-BR');
  const [selectedSubtitleId, setSelectedSubtitleId] = useState<number | string>(-1);
  const [onlineSubtitles, setOnlineSubtitles] = useState<OnlineSubtitleResult[]>([]);
  const [isSearchingOnlineSubs, setIsSearchingOnlineSubs] = useState(false);
  const [onlineSubQuery, setOnlineSubQuery] = useState(media?.originalTitle || media?.title || '');
  const [onlineSubStatus, setOnlineSubStatus] = useState<string | null>(null);
  const [appliedOnlineSubUrl, setAppliedOnlineSubUrl] = useState<string | null>(null);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState(false);
  const [subGenStatus, setSubGenStatus] = useState<string | null>(null);
  const [subGenError, setSubGenError] = useState<string | null>(null);

  const [probeInfo, setProbeInfo] = useState<StreamProbeInfo | null>(null);
  const [browserCodecs, setBrowserCodecs] = useState<CodecSupportReport[]>([]);

  // Best-Server Discovery & Benchmarking State
  const [activeCustomUrl, setActiveCustomUrl] = useState<string | null>(null);
  const [rankedServers, setRankedServers] = useState<PlaybackServerCandidate[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null);
  const [isSearchingBestServer, setIsSearchingBestServer] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [showServersPanel, setShowServersPanel] = useState(false);
  const [turboBufferEnabled, setTurboBufferEnabled] = useState(true);
  const [lightweightMode, setLightweightMode] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [isVaultProbeReady, setIsVaultProbeReady] = useState(false);
  const [autoStreamHint, setAutoStreamHint] = useState<'hls' | 'mpegts' | 'torrent' | null>(null);
  const userPickedServerRef = useRef<boolean>(false);
  const manualEngineLockedRef = useRef<boolean>(false);
  const hasSearchedWebFallbackRef = useRef<boolean>(false);
  const hasPlaybackStartedRef = useRef<boolean>(false);
  const triedServerUrlsRef = useRef<Set<string>>(new Set());
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const waitingSpinnerTimerRef = useRef<number | null>(null);
  const lastProgressTimeRef = useRef<{ time: number; ts: number; stallTier: number }>({
    time: 0,
    ts: 0,
    stallTier: 0,
  });
  const switchingSourceGuardRef = useRef<boolean>(false);

  // Quality & Speed selections
  const [selectedQuality, setSelectedQuality] = useState('Automático');
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQualityLevelIndex, setSelectedQualityLevelIndex] = useState<number>(-1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const isLive = (channel !== undefined && channel !== null) || media?.type === 'live_tv';
  const GUEST_PREVIEW_LIMIT_SEC = 180;
  const [showGuestRegisterPrompt, setShowGuestRegisterPrompt] = useState(false);
  const [guestLimitLocked, setGuestLimitLocked] = useState(false);
  const [guestRemainingSec, setGuestRemainingSec] = useState(GUEST_PREVIEW_LIMIT_SEC);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isMissingLocalFile, setIsMissingLocalFile] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const guestElapsedRef = useRef<number>(0);
  const hasEscalatedAttemptRef = useRef<boolean>(false);

  const displayTitle = channel ? channel.currentShow : media?.title || 'Reproduzindo';
  const subtitleInfo = channel
    ? `Canal ${channel.channelNumber} • ${channel.name} • AO VIVO (Acesso Livre)`
    : media?.quality
      ? `${media.quality} • ${media.duration || ''}`
      : '';

  const baseSourceUrl = channel ? channel.videoUrl : media?.videoUrl || '';
  const videoSource = activeCustomUrl || baseSourceUrl;

  const applyServerCandidate = (srv: PlaybackServerCandidate, isManual = false) => {
    if (isManual) {
      userPickedServerRef.current = true;
    }
    manualEngineLockedRef.current = false;
    setActiveServerId(srv.id);
    setIsMissingLocalFile(false);
    setPlaybackError(null);
    setTranscodeOffsetSec(0);

    const hint: 'hls' | 'mpegts' | 'torrent' | null =
      srv.engine === 'hls'
        ? 'hls'
        : srv.engine === 'mpegts'
          ? 'mpegts'
          : srv.engine === 'torrent'
            ? 'torrent'
            : null;
    setAutoStreamHint(hint);

    if (srv.isLocalVault) {
      if (baseSourceUrl !== srv.url) {
        setActiveCustomUrl(srv.url);
      } else {
        setActiveCustomUrl(null);
      }
      setSelectedEngine('auto');
      if (srv.engine === 'transcode') {
        setCascadeStage(srv.vcodec === 'copy' ? 2 : 3);
      } else {
        setCascadeStage(0);
      }
    } else {
      const nextUrl = srv.url === baseSourceUrl ? null : srv.url;
      setActiveCustomUrl(nextUrl);
      if (srv.engine === 'torrent') {
        setSelectedEngine('torrent');
        setCascadeStage(0);
      } else {
        setSelectedEngine('auto');
        if (srv.engine === 'transcode') {
          setCascadeStage(srv.vcodec === 'copy' ? 2 : 3);
        } else if (srv.engine === 'proxy' || srv.playbackUrl.startsWith('/api/proxy?')) {
          setCascadeStage(1);
        } else {
          setCascadeStage(0);
        }
      }
    }

    const latencyLabel = srv.isLocalVault ? `${srv.latencyMs}ms local` : `${srv.latencyMs}ms`;
    setServerNotice(`Servidor ativo: ${srv.label} (${latencyLabel})`);
  };

  useEffect(() => {
    if (!serverNotice) return;
    const t = window.setTimeout(() => setServerNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [serverNotice]);

  const runBestServerDiscovery = async (options?: {
    searchWeb?: boolean;
    autoApply?: boolean;
    forceWebMovieSearch?: boolean;
    signal?: AbortSignal;
  }): Promise<PlaybackServerCandidate | null> => {
    setIsSearchingBestServer(true);
    try {
      const candidateUrls: Array<{ url: string; label?: string; source?: string; quality?: string }> = [];
      if (media && !isLive && installedAddons && installedAddons.some((a) => a.enabled)) {
        try {
          const addonStreams = await fetchStremioStreams(media, installedAddons);
          for (const st of addonStreams) {
            if (st?.url) {
              candidateUrls.push({
                url: st.url,
                label: st.name || st.title || st.addonName || 'Addon Web',
                source: st.addonName || 'Addon Stremio',
              });
            }
          }
        } catch {
          // ignore addon lookup hiccup
        }
      }

      const targetTitle = channel ? channel.name : media?.title || '';
      const result = await findBestPlaybackServers({
        title: targetTitle,
        originalTitle: media?.originalTitle,
        type: isLive ? 'live_tv' : media?.type === 'series' ? 'series' : 'movie',
        year: media?.year,
        imdbId: media?.id && /^tt\d+$/i.test(media.id) ? media.id : undefined,
        currentUrl: baseSourceUrl,
        candidateUrls,
        searchWeb: options?.searchWeb !== false,
        forceWebMovieSearch: Boolean(options?.forceWebMovieSearch),
        signal: options?.signal,
      });

      if (options?.signal?.aborted) return null;

      setRankedServers(result.servers || []);
      if (result.probeInfo) {
        setProbeInfo(result.probeInfo);
        if (result.probeInfo.duration > 0) {
          setDuration((prev) => (prev > 0 ? prev : result.probeInfo.duration));
        }
        if (result.probeInfo.audioTracks && result.probeInfo.audioTracks.length > 0) {
          setAudioTracks((prev) =>
            prev.length > 0
              ? prev
              : result.probeInfo.audioTracks.map((t: any) => ({
                  id: t.index,
                  name: `${t.title} (${String(t.codec || '').toUpperCase()})`,
                  lang: t.lang,
                }))
          );
        }
      }

      const best = result.bestServer;
      if (best && best.alive) {
        if (options?.autoApply && !userPickedServerRef.current) {
          const activeUrl = activeCustomUrl || baseSourceUrl;
          const primaryRaw = unwrapRawUrl(baseSourceUrl);
          const bestRaw = unwrapRawUrl(best.url);
          const currentEntry = result.servers.find(
            (s) => s.url === activeUrl || unwrapRawUrl(s.url) === unwrapRawUrl(activeUrl)
          );
          const primaryEntry = primaryRaw
            ? result.servers.find((s) => unwrapRawUrl(s.url) === primaryRaw)
            : null;
          const currentIsDead = Boolean(currentEntry && !currentEntry.alive) || !baseSourceUrl;
          // NEVER interrupt a movie or Live TV channel that is already playing smoothly
          const alreadyPlayingCleanly = hasPlaybackStartedRef.current && !playbackError;
          const isVaultUrlRecovered = Boolean(
            best.isLocalVault &&
              best.url &&
              extractVaultPathFromUrl(unwrapRawUrl(best.url)) !== extractVaultPathFromUrl(unwrapRawUrl(activeUrl))
          );
          const isVaultSwitch = Boolean(
            !alreadyPlayingCleanly &&
              best.isLocalVault &&
              (isVaultUrlRecovered ||
                (best.id === 'vault-remux' && cascadeStage !== 2) ||
                (best.id === 'vault-transcode' && cascadeStage !== 3 && selectedEngine !== 'transcode') ||
                (best.id === 'vault-direct' && (cascadeStage !== 0 || selectedEngine !== 'auto')))
          );
          // Stay strictly on the movie's configured primary server whenever it is alive;
          // only apply remote bestServer if it IS the primary server upgrading its engine (e.g. remux/proxy/hls) OR primary server failed.
          const isPrimaryEngineUpgrade = Boolean(
            !alreadyPlayingCleanly &&
              !best.isLocalVault &&
              primaryRaw &&
              bestRaw === primaryRaw &&
              (best.engine === 'transcode' || best.engine === 'proxy' || best.engine === 'hls' || best.engine === 'mpegts')
          );
          // Only switch away from a configured primary movie URL during launch discovery if it's the SAME origin URL
          // (optimizing between direct / proxy / remux / transcode) or recovering a missing local vault path;
          // backup mirror failover happens via triggerWebServerFallback ONLY if playback of baseSourceUrl actually fails.
          const isFallbackSwitch =
            !alreadyPlayingCleanly &&
            (isLive || !baseSourceUrl) &&
            !best.isLocalVault &&
            best.url !== activeUrl &&
            currentIsDead &&
            (!primaryEntry || !primaryEntry.alive);

          if ((!alreadyPlayingCleanly && !baseSourceUrl) || isVaultSwitch || isPrimaryEngineUpgrade || isFallbackSwitch) {
            applyServerCandidate(best, false);
          } else {
            setActiveServerId(primaryEntry ? primaryEntry.id : best.id);
          }
        }
        return best;
      }

      if (!result.vaultExists && isLocalVaultPath(extractVaultPathFromUrl(unwrapRawUrl(baseSourceUrl)) || unwrapRawUrl(baseSourceUrl))) {
        setIsMissingLocalFile(true);
        setIsBuffering(false);
        setPlaybackError(
          'O ficheiro deste filme não foi encontrado no armazenamento do servidor e nenhuma fonte web alternativa respondeu. Faça o upload novamente no modo Administrador.'
        );
        setIsPlaying(false);
      }

      return null;
    } catch {
      return null;
    } finally {
      if (!options?.signal?.aborted) {
        setIsSearchingBestServer(false);
      }
    }
  };

  // Reset server state when the base item changes
  useEffect(() => {
    setActiveCustomUrl(null);
    setRankedServers([]);
    setActiveServerId(null);
    setServerNotice(null);
    setAutoStreamHint(null);
    setSelectedEngine('auto');
    if (baseSourceUrl.startsWith('/api/transcode?vcodec=libx264')) {
      setCascadeStage(3);
    } else if (baseSourceUrl.startsWith('/api/transcode?vcodec=copy')) {
      setCascadeStage(2);
    } else if (baseSourceUrl.startsWith('/api/proxy?')) {
      setCascadeStage(1);
    } else {
      setCascadeStage(0);
    }
    setBufferedPercent(0);
    userPickedServerRef.current = false;
    manualEngineLockedRef.current = false;
    hasSearchedWebFallbackRef.current = false;
    hasPlaybackStartedRef.current = false;
    triedServerUrlsRef.current = new Set();
  }, [baseSourceUrl, media?.id, channel?.id]);

  // Reset probe & playback-started flag only when the active videoSource actually changes
  useEffect(() => {
    setProbeInfo(null);
    setIsMissingLocalFile(false);
    setBufferedPercent(0);
    hasPlaybackStartedRef.current = false;
  }, [videoSource]);

  // Reset seek offset & errors when videoSource changes or user explicitly clicks retry
  useEffect(() => {
    setTranscodeOffsetSec(0);
    setPlaybackError(null);
  }, [videoSource, retryCount]);

  // Run browser codec inspection once
  useEffect(() => {
    setBrowserCodecs(probeBrowserCodecs());
  }, []);

  // Automatically inspect & rank best playback server (Vault codecs OR web mirrors) on launch
  useEffect(() => {
    const controller = new AbortController();
    const rawBase = unwrapRawUrl(baseSourceUrl);
    const extracted = extractVaultPathFromUrl(rawBase) || rawBase;
    const isLocalVault = isLocalVaultPath(extracted);
    const targetTitle = channel ? channel.name : media?.title || '';
    const itemType: 'movie' | 'series' | 'live_tv' = isLive
      ? 'live_tv'
      : media?.type === 'series'
        ? 'series'
        : 'movie';

    if (baseSourceUrl) {
      warmUpPlaybackTarget(baseSourceUrl);
    }

    // Instant synchronous cache hydration from DetailsView prefetch -> 0ms startup wait!
    const cached = getCachedBestPlaybackServers({
      title: targetTitle,
      originalTitle: media?.originalTitle,
      type: itemType,
      currentUrl: baseSourceUrl,
    });
    if (cached && cached.bestServer && cached.bestServer.alive) {
      setRankedServers(cached.servers || []);
      if (cached.probeInfo) {
        setProbeInfo(cached.probeInfo);
      }
      setIsVaultProbeReady(true);
      const cachedBestRaw = unwrapRawUrl(cached.bestServer.url);
      const isSameOriginCandidate = Boolean(
        !baseSourceUrl ||
          (rawBase && cachedBestRaw && cachedBestRaw === rawBase) ||
          (cached.bestServer.isLocalVault &&
            isLocalVault &&
            extractVaultPathFromUrl(cachedBestRaw) === extracted)
      );
      if (!userPickedServerRef.current && isSameOriginCandidate) {
        applyServerCandidate(cached.bestServer, false);
      }
      return () => controller.abort();
    }

    const needsBriefVaultProbe =
      !baseSourceUrl ||
      (isLocalVault && !/\.(mp4|m4v|webm)(\?|$)/i.test(extracted));

    if (needsBriefVaultProbe) {
      setIsVaultProbeReady(false);
    } else {
      setIsVaultProbeReady(true);
    }

    const fallbackReadyTimer = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setIsVaultProbeReady(true);
      }
    }, 180);

    // Search web right away ONLY if primary URL is missing or Live TV; for configured movies, keep primary server first without slow web lookups
    void runBestServerDiscovery({
      searchWeb: !baseSourceUrl || isLive,
      autoApply: true,
      signal: controller.signal,
    }).finally(() => {
      window.clearTimeout(fallbackReadyTimer);
      if (!controller.signal.aborted) {
        setIsVaultProbeReady(true);
      }
    });

    return () => {
      window.clearTimeout(fallbackReadyTimer);
      controller.abort();
    };
  }, [baseSourceUrl, media?.id, channel?.id]);

  // Probe stream codecs if activeCustomUrl changed to a new remote/vault URL manually
  useEffect(() => {
    if (!activeCustomUrl) return;
    const rawTarget = unwrapRawUrl(activeCustomUrl);
    const extracted = extractVaultPathFromUrl(rawTarget) || rawTarget;
    if (!extracted || !isServerAddressableMedia(extracted)) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/probe?url=${encodeURIComponent(extracted)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: StreamProbeInfo | null) => {
        if (!data) return;
        setProbeInfo(data);
        if (data.duration > 0) {
          setDuration((prev) => (prev > 0 ? prev : data.duration));
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [activeCustomUrl]);

  // Automatically route incompatible codecs/containers through FFmpeg when probe telemetry completes
  useEffect(() => {
    if (selectedEngine !== 'auto' || cascadeStage !== 0 || !probeInfo || isMissingLocalFile) return;
    if (probeInfo.needsVideoTranscode) {
      setCascadeStage(3);
    } else if (probeInfo.needsAudioTranscode || probeInfo.needsRemux) {
      setCascadeStage(2);
    }
  }, [probeInfo, selectedEngine, cascadeStage, isMissingLocalFile]);


  // Reset guest 3-minute timer when switching media/channel or signing in
  useEffect(() => {
    guestElapsedRef.current = 0;
    setGuestRemainingSec(GUEST_PREVIEW_LIMIT_SEC);
    setGuestLimitLocked(false);
    setShowGuestRegisterPrompt(false);
  }, [media?.id, channel?.id, isGuest]);

  // For unregistered users: allow 3 minutes (180s) of playback, then pause and prompt registration
  useEffect(() => {
    if (!isGuest) {
      setShowGuestRegisterPrompt(false);
      setGuestLimitLocked(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      if (isPlaying && !guestLimitLocked && !playbackError) {
        guestElapsedRef.current += 1;
        const remaining = Math.max(0, GUEST_PREVIEW_LIMIT_SEC - guestElapsedRef.current);
        setGuestRemainingSec(remaining);
        if (remaining <= 0) {
          if (videoRef.current && !videoRef.current.paused) {
            videoRef.current.pause();
          }
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
          }
          setIsPlaying(false);
          setGuestLimitLocked(true);
          setShowGuestRegisterPrompt(true);
          onGuestLimitReached?.(displayTitle);
        }
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isGuest, isPlaying, guestLimitLocked, playbackError, displayTitle]);

  // Show experimental platform notification every 1 minute while playing content
  useEffect(() => {
    if (!isPlaying || playbackError || (isGuest && guestLimitLocked)) {
      setShowExperimentalNotification(false);
      return;
    }

    setShowExperimentalNotification(true);
    const hideTimer = window.setTimeout(() => {
      setShowExperimentalNotification(false);
    }, 12000);

    const intervalId = window.setInterval(() => {
      if (isPlaying && !playbackError && !(isGuest && guestLimitLocked)) {
        setShowExperimentalNotification(true);
        const autoHide = window.setTimeout(() => {
          setShowExperimentalNotification(false);
        }, 12000);
        return () => window.clearTimeout(autoHide);
      }
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(hideTimer);
    };
  }, [isPlaying, playbackError, isGuest, guestLimitLocked]);

  // Clean up all player engines cleanly
  const destroyAllEngines = () => {
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }
    if (dashRef.current) {
      try {
        dashRef.current.destroy();
      } catch {}
      dashRef.current = null;
    }
    if (flvRef.current) {
      try {
        flvRef.current.destroy();
      } catch {}
      flvRef.current = null;
    }
    if (shakaRef.current) {
      try {
        shakaRef.current.destroy();
      } catch {}
      shakaRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.pause();
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch {}
      mpegtsRef.current = null;
    }
    if (torrentClientRef.current) {
      try {
        torrentClientRef.current.destroy();
      } catch {}
      torrentClientRef.current = null;
    }
  };

  // Escalate automatically through the cascade if an engine fails in 'auto' mode,
  // or failover seamlessly to the next alive server (cached or freshly searched on the web)
  const triggerWebServerFallback = async (fallbackErrMsg: string) => {
    const failedUrl = unwrapRawUrl(videoSource);
    if (failedUrl) {
      triedServerUrlsRef.current.add(failedUrl);
    }

    // 1. Check already-ranked alive backup servers first (instant failover with zero wait)
    const cachedBackup = rankedServers.find(
      (s) => s.alive && !triedServerUrlsRef.current.has(unwrapRawUrl(s.url))
    );
    if (cachedBackup) {
      applyServerCandidate(cachedBackup, false);
      return true;
    }

    // 2. Search web & addons for fresh alive servers if not yet searched
    if (!hasSearchedWebFallbackRef.current) {
      hasSearchedWebFallbackRef.current = true;
      setServerNotice('A procurar automaticamente o melhor servidor alternativo na web...');
      const foundBest = await runBestServerDiscovery({
        searchWeb: true,
        autoApply: false,
        forceWebMovieSearch: true,
      });
      if (
        foundBest &&
        foundBest.alive &&
        !triedServerUrlsRef.current.has(unwrapRawUrl(foundBest.url))
      ) {
        applyServerCandidate(foundBest, false);
        return true;
      }
    }

    setIsBuffering(false);
    setPlaybackError(fallbackErrMsg);
    setIsPlaying(false);
    if (isLive && onStreamError && channel?.id) {
      onStreamError(channel.id);
    }
    return false;
  };

  const escalateCascade = (preserveCurrentTime = true) => {
    if ((manualEngineLockedRef.current && selectedEngine !== 'auto') || isMissingLocalFile) return false;
    const raw = unwrapRawUrl(videoSource);
    const target = extractVaultPathFromUrl(raw) || raw;
    if (!isServerAddressableMedia(target)) return false;
    if (hasEscalatedAttemptRef.current) return true;
    if (cascadeStage < 3) {
      hasEscalatedAttemptRef.current = true;
      switchingSourceGuardRef.current = true;
      const isVault = isLocalVaultPath(target);
      if (preserveCurrentTime && !isLive && videoRef.current) {
        const cur = videoRef.current.currentTime;
        const absoluteCur =
          cascadeStage >= 2 ? transcodeOffsetSec + cur : cur;
        if (Number.isFinite(absoluteCur) && absoluteCur > 3) {
          setTranscodeOffsetSec(Math.floor(absoluteCur));
        }
      }
      if (selectedEngine !== 'auto') {
        setSelectedEngine('auto');
      }
      setCascadeStage((prev) => {
        if (prev === 0 && probeInfo) {
          if (probeInfo.needsVideoTranscode) return 3;
          if (probeInfo.needsAudioTranscode || probeInfo.needsRemux) return 2;
        }
        // Local vault streams don't need the remote HTTPS proxy stage (stage 1)
        if (prev === 0 && isVault) return 2;
        return prev + 1;
      });
      return true;
    }
    return false;
  };

  // Stream initialization across all engines & server fallback stages
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    if (isMissingLocalFile) {
      setIsBuffering(false);
      return;
    }

    const rawTarget = unwrapRawUrl(videoSource);
    const extractedVault = extractVaultPathFromUrl(rawTarget);
    const normalizedTarget = extractedVault || rawTarget;
    const isLocalVault = isLocalVaultPath(normalizedTarget);

    // Wait briefly (~5ms when cached on upload, max 260ms) before booting raw HTML5 on local vault files
    // so incompatible codecs (HEVC/AC3/skipped blocks) launch the right FFmpeg engine on the very first attempt!
    if (
      selectedEngine === 'auto' &&
      cascadeStage === 0 &&
      isLocalVault &&
      !isVaultProbeReady &&
      !probeInfo
    ) {
      setIsBuffering(true);
      return;
    }

    switchingSourceGuardRef.current = false;
    hasEscalatedAttemptRef.current = false;
    setPlaybackError(null);
    setIsBuffering(true);
    setQualityLevels([]);
    setSelectedQualityLevelIndex(-1);
    destroyAllEngines();

    let isCleanedUp = false;
    const isRemote = !isLocalVault && isRemoteHttpUrl(normalizedTarget);
    const isServerMedia = isServerAddressableMedia(normalizedTarget);
    let decodedTarget = normalizedTarget;
    try {
      decodedTarget = decodeURIComponent(normalizedTarget);
    } catch {
      decodedTarget = normalizedTarget;
    }
    const lower = normalizedTarget.toLowerCase();
    const decodedLower = decodedTarget.toLowerCase();
    const isHttpsPage = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const isMixedHttp = isHttpsPage && normalizedTarget.startsWith('http://');

    const isTorrent =
      normalizedTarget.startsWith('magnet:') ||
      lower.includes('.torrent') ||
      selectedEngine === 'torrent' ||
      (selectedEngine === 'auto' && autoStreamHint === 'torrent');
    const isDASH = lower.includes('.mpd') || selectedEngine === 'dash';
    const isFLV = (lower.includes('.flv') && selectedEngine === 'flv') || selectedEngine === 'flv';
    const isHLS =
      lower.includes('.m3u8') ||
      selectedEngine === 'hls' ||
      (selectedEngine === 'auto' && autoStreamHint === 'hls');
    const isMPEGTS =
      selectedEngine === 'mpegts' ||
      (selectedEngine === 'auto' &&
        !isHLS &&
        !isDASH &&
        !isFLV &&
        (autoStreamHint === 'mpegts' || (isRemote && detectRawIptvTs(normalizedTarget))));
    const isUnsupportedContainer =
      selectedEngine === 'auto' &&
      isServerMedia &&
      (/\.(mkv|avi|mpg|mpeg|wmv|vob|divx|xvid|m2ts|mts|asf|3gp|ogv)(?=[\?"'&\s]|$)/i.test(lower) ||
        /\.(mkv|avi|mpg|mpeg|wmv|vob|divx|xvid|m2ts|mts|asf|3gp|ogv)(?=[\?"'&\s]|$)/i.test(decodedLower));
    const urlHintsHevcOrLegacyVideo =
      /\b(x265|h\.?265|hevc|10bit|10-bit|divx|xvid)\b/i.test(decodedLower) ||
      /\.(avi|mpg|mpeg|wmv|vob|divx|xvid|asf|3gp|ogv)(?=[\?"'&\s]|$)/i.test(decodedLower);

    // Manual or cascaded FFmpeg Transcode / Remux stages (lossless Remux for H.264 MKV, libx264 only when needed)
    const shouldUseFullTranscode =
      isServerMedia &&
      (selectedEngine === 'transcode' ||
        (cascadeStage >= 3) ||
        (cascadeStage === 0 && videoSource.startsWith('/api/transcode?vcodec=libx264')) ||
        (selectedEngine === 'auto' &&
          isUnsupportedContainer &&
          (Boolean(probeInfo?.needsVideoTranscode) || (!probeInfo && urlHintsHevcOrLegacyVideo))));
    const shouldUseRemux =
      isServerMedia &&
      selectedEngine === 'auto' &&
      (cascadeStage === 2 ||
        (cascadeStage === 0 && videoSource.startsWith('/api/transcode?vcodec=copy')) ||
        (isUnsupportedContainer && !shouldUseFullTranscode)) &&
      !shouldUseFullTranscode;
    const shouldUseProxy =
      isRemote &&
      (selectedEngine === 'proxy' ||
        videoSource.startsWith('/api/proxy?') ||
        (selectedEngine === 'auto' && (cascadeStage === 1 || isMixedHttp)));

    const handleAutoplayBlocked = () => {
      if (isCleanedUp) return;
      setIsPlaying(false);
      setIsBuffering(false);
      setShowControls(true);
    };

    if (shouldUseFullTranscode || shouldUseRemux) {
      const vcodec: 'copy' | 'libx264' = shouldUseRemux ? 'copy' : 'libx264';
      setActiveEngineName(
        vcodec === 'copy'
          ? 'Salgueiro FFmpeg Remux Engine (Stream Copy + AAC Stereo)'
          : 'Salgueiro FFmpeg Transcoder (H.264 High + AAC Stereo)'
      );
      video.src = toTranscodeUrl(normalizedTarget, vcodec, transcodeOffsetSec, isLive, lightweightMode);
      video.load();
      video.play().catch(handleAutoplayBlocked);
      return () => {
        isCleanedUp = true;
        destroyAllEngines();
      };
    }

    const effectiveUrl = shouldUseProxy ? toProxyUrl(normalizedTarget) : isLocalVault ? normalizedTarget : videoSource;

    if (selectedEngine === 'shaka') {
      setActiveEngineName('Google Shaka Player v4 (DASH/HLS/MSE • Modo Leve)');
      shaka.polyfill.installAll();
      if (shaka.Player.isBrowserSupported()) {
        const player = new shaka.Player();
        player.configure({
          abr: {
            defaultBandwidthEstimate: lightweightMode ? 1500000 : 3000000,
            restrictions: lightweightMode ? { maxHeight: 720, maxBandwidth: 3500000 } : {},
          },
          streaming: {
            bufferingGoal: turboBufferEnabled ? (isLive ? (lightweightMode ? 35 : 45) : (lightweightMode ? 80 : 120)) : 30,
            rebufferingGoal: 2,
            bufferBehind: lightweightMode ? 20 : 45,
            retryParameters: {
              maxAttempts: 6,
              baseDelay: 400,
              backoffFactor: 1.5,
            },
          },
        });
        player.attach(video).then(() => {
          if (isCleanedUp) return;
          shakaRef.current = player;
          return player.load(effectiveUrl);
        }).then(() => {
          if (isCleanedUp) return;
          const variants = player.getVariantTracks();
          const levels: QualityLevel[] = variants
            .map((v: any, idx: number) => ({
              id: idx,
              label: `${v.height}p`,
              width: v.width,
              height: v.height,
              bitrate: v.bandwidth,
            }))
            .filter((v, i, a) => a.findIndex((t) => t.height === v.height) === i)
            .sort((a, b) => (b.height || 0) - (a.height || 0));
          setQualityLevels(levels);
          video.play().catch(handleAutoplayBlocked);
        }).catch(() => {
          player.destroy().catch(() => {});
          if (shakaRef.current === player) shakaRef.current = null;
          if (!isCleanedUp && !escalateCascade()) {
            void triggerWebServerFallback('Falha no motor Shaka Player — a tentar alternativa...');
          }
        });
      }
    } else if (isFLV && flvjs.isSupported()) {
      const stashKb = turboBufferEnabled ? (lightweightMode ? 512 : 1024) : 512;
      setActiveEngineName(
        shouldUseProxy
          ? `FLV.js + Proxy HTTPS (Stash ${stashKb}KB)`
          : `FLV.js Engine (HTTP-FLV • Stash ${stashKb}KB)`
      );
      const flvPlayer = flvjs.createPlayer(
        {
          type: 'flv',
          url: effectiveUrl,
          isLive,
        },
        {
          enableWorker: true,
          lazyLoad: false,
          enableStashBuffer: true,
          stashInitialSize: stashKb,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: lightweightMode ? 25 : 45,
          autoCleanupMinBackwardDuration: lightweightMode ? 10 : 20,
        } as any
      );
      flvRef.current = flvPlayer;
      flvPlayer.attachMediaElement(video);
      flvPlayer.load();
      const playPromise = flvPlayer.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(handleAutoplayBlocked);
      }
      flvPlayer.on(flvjs.Events.ERROR, () => {
        if (!isCleanedUp && !escalateCascade()) {
          void triggerWebServerFallback('Stream FLV indisponível neste servidor.');
        }
      });
    } else if (isMPEGTS && mpegts.isSupported()) {
      const mpegUrl = isLocalVault ? normalizedTarget : toProxyUrl(normalizedTarget); // Route raw IPTV/MPEG-TS through proxy for CORS & mixed-content fix
      const stashKb = turboBufferEnabled ? (lightweightMode ? 512 : 1024) : 512;
      setActiveEngineName(`MPEGTS.js + Proxy HTTPS (Buffer ${stashKb}KB)`);
      const tsPlayer = mpegts.createPlayer(
        {
          type: lower.includes('.flv') ? 'flv' : 'mpegts',
          isLive: true,
          url: mpegUrl,
        },
        {
          enableWorker: true,
          lazyLoad: false,
          enableStashBuffer: true,
          stashInitialSize: stashKb,
          fixAudioTimestampGap: true,
          liveBufferLatencyChasing: false,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: lightweightMode ? 25 : 45,
          autoCleanupMinBackwardDuration: lightweightMode ? 10 : 20,
        }
      );
      mpegtsRef.current = tsPlayer;
      tsPlayer.attachMediaElement(video);
      tsPlayer.load();
      const playResult = tsPlayer.play();
      if (playResult && typeof (playResult as Promise<void>).catch === 'function') {
        (playResult as Promise<void>).catch(handleAutoplayBlocked);
      }
      let tsReconnectAttempts = 0;
      tsPlayer.on(mpegts.Events.ERROR, (errType: any) => {
        if (isCleanedUp) return;
        if (errType === mpegts.ErrorTypes.NETWORK_ERROR && tsReconnectAttempts < 2) {
          tsReconnectAttempts++;
          window.setTimeout(() => {
            if (isCleanedUp || mpegtsRef.current !== tsPlayer) return;
            try {
              tsPlayer.unload();
              tsPlayer.load();
              const p = tsPlayer.play();
              if (p && typeof (p as Promise<void>).catch === 'function') {
                (p as Promise<void>).catch(() => {});
              }
            } catch {}
          }, 800);
          return;
        }
        if (!escalateCascade()) {
          void triggerWebServerFallback('Canal IPTV indisponível neste servidor e sem alternativa ativa.');
        }
      });
    } else if (isHLS) {
      if (Hls.isSupported()) {
        let mediaRecoveredOnce = false;
        let lastRecoverTs = 0;
        let stallDownshiftCount = 0;
        const targetBufSec = turboBufferEnabled
          ? isLive
            ? lightweightMode ? 35 : 45
            : lightweightMode ? 80 : 120
          : isLive
            ? 20
            : 40;
        setActiveEngineName(
          shouldUseProxy
            ? `HLS.js + Proxy HTTPS (Buffer ${targetBufSec}s${lightweightMode ? ' • Leve' : ''})`
            : `HLS.js Engine (Buffer ${targetBufSec}s${lightweightMode ? ' • Leve' : ''})`
        );
        const hls = new Hls({
          enableWorker: true,
          startFragPrefetch: true,
          lowLatencyMode: false,
          capLevelToPlayerSize: lightweightMode,
          capLevelOnFPSDrop: true,
          testBandwidth: !lightweightMode,
          liveSyncDurationCount: isLive ? 4 : 2,
          liveMaxLatencyDurationCount: isLive ? 12 : 6,
          maxBufferLength: targetBufSec,
          maxMaxBufferLength: turboBufferEnabled
            ? isLive
              ? lightweightMode ? 90 : 120
              : lightweightMode ? 180 : 360
            : isLive
              ? 60
              : 120,
          backBufferLength: lightweightMode ? 15 : 40,
          maxBufferSize: (turboBufferEnabled ? (isLive ? (lightweightMode ? 55 : 100) : (lightweightMode ? 95 : 220)) : 50) * 1000 * 1000,
          maxBufferHole: 0.5,
          nudgeOffset: 0.25,
          nudgeMaxRetry: 12,
          highBufferWatchdogPeriod: 2,
          maxStarvationDelay: 4,
          abrEwmaDefaultEstimate: lightweightMode ? (isLive ? 3500000 : 5000000) : (isLive ? 10000000 : 15000000),
          abrBandWidthFactor: 0.9,
          abrBandWidthUpFactor: 0.75,
          startLevel: -1,
          fragLoadingTimeOut: 20000,
          manifestLoadingTimeOut: 15000,
          levelLoadingTimeOut: 15000,
          fragLoadingMaxRetry: 12,
          manifestLoadingMaxRetry: 8,
          levelLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 300,
          manifestLoadingRetryDelay: 400,
        });
        hlsRef.current = hls;
        hls.loadSource(effectiveUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (isCleanedUp) return;
          const levels: QualityLevel[] = hls.levels
            .map((l, idx) => ({
              id: idx,
              label: l.height ? `${l.height}p` : `Nível ${idx + 1}`,
              width: l.width,
              height: l.height,
              bitrate: l.bitrate,
            }))
            .sort((a, b) => (b.height || 0) - (a.height || 0));
          setQualityLevels(levels);

          const tracks = hls.audioTracks.map((t) => ({ id: t.id, name: t.name, lang: t.lang }));
          setAudioTracks(tracks);
          setSelectedAudioId(hls.audioTrack);

          const subs = hls.subtitleTracks.map((t) => ({ id: t.id, name: t.name, lang: t.lang }));
          setSubtitleTracks(subs);
          setSelectedSubtitleId(hls.subtitleTrack);

          video.play().catch(handleAutoplayBlocked);
        });

        let networkRecoveryCount = 0;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (isCleanedUp) return;
          if (!data.fatal) {
            if (
              data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR &&
              Date.now() - lastRecoverTs > 4500
            ) {
              lastRecoverTs = Date.now();
              stallDownshiftCount++;
              try {
                // Step down 1 bitrate level smoothly if ABR is choking at current quality
                if (hls.autoLevelEnabled && hls.currentLevel > 0 && stallDownshiftCount >= 2) {
                  hls.nextLevel = hls.currentLevel - 1;
                }
                hls.startLoad();
              } catch {}
            }
            return;
          }
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRecoveryCount < 2) {
            networkRecoveryCount++;
            lastRecoverTs = Date.now();
            try {
              hls.startLoad();
              return;
            } catch {}
          }
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveredOnce) {
            mediaRecoveredOnce = true;
            hls.recoverMediaError();
            return;
          }
          if (!escalateCascade()) {
            void triggerWebServerFallback('Não foi possível carregar este stream HLS (.m3u8).');
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        setActiveEngineName('Apple Safari HLS Native Engine');
        video.src = effectiveUrl;
        video.play().catch(handleAutoplayBlocked);
      }
    } else if (isDASH) {
      setActiveEngineName(
        shouldUseProxy
          ? `DASH.js + Proxy HTTPS (${lightweightMode ? 'Modo Leve' : 'Buffer 120s'})`
          : `DASH.js Engine (${lightweightMode ? 'Modo Leve' : 'MPEG-DASH • Buffer 120s'})`
      );
      const dash = dashjs.MediaPlayer().create();
      dash.updateSettings({
        streaming: {
          abr: {
            initialBitrate: { video: lightweightMode ? 1500 : 3000 },
            maxBitrate: { video: lightweightMode ? 3500 : -1 },
          },
          buffer: {
            fastSwitchEnabled: true,
            bufferTimeAtTopQuality: isLive ? 30 : lightweightMode ? 60 : 80,
            bufferTimeAtTopQualityLongForm: turboBufferEnabled ? (isLive ? 40 : lightweightMode ? 80 : 120) : 40,
            bufferTimeDefault: isLive ? 20 : 30,
            bufferToKeep: lightweightMode ? 15 : 30,
            bufferPruningInterval: lightweightMode ? 10 : 20,
            stallThreshold: 0.3,
          },
          retryAttempts: {
            MPD: 6,
            MediaSegment: 8,
          },
        },
      } as any);
      dashRef.current = dash;
      dash.initialize(video, effectiveUrl, true);

      dash.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
        if (isCleanedUp) return;
        const dashAny = dash as any;
        const bitrates = dashAny.getBitrateInfoListFor('video') || [];
        const levels: QualityLevel[] = bitrates
          .map((b: any, idx: number) => ({
            id: idx,
            label: `${b.height}p`,
            width: b.width,
            height: b.height,
            bitrate: b.bitrate,
          }))
          .sort((a: any, b: any) => (b.height || 0) - (a.height || 0));
        setQualityLevels(levels);

        const audioData = dash.getTracksFor('audio').map((t: any, i: number) => ({
          id: i,
          name: t.lang || `Áudio ${i + 1}`,
          lang: t.lang,
        }));
        setAudioTracks(audioData);

        const textData = dash.getTracksFor('text').map((t: any, i: number) => ({
          id: i,
          name: t.lang || `Legenda ${i + 1}`,
          lang: t.lang,
        }));
        setSubtitleTracks(textData);
      });

      dash.on(dashjs.MediaPlayer.events.ERROR, () => {
        if (!isCleanedUp && !escalateCascade()) {
          void triggerWebServerFallback('Erro no stream MPEG-DASH.');
        }
      });
    } else if (isTorrent) {
      setActiveEngineName('WebTorrent P2P Engine');
      const getWebTorrentClient = async (): Promise<any> => {
        if ((window as any).WebTorrent) {
          return new (window as any).WebTorrent();
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js';
          script.onload = () => {
            if ((window as any).WebTorrent) {
              resolve(new (window as any).WebTorrent());
            } else {
              reject(new Error('WebTorrent load error'));
            }
          };
          script.onerror = () => reject(new Error('Failed script load'));
          document.body.appendChild(script);
        });
      };

      getWebTorrentClient()
        .then((client) => {
          if (isCleanedUp) {
            try {
              client.destroy();
            } catch {}
            return;
          }
          torrentClientRef.current = client;
          client.add(videoSource, (torrent: any) => {
            const file = torrent.files.find(
              (f: any) => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm')
            );
            if (file) {
              file.renderTo(video, { autoplay: true });
            }
          });
        })
        .catch(() => {
          video.src = effectiveUrl;
          video.play().catch(handleAutoplayBlocked);
        });
    } else {
      setActiveEngineName(
        shouldUseProxy
          ? 'Salgueiro HTTPS Proxy + HTML5 Engine (Turbo Preload)'
          : 'HTML5 Native Codec Engine (H.264/HEVC/MP4/WebM • Preload Auto)'
      );
      video.preload = 'auto';
      video.src = effectiveUrl;
      video.load();
      video.play().catch(handleAutoplayBlocked);
    }

    return () => {
      isCleanedUp = true;
      switchingSourceGuardRef.current = true;
      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      if (waitingSpinnerTimerRef.current) {
        window.clearTimeout(waitingSpinnerTimerRef.current);
        waitingSpinnerTimerRef.current = null;
      }
      destroyAllEngines();
    };
  }, [videoSource, selectedEngine, cascadeStage, transcodeOffsetSec, retryCount, isMissingLocalFile, turboBufferEnabled, lightweightMode, isVaultProbeReady]);

  // Smart non-interfering stall recovery watchdog for both Movies and Live TV
  useEffect(() => {
    const clearWaitingTimers = () => {
      if (waitingSpinnerTimerRef.current) {
        window.clearTimeout(waitingSpinnerTimerRef.current);
        waitingSpinnerTimerRef.current = null;
      }
    };

    const interval = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || playbackError || isMissingLocalFile) {
        lastProgressTimeRef.current = {
          time: v ? v.currentTime : 0,
          ts: Date.now(),
          stallTier: 0,
        };
        return;
      }

      const now = Date.now();
      const prev = lastProgressTimeRef.current;

      // Video is advancing smoothly — reset stall counters and never interfere
      if (Math.abs(v.currentTime - prev.time) > 0.05 || v.readyState >= 3) {
        lastProgressTimeRef.current = { time: v.currentTime, ts: now, stallTier: 0 };
        clearWaitingTimers();
        return;
      }

      if (prev.ts === 0) {
        lastProgressTimeRef.current = { time: v.currentTime, ts: now, stallTier: 0 };
        return;
      }

      const frozenMs = now - prev.ts;

      // Tier 1 (~4.5s frozen): gentle gap-nudge / HLS startLoad without reloading stream
      if (frozenMs >= 4500 && prev.stallTier < 1) {
        lastProgressTimeRef.current.stallTier = 1;
        if (hlsRef.current) {
          try {
            if (hlsRef.current.autoLevelEnabled && hlsRef.current.currentLevel > 0) {
              hlsRef.current.nextLevel = hlsRef.current.currentLevel - 1;
            }
            hlsRef.current.startLoad();
          } catch {}
        }
        // Jump over tiny buffered timestamp hole if data already exists slightly ahead
        for (let i = 0; i < v.buffered.length; i++) {
          const bStart = v.buffered.start(i);
          const bEnd = v.buffered.end(i);
          if (bStart > v.currentTime && bStart - v.currentTime <= 1.5 && bEnd > bStart + 0.3) {
            v.currentTime = bStart + 0.05;
            break;
          }
        }
        v.play().catch(() => {});
      }

      // Tier 2 (~12s completely frozen): seamless engine reconnect / resume at currentTime
      if (frozenMs >= 12000 && prev.stallTier < 2) {
        lastProgressTimeRef.current.stallTier = 2;
        if (mpegtsRef.current) {
          try {
            mpegtsRef.current.unload();
            mpegtsRef.current.load();
            const p = mpegtsRef.current.play();
            if (p && typeof (p as Promise<void>).catch === 'function') {
              (p as Promise<void>).catch(() => {});
            }
            return;
          } catch {}
        }
        if (hlsRef.current) {
          try {
            hlsRef.current.recoverMediaError();
            hlsRef.current.startLoad();
            return;
          } catch {}
        }
        // For remote HTML5/Proxy VOD movie stalled mid-stream, gently resume at exact position
        if (!isLive && selectedEngine === 'auto') {
          if (!escalateCascade(true)) {
            const resumeAt = v.currentTime;
            try {
              v.load();
              if (resumeAt > 1) v.currentTime = resumeAt;
              v.play().catch(() => {});
            } catch {}
          }
        } else if (isLive) {
          void triggerWebServerFallback('Canal lento ou congelado — a mudar para alternativa mais rápida...');
        }
      }
    }, 2500);

    return () => {
      window.clearInterval(interval);
      clearWaitingTimers();
    };
  }, [playbackError, isMissingLocalFile, isLive, selectedEngine, videoSource]);

  // Keep native HTML5 <track> subtitles synchronized with selectedSubtitleId
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    const selectedExt = externalSubtitles.find((s) => s.id === selectedSubtitleId);
    for (let i = 0; i < video.textTracks.length; i++) {
      const tt = video.textTracks[i];
      if (selectedExt && tt.label === selectedExt.label) {
        tt.mode = 'showing';
      } else {
        tt.mode = 'disabled';
      }
    }
  }, [selectedSubtitleId, externalSubtitles]);

  // SRT Subtitle Parser & WebVTT Converter
  const convertSrtToVttBlob = (srtContent: string): string => {
    try {
      if (srtContent.trimStart().startsWith('WEBVTT')) {
        return URL.createObjectURL(new Blob([srtContent], { type: 'text/vtt' }));
      }
      const parser = new Parser();
      const parsed = parser.fromSrt(srtContent);
      let vtt = 'WEBVTT\n\n';
      parsed.forEach((item: any) => {
        const start = item.startTime.replace(',', '.');
        const end = item.endTime.replace(',', '.');
        vtt += `${item.id}\n${start} --> ${end}\n${item.text}\n\n`;
      });
      const blob = new Blob([vtt], { type: 'text/vtt' });
      return URL.createObjectURL(blob);
    } catch {
      return URL.createObjectURL(new Blob([srtContent], { type: 'text/vtt' }));
    }
  };

  const loadSubtitleIntoPlayer = async (url: string, label: string, lang = 'pt') => {
    let finalUrl = url;
    try {
      const fetchTarget = url.startsWith('/') ? url : toProxyUrl(url);
      const res = await fetch(fetchTarget);
      if (res.ok) {
        const text = await res.text();
        finalUrl = convertSrtToVttBlob(text);
      }
    } catch (err) {
      console.warn('Subtitle proxy fetch fallback:', err);
    }

    const newSub: ExternalSubtitle = {
      id: `ext-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label,
      url: finalUrl,
      lang,
    };
    setExternalSubtitles((prev) => {
      const filtered = prev.filter((s) => s.label !== label);
      return [...filtered, newSub];
    });
    setSelectedSubtitleId(newSub.id);
  };

  // Auto-load persisted generated subtitles (e.g. pt-BR) when opening movie
  useEffect(() => {
    setExternalSubtitles([]);
    setSelectedSubtitleId(-1);
    setSubGenStatus(null);
    setSubGenError(null);
    const savedSubs = media?.generatedSubtitles;
    if (savedSubs && savedSubs.length > 0 && !isLive) {
      savedSubs.forEach((sub) => {
        if (sub?.url) {
          void loadSubtitleIntoPlayer(sub.url, sub.label || 'Português (Brasil)', sub.lang || 'pt-BR');
        }
      });
    }
  }, [media?.id, isLive]);

  // Automatically search web/addon subtitle sources (OpenSubtitles, Wyzie, Stremio, etc.) for Portuguese subtitles on movie startup
  useEffect(() => {
    if (isLive || !media) return;
    setOnlineSubQuery(media.originalTitle || media.title || '');
    setOnlineSubtitles([]);
    setOnlineSubStatus(null);
    setAppliedOnlineSubUrl(null);
    void searchOnlinePortugueseSubtitles(media.originalTitle || media.title || '', true);
  }, [media?.id, isLive]);

  // Automatically generate Portuguese subtitles in the background when playing any movie without subtitles
  useEffect(() => {
    if (isLive || !videoSource || isGeneratingSubtitles) return;
    const hasExistingSubtitles =
      (media?.generatedSubtitles && media.generatedSubtitles.length > 0) ||
      externalSubtitles.length > 0 ||
      subtitleTracks.length > 0;

    if (!hasExistingSubtitles) {
      const timer = window.setTimeout(() => {
        void handleAutoGeneratePortugueseSubtitles();
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [videoSource, isLive, media?.id]);

  const handleAutoGeneratePortugueseSubtitles = async () => {
    if (!videoSource || isLive || isGeneratingSubtitles) return;
    setIsGeneratingSubtitles(true);
    setSubGenError(null);
    setSubGenStatus('A extrair áudio e gerar legendas em Português (Brasil)...');

    try {
      const res = await fetch('/api/subtitles/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: media?.id || `media-${Date.now()}`,
          title: displayTitle,
          videoUrl: videoSource,
          targetLang: 'pt-BR',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Falha ao gerar legendas automáticas.');
      }

      const vttBlobUrl = data.vttContent
        ? convertSrtToVttBlob(data.vttContent)
        : data.url;

      const label = data.label || 'Português (Brasil) • Auto IA';
      const newSub: ExternalSubtitle = {
        id: `auto-ptbr-${Date.now()}`,
        label,
        url: vttBlobUrl,
        lang: 'pt-BR',
      };
      setExternalSubtitles((prev) => [...prev.filter((s) => !s.label.includes('Auto IA')), newSub]);
      setSelectedSubtitleId(newSub.id);
      setSubGenStatus(`Legendas PT-BR prontas (${data.cuesCount || 0} falas sincronizadas)!`);

      if (media?.id && onSubtitleGenerated && data.url) {
        onSubtitleGenerated(media.id, {
          lang: 'pt-BR',
          label,
          url: data.url,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      setSubGenError(err instanceof Error ? err.message : 'Erro ao gerar legendas PT-BR.');
      setSubGenStatus(null);
    } finally {
      setIsGeneratingSubtitles(false);
    }
  };

  const searchOnlinePortugueseSubtitles = async (customQuery?: string, autoApplyTop = false) => {
    if (isLive || !media) return;
    const q = (customQuery ?? onlineSubQuery ?? media.originalTitle ?? media.title ?? '').trim();
    if (!q) return;
    setIsSearchingOnlineSubs(true);
    setOnlineSubStatus('A procurar automaticamente legendas em português na internet...');

    try {
      const qs = new URLSearchParams({
        title: q,
        type: media.type === 'series' ? 'series' : 'movie',
      });
      if (media.id && /^tt\d+/i.test(media.id)) {
        qs.set('imdbId', media.id);
      }
      if (media.year) {
        qs.set('year', String(media.year));
      }

      // Parallel search: Backend aggregator (OpenSubtitles v3 + Wyzie + Local) + installed Stremio subtitle addons
      const [backendPromise, addonSubsPromise] = await Promise.allSettled([
        fetch(`/api/subtitles/search-online?${qs.toString()}`).then((r) => (r.ok ? r.json() : null)),
        installedAddons && installedAddons.length > 0
          ? fetchStremioSubtitles(media, installedAddons)
          : Promise.resolve([]),
      ]);

      const results: OnlineSubtitleResult[] = [];

      if (backendPromise.status === 'fulfilled' && backendPromise.value?.subtitles) {
        results.push(...backendPromise.value.subtitles);
      }

      if (addonSubsPromise.status === 'fulfilled' && Array.isArray(addonSubsPromise.value)) {
        for (const s of addonSubsPromise.value) {
          const l = (s.lang || '').toLowerCase();
          const n = (s.id || s.url || '').toLowerCase();
          const isPt = l.includes('pt') || l.includes('por') || l.includes('bra') || n.includes('por') || n.includes('pt');
          if (isPt && s.url) {
            const isBr = l.includes('br') || l.includes('bra') || n.includes('bra');
            results.push({
              id: `addon-sub-${s.id || Math.random().toString(36).slice(2, 6)}`,
              label: `${isBr ? '🇧🇷' : '🇵🇹'} Português (${isBr ? 'Brasil' : 'Portugal'}) - ${s.addonName || 'Addon Stremio'}`,
              lang: isBr ? 'pt-BR' : 'pt-PT',
              url: s.url,
              source: s.addonName || 'Addon Stremio',
              format: 'srt',
            });
          }
        }
      }

      // Add any previously saved or generated subtitle
      if (media.generatedSubtitles && media.generatedSubtitles.length > 0) {
        media.generatedSubtitles.forEach((sub, idx) => {
          if (sub?.url) {
            results.unshift({
              id: `ai-gen-${idx}`,
              label: `🇧🇷 ${sub.label || 'Português (Brasil) • Auto IA'}`,
              lang: sub.lang || 'pt-BR',
              url: sub.url,
              source: 'Auto IA Salgueiro',
              format: 'vtt',
            });
          }
        });
      }

      // Deduplicate by URL
      const seenUrls = new Set<string>();
      const deduped = results.filter((s) => {
        if (!s.url || seenUrls.has(s.url)) return false;
        seenUrls.add(s.url);
        return true;
      });

      setOnlineSubtitles(deduped);
      if (deduped.length > 0) {
        setOnlineSubStatus(`${deduped.length} legenda(s) em português encontrada(s) online! Escolha a versão desejada abaixo.`);
        if (autoApplyTop && (!media.generatedSubtitles || media.generatedSubtitles.length === 0)) {
          const top = deduped[0];
          if (top && top.url) {
            setAppliedOnlineSubUrl(top.url);
            void loadSubtitleIntoPlayer(top.url, top.label, top.lang);
          }
        }
      } else {
        setOnlineSubStatus('Nenhuma legenda em português encontrada na internet para este título. Use "Gerar Legenda PT-BR" abaixo.');
      }
    } catch {
      setOnlineSubStatus('Erro ao pesquisar legendas online. Tente novamente.');
    } finally {
      setIsSearchingOnlineSubs(false);
    }
  };

  const handleApplyOnlineSubtitle = async (sub: OnlineSubtitleResult) => {
    setAppliedOnlineSubUrl(sub.url);
    await loadSubtitleIntoPlayer(sub.url, sub.label, sub.lang);
    setServerNotice(`Legenda aplicada com sucesso: ${sub.label}`);
  };

  const handleSelectAudioLanguage = (lang: 'pt-BR' | 'pt-PT' | 'original') => {
    setSelectedAudioLang(lang);
    const langName =
      lang === 'pt-BR'
        ? 'Português (Brasil)'
        : lang === 'pt-PT'
          ? 'Português (Portugal)'
          : 'Áudio Original';
    setServerNotice(`Idioma de áudio selecionado: ${langName}`);
    if (audioTracks.length > 0) {
      const match = audioTracks.find((t) => {
        const nameLower = (t.name || '').toLowerCase();
        const langLower = (t.lang || '').toLowerCase();
        if (lang === 'pt-BR') {
          return langLower.includes('br') || nameLower.includes('brasil') || nameLower.includes('bra');
        }
        if (lang === 'pt-PT') {
          return langLower.includes('pt') || nameLower.includes('portugal') || nameLower.includes('por');
        }
        return false;
      });
      if (match) {
        changeAudioTrack(match.id);
      }
    }
  };

  // Audio/Subtitle Track Switching
  const changeAudioTrack = (id: number | string) => {
    setSelectedAudioId(id);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = id as number;
    } else if (dashRef.current) {
      const tracks = dashRef.current.getTracksFor('audio');
      if (tracks[id as number]) {
        dashRef.current.setCurrentTrack(tracks[id as number]);
      }
    }
  };

  const changeSubtitleTrack = (id: number | string) => {
    setSelectedSubtitleId(id);
    if (hlsRef.current) {
      hlsRef.current.subtitleTrack = typeof id === 'number' ? id : -1;
      hlsRef.current.subtitleDisplay = id !== -1 && typeof id === 'number';
    } else if (dashRef.current) {
      if (id === -1 || typeof id === 'string') {
        dashRef.current.setTextTrack(-1);
      } else {
        const tracks = dashRef.current.getTracksFor('text');
        if (tracks[id]) {
          dashRef.current.setCurrentTrack(tracks[id]);
        }
      }
    }
  };

  const changeQualityLevel = (index: number) => {
    setSelectedQualityLevelIndex(index);
    setSelectedQuality(index === -1 ? 'Automático' : qualityLevels.find((l) => l.id === index)?.label || 'Manual');

    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    } else if (dashRef.current) {
      dashRef.current.updateSettings({
        streaming: {
          abr: {
            autoSwitchBitrate: {
              video: index === -1,
            },
          },
        },
      });
      if (index !== -1) {
        (dashRef.current as any).setQualityFor('video', index);
      }
    } else if (shakaRef.current) {
      const player = shakaRef.current;
      if (index === -1) {
        player.configure({ abr: { enabled: true } });
      } else {
        player.configure({ abr: { enabled: false } });
        const tracks = player.getVariantTracks();
        const selected = qualityLevels.find((l) => l.id === index);
        if (selected) {
          const track = tracks.find((t: any) => t.height === selected.height);
          if (track) player.selectVariantTrack(track, true);
        }
      }
    }
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3500);
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        if (showServersPanel) setShowServersPanel(false);
        else if (showXRay) setShowXRay(false);
        else if (showAudioSubtitles) setShowAudioSubtitles(false);
        else if (showQualityMenu) setShowQualityMenu(false);
        else onClose();
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showServersPanel, showXRay, showAudioSubtitles, showQualityMenu]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isGuest && guestLimitLocked) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShowGuestRegisterPrompt(true);
      return;
    }
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const isUsingTranscoder =
    selectedEngine === 'transcode' ||
    (selectedEngine === 'auto' &&
      (cascadeStage >= 2 || videoSource.startsWith('/api/transcode?')));

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime + (isUsingTranscoder ? transcodeOffsetSec : 0));
  };

  const seekToTime = (absoluteSec: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, duration > 0 ? Math.min(duration, absoluteSec) : absoluteSec);
    if (isUsingTranscoder) {
      setTranscodeOffsetSec(Math.floor(clamped));
      setCurrentTime(clamped);
    } else {
      videoRef.current.currentTime = clamped;
    }
  };

  const seekRelative = (seconds: number) => {
    if (!videoRef.current) return;
    const base = isUsingTranscoder ? currentTime : videoRef.current.currentTime;
    seekToTime(base + seconds);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const nativeDur = videoRef.current.duration;
      if (Number.isFinite(nativeDur) && nativeDur > 0) {
        setDuration(nativeDur);
      } else if (probeInfo?.duration && probeInfo.duration > 0) {
        setDuration(probeInfo.duration);
      }
      videoRef.current.volume = volume;
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return hrs > 0
      ? `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`
      : `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      <video
        ref={videoRef}
        preload="auto"
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={() => {
          handleTimeUpdate();
          const v = videoRef.current;
          if (v && v.buffered && v.buffered.length > 0) {
            const end = v.buffered.end(v.buffered.length - 1);
            const totalDur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
            if (totalDur > 0) {
              setBufferedPercent(Math.min(100, (end / totalDur) * 100));
            }
          }
        }}
        onProgress={() => {
          const v = videoRef.current;
          if (v && v.buffered && v.buffered.length > 0) {
            const end = v.buffered.end(v.buffered.length - 1);
            const totalDur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : duration;
            if (totalDur > 0) {
              setBufferedPercent(Math.min(100, (end / totalDur) * 100));
            }
          }
        }}
        onLoadedData={() => {
          hasPlaybackStartedRef.current = true;
          if (waitingSpinnerTimerRef.current) {
            window.clearTimeout(waitingSpinnerTimerRef.current);
            waitingSpinnerTimerRef.current = null;
          }
          setIsBuffering(false);
          if (stallRecoveryTimerRef.current) {
            window.clearTimeout(stallRecoveryTimerRef.current);
            stallRecoveryTimerRef.current = null;
          }
        }}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => {
          if (!hasPlaybackStartedRef.current) {
            setIsBuffering(true);
          } else if (!waitingSpinnerTimerRef.current) {
            waitingSpinnerTimerRef.current = window.setTimeout(() => {
              waitingSpinnerTimerRef.current = null;
              const v = videoRef.current;
              if (v && !v.paused && v.readyState < 3 && !playbackError) {
                setIsBuffering(true);
              }
            }, 450);
          }
        }}
        onStalled={() => {
          if (hlsRef.current) {
            try {
              hlsRef.current.startLoad();
            } catch {}
          }
        }}
        onCanPlay={() => {
          hasPlaybackStartedRef.current = true;
          if (waitingSpinnerTimerRef.current) {
            window.clearTimeout(waitingSpinnerTimerRef.current);
            waitingSpinnerTimerRef.current = null;
          }
          setIsBuffering(false);
          setPlaybackError(null);
          if (stallRecoveryTimerRef.current) {
            window.clearTimeout(stallRecoveryTimerRef.current);
            stallRecoveryTimerRef.current = null;
          }
        }}
        onPlaying={() => {
          hasPlaybackStartedRef.current = true;
          if (waitingSpinnerTimerRef.current) {
            window.clearTimeout(waitingSpinnerTimerRef.current);
            waitingSpinnerTimerRef.current = null;
          }
          setIsBuffering(false);
          setPlaybackError(null);
          setIsPlaying(true);
          if (stallRecoveryTimerRef.current) {
            window.clearTimeout(stallRecoveryTimerRef.current);
            stallRecoveryTimerRef.current = null;
          }
        }}
        onPlay={() => {
          setPlaybackError(null);
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (waitingSpinnerTimerRef.current) {
            window.clearTimeout(waitingSpinnerTimerRef.current);
            waitingSpinnerTimerRef.current = null;
          }
          if (stallRecoveryTimerRef.current) {
            window.clearTimeout(stallRecoveryTimerRef.current);
            stallRecoveryTimerRef.current = null;
          }
        }}
        onError={() => {
          if (switchingSourceGuardRef.current) return;
          if (isMissingLocalFile) {
            setIsBuffering(false);
            return;
          }
          // Automatic cascade recovery before surfacing error UI
          if (escalateCascade()) {
            return;
          }
          const mediaError = videoRef.current?.error;
          const code = mediaError?.code;
          const msg =
            code === 4
              ? 'Este formato de vídeo ou codec requer transcodificação ou o servidor remoto está offline.'
              : 'Não foi possível carregar o fluxo de vídeo. Experimente procurar o melhor servidor na web ou ativar FFmpeg.';
          void triggerWebServerFallback(msg);
        }}
        playsInline
        autoPlay
      >
        {externalSubtitles.map((sub) => (
          <track
            key={sub.id}
            label={sub.label}
            src={sub.url}
            kind="subtitles"
            srcLang={sub.lang || 'pt'}
            default={selectedSubtitleId === sub.id}
          />
        ))}
      </video>

      {/* Top Left: Permanent Platform Logo & Name positioned 3mm right and 3mm down from the corner */}
      <div className="absolute top-[calc(0.5rem+3mm)] left-[calc(0.5rem+3mm)] z-40 flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/15 shadow-2xl pointer-events-none select-none shrink-0">
          <div className="w-7 h-4 sm:w-8 sm:h-5 rounded-md flex items-center justify-center shrink-0 relative overflow-hidden border border-white/25 shadow-sm bg-black">
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              <div className="flex-1 bg-[#cc092f]" />
              <div className="flex-1 bg-black" />
            </div>
            <div className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-yellow-400 rounded-full flex items-center justify-center shadow">
              <Play className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-black fill-black ml-0.5" />
            </div>
          </div>
          <div className="leading-tight select-none flex flex-col justify-center whitespace-nowrap">
            <div className="flex items-center gap-1.5 font-sans">
              <span className="text-red-500 font-black tracking-tight text-[10px] sm:text-[11px] uppercase leading-none">
                SALGUEIRO
              </span>
              <span className="text-white font-black tracking-tight text-[10px] sm:text-[11px] uppercase leading-none">
                STREAMING
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-sans mt-0.5">
              <span className="text-slate-300 text-[8px] sm:text-[8.5px] font-bold normal-case leading-none tracking-wider">
                Online TV
              </span>
              <span className="bg-white text-black px-1 py-0.2 rounded text-[7.5px] sm:text-[8px] font-black leading-none uppercase">
                ANGOLA
              </span>
            </div>
          </div>
        </div>

        {/* Back Button & Media Title row below the logo */}
        <div
          className={`flex items-center gap-2 transition-all duration-300 ${
            showControls ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
        >
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-white/20 bg-black/70 backdrop-blur-md rounded-lg text-white transition-colors flex items-center gap-1 focus:outline-none border border-white/15 shadow-xl"
            title="Voltar"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 pr-1">Voltar</span>
          </button>

          <div className="hidden sm:flex flex-col justify-center bg-black/55 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 max-w-[280px] lg:max-w-[440px]">
            <div className="flex items-center gap-2">
              {isLive && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> AO VIVO
                </span>
              )}
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">{displayTitle}</h2>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {subtitleInfo} • {activeEngineName}
            </p>
          </div>
        </div>
      </div>

      {/* Top Right: Guest 3-min countdown + Player Actions */}
      <div
        className={`absolute top-4 sm:top-6 right-4 sm:right-6 z-40 flex items-center gap-2 sm:gap-3 transition-opacity duration-300 ${
          showControls || (isGuest && guestRemainingSec <= 30) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {isGuest && (
          <div className="px-3 py-1.5 rounded-xl bg-black/75 border border-[#7b5be4]/50 backdrop-blur-md text-[11px] font-black text-white flex items-center gap-2 shadow-lg">
            <span className={`w-2 h-2 rounded-full ${guestRemainingSec <= 30 ? 'bg-red-500 animate-ping' : 'bg-[#7b5be4] animate-pulse'}`} />
            <span>
              Prévia Grátis: {String(Math.floor(guestRemainingSec / 60)).padStart(2, '0')}:
              {String(guestRemainingSec % 60).padStart(2, '0')}
            </span>
          </div>
        )}

        <button
          onClick={() => {
            setShowAudioSubtitles(!showAudioSubtitles);
            setShowServersPanel(false);
            setShowXRay(false);
            setShowQualityMenu(false);
          }}
          className={`p-2 rounded-xl border transition-all backdrop-blur-md shadow-lg ${
            showAudioSubtitles
              ? 'bg-[#7b5be4] text-white'
              : 'bg-black/60 hover:bg-black/80 text-white border-slate-700'
          }`}
          title="Áudio e Legendas (OpenSubtitles v3)"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => {
            setShowQualityMenu(!showQualityMenu);
            setShowServersPanel(false);
            setShowXRay(false);
            setShowAudioSubtitles(false);
          }}
          className={`p-2 rounded-xl border transition-all backdrop-blur-md shadow-lg ${
            showQualityMenu
              ? 'bg-[#7b5be4] text-white'
              : 'bg-black/60 hover:bg-black/80 text-white border-slate-700'
          }`}
          title="Motores de Reprodução"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onClose}
          className="p-2 bg-black/60 hover:bg-red-900/60 text-slate-300 hover:text-white border border-slate-700 rounded-xl transition-all ml-1 shadow-lg backdrop-blur-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 1-Minute Experimental Platform Notification in Top Right */}
      {showExperimentalNotification && (
        <div className="absolute top-20 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md bg-[#0f172a]/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-4 shadow-2xl animate-fade-in text-white space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Aviso Experimental (Salgueiro Streaming)
              </span>
            </div>
            <button
              onClick={() => setShowExperimentalNotification(false)}
              className="text-slate-400 hover:text-white text-xs font-bold px-1.5 py-0.5 rounded bg-white/10"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            Esta é uma fase experimental da plataforma, às vezes alguns canais podem demorar ao abrir ou reproduzir, e filmes podem não abrir é normal estamos em fase experimental, por favor enviar o seu feedback ou ligue 923742598, tens 1 mês grátis para experimentar a nossa plataforma.
          </p>
        </div>
      )}

      {/* Transient Best Server Auto-Selection Notice */}
      {serverNotice && !playbackError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 backdrop-blur-md text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2 pointer-events-none">
          <Server className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{serverNotice}</span>
        </div>
      )}

      {/* Top Gradient Shadow */}
      <div
        className={`absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100' : 'opacity-30'
        }`}
      />

      {/* Center Controls */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-8 sm:gap-16 pointer-events-none transition-opacity duration-300 z-20 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <button
          onClick={() => seekRelative(-10)}
          className="p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/80 text-white pointer-events-auto transition-transform active:scale-90 border border-white/10"
        >
          <RotateCcw className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
        <button
          onClick={togglePlay}
          className="p-5 sm:p-7 rounded-full bg-[#7b5be4] hover:bg-[#8e74eb] text-white shadow-2xl pointer-events-auto transition-transform active:scale-95"
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 sm:w-10 sm:h-10 fill-white" />
          ) : (
            <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-white translate-x-0.5" />
          )}
        </button>
        <button
          onClick={() => seekRelative(10)}
          className="p-3 sm:p-4 rounded-full bg-black/60 hover:bg-black/80 text-white pointer-events-auto transition-transform active:scale-90 border border-white/10"
        >
          <RotateCw className="w-6 h-6 sm:w-8 sm:h-8" />
        </button>
      </div>

      {/* Subtle Loading / Transcoding Spinner */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md shadow-xl">
            <RefreshCw className="w-4 h-4 text-[#7b5be4] animate-spin" />
            <span className="text-xs font-bold text-white">
              {isUsingTranscoder
                ? 'A preparar stream FFmpeg (H.264 + AAC)...'
                : 'A carregar vídeo...'}
            </span>
          </div>
        </div>
      )}

      {/* Playback Error Recovery Overlay */}
      {playbackError && (
        <div className="absolute inset-0 flex items-center justify-center z-40 px-4 pointer-events-none">
          <div className="pointer-events-auto bg-[#0c0d10]/95 backdrop-blur-md border border-red-500/40 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <p className="text-sm font-bold text-white">{playbackError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={async () => {
                  const found = await runBestServerDiscovery({
                    searchWeb: true,
                    autoApply: false,
                    forceWebMovieSearch: true,
                  });
                  if (found && found.alive) {
                    applyServerCandidate(found, true);
                  } else {
                    setShowServersPanel(true);
                  }
                }}
                disabled={isSearchingBestServer}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5"
              >
                {isSearchingBestServer ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                {isSearchingBestServer ? 'A procurar...' : 'Procurar Melhor Servidor (Web)'}
              </button>
              {!isMissingLocalFile && (
                <>
                  <button
                    onClick={() => {
                      manualEngineLockedRef.current = true;
                      setPlaybackError(null);
                      setTranscodeOffsetSec(0);
                      setSelectedEngine('transcode');
                      setRetryCount((c) => c + 1);
                    }}
                    className="px-4 py-2 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                  >
                    Transcodificar FFmpeg (H.264)
                  </button>
                  {!isLocalVaultPath(
                    extractVaultPathFromUrl(unwrapRawUrl(videoSource)) || unwrapRawUrl(videoSource)
                  ) && (
                    <button
                      onClick={() => {
                        manualEngineLockedRef.current = true;
                        setPlaybackError(null);
                        setSelectedEngine('proxy');
                        setRetryCount((c) => c + 1);
                      }}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Proxy HTTPS
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  setIsMissingLocalFile(false);
                  setPlaybackError(null);
                  setRetryCount((c) => c + 1);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Recarregar
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/15 text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest 3-Minute Limit Reached Notification */}
      {isGuest && showGuestRegisterPrompt && (
        <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-md px-4">
          <div className="relative bg-[#0c0d10] border-2 border-[#7b5be4] rounded-3xl px-6 py-7 shadow-2xl shadow-[#7b5be4]/35 max-w-md w-full text-center space-y-4 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-full text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              Prévia de 3 Minutos Concluída
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
              Registe-se para continuar a assistir
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Visitantes sem registo podem reproduzir os conteúdos durante 3 minutos. Crie a sua conta na plataforma para desbloquear acesso completo a filmes, séries e TV ao vivo.
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              {onOpenRegister && (
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                      setIsFullscreen(false);
                    }
                    onOpenRegister();
                  }}
                  className="w-full py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#7b5be4]/30 active:scale-95"
                >
                  Registrar Conta Agora
                </button>
              )}
              {onOpenLogin && (
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen().catch(() => {});
                      setIsFullscreen(false);
                    }
                    onOpenLogin();
                  }}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                >
                  Já tenho conta — Entrar
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full py-2 text-slate-400 hover:text-white text-xs font-semibold transition-colors"
              >
                Voltar ao Catálogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Timeline */}
      <div
        className={`absolute bottom-0 inset-x-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/80 to-transparent transition-opacity duration-300 z-30 space-y-3 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="relative flex items-center">
          {!isLive && bufferedPercent > 0 && (
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-white/30 rounded-lg pointer-events-none transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, bufferedPercent))}%` }}
            />
          )}
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seekToTime(parseFloat(e.target.value))}
            className="relative z-10 w-full h-1.5 bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-[#7b5be4] hover:h-2 transition-all"
          />
        </div>
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-[#7b5be4]">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-white hover:text-[#7b5be4]">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    videoRef.current.volume = v;
                    setIsMuted(v === 0);
                  }
                }}
                className="w-16 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#7b5be4]"
              />
            </div>
            <div className="font-mono text-xs text-slate-300">
              {isLive ? (
                <span className="text-red-400 font-bold">AO VIVO</span>
              ) : (
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/10 text-slate-300 rounded">
              {activeEngineName}
            </span>
            <button onClick={toggleFullscreen} className="p-1.5 text-white hover:text-[#7b5be4]">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Audio/Subtitles & OpenSubtitles v3 Menu */}
      {showAudioSubtitles && (
        <div className="absolute top-20 right-6 w-80 sm:w-96 bg-[#0f172a]/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-6 z-40 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <Languages className="w-4 h-4 text-[#7b5be4]" /> Áudio e Legendas
            </h3>
            <button onClick={() => setShowAudioSubtitles(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          {/* Audio Language Selection (PT-BR & PT-PT) */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-tighter text-[#c4b5fd] flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5" /> Idioma de Reprodução (Dublagem)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
                { id: 'pt-PT', label: 'Português (Portugal)', flag: '🇵🇹' },
                { id: 'original', label: 'Áudio Original', flag: '🌐' },
              ].map((langOpt) => (
                <button
                  key={langOpt.id}
                  type="button"
                  onClick={() => handleSelectAudioLanguage(langOpt.id as any)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition-all ${
                    selectedAudioLang === langOpt.id
                      ? 'bg-[#7b5be4] border-[#7b5be4] text-white shadow-lg shadow-[#7b5be4]/30 font-bold'
                      : 'bg-black/40 border-slate-800 text-slate-300 hover:bg-white/5 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">{langOpt.flag}</span>
                  <span className="text-[10px] truncate max-w-full">{langOpt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Audio Tracks */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
              Faixas de Áudio Disponíveis
            </span>
            <div className="space-y-1">
              {audioTracks.length > 0 ? (
                audioTracks.map((aud) => (
                  <button
                    key={aud.id}
                    onClick={() => changeAudioTrack(aud.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                      selectedAudioId === aud.id ? 'bg-[#7b5be4] text-white' : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{aud.name}</span>
                      {aud.lang && <span className="text-[9px] opacity-60 uppercase tracking-widest">{aud.lang}</span>}
                    </div>
                    {selectedAudioId === aud.id && <Check className="w-4 h-4" />}
                  </button>
                ))
              ) : (
                <p className="text-[10px] text-slate-500 italic p-2">
                  Áudio padrão ativo para este stream.
                </p>
              )}
            </div>
          </div>

          {/* Embedded & Loaded Subtitles */}
          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
              Legendas Ativas & Integradas
            </span>
            <div className="space-y-1">
              <button
                onClick={() => changeSubtitleTrack(-1)}
                className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                  selectedSubtitleId === -1 ? 'bg-[#7b5be4] text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span className="font-bold">Desativadas</span>
                {selectedSubtitleId === -1 && <Check className="w-4 h-4" />}
              </button>
              {subtitleTracks.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => changeSubtitleTrack(sub.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                    selectedSubtitleId === sub.id ? 'bg-[#7b5be4] text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-bold">{sub.name}</span>
                    {sub.lang && <span className="text-[9px] opacity-60 uppercase tracking-widest">{sub.lang}</span>}
                  </div>
                  {selectedSubtitleId === sub.id && <Check className="w-4 h-4" />}
                </button>
              ))}
              {externalSubtitles.map((ext) => (
                <button
                  key={ext.id}
                  onClick={() => changeSubtitleTrack(ext.id)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl flex items-center justify-between text-xs transition-all ${
                    selectedSubtitleId === ext.id ? 'bg-[#7b5be4] text-white' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span className="font-bold truncate">{ext.label}</span>
                  {selectedSubtitleId === ext.id && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))}
            </div>
          </div>


          {/* Automatic Portuguese (Brazil) Subtitle Generation */}
          {!isLive && videoSource && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <span className="text-[10px] font-black uppercase tracking-tighter text-emerald-400 flex items-center gap-2">
                <Subtitles className="w-3.5 h-3.5" /> Legendas Automáticas (Português - Brasil)
              </span>
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-2.5">
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Gera e sincroniza legendas completas em <strong className="text-white">Português (Brasil)</strong> diretamente a partir do áudio do filme.
                </p>
                <button
                  type="button"
                  disabled={isGeneratingSubtitles}
                  onClick={handleAutoGeneratePortugueseSubtitles}
                  className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  {isGeneratingSubtitles ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      A gerar legendas PT-BR...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Gerar Legenda PT-BR Automática
                    </>
                  )}
                </button>
                {subGenStatus && (
                  <p className="text-[11px] text-emerald-300 font-semibold">{subGenStatus}</p>
                )}
                {subGenError && (
                  <p className="text-[11px] text-red-400 font-semibold">{subGenError}</p>
                )}
              </div>
            </div>
          )}

          {/* Procurar Legenda Online (Português) */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-tighter text-[#c4b5fd] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" /> Procurar Legenda Online (Português)
              </span>
              {isSearchingOnlineSubs && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-[#7b5be4]" /> A pesquisar...
                </span>
              )}
            </div>

            <div className="p-4 bg-black/40 rounded-2xl border border-slate-800 space-y-3">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Título do Filme / Série na Web
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={onlineSubQuery}
                      onChange={(e) => setOnlineSubQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void searchOnlinePortugueseSubtitles(onlineSubQuery);
                        }
                      }}
                      placeholder="Nome do filme em português ou original..."
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white outline-none focus:border-[#7b5be4]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSearchingOnlineSubs}
                    onClick={() => void searchOnlinePortugueseSubtitles(onlineSubQuery)}
                    className="px-3.5 py-2 bg-[#7b5be4] hover:bg-[#8e74eb] disabled:opacity-60 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1 shadow-md shadow-[#7b5be4]/20"
                  >
                    {isSearchingOnlineSubs ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Procurar</span>
                  </button>
                </div>
              </div>

              {onlineSubStatus && (
                <p className="text-[11px] text-slate-300 font-medium leading-relaxed bg-[#0f172a]/80 p-2.5 rounded-xl border border-slate-700/60">
                  {onlineSubStatus}
                </p>
              )}

              {/* Subtitle Selection Menu */}
              {onlineSubtitles.length > 0 && (
                <div className="space-y-2 pt-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Legendas em Português Encontradas ({onlineSubtitles.length})</span>
                    <span className="text-emerald-400 font-semibold">Escolha e aplique</span>
                  </label>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {onlineSubtitles.map((sub) => {
                      const isApplied =
                        appliedOnlineSubUrl === sub.url ||
                        externalSubtitles.some((e) => e.url === sub.url && selectedSubtitleId === e.id);
                      return (
                        <div
                          key={sub.id}
                          className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                            isApplied
                              ? 'bg-emerald-500/15 border-emerald-500/50'
                              : 'bg-[#0f172a] border-slate-700/80 hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white leading-snug line-clamp-2">
                                {sub.label}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-slate-700">
                                  {sub.source}
                                </span>
                                <span className="text-[9px] font-bold text-[#c4b5fd]">
                                  {sub.lang === 'pt-BR' ? 'Português (Brasil)' : 'Português (Portugal)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => void handleApplyOnlineSubtitle(sub)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow ${
                                isApplied
                                  ? 'bg-emerald-500 text-black cursor-default font-extrabold'
                                  : 'bg-[#7b5be4] hover:bg-[#8e74eb] text-white active:scale-95'
                              }`}
                            >
                              {isApplied ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Legenda Aplicada ✓</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Aplicar legenda</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings & Engines Menu */}
      {showQualityMenu && (
        <div className="absolute top-20 right-6 w-80 sm:w-96 bg-[#0f172a]/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-6 z-40 space-y-6 max-h-[85vh] overflow-y-auto no-scrollbar">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#7b5be4]" /> Motores & Codecs
            </h3>
            <button onClick={() => setShowQualityMenu(false)} className="text-slate-400 hover:text-white">
              ✕
            </button>
          </div>

          {/* Video Quality Selector */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" /> Qualidade de Vídeo ({selectedQuality})
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => changeQualityLevel(-1)}
                className={`text-left p-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                  selectedQualityLevelIndex === -1
                    ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Automático (Melhor)</span>
                  {selectedQualityLevelIndex === -1 && <Check className="w-3 h-3 text-[#7b5be4]" />}
                </div>
              </button>
              {qualityLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => changeQualityLevel(level.id)}
                  className={`text-left p-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                    selectedQualityLevelIndex === level.id
                      ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{level.label}</span>
                    {selectedQualityLevelIndex === level.id && <Check className="w-3 h-3 text-[#7b5be4]" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Turbo Buffer Preset Toggle */}
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Turbo Buffer Anti-Travamentos
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Pré-carrega {isLive ? '35–45s (TV ao Vivo)' : '80–120s (Filmes/Séries)'} + recuperação sem paragens
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTurboBufferEnabled((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
                turboBufferEnabled
                  ? 'bg-emerald-500 text-black'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {turboBufferEnabled ? 'Ativo' : 'Padrão'}
            </button>
          </div>

          {/* Lightweight Mode Toggle */}
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-sky-400" />
                Modo Leve &amp; Carregamento Rápido
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Reduz peso de vídeo, memória RAM e consumo de dados para arrancar rápido e sem travar
              </p>
            </div>
            <button
              type="button"
              onClick={() => setLightweightMode((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-all ${
                lightweightMode
                  ? 'bg-sky-400 text-black'
                  : 'bg-white/10 text-slate-300 hover:bg-white/20'
              }`}
            >
              {lightweightMode ? 'Leve' : 'Máxima'}
            </button>
          </div>

          {/* Engine Selector */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Motor & Codec de Reprodução
            </span>
            <div className="space-y-1">
              {[
                { id: 'auto', label: 'Auto (Cascata Inteligente)', desc: 'Direto → Proxy HTTPS → FFmpeg Remux → H.264+AAC' },
                { id: 'transcode', label: 'FFmpeg Server Transcoder', desc: 'Converte MKV/HEVC/10-Bit/Dolby para H.264 + AAC' },
                { id: 'proxy', label: 'Salgueiro Proxy HTTPS', desc: 'Corrige streams HTTP IPTV e bloqueios CORS' },
                { id: 'mpegts', label: 'MPEGTS.js (IPTV Raw/TS)', desc: 'Canais de TV em direto MPEG-TS com Stash 512KB' },
                { id: 'hls', label: 'HLS.js Engine', desc: 'Streams adaptativos .m3u8 (Buffer 90s / Prefetch)' },
                { id: 'dash', label: 'DASH.js Engine', desc: 'Manifestos MPEG-DASH (.mpd) Fast-Switch' },
                { id: 'shaka', label: 'Google Shaka Player v4', desc: 'DASH / HLS / DRM MSE (Buffer 90s)' },
                { id: 'flv', label: 'FLV.js Engine', desc: 'Streams HTTP-FLV em direto com Stash 512KB' },
                { id: 'torrent', label: 'WebTorrent P2P', desc: 'Magnet links e torrents' },
                { id: 'html5', label: 'HTML5 Direto', desc: 'Reprodução direta nativa com preload automático' },
              ].map((eng) => (
                <button
                  key={eng.id}
                  onClick={() => {
                    userPickedServerRef.current = true;
                    manualEngineLockedRef.current = eng.id !== 'auto';
                    setSelectedEngine(eng.id as PlaybackEngine);
                    setCascadeStage(0);
                    setRetryCount((c) => c + 1);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                    selectedEngine === eng.id
                      ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{eng.label}</span>
                    {selectedEngine === eng.id && <Check className="w-4 h-4 text-[#7b5be4]" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{eng.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-[10px] font-black uppercase text-slate-500">Velocidade de Reprodução</span>
            <div className="grid grid-cols-6 gap-1">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPlaybackSpeed(s);
                    if (videoRef.current) videoRef.current.playbackRate = s;
                  }}
                  className={`py-2 rounded-lg text-xs font-bold ${
                    playbackSpeed === s ? 'bg-[#7b5be4] text-white' : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

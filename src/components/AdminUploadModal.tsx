import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Film,
  Globe,
  Image as ImageIcon,
  Video,
  Check,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Save,
  HardDrive,
  Server,
  Search,
  Zap,
  ShieldCheck,
  RefreshCw,
  XCircle,
  Play,
} from 'lucide-react';
import { MediaItem } from '../types/streaming';
import { isDetectedSeriesItem } from '../lib/stremioAddons';
import { PRESET_AVATARS } from '../data/avatars';
import {
  MediaDomainConfig,
  VaultMediaFile,
  UploadProgressTelemetry,
  WebArtworkResult,
  buildCustomDomainStreamUrl,
  cancelMediaUpload,
  formatBytes,
  isUploadCancelledError,
  isVaultStreamUrl,
  listVaultMediaFiles,
  locateUploadedMovieFile,
  prepareUploadedMovieForPlayback,
  searchOriginalMovieArtwork,
  uploadMediaToDomain,
  warmUpPlaybackTarget,
  DEFAULT_MEDIA_DOMAIN_CONFIG,
} from '../lib/mediaDomain';

interface AdminUploadModalProps {
  onClose: () => void;
  onUploadMovie: (newMovie: MediaItem) => Promise<void> | void;
  onUpdateMovie?: (updatedMovie: MediaItem) => Promise<void> | void;
  onPlayMovie?: (movie: MediaItem) => void;
  movieToEdit?: MediaItem | null;
  existingCustomMovies?: MediaItem[];
  allCatalogMovies?: MediaItem[];
  onDeleteCustomMovie?: (id: string) => void;
  domainConfig?: MediaDomainConfig;
}

function cleanTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[\._]+/g, ' ')
    .replace(/\b(1080p|720p|2160p|4k|hdr|bluray|bdrip|webrip|web-dl|dvdrip|hdrip|x264|x265|hevc|aac|ac3|dublado|legendado|pt-br|pt-pt)\b/gi, ' ')
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const AdminUploadModal: React.FC<AdminUploadModalProps> = ({
  onClose,
  onUploadMovie,
  onUpdateMovie,
  onPlayMovie,
  movieToEdit,
  existingCustomMovies = [],
  allCatalogMovies = [],
  onDeleteCustomMovie,
  domainConfig = DEFAULT_MEDIA_DOMAIN_CONFIG,
}) => {
  const [editingItem, setEditingItem] = useState<MediaItem | null>(movieToEdit || null);
  
  const [title, setTitle] = useState(movieToEdit?.title || '');
  const [originalTitle, setOriginalTitle] = useState(movieToEdit?.originalTitle || '');
  const [synopsis, setSynopsis] = useState(movieToEdit?.synopsis || '');
  const [year, setYear] = useState<number>(movieToEdit?.year || 2026);
  const [duration, setDuration] = useState(movieToEdit?.duration || '2h 10m');
  const [rating, setRating] = useState(movieToEdit?.rating || '14');
  const [imdbScore, setImdbScore] = useState<number>(movieToEdit?.imdbScore || 8.5);
  const [quality, setQuality] = useState(movieToEdit?.quality || '1080p Full HD');
  const [contentType, setContentType] = useState<'movie' | 'series'>(movieToEdit?.type === 'series' ? 'series' : 'movie');
  
  // Video Source Choice
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'file' | 'vault'>('file');
  const [videoUrl, setVideoUrl] = useState(movieToEdit?.videoUrl || '');
  const [videoFileName, setVideoFileName] = useState('');
  const [videoFileSize, setVideoFileSize] = useState<number>(0);
  const [vaultVideos, setVaultVideos] = useState<VaultMediaFile[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);

  // Speed & Error-Skipping Upload Controls
  const [skipUploadErrors, setSkipUploadErrors] = useState(true);
  const [uploadTelemetry, setUploadTelemetry] = useState<UploadProgressTelemetry | null>(null);
  const [batchSummary, setBatchSummary] = useState<string>('');

  // Web Original Artwork Search & Auto-Replace States
  const [autoReplaceArtwork, setAutoReplaceArtwork] = useState(true);
  const [artworkQuery, setArtworkQuery] = useState(movieToEdit?.title || '');
  const [isSearchingArtwork, setIsSearchingArtwork] = useState(false);
  const [artworkResults, setArtworkResults] = useState<WebArtworkResult[]>([]);
  const [artworkSearchNote, setArtworkSearchNote] = useState('');
  const [replacingCustomMovieId, setReplacingCustomMovieId] = useState<string | null>(null);
  const [isBatchReplacingArtwork, setIsBatchReplacingArtwork] = useState(false);
  const [batchArtworkProgress, setBatchArtworkProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
    updatedCount: number;
  } | null>(null);
  const [publishedViewFilter, setPublishedViewFilter] = useState<'custom' | 'all'>('custom');

  // Poster & Banner Image Choice
  const [posterInputMode, setPosterInputMode] = useState<'url' | 'file'>('url');
  const [bannerInputMode, setBannerInputMode] = useState<'url' | 'file'>('url');
  const [posterUrl, setPosterUrl] = useState(movieToEdit?.thumbnailUrl || '');
  const [posterFileName, setPosterFileName] = useState('');
  const [bannerUrl, setBannerUrl] = useState(movieToEdit?.bannerUrl || '');
  const [bannerFileName, setBannerFileName] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Genres
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    movieToEdit?.genres && movieToEdit.genres.length > 0 ? (movieToEdit.genres as string[]) : ['Internacional', 'Ação']
  );
  const availableGenres = [
    'Internacional',
    'Ação',
    'Ficção Científica',
    'Drama',
    'Comédia',
    'Suspense',
    'Aventura',
    'Romance',
    'Terror',
    'Animação',
    'Documentário',
    'Infantil',
    'História'
  ];

  // Audio & Subtitles
  const [audioLangs, setAudioLangs] = useState(
    movieToEdit?.audio ? movieToEdit.audio.join(', ') : 'Português (Angola), English [Original]'
  );
  const [subtitleLangs, setSubtitleLangs] = useState(
    movieToEdit?.subtitles ? movieToEdit.subtitles.join(', ') : 'Português [CC], English'
  );
  const [director, setDirector] = useState(movieToEdit?.director || '');
  const [castInput, setCastInput] = useState(
    movieToEdit?.cast ? movieToEdit.cast.map(c => c.name).join(', ') : ''
  );

  const [activeTab, setActiveTab] = useState<'new' | 'list'>('new');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [closeBlockedNotice, setCloseBlockedNotice] = useState('');
  const [isPreparingPlayback, setIsPreparingPlayback] = useState(false);
  const [playbackReadyNote, setPlaybackReadyNote] = useState('');
  const [isLocatingFile, setIsLocatingFile] = useState(false);
  const [publishedMovieReady, setPublishedMovieReady] = useState<MediaItem | null>(null);

  const uploadAbortRef = useRef<AbortController | null>(null);
  const activeUploadIdRef = useRef<string | null>(null);
  const batchCancelledRef = useRef<boolean>(false);
  const autoPublishedMovieIdRef = useRef<string | null>(null);

  const handleCancelActiveUpload = () => {
    batchCancelledRef.current = true;
    const uploadIdToClean = activeUploadIdRef.current;
    if (uploadAbortRef.current) {
      uploadAbortRef.current.abort();
      uploadAbortRef.current = null;
    }
    activeUploadIdRef.current = null;
    if (uploadIdToClean) {
      void cancelMediaUpload(uploadIdToClean);
    }
    setIsUploadingVideo(false);
    setUploadProgress(0);
    setUploadTelemetry(null);
    setBatchSummary('');
    setVideoFileName('');
    setVideoFileSize(0);
    setUploadError('');
    setCloseBlockedNotice('');
    triggerToast('Upload cancelado pelo administrador e blocos temporários limpos.');
  };

  const handleSafeClose = () => {
    if (isUploadingVideo || isPreparingPlayback || isSubmitting) {
      setCloseBlockedNotice(
        isUploadingVideo
          ? `Upload em curso (${Math.round(uploadProgress)}%). Use "Cancelar Upload" se pretender interromper o envio.`
          : 'A finalizar publicação automática do filme para reprodução imediata...'
      );
      setTimeout(() => setCloseBlockedNotice(''), 5000);
      return;
    }
    onClose();
  };

  const formatEtaSeconds = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  };

  const loadItemForEdit = (item: MediaItem) => {
    autoPublishedMovieIdRef.current = null;
    setPublishedMovieReady(null);
    setEditingItem(item);
    setTitle(item.title);
    setOriginalTitle(item.originalTitle || item.title);
    setArtworkQuery(item.title);
    setSynopsis(item.synopsis || '');
    setYear(item.year || 2026);
    setDuration(item.duration || '2h 10m');
    setRating(item.rating || '14');
    setImdbScore(item.imdbScore || 8.5);
    setQuality(item.quality || '1080p Full HD');
    setContentType(item.type === 'series' ? 'series' : 'movie');
    setVideoUrl(item.videoUrl || '');
    setVideoInputMode(item.videoUrl ? 'url' : 'file');
    setPosterUrl(item.thumbnailUrl || '');
    setBannerUrl(item.bannerUrl || '');
    setSelectedGenres(item.genres && item.genres.length > 0 ? (item.genres as string[]) : ['Internacional']);
    setAudioLangs(item.audio ? item.audio.join(', ') : 'Português (Angola), English');
    setSubtitleLangs(item.subtitles ? item.subtitles.join(', ') : 'Português [CC]');
    setDirector(item.director || '');
    setCastInput(item.cast ? item.cast.map(c => c.name).join(', ') : '');
    setActiveTab('new');
  };

  const refreshVaultFiles = () => {
    listVaultMediaFiles()
      .then((res) => {
        setVaultVideos(res.files.filter((f) => f.folder === 'videos'));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (movieToEdit) {
      loadItemForEdit(movieToEdit);
      setVideoInputMode(movieToEdit.videoUrl ? 'url' : 'file');
      const q = (movieToEdit.originalTitle || movieToEdit.title || '').trim();
      if (q.length >= 2) {
        void handleSearchOriginalArtwork(q, false);
      }
    }
    refreshVaultFiles();
  }, [movieToEdit]);

  // Protect upload: warn user if trying to close or reload tab while upload is reaching 100%
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploadingVideo) {
        e.preventDefault();
        e.returnValue = 'O envio do filme está em andamento até atingir 100%. Tem certeza que deseja sair?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploadingVideo]);

  const handleSearchOriginalArtwork = async (
    customQuery?: string,
    autoApplyTopArtwork = false,
    typeOverride?: 'movie' | 'series'
  ): Promise<WebArtworkResult[]> => {
    const q = (customQuery ?? artworkQuery ?? title).trim();
    if (!q || q.length < 2) {
      setArtworkSearchNote('Escreva o nome do filme para procurar a capa original na web.');
      return [];
    }
    setArtworkQuery(q);
    setIsSearchingArtwork(true);
    setArtworkSearchNote('A procurar capa original na web...');
    try {
      const results = await searchOriginalMovieArtwork(q, typeOverride ?? contentType);
      setArtworkResults(results);
      if (results.length === 0) {
        setArtworkSearchNote('Nenhuma capa encontrada na web. Tente o título original em inglês.');
      } else {
        setArtworkSearchNote(`${results.length} capa(s) original(is) encontrada(s)! Clique numa para aplicar.`);
        if (autoApplyTopArtwork) {
          applyArtworkSelection(results[0], false);
        }
      }
      return results;
    } catch {
      setArtworkSearchNote('Não foi possível consultar capas na web agora. Pode inserir o URL manualmente.');
      return [];
    } finally {
      setIsSearchingArtwork(false);
    }
  };

  const applyArtworkSelection = (art: WebArtworkResult, showToast = true) => {
    setPosterUrl(art.posterUrl);
    setPosterInputMode('url');
    setBannerUrl(art.bannerUrl || art.posterUrl);
    if (!title.trim() || title === videoFileName) setTitle(art.title);
    if (!originalTitle.trim()) setOriginalTitle(art.originalTitle || art.title);
    if (art.year && art.year > 1900) setYear(art.year);
    if (art.imdbScore) setImdbScore(art.imdbScore);
    if (!synopsis.trim() && art.synopsis) setSynopsis(art.synopsis);
    if (art.genres && art.genres.length > 0) {
      const valid = art.genres.filter((g) => availableGenres.includes(g));
      if (valid.length > 0) setSelectedGenres(Array.from(new Set([...selectedGenres, ...valid])));
    }
    if (showToast) {
      triggerToast(`Capa original de "${art.title}" aplicada com sucesso!`);
    }
  };

  const handleSearchAndReplaceArtworkNow = async () => {
    const q = (artworkQuery || title || '').trim();
    if (!q || q.length < 2) {
      setArtworkSearchNote('Escreva o título do filme primeiro para procurar na web.');
      return;
    }
    setIsSearchingArtwork(true);
    setArtworkSearchNote('A pesquisar capa original na web...');
    try {
      const results = await searchOriginalMovieArtwork(q, contentType);
      setArtworkResults(results);
      if (results.length === 0) {
        setArtworkSearchNote('Nenhuma imagem encontrada na web. Tente com o título original em inglês.');
      } else {
        applyArtworkSelection(results[0], true);
        setArtworkSearchNote(
          `✓ Capa oficial substituída com sucesso! (${results[0].source}: ${results[0].title})`
        );
      }
    } catch {
      setArtworkSearchNote('Erro ao conectar à web para procurar capas.');
    } finally {
      setIsSearchingArtwork(false);
    }
  };

  const handleReplaceSingleMovieArtworkFromWeb = async (movie: MediaItem) => {
    setReplacingCustomMovieId(movie.id);
    try {
      const q = (movie.originalTitle || movie.title).trim();
      const results = await searchOriginalMovieArtwork(q, movie.type === 'series' ? 'series' : 'movie');
      if (results.length === 0) {
        triggerToast(`Nenhuma capa original encontrada na web para "${movie.title}".`);
        return;
      }
      const topArt = results[0];
      const updatedMovie: MediaItem = {
        ...movie,
        thumbnailUrl: topArt.posterUrl,
        bannerUrl: topArt.bannerUrl || topArt.posterUrl,
        originalTitle: movie.originalTitle || topArt.originalTitle || topArt.title,
        synopsis: movie.synopsis || topArt.synopsis,
        imdbScore: movie.imdbScore || topArt.imdbScore,
        year: movie.year || topArt.year,
      };
      if (onUpdateMovie) {
        await onUpdateMovie(updatedMovie);
      }
      if (editingItem && editingItem.id === movie.id) {
        setPosterUrl(updatedMovie.thumbnailUrl);
        setBannerUrl(updatedMovie.bannerUrl);
        setPosterInputMode('url');
      }
      triggerToast(`Capa de "${movie.title}" substituída com a imagem original da web!`);
    } catch (err) {
      triggerToast(`Erro ao pesquisar capa na web: ${err instanceof Error ? err.message : 'Falha na conexão'}`);
    } finally {
      setReplacingCustomMovieId(null);
    }
  };

  const handleBatchReplaceArtworkFromWeb = async (moviesToProcess: MediaItem[]) => {
    if (moviesToProcess.length === 0) return;
    setIsBatchReplacingArtwork(true);
    let updatedCount = 0;
    setBatchArtworkProgress({
      current: 0,
      total: moviesToProcess.length,
      currentTitle: '',
      updatedCount: 0,
    });

    for (let i = 0; i < moviesToProcess.length; i++) {
      const movie = moviesToProcess[i];
      setBatchArtworkProgress({
        current: i + 1,
        total: moviesToProcess.length,
        currentTitle: movie.title,
        updatedCount,
      });

      try {
        const q = (movie.originalTitle || movie.title).trim();
        const results = await searchOriginalMovieArtwork(q, movie.type === 'series' ? 'series' : 'movie');
        if (results.length > 0) {
          const topArt = results[0];
          const updatedMovie: MediaItem = {
            ...movie,
            thumbnailUrl: topArt.posterUrl,
            bannerUrl: topArt.bannerUrl || topArt.posterUrl,
            originalTitle: movie.originalTitle || topArt.originalTitle || topArt.title,
            synopsis: movie.synopsis || topArt.synopsis,
            imdbScore: movie.imdbScore || topArt.imdbScore,
            year: movie.year || topArt.year,
          };
          if (onUpdateMovie) {
            await onUpdateMovie(updatedMovie);
          }
          updatedCount++;
        }
      } catch {
        // gracefully continue to next item
      }
    }

    setIsBatchReplacingArtwork(false);
    setBatchArtworkProgress(null);
    triggerToast(
      `Concluído: ${updatedCount} de ${moviesToProcess.length} filmes tiveram a capa substituída com a imagem original da web!`
    );
  };

  // Direct fast parallel chunked upload to Platform Media Domain Vault
  const uploadFileToStorage = async (
    file: File,
    folder: 'videos' | 'images',
    onPct?: (pct: number, telemetry?: UploadProgressTelemetry) => void,
    signal?: AbortSignal
  ): Promise<{ streamPath: string; skippedChunksCount?: number }> => {
    setUploadError('');
    const result = await uploadMediaToDomain(
      file,
      folder,
      (pct, telemetry) => {
        if (onPct) onPct(pct, telemetry);
      },
      {
        skipChunkErrors: skipUploadErrors,
        signal,
        onUploadIdReady: (id) => {
          activeUploadIdRef.current = id;
        },
      }
    );
    activeUploadIdRef.current = null;
    refreshVaultFiles();
    return {
      streamPath: result.streamPath,
      skippedChunksCount: result.skippedChunksCount,
    };
  };

  const processSelectedFiles = async (fileList: File[]) => {
    if (fileList.length === 0 || isUploadingVideo) return;

    batchCancelledRef.current = false;

    // Single file mode: uploads, prepares instant playback, applies original cover, and IMMEDIATELY publishes onto the platform at 100%!
    if (fileList.length === 1) {
      const file = fileList[0];
      const cleanedName = (cleanTitleFromFilename(file.name) || file.name.replace(/\.[^/.]+$/, '') || 'Filme').slice(0, 240);
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      activeUploadIdRef.current = null;

      // If previous single upload in this modal already auto-published, reset to create a distinct movie entry
      const isReplacingExistingManualEdit =
        Boolean(editingItem) && autoPublishedMovieIdRef.current !== editingItem?.id;

      let effectiveTitle = isReplacingExistingManualEdit ? (title.trim() || cleanedName) : cleanedName;
      let currentPoster = isReplacingExistingManualEdit ? posterUrl.trim() : '';
      let currentBanner = isReplacingExistingManualEdit ? bannerUrl.trim() : '';
      let currentSynopsis = isReplacingExistingManualEdit ? synopsis.trim() : '';
      let currentOriginalTitle = isReplacingExistingManualEdit ? originalTitle.trim() : '';
      let currentYear = isReplacingExistingManualEdit ? year : 2026;
      let currentImdb = isReplacingExistingManualEdit ? imdbScore : 8.5;

      const fileIsSeries = isDetectedSeriesItem({ title: file.name, videoUrl: file.name });
      const effectiveType: 'movie' | 'series' = fileIsSeries ? 'series' : contentType;
      if (fileIsSeries && contentType !== 'series') {
        setContentType('series');
      }

      if (!isReplacingExistingManualEdit) {
        autoPublishedMovieIdRef.current = null;
        setEditingItem(null);
        setPublishedMovieReady(null);
        setTitle(cleanedName);
        setOriginalTitle('');
        setPosterUrl('');
        setBannerUrl('');
        setSynopsis('');
        setArtworkResults([]);
      } else if (!title.trim()) {
        setTitle(cleanedName);
      }

      setVideoFileName(file.name);
      setVideoFileSize(file.size);
      setBatchSummary('');
      setUploadError('');
      setPublishedMovieReady(null);
      setIsUploadingVideo(true);
      setUploadProgress(1);
      setUploadTelemetry(null);
      setArtworkQuery(cleanedName);

      // Search web for original poster right away while upload runs in parallel
      const artworkSearchPromise = handleSearchOriginalArtwork(cleanedName, autoReplaceArtwork || !currentPoster, effectiveType);

      try {
        const res = await uploadFileToStorage(
          file,
          'videos',
          (pct, telemetry) => {
            setUploadProgress(pct);
            if (telemetry) setUploadTelemetry(telemetry);
          },
          controller.signal
        );
        let resolvedPath = res.streamPath;
        setVideoUrl(resolvedPath);
        setUploadProgress(100);
        setUploadError('');

        // Immediately locate, optimize (+faststart / probe cache), and warm up for zero-delay playback
        setIsPreparingPlayback(true);
        setPlaybackReadyNote('Upload a 100% — a otimizar e disponibilizar filme na plataforma...');
        try {
          const located = await locateUploadedMovieFile({
            url: res.streamPath,
            query: file.name,
            title: cleanedName,
          });
          if (located.found && located.streamPath) {
            resolvedPath = located.streamPath;
            setVideoUrl(resolvedPath);
          }
          const prep = await prepareUploadedMovieForPlayback(resolvedPath);
          warmUpPlaybackTarget(resolvedPath);
          setPlaybackReadyNote(
            prep.faststarted
              ? 'Ficheiro otimizado (FastStart) e disponível para reprodução imediata!'
              : 'Ficheiro pronto no domínio e disponível para reprodução imediata!'
          );
        } catch {
          warmUpPlaybackTarget(resolvedPath);
          setPlaybackReadyNote('Ficheiro gravado no domínio e pronto para reprodução.');
        }

        // Wait briefly for in-flight web artwork search so published movie already displays its real poster
        let artUsedFromLateResult = false;
        const matchedResults = await Promise.race<WebArtworkResult[]>([
          artworkSearchPromise,
          new Promise<WebArtworkResult[]>((resolve) => setTimeout(() => resolve([]), 1800)),
        ]);

        if (matchedResults.length > 0 && (autoReplaceArtwork || !currentPoster)) {
          const topArt = matchedResults[0];
          currentPoster = topArt.posterUrl || currentPoster;
          currentBanner = topArt.bannerUrl || topArt.posterUrl || currentBanner;
          if (!isReplacingExistingManualEdit || !effectiveTitle) {
            effectiveTitle = (topArt.title || cleanedName).slice(0, 240);
          }
          currentOriginalTitle = currentOriginalTitle || topArt.originalTitle || effectiveTitle;
          currentYear = topArt.year > 1900 ? topArt.year : currentYear;
          currentImdb = topArt.imdbScore || currentImdb;
          currentSynopsis = currentSynopsis || topArt.synopsis || '';
          artUsedFromLateResult = true;
        }

        const castList = castInput
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n) => ({ name: n, role: 'Ator Principal', character: n }));

        const autoMovie: MediaItem = isReplacingExistingManualEdit && editingItem
          ? {
              ...editingItem,
              title: effectiveTitle,
              originalTitle: currentOriginalTitle || effectiveTitle,
              type: effectiveType,
              thumbnailUrl: currentPoster || editingItem.thumbnailUrl || PRESET_AVATARS[0],
              bannerUrl: currentBanner || currentPoster || editingItem.bannerUrl || PRESET_AVATARS[1],
              videoUrl: resolvedPath,
              synopsis: currentSynopsis || editingItem.synopsis,
              rating,
              imdbScore: Number(currentImdb) || 8.5,
              year: Number(currentYear) || 2026,
              duration: duration || '2h 00m',
              genres: selectedGenres as any,
              quality: quality as any,
              audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
              subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
              director: director.trim() || editingItem.director || 'Produção Internacional',
              cast: castList.length > 0 ? castList : (editingItem.cast || [{ name: 'Elenco Principal', role: 'Atores', character: 'Elenco Principal' }]),
            }
          : {
              id: `custom-uploaded-${Date.now()}`,
              title: effectiveTitle,
              originalTitle: currentOriginalTitle || effectiveTitle,
              type: isDetectedSeriesItem({ title: file.name, originalTitle: effectiveTitle, videoUrl: resolvedPath }) ? 'series' : effectiveType,
              thumbnailUrl: currentPoster || PRESET_AVATARS[0],
              bannerUrl: currentBanner || currentPoster || PRESET_AVATARS[1],
              videoUrl: resolvedPath,
              synopsis:
                currentSynopsis || 'Filme carregado pelo Administrador no Salgueiro Streaming Angola.',
              rating,
              imdbScore: Number(currentImdb) || 8.5,
              year: Number(currentYear) || 2026,
              duration: duration || '2h 00m',
              genres: (selectedGenres.length > 0 ? selectedGenres : ['Internacional']) as any,
              quality: quality as any,
              audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
              subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
              isSalgueiroMember: true,
              matchPercentage: 98,
              director: director.trim() || 'Produção Internacional',
              cast: castList.length > 0 ? castList : [{ name: 'Elenco Principal', role: 'Atores', character: 'Elenco Principal' }],
            };

        if (isReplacingExistingManualEdit && editingItem && onUpdateMovie) {
          await onUpdateMovie(autoMovie);
        } else {
          await onUploadMovie(autoMovie);
        }

        autoPublishedMovieIdRef.current = autoMovie.id;
        setEditingItem(autoMovie);
        setPublishedMovieReady(autoMovie);
        setIsPreparingPlayback(false);

        if (!artUsedFromLateResult && !currentPoster) {
          // If artwork finishes searching slightly after auto-publish, silently update the published movie with its original poster
          void artworkSearchPromise.then((lateArts) => {
            if (lateArts && lateArts.length > 0 && autoPublishedMovieIdRef.current === autoMovie.id && onUpdateMovie) {
              const topArt = lateArts[0];
              const enriched: MediaItem = {
                ...autoMovie,
                title: (topArt.title || autoMovie.title).slice(0, 240),
                originalTitle: autoMovie.originalTitle || topArt.originalTitle || topArt.title,
                thumbnailUrl: topArt.posterUrl || autoMovie.thumbnailUrl,
                bannerUrl: topArt.bannerUrl || topArt.posterUrl || autoMovie.bannerUrl,
                year: topArt.year > 1900 ? topArt.year : autoMovie.year,
                imdbScore: topArt.imdbScore || autoMovie.imdbScore,
                synopsis: currentSynopsis || topArt.synopsis || autoMovie.synopsis,
              };
              setEditingItem(enriched);
              setPublishedMovieReady(enriched);
              void onUpdateMovie(enriched);
            }
          });
        }

        if (res.skippedChunksCount && res.skippedChunksCount > 0) {
          triggerToast(
            `"${autoMovie.title}" disponível e pronto a reproduzir! (${res.skippedChunksCount} bloco(s) com erro saltados automaticamente.)`
          );
        } else {
          triggerToast(`"${autoMovie.title}" disponível na plataforma a 100% e pronto a reproduzir!`);
        }
      } catch (error: any) {
        setIsPreparingPlayback(false);
        if (isUploadCancelledError(error) || controller.signal.aborted || batchCancelledRef.current) {
          return;
        }
        console.error('Video upload failed', error);
        setUploadProgress(0);
        setUploadError(
          error instanceof Error
            ? `Erro no upload de "${file.name}": ${error.message}`
            : `Falha ao enviar "${file.name}" para o domínio da plataforma. Tente novamente.`
        );
      } finally {
        setIsPreparingPlayback(false);
        if (uploadAbortRef.current === controller) {
          uploadAbortRef.current = null;
        }
        activeUploadIdRef.current = null;
        setIsUploadingVideo(false);
      }
      return;
    }

    // Multi-file fast batch mode: uploads every file, prepares instant playback, fetches original web cover, publishes automatically, and SKIPS any file with error!
    setIsUploadingVideo(true);
    setUploadError('');
    setBatchSummary('');
    let uploadedCount = 0;
    let skippedFilesCount = 0;
    let lastPublishedBatchMovie: MediaItem | null = null;
    const skippedNames: string[] = [];

    for (let i = 0; i < fileList.length; i++) {
      if (batchCancelledRef.current) break;
      const file = fileList[i];
      const cleanedName = (cleanTitleFromFilename(file.name) || file.name.replace(/\.[^/.]+$/, '') || `Filme ${i + 1}`).slice(0, 240);
      const controller = new AbortController();
      uploadAbortRef.current = controller;
      activeUploadIdRef.current = null;

      setVideoFileName(`[${i + 1}/${fileList.length}] ${file.name}`);
      setVideoFileSize(file.size);
      setUploadProgress(1);
      setBatchSummary(`A enviar lote: ${i + 1}/${fileList.length} (${file.name}) • Saltados: ${skippedFilesCount}`);

      try {
        const [uploadRes, artworkRes] = await Promise.allSettled([
          uploadFileToStorage(
            file,
            'videos',
            (pct, telemetry) => {
              setUploadProgress(pct);
              if (telemetry) setUploadTelemetry(telemetry);
            },
            controller.signal
          ),
          searchOriginalMovieArtwork(cleanedName, contentType),
        ]);

        if (batchCancelledRef.current || controller.signal.aborted) {
          break;
        }
        if (uploadRes.status === 'rejected') {
          if (isUploadCancelledError(uploadRes.reason)) {
            break;
          }
          throw uploadRes.reason;
        }

        const matchedArt =
          artworkRes.status === 'fulfilled' && artworkRes.value.length > 0 ? artworkRes.value[0] : null;

        let resolvedStreamPath = uploadRes.value.streamPath;
        const located = await locateUploadedMovieFile({
          url: resolvedStreamPath,
          query: file.name,
          title: cleanedName,
        }).catch(() => null);
        if (located?.found && located.streamPath) {
          resolvedStreamPath = located.streamPath;
        }

        await prepareUploadedMovieForPlayback(resolvedStreamPath).catch(() => null);
        warmUpPlaybackTarget(resolvedStreamPath);

        const batchFileIsSeries =
          contentType === 'series' ||
          isDetectedSeriesItem({ title: file.name, originalTitle: cleanedName, videoUrl: resolvedStreamPath });
        const batchMovie: MediaItem = {
          id: `custom-uploaded-${Date.now()}-${i}`,
          title: (matchedArt?.title || cleanedName).slice(0, 240),
          originalTitle: matchedArt?.originalTitle || cleanedName,
          type: batchFileIsSeries ? 'series' : 'movie',
          thumbnailUrl: matchedArt?.posterUrl || PRESET_AVATARS[0],
          bannerUrl: matchedArt?.bannerUrl || matchedArt?.posterUrl || PRESET_AVATARS[1],
          videoUrl: resolvedStreamPath,
          synopsis:
            matchedArt?.synopsis || 'Filme carregado pelo Administrador no Salgueiro Streaming Angola.',
          rating,
          imdbScore: matchedArt?.imdbScore || 8.0,
          year: matchedArt?.year || 2026,
          duration: duration || '2h 00m',
          genres: (selectedGenres.length > 0 ? selectedGenres : ['Internacional']) as any,
          quality: quality as any,
          audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
          subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
          isSalgueiroMember: true,
          matchPercentage: 98,
          director: director.trim() || 'Produção Internacional',
          cast: [{ name: 'Elenco Principal', role: 'Atores', character: 'Elenco Principal' }],
        };

        await onUploadMovie(batchMovie);
        lastPublishedBatchMovie = batchMovie;
        uploadedCount++;
      } catch (err) {
        if (batchCancelledRef.current || controller.signal.aborted || isUploadCancelledError(err)) {
          break;
        }
        if (!skipUploadErrors) {
          setUploadError(
            `Erro em "${file.name}": ${err instanceof Error ? err.message : 'Falha no envio.'}`
          );
          setIsUploadingVideo(false);
          uploadAbortRef.current = null;
          activeUploadIdRef.current = null;
          return;
        }
        skippedFilesCount++;
        skippedNames.push(file.name);
      }
    }

    uploadAbortRef.current = null;
    activeUploadIdRef.current = null;
    setIsUploadingVideo(false);

    if (batchCancelledRef.current) {
      return;
    }

    if (lastPublishedBatchMovie) {
      setPublishedMovieReady(lastPublishedBatchMovie);
    }
    setUploadProgress(100);
    const summaryText = `Lote concluído: ${uploadedCount} filme(s) disponível(is) e pronto(s) a reproduzir${
      skippedFilesCount > 0 ? ` • ${skippedFilesCount} erro(s) saltado(s): ${skippedNames.join(', ')}` : ' sem erros!'
    }`;
    setBatchSummary(summaryText);
    triggerToast(summaryText);
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const fileList = inputEl.files ? Array.from(inputEl.files) : [];
    inputEl.value = '';
    await processSelectedFiles(fileList);
  };

  const triggerToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  const handlePosterFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (file) {
      setPosterFileName(file.name);
      setIsUploadingPoster(true);
      try {
        const res = await uploadFileToStorage(file, 'images');
        setPosterUrl(res.streamPath);
        triggerToast('Capa armazenada no domínio com sucesso!');
      } catch {
        setUploadError('Não foi possível enviar a imagem da capa para o domínio.');
      } finally {
        setIsUploadingPoster(false);
        inputEl.value = '';
      }
    }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (file) {
      setBannerFileName(file.name);
      setIsUploadingBanner(true);
      try {
        const res = await uploadFileToStorage(file, 'images');
        setBannerUrl(res.streamPath);
        triggerToast('Banner armazenado no domínio com sucesso!');
      } catch {
        setUploadError('Não foi possível enviar a imagem do banner para o domínio.');
      } finally {
        setIsUploadingBanner(false);
        inputEl.value = '';
      }
    }
  };

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      if (selectedGenres.length > 1) {
        setSelectedGenres(selectedGenres.filter((g) => g !== genre));
      }
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleLocateStoredVideo = async (silent = false) => {
    setIsLocatingFile(true);
    setUploadError('');
    try {
      const located = await locateUploadedMovieFile({
        url: videoUrl.trim(),
        query: videoFileName.trim() || title.trim(),
        title: title.trim() || originalTitle.trim(),
      });
      if (located.found && located.streamPath) {
        setVideoUrl(located.streamPath);
        if (located.filename) setVideoFileName(located.filename);
        if (located.size) setVideoFileSize(located.size);
        setUploadProgress(100);
        setPlaybackReadyNote('Ficheiro encontrado no domínio e preparado para reprodução sem atrasos!');
        refreshVaultFiles();
        if (!silent) {
          triggerToast(`Ficheiro "${located.filename}" encontrado e ligado para reprodução!`);
        }
        void prepareUploadedMovieForPlayback(located.streamPath);
      } else if (!silent) {
        setUploadError('Nenhum ficheiro correspondente foi encontrado no domínio. Faça o upload do ficheiro ou escolha na lista "Guardados".');
      }
    } finally {
      setIsLocatingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isUploadingVideo || isUploadingPoster || isUploadingBanner) return;

    let resolvedVideoUrl = videoUrl.trim();
    if (!resolvedVideoUrl) {
      const autoFound = await locateUploadedMovieFile({
        query: videoFileName.trim() || title.trim(),
        title: title.trim() || originalTitle.trim(),
      });
      if (autoFound.found && autoFound.streamPath) {
        resolvedVideoUrl = autoFound.streamPath;
        setVideoUrl(resolvedVideoUrl);
      }
    }
    if (!resolvedVideoUrl) {
      setUploadError('Selecione ou carregue o ficheiro do filme antes de publicar.');
      return;
    }

    setIsSubmitting(true);
    setUploadError('');

    // Ensure local vault file is verified & prepared (cached ffprobe + faststart) before publishing
    if (isVaultStreamUrl(resolvedVideoUrl)) {
      const located = await locateUploadedMovieFile({
        url: resolvedVideoUrl,
        query: videoFileName.trim() || title.trim(),
        title: title.trim() || originalTitle.trim(),
      }).catch(() => null);
      if (located?.found && located.streamPath) {
        resolvedVideoUrl = located.streamPath;
        setVideoUrl(resolvedVideoUrl);
      }
      await prepareUploadedMovieForPlayback(resolvedVideoUrl).catch(() => null);
    }

    const fallbackPoster = PRESET_AVATARS[0];
    const fallbackBanner = PRESET_AVATARS[1];

    const castList = castInput
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => ({ name, role: 'Ator Principal', character: name }));

    try {
      if (editingItem && onUpdateMovie) {
        const updatedMovie: MediaItem = {
          ...editingItem,
          title: title.trim(),
          originalTitle: originalTitle.trim() || title.trim(),
          type: contentType,
          thumbnailUrl: posterUrl.trim() || fallbackPoster,
          bannerUrl: bannerUrl.trim() || posterUrl.trim() || fallbackBanner,
          videoUrl: resolvedVideoUrl,
          synopsis: synopsis.trim() || editingItem.synopsis,
          rating: rating,
          imdbScore: Number(imdbScore) || 8.0,
          year: Number(year) || 2026,
          duration: duration || '2h 00m',
          genres: selectedGenres as any,
          quality: quality as any,
          audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
          subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
          director: director.trim() || editingItem.director || 'Produção Internacional',
          cast: castList.length > 0 ? castList : (editingItem.cast || [{ name: 'Elenco Principal', role: 'Atores', character: 'Elenco Principal' }]),
        };

        await onUpdateMovie(updatedMovie);
        setIsSubmitting(false);
        setPublishedMovieReady(updatedMovie);
        setSuccessMessage(`"${updatedMovie.title}" atualizado e disponível para reprodução imediata!`);
      } else {
        const autoDetectedSeries =
          contentType === 'series' ||
          isDetectedSeriesItem({
            title: title.trim(),
            originalTitle: originalTitle.trim(),
            videoUrl: resolvedVideoUrl,
            duration,
          });
        const newMovie: MediaItem = {
          id: `custom-uploaded-${Date.now()}`,
          title: title.trim(),
          originalTitle: originalTitle.trim() || title.trim(),
          type: autoDetectedSeries ? 'series' : 'movie',
          thumbnailUrl: posterUrl.trim() || fallbackPoster,
          bannerUrl: bannerUrl.trim() || posterUrl.trim() || fallbackBanner,
          videoUrl: resolvedVideoUrl,
          synopsis: synopsis.trim() || 'Filme carregado pelo Administrador no Salgueiro Streaming Angola.',
          rating: rating,
          imdbScore: Number(imdbScore) || 8.0,
          year: Number(year) || 2026,
          duration: duration || '2h 00m',
          genres: selectedGenres as any,
          quality: quality as any,
          audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
          subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
          isSalgueiroMember: true,
          matchPercentage: 98,
          director: director.trim() || 'Produção Internacional',
          cast: castList.length > 0 ? castList : [{ name: 'Elenco Principal', role: 'Atores', character: 'Elenco Principal' }],
        };

        await onUploadMovie(newMovie);
        setIsSubmitting(false);
        setPublishedMovieReady(newMovie);
        setSuccessMessage(`"${newMovie.title}" publicado e disponível para reproduzir sem erros nem atrasos!`);
      }
    } catch (err) {
      setIsSubmitting(false);
      setUploadError(
        err instanceof Error
          ? `Erro ao publicar filme: ${err.message}`
          : 'Erro ao publicar o filme no catálogo. Tente novamente.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 overflow-y-auto animate-fade-in">
      <div className="bg-[#0f172a] border border-[#2d3139] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl my-3">
        {/* Modal Header (Compact) */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#1e293b] via-[#0f172a] to-[#1e1b4b] border-b border-[#2d3139] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 ${editingItem ? 'bg-amber-500 shadow-amber-500/30' : 'bg-[#7b5be4] shadow-[#7b5be4]/30'} rounded-xl shadow-lg shrink-0`}>
              {editingItem ? <Edit2 className="w-4 h-4 text-black" /> : <Upload className="w-4 h-4 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[9px] font-black uppercase tracking-wider rounded">
                  ADMIN
                </span>
                <span className="text-[11px] text-slate-400 truncate">{domainConfig.customDomain}</span>
              </div>
              <h2 className="text-base font-extrabold text-white tracking-tight truncate">
                {editingItem
                  ? `Edição Completa de Filme: ${editingItem.title}`
                  : 'Upload Rápido de Filmes'}
              </h2>
            </div>
          </div>
          <button
            onClick={handleSafeClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-lg transition-all shrink-0"
            title={isUploadingVideo ? 'Upload em curso até 100%' : 'Fechar'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (Compact) */}
        <div className="flex border-b border-slate-800 bg-[#090e17]/80 px-4 pt-2 gap-3 justify-between items-center">
          <div className="flex gap-3">
            <button
              onClick={() => setActiveTab('new')}
              className={`pb-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'new'
                  ? 'border-[#7b5be4] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {editingItem ? <Edit2 className="w-3.5 h-3.5 text-amber-400" /> : <Plus className="w-3.5 h-3.5" />}
              {editingItem ? 'Editar Conteúdo' : 'Carregar Filme'}
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`pb-2 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'list'
                  ? 'border-[#7b5be4] text-white'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Publicados ({existingCustomMovies.length})
            </button>
          </div>
          {editingItem && (
            <button
              type="button"
              onClick={() => {
                autoPublishedMovieIdRef.current = null;
                setEditingItem(null);
                setPublishedMovieReady(null);
                setTitle('');
                setOriginalTitle('');
                setArtworkQuery('');
                setArtworkResults([]);
                setSynopsis('');
                setVideoUrl('');
                setVideoFileName('');
                setVideoFileSize(0);
                setUploadProgress(0);
                setPosterUrl('');
                setBannerUrl('');
                setSelectedGenres(['Internacional', 'Ação']);
              }}
              className="text-[10px] text-amber-400 hover:underline uppercase font-bold tracking-wider mb-1.5"
            >
              + Novo
            </button>
          )}
        </div>

        {/* Body Content (Compact) */}
        <div className="p-4 max-h-[68vh] overflow-y-auto no-scrollbar space-y-3">
          {closeBlockedNotice && (
            <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 text-amber-200 rounded-xl flex items-center gap-2 text-[11px] font-bold animate-fade-in">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{closeBlockedNotice}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl flex items-center justify-between gap-2 text-[11px] font-bold">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{successMessage}</span>
              </div>
              {publishedMovieReady && onPlayMovie && (
                <button
                  type="button"
                  onClick={() => {
                    onPlayMovie(publishedMovieReady);
                    onClose();
                  }}
                  className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 shrink-0 transition-all shadow"
                >
                  <Play className="w-3 h-3 fill-black" /> Reproduzir Agora
                </button>
              )}
            </div>
          )}

          {publishedMovieReady && activeTab === 'new' && (
            <div className="p-3 bg-gradient-to-r from-emerald-500/15 to-[#7b5be4]/15 border border-emerald-500/40 rounded-xl flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate">
                  {publishedMovieReady.title}
                </p>
                <p className="text-[10px] text-emerald-300 font-semibold">
                  Disponível para todos os utilizadores • Ficheiro pronto sem atrasos
                </p>
              </div>
              <div className="flex items-center gap-2">
                {onPlayMovie && (
                  <button
                    type="button"
                    onClick={() => {
                      onPlayMovie(publishedMovieReady);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all shadow-lg"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" /> Reproduzir Filme
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold rounded-lg transition-all"
                >
                  Concluir
                </button>
              </div>
            </div>
          )}

          {activeTab === 'new' ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Compact Content Type + Uninterrupted Upload Strip */}
              <div className="p-2.5 bg-[#162032] border border-slate-800 rounded-xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-amber-400" /> Menu na Plataforma:
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Mover/classificar este título entre o menu Filmes e o menu Séries para todos os utilizadores
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setContentType('movie')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                        contentType === 'movie'
                          ? 'bg-[#7b5be4] text-white shadow-md shadow-[#7b5be4]/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Filme (Menu Filmes)
                    </button>
                    <button
                      type="button"
                      onClick={() => setContentType('series')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                        contentType === 'series'
                          ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Série (Menu Séries)
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-1.5 border-t border-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={skipUploadErrors}
                    onChange={(e) => setSkipUploadErrors(e.target.checked)}
                    className="w-3.5 h-3.5 accent-emerald-500 rounded"
                  />
                  <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                    Tempo ilimitado até 100% + saltar erros automaticamente (MP4, AVI, MPEG, MKV)
                  </span>
                </label>
              </div>

              {uploadError && (
                <div className="p-2.5 bg-red-500/15 border border-red-500/40 text-red-300 rounded-xl text-[11px] font-bold">
                  {uploadError}
                </div>
              )}

              {batchSummary && (
                <div className="p-2.5 bg-sky-500/15 border border-sky-500/40 text-sky-200 rounded-xl text-[11px] font-bold">
                  {batchSummary}
                </div>
              )}

              {/* Step 1: Video File into Domain Vault, Stored Vault File, or URL */}
              <div className="p-3 bg-[#162032] border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#7b5be4]" /> Ficheiro &amp; URL de Streaming do Filme
                  </label>
                  <div className="flex flex-wrap items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setVideoInputMode('file')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        videoInputMode === 'file' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'
                      }`}
                    >
                      PC Local
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoInputMode('vault')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        videoInputMode === 'vault' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'
                      }`}
                    >
                      Guardados ({vaultVideos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoInputMode('url')}
                      className={`px-2 py-0.5 rounded-md font-bold transition-all ${
                        videoInputMode === 'url' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'
                      }`}
                    >
                      URL
                    </button>
                    <button
                      type="button"
                      disabled={isLocatingFile || isUploadingVideo}
                      onClick={() => void handleLocateStoredVideo(false)}
                      className="px-2 py-0.5 rounded-md font-bold bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 transition-all disabled:opacity-50"
                      title="Encontrar automaticamente o ficheiro deste filme guardado no domínio"
                    >
                      {isLocatingFile ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Search className="w-3 h-3" />
                      )}
                      Localizar
                    </button>
                  </div>
                </div>

                {videoInputMode === 'file' ? (
                  <div className="space-y-2">
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isUploadingVideo && e.dataTransfer?.files?.length) {
                          void processSelectedFiles(Array.from(e.dataTransfer.files));
                        }
                      }}
                      className="border-2 border-dashed border-slate-700 hover:border-[#7b5be4] rounded-xl p-3.5 text-center transition-all bg-[#0f172a]"
                    >
                      <Video className={`w-6 h-6 ${isUploadingVideo ? 'text-amber-400 animate-bounce' : 'text-[#7b5be4]'} mx-auto mb-1`} />
                      <p className="text-[11px] font-bold text-white mb-0.5 truncate">
                        {videoFileName
                          ? `${videoFileName}${videoFileSize > 0 ? ` (${formatBytes(videoFileSize)})` : ''}`
                          : 'Enviar 1 ou vários filmes do computador (700 MB a 3+ GB)'}
                      </p>
                      <p className="text-[10px] text-slate-400 mb-2">
                        MP4, AVI, MPEG, MPEG4, MKV, WebM, MOV, TS • Blocos com erro ignorados automaticamente
                      </p>
                      <label className={`px-4 py-1.5 bg-[#7b5be4] hover:bg-[#8b6bf5] text-white rounded-lg text-[11px] font-bold inline-block transition-all shadow ${isUploadingVideo ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`}>
                        {isUploadingVideo ? `A enviar (${Math.round(uploadProgress)}%)...` : 'Escolher Filme(s) do PC'}
                        <input
                          type="file"
                          multiple
                          disabled={isUploadingVideo}
                          accept=".mp4,.m4v,.avi,.mpeg,.mpg,.mpeg4,.mpg4,.mkv,.webm,.ts,.m2ts,.mts,.mov,.flv,.wmv,.vob,.divx,.xvid,.3gp,.ogv,.asf,video/*"
                          onChange={handleVideoFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {uploadProgress > 0 && (
                      <div className="space-y-1.5 p-2.5 bg-[#0f172a] border border-slate-800 rounded-lg">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-slate-300">
                          <span>
                            {uploadProgress === 100
                              ? '100% Gravado no domínio da plataforma!'
                              : `Blocos (${uploadTelemetry ? `${uploadTelemetry.completedChunks}/${uploadTelemetry.totalChunks}` : '...'})`}
                          </span>
                          <div className="flex flex-wrap items-center gap-2 font-mono">
                            {uploadTelemetry && uploadTelemetry.loadedBytes !== undefined && uploadTelemetry.totalBytes !== undefined && (
                              <span className="text-slate-300">
                                {formatBytes(uploadTelemetry.loadedBytes)} / {formatBytes(uploadTelemetry.totalBytes)}
                              </span>
                            )}
                            {uploadTelemetry && uploadTelemetry.speedMBps > 0 && (
                              <span className="text-sky-400">{uploadTelemetry.speedMBps} MB/s</span>
                            )}
                            {uploadTelemetry && uploadTelemetry.etaSeconds > 0 && uploadProgress < 100 && (
                              <span className="text-amber-300">~{formatEtaSeconds(uploadTelemetry.etaSeconds)}</span>
                            )}
                            <span className={uploadProgress === 100 ? 'text-emerald-400' : 'text-[#a78bfa]'}>
                              {Math.round(uploadProgress)}%
                            </span>
                            {isUploadingVideo && (
                              <button
                                type="button"
                                onClick={handleCancelActiveUpload}
                                className="px-2 py-0.5 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white rounded text-[10px] font-sans font-bold flex items-center gap-1 transition-all"
                              >
                                <XCircle className="w-3 h-3" />
                                Cancelar Upload
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${uploadProgress === 100 ? 'bg-emerald-500' : 'bg-[#7b5be4]'}`}
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        {uploadTelemetry?.statusMessage && uploadProgress < 100 && (
                          <p className="text-[10px] text-amber-300 font-semibold flex items-center gap-1 pt-0.5">
                            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                            <span>{uploadTelemetry.statusMessage}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {videoUrl && (
                      <div className="space-y-1">
                        <div className="px-2.5 py-1.5 bg-[#0f172a] border border-emerald-500/30 rounded-lg text-[10px] font-mono text-emerald-300 truncate flex items-center justify-between gap-2">
                          <span className="truncate">
                            ✓ {videoUrl.startsWith('/stream/') ? buildCustomDomainStreamUrl(videoUrl, domainConfig.customDomain) : videoUrl}
                          </span>
                          {onPlayMovie && (
                            <button
                              type="button"
                              onClick={() => {
                                onPlayMovie({
                                  id: editingItem?.id || `preview-${Date.now()}`,
                                  title: title.trim() || videoFileName || 'Filme',
                                  originalTitle: originalTitle.trim() || title.trim(),
                                  type: contentType,
                                  thumbnailUrl: posterUrl.trim() || PRESET_AVATARS[0],
                                  bannerUrl: bannerUrl.trim() || posterUrl.trim() || PRESET_AVATARS[1],
                                  videoUrl,
                                  synopsis: synopsis.trim() || '',
                                  rating,
                                  imdbScore: Number(imdbScore) || 8.5,
                                  year: Number(year) || 2026,
                                  duration: duration || '2h 00m',
                                  genres: selectedGenres as any,
                                  quality: quality as any,
                                  audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
                                  subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
                                  isSalgueiroMember: true,
                                });
                              }}
                              className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded font-sans text-[9px] font-black uppercase flex items-center gap-1 shrink-0"
                              title="Testar reprodução imediata deste ficheiro"
                            >
                              <Play className="w-2.5 h-2.5 fill-black" /> Reproduzir
                            </button>
                          )}
                        </div>
                        {(isPreparingPlayback || playbackReadyNote) && (
                          <p className="text-[10px] text-emerald-300 font-semibold flex items-center gap-1.5 px-1">
                            {isPreparingPlayback ? (
                              <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                            ) : (
                              <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                            <span>{playbackReadyNote}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : videoInputMode === 'vault' ? (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {vaultVideos.length === 0 ? (
                      <div className="p-3 bg-[#0f172a] border border-slate-800 rounded-lg text-center text-[11px] text-slate-400">
                        Ainda não existem filmes guardados. Use "PC Local".
                      </div>
                    ) : (
                      vaultVideos.map((vf) => {
                        const selected = videoUrl === vf.streamPath;
                        return (
                          <button
                            key={vf.filename}
                            type="button"
                            onClick={() => {
                              setVideoUrl(vf.streamPath);
                              const cleaned = cleanTitleFromFilename(vf.filename.replace(/^\d+_/, ''));
                              if (!title) setTitle(cleaned);
                              setArtworkQuery(cleaned);
                            }}
                            className={`w-full p-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-all ${
                              selected
                                ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white'
                                : 'bg-[#0f172a] border-slate-800 hover:border-slate-600 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <HardDrive className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold truncate">{vf.filename}</p>
                                <p className="text-[9px] text-slate-400 font-mono truncate">
                                  {formatBytes(vf.size)}
                                </p>
                              </div>
                            </div>
                            {selected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 p-2.5 bg-[#0f172a] border border-slate-800 rounded-xl">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Globe className="w-3 h-3" /> URL de Streaming do Vídeo (Servidor Principal)
                      </span>
                      <div className="flex items-center gap-1.5">
                        {videoUrl.trim() && (
                          <button
                            type="button"
                            onClick={() => setVideoUrl('')}
                            className="px-2 py-0.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 rounded text-[9px] font-bold transition-all"
                          >
                            Limpar URL
                          </button>
                        )}
                        {videoUrl.trim() && onPlayMovie && (
                          <button
                            type="button"
                            onClick={() => {
                              onPlayMovie({
                                id: editingItem?.id || `preview-${Date.now()}`,
                                title: title.trim() || 'Filme',
                                originalTitle: originalTitle.trim() || title.trim(),
                                type: contentType,
                                thumbnailUrl: posterUrl.trim() || PRESET_AVATARS[0],
                                bannerUrl: bannerUrl.trim() || posterUrl.trim() || PRESET_AVATARS[1],
                                videoUrl: videoUrl.trim(),
                                synopsis: synopsis.trim() || '',
                                rating,
                                imdbScore: Number(imdbScore) || 8.5,
                                year: Number(year) || 2026,
                                duration: duration || '2h 00m',
                                genres: selectedGenres as any,
                                quality: quality as any,
                                audio: audioLangs.split(',').map((s) => s.trim()).filter(Boolean),
                                subtitles: subtitleLangs.split(',').map((s) => s.trim()).filter(Boolean),
                                isSalgueiroMember: true,
                              });
                            }}
                            className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded text-[9px] font-black uppercase flex items-center gap-1"
                            title="Testar reprodução com esta URL de origem"
                          >
                            <Play className="w-2.5 h-2.5 fill-black" /> Testar URL
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      required
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://... (MP4, MKV, HLS .m3u8, FenixFlix, Cloudflare R2, /stream/media/...)"
                      className="w-full bg-[#0c121e] border border-slate-700 rounded-lg p-2 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-[#7b5be4]"
                    />
                    <p className="text-[10px] text-slate-400">
                      Cole ou atualize aqui o link principal do vídeo. Ao abrir este filme, a plataforma reproduzirá primeiro a partir desta URL de origem.
                    </p>
                  </div>
                )}
              </div>

              {/* Step 2: Basic Info (Título, Título Original & Ano de Lançamento) */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Título do Filme</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!artworkQuery) setArtworkQuery(e.target.value);
                    }}
                    placeholder="Ex: Avatar, John Wick"
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
                <div className="sm:col-span-5 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Título Original</label>
                  <input
                    type="text"
                    value={originalTitle}
                    onChange={(e) => setOriginalTitle(e.target.value)}
                    placeholder="Ex: Original Title"
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ano Lançamento</label>
                  <input
                    type="number"
                    min={1900}
                    max={2099}
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs font-bold text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
              </div>

              {/* Step 2.5 & 3: Capa & Banner (Upload Local, URL, ou Escolha Automática da Web) */}
              <div className="p-3 bg-[#162032] border border-[#7b5be4]/30 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-[11px] font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Capa &amp; Banner (Local, URL ou Web)
                  </label>
                </div>

                {/* Web Search Bar */}
                <div className="flex flex-col sm:flex-row gap-1.5">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={artworkQuery}
                      onChange={(e) => setArtworkQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleSearchOriginalArtwork();
                        }
                      }}
                      placeholder="Pesquisar capa e banner originais na web..."
                      className="w-full bg-[#0f172a] border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7b5be4]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSearchingArtwork}
                    onClick={() => void handleSearchOriginalArtwork()}
                    className="px-3 py-1.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50 shrink-0"
                  >
                    {isSearchingArtwork ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Globe className="w-3.5 h-3.5" />
                    )}
                    <span>Procurar Opções</span>
                  </button>
                  <button
                    type="button"
                    disabled={isSearchingArtwork}
                    onClick={() => void handleSearchAndReplaceArtworkNow()}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-[#7b5be4] hover:from-amber-400 hover:to-[#8e74eb] text-black font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center justify-center gap-1 transition-all disabled:opacity-50 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>Auto-Aplicar</span>
                  </button>
                </div>

                {/* Capa (Poster) Section: URL + Local Upload */}
                <div className="p-2.5 bg-[#0f172a] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                      Imagem da Capa (Poster)
                    </span>
                    <div className="flex gap-1 text-[9px]">
                      <button
                        type="button"
                        onClick={() => setPosterInputMode('url')}
                        className={`px-2 py-0.5 rounded font-bold ${posterInputMode === 'url' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'}`}
                      >
                        URL / Web
                      </button>
                      <button
                        type="button"
                        onClick={() => setPosterInputMode('file')}
                        className={`px-2 py-0.5 rounded font-bold ${posterInputMode === 'file' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'}`}
                      >
                        Upload Local
                      </button>
                    </div>
                  </div>

                  {posterInputMode === 'file' ? (
                    <div className="border border-dashed border-slate-700 rounded-lg p-2 text-center bg-[#0c121e] flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-300 truncate">
                        {isUploadingPoster ? 'A carregar capa...' : posterFileName || 'Selecionar imagem de capa do computador'}
                      </span>
                      <label className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded text-[10px] font-black cursor-pointer shrink-0">
                        Escolher Capa
                        <input type="file" accept="image/*" disabled={isUploadingPoster} onChange={handlePosterFileChange} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={posterUrl}
                      onChange={(e) => setPosterUrl(e.target.value)}
                      placeholder="URL da capa (ou escolha abaixo / faça upload local)"
                      className="w-full bg-[#0c121e] border border-slate-700 rounded-lg p-2 text-[11px] text-white outline-none focus:border-[#7b5be4]"
                    />
                  )}
                </div>

                {/* Banner (Backdrop) Section: URL + Local Upload */}
                <div className="p-2.5 bg-[#0f172a] border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                      Imagem do Banner (Fundo 16:9)
                    </span>
                    <div className="flex gap-1 text-[9px]">
                      <button
                        type="button"
                        onClick={() => setBannerInputMode('url')}
                        className={`px-2 py-0.5 rounded font-bold ${bannerInputMode === 'url' ? 'bg-sky-500 text-black' : 'text-slate-400'}`}
                      >
                        URL / Web
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerInputMode('file')}
                        className={`px-2 py-0.5 rounded font-bold ${bannerInputMode === 'file' ? 'bg-sky-500 text-black' : 'text-slate-400'}`}
                      >
                        Upload Local
                      </button>
                    </div>
                  </div>

                  {bannerInputMode === 'file' ? (
                    <div className="border border-dashed border-slate-700 rounded-lg p-2 text-center bg-[#0c121e] flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-300 truncate">
                        {isUploadingBanner ? 'A carregar banner...' : bannerFileName || 'Selecionar imagem de banner do computador'}
                      </span>
                      <label className="px-2.5 py-1 bg-sky-400 hover:bg-sky-300 text-black rounded text-[10px] font-black cursor-pointer shrink-0">
                        Escolher Banner
                        <input type="file" accept="image/*" disabled={isUploadingBanner} onChange={handleBannerFileChange} className="hidden" />
                      </label>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      placeholder="URL do banner (ou escolha abaixo / faça upload local)"
                      className="w-full bg-[#0c121e] border border-slate-700 rounded-lg p-2 text-[11px] text-white outline-none focus:border-sky-400"
                    />
                  )}
                </div>

                {artworkSearchNote && (
                  <p className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {artworkSearchNote}
                  </p>
                )}

                {artworkResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                    {artworkResults.map((art) => {
                      const isPosterChosen = posterUrl === art.posterUrl;
                      const resolvedBanner = art.bannerUrl || art.posterUrl;
                      const isBannerChosen = bannerUrl === resolvedBanner;
                      return (
                        <div
                          key={art.id}
                          className={`rounded-lg overflow-hidden border transition-all bg-[#0f172a] p-1.5 flex flex-col gap-1.5 ${
                            isPosterChosen || isBannerChosen
                              ? 'border-emerald-400 ring-1 ring-emerald-400/50'
                              : 'border-slate-700'
                          }`}
                        >
                          <div className="flex gap-1.5 items-stretch">
                            <div className="w-12 aspect-[2/3] relative bg-black rounded overflow-hidden shrink-0">
                              <img
                                src={art.posterUrl}
                                alt={art.title}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="aspect-video relative bg-black rounded overflow-hidden">
                                <img
                                  src={resolvedBanner}
                                  alt={`${art.title} banner`}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <p className="text-[9px] font-bold text-white truncate mt-1">
                                {art.title} {art.year ? `(${art.year})` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPosterUrl(art.posterUrl);
                                setPosterInputMode('url');
                                triggerToast(`Capa de "${art.title}" selecionada!`);
                              }}
                              className={`py-1 rounded text-[9px] font-black uppercase transition-all ${
                                isPosterChosen
                                  ? 'bg-emerald-500 text-black'
                                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
                              }`}
                            >
                              {isPosterChosen ? '✓ Capa' : 'Capa'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBannerUrl(resolvedBanner);
                                setBannerInputMode('url');
                                triggerToast(`Banner de "${art.title}" selecionado!`);
                              }}
                              className={`py-1 rounded text-[9px] font-black uppercase transition-all ${
                                isBannerChosen
                                  ? 'bg-sky-400 text-black'
                                  : 'bg-white/10 hover:bg-white/20 text-slate-200'
                              }`}
                            >
                              {isBannerChosen ? '✓ Banner' : 'Banner'}
                            </button>
                            <button
                              type="button"
                              onClick={() => applyArtworkSelection(art, true)}
                              className="py-1 rounded text-[9px] font-black uppercase bg-[#7b5be4]/30 hover:bg-[#7b5be4] text-white transition-all"
                            >
                              Ambos
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(posterUrl || bannerUrl) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {posterUrl && (
                      <div className="flex items-center gap-2 p-1.5 bg-[#0c121e] rounded-lg border border-slate-800">
                        <div className="h-12 w-8 rounded overflow-hidden border border-slate-700 shrink-0 bg-black">
                          <img src={posterUrl} alt="Capa Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <span className="inline-block px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase">
                            Capa Pronta ✓
                          </span>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{posterUrl}</p>
                        </div>
                      </div>
                    )}
                    {bannerUrl && (
                      <div className="flex items-center gap-2 p-1.5 bg-[#0c121e] rounded-lg border border-slate-800">
                        <div className="h-12 w-20 rounded overflow-hidden border border-slate-700 shrink-0 bg-black">
                          <img src={bannerUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <span className="inline-block px-1.5 py-0.5 bg-sky-500/20 text-sky-400 text-[9px] font-bold rounded uppercase">
                            Banner Pronto ✓
                          </span>
                          <p className="text-[9px] text-slate-400 font-mono truncate">{bannerUrl}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Synopsis & Technical Details (Compact) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sinopse</label>
                <textarea
                  rows={2}
                  value={synopsis}
                  onChange={(e) => setSynopsis(e.target.value)}
                  placeholder="Resumo do filme..."
                  className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ano</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Duração</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Idade</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  >
                    <option value="L">L (Livre)</option>
                    <option value="12">12 Anos</option>
                    <option value="14">14 Anos</option>
                    <option value="16">16 Anos</option>
                    <option value="18">18 Anos</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">IMDb</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={imdbScore}
                    onChange={(e) => setImdbScore(Number(e.target.value))}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Qualidade</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white outline-none focus:border-[#7b5be4]"
                  >
                    <option value="4K Ultra HD">4K Ultra HD</option>
                    <option value="1080p Full HD">1080p Full HD</option>
                    <option value="720p HD">720p HD</option>
                    <option value="HD">HD</option>
                  </select>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Realizador / Diretor</label>
                  <input
                    type="text"
                    value={director}
                    onChange={(e) => setDirector(e.target.value)}
                    placeholder="Ex: Christopher Nolan"
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7b5be4]"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Elenco (por vírgula)</label>
                  <input
                    type="text"
                    value={castInput}
                    onChange={(e) => setCastInput(e.target.value)}
                    placeholder="Ex: Ator 1, Ator 2"
                    className="w-full bg-[#162032] border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 outline-none focus:border-[#7b5be4]"
                  />
                </div>
              </div>

              {/* Step 5: Genres (Compact) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gêneros</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableGenres.map((g) => {
                    const isSelected = selectedGenres.includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          isSelected
                            ? 'bg-[#7b5be4] text-white'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {g} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit CTA (Compact) */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                {isUploadingVideo ? (
                  <button
                    type="button"
                    onClick={handleCancelActiveUpload}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Cancelar Upload
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSafeClose}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg transition-all"
                  >
                    Fechar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    isUploadingVideo ||
                    isUploadingPoster ||
                    isUploadingBanner ||
                    !title.trim() ||
                    (!videoUrl.trim() && !videoFileName.trim())
                  }
                  className={`px-5 py-2 ${
                    editingItem 
                      ? 'bg-amber-500 hover:bg-amber-400 text-black' 
                      : 'bg-[#7b5be4] hover:bg-[#8e74eb] text-white'
                  } text-xs font-black uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50`}
                >
                  {editingItem ? <Save className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
                  <span>
                    {isUploadingVideo
                      ? `A enviar (${Math.round(uploadProgress)}%)...`
                      : isSubmitting
                      ? (editingItem ? 'A Salvar...' : 'A Publicar...')
                      : (editingItem ? 'Salvar' : 'Publicar Filme')}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* Managed uploaded movies tab */
            <div className="space-y-5">
              {(() => {
                const displayedList =
                  publishedViewFilter === 'all' && allCatalogMovies.length > 0
                    ? allCatalogMovies
                    : existingCustomMovies.length > 0
                    ? existingCustomMovies
                    : allCatalogMovies;

                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#162032] border border-slate-800 rounded-2xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-amber-400" />
                          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Filmes Publicados ({displayedList.length})
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Substitua a capa pela imagem original da web para toda a plataforma
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {allCatalogMovies.length > 0 && (
                          <div className="flex bg-[#0f172a] p-1 rounded-xl border border-slate-700 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setPublishedViewFilter('custom')}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                publishedViewFilter === 'custom' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'
                              }`}
                            >
                              Enviados ({existingCustomMovies.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setPublishedViewFilter('all')}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                publishedViewFilter === 'all' ? 'bg-[#7b5be4] text-white' : 'text-slate-400'
                              }`}
                            >
                              Todos ({allCatalogMovies.length})
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={isBatchReplacingArtwork || displayedList.length === 0}
                          onClick={() => handleBatchReplaceArtworkFromWeb(displayedList)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-[#7b5be4] hover:from-amber-400 hover:to-[#8e74eb] text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-50"
                          title="Procurar na web a capa original de todos os filmes da lista e substituir automaticamente"
                        >
                          {isBatchReplacingArtwork ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-black" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-black" />
                          )}
                          <span>Substituir Todas as Capas (Web)</span>
                        </button>
                      </div>
                    </div>

                    {batchArtworkProgress && (
                      <div className="p-4 bg-gradient-to-r from-[#1e1b4b] to-[#162032] border border-[#7b5be4]/40 rounded-2xl space-y-2.5 shadow-xl animate-fade-in">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span className="flex items-center gap-2 text-amber-300">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            A substituir capas da web: {batchArtworkProgress.current} de {batchArtworkProgress.total}...
                          </span>
                          <span className="text-slate-300 font-mono text-[11px] truncate max-w-xs">
                            {batchArtworkProgress.currentTitle}
                          </span>
                        </div>
                        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-400 transition-all duration-300"
                            style={{
                              width: `${Math.round((batchArtworkProgress.current / batchArtworkProgress.total) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {displayedList.length === 0 ? (
                      <div className="text-center py-12 bg-[#162032] rounded-2xl border border-slate-800 space-y-2">
                        <Film className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">Nenhum vídeo carregado pelo administrador ainda.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {displayedList.map((movie) => {
                          const isReplacingThis = replacingCustomMovieId === movie.id;
                          return (
                            <div
                              key={movie.id}
                              className="p-3 bg-[#162032] border border-slate-800 rounded-2xl flex items-center gap-3 justify-between group hover:border-[#7b5be4]/40 transition-all"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-14 h-18 bg-black rounded-lg overflow-hidden border border-slate-700 shrink-0 relative">
                                  <img
                                    src={movie.thumbnailUrl}
                                    alt={movie.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-white truncate">{movie.title}</h4>
                                  <p className="text-[10px] text-[#7b5be4] font-semibold">{movie.year} • {movie.quality}</p>
                                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="inline-block px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase">
                                      Disponível
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {onPlayMovie && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onPlayMovie(movie);
                                      onClose();
                                    }}
                                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-black rounded-xl transition-all"
                                    title="Reproduzir agora"
                                  >
                                    <Play className="w-4 h-4 fill-current" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={isReplacingThis || isBatchReplacingArtwork}
                                  onClick={() => handleReplaceSingleMovieArtworkFromWeb(movie)}
                                  className="px-2.5 py-2 bg-[#7b5be4]/20 hover:bg-[#7b5be4] text-[#c4b5fd] hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider border border-[#7b5be4]/30 transition-all flex items-center gap-1 disabled:opacity-50"
                                  title="Procurar na web a capa original deste filme e substituir"
                                >
                                  {isReplacingThis ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  ) : (
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  )}
                                  <span className="hidden xl:inline">
                                    {isReplacingThis ? 'A substituir...' : 'Substituir Capa'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => loadItemForEdit(movie)}
                                  className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {onDeleteCustomMovie && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteCustomMovie(movie.id)}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

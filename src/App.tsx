import React, { useState, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { BoardView } from './components/BoardView';
import { DiscoverView } from './components/DiscoverView';
import { LibraryView } from './components/LibraryView';
import { DetailsView } from './components/DetailsView';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { SearchOverlay } from './components/SearchOverlay';
import { ContentCard } from './components/ContentCard';
import { SettingsView } from './components/SettingsView';
import { Footer } from './components/Footer';
import { RegistrationModal } from './components/RegistrationModal';
import { LoginModal } from './components/LoginModal';
import { AdminUploadModal } from './components/AdminUploadModal';
import { AdminArtworkPickerModal } from './components/AdminArtworkPickerModal';
import { AddonsView } from './components/AddonsView';
import { InternationalMoviesView } from './components/InternationalMoviesView';
import { SeriesView } from './components/SeriesView';
import {
  AddonCatalogSection,
  fetchAllInstalledAddonCatalogs,
  fetchAllInstalledLiveChannels,
  isDetectedSeriesItem,
  loadInstalledAddons,
  saveInstalledAddons,
} from './lib/stremioAddons';

import {
  HERO_FEATURED_ITEMS,
  LIVE_CHANNELS as INITIAL_LIVE_CHANNELS,
  ALL_MOVIES_CATALOG,
  CONTINUE_WATCHING_SAMPLE,
} from './data/mockData';
import { MediaItem, LiveChannel, ContinueWatchingItem, UserProfile, InstalledStremioAddon, UserDevice, PlatformTheme, RecycledItem } from './types/streaming';
import { Tv, RefreshCcw, RotateCcw, Trash2, Heart, WifiOff, AlertTriangle, X, Sparkles, Image as ImageIcon, Search, Check, Upload } from 'lucide-react';
import { parseM3U } from './data/m3uParser';
import { BUNDLED_M3U_PLAYLISTS } from './data/defaultIptvPlaylists';
import { DEFAULT_ADMIN_AVATAR } from './data/avatars';
import {
  ThemeContext,
  InterfacePreferences,
  loadSavedThemeForUser,
  saveThemeForUser,
  isValidPlatformTheme,
  loadInterfacePreferences,
  saveInterfacePreferences,
} from './lib/themes';
import {
  subscribeToGlobalCatalog,
  syncMovieToGlobalCatalog,
  deleteMovieFromGlobalCatalog,
  removeDeletedContentTombstone,
  subscribeToGlobalIptv,
  syncIptvToGlobal,
  subscribeToAllUserAccounts,
  saveUserAccountPayment,
  getDefaultDatesForMonthlyPlan,
  subscribeToMediaDomainConfig,
  saveMediaDomainConfigToFirestore,
  subscribeToGlobalPlatformConfig,
  saveGlobalPlatformConfigToFirestore,
  subscribeToAllUserDevices,
  subscribeToUserDevicesByEmail,
  OnlinePresenceRecord,
  upsertOnlinePresence,
  removeOnlinePresence,
  subscribeToOnlinePresence,
  subscribeToRecycleBin,
  addRecycleBinItem,
  restoreRecycleBinItem,
  permanentDeleteRecycleBinItem,
  emptyRecycleBin,
  getLocalRecycleBin,
} from './lib/firebase';
import { getCurrentDeviceId } from './lib/deviceManager';
import {
  MediaDomainConfig,
  DEFAULT_MEDIA_DOMAIN_CONFIG,
  fetchMediaDomainConfig,
  fetchServerCatalogMovies,
  saveServerCatalogMovie,
  deleteServerCatalogMovie,
  ChannelLogoResult,
  searchChannelLogoOnWeb,
  batchSearchChannelLogosOnWeb,
  fetchServerChannelLogos,
  saveServerChannelLogos,
  MovieArtworkOverride,
  batchSearchMovieArtworksOnWeb,
  fetchServerMovieArtworks,
  saveServerMovieArtworks,
  warmUpPlaybackTarget,
  findBestPlaybackServers,
} from './lib/mediaDomain';

export default function App() {
  const [activeView, setActiveView] = useState<string>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [installedAddons, setInstalledAddons] = useState<InstalledStremioAddon[]>(() => loadInstalledAddons());
  const [addonCatalogMovies, setAddonCatalogMovies] = useState<MediaItem[]>([]);
  const [addonCatalogSeries, setAddonCatalogSeries] = useState<MediaItem[]>([]);
  const [addonMovieSections, setAddonMovieSections] = useState<AddonCatalogSection[]>([]);
  const [addonSeriesSections, setAddonSeriesSections] = useState<AddonCatalogSection[]>([]);
  const [isLoadingAddonCatalogs, setIsLoadingAddonCatalogs] = useState(false);

  const refreshAddonCatalogs = React.useCallback(async (addonsList: InstalledStremioAddon[] = installedAddons) => {
    const enabled = addonsList.filter((a) => a.enabled);
    if (enabled.length === 0) {
      setAddonCatalogMovies([]);
      setAddonCatalogSeries([]);
      setAddonMovieSections([]);
      setAddonSeriesSections([]);
      return;
    }
    setIsLoadingAddonCatalogs(true);
    try {
      const result = await fetchAllInstalledAddonCatalogs(addonsList, 24);
      setAddonCatalogMovies(result.movies);
      setAddonCatalogSeries(result.series);
      setAddonMovieSections(result.movieSections);
      setAddonSeriesSections(result.seriesSections);
    } catch {
      // keep previous catalogs on transient failure
    } finally {
      setIsLoadingAddonCatalogs(false);
    }
  }, [installedAddons]);

  useEffect(() => {
    saveInstalledAddons(installedAddons);
    void refreshAddonCatalogs(installedAddons);
  }, [installedAddons]);

  // Selection states
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [playingMedia, setPlayingMedia] = useState<MediaItem | null>(null);
  const [playingChannel, setPlayingChannel] = useState<LiveChannel | null>(null);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAdminUploadOpen, setIsAdminUploadOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('salgueiro_current_user');
      if (!saved) return null;
      const parsed: UserProfile = JSON.parse(saved);
      if (parsed.role === 'admin' && (!parsed.avatarUrl || parsed.avatarUrl.includes('unsplash.com'))) {
        parsed.avatarUrl = DEFAULT_ADMIN_AVATAR;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [settingsInitialSection, setSettingsInitialSection] = useState<string | undefined>(undefined);
  const [recycledItems, setRecycledItems] = useState<RecycledItem[]>(() => getLocalRecycleBin());

  const [platformTheme, setPlatformTheme] = useState<PlatformTheme>(() => {
    try {
      const savedUser = localStorage.getItem('salgueiro_current_user');
      if (savedUser) {
        const parsed: UserProfile = JSON.parse(savedUser);
        if (parsed.preferredTheme && isValidPlatformTheme(parsed.preferredTheme)) {
          return parsed.preferredTheme;
        }
        return loadSavedThemeForUser(parsed.email);
      }
    } catch {}
    return loadSavedThemeForUser(null);
  });

  const [interfacePrefs, setInterfacePrefs] = useState<InterfacePreferences>(() =>
    loadInterfacePreferences()
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', platformTheme);
  }, [platformTheme]);

  const handleSelectPlatformTheme = (nextTheme: PlatformTheme) => {
    setPlatformTheme(nextTheme);
    saveThemeForUser(nextTheme, currentUser?.email);
    if (currentUser) {
      const updatedUser: UserProfile = {
        ...currentUser,
        preferredTheme: nextTheme,
      };
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem('salgueiro_current_user', JSON.stringify(updatedUser));
      } catch {}
      void saveUserAccountPayment(updatedUser).catch(() => {});
    }
  };

  const handleSaveGlobalTheme = async (theme: PlatformTheme) => {
    handleSelectPlatformTheme(theme);
    if (currentUser?.role === 'admin') {
      await saveGlobalPlatformConfigToFirestore(
        { preferredTheme: theme },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleUpdateInterfacePrefs = (nextPrefs: InterfacePreferences) => {
    setInterfacePrefs(nextPrefs);
    saveInterfacePreferences(nextPrefs);
  };

  const updateCurrentUser = (user: UserProfile | null) => {
    setCurrentUser(user);
    if (user) {
      localStorage.setItem('salgueiro_current_user', JSON.stringify(user));
      if (user.preferredTheme && isValidPlatformTheme(user.preferredTheme)) {
        setPlatformTheme(user.preferredTheme);
        saveThemeForUser(user.preferredTheme, user.email);
      } else {
        const savedUserTheme = loadSavedThemeForUser(user.email);
        setPlatformTheme(savedUserTheme);
      }
    } else {
      localStorage.removeItem('salgueiro_current_user');
      setPlatformTheme(loadSavedThemeForUser(null));
    }
    if (user?.role !== 'admin') {
      if (activeView === 'addons') {
        setActiveView('board');
      }
      if (settingsInitialSection === 'addons') {
        setSettingsInitialSection('profile');
      }
    }
  };

  // Branding State
  const [appTitle, setAppTitle] = useState('SALGUEIRO STREAMING ANGOLA Online TV');
  const [heroImage, setHeroImage] = useState('/src/assets/images/hero_scifi_cyber_1794091825405.jpg');
  const [mediaDomainConfig, setMediaDomainConfig] = useState<MediaDomainConfig>(DEFAULT_MEDIA_DOMAIN_CONFIG);
  const [allUserDevices, setAllUserDevices] = useState<Record<string, UserDevice[]>>({});
  const [onlineSessionsRaw, setOnlineSessionsRaw] = useState<OnlinePresenceRecord[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());
  const [isCheckingDeadChannels, setIsCheckingDeadChannels] = useState(false);
  const [channelCleanupNotice, setChannelCleanupNotice] = useState<string | null>(null);
  const [sessionBlockedNotice, setSessionBlockedNotice] = useState<string | null>(null);
  const [channelLogoOverrides, setChannelLogoOverrides] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('salgueiro_channel_logos');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const channelLogoOverridesRef = useRef<Record<string, string>>(channelLogoOverrides);
  channelLogoOverridesRef.current = channelLogoOverrides;
  const [isSearchingChannelLogos, setIsSearchingChannelLogos] = useState(false);
  const autoCheckedChannelLogoKeysRef = useRef<Set<string>>(new Set());
  const [logoPickerChannel, setLogoPickerChannel] = useState<LiveChannel | null>(null);
  const [logoPickerQuery, setLogoPickerQuery] = useState('');
  const [logoPickerResults, setLogoPickerResults] = useState<ChannelLogoResult[]>([]);
  const [isSearchingSingleLogo, setIsSearchingSingleLogo] = useState(false);

  const [movieArtworkOverrides, setMovieArtworkOverrides] = useState<Record<string, MovieArtworkOverride>>(() => {
    try {
      const saved = localStorage.getItem('salgueiro_movie_artworks_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const movieArtworkOverridesRef = useRef<Record<string, MovieArtworkOverride>>(movieArtworkOverrides);
  movieArtworkOverridesRef.current = movieArtworkOverrides;
  const [isSearchingMovieArtworks, setIsSearchingMovieArtworks] = useState(false);
  const autoCheckedMovieIdsRef = useRef<Set<string>>(new Set());
  const [artworkPickerItem, setArtworkPickerItem] = useState<MediaItem | null>(null);

  // Dynamic Content States
  const [editingMovie, setEditingMovie] = useState<MediaItem | null>(null);

  const BLACKLISTED_MOVIE_IDS = [
    'custom-uploaded-1794481077881', // 12
    'custom-uploaded-1794481306465', // TEXTE
    'custom-uploaded-1794487986681', // RM
    'valkyrie-dawn',
    'night-hunter',
    'eclipse-ancients',
    'stranger-things',
    'wild-amazon',
    'fenix-sessao-internacional-2026',
    'project-hail-mary-2026',
    'spiderman-2026',
    'runner-2026',
    'resident-evil-2026',
    'heart-of-the-beast-2026',
    'the-wrecking-crew-2026',
    'the-uprising-2026',
    'tenzing-2026',
    'the-backrooms',
    'animals-2026',
    'below-2026',
    'verity-2026',
    'nocturne-2026',
    'mob-land-series',
  ];

  const isMovieBlacklisted = (item: { id?: string; title?: string; originalTitle?: string }) => {
    const idLower = (item.id || '').trim().toLowerCase();
    const titleLower = (item.title || '').trim().toLowerCase();
    const origLower = (item.originalTitle || '').trim().toLowerCase();

    if (BLACKLISTED_MOVIE_IDS.includes(item.id || '')) return true;
    if (titleLower === '12' || origLower === '12' || idLower === '12') return true;
    if (titleLower === 'texte' || origLower === 'texte' || titleLower === 'teste') return true;
    if (titleLower === 'rm' || origLower === 'rm') return true;
    if (titleLower.includes('valquíria') || titleLower.includes('valquiria') || origLower.includes('valkyrie')) return true;
    if (titleLower.includes('night hunter') || origLower.includes('night hunter')) return true;
    if (titleLower.includes('eclipse of the ancients') || origLower.includes('eclipse of the ancients')) return true;
    if (titleLower.includes('stranger things') || origLower.includes('stranger things')) return true;
    if (titleLower.includes('amazônia secreta') || titleLower.includes('amazonia secreta') || origLower.includes('secret amazon')) return true;
    if (titleLower.includes('sessão internacional hd') || titleLower.includes('sessao internacional hd')) return true;

    return false;
  };

  const [customUploadedMovies, setCustomUploadedMovies] = useState<MediaItem[]>([]);

  const [catalog, setCatalog] = useState<MediaItem[]>(() => {
    const deletedIds: string[] = JSON.parse(localStorage.getItem('salgueiro_deleted_ids') || '[]');
    const overrides: Record<string, MediaItem> = JSON.parse(localStorage.getItem('salgueiro_catalog_overrides') || '{}');

    const baseCatalog = ALL_MOVIES_CATALOG
      .filter((item) => !deletedIds.includes(item.id) && !isMovieBlacklisted(item))
      .map((item) => (overrides[item.id] ? { ...item, ...overrides[item.id] } : item));

    return baseCatalog;
  });
  const [liveChannels, setLiveChannels] = useState<LiveChannel[]>(INITIAL_LIVE_CHANNELS);
  const initialDates = getDefaultDatesForMonthlyPlan();
  const [systemUsers, setSystemUsers] = useState<any[]>([
    {
      name: 'António Salgueiro',
      email: 'antonio@salgueiro.ao',
      initial: 'AS',
      paymentDate: initialDates.paymentDate,
      expirationDate: initialDates.expirationDate,
      paymentStatus: 'Ativo',
    },
    {
      name: 'Maria Pinto',
      email: 'maria.p@streaming.ao',
      initial: 'MP',
      paymentDate: initialDates.paymentDate,
      expirationDate: initialDates.expirationDate,
      paymentStatus: 'Ativo',
    },
    {
      name: 'João Carlos',
      email: 'jcarlos@gmail.com',
      initial: 'JC',
      paymentDate: initialDates.paymentDate,
      expirationDate: initialDates.expirationDate,
      paymentStatus: 'Pendente',
    },
  ]);

  const UNRESPONSIVE_PATTERNS = [
    'mediafusion.elfhosted.com',
    'stiptv.ddns.me',
    'iptv-org.github.io',
    '45.162.64.114',
    'hdhub.thevolecitor.qzz.io',
    '50.7.120.34'
  ];

  const DEFAULT_IPTV_URLS: string[] = [];

  const [isFetchingIPTV, setIsFetchingIPTV] = useState(false);
  const [iptvUrls, setIptvUrls] = useState<string[]>(() => {
    // Clear previously stored default/demo lists to leave section clean for admin manual addition
    try {
      localStorage.removeItem('salgueiro_uploaded_iptv');
      localStorage.removeItem('salgueiro_iptv_urls');
    } catch {}
    return [];
  });

  // Blacklisted/Unresponsive Channels
  const [blacklistedIds, setBlacklistedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('salgueiro_blacklist');
    return saved ? JSON.parse(saved) : [];
  });

  // Watchlist (Library)
  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('salgueiro_library');
    if (saved) {
      try {
        const parsed: string[] = JSON.parse(saved);
        return parsed.filter(id => !BLACKLISTED_MOVIE_IDS.includes(id));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>(() =>
    CONTINUE_WATCHING_SAMPLE.filter(item => !isMovieBlacklisted(item.media))
  );

  const normalizeTextKey = (raw?: string) =>
    (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const normalizeStreamUrlKey = (raw?: string) => {
    let clean = (raw || '').trim();
    if (clean.startsWith('/api/proxy?') || clean.startsWith('/api/transcode?')) {
      try {
        const inner = new URL(clean, 'http://localhost').searchParams.get('url');
        if (inner) clean = inner;
      } catch {}
    }
    return clean.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
  };

  const deduplicateCatalogItems = (items: MediaItem[]): { unique: MediaItem[]; duplicateIds: string[] } => {
    const seenTitleType = new Set<string>();
    const seenUrls = new Set<string>();
    const unique: MediaItem[] = [];
    const duplicateIds: string[] = [];

    for (const item of items) {
      const titleKey = `${item.type}:${normalizeTextKey(item.title)}`;
      const urlKey = item.videoUrl ? normalizeStreamUrlKey(item.videoUrl) : '';
      const isDupTitle = Boolean(normalizeTextKey(item.title)) && seenTitleType.has(titleKey);
      const isDupUrl = Boolean(urlKey) && seenUrls.has(urlKey);

      if (isDupTitle || isDupUrl) {
        duplicateIds.push(item.id);
        continue;
      }
      if (normalizeTextKey(item.title)) seenTitleType.add(titleKey);
      if (urlKey) seenUrls.add(urlKey);
      unique.push(item);
    }
    return { unique, duplicateIds };
  };

  const deduplicateChannelsList = (channels: LiveChannel[]): { unique: LiveChannel[]; duplicateIds: string[] } => {
    const seenUrls = new Set<string>();
    const seenNames = new Set<string>();
    const unique: LiveChannel[] = [];
    const duplicateIds: string[] = [];

    for (const ch of channels) {
      const urlKey = normalizeStreamUrlKey(ch.videoUrl);
      const nameKey = normalizeTextKey(ch.name);
      const isDupUrl = Boolean(urlKey) && seenUrls.has(urlKey);
      const isDupName = Boolean(nameKey) && seenNames.has(nameKey);
      if (isDupUrl || isDupName) {
        duplicateIds.push(ch.id);
        continue;
      }
      if (urlKey) seenUrls.add(urlKey);
      if (nameKey) seenNames.add(nameKey);
      unique.push(ch);
    }
    return { unique, duplicateIds };
  };

  const serverCatalogMoviesRef = useRef<MediaItem[]>([]);
  const lastServerCatalogSigRef = useRef<string>('');
  const firestoreCatalogRef = useRef<{ movies: MediaItem[]; deletedIds: string[] }>({
    movies: [],
    deletedIds: [],
  });

  const buildServerCatalogSignature = (movies: MediaItem[]) =>
    movies
      .map((m) => `${m.id}:${m.videoUrl || ''}:${m.title || ''}:${m.year || ''}:${m.thumbnailUrl || ''}:${m.bannerUrl || ''}`)
      .join('|');

  const applyMergedCatalog = (
    firestoreMovies: MediaItem[],
    firestoreDeletedIds: string[],
    serverMovies: MediaItem[]
  ) => {
    const allDeletedSet = new Set([...firestoreDeletedIds, ...BLACKLISTED_MOVIE_IDS]);
    const baseCatalog = ALL_MOVIES_CATALOG.filter((item) => !allDeletedSet.has(item.id) && !isMovieBlacklisted(item));

    let localOverrides: Record<string, MediaItem> = {};
    try {
      localOverrides = JSON.parse(localStorage.getItem('salgueiro_catalog_overrides') || '{}');
    } catch {
      localOverrides = {};
    }

    const getUpdatedMs = (m: MediaItem): number => {
      const ts = (m as any)?.updatedAt ? Date.parse(String((m as any).updatedAt)) : 0;
      return Number.isFinite(ts) ? ts : 0;
    };
    const upsertIfNewer = (m: MediaItem) => {
      if (!m || !m.id || isMovieBlacklisted(m) || allDeletedSet.has(m.id)) return;
      const existing = combinedMap.get(m.id);
      if (!existing) {
        combinedMap.set(m.id, m);
        return;
      }
      const incomingTs = getUpdatedMs(m);
      const existingTs = getUpdatedMs(existing);
      if (incomingTs === 0 || incomingTs >= existingTs) {
        combinedMap.set(m.id, m);
      }
    };

    const combinedMap = new Map<string, MediaItem>();
    // 0. Local persisted edits first
    Object.values(localOverrides).forEach(upsertIfNewer);
    // 1. Server media domain vault movies (guaranteed persisted on the platform domain)
    serverMovies.forEach(upsertIfNewer);
    // 2. Overlay Firestore global catalog updates (only if equal or newer timestamp)
    firestoreMovies.forEach(upsertIfNewer);

    const updatedBase = baseCatalog.map((item) => combinedMap.get(item.id) || item);
    const customNew = Array.from(combinedMap.values()).filter(
      (m) => !ALL_MOVIES_CATALOG.some((base) => base.id === m.id)
    );

    const { unique } = deduplicateCatalogItems([...customNew, ...updatedBase]);
    setCatalog(unique);
    setCustomUploadedMovies(customNew);
  };

  // Real-time synchronization from Platform Media Domain + Firestore for all users across the platform
  useEffect(() => {
    // Register deleted IDs in local storage to prevent reappearance
    try {
      const storedDeleted: string[] = JSON.parse(localStorage.getItem('salgueiro_deleted_ids') || '[]');
      let updated = false;
      BLACKLISTED_MOVIE_IDS.forEach(id => {
        if (!storedDeleted.includes(id)) {
          storedDeleted.push(id);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem('salgueiro_deleted_ids', JSON.stringify(storedDeleted));
      }
    } catch {
      // ignore
    }

    const syncServerCatalog = () => {
      fetchServerCatalogMovies()
        .then((serverMovies) => {
          const nextSig = buildServerCatalogSignature(serverMovies);
          if (nextSig === lastServerCatalogSigRef.current && serverCatalogMoviesRef.current.length === serverMovies.length) {
            return;
          }
          lastServerCatalogSigRef.current = nextSig;
          serverCatalogMoviesRef.current = serverMovies;
          applyMergedCatalog(
            firestoreCatalogRef.current.movies,
            firestoreCatalogRef.current.deletedIds,
            serverMovies
          );
        })
        .catch(() => {});
    };

    syncServerCatalog();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncServerCatalog();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    const catalogSyncTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncServerCatalog();
      }
    }, 12000);

    const unsubscribeCatalog = subscribeToGlobalCatalog((firestoreMovies, firestoreDeletedIds) => {
      firestoreCatalogRef.current = { movies: firestoreMovies, deletedIds: firestoreDeletedIds };
      applyMergedCatalog(firestoreMovies, firestoreDeletedIds, serverCatalogMoviesRef.current);
    });

    const unsubscribeIptv = subscribeToGlobalIptv((globalUrls, globalFiles) => {
      if (globalUrls) {
        const cleaned = globalUrls.filter(u => !UNRESPONSIVE_PATTERNS.some(p => u.includes(p)));
        setIptvUrls(cleaned);
      }
      if (globalFiles && globalFiles.length > 0) {
        localStorage.setItem('salgueiro_uploaded_iptv', JSON.stringify(globalFiles));
        fetchIPTV();
      }
    });

    const unsubscribeUsers = subscribeToAllUserAccounts((accounts) => {
      if (accounts && accounts.length > 0) {
        setSystemUsers(prev => {
          const map = new Map<string, any>();
          prev.forEach(u => map.set(u.email.toLowerCase(), u));
          accounts.forEach(acc => {
            if (acc.email) {
              const key = acc.email.toLowerCase();
              const existing = map.get(key) || {};
              map.set(key, {
                ...existing,
                ...acc,
                initial: existing.initial || (acc.name ? acc.name.substring(0, 2).toUpperCase() : 'US'),
              });
            }
          });
          return Array.from(map.values());
        });

        setCurrentUser(prevUser => {
          if (!prevUser) return null;
          const match = accounts.find(a => a.email?.toLowerCase() === prevUser.email.toLowerCase());
          if (!match) return prevUser;
          if (
            prevUser.role !== 'admin' &&
            (match.accountActive === false || match.paymentStatus === 'Desativado')
          ) {
            localStorage.removeItem('salgueiro_current_user');
            setPlayingMedia(null);
            setPlayingChannel(null);
            setSessionBlockedNotice(
              'A sua conta foi desativada pelo administrador. Contacte a Linha de Atendimento (+244 923742598).'
            );
            return null;
          }
          const mergedAvatar =
            match.avatarUrl && !match.avatarUrl.includes('unsplash.com')
              ? match.avatarUrl
              : prevUser.role === 'admin' && (!prevUser.avatarUrl || prevUser.avatarUrl.includes('unsplash.com'))
              ? DEFAULT_ADMIN_AVATAR
              : prevUser.avatarUrl;
          const merged = {
            ...prevUser,
            accountActive: match.accountActive !== false,
            avatarUrl: mergedAvatar,
            paymentDate: match.paymentDate || prevUser.paymentDate,
            expirationDate: match.expirationDate || prevUser.expirationDate,
            paymentStatus: match.paymentStatus || prevUser.paymentStatus,
            planName: match.planName || prevUser.planName,
            monthlyPrice: match.monthlyPrice || prevUser.monthlyPrice,
            paymentMethod: match.paymentMethod || prevUser.paymentMethod,
          };
          localStorage.setItem('salgueiro_current_user', JSON.stringify(merged));
          return merged;
        });
      }
    });

    const unsubscribeDevices = subscribeToAllUserDevices((map) => {
      setAllUserDevices(map);
    });

    const unsubscribeGlobalPlatform = subscribeToGlobalPlatformConfig((cfg) => {
      if (typeof cfg.appTitle === 'string' && cfg.appTitle.trim()) {
        setAppTitle(cfg.appTitle.trim());
      }
      if (typeof cfg.heroImage === 'string' && cfg.heroImage.trim()) {
        setHeroImage(cfg.heroImage.trim());
      }
      if (cfg.preferredTheme && isValidPlatformTheme(cfg.preferredTheme)) {
        setPlatformTheme(cfg.preferredTheme);
        saveThemeForUser(cfg.preferredTheme, currentUser?.email);
      }
      if (Array.isArray(cfg.blacklistedChannelIds)) {
        setBlacklistedIds(cfg.blacklistedChannelIds);
      }
      if (cfg.channelLogos && typeof cfg.channelLogos === 'object') {
        setChannelLogoOverrides((prev) => {
          const merged = { ...prev, ...cfg.channelLogos };
          try {
            localStorage.setItem('salgueiro_channel_logos', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (cfg.movieArtworks && typeof cfg.movieArtworks === 'object') {
        setMovieArtworkOverrides((prev) => {
          const merged = { ...prev, ...(cfg.movieArtworks as Record<string, MovieArtworkOverride>) };
          try {
            localStorage.setItem('salgueiro_movie_artworks_v1', JSON.stringify(merged));
          } catch {}
          return merged;
        });
      }
      if (Array.isArray(cfg.installedAddons)) {
        setInstalledAddons(cfg.installedAddons);
      }
    });

    fetchServerChannelLogos()
      .then((serverLogos) => {
        if (serverLogos && Object.keys(serverLogos).length > 0) {
          setChannelLogoOverrides((prev) => {
            const merged = { ...serverLogos, ...prev };
            try {
              localStorage.setItem('salgueiro_channel_logos', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    fetchServerMovieArtworks()
      .then((serverArtworks) => {
        if (serverArtworks && Object.keys(serverArtworks).length > 0) {
          setMovieArtworkOverrides((prev) => {
            const merged = { ...serverArtworks, ...prev };
            try {
              localStorage.setItem('salgueiro_movie_artworks_v1', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      })
      .catch(() => {});

    fetchMediaDomainConfig()
      .then((cfg) => setMediaDomainConfig(cfg))
      .catch(() => {});

    const unsubscribeMediaDomain = subscribeToMediaDomainConfig((cfg) => {
      setMediaDomainConfig((prev) => ({
        ...prev,
        ...cfg,
      }));
    });

    const unsubscribeRecycleBin = subscribeToRecycleBin((items) => {
      setRecycledItems(items);
    });

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.clearInterval(catalogSyncTimer);
      unsubscribeCatalog();
      unsubscribeIptv();
      unsubscribeUsers();
      unsubscribeDevices();
      unsubscribeGlobalPlatform();
      unsubscribeMediaDomain();
      unsubscribeRecycleBin();
    };
  }, []);

  // Real-time enforcement if the admin disables the currently connected device
  useEffect(() => {
    if (!currentUser?.email || currentUser.role === 'admin') return;
    const currentId = getCurrentDeviceId();
    const unsub = subscribeToUserDevicesByEmail(currentUser.email, (devices) => {
      const thisDev = devices.find((d) => d.id === currentId);
      if (thisDev && thisDev.enabled === false) {
        updateCurrentUser(null);
        setPlayingMedia(null);
        setPlayingChannel(null);
        setSessionBlockedNotice(
          'Este dispositivo foi desativado pelo administrador. A sessão foi terminada.'
        );
      }
    });
    return () => unsub();
  }, [currentUser?.email, currentUser?.role]);

  // Real-time online presence heartbeat (records user/guest, location & province)
  const presenceSessionIdRef = useRef<string>('');
  const geoLocationRef = useRef<{ city: string; province: string; country: string }>({
    city: 'Luanda',
    province: 'Luanda',
    country: 'Angola',
  });

  useEffect(() => {
    let sid = sessionStorage.getItem('salgueiro_presence_sid') || '';
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('salgueiro_presence_sid', sid);
    }
    presenceSessionIdRef.current = sid;

    fetch('/api/presence/geo')
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (geo && geo.province) {
          geoLocationRef.current = {
            city: String(geo.city || 'Luanda'),
            province: String(geo.province || 'Luanda'),
            country: String(geo.country || 'Angola'),
          };
        }
      })
      .catch(() => {});

    const handleUnload = () => {
      if (presenceSessionIdRef.current) {
        void removeOnlinePresence(presenceSessionIdRef.current);
        try {
          navigator.sendBeacon?.(
            '/api/presence/leave',
            new Blob([JSON.stringify({ sessionId: presenceSessionIdRef.current })], {
              type: 'application/json',
            })
          );
        } catch {}
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  const [serverOnlineSessions, setServerOnlineSessions] = useState<OnlinePresenceRecord[]>([]);

  useEffect(() => {
    const sid = presenceSessionIdRef.current || sessionStorage.getItem('salgueiro_presence_sid');
    if (!sid) return;
    presenceSessionIdRef.current = sid;

    const getActivityLabel = () => {
      if (playingChannel) return `A ver TV: ${playingChannel.name}`;
      if (playingMedia) return `A ver: ${playingMedia.title}`;
      switch (activeView) {
        case 'live_tv':
          return 'TV em Direto';
        case 'international_movies':
        case 'national_movies':
          return 'Filmes';
        case 'series':
          return 'Séries';
        case 'discover':
          return 'Descobrir';
        case 'library':
          return 'Favoritos';
        case 'addons':
          return 'Addons';
        case 'settings':
          return 'Painel / Ajustes';
        default:
          return 'Início';
      }
    };

    const detectDeviceSummary = () => {
      const ua = navigator.userAgent || '';
      if (/SmartTV|SMART-TV|Tizen|Web0S|Android TV/i.test(ua)) return 'Smart TV';
      if (/Android|iPhone|iPad|Mobile/i.test(ua)) return 'Mobile / Tablet';
      return 'Computador Web';
    };

    const pushHeartbeat = () => {
      const loc = geoLocationRef.current;
      const payload: OnlinePresenceRecord = {
        sessionId: sid,
        email: currentUser?.email || '',
        userName: currentUser?.name || 'Visitante Angola',
        role: currentUser?.role || 'guest',
        isGuest: !currentUser,
        deviceName: detectDeviceSummary(),
        city: loc.city,
        province: loc.province,
        country: loc.country,
        currentView: getActivityLabel(),
        lastSeenMs: Date.now(),
        startedAt: sessionStorage.getItem('salgueiro_presence_started') || new Date().toISOString(),
      };
      void upsertOnlinePresence(payload);
      fetch('/api/presence/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    };

    if (!sessionStorage.getItem('salgueiro_presence_started')) {
      sessionStorage.setItem('salgueiro_presence_started', new Date().toISOString());
    }

    pushHeartbeat();
    const interval = window.setInterval(pushHeartbeat, 20000);
    return () => window.clearInterval(interval);
  }, [currentUser?.email, currentUser?.name, currentUser?.role, activeView, playingMedia?.id, playingChannel?.id]);

  // Admin real-time listener (merges Firestore online_presence + server presence)
  useEffect(() => {
    if (currentUser?.role !== 'admin') {
      setOnlineSessionsRaw([]);
      setServerOnlineSessions([]);
      return;
    }

    const fetchServerPresence = () => {
      fetch('/api/presence/online')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.sessions)) {
            setServerOnlineSessions(data.sessions as OnlinePresenceRecord[]);
            setPresenceNowMs(Date.now());
          }
        })
        .catch(() => {});
    };

    fetchServerPresence();
    const unsub = subscribeToOnlinePresence((sessions) => {
      setOnlineSessionsRaw(sessions);
      setPresenceNowMs(Date.now());
    });
    const serverPoll = window.setInterval(fetchServerPresence, 8000);
    const tick = window.setInterval(() => setPresenceNowMs(Date.now()), 10000);
    return () => {
      unsub();
      window.clearInterval(serverPoll);
      window.clearInterval(tick);
    };
  }, [currentUser?.role]);

  const activeOnlineUsers = React.useMemo(() => {
    const mergedMap = new Map<string, OnlinePresenceRecord>();
    [...onlineSessionsRaw, ...serverOnlineSessions].forEach((sess) => {
      if (!sess || !sess.sessionId || typeof sess.lastSeenMs !== 'number') return;
      if (presenceNowMs - sess.lastSeenMs >= 85000) return;
      const prev = mergedMap.get(sess.sessionId);
      if (!prev || sess.lastSeenMs >= prev.lastSeenMs) {
        mergedMap.set(sess.sessionId, sess);
      }
    });
    return Array.from(mergedMap.values()).sort((a, b) => b.lastSeenMs - a.lastSeenMs);
  }, [onlineSessionsRaw, serverOnlineSessions, presenceNowMs]);

  useEffect(() => {
    // Purge unresponsive URLs from localStorage and populate uploaded playlists
    const saved = localStorage.getItem('salgueiro_iptv_urls');
    if (saved) {
      try {
        const urls: string[] = JSON.parse(saved);
        const filtered = urls.filter(u => !UNRESPONSIVE_PATTERNS.some(p => u.includes(p)));
        const finalUrls = filtered.length > 0 ? filtered : DEFAULT_IPTV_URLS;
        localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(finalUrls));
        if (JSON.stringify(finalUrls) !== JSON.stringify(iptvUrls)) {
          setIptvUrls(finalUrls);
        }
      } catch {
        localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(DEFAULT_IPTV_URLS));
        setIptvUrls(DEFAULT_IPTV_URLS);
      }
    } else {
      localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(DEFAULT_IPTV_URLS));
    }
  }, []);

  const directM3uInputRef = useRef<HTMLInputElement>(null);
  const [lastUploadedIptvNotice, setLastUploadedIptvNotice] = useState<{ name: string; count: number } | null>(null);

  // Direct upload for M3U / M3U8 list from Live TV page
  const handleDirectM3UUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseM3U(content);
        const newFile = {
          id: `iptv-file-${Date.now()}`,
          name: file.name,
          content: content,
          channelCount: parsed.length,
          uploadedAt: new Date().toLocaleDateString('pt-AO'),
        };
        let prevFiles: any[] = [];
        try {
          const saved = localStorage.getItem('salgueiro_uploaded_iptv');
          if (saved) prevFiles = JSON.parse(saved);
        } catch {}
        const updatedFiles = [...prevFiles, newFile];
        localStorage.setItem('salgueiro_uploaded_iptv', JSON.stringify(updatedFiles));
        setLastUploadedIptvNotice({ name: file.name, count: parsed.length });
        window.dispatchEvent(new CustomEvent('salgueiro:iptv-updated'));
        void fetchIPTV();
        await syncIptvToGlobal(iptvUrls, updatedFiles, currentUser?.email || 'admin').catch(() => {});
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Fetch IPTV Lists with full support for uploaded .m3u / .m3u8 files
  const fetchIPTV = async () => {
    setIsFetchingIPTV(true);
    let uploadedChannels: LiveChannel[] = [];
    let urlChannels: LiveChannel[] = [];
    let addonChannels: LiveChannel[] = [];
    
    try {
      // 1. Process File-based lists FIRST (Uploaded M3U / M3U8 files by admin have absolute priority)
      const uploadedSaved = localStorage.getItem('salgueiro_uploaded_iptv');
      if (uploadedSaved) {
        try {
          const uploaded = JSON.parse(uploadedSaved);
          if (Array.isArray(uploaded)) {
            for (const item of uploaded) {
              try {
                if (item.content) {
                  const parsed = parseM3U(item.content);
                  uploadedChannels = [...uploadedChannels, ...parsed];
                }
              } catch (err) {
                console.warn(`Failed to parse uploaded list ${item.name}:`, err);
              }
            }
          }
        } catch (err) {
          console.warn('Failed to parse salgueiro_uploaded_iptv:', err);
        }
      }

      // 2. Process URL-based lists (using bundled local playlists when available)
      for (const url of iptvUrls) {
        try {
          if (BUNDLED_M3U_PLAYLISTS[url]) {
            const parsed = parseM3U(BUNDLED_M3U_PLAYLISTS[url]);
            urlChannels = [...urlChannels, ...parsed];
          } else {
            let response: Response | null = null;
            const isRemoteHttp = url.startsWith('http://') || url.startsWith('https://');
            if (url.startsWith('https://') || url.startsWith('/')) {
              try {
                response = await fetch(url);
              } catch {
                response = null;
              }
            }
            if ((!response || !response.ok) && isRemoteHttp) {
              response = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`);
            }
            if (!response || !response.ok) {
              console.warn(`IPTV source unavailable (${response?.status ?? 'network'}): ${url}`);
              continue;
            }
            const data = await response.text();
            // Check if it's an M3U / M3U8 playlist or a direct stream
            if (data.includes('#EXTM3U') || data.includes('#EXTINF') || data.includes('http')) {
              const parsed = parseM3U(data);
              if (parsed.length > 0) {
                urlChannels = [...urlChannels, ...parsed];
              } else if (url.endsWith('.m3u8')) {
                urlChannels.push({
                  id: `manual-${url}`,
                  name: url.includes('CARTOON') ? 'Cartoon Network' : 'Live Stream',
                  logo: '/src/assets/images/live_sports_stadium_1794091825611.jpg',
                  category: 'Variedades',
                  currentShow: 'Programação ao vivo',
                  nextShow: 'A seguir',
                  progressPercentage: 50,
                  viewers: '1k',
                  schedule: [],
                  videoUrl: url,
                  channelNumber: urlChannels.length + 1000,
                });
              }
            } else if (url.endsWith('.m3u8')) {
              urlChannels.push({
                id: `manual-${url}`,
                name: url.includes('CARTOON') ? 'Cartoon Network' : 'Live Stream',
                logo: '/src/assets/images/live_sports_stadium_1794091825611.jpg',
                category: 'Variedades',
                currentShow: 'Programação ao vivo',
                nextShow: 'A seguir',
                progressPercentage: 50,
                viewers: '1k',
                schedule: [],
                videoUrl: url,
                channelNumber: urlChannels.length + 1000,
              });
            }
          }
        } catch (err) {
          console.warn(`IPTV fetch skipped for ${url}:`, err instanceof Error ? err.message : err);
        }
      }

      // 3. Process installed Stremio live TV addon channels
      try {
        addonChannels = await fetchAllInstalledLiveChannels(installedAddons);
      } catch (err) {
        console.warn('Addon live channels fetch notice:', err);
      }
      
      // Combine with uploaded channels first so all uploaded channels are immediately shown, with up to 4000 channels
      const allCombined = [...uploadedChannels, ...urlChannels, ...addonChannels];
      const limitedChannels = allCombined.slice(0, 4000);
      const { unique: dedupedChannels } = deduplicateChannelsList([...INITIAL_LIVE_CHANNELS, ...limitedChannels]);
      setLiveChannels(dedupedChannels);
    } catch (error) {
      console.warn('IPTV list processing notice:', error);
    } finally {
      setIsFetchingIPTV(false);
    }
  };

  useEffect(() => {
    fetchIPTV();
  }, [iptvUrls]);

  // Listen for storage changes and custom events from SettingsView and live_tv
  useEffect(() => {
    const handleStorageChange = () => void fetchIPTV();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('salgueiro:iptv-updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('salgueiro:iptv-updated', handleStorageChange);
    };
  }, [iptvUrls]);


  useEffect(() => {
    localStorage.setItem('salgueiro_library', JSON.stringify(watchlistIds));
  }, [watchlistIds]);

  useEffect(() => {
    localStorage.setItem('salgueiro_blacklist', JSON.stringify(blacklistedIds));
  }, [blacklistedIds]);

  const isInWatchlist = (id: string) => watchlistIds.includes(id);

  const toggleWatchlist = (e: React.MouseEvent | null, item: MediaItem) => {
    if (e) e.stopPropagation();
    setWatchlistIds(prev => 
      prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
    );
  };

  const blacklistChannelsGlobally = async (idsToAdd: string[]) => {
    if (idsToAdd.length === 0) return;

    // Archive removed channels to recycle bin for administrator recovery
    const channelsToRecycle = liveChannels.filter((c) => idsToAdd.includes(c.id));
    if (channelsToRecycle.length > 0) {
      await Promise.allSettled(
        channelsToRecycle.map((ch) =>
          addRecycleBinItem({
            id: `recycle_channel_${ch.id}`,
            originalId: ch.id,
            type: 'channel',
            title: ch.name,
            subtitle: `Canal ${ch.channelNumber || ''} • ${ch.category || 'TV ao Vivo'}`,
            thumbnailUrl: ch.logo,
            category: 'Canal de TV em Direto',
            data: ch,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser?.email || 'admin',
          })
        )
      );
    }

    const nextBlacklist = Array.from(new Set([...blacklistedIds, ...idsToAdd]));
    setBlacklistedIds(nextBlacklist);
    localStorage.setItem('salgueiro_blacklist', JSON.stringify(nextBlacklist));
    if (selectedItem && idsToAdd.includes(selectedItem.id)) setSelectedItem(null);
    if (playingChannel && idsToAdd.includes(playingChannel.id)) setPlayingChannel(null);
    if (currentUser?.role === 'admin') {
      await saveGlobalPlatformConfigToFirestore(
        { blacklistedChannelIds: nextBlacklist },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleRemoveChannel = (e: React.MouseEvent, channelId: string) => {
    e.stopPropagation();
    void blacklistChannelsGlobally([channelId]);
  };

  const handleItemClick = (item: MediaItem) => {
    setSelectedItem(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePlay = (item: MediaItem) => {
    if (item.type === 'live_tv') {
       const channel = liveChannels.find(c => c.id === item.id);
       if (channel) {
         setPlayingChannel(channel);
         setPlayingMedia(null);
       } else if (item.videoUrl) {
         setPlayingMedia(item);
         setPlayingChannel(null);
       } else {
         setSelectedItem(item);
         window.scrollTo({ top: 0, behavior: 'smooth' });
       }
    } else if (!item.videoUrl) {
       // Item without direct stream link: open details/sources selector
       setSelectedItem(item);
       window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
       setPlayingMedia(item);
       setPlayingChannel(null);
       
       if (!continueWatching.some(cw => cw.media.id === item.id)) {
          setContinueWatching([{
             media: item,
             percentage: 0,
             remainingMinutes: 120
          }, ...continueWatching]);
       }
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      setIsSearchOpen(true);
    }
  };

  const handleUploadMovie = async (newMovie: MediaItem) => {
    const detectedAsSeries = newMovie.type === 'series' || isDetectedSeriesItem(newMovie);
    const normalizedMovie: MediaItem = detectedAsSeries
      ? { ...newMovie, type: 'series', stremioType: 'series' }
      : newMovie;

    // 1. Optimistic local update
    serverCatalogMoviesRef.current = [
      normalizedMovie,
      ...serverCatalogMoviesRef.current.filter((m) => m.id !== normalizedMovie.id),
    ];
    lastServerCatalogSigRef.current = buildServerCatalogSignature(serverCatalogMoviesRef.current);
    applyMergedCatalog(
      firestoreCatalogRef.current.movies,
      firestoreCatalogRef.current.deletedIds,
      serverCatalogMoviesRef.current
    );

    setActiveView(detectedAsSeries ? 'series' : 'international_movies');
    setSelectedItem(null);

    // 2. Persist in the platform media domain AND broadcast to Firestore for ALL users
    const [serverResult, firestoreResult] = await Promise.allSettled([
      saveServerCatalogMovie(normalizedMovie),
      syncMovieToGlobalCatalog(normalizedMovie, currentUser?.email || 'admin'),
    ]);

    if (serverResult.status === 'rejected') {
      console.error('Failed to save movie to platform domain catalog:', serverResult.reason);
      throw serverResult.reason;
    }
    if (firestoreResult.status === 'rejected') {
      console.error('Failed to sync uploaded movie to global Firestore:', firestoreResult.reason);
    }

    // 3. Pre-warm vault file & best server ranking so first playback starts instantly
    if (newMovie.videoUrl) {
      warmUpPlaybackTarget(newMovie.videoUrl);
      void findBestPlaybackServers({
        title: newMovie.title,
        originalTitle: newMovie.originalTitle,
        type: newMovie.type === 'series' ? 'series' : 'movie',
        year: newMovie.year,
        currentUrl: newMovie.videoUrl,
        searchWeb: false,
      }).catch(() => {});
    }
  };

  const handleOpenAdminUpload = () => {
    if (currentUser?.role === 'admin') {
      setEditingMovie(null);
      setIsAdminUploadOpen(true);
    } else {
      setIsLoginOpen(true);
    }
  };

  const handleOpenEditMovie = (movie: MediaItem) => {
    if (currentUser?.role === 'admin') {
      setEditingMovie(movie);
      setIsAdminUploadOpen(true);
    } else {
      setIsLoginOpen(true);
    }
  };

  const handleUpdateMovie = async (updatedMovie: MediaItem) => {
    const stampedMovie: MediaItem = {
      ...updatedMovie,
      updatedAt: new Date().toISOString(),
    } as MediaItem;

    // 1. Update in-memory catalog & server ref
    serverCatalogMoviesRef.current = [
      stampedMovie,
      ...serverCatalogMoviesRef.current.filter((m) => m.id !== stampedMovie.id),
    ];
    lastServerCatalogSigRef.current = buildServerCatalogSignature(serverCatalogMoviesRef.current);
    setCatalog((prev) => prev.map((m) => (m.id === stampedMovie.id ? stampedMovie : m)));

    // 2. Update custom uploaded list if applicable
    if (customUploadedMovies.some((m) => m.id === stampedMovie.id)) {
      const updatedCustom = customUploadedMovies.map((m) => (m.id === stampedMovie.id ? stampedMovie : m));
      setCustomUploadedMovies(updatedCustom);
    }

    // 3. Always persist latest override locally so stale cache never reverts videoUrl or metadata edits
    try {
      const overrides: Record<string, MediaItem> = JSON.parse(localStorage.getItem('salgueiro_catalog_overrides') || '{}');
      overrides[stampedMovie.id] = stampedMovie;
      localStorage.setItem('salgueiro_catalog_overrides', JSON.stringify(overrides));
    } catch {
      // ignore storage quota failure
    }

    // 4. Sync thumbnailUrl & bannerUrl into movieArtworkOverrides so resolvedCatalog never serves stale auto artwork
    if (stampedMovie.thumbnailUrl || stampedMovie.bannerUrl) {
      await persistMovieArtworksMap({
        [stampedMovie.id]: {
          thumbnailUrl: stampedMovie.thumbnailUrl || stampedMovie.bannerUrl,
          bannerUrl: stampedMovie.bannerUrl || stampedMovie.thumbnailUrl,
          originalTitle: stampedMovie.originalTitle,
          source: 'Seleção do Administrador',
        },
      }).catch(() => {});
    }

    // 5. Update currently viewed item if open
    if (selectedItem?.id === stampedMovie.id) {
      setSelectedItem(stampedMovie);
    }
    if (playingMedia?.id === stampedMovie.id) {
      setPlayingMedia(stampedMovie);
    }

    // 6. Persist in platform domain catalog AND broadcast to Firestore for ALL users
    await Promise.allSettled([
      saveServerCatalogMovie(stampedMovie),
      syncMovieToGlobalCatalog(stampedMovie, currentUser?.email || 'admin'),
    ]);

    if (stampedMovie.videoUrl) {
      warmUpPlaybackTarget(stampedMovie.videoUrl);
    }
  };

  const handleApplyPickedArtwork = async (
    item: MediaItem,
    thumbnailUrl: string,
    bannerUrl: string,
    extraMeta?: {
      title?: string;
      originalTitle?: string;
      source?: string;
      synopsis?: string;
      imdbScore?: number;
      year?: number;
    }
  ) => {
    const nextTitle = extraMeta?.title?.trim() || item.title;
    const nextOriginalTitle = extraMeta?.originalTitle?.trim() || item.originalTitle || nextTitle;
    const nextYear =
      extraMeta?.year && Number(extraMeta.year) > 1900
        ? Number(extraMeta.year)
        : item.year || 2026;
    const updatedItem: MediaItem = {
      ...item,
      title: nextTitle,
      originalTitle: nextOriginalTitle,
      thumbnailUrl,
      bannerUrl: bannerUrl || thumbnailUrl,
      synopsis: item.synopsis || extraMeta?.synopsis || '',
      imdbScore: item.imdbScore || extraMeta?.imdbScore || 7.8,
      year: nextYear,
    };
    await persistMovieArtworksMap({
      [item.id]: {
        thumbnailUrl: updatedItem.thumbnailUrl,
        bannerUrl: updatedItem.bannerUrl,
        originalTitle: updatedItem.originalTitle,
        source: extraMeta?.source || 'Seleção do Administrador',
      },
    });
    await handleUpdateMovie(updatedItem);
  };

  const handleDeleteMovie = async (id: string) => {
    // 0. Archive to Recycle Bin before removing
    const movieToRecycle =
      catalog.find((m) => m.id === id) ||
      serverCatalogMoviesRef.current.find((m) => m.id === id) ||
      customUploadedMovies.find((m) => m.id === id);

    if (movieToRecycle) {
      const recycled: RecycledItem = {
        id: `recycle_movie_${movieToRecycle.id}`,
        originalId: movieToRecycle.id,
        type: movieToRecycle.type === 'series' ? 'series' : 'movie',
        title: movieToRecycle.title,
        subtitle: `${movieToRecycle.year || ''} • ${movieToRecycle.duration || ''} • ${movieToRecycle.genres?.join(', ') || ''}`.trim(),
        thumbnailUrl: movieToRecycle.thumbnailUrl || movieToRecycle.bannerUrl,
        category: movieToRecycle.type === 'series' ? 'Série' : 'Filme',
        data: movieToRecycle,
        deletedAt: new Date().toISOString(),
        deletedBy: currentUser?.email || 'admin',
      };
      await addRecycleBinItem(recycled);
    }

    // 1. Remove from active catalog state & server ref
    serverCatalogMoviesRef.current = serverCatalogMoviesRef.current.filter((m) => m.id !== id);
    setCatalog((prev) => prev.filter((m) => m.id !== id));

    // 2. Remove from customUploadedMovies if present
    const updatedCustom = customUploadedMovies.filter((m) => m.id !== id);
    setCustomUploadedMovies(updatedCustom);

    // 3. Persist in deleted IDs to prevent base catalog re-emergence
    const deletedIds: string[] = JSON.parse(localStorage.getItem('salgueiro_deleted_ids') || '[]');
    if (!deletedIds.includes(id)) {
      deletedIds.push(id);
      localStorage.setItem('salgueiro_deleted_ids', JSON.stringify(deletedIds));
    }

    // 4. Close details or player if active
    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
    if (playingMedia?.id === id) {
      setPlayingMedia(null);
    }

    // 5. Remove from platform domain catalog AND broadcast deletion to Firestore
    await Promise.allSettled([
      deleteServerCatalogMovie(id),
      deleteMovieFromGlobalCatalog(id, currentUser?.email || 'admin'),
    ]);
  };

  const isInternationalMovieItem = (i: MediaItem) =>
    i.type !== 'live_tv' && (i.genres.includes('Internacional') || !i.audio.some((a) => a.includes('Angola')));

  const handleClearAllInternationalMovies = async () => {
    const toRemove = catalog.filter(isInternationalMovieItem);
    const removeIds = new Set(toRemove.map((m) => m.id));
    if (removeIds.size > 0) {
      // Archive to Recycle Bin before clearing
      await Promise.allSettled(
        toRemove.map((m) =>
          addRecycleBinItem({
            id: `recycle_movie_${m.id}`,
            originalId: m.id,
            type: m.type === 'series' ? 'series' : 'movie',
            title: m.title,
            subtitle: `${m.year || ''} • ${m.duration || ''} • ${m.genres?.join(', ') || ''}`.trim(),
            thumbnailUrl: m.thumbnailUrl || m.bannerUrl,
            category: m.type === 'series' ? 'Série' : 'Filme',
            data: m,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser?.email || 'admin',
          })
        )
      );

      serverCatalogMoviesRef.current = serverCatalogMoviesRef.current.filter((m) => !removeIds.has(m.id));
      setCatalog((prev) => prev.filter((m) => !removeIds.has(m.id)));
      setCustomUploadedMovies((prev) => prev.filter((m) => !removeIds.has(m.id)));

      const deletedIds: string[] = JSON.parse(localStorage.getItem('salgueiro_deleted_ids') || '[]');
      removeIds.forEach((id) => {
        if (!deletedIds.includes(id)) deletedIds.push(id);
      });
      localStorage.setItem('salgueiro_deleted_ids', JSON.stringify(deletedIds));

      if (selectedItem && removeIds.has(selectedItem.id)) setSelectedItem(null);
      if (playingMedia && removeIds.has(playingMedia.id)) setPlayingMedia(null);

      await Promise.allSettled(
        Array.from(removeIds).flatMap((id) => [
          deleteServerCatalogMovie(id),
          deleteMovieFromGlobalCatalog(id, currentUser?.email || 'admin'),
        ])
      );
    }

    setInstalledAddons([]);
    if (currentUser?.role === 'admin') {
      await saveGlobalPlatformConfigToFirestore(
        { installedAddons: [] },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleSyncAddons = (nextAddons: InstalledStremioAddon[]) => {
    // Archive uninstalled addons to Recycle Bin
    const removedAddons = installedAddons.filter(
      (a) => !nextAddons.some((next) => next.transportUrl === a.transportUrl)
    );
    if (removedAddons.length > 0) {
      void Promise.allSettled(
        removedAddons.map((addon) =>
          addRecycleBinItem({
            id: `recycle_addon_${encodeURIComponent(addon.transportUrl).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
            originalId: addon.transportUrl,
            type: 'addon',
            title: addon.manifest?.name || 'Addon',
            subtitle: `v${addon.manifest?.version || '1.0'} • ${addon.transportUrl}`,
            thumbnailUrl: addon.manifest?.logo || (addon.manifest as any)?.icon,
            category: 'Addon Stremio',
            data: addon,
            deletedAt: new Date().toISOString(),
            deletedBy: currentUser?.email || 'admin',
          })
        )
      );
    }

    setInstalledAddons(nextAddons);
    if (currentUser?.role === 'admin') {
      saveGlobalPlatformConfigToFirestore(
        { installedAddons: nextAddons },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleRestoreRecycledItem = async (item: RecycledItem) => {
    try {
      if (item.type === 'movie' || item.type === 'series') {
        const movie: MediaItem = item.data;
        // 1. Remove tombstone from deleted_content in Firestore
        await removeDeletedContentTombstone(item.originalId);

        // 2. Remove from salgueiro_deleted_ids in localStorage
        const deletedIds: string[] = JSON.parse(localStorage.getItem('salgueiro_deleted_ids') || '[]');
        const updatedDeletedIds = deletedIds.filter((id) => id !== item.originalId);
        localStorage.setItem('salgueiro_deleted_ids', JSON.stringify(updatedDeletedIds));

        // 3. Put back in serverCatalogMoviesRef & state catalog
        serverCatalogMoviesRef.current = [
          movie,
          ...serverCatalogMoviesRef.current.filter((m) => m.id !== movie.id),
        ];
        setCatalog((prev) => [movie, ...prev.filter((m) => m.id !== movie.id)]);

        // 4. Sync to Firestore & server
        await Promise.allSettled([
          saveServerCatalogMovie(movie),
          syncMovieToGlobalCatalog(movie, currentUser?.email || 'admin'),
        ]);
      } else if (item.type === 'channel') {
        const channel: LiveChannel = item.data;
        // 1. Remove from blacklist state & localStorage
        const nextBlacklist = blacklistedIds.filter((id) => id !== item.originalId);
        setBlacklistedIds(nextBlacklist);
        localStorage.setItem('salgueiro_blacklist', JSON.stringify(nextBlacklist));

        // 2. Put channel back in liveChannels
        if (channel && channel.name) {
          setLiveChannels((prev) => {
            if (prev.some((c) => c.id === channel.id)) return prev;
            return [channel, ...prev];
          });
        }

        // 3. Update Firestore global config
        if (currentUser?.role === 'admin') {
          await saveGlobalPlatformConfigToFirestore(
            { blacklistedChannelIds: nextBlacklist },
            currentUser.email
          ).catch(() => {});
        }
      } else if (item.type === 'addon') {
        const addon: InstalledStremioAddon = item.data;
        if (addon && addon.transportUrl) {
          const nextAddons = [addon, ...installedAddons.filter((a) => a.transportUrl !== addon.transportUrl)];
          setInstalledAddons(nextAddons);
          saveInstalledAddons(nextAddons);
          if (currentUser?.role === 'admin') {
            await saveGlobalPlatformConfigToFirestore(
              { installedAddons: nextAddons },
              currentUser.email
            ).catch(() => {});
          }
        }
      } else if (item.type === 'iptv_url') {
        const url: string = item.data?.url || item.originalId;
        if (url && !iptvUrls.includes(url)) {
          const nextUrls = [...iptvUrls, url];
          setIptvUrls(nextUrls);
          localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(nextUrls));
          const uploaded = JSON.parse(localStorage.getItem('salgueiro_uploaded_iptv') || '[]');
          await syncIptvToGlobal(nextUrls, uploaded, currentUser?.email || 'admin').catch(() => {});
          fetchIPTV();
        }
      } else if (item.type === 'iptv_file') {
        const fileObj = item.data;
        if (fileObj) {
          const currentFiles = JSON.parse(localStorage.getItem('salgueiro_uploaded_iptv') || '[]');
          const nextFiles = [...currentFiles.filter((f: any) => f.id !== fileObj.id), fileObj];
          localStorage.setItem('salgueiro_uploaded_iptv', JSON.stringify(nextFiles));
          await syncIptvToGlobal(iptvUrls, nextFiles, currentUser?.email || 'admin').catch(() => {});
          fetchIPTV();
        }
      } else if (item.type === 'config') {
        if (item.data?.appTitle || item.data?.heroImage) {
          await handleSaveBrandingGlobal(
            item.data.appTitle || appTitle,
            item.data.heroImage || heroImage
          );
        }
        if (item.data?.mediaDomainConfig) {
          setMediaDomainConfig(item.data.mediaDomainConfig);
          await saveMediaDomainConfigToFirestore(
            item.data.mediaDomainConfig,
            currentUser?.email || 'admin'
          ).catch(() => {});
        }
      }

      // 5. Remove from recycle bin
      await restoreRecycleBinItem(item.id);
      setRecycledItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err) {
      console.error('Failed to restore recycled item:', err);
      throw err;
    }
  };

  const handlePermanentDeleteRecycledItem = async (itemId: string) => {
    await permanentDeleteRecycleBinItem(itemId);
    setRecycledItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const handleEmptyRecycleBin = async () => {
    const ids = recycledItems.map((i) => i.id);
    await emptyRecycleBin(ids);
    setRecycledItems([]);
  };

  const handleSaveBrandingGlobal = async (nextTitle: string, nextHero: string) => {
    setAppTitle(nextTitle);
    setHeroImage(nextHero);
    await saveGlobalPlatformConfigToFirestore(
      { appTitle: nextTitle, heroImage: nextHero },
      currentUser?.email || 'admin'
    ).catch(() => {});
  };

  const handleSubtitleGenerated = async (
    mediaId: string,
    sub: { lang: string; label: string; url: string; generatedAt: string }
  ) => {
    const targetMovie = catalog.find((m) => m.id === mediaId);
    if (!targetMovie) return;
    const prevSubs = Array.isArray(targetMovie.generatedSubtitles) ? targetMovie.generatedSubtitles : [];
    const updatedMovie: MediaItem = {
      ...targetMovie,
      subtitles: Array.from(new Set([...(targetMovie.subtitles || []), 'Português (Brasil)'])),
      generatedSubtitles: [sub, ...prevSubs.filter((s) => s.lang !== sub.lang)],
    };
    await handleUpdateMovie(updatedMovie);
  };

  const handleGenerateMovieSubtitles = async (item: MediaItem) => {
    if (!item.videoUrl) throw new Error('Este filme não possui URL de vídeo configurado.');
    const res = await fetch('/api/subtitles/auto-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaId: item.id,
        title: item.title,
        videoUrl: item.videoUrl,
        targetLang: 'pt-BR',
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Falha ao gerar legendas PT-BR automáticas.');
    }
    await handleSubtitleGenerated(item.id, {
      lang: 'pt-BR',
      label: data.label || 'Português (Brasil) • Auto IA',
      url: data.url,
      generatedAt: new Date().toISOString(),
    });
  };

  const { duplicateIds: duplicateMovieIds } = deduplicateCatalogItems(catalog);
  const { duplicateIds: duplicateChannelIds } = deduplicateChannelsList(
    liveChannels.filter((ch) => !blacklistedIds.includes(ch.id))
  );

  const handleDeduplicateMovies = async (): Promise<number> => {
    const { duplicateIds } = deduplicateCatalogItems(catalog);
    if (duplicateIds.length === 0) return 0;
    for (const dupId of duplicateIds) {
      await handleDeleteMovie(dupId);
    }
    return duplicateIds.length;
  };

  const handleDeduplicateChannels = async (): Promise<number> => {
    const active = liveChannels.filter((ch) => !blacklistedIds.includes(ch.id));
    const { duplicateIds } = deduplicateChannelsList(active);
    if (duplicateIds.length === 0) {
      setChannelCleanupNotice('Nenhum canal duplicado encontrado.');
      return 0;
    }
    await blacklistChannelsGlobally(duplicateIds);
    setChannelCleanupNotice(`${duplicateIds.length} canal(is) duplicado(s) eliminado(s) globalmente!`);
    return duplicateIds.length;
  };

  const handlePurgeDeadChannels = async (): Promise<{ checked: number; removed: number }> => {
    const active = liveChannels.filter((ch) => !blacklistedIds.includes(ch.id));
    if (active.length === 0) return { checked: 0, removed: 0 };
    setIsCheckingDeadChannels(true);
    setChannelCleanupNotice(`A verificar resposta de ${active.length} canais...`);
    try {
      const res = await fetch('/api/iptv/check-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: active.map((c) => ({ id: c.id, name: c.name, videoUrl: c.videoUrl })),
        }),
      });
      const data = await res.json().catch(() => ({ results: [] }));
      const deadIds: string[] = Array.isArray(data.results)
        ? data.results.filter((r: any) => r && r.alive === false).map((r: any) => String(r.id))
        : [];
      if (deadIds.length > 0) {
        await blacklistChannelsGlobally(deadIds);
      }
      setChannelCleanupNotice(
        deadIds.length > 0
          ? `Verificados ${active.length} canais: ${deadIds.length} canal(is) sem resposta do servidor/provider eliminado(s) globalmente!`
          : `Verificados ${active.length} canais: todos estão a responder!`
      );
      return { checked: active.length, removed: deadIds.length };
    } catch {
      setChannelCleanupNotice('Falha ao contactar o servidor de verificação de canais.');
      return { checked: active.length, removed: 0 };
    } finally {
      setIsCheckingDeadChannels(false);
    }
  };

  const getChannelNameLogoKey = (name?: string) => `name:${normalizeTextKey(name)}`;

  const hasWeakOrPlaceholderChannelLogo = (logo?: string) => {
    const val = (logo || '').trim();
    if (!val) return true;
    if (!val.startsWith('/') && !val.startsWith('http')) return true;
    if (val.includes('iScreen_Shoter')) return true;
    if (val.includes('via.placeholder.com')) return true;
    if (val.includes('images.unsplash.com')) return true;
    if (/\.m3u8(\?|$)/i.test(val)) return true;
    return false;
  };

  const resolveChannelLogo = (ch: { id: string; name: string; logo?: string }): string => {
    const byId = channelLogoOverrides[ch.id];
    if (byId) return byId;
    const byName = channelLogoOverrides[getChannelNameLogoKey(ch.name)];
    if (byName) return byName;
    return ch.logo || '';
  };

  const persistChannelLogosMap = async (updates: Record<string, string>) => {
    if (!updates || Object.keys(updates).length === 0) return;
    const nextMap = { ...channelLogoOverridesRef.current, ...updates };
    channelLogoOverridesRef.current = nextMap;
    setChannelLogoOverrides(nextMap);
    try {
      localStorage.setItem('salgueiro_channel_logos', JSON.stringify(nextMap));
    } catch {}

    await saveServerChannelLogos(updates).catch(() => {});
    if (currentUser?.role === 'admin') {
      await saveGlobalPlatformConfigToFirestore(
        { channelLogos: nextMap },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleBatchReplaceChannelLogosFromWeb = async (
    forceAll = true
  ): Promise<{ updated: number; total: number }> => {
    const active = deduplicateChannelsList(
      liveChannels.filter((ch) => !blacklistedIds.includes(ch.id))
    ).unique;
    if (active.length === 0) return { updated: 0, total: 0 };

    const targets = forceAll
      ? active
      : active.filter((ch) => hasWeakOrPlaceholderChannelLogo(resolveChannelLogo(ch)));

    if (targets.length === 0) {
      setChannelCleanupNotice('Todos os canais já possuem logótipos carregados da web.');
      return { updated: 0, total: active.length };
    }

    setIsSearchingChannelLogos(true);
    setChannelCleanupNotice(`A procurar na web os logótipos reais de ${targets.length} canais...`);
    try {
      const BATCH_SIZE = 40;
      const accumulatedUpdates: Record<string, string> = {};
      let updatedChannels = 0;

      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const chunk = targets.slice(i, i + BATCH_SIZE);
        const matches = await batchSearchChannelLogosOnWeb(
          chunk.map((c) => ({ id: c.id, name: c.name }))
        );
        for (const ch of chunk) {
          const match = matches[ch.id];
          if (match?.logoUrl) {
            accumulatedUpdates[ch.id] = match.logoUrl;
            accumulatedUpdates[getChannelNameLogoKey(ch.name)] = match.logoUrl;
            updatedChannels++;
          }
        }
      }

      if (Object.keys(accumulatedUpdates).length > 0) {
        await persistChannelLogosMap(accumulatedUpdates);
      }

      try {
        localStorage.setItem('salgueiro_channel_logos_v1_bootstrapped', '1');
      } catch {}

      setChannelCleanupNotice(
        updatedChannels > 0
          ? `${updatedChannels} de ${targets.length} canais atualizados com os seus logótipos originais da web!`
          : `Pesquisa concluída: nenhum logótipo adicional encontrado na web.`
      );
      return { updated: updatedChannels, total: targets.length };
    } catch (err) {
      setChannelCleanupNotice(
        `Erro ao procurar logótipos na web: ${err instanceof Error ? err.message : 'Falha na ligação'}`
      );
      return { updated: 0, total: targets.length };
    } finally {
      setIsSearchingChannelLogos(false);
    }
  };

  const handleReplaceSingleChannelLogo = async (channel: LiveChannel, logoUrl: string) => {
    const cleanUrl = logoUrl.trim();
    if (!cleanUrl) return;
    await persistChannelLogosMap({
      [channel.id]: cleanUrl,
      [getChannelNameLogoKey(channel.name)]: cleanUrl,
    });
    if (selectedItem && selectedItem.id === channel.id) {
      setSelectedItem({ ...selectedItem, thumbnailUrl: cleanUrl, bannerUrl: cleanUrl });
    }
    setChannelCleanupNotice(`Logótipo do canal "${channel.name}" atualizado com sucesso!`);
  };

  const openChannelLogoPicker = async (channel: LiveChannel) => {
    setLogoPickerChannel(channel);
    setLogoPickerQuery(channel.name);
    setLogoPickerResults([]);
    setIsSearchingSingleLogo(true);
    try {
      const results = await searchChannelLogoOnWeb(channel.name);
      setLogoPickerResults(results);
    } catch {
      setLogoPickerResults([]);
    } finally {
      setIsSearchingSingleLogo(false);
    }
  };

  const handleSearchSingleChannelLogoQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logoPickerQuery.trim()) return;
    setIsSearchingSingleLogo(true);
    try {
      const results = await searchChannelLogoOnWeb(logoPickerQuery.trim());
      setLogoPickerResults(results);
    } catch {
      setLogoPickerResults([]);
    } finally {
      setIsSearchingSingleLogo(false);
    }
  };

  // Automatically fetch real web channel logos on first boot and whenever new channels lack a real logo
  useEffect(() => {
    const active = deduplicateChannelsList(
      liveChannels.filter((ch) => !blacklistedIds.includes(ch.id))
    ).unique;
    if (active.length === 0) return;

    const alreadyBootstrapped = localStorage.getItem('salgueiro_channel_logos_v1_bootstrapped') === '1';
    const pendingChannels = active.filter((ch) => {
      const key = `${ch.id}:${normalizeTextKey(ch.name)}`;
      if (autoCheckedChannelLogoKeysRef.current.has(key)) return false;
      if (!alreadyBootstrapped) return true;
      return hasWeakOrPlaceholderChannelLogo(resolveChannelLogo(ch));
    });

    if (pendingChannels.length === 0) return;
    pendingChannels.forEach((ch) => {
      autoCheckedChannelLogoKeysRef.current.add(`${ch.id}:${normalizeTextKey(ch.name)}`);
    });

    let cancelled = false;
    (async () => {
      try {
        const BATCH_SIZE = 45;
        const updates: Record<string, string> = {};
        for (let i = 0; i < pendingChannels.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const slice = pendingChannels.slice(i, i + BATCH_SIZE);
          const matches = await batchSearchChannelLogosOnWeb(
            slice.map((c) => ({ id: c.id, name: c.name }))
          );
          for (const ch of slice) {
            const m = matches[ch.id];
            if (m?.logoUrl) {
              updates[ch.id] = m.logoUrl;
              updates[getChannelNameLogoKey(ch.name)] = m.logoUrl;
            }
          }
        }
        if (!cancelled && Object.keys(updates).length > 0) {
          await persistChannelLogosMap(updates);
        }
        if (!cancelled && !alreadyBootstrapped) {
          try {
            localStorage.setItem('salgueiro_channel_logos_v1_bootstrapped', '1');
          } catch {}
        }
      } catch {
        // Keep existing logos silently on network hiccup
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liveChannels, blacklistedIds]);

  const persistMovieArtworksMap = async (updates: Record<string, MovieArtworkOverride>) => {
    if (!updates || Object.keys(updates).length === 0) return;
    const nextMap = { ...movieArtworkOverridesRef.current, ...updates };
    movieArtworkOverridesRef.current = nextMap;
    setMovieArtworkOverrides(nextMap);
    try {
      localStorage.setItem('salgueiro_movie_artworks_v1', JSON.stringify(nextMap));
    } catch {}

    await saveServerMovieArtworks(updates).catch(() => {});
    if (currentUser?.role === 'admin') {
      await saveGlobalPlatformConfigToFirestore(
        { movieArtworks: nextMap },
        currentUser.email
      ).catch(() => {});
    }
  };

  const handleAutoSyncMovieArtworks = async (forceAll = false) => {
    const movieTargets = catalog.filter((item) => {
      if (item.type === 'live_tv') return false;
      if (forceAll) return true;
      return !movieArtworkOverridesRef.current[item.id];
    });
    if (movieTargets.length === 0) return;

    setIsSearchingMovieArtworks(true);
    try {
      const BATCH_SIZE = 20;
      const accumulatedUpdates: Record<string, MovieArtworkOverride> = {};
      for (let i = 0; i < movieTargets.length; i += BATCH_SIZE) {
        const slice = movieTargets.slice(i, i + BATCH_SIZE);
        const matches = await batchSearchMovieArtworksOnWeb(
          slice.map((m) => ({
            id: m.id,
            title: m.originalTitle || m.title,
            originalTitle: m.originalTitle,
            type: m.type === 'series' ? 'series' : 'movie',
          }))
        );
        for (const m of slice) {
          const hit = matches[m.id];
          if (hit && (hit.thumbnailUrl || hit.bannerUrl)) {
            accumulatedUpdates[m.id] = {
              thumbnailUrl: hit.thumbnailUrl || hit.bannerUrl,
              bannerUrl: hit.bannerUrl || hit.thumbnailUrl,
              originalTitle: hit.originalTitle,
              source: hit.source,
            };
          }
        }
      }
      if (Object.keys(accumulatedUpdates).length > 0) {
        await persistMovieArtworksMap(accumulatedUpdates);
      }
    } catch {
      // keep existing artwork silently on network error
    } finally {
      setIsSearchingMovieArtworks(false);
    }
  };

  // Automatically search and replace original movie covers & banners on the web
  useEffect(() => {
    const movieItems = catalog.filter((m) => m.type !== 'live_tv');
    if (movieItems.length === 0) return;

    let checkedIds: string[] = [];
    try {
      checkedIds = JSON.parse(localStorage.getItem('salgueiro_movie_artworks_checked_v1') || '[]');
    } catch {
      checkedIds = [];
    }
    const checkedSet = new Set(checkedIds);

    const pending = movieItems.filter((item) => {
      if (autoCheckedMovieIdsRef.current.has(item.id)) return false;
      const hasOverride = Boolean(movieArtworkOverridesRef.current[item.id]);
      if (hasOverride) return false;
      const isWeakArt =
        !item.thumbnailUrl ||
        !item.bannerUrl ||
        item.thumbnailUrl.includes('unsplash.com') ||
        item.bannerUrl.includes('unsplash.com') ||
        item.thumbnailUrl.includes('via.placeholder.com') ||
        item.bannerUrl.includes('via.placeholder.com');
      return isWeakArt || !checkedSet.has(item.id);
    });

    if (pending.length === 0) return;
    pending.forEach((m) => autoCheckedMovieIdsRef.current.add(m.id));

    let cancelled = false;
    (async () => {
      try {
        const BATCH_SIZE = 20;
        const updates: Record<string, MovieArtworkOverride> = {};
        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const slice = pending.slice(i, i + BATCH_SIZE);
          const matches = await batchSearchMovieArtworksOnWeb(
            slice.map((m) => ({
              id: m.id,
              title: m.originalTitle || m.title,
              originalTitle: m.originalTitle,
              type: m.type === 'series' ? 'series' : 'movie',
            }))
          );
          for (const m of slice) {
            checkedSet.add(m.id);
            const hit = matches[m.id];
            if (hit && (hit.thumbnailUrl || hit.bannerUrl)) {
              updates[m.id] = {
                thumbnailUrl: hit.thumbnailUrl || hit.bannerUrl,
                bannerUrl: hit.bannerUrl || hit.thumbnailUrl,
                originalTitle: hit.originalTitle,
                source: hit.source,
              };
            }
          }
        }
        try {
          localStorage.setItem('salgueiro_movie_artworks_checked_v1', JSON.stringify(Array.from(checkedSet)));
        } catch {}
        if (!cancelled && Object.keys(updates).length > 0) {
          await persistMovieArtworksMap(updates);
        }
      } catch {
        // silent fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalog]);

  // Filtered items based on blacklist, auto-deduplicated, and enriched with web channel logos
  const filteredLiveChannels = deduplicateChannelsList(
    liveChannels.filter(ch => !blacklistedIds.includes(ch.id))
  ).unique.map((ch) => ({
    ...ch,
    logo: resolveChannelLogo(ch),
  }));

  // Ensure catalog entries reflect replaced web movie artworks, TV channel logos, and automatic series detection
  const resolvedCatalog = React.useMemo(
    () =>
      catalog.map((item) => {
        if (item.type === 'live_tv') {
          const resolved = resolveChannelLogo({
            id: item.id,
            name: item.title,
            logo: item.thumbnailUrl,
          });
          if (!resolved || (resolved === item.thumbnailUrl && resolved === item.bannerUrl)) {
            return item;
          }
          return {
            ...item,
            thumbnailUrl: resolved,
            bannerUrl: resolved,
          };
        }

        const autoSeries = item.type !== 'series' && isDetectedSeriesItem(item);
        const normalizedType: MediaItem['type'] = autoSeries ? 'series' : item.type;
        const art = movieArtworkOverrides[item.id];
        if (!art) {
          return autoSeries ? { ...item, type: 'series' as const, stremioType: 'series' as const } : item;
        }
        return {
          ...item,
          type: normalizedType,
          ...(autoSeries ? { stremioType: 'series' as const } : {}),
          thumbnailUrl: art.thumbnailUrl || item.thumbnailUrl,
          bannerUrl: art.bannerUrl || art.thumbnailUrl || item.bannerUrl,
        };
      }),
    [catalog, channelLogoOverrides, movieArtworkOverrides]
  );

  const searchableCatalog = React.useMemo(() => {
    const byId = new Map<string, MediaItem>();
    [...resolvedCatalog, ...addonCatalogMovies, ...addonCatalogSeries].forEach((entry) => {
      if (entry && entry.id && !byId.has(entry.id)) {
        byId.set(entry.id, entry);
      }
    });
    return Array.from(byId.values());
  }, [resolvedCatalog, addonCatalogMovies, addonCatalogSeries]);

  // Filtered items based on view (resolves movies/series from platform + addons AND favorited live channels)
  const watchlistItems = watchlistIds.map(id => {
    const fromCat = searchableCatalog.find(item => item.id === id);
    if (fromCat) return fromCat;
    const fromChan = filteredLiveChannels.find(ch => ch.id === id) || liveChannels.find(ch => ch.id === id);
    if (fromChan) {
      const resolvedLogo = resolveChannelLogo(fromChan);
      return {
        id: fromChan.id,
        title: fromChan.name,
        type: 'live_tv' as const,
        bannerUrl: resolvedLogo,
        thumbnailUrl: resolvedLogo,
        videoUrl: fromChan.videoUrl,
        synopsis: fromChan.currentShow,
        rating: 'L',
        imdbScore: 8.5,
        year: 2026,
        genres: ['Variedades' as const],
        quality: 'HD',
        audio: ['Original'],
        subtitles: [],
        isSalgueiroMember: true,
      };
    }
    return null;
  }).filter(Boolean) as MediaItem[];

  return (
    <ThemeContext.Provider
      value={{
        theme: platformTheme,
        setTheme: handleSelectPlatformTheme,
        prefs: interfacePrefs,
        setPrefs: handleUpdateInterfacePrefs,
      }}
    >
    <div className="flex flex-col min-h-screen bg-[var(--theme-bg)] text-[var(--theme-text)] transition-colors duration-300">
      <TopBar 
        activeView={activeView} 
        setActiveView={(view) => {
          setActiveView(view === 'national_movies' ? 'international_movies' : view);
          setSelectedItem(null);
        }} 
        appTitle={appTitle}
        onSearch={handleSearch} 
        onRegister={() => setIsRegistrationOpen(true)}
        onLogin={() => setIsLoginOpen(true)}
        user={currentUser}
        onLogout={() => updateCurrentUser(null)}
        onOpenFavorites={() => {
          setActiveView('library');
          setSelectedItem(null);
        }}
        onOpenAdminUpload={handleOpenAdminUpload}
        onlineUsersCount={activeOnlineUsers.length}
        onOpenOnlineUsers={() => {
          setSettingsInitialSection('admin_online');
          setActiveView('settings');
          setSelectedItem(null);
        }}
        onOpenThemeSettings={() => {
          setSettingsInitialSection('interface');
          setActiveView('settings');
          setSelectedItem(null);
        }}
        onOpenRecycleBin={() => {
          setSettingsInitialSection('recycle_bin');
          setActiveView('settings');
          setSelectedItem(null);
        }}
        recycleCount={recycledItems.length}
        watchlistCount={watchlistIds.length}
      />

      <main className="flex-1 w-full min-h-screen flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[1720px] w-full mx-auto">
          {selectedItem ? (
            <DetailsView
              item={resolvedCatalog.find(i => i.id === selectedItem.id) || selectedItem}
              onBack={() => setSelectedItem(null)}
              onPlay={handlePlay}
              isInWatchlist={isInWatchlist(selectedItem.id)}
              onToggleWatchlist={(item) => toggleWatchlist(null, item)}
              similarItems={resolvedCatalog.filter(i => i.id !== selectedItem.id).slice(0, 6)}
              installedAddons={installedAddons}
              isAdmin={currentUser?.role === 'admin'}
              onEditMovie={handleOpenEditMovie}
              onDeleteMovie={handleDeleteMovie}
              onPickArtwork={
                currentUser?.role === 'admin'
                  ? (item) => setArtworkPickerItem(item)
                  : undefined
              }
            />
          ) : (
            <>
              {activeView === 'board' && (
                <BoardView
                  popular={resolvedCatalog}
                  continueWatching={continueWatching}
                  onItemClick={handleItemClick}
                  onPlay={handlePlay}
                  onOpenDetail={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  customHeroImage={heroImage}
                  onNavigate={(view) => {
                    setActiveView(view);
                    setSelectedItem(null);
                  }}
                  isAdmin={currentUser?.role === 'admin'}
                  onEditMovie={handleOpenEditMovie}
                />
              )}

              {activeView === 'discover' && (
                <DiscoverView
                  items={resolvedCatalog}
                  onItemClick={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  isAdmin={currentUser?.role === 'admin'}
                  onEditMovie={handleOpenEditMovie}
                />
              )}

              {activeView === 'live_tv' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#2d3139]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#7b5be4] rounded-2xl shadow-lg shadow-[#7b5be4]/20">
                        <Tv className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-3xl font-black text-white tracking-tighter">TV em direto</h1>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Canais Angolanos e Globais ao vivo</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {currentUser?.role === 'admin' && (
                        <>
                          <button
                            type="button"
                            onClick={() => directM3uInputRef.current?.click()}
                            className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-600/20"
                            title="Carregar ficheiro .M3U ou .M3U8 com lista de canais"
                          >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">Carregar Lista M3U / M3U8</span>
                          </button>
                          <input
                            ref={directM3uInputRef}
                            type="file"
                            accept=".m3u,.m3u8,text/plain"
                            onChange={handleDirectM3UUpload}
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={isSearchingChannelLogos}
                            onClick={() => {
                              void handleBatchReplaceChannelLogosFromWeb(true);
                            }}
                            className="px-3.5 py-2.5 bg-[#7b5be4]/20 hover:bg-[#7b5be4]/35 border border-[#7b5be4]/50 text-[#c4b5fd] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Procurar na web os logótipos de todos os canais e substituir consoante os nomes"
                          >
                            {isSearchingChannelLogos ? (
                              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              {isSearchingChannelLogos ? 'A procurar logos...' : 'Procurar Logos (Web)'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDeduplicateChannels();
                            }}
                            className="px-3 py-2.5 bg-white/5 hover:bg-amber-500/20 border border-[#2d3139] hover:border-amber-500/40 text-amber-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                            title="Eliminar canais de TV duplicados"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Eliminar Duplicados</span>
                          </button>
                          <button
                            type="button"
                            disabled={isCheckingDeadChannels}
                            onClick={() => {
                              void handlePurgeDeadChannels();
                            }}
                            className="px-3 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                            title="Testar e eliminar canais sem resposta do servidor ou provedor"
                          >
                            {isCheckingDeadChannels ? (
                              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <WifiOff className="w-3.5 h-3.5" />
                            )}
                            <span className="hidden sm:inline">
                              {isCheckingDeadChannels ? 'A verificar...' : 'Eliminar Sem Resposta'}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setSettingsInitialSection('addons');
                              setActiveView('settings');
                              setSelectedItem(null);
                            }}
                            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
                            title="Gerir Listas IPTV e Canais M3U/M3U8"
                          >
                            <Tv className="w-4 h-4" />
                            <span className="hidden sm:inline">Gerir Listas IPTV / M3U</span>
                          </button>
                        </>
                      )}
                      {currentUser?.role === 'admin' && (
                        <button 
                          onClick={fetchIPTV}
                          disabled={isFetchingIPTV}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                          title="Recarregar e atualizar todos os canais de TV"
                        >
                          <RefreshCcw className={`w-4 h-4 ${isFetchingIPTV ? 'animate-spin' : ''}`} />
                          <span>{isFetchingIPTV ? 'A Atualizar Canais...' : `Atualizar Lista (${filteredLiveChannels.length})`}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {lastUploadedIptvNotice && (
                    <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-xl shadow-emerald-950/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                          <Check className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">
                            Lista M3U/M3U8 Carregada: {lastUploadedIptvNotice.name}
                          </h4>
                          <p className="text-[11px] text-emerald-300 font-medium">
                            {lastUploadedIptvNotice.count} canais identificados e adicionados ao menu TV ao Vivo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            void fetchIPTV();
                          }}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                        >
                          <RefreshCcw className={`w-3.5 h-3.5 ${isFetchingIPTV ? 'animate-spin' : ''}`} />
                          <span>Atualizar Lista</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLastUploadedIptvNotice(null)}
                          className="text-slate-400 hover:text-white p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {channelCleanupNotice && (
                    <div className="p-3.5 bg-[#161a22] border border-[#7b5be4]/40 rounded-2xl text-xs font-semibold text-slate-200 flex items-center justify-between gap-3">
                      <span>{channelCleanupNotice}</span>
                      <button
                        type="button"
                        onClick={() => setChannelCleanupNotice(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {isFetchingIPTV && filteredLiveChannels.length <= INITIAL_LIVE_CHANNELS.length ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-[#161a22] p-4 rounded-2xl border border-[#2d3139] animate-pulse h-48" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredLiveChannels.map(ch => (
                        <div 
                          key={ch.id} 
                          onClick={() => {
                            const mediaItem = catalog.find(m => m.id === ch.id);
                            if (mediaItem) {
                              handleItemClick(mediaItem);
                            } else {
                              const tempMedia: MediaItem = {
                                id: ch.id,
                                title: ch.name,
                                type: 'live_tv',
                                bannerUrl: ch.logo,
                                thumbnailUrl: ch.logo,
                                videoUrl: ch.videoUrl,
                                synopsis: ch.currentShow,
                                rating: 'L',
                                imdbScore: 0,
                                year: 2026,
                                genres: [ch.category as any],
                                quality: 'HD',
                                audio: ['Original'],
                                subtitles: [],
                                isSalgueiroMember: true,
                                liveChannel: {
                                  channelNumber: ch.channelNumber,
                                  channelName: ch.name,
                                  currentShow: ch.currentShow,
                                  currentShowCategory: ch.category,
                                  startTime: '00:00',
                                  endTime: '23:59',
                                  progressPercentage: ch.progressPercentage,
                                  viewersCount: ch.viewers
                                }
                              };
                              handleItemClick(tempMedia);
                            }
                          }}
                          className="bg-[#161a22] p-4 rounded-2xl border border-[#2d3139] hover:border-[#7b5be4] transition-all cursor-pointer group relative"
                        >
                           <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                             {currentUser?.role === 'admin' && (
                               <button
                                 type="button"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   void openChannelLogoPicker(ch);
                                 }}
                                 className="p-2 bg-black/70 hover:bg-[#7b5be4] text-white rounded-lg transition-all"
                                 title="Procurar logótipo original do canal na web"
                               >
                                 <ImageIcon className="w-3.5 h-3.5" />
                               </button>
                             )}
                             <button 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 const item = resolvedCatalog.find(m => m.id === ch.id) || {
                                   id: ch.id,
                                   title: ch.name,
                                   type: 'live_tv',
                                   bannerUrl: ch.logo,
                                   thumbnailUrl: ch.logo,
                                   videoUrl: ch.videoUrl,
                                   synopsis: ch.currentShow,
                                   rating: 'L',
                                   imdbScore: 8.5,
                                   year: 2026,
                                   genres: [ch.category as any],
                                   quality: 'HD',
                                   audio: ['Original'],
                                   subtitles: [],
                                   isSalgueiroMember: true
                                 };
                                 toggleWatchlist(e, item as MediaItem);
                               }}
                               className={`p-2 rounded-lg transition-all ${isInWatchlist(ch.id) ? 'bg-[#7b5be4] text-white shadow-lg shadow-[#7b5be4]/30' : 'bg-black/60 text-slate-300 hover:text-white'}`}
                               title={isInWatchlist(ch.id) ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                             >
                               <Heart className={`w-3.5 h-3.5 ${isInWatchlist(ch.id) ? 'fill-white text-white' : ''}`} />
                             </button>
                             {currentUser?.role === 'admin' && (
                               <button 
                                 onClick={(e) => handleRemoveChannel(e, ch.id)}
                                 className="p-2 bg-black/60 hover:bg-red-600/80 text-white rounded-lg transition-all"
                                 title="Remover canal (Admin)"
                               >
                                  <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             )}
                           </div>
                           <div className="aspect-video rounded-xl bg-gradient-to-br from-[#0b0e14] via-[#121620] to-[#0b0e14] border border-white/5 mb-3 overflow-hidden relative flex items-center justify-center p-4">
                              <img 
                                src={ch.logo} 
                                alt={ch.name} 
                                referrerPolicy="no-referrer"
                                className="max-w-full max-h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.65)] group-hover:scale-105 transition-transform" 
                                onError={(e) => {
                                  const imgEl = e.target as HTMLImageElement;
                                  if (!imgEl.dataset.fallbackApplied) {
                                    imgEl.dataset.fallbackApplied = '1';
                                    imgEl.src = '/src/assets/images/live_sports_stadium_1794091825611.jpg';
                                  }
                                }}
                              />
                              <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Live</div>
                           </div>
                           <h4 className="text-sm font-bold text-white truncate">{ch.name}</h4>
                           <p className="text-[10px] text-slate-500 mt-1 truncate">{ch.currentShow}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeView === 'kids' && (
                <div className="space-y-8 animate-fade-in">
                  <div className="flex items-center gap-4 pb-6 border-b border-[#2d3139]">
                    <div className="p-3 bg-[#7b5be4] rounded-2xl shadow-lg shadow-[#7b5be4]/20">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-black text-white tracking-tighter">Kids</h1>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Desenhos animados e conteúdo infantil</p>
                    </div>
                  </div>
                  
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Canais Infantil ao Vivo</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                     {filteredLiveChannels.filter(ch => ch.category === 'Infantil').map(ch => (
                        <div 
                          key={ch.id} 
                          onClick={() => setPlayingChannel(ch)}
                          className="bg-[#161a22] p-4 rounded-2xl border border-[#2d3139] hover:border-[#7b5be4] transition-all cursor-pointer group relative"
                        >
                           <div className="aspect-video rounded-xl bg-gradient-to-br from-[#0b0e14] via-[#121620] to-[#0b0e14] border border-white/5 mb-3 overflow-hidden relative flex items-center justify-center p-4">
                             <img
                               src={ch.logo}
                               alt={ch.name}
                               referrerPolicy="no-referrer"
                               className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                             />
                             <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">Live</div>
                           </div>
                           <h4 className="text-sm font-bold text-white truncate">{ch.name}</h4>
                           <p className="text-[10px] text-slate-500 mt-1 truncate">{ch.currentShow}</p>
                        </div>
                     ))}
                  </div>

                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Filmes Infantis</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                    {resolvedCatalog.filter(i => i.genres.includes('Infantil')).map(item => (
                      <ContentCard
                        key={item.id}
                        item={item}
                        onClick={handleItemClick}
                        isInWatchlist={isInWatchlist(item.id)}
                        onToggleWatchlist={toggleWatchlist}
                        isAdmin={currentUser?.role === 'admin'}
                        onEditMovie={handleOpenEditMovie}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(activeView === 'international_movies' || activeView === 'national_movies') && (
                <InternationalMoviesView
                  localMovies={resolvedCatalog.filter(i => i.type === 'movie')}
                  addons={installedAddons}
                  setAddons={setInstalledAddons}
                  addonMovieSections={addonMovieSections}
                  isLoadingAddonCatalogs={isLoadingAddonCatalogs}
                  onRefreshAddonCatalogs={() => refreshAddonCatalogs(installedAddons)}
                  onItemClick={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  onOpenAddonsManager={() => {
                    if (currentUser?.role === 'admin') {
                      setActiveView('addons');
                      setSelectedItem(null);
                    }
                  }}
                  isAdmin={currentUser?.role === 'admin'}
                  onOpenAdminUpload={handleOpenAdminUpload}
                  onClearAllInternationalMovies={handleClearAllInternationalMovies}
                  isSyncingArtwork={isSearchingMovieArtworks}
                  onAutoSyncMovieArtworks={
                    currentUser?.role === 'admin'
                      ? () => handleAutoSyncMovieArtworks(true)
                      : undefined
                  }
                  onPickMovieArtwork={
                    currentUser?.role === 'admin'
                      ? (item) => setArtworkPickerItem(item)
                      : undefined
                  }
                  onEditMovie={
                    currentUser?.role === 'admin'
                      ? (item) => handleOpenEditMovie(item)
                      : undefined
                  }
                />
              )}

              {activeView === 'series' && (
                <SeriesView
                  localSeries={resolvedCatalog.filter(i => i.type === 'series')}
                  addonSeriesSections={addonSeriesSections}
                  addons={installedAddons}
                  isLoadingAddonCatalogs={isLoadingAddonCatalogs}
                  onRefreshAddonCatalogs={() => refreshAddonCatalogs(installedAddons)}
                  onItemClick={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  onOpenAddonsManager={() => {
                    if (currentUser?.role === 'admin') {
                      setActiveView('addons');
                      setSelectedItem(null);
                    }
                  }}
                  isAdmin={currentUser?.role === 'admin'}
                  onOpenAdminUpload={handleOpenAdminUpload}
                  isSyncingArtwork={isSearchingMovieArtworks}
                  onAutoSyncSeriesArtworks={
                    currentUser?.role === 'admin'
                      ? () => handleAutoSyncMovieArtworks(true)
                      : undefined
                  }
                  onPickMovieArtwork={
                    currentUser?.role === 'admin'
                      ? (item) => setArtworkPickerItem(item)
                      : undefined
                  }
                  onEditMovie={
                    currentUser?.role === 'admin'
                      ? (item) => handleOpenEditMovie(item)
                      : undefined
                  }
                />
              )}

              {activeView === 'library' && (
                <LibraryView
                  items={watchlistItems}
                  onItemClick={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  onExplore={() => setActiveView('board')}
                  isAdmin={currentUser?.role === 'admin'}
                  onEditMovie={handleOpenEditMovie}
                />
              )}

              {activeView === 'addons' && currentUser?.role === 'admin' && (
                <AddonsView
                  addons={installedAddons}
                  setAddons={setInstalledAddons}
                  onSyncAddons={handleSyncAddons}
                  isAdmin={currentUser?.role === 'admin'}
                  onSelectMedia={handleItemClick}
                  isInWatchlist={isInWatchlist}
                  onToggleWatchlist={toggleWatchlist}
                  mediaDomainConfig={mediaDomainConfig}
                  onOpenDomainManager={() => {
                    if (currentUser?.role === 'admin') {
                      setSettingsInitialSection('admin_domain');
                      setActiveView('settings');
                      setSelectedItem(null);
                    } else {
                      setIsLoginOpen(true);
                    }
                  }}
                />
              )}

                  {activeView === 'settings' && (
                <SettingsView 
                  user={currentUser} 
                  catalog={resolvedCatalog}
                  setCatalog={setCatalog}
                  appTitle={appTitle}
                  setAppTitle={setAppTitle}
                  heroImage={heroImage}
                  setHeroImage={setHeroImage}
                  systemUsers={systemUsers}
                  setSystemUsers={setSystemUsers}
                  iptvUrls={iptvUrls}
                  setIptvUrls={setIptvUrls}
                  allUserDevices={allUserDevices}
                  liveChannels={filteredLiveChannels}
                  duplicateMoviesCount={duplicateMovieIds.length}
                  duplicateChannelsCount={duplicateChannelIds.length}
                  onDeduplicateMovies={handleDeduplicateMovies}
                  onDeduplicateChannels={handleDeduplicateChannels}
                  onPurgeDeadChannels={handlePurgeDeadChannels}
                  isCheckingDeadChannels={isCheckingDeadChannels}
                  onBatchReplaceChannelLogos={handleBatchReplaceChannelLogosFromWeb}
                  onReplaceSingleChannelLogo={handleReplaceSingleChannelLogo}
                  isSearchingChannelLogos={isSearchingChannelLogos}
                  onGenerateMovieSubtitles={handleGenerateMovieSubtitles}
                  onSaveBrandingGlobal={handleSaveBrandingGlobal}
                  onOpenCreateMovie={handleOpenAdminUpload}
                  onEditMovie={handleOpenEditMovie}
                  onUpdateMovie={handleUpdateMovie}
                  onDeleteMovie={handleDeleteMovie}
                  onReloadIptv={fetchIPTV}
                  isFetchingIPTV={isFetchingIPTV}
                  onOpenLiveTv={() => {
                    setActiveView('live_tv');
                    setSelectedItem(null);
                  }}
                  onUpdateCurrentUser={(updated) => updateCurrentUser(updated)}
                  onOpenRegister={() => setIsRegistrationOpen(true)}
                  onOpenLogin={() => setIsLoginOpen(true)}
                  onOpenStremioAddons={
                    currentUser?.role === 'admin'
                      ? () => {
                          setActiveView('addons');
                          setSelectedItem(null);
                        }
                      : undefined
                  }
                  mediaDomainConfig={mediaDomainConfig}
                  onUpdateMediaDomainConfig={setMediaDomainConfig}
                  onlineUsers={activeOnlineUsers}
                  initialSection={settingsInitialSection}
                  onPickMovieArtwork={
                    currentUser?.role === 'admin'
                      ? (item) => setArtworkPickerItem(item)
                      : undefined
                  }
                  onSaveGlobalTheme={handleSaveGlobalTheme}
                  recycledItems={recycledItems}
                  onRestoreRecycledItem={handleRestoreRecycledItem}
                  onPermanentDeleteRecycledItem={handlePermanentDeleteRecycledItem}
                  onEmptyRecycleBin={handleEmptyRecycleBin}
                  onAddToRecycleBin={addRecycleBinItem}
                />
              )}
            </>
          )}
        </div>
        <Footer appTitle={appTitle} />
      </main>

      {(playingMedia || playingChannel) && (
        <VideoPlayerModal
          media={playingMedia}
          channel={playingChannel}
          isGuest={!currentUser}
          installedAddons={installedAddons}
          onOpenRegister={() => setIsRegistrationOpen(true)}
          onOpenLogin={() => setIsLoginOpen(true)}
          onStreamError={undefined}
          onSubtitleGenerated={handleSubtitleGenerated}
          onClose={() => {
            setPlayingMedia(null);
            setPlayingChannel(null);
          }}
        />
      )}

      {sessionBlockedNotice && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#161a22] border border-red-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight">Acesso Suspenso</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{sessionBlockedNotice}</p>
            <button
              type="button"
              onClick={() => setSessionBlockedNotice(null)}
              className="w-full py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        movies={searchableCatalog}
        channels={filteredLiveChannels}
        installedAddons={installedAddons}
        onPlayMovie={handlePlay}
        onPlayChannel={setPlayingChannel}
        onOpenDetail={handleItemClick}
        isInWatchlist={isInWatchlist}
        onToggleWatchlist={(item) => toggleWatchlist(null, item)}
        isAdmin={currentUser?.role === 'admin'}
        onEditMovie={handleOpenEditMovie}
      />

      <RegistrationModal 
        isOpen={isRegistrationOpen} 
        onClose={() => setIsRegistrationOpen(false)} 
        onRegisterSuccess={(user) => {
          updateCurrentUser(user);
          setSystemUsers(prev => {
            const exists = prev.some(u => u.email.toLowerCase() === user.email.toLowerCase());
            if (exists) return prev;
            return [
              ...prev,
              {
                ...user,
                initial: user.name.substring(0, 2).toUpperCase(),
              },
            ];
          });
        }}
      />

      <LoginModal 
        isOpen={isLoginOpen} 
        onClose={() => setIsLoginOpen(false)} 
        onLoginSuccess={(user) => {
          updateCurrentUser(user);
          setSystemUsers(prev => {
            const exists = prev.some(u => u.email.toLowerCase() === user.email.toLowerCase());
            if (exists) return prev;
            return [
              ...prev,
              {
                ...user,
                initial: user.name.substring(0, 2).toUpperCase(),
              },
            ];
          });
        }}
        onSwitchToRegister={() => {
          setIsLoginOpen(false);
          setIsRegistrationOpen(true);
        }}
      />

      {isAdminUploadOpen && (
        <AdminUploadModal
          onClose={() => {
            setIsAdminUploadOpen(false);
            setEditingMovie(null);
          }}
          onUploadMovie={handleUploadMovie}
          onUpdateMovie={handleUpdateMovie}
          onPlayMovie={handlePlay}
          movieToEdit={editingMovie}
          existingCustomMovies={customUploadedMovies}
          allCatalogMovies={resolvedCatalog}
          onDeleteCustomMovie={handleDeleteMovie}
          domainConfig={mediaDomainConfig}
        />
      )}

      {logoPickerChannel && (
        <div className="fixed inset-0 z-[190] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#161a22] border border-[#2d3139] rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Procurar Logótipo na Web — {logoPickerChannel.name}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Escolha o logótipo oficial do canal para substituir automaticamente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLogoPickerChannel(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSearchSingleChannelLogoQuery} className="flex gap-2">
              <input
                type="text"
                value={logoPickerQuery}
                onChange={(e) => setLogoPickerQuery(e.target.value)}
                placeholder="Nome do canal (ex: TV Zimbo, TPA 1, AXN Portugal)"
                className="flex-1 bg-[#0c0d10] border border-[#2d3139] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
              />
              <button
                type="submit"
                disabled={isSearchingSingleLogo}
                className="px-4 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSearchingSingleLogo ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Procurar
              </button>
            </form>

            <div className="max-h-72 overflow-y-auto pr-1">
              {isSearchingSingleLogo ? (
                <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCcw className="w-5 h-5 animate-spin text-[#7b5be4]" />
                  <span>A procurar imagens e logótipos na web...</span>
                </div>
              ) : logoPickerResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Nenhum logótipo encontrado na web para "{logoPickerQuery}". Tente outro termo.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {logoPickerResults.map((res) => (
                    <button
                      key={res.id}
                      type="button"
                      onClick={async () => {
                        await handleReplaceSingleChannelLogo(logoPickerChannel, res.logoUrl);
                        setLogoPickerChannel(null);
                      }}
                      className="p-3 bg-[#0c0d10] hover:bg-slate-900 border border-[#2d3139] hover:border-[#7b5be4] rounded-2xl flex flex-col items-center gap-2 text-center transition-all group"
                    >
                      <div className="w-full h-16 bg-slate-950 rounded-xl p-2 flex items-center justify-center overflow-hidden">
                        <img
                          src={res.logoUrl}
                          alt={res.channelName}
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="w-full">
                        <p className="text-[11px] font-bold text-white truncate">{res.channelName}</p>
                        <p className="text-[9px] text-slate-400 truncate">{res.source}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#c4b5fd]">
                        <Check className="w-3 h-3" /> Aplicar Logo
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentUser?.role === 'admin' && artworkPickerItem && (
        <AdminArtworkPickerModal
          item={artworkPickerItem}
          onClose={() => setArtworkPickerItem(null)}
          onApplyArtwork={handleApplyPickedArtwork}
        />
      )}
    </div>
    </ThemeContext.Provider>
  );
}

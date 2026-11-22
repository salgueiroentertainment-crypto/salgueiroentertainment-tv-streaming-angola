export type ContentType = 'movie' | 'series' | 'live_tv';

export type Genre = 
  | 'Ação'
  | 'Aventura'
  | 'Ficção Científica'
  | 'Suspense'
  | 'Drama'
  | 'Comédia'
  | 'Esportes'
  | 'Terror'
  | 'Fantasia'
  | 'Documentário'
  | 'Infantil'
  | 'Notícias'
  | 'Cultura'
  | 'Variedades'
  | 'Mistério'
  | 'História'
  | 'Internacional';

export interface ContinueWatchingItem {
  media: MediaItem;
  progressSeconds?: number;
  totalDurationSeconds?: number;
  percentage: number;
  remainingMinutes: number;
}

export interface CastMember {
  name: string;
  role: string;
  character: string;
}

export interface MediaItem {
  id: string;
  title: string;
  originalTitle?: string;
  type: ContentType;
  bannerUrl: string;
  thumbnailUrl: string;
  videoUrl: string; // Real playable stream
  synopsis: string;
  rating: string; // 'L', '12', '14', '16', '18'
  imdbScore: number;
  year: number;
  duration?: string; // e.g. "2h 15m" or "3 Temporadas"
  genres: Genre[];
  quality: '4K UHD' | 'HD' | 'HDR';
  audio: string[];
  subtitles: string[];
  isSalgueiroMember: boolean;
  isTop10?: boolean;
  top10Rank?: number;
  matchPercentage?: number; // e.g. 98% de compatibilidade
  director?: string;
  cast?: CastMember[];
  trivia?: string[];
  musicTrack?: string;
  addonName?: string;
  stremioType?: string;
  generatedSubtitles?: {
    lang: string;
    label: string;
    url: string;
    createdAt?: string;
  }[];
  liveChannel?: {
    channelNumber: number;
    channelName: string;
    currentShow: string;
    currentShowCategory: string;
    startTime: string;
    endTime: string;
    progressPercentage: number;
    viewersCount: string;
    logoUrl?: string;
  };
}

export interface EPGProgram {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  rating: string;
  description: string;
  isLiveNow: boolean;
}

export interface LiveChannel {
  id: string;
  channelNumber: number;
  name: string;
  logo: string;
  category: 'Esportes' | 'Notícias' | 'Filmes & Séries' | 'Variedades' | 'Infantil';
  currentShow: string;
  nextShow: string;
  progressPercentage: number;
  viewers: string;
  videoUrl: string;
  schedule: EPGProgram[];
}

export interface UserWatchProgress {
  mediaId: string;
  progressSeconds: number;
  totalDurationSeconds: number;
  percentage: number;
  updatedAt: number;
}

export interface UserDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tv' | 'tablet';
  browserOrOs: string;
  location: string;
  lastActive: string;
  isCurrent?: boolean;
  enabled?: boolean;
}

export type UserRole = 'admin' | 'user' | 'viewer';

export type PlatformTheme = 'default' | 'netflix' | 'prime' | 'stremio';

export interface UserProfile {
  uid?: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  preferredTheme?: PlatformTheme;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  accountActive?: boolean;
  devices?: UserDevice[];
  planName?: string;
  monthlyPrice?: string;
  paymentDate?: string; // ISO YYYY-MM-DD
  expirationDate?: string; // ISO YYYY-MM-DD
  paymentStatus?: 'Ativo' | 'Pendente' | 'Expirado' | 'Teste Gratuito' | 'Desativado';
  paymentMethod?: string;
}

export interface StremioCatalogDef {
  type: string;
  id: string;
  name?: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

export interface StremioAddonManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  background?: string;
  types?: string[];
  resources?: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
  catalogs?: StremioCatalogDef[];
  idPrefixes?: string[];
}

export interface InstalledStremioAddon {
  transportUrl: string;
  manifest: StremioAddonManifest;
  enabled: boolean;
  isOfficial?: boolean;
  installedAt: string;
}

export interface StremioStreamItem {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  ytId?: string;
  infoHash?: string;
  externalUrl?: string;
  addonName?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
  };
}

export interface StremioSubtitleItem {
  id: string;
  url: string;
  lang: string;
  addonName?: string;
}

export interface CodecSupportReport {
  codec: string;
  mime: string;
  supported: boolean;
  serverFallback: string;
}

export type RecycledItemType = 'movie' | 'series' | 'channel' | 'addon' | 'iptv_url' | 'iptv_file' | 'config';

export interface RecycledItem {
  id: string; // Document ID e.g. "recycle_movie_xxx"
  originalId: string;
  type: RecycledItemType;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string;
  category?: string;
  data: any; // Full snapshot to restore
  deletedAt: string; // ISO date string
  deletedBy?: string;
  metadata?: Record<string, any>;
}


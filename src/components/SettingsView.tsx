import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  Globe, 
  Tv, 
  ShieldCheck, 
  Bell, 
  CreditCard, 
  Database, 
  ChevronRight,
  Monitor,
  Smartphone,
  Info,
  Settings,
  Users,
  Lock,
  Search,
  MoreVertical,
  Plus,
  Puzzle,
  Trash2,
  Edit2,
  Film,
  Palette,
  Type,
  Layout,
  Upload,
  AlertCircle,
  Check,
  X,
  Save,
  Radio,
  FileText,
  Tablet,
  Calendar,
  Clock,
  CheckCircle2,
  RefreshCw,
  UserPlus,
  LogIn,
  HardDrive,
  Server,
  Copy,
  Play,
  Link2,
  Power,
  Subtitles,
  Sparkles,
  WifiOff,
  ChevronDown,
  ChevronUp,
  MapPin,
  Activity,
  Image as ImageIcon,
  RotateCcw,
} from 'lucide-react';
import { UserProfile, MediaItem, UserDevice, LiveChannel, PlatformTheme, RecycledItem } from '../types/streaming';
import { PLATFORM_THEMES, usePlatformTheme } from '../lib/themes';
import { parseM3U } from '../data/m3uParser';
import {
  syncIptvToGlobal,
  saveUserAccountPayment,
  deleteUserAccountFromFirestore,
  getDefaultDatesForMonthlyPlan,
  saveMediaDomainConfigToFirestore,
  OnlinePresenceRecord,
} from '../lib/firebase';
import {
  getUserDevices,
  disconnectDevice,
  addCustomDevice,
  setUserDeviceEnabled,
  MAX_DEVICES_PER_ACCOUNT,
} from '../lib/deviceManager';
import { PRESET_AVATARS, DEFAULT_ADMIN_AVATAR } from '../data/avatars';
import {
  MediaDomainConfig,
  VaultMediaFile,
  buildCustomDomainStreamUrl,
  buildRuntimeStreamUrl,
  deleteVaultMediaFile,
  formatBytes,
  getRuntimeOrigin,
  isValidDomainName,
  listVaultMediaFiles,
  normalizeDomainName,
  updateMediaDomainConfig,
  searchOriginalMovieArtwork,
  ChannelLogoResult,
  searchChannelLogoOnWeb,
  DEFAULT_MEDIA_DOMAIN_CONFIG,
} from '../lib/mediaDomain';

interface UploadedIPTVFile {
  id: string;
  name: string;
  content: string;
  channelCount: number;
  uploadedAt: string;
}

interface SettingsViewProps {
  user: UserProfile | null;
  catalog: MediaItem[];
  setCatalog: React.Dispatch<React.SetStateAction<MediaItem[]>>;
  appTitle: string;
  setAppTitle: (title: string) => void;
  heroImage: string;
  setHeroImage: (url: string) => void;
  systemUsers: any[];
  setSystemUsers: React.Dispatch<React.SetStateAction<any[]>>;
  iptvUrls: string[];
  setIptvUrls: React.Dispatch<React.SetStateAction<string[]>>;
  allUserDevices?: Record<string, UserDevice[]>;
  liveChannels?: LiveChannel[];
  duplicateMoviesCount?: number;
  duplicateChannelsCount?: number;
  onDeduplicateMovies?: () => Promise<number> | number;
  onDeduplicateChannels?: () => Promise<number> | number;
  onPurgeDeadChannels?: () => Promise<{ checked: number; removed: number }> | void;
  isCheckingDeadChannels?: boolean;
  onBatchReplaceChannelLogos?: (forceAll?: boolean) => Promise<{ updated: number; total: number } | void>;
  onReplaceSingleChannelLogo?: (channel: LiveChannel, logoUrl: string) => Promise<void> | void;
  isSearchingChannelLogos?: boolean;
  onGenerateMovieSubtitles?: (item: MediaItem) => Promise<void>;
  onSaveBrandingGlobal?: (title: string, hero: string) => Promise<void> | void;
  onOpenCreateMovie?: () => void;
  onEditMovie?: (item: MediaItem) => void;
  onUpdateMovie?: (item: MediaItem) => Promise<void> | void;
  onDeleteMovie?: (id: string) => void;
  onReloadIptv?: () => void;
  isFetchingIPTV?: boolean;
  onOpenLiveTv?: () => void;
  onUpdateCurrentUser?: (updatedUser: UserProfile) => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
  onOpenStremioAddons?: () => void;
  mediaDomainConfig?: MediaDomainConfig;
  onUpdateMediaDomainConfig?: (config: MediaDomainConfig) => void;
  onlineUsers?: OnlinePresenceRecord[];
  initialSection?: string;
  onPickMovieArtwork?: (item: MediaItem) => void;
  onSaveGlobalTheme?: (theme: PlatformTheme) => void;
  recycledItems?: RecycledItem[];
  onRestoreRecycledItem?: (item: RecycledItem) => Promise<void> | void;
  onPermanentDeleteRecycledItem?: (itemId: string) => Promise<void> | void;
  onEmptyRecycleBin?: () => Promise<void> | void;
  onAddToRecycleBin?: (item: RecycledItem) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  user,
  catalog,
  setCatalog,
  appTitle,
  setAppTitle,
  heroImage,
  setHeroImage,
  systemUsers,
  setSystemUsers,
  iptvUrls,
  setIptvUrls,
  allUserDevices = {},
  liveChannels = [],
  duplicateMoviesCount = 0,
  duplicateChannelsCount = 0,
  onDeduplicateMovies,
  onDeduplicateChannels,
  onPurgeDeadChannels,
  isCheckingDeadChannels = false,
  onBatchReplaceChannelLogos,
  onReplaceSingleChannelLogo,
  isSearchingChannelLogos = false,
  onGenerateMovieSubtitles,
  onSaveBrandingGlobal,
  onOpenCreateMovie,
  onEditMovie,
  onUpdateMovie,
  onDeleteMovie,
  onReloadIptv,
  isFetchingIPTV = false,
  onOpenLiveTv,
  onUpdateCurrentUser,
  onOpenRegister,
  onOpenLogin,
  onOpenStremioAddons,
  mediaDomainConfig = DEFAULT_MEDIA_DOMAIN_CONFIG,
  onUpdateMediaDomainConfig,
  onlineUsers = [],
  initialSection,
  onPickMovieArtwork,
  onSaveGlobalTheme,
  recycledItems = [],
  onRestoreRecycledItem,
  onPermanentDeleteRecycledItem,
  onEmptyRecycleBin,
  onAddToRecycleBin,
}) => {
  const { theme: activeTheme, setTheme: setActiveTheme, prefs: interfacePrefs, setPrefs: setInterfacePrefs } = usePlatformTheme();
  const [interfaceSubTab, setInterfaceSubTab] = useState<'themes' | 'display'>('themes');
  const [activeSection, setActiveSection] = useState(initialSection || 'profile');
  const [lastUploadedNotice, setLastUploadedNotice] = useState<{ name: string; count: number } | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    category: 'Sugestões e Pedidos de Conteúdo',
    rating: 5,
    message: '',
  });
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [recycleSearch, setRecycleSearch] = useState('');
  const [recycleCategoryFilter, setRecycleCategoryFilter] = useState<'all' | 'movie_series' | 'channel' | 'addon' | 'iptv' | 'config'>('all');
  const [restoringItemId, setRestoringItemId] = useState<string | null>(null);
  const [confirmEmptyBin, setConfirmEmptyBin] = useState(false);
  const [newIptvUrl, setNewIptvUrl] = useState('');
  const [editingIptvIndex, setEditingIptvIndex] = useState<number | null>(null);
  const [editingIptvValue, setEditingIptvValue] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogTypeFilter, setCatalogTypeFilter] = useState<'all' | 'movie' | 'series'>('all');
  const [userFilter, setUserFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState<string>('ALL');
  const [expandedUserDevicesEmail, setExpandedUserDevicesEmail] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [generatingSubMovieId, setGeneratingSubMovieId] = useState<string | null>(null);
  const [replacingArtworkCatalogId, setReplacingArtworkCatalogId] = useState<string | null>(null);
  const [isBatchReplacingCatalogArtwork, setIsBatchReplacingCatalogArtwork] = useState(false);
  const [batchCatalogArtworkProgress, setBatchCatalogArtworkProgress] = useState<{
    current: number;
    total: number;
    currentTitle: string;
    updatedCount: number;
  } | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('Alterações Salvas com Sucesso');
  const [channelLogoFilter, setChannelLogoFilter] = useState('');
  const [settingsLogoChannel, setSettingsLogoChannel] = useState<LiveChannel | null>(null);
  const [settingsLogoQuery, setSettingsLogoQuery] = useState('');
  const [settingsLogoResults, setSettingsLogoResults] = useState<ChannelLogoResult[]>([]);
  const [isSearchingSettingsLogo, setIsSearchingSettingsLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openSettingsChannelLogoPicker = async (ch: LiveChannel) => {
    setSettingsLogoChannel(ch);
    setSettingsLogoQuery(ch.name);
    setSettingsLogoResults([]);
    setIsSearchingSettingsLogo(true);
    try {
      const results = await searchChannelLogoOnWeb(ch.name);
      setSettingsLogoResults(results);
    } catch {
      setSettingsLogoResults([]);
    } finally {
      setIsSearchingSettingsLogo(false);
    }
  };

  const handleSettingsChannelLogoSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsLogoQuery.trim()) return;
    setIsSearchingSettingsLogo(true);
    try {
      const results = await searchChannelLogoOnWeb(settingsLogoQuery.trim());
      setSettingsLogoResults(results);
    } catch {
      setSettingsLogoResults([]);
    } finally {
      setIsSearchingSettingsLogo(false);
    }
  };

  const handleReplaceSingleCatalogItemArtwork = async (item: MediaItem) => {
    setReplacingArtworkCatalogId(item.id);
    try {
      const q = (item.originalTitle || item.title).trim();
      const results = await searchOriginalMovieArtwork(q, item.type === 'series' ? 'series' : 'movie');
      if (results.length === 0) {
        triggerToast(`Nenhuma capa original encontrada na web para "${item.title}".`);
        return;
      }
      const topArt = results[0];
      const updatedItem: MediaItem = {
        ...item,
        thumbnailUrl: topArt.posterUrl,
        bannerUrl: topArt.bannerUrl || topArt.posterUrl,
        originalTitle: item.originalTitle || topArt.originalTitle || topArt.title,
        synopsis: item.synopsis || topArt.synopsis,
        imdbScore: item.imdbScore || topArt.imdbScore,
        year: item.year || topArt.year,
      };

      if (onUpdateMovie) {
        await onUpdateMovie(updatedItem);
      } else {
        setCatalog((prev) => prev.map((m) => (m.id === updatedItem.id ? updatedItem : m)));
      }
      triggerToast(`Capa e banner de "${item.title}" substituídos com a imagem original da web!`);
    } catch (err) {
      triggerToast(`Erro ao buscar capa na web: ${err instanceof Error ? err.message : 'Falha na conexão'}`);
    } finally {
      setReplacingArtworkCatalogId(null);
    }
  };

  const handleToggleMovieMenuType = async (item: MediaItem) => {
    const isSeries = item.type === 'series';
    const targetType: 'movie' | 'series' = isSeries ? 'movie' : 'series';
    const updatedItem: MediaItem = {
      ...item,
      type: targetType,
      stremioType: targetType,
      duration: targetType === 'series' && (!item.duration || item.duration.includes('h')) ? 'Série' : item.duration,
    };
    if (onUpdateMovie) {
      await onUpdateMovie(updatedItem);
    } else {
      setCatalog((prev) => prev.map((m) => (m.id === updatedItem.id ? updatedItem : m)));
    }
    triggerToast(`"${item.title}" movido para o menu ${targetType === 'series' ? 'Séries' : 'Filmes'} para todos os utilizadores!`);
  };

  const handleBatchReplaceAllCatalogArtwork = async () => {
    if (catalog.length === 0) return;
    setIsBatchReplacingCatalogArtwork(true);
    let updatedCount = 0;
    setBatchCatalogArtworkProgress({
      current: 0,
      total: catalog.length,
      currentTitle: '',
      updatedCount: 0,
    });

    for (let i = 0; i < catalog.length; i++) {
      const item = catalog[i];
      setBatchCatalogArtworkProgress({
        current: i + 1,
        total: catalog.length,
        currentTitle: item.title,
        updatedCount,
      });

      try {
        const q = (item.originalTitle || item.title).trim();
        const results = await searchOriginalMovieArtwork(q, item.type === 'series' ? 'series' : 'movie');
        if (results.length > 0) {
          const topArt = results[0];
          const updatedItem: MediaItem = {
            ...item,
            thumbnailUrl: topArt.posterUrl,
            bannerUrl: topArt.bannerUrl || topArt.posterUrl,
            originalTitle: item.originalTitle || topArt.originalTitle || topArt.title,
            synopsis: item.synopsis || topArt.synopsis,
            imdbScore: item.imdbScore || topArt.imdbScore,
            year: item.year || topArt.year,
          };
          if (onUpdateMovie) {
            await onUpdateMovie(updatedItem);
          } else {
            setCatalog((prev) => prev.map((m) => (m.id === updatedItem.id ? updatedItem : m)));
          }
          updatedCount++;
        }
      } catch {
        // gracefully continue
      }
    }

    setIsBatchReplacingCatalogArtwork(false);
    setBatchCatalogArtworkProgress(null);
    triggerToast(
      `Concluído: ${updatedCount} de ${catalog.length} filmes tiveram capa e banner substituídos com as imagens originais da web!`
    );
  };

  // Media Storage Domain & Vault States
  const [domainInput, setDomainInput] = useState(mediaDomainConfig.customDomain);
  const [domainLabel, setDomainLabel] = useState(mediaDomainConfig.displayLabel);
  const [domainEnabled, setDomainEnabled] = useState(mediaDomainConfig.streamingEnabled);
  const [savingDomain, setSavingDomain] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<VaultMediaFile[]>([]);
  const [vaultTotalBytes, setVaultTotalBytes] = useState(0);
  const [loadingVault, setLoadingVault] = useState(false);
  const [streamTestStatus, setStreamTestStatus] = useState<string | null>(null);

  useEffect(() => {
    setDomainInput(mediaDomainConfig.customDomain);
    setDomainLabel(mediaDomainConfig.displayLabel);
    setDomainEnabled(mediaDomainConfig.streamingEnabled);
  }, [mediaDomainConfig]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const loadVaultRepository = async () => {
    setLoadingVault(true);
    try {
      const res = await listVaultMediaFiles();
      setVaultFiles(res.files || []);
      setVaultTotalBytes(res.totalBytes || 0);
    } catch {
      // ignore
    } finally {
      setLoadingVault(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'admin_domain') {
      loadVaultRepository();
    }
  }, [activeSection]);

  // Direct channel add state
  const [showDirectChannelForm, setShowDirectChannelForm] = useState(false);
  const [directChannelName, setDirectChannelName] = useState('');
  const [directChannelUrl, setDirectChannelUrl] = useState('');
  const [directChannelCategory, setDirectChannelCategory] = useState('Variedades');

  // Uploaded M3U Files State
  const [uploadedIptvFiles, setUploadedIptvFiles] = useState<UploadedIPTVFile[]>(() => {
    const saved = localStorage.getItem('salgueiro_uploaded_iptv');
    return saved ? JSON.parse(saved) : [];
  });

  // Device Management State (Max 4 devices per account)
  const userEmail = user?.email || 'salgueiro.user@streaming.com';
  const [userDevices, setUserDevices] = useState<UserDevice[]>(() => getUserDevices(userEmail));
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceType, setNewDeviceType] = useState<'tv' | 'mobile' | 'desktop'>('tv');

  useEffect(() => {
    if (user?.email) {
      setUserDevices(getUserDevices(user.email));
    }
  }, [user]);

  // Account Monthly Payment Editing States
  const defaultDates = getDefaultDatesForMonthlyPlan();
  const [editPayDate, setEditPayDate] = useState<string>(user?.paymentDate || defaultDates.paymentDate);
  const [editExpDate, setEditExpDate] = useState<string>(user?.expirationDate || defaultDates.expirationDate);
  const [editPayStatus, setEditPayStatus] = useState<UserProfile['paymentStatus']>(user?.paymentStatus || 'Ativo');
  const [editPayMethod, setEditPayMethod] = useState<string>(user?.paymentMethod || 'Multicaixa Express');
  const [editMonthlyPrice, setEditMonthlyPrice] = useState<string>(user?.monthlyPrice || '5.000 Kz / mês');
  const [editingUserEmail, setEditingUserEmail] = useState<string | null>(null);
  const [editingRowPayDate, setEditingRowPayDate] = useState<string>('');
  const [editingRowExpDate, setEditingRowExpDate] = useState<string>('');
  const [editingRowStatus, setEditingRowStatus] = useState<string>('Ativo');

  useEffect(() => {
    if (user) {
      const defs = getDefaultDatesForMonthlyPlan();
      setEditPayDate(user.paymentDate || defs.paymentDate);
      setEditExpDate(user.expirationDate || defs.expirationDate);
      setEditPayStatus(user.paymentStatus || 'Ativo');
      setEditPayMethod(user.paymentMethod || 'Multicaixa Express');
      setEditMonthlyPrice(user.monthlyPrice || '5.000 Kz / mês');
    }
  }, [user]);

  const formatPtDate = (isoDate?: string) => {
    if (!isoDate) return 'Não definida';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getValidityMetrics = (payDateStr?: string, expDateStr?: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = expDateStr ? new Date(expDateStr + 'T00:00:00') : new Date(today.getTime() + 30 * 86400000);
    const pay = payDateStr ? new Date(payDateStr + 'T00:00:00') : today;

    const totalMs = Math.max(86400000, exp.getTime() - pay.getTime());
    const remainingMs = exp.getTime() - today.getTime();
    const daysRemaining = Math.ceil(remainingMs / 86400000);
    const totalDays = Math.max(1, Math.round(totalMs / 86400000));
    const progressPercent = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDays) * 100)));

    return { daysRemaining, totalDays, progressPercent, isExpired: daysRemaining <= 0 };
  };

  const handleRenewMonthlyPayment = async () => {
    if (!user) return;
    const { paymentDate, expirationDate } = getDefaultDatesForMonthlyPlan();
    const updatedUser: UserProfile = {
      ...user,
      paymentDate,
      expirationDate,
      paymentStatus: 'Ativo',
      monthlyPrice: editMonthlyPrice || user.monthlyPrice || '5.000 Kz / mês',
      paymentMethod: editPayMethod || user.paymentMethod || 'Multicaixa Express',
    };
    setEditPayDate(paymentDate);
    setEditExpDate(expirationDate);
    setEditPayStatus('Ativo');
    if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
    setSystemUsers(prev =>
      prev.map(u =>
        u.email.toLowerCase() === user.email.toLowerCase()
          ? { ...u, paymentDate, expirationDate, paymentStatus: 'Ativo' }
          : u
      )
    );
    await saveUserAccountPayment(updatedUser).catch(() => {});
    triggerToast('Pagamento mensal renovado com sucesso (+30 dias de validade)!');
  };

  const handleSaveAccountPaymentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const updatedUser: UserProfile = {
      ...user,
      paymentDate: editPayDate,
      expirationDate: editExpDate,
      paymentStatus: editPayStatus,
      paymentMethod: editPayMethod,
      monthlyPrice: editMonthlyPrice,
    };
    if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
    setSystemUsers(prev =>
      prev.map(u =>
        u.email.toLowerCase() === user.email.toLowerCase()
          ? { ...u, paymentDate: editPayDate, expirationDate: editExpDate, paymentStatus: editPayStatus }
          : u
      )
    );
    await saveUserAccountPayment(updatedUser).catch(() => {});
    triggerToast('Datas e informações de pagamento atualizadas!');
  };

  const handleSaveUserRowPayment = async (u: any) => {
    const isActive = editingRowStatus !== 'Desativado';
    const updated = {
      ...u,
      accountActive: isActive,
      paymentDate: editingRowPayDate,
      expirationDate: editingRowExpDate,
      paymentStatus: editingRowStatus as UserProfile['paymentStatus'],
    };
    setSystemUsers(prev => prev.map(item => (item.email === u.email ? updated : item)));
    if (user && user.email.toLowerCase() === u.email.toLowerCase() && onUpdateCurrentUser) {
      onUpdateCurrentUser({
        ...user,
        accountActive: isActive,
        paymentDate: editingRowPayDate,
        expirationDate: editingRowExpDate,
        paymentStatus: editingRowStatus as UserProfile['paymentStatus'],
      });
    }
    await saveUserAccountPayment({
      email: u.email,
      name: u.name,
      role: u.role || 'user',
      accountActive: isActive,
      paymentDate: editingRowPayDate,
      expirationDate: editingRowExpDate,
      paymentStatus: editingRowStatus as UserProfile['paymentStatus'],
      planName: u.planName || 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
      monthlyPrice: u.monthlyPrice || '5.000 Kz / mês',
      paymentMethod: u.paymentMethod || 'Multicaixa Express',
    }).catch(() => {});
    setEditingUserEmail(null);
    triggerToast(`Pagamento de "${u.name}" atualizado!`);
  };

  const handleDisconnectDevice = (deviceId: string, devName: string) => {
    const confirm = window.confirm(`Deseja desconectar o dispositivo "${devName}" da sua conta?`);
    if (!confirm) return;
    const updated = disconnectDevice(userEmail, deviceId);
    setUserDevices(updated);
    triggerToast(`Dispositivo "${devName}" desconectado com sucesso.`);
  };

  const handleAddCustomDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;
    const res = addCustomDevice(userEmail, newDeviceName.trim(), newDeviceType);
    if (!res.success) {
      triggerToast('Limite de 4 dispositivos já atingido!');
      return;
    }
    setUserDevices(res.devices);
    setNewDeviceName('');
    setShowAddDeviceModal(false);
    triggerToast(`Dispositivo "${newDeviceName}" conectado!`);
  };

  const renderDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-4 h-4 text-sky-400" />;
      case 'tv': return <Tv className="w-4 h-4 text-amber-400" />;
      case 'tablet': return <Tablet className="w-4 h-4 text-emerald-400" />;
      default: return <Monitor className="w-4 h-4 text-[#7b5be4]" />;
    }
  };

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const adminOnlySections = ['interface', 'addons', 'admin_online', 'admin_domain', 'admin_branding', 'admin_content', 'recycle_bin', 'users', 'permissions'];
    if (initialSection) {
      if (initialSection === 'install') {
        setActiveSection('profile');
      } else if (!isAdmin && adminOnlySections.includes(initialSection)) {
        setActiveSection('profile');
      } else {
        setActiveSection(initialSection);
      }
    }
  }, [initialSection, isAdmin]);

  useEffect(() => {
    const adminOnlySections = ['interface', 'addons', 'admin_online', 'admin_domain', 'admin_branding', 'admin_content', 'recycle_bin', 'users', 'permissions'];
    if (activeSection === 'install') {
      setActiveSection('profile');
    } else if (!isAdmin && adminOnlySections.includes(activeSection)) {
      setActiveSection('profile');
    }
  }, [isAdmin, activeSection]);

  const menuItems = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'streaming', label: 'Qualidade', icon: Tv },
    ...(isAdmin ? [
      { id: 'interface', label: 'Interface', icon: Globe, admin: true },
      { id: 'addons', label: 'Listas e IPTV', icon: Puzzle, admin: true },
      { id: 'admin_online', label: `Utilizadores Online (${onlineUsers.length})`, icon: Activity, admin: true },
      { id: 'admin_domain', label: 'Domínio & Streaming', icon: HardDrive, admin: true },
      { id: 'admin_branding', label: 'Identidade Visual', icon: Palette, admin: true },
      { id: 'admin_content', label: 'Gestão de Conteúdo', icon: Film, admin: true },
      { id: 'recycle_bin', label: 'Reciclagem', icon: Trash2, admin: true, badge: recycledItems.length > 0 ? recycledItems.length : undefined },
      { id: 'users', label: 'Utilizadores', icon: Users, admin: true },
      { id: 'permissions', label: 'Cargos e Permissões', icon: Lock, admin: true },
    ] : []),
    { id: 'account', label: 'Conta', icon: CreditCard },
    { id: 'security', label: 'Segurança', icon: ShieldCheck },
    { id: 'about', label: 'Sobre', icon: Info },
  ];

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  const handleRemoveContent = (id: string, title: string) => {
    const confirmed = window.confirm(`Tem a certeza que deseja eliminar "${title}" do catálogo?`);
    if (!confirmed) return;

    if (onDeleteMovie) {
      onDeleteMovie(id);
    } else {
      setCatalog(prev => prev.filter(item => item.id !== id));
    }
    triggerToast(`"${title}" foi removido do catálogo com sucesso.`);
  };

  const handleRemoveUser = async (email: string) => {
    setSystemUsers(prev => prev.filter(u => u.email !== email));
    await deleteUserAccountFromFirestore(email).catch(() => {});
    triggerToast('Utilizador removido globalmente da plataforma.');
  };

  const handleRenewUser30Days = async (u: any) => {
    const today = new Date();
    const payDateStr = today.toISOString().split('T')[0];
    const expDateObj = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expDateStr = expDateObj.toISOString().split('T')[0];

    setSystemUsers(prev =>
      prev.map(item =>
        item.email?.toLowerCase() === u.email?.toLowerCase()
          ? { ...item, paymentDate: payDateStr, expirationDate: expDateStr, accountActive: true, paymentStatus: 'Ativo' }
          : item
      )
    );

    await saveUserAccountPayment({
      email: u.email,
      name: u.name || u.email.split('@')[0],
      role: u.role || 'user',
      avatarUrl: u.avatarUrl,
      accountActive: true,
      planName: u.planName || 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
      monthlyPrice: u.monthlyPrice || '5.000 Kz / mês',
      paymentDate: payDateStr,
      expirationDate: expDateStr,
      paymentStatus: 'Ativo',
      paymentMethod: u.paymentMethod || 'Multicaixa Express',
    }).catch(() => {});

    triggerToast(`Mensalidade de "${u.name || u.email}" renovada por mais 30 dias (Até ${expDateStr})!`);
  };

  const handleCreateUserByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) {
      triggerToast('Insira um email válido para o novo utilizador.');
      return;
    }
    const today = new Date();
    const payDateStr = today.toISOString().split('T')[0];
    const expDateObj = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expDateStr = expDateObj.toISOString().split('T')[0];

    const newUserObj = {
      name: newUserName.trim() || newUserEmail.split('@')[0],
      email: newUserEmail.trim().toLowerCase(),
      initial: (newUserName.trim() || newUserEmail).substring(0, 2).toUpperCase(),
      role: newUserRole,
      accountActive: true,
      paymentStatus: 'Ativo' as UserProfile['paymentStatus'],
      paymentDate: payDateStr,
      expirationDate: expDateStr,
      planName: 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
      monthlyPrice: '5.000 Kz / mês',
    };

    setSystemUsers(prev => [newUserObj, ...prev]);
    await saveUserAccountPayment(newUserObj).catch(() => {});
    triggerToast(`Utilizador "${newUserObj.name}" criado com sucesso (30 dias de acesso)!`);
    setNewUserEmail('');
    setNewUserName('');
    setNewUserRole('user');
    setShowAddUserModal(false);
  };

  const handleToggleUserAccountActive = async (u: any) => {
    const currentlyActive = u.accountActive !== false && u.paymentStatus !== 'Desativado';
    const nextActive = !currentlyActive;
    const nextStatus: UserProfile['paymentStatus'] = nextActive ? 'Ativo' : 'Desativado';

    setSystemUsers(prev =>
      prev.map(item =>
        item.email?.toLowerCase() === u.email?.toLowerCase()
          ? { ...item, accountActive: nextActive, paymentStatus: nextStatus }
          : item
      )
    );

    await saveUserAccountPayment({
      email: u.email,
      name: u.name || u.email.split('@')[0],
      role: u.role || 'user',
      avatarUrl: u.avatarUrl,
      accountActive: nextActive,
      planName: u.planName || 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
      monthlyPrice: u.monthlyPrice || '5.000 Kz / mês',
      paymentDate: u.paymentDate || defaultDates.paymentDate,
      expirationDate: u.expirationDate || defaultDates.expirationDate,
      paymentStatus: nextStatus,
      paymentMethod: u.paymentMethod || 'Multicaixa Express',
    }).catch(() => {});

    triggerToast(
      nextActive
        ? `Conta de "${u.name}" ativada para toda a plataforma.`
        : `Conta de "${u.name}" desativada e bloqueada.`
    );
  };

  const handleAdminToggleDevice = (targetEmail: string, device: UserDevice, list: UserDevice[]) => {
    const nextEnabled = device.enabled === false;
    setUserDeviceEnabled(targetEmail, device.id, nextEnabled, list);
    triggerToast(
      nextEnabled
        ? `Dispositivo "${device.name}" ativado!`
        : `Dispositivo "${device.name}" desativado!`
    );
  };

  const handleAdminRemoveDevice = (targetEmail: string, device: UserDevice, list: UserDevice[]) => {
    disconnectDevice(targetEmail, device.id, list);
    triggerToast(`Dispositivo "${device.name}" desconectado da conta.`);
  };

  const handleAddIptv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newIptvUrl && !iptvUrls.includes(newIptvUrl)) {
      const updated = [...iptvUrls, newIptvUrl];
      setIptvUrls(updated);
      localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(updated));
      const listName = newIptvUrl.split('/').pop() || 'Lista IPTV';
      setLastUploadedNotice({ name: listName, count: 0 });
      setNewIptvUrl('');
      triggerToast('Lista IPTV adicionada e sincronizada para todos!');
      window.dispatchEvent(new CustomEvent('salgueiro:iptv-updated'));
      if (onReloadIptv) onReloadIptv();
      await syncIptvToGlobal(updated, uploadedIptvFiles, user?.email || 'admin').catch(() => {});
    }
  };

  const handleStartEditIptv = (index: number, currentVal: string) => {
    setEditingIptvIndex(index);
    setEditingIptvValue(currentVal);
  };

  const handleSaveEditIptv = async (index: number) => {
    if (!editingIptvValue.trim()) return;
    const updated = [...iptvUrls];
    updated[index] = editingIptvValue.trim();
    setIptvUrls(updated);
    localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(updated));
    setEditingIptvIndex(null);
    setEditingIptvValue('');
    triggerToast('Link IPTV atualizado e sincronizado globalmente!');
    window.dispatchEvent(new CustomEvent('salgueiro:iptv-updated'));
    if (onReloadIptv) onReloadIptv();
    await syncIptvToGlobal(updated, uploadedIptvFiles, user?.email || 'admin').catch(() => {});
  };

  const handleRemoveIptv = async (url: string) => {
    const confirmed = window.confirm('Deseja remover esta lista IPTV para toda a plataforma?');
    if (!confirmed) return;
    if (onAddToRecycleBin) {
      await onAddToRecycleBin({
        id: `recycle_iptv_${encodeURIComponent(url).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
        originalId: url,
        type: 'iptv_url',
        title: url.split('/').pop() || 'Lista IPTV (.m3u/.m3u8)',
        subtitle: url,
        category: 'Lista IPTV',
        data: { url },
        deletedAt: new Date().toISOString(),
        deletedBy: user?.email || 'admin',
      }).catch(() => {});
    }
    const updated = iptvUrls.filter(u => u !== url);
    setIptvUrls(updated);
    localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(updated));
    triggerToast('Lista IPTV movida para a Reciclagem.');
    window.dispatchEvent(new CustomEvent('salgueiro:iptv-updated'));
    if (onReloadIptv) onReloadIptv();
    await syncIptvToGlobal(updated, uploadedIptvFiles, user?.email || 'admin').catch(() => {});
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const parsed = parseM3U(content);
        const newFile: UploadedIPTVFile = {
          id: `iptv-file-${Date.now()}`,
          name: file.name,
          content: content,
          channelCount: parsed.length,
          uploadedAt: new Date().toLocaleDateString('pt-AO')
        };
        const updatedFiles = [...uploadedIptvFiles, newFile];
        setUploadedIptvFiles(updatedFiles);
        localStorage.setItem('salgueiro_uploaded_iptv', JSON.stringify(updatedFiles));
        setLastUploadedNotice({ name: file.name, count: parsed.length });
        window.dispatchEvent(new CustomEvent('salgueiro:iptv-updated'));
        triggerToast(`Ficheiro "${file.name}" carregado (${parsed.length} canais) e pronto em TV ao Vivo!`);
        if (onReloadIptv) onReloadIptv();
        await syncIptvToGlobal(iptvUrls, updatedFiles, user?.email || 'admin').catch(() => {});
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handleRemoveUploadedFile = async (id: string, name: string) => {
    const confirmed = window.confirm(`Deseja remover o ficheiro "${name}" para toda a plataforma?`);
    if (!confirmed) return;
    const removedFile = uploadedIptvFiles.find(f => f.id === id);
    if (removedFile && onAddToRecycleBin) {
      await onAddToRecycleBin({
        id: `recycle_iptvfile_${removedFile.id}`,
        originalId: removedFile.id,
        type: 'iptv_file',
        title: removedFile.name,
        subtitle: `${removedFile.channelCount} canais • Carregado em ${removedFile.uploadedAt}`,
        category: 'Ficheiro M3U',
        data: removedFile,
        deletedAt: new Date().toISOString(),
        deletedBy: user?.email || 'admin',
      }).catch(() => {});
    }
    const updated = uploadedIptvFiles.filter(f => f.id !== id);
    setUploadedIptvFiles(updated);
    localStorage.setItem('salgueiro_uploaded_iptv', JSON.stringify(updated));
    triggerToast(`Ficheiro "${name}" movido para a Reciclagem.`);
    if (onReloadIptv) onReloadIptv();
    await syncIptvToGlobal(iptvUrls, updated, user?.email || 'admin').catch(() => {});
  };

  const handleAddDirectChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directChannelName.trim() || !directChannelUrl.trim()) return;

    // Direct .m3u8 links are supported in iptvUrls
    const updated = [...iptvUrls, directChannelUrl.trim()];
    setIptvUrls(updated);
    localStorage.setItem('salgueiro_iptv_urls', JSON.stringify(updated));
    setDirectChannelName('');
    setDirectChannelUrl('');
    setShowDirectChannelForm(false);
    triggerToast('Canal direto adicionado e sincronizado para todos!');
    if (onReloadIptv) onReloadIptv();
    await syncIptvToGlobal(updated, uploadedIptvFiles, user?.email || 'admin').catch(() => {});
  };

  const handlePurgeAllIptv = async () => {
    const confirmed = window.confirm('Deseja remover TODAS as listas IPTV e servidores externos inativos?');
    if (!confirmed) return;
    if (onAddToRecycleBin) {
      await Promise.allSettled([
        ...iptvUrls.map((url) =>
          onAddToRecycleBin({
            id: `recycle_iptv_${encodeURIComponent(url).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
            originalId: url,
            type: 'iptv_url',
            title: url.split('/').pop() || 'Lista IPTV',
            subtitle: url,
            category: 'Lista IPTV',
            data: { url },
            deletedAt: new Date().toISOString(),
            deletedBy: user?.email || 'admin',
          })
        ),
        ...uploadedIptvFiles.map((f) =>
          onAddToRecycleBin({
            id: `recycle_iptvfile_${f.id}`,
            originalId: f.id,
            type: 'iptv_file',
            title: f.name,
            subtitle: `${f.channelCount} canais`,
            category: 'Ficheiro M3U',
            data: f,
            deletedAt: new Date().toISOString(),
            deletedBy: user?.email || 'admin',
          })
        ),
      ]);
    }
    setIptvUrls([]);
    setUploadedIptvFiles([]);
    localStorage.removeItem('salgueiro_iptv_urls');
    localStorage.removeItem('salgueiro_uploaded_iptv');
    triggerToast('Listas IPTV movidas para a Reciclagem.');
    if (onReloadIptv) onReloadIptv();
    await syncIptvToGlobal([], [], user?.email || 'admin').catch(() => {});
  };

  const handleSaveBranding = async (nextTitle?: string, nextHero?: string) => {
    if (onAddToRecycleBin && (appTitle || heroImage)) {
      await onAddToRecycleBin({
        id: `recycle_config_branding_${Date.now()}`,
        originalId: 'branding_snapshot',
        type: 'config',
        title: `Identidade Visual anterior (${appTitle})`,
        subtitle: `Snapshot antes da alteração • Hero: ${heroImage.slice(0, 50)}...`,
        category: 'Configuração',
        data: { appTitle, heroImage },
        deletedAt: new Date().toISOString(),
        deletedBy: user?.email || 'admin',
      }).catch(() => {});
    }
    const t = nextTitle ?? appTitle;
    const h = nextHero ?? heroImage;
    if (onSaveBrandingGlobal) {
      await onSaveBrandingGlobal(t, h);
    }
    triggerToast('Identidade visual atualizada e sincronizada para toda a plataforma!');
  };

  const handleSaveDomainSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeDomainName(domainInput);
    if (!cleaned || !isValidDomainName(cleaned)) {
      triggerToast('Insira um domínio válido (ex: media.salgueirostreaming.ao)');
      return;
    }
    setSavingDomain(true);
    try {
      if (onAddToRecycleBin && mediaDomainConfig?.customDomain && mediaDomainConfig.customDomain !== cleaned) {
        await onAddToRecycleBin({
          id: `recycle_config_domain_${Date.now()}`,
          originalId: 'domain_snapshot',
          type: 'config',
          title: `Configuração de Domínio anterior (${mediaDomainConfig.customDomain})`,
          subtitle: `${mediaDomainConfig.displayLabel} • Streaming ${mediaDomainConfig.streamingEnabled ? 'Ativo' : 'Inativo'}`,
          category: 'Configuração',
          data: { mediaDomainConfig },
          deletedAt: new Date().toISOString(),
          deletedBy: user?.email || 'admin',
        }).catch(() => {});
      }
      const saved = await updateMediaDomainConfig({
        customDomain: cleaned,
        displayLabel: domainLabel.trim() || 'Salgueiro Media Cloud Angola',
        streamingEnabled: domainEnabled,
        updatedBy: user?.email || 'admin',
      });
      await saveMediaDomainConfigToFirestore(
        {
          customDomain: saved.customDomain,
          displayLabel: saved.displayLabel,
          streamingEnabled: saved.streamingEnabled,
        },
        user?.email || 'admin'
      ).catch(() => {});
      if (onUpdateMediaDomainConfig) {
        onUpdateMediaDomainConfig(saved);
      }
      setDomainInput(saved.customDomain);
      triggerToast(`Domínio "${saved.customDomain}" ativado para armazenamento e streaming!`);
    } catch {
      triggerToast('Não foi possível guardar o domínio. Tente novamente.');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleDeleteVaultFile = async (file: VaultMediaFile) => {
    if (!window.confirm(`Deseja eliminar "${file.filename}" do armazenamento do domínio?`)) return;
    try {
      await deleteVaultMediaFile(file.folder, file.filename);
      setVaultFiles((prev) => prev.filter((f) => f.filename !== file.filename));
      setVaultTotalBytes((prev) => Math.max(0, prev - file.size));
      triggerToast(`Ficheiro "${file.filename}" removido do domínio.`);
    } catch {
      triggerToast('Falha ao eliminar ficheiro do domínio.');
    }
  };

  const handleTestDomainStreaming = async () => {
    setStreamTestStatus('A verificar servidor de streaming HTTP 206...');
    try {
      const healthRes = await fetch('/api/media/domain-config');
      if (!healthRes.ok) throw new Error('offline');
      const firstVideo = vaultFiles.find((f) => f.folder === 'videos');
      if (firstVideo) {
        const rangeRes = await fetch(firstVideo.streamPath, {
          headers: { Range: 'bytes=0-15' },
        });
        if (rangeRes.status === 206 || rangeRes.ok) {
          setStreamTestStatus(
            `Ativo (HTTP ${rangeRes.status} Partial Content) — streaming instantâneo operacional para ${firstVideo.filename}`
          );
          return;
        }
      }
      setStreamTestStatus('Domínio ativo e pronto para armazenar e transmitir filmes via HTTP 206 Range.');
    } catch {
      setStreamTestStatus('Erro ao comunicar com o servidor de streaming.');
    }
  };

  const handleChangeAvatar = async (newAvatarUrl: string) => {
    if (!user) return;
    const updatedUser: UserProfile = {
      ...user,
      avatarUrl: newAvatarUrl,
    };
    if (onUpdateCurrentUser) onUpdateCurrentUser(updatedUser);
    setSystemUsers(prev =>
      prev.map(u =>
        u.email.toLowerCase() === user.email.toLowerCase()
          ? { ...u, avatarUrl: newAvatarUrl }
          : u
      )
    );
    await saveUserAccountPayment(updatedUser).catch(() => {});
    triggerToast('Avatar atualizado com sucesso!');
  };

  const resolvedUserAvatar = user?.avatarUrl || (isAdmin ? DEFAULT_ADMIN_AVATAR : '');

  return (
    <div className="max-w-6xl mx-auto animate-fade-in pb-20">
      {showSaveToast && (
        <div className="fixed top-8 right-8 z-[200] bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right">
          <Check className="w-5 h-5" />
          <span className="font-bold text-sm uppercase tracking-widest">{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center gap-4 mb-10 pb-6 border-b border-[#2d3139]">
        {resolvedUserAvatar ? (
          <div className={`w-12 h-12 rounded-2xl overflow-hidden shadow-lg ring-2 shrink-0 ${isAdmin ? 'ring-amber-500' : 'ring-[#7b5be4]'}`}>
            <img src={resolvedUserAvatar} alt={user?.name || 'Avatar'} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="p-3 bg-[#7b5be4] rounded-2xl shadow-lg">
            <Monitor className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Painel de Controlo</h1>
              {isAdmin && (
                <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                  Modo Administrador
                </span>
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveSection('admin_online')}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 rounded-xl text-emerald-300 text-xs font-black uppercase tracking-wider transition-all"
                title="Ver detalhes de todos os utilizadores online agora"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{onlineUsers.length} Utilizadores Online</span>
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Acesso total ao ecossistema Salgueiro Streaming' : 'Gerencie sua experiência Salgueiro Streaming'}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Left Sidebar Menu */}
        <div className="w-full lg:w-72 flex-none space-y-1">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  isActive 
                    ? 'bg-[#7b5be4] text-white shadow-lg shadow-[#7b5be4]/20' 
                    : 'text-slate-400 hover:text-white hover:bg-[#161a22] border border-transparent hover:border-[#2d3139]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : ''}`} />
                  <span className="font-bold text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {(item as any).badge !== undefined && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                      {(item as any).badge}
                    </span>
                  )}
                  {item.admin && !isActive && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </div>
              </button>
            );
          })}

          {/* Benefit Highlight Card */}
          <div className="mt-5 p-4 rounded-2xl bg-gradient-to-br from-[#7b5be4]/20 via-[#161a22] to-amber-500/10 border border-[#7b5be4]/35 space-y-2.5 shadow-lg">
            <div className="flex items-center gap-2 text-amber-400">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-widest">Incluso na Assinatura</span>
            </div>
            <p className="text-xs font-black text-white leading-relaxed">
              TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
            </p>
          </div>



          {/* Support and Creator Footer */}
          <div className="pt-4 mt-4 border-t border-[#2d3139]/80 space-y-2 text-[11px] text-slate-400">
            <p className="font-bold text-slate-300">
              Criado por <span className="text-white font-black">Salgueiro Araujo</span>
            </p>
            <p className="flex items-center gap-1.5 flex-wrap">
              <span>Linha de atendimento :</span>
              <a
                href="tel:+244923742598"
                className="text-amber-400 hover:text-amber-300 font-bold hover:underline"
              >
                +244 923742598
              </a>
            </p>
            <p className="text-[10px] text-slate-500 leading-tight">
              © 2026 Salgueiro Streaming Angola e Transmissões ao Vivo S.A. Todos os direitos reservados.
            </p>
          </div>
        </div>

        {/* Main Settings Content */}
        <div className="flex-1 bg-[#161a22] rounded-[32px] border border-[#2d3139] p-8 lg:p-12 overflow-hidden relative min-h-[500px]">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#7b5be4]/5 blur-[100px] rounded-full pointer-events-none" />
          
          {activeSection === 'profile' && (
            <div className="space-y-10 animate-fade-in">
              <div className="flex flex-col sm:flex-row items-center gap-8 pb-10 border-b border-[#2d3139]/50">
                <div className={`w-32 h-32 rounded-full overflow-hidden bg-gradient-to-tr ${isAdmin ? 'from-amber-500 to-orange-400 ring-amber-500/60' : 'from-[#7b5be4] to-[#38bdf8] ring-[#2d3139]'} flex items-center justify-center text-white text-4xl font-black ring-4 shadow-2xl shrink-0`}>
                  {resolvedUserAvatar ? (
                    <img src={resolvedUserAvatar} alt={user?.name || 'Avatar'} className="w-full h-full object-cover" />
                  ) : (
                    user?.name.substring(0, 2).toUpperCase() || 'SA'
                  )}
                </div>
                <div className="text-center sm:text-left space-y-3">
                  <div>
                    <h2 className="text-2xl font-black text-white tracking-tight">{user?.name || 'Salgueiro User'}</h2>
                    <p className="text-slate-400 text-sm">{user?.email || 'convidado@streaming.com'}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                    <span className={`${isAdmin ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'} border px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest`}>
                      {isAdmin ? 'Administrador Root' : 'Plano Premium'}
                    </span>
                    <span className="bg-white/5 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Localização: Angola</span>
                  </div>
                  {user && (
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-1">Avatar:</span>
                      {PRESET_AVATARS.map((av, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleChangeAvatar(av)}
                          className={`w-9 h-9 rounded-full overflow-hidden border-2 bg-[#92c5ff] transition-all ${
                            resolvedUserAvatar === av
                              ? isAdmin
                                ? 'border-amber-500 scale-110 shadow-md shadow-amber-500/30'
                                : 'border-[#7b5be4] scale-110 shadow-md shadow-[#7b5be4]/30'
                              : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          title={`Escolher Avatar ${idx + 1}`}
                        >
                          <img src={av} alt={`Avatar ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 4-Device Management Card */}
                <div className="lg:col-span-2 p-6 bg-[#0c0d10] rounded-2xl border border-[#2d3139]/50 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[#7b5be4]">
                      <Smartphone className="w-5 h-5" />
                      <div>
                        <h3 className="font-bold text-sm uppercase tracking-widest text-white">Dispositivos Autorizados</h3>
                        <p className="text-[10px] text-slate-400">Até 4 conexões simultâneas por conta</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 bg-[#7b5be4]/20 border border-[#7b5be4]/40 text-[#7b5be4] rounded-lg text-xs font-black">
                        {userDevices.length} / {MAX_DEVICES_PER_ACCOUNT} Dispositivos
                      </span>
                    </div>
                  </div>

                  {/* 4 Slots Indicator */}
                  <div className="grid grid-cols-4 gap-2 py-1">
                    {[0, 1, 2, 3].map((slotIdx) => {
                      const isOccupied = slotIdx < userDevices.length;
                      return (
                        <div key={slotIdx} className="space-y-1">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isOccupied ? 'bg-[#7b5be4] shadow-[0_0_8px_#7b5be4]' : 'bg-white/10'
                            }`}
                          />
                          <p className="text-[9px] text-center text-slate-500 font-bold uppercase">
                            Slot {slotIdx + 1}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Connected Devices List */}
                  <div className="space-y-2.5">
                    {userDevices.map((dev) => (
                      <div
                        key={dev.id}
                        className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-[#161a22] flex items-center justify-center shrink-0 border border-[#2d3139]">
                            {renderDeviceIcon(dev.type)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white font-bold truncate">{dev.name}</span>
                              {dev.isCurrent && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase">
                                  Este Dispositivo
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {dev.browserOrOs} • {dev.location} • <span className="text-slate-500">{dev.lastActive}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDisconnectDevice(dev.id, dev.name)}
                          className="p-2 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-all rounded-lg shrink-0"
                          title="Desconectar este dispositivo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Device Button / Form */}
                  {userDevices.length < MAX_DEVICES_PER_ACCOUNT ? (
                    <div>
                      {!showAddDeviceModal ? (
                        <button
                          type="button"
                          onClick={() => setShowAddDeviceModal(true)}
                          className="w-full py-3 bg-[#7b5be4]/10 hover:bg-[#7b5be4]/20 border border-[#7b5be4]/30 text-[#7b5be4] hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Conectar Outro Dispositivo ({MAX_DEVICES_PER_ACCOUNT - userDevices.length} vagas livres)
                        </button>
                      ) : (
                        <form onSubmit={handleAddCustomDevice} className="p-4 bg-[#161a22] rounded-2xl border border-slate-800 space-y-3 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Adicionar Dispositivo</h4>
                            <button
                              type="button"
                              onClick={() => setShowAddDeviceModal(false)}
                              className="text-slate-500 hover:text-white text-xs"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              required
                              value={newDeviceName}
                              onChange={(e) => setNewDeviceName(e.target.value)}
                              placeholder="Nome (Ex: Smart TV Quarto, Tablet)"
                              className="bg-[#0c0d10] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                            />
                            <select
                              value={newDeviceType}
                              onChange={(e) => setNewDeviceType(e.target.value as any)}
                              className="bg-[#0c0d10] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                            >
                              <option value="tv">Smart TV / Box TV</option>
                              <option value="mobile">Smartphone</option>
                              <option value="desktop">Computador / Notebook</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowAddDeviceModal(false)}
                              className="px-3 py-1.5 bg-white/5 text-slate-400 text-xs rounded-lg hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              className="px-4 py-1.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-bold rounded-lg uppercase tracking-wider"
                            >
                              Registar Dispositivo
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Limite de 4 dispositivos atingido. Remova um dispositivo acima para conectar outro.</span>
                    </div>
                  )}
                </div>

                {/* Session Card */}
                <div className="p-6 bg-[#0c0d10] rounded-2xl border border-[#2d3139]/50 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-[#7b5be4]">
                      <ShieldCheck className="w-5 h-5" />
                      <h3 className="font-bold text-sm uppercase tracking-widest text-white">Segurança</h3>
                    </div>
                    <p className="text-slate-400 text-xs leading-relaxed">
                      Conexão encriptada e protegida. Cada conta Salgueiro Streaming sincroniza permissões e favoritos em até 4 dispositivos simultâneos.
                    </p>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Estado da Conta</span>
                      <p className="text-xs font-bold text-emerald-400">Ativa & Autorizada (4 Máx)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => triggerToast('Sessão atual protegida com encriptação.')} 
                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Verificar Segurança
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'interface' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2d3139]/60">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2.5 rounded-xl border text-white"
                    style={{
                      backgroundColor: 'color-mix(in srgb, var(--theme-accent) 18%, transparent)',
                      borderColor: 'color-mix(in srgb, var(--theme-accent) 40%, transparent)',
                    }}
                  >
                    <Palette className="w-6 h-6" style={{ color: 'var(--theme-accent)' }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Interface & Temas da Plataforma
                    </h2>
                    <p className="text-xs text-slate-400">
                      Escolha livremente o layout e skin visual da plataforma — cada utilizador pode personalizar o seu tema
                    </p>
                  </div>
                </div>

                {/* Submenu Switcher inside Interface */}
                <div className="flex items-center gap-2 bg-[#0c0d10] p-1 rounded-xl border border-[#2d3139]">
                  <button
                    type="button"
                    onClick={() => setInterfaceSubTab('themes')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      interfaceSubTab === 'themes'
                        ? 'text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    style={interfaceSubTab === 'themes' ? { backgroundColor: 'var(--theme-accent)' } : undefined}
                  >
                    Interface / Temas
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterfaceSubTab('display')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      interfaceSubTab === 'display'
                        ? 'text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    style={interfaceSubTab === 'display' ? { backgroundColor: 'var(--theme-accent)' } : undefined}
                  >
                    Exibição
                  </button>
                </div>
              </div>

              {interfaceSubTab === 'themes' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {PLATFORM_THEMES.map((t) => {
                      const isSelected = activeTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setActiveTheme(t.id as PlatformTheme);
                            if (onSaveGlobalTheme) {
                              onSaveGlobalTheme(t.id as PlatformTheme);
                            }
                            triggerToast(`Tema "${t.name}" aplicado globalmente para toda a plataforma!`);
                          }}
                          className={`group text-left rounded-2xl p-5 border-2 transition-all duration-200 flex flex-col gap-4 relative overflow-hidden ${
                            isSelected
                              ? 'bg-[#0c0d10] shadow-xl scale-[1.01]'
                              : 'bg-[#0c0d10]/70 border-[#2d3139] hover:border-slate-500'
                          }`}
                          style={isSelected ? { borderColor: t.accentColor } : undefined}
                        >
                          {/* Miniature Visual Layout Mockup */}
                          <div
                            className="w-full h-32 rounded-xl overflow-hidden border border-white/10 p-2.5 flex flex-col justify-between relative"
                            style={{ backgroundColor: t.bgColor }}
                          >
                            {/* Mini Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="w-2.5 h-2.5 rounded-sm"
                                  style={{ backgroundColor: t.accentColor }}
                                />
                                <span className="text-[9px] font-black text-white uppercase tracking-wider">
                                  {t.shortName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="w-5 h-1.5 rounded-full bg-white/25" />
                                <span className="w-5 h-1.5 rounded-full bg-white/15" />
                              </div>
                            </div>

                            {/* Mini Layout Structure tailored per theme */}
                            {t.id === 'stremio' ? (
                              <div className="flex items-stretch gap-2 flex-1 mt-2">
                                <div className="w-4 rounded bg-[#17132b] border border-[#7b5bf5]/40 flex flex-col items-center py-1 gap-1">
                                  <span className="w-2 h-2 rounded-sm bg-[#7b5bf5]" />
                                  <span className="w-2 h-1.5 rounded-sm bg-white/25" />
                                  <span className="w-2 h-1.5 rounded-sm bg-white/25" />
                                </div>
                                <div className="flex-1 flex flex-col gap-1.5">
                                  <div className="h-9 rounded bg-gradient-to-r from-[#7b5bf5]/40 to-transparent border border-[#7b5bf5]/30" />
                                  <div className="grid grid-cols-4 gap-1.5 flex-1">
                                    {[0, 1, 2, 3].map((k) => (
                                      <div key={k} className="rounded bg-[#17132b] border border-[#7b5bf5]/25" />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : t.id === 'netflix' ? (
                              <div className="flex flex-col gap-1.5 flex-1 mt-2">
                                <div className="h-10 rounded bg-gradient-to-r from-[#E50914]/50 via-[#181818] to-transparent border border-white/10 flex items-end p-1.5">
                                  <span className="w-10 h-2 rounded-sm bg-white" />
                                </div>
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                  {[1, 2, 3, 4].map((num) => (
                                    <div key={num} className="rounded bg-[#181818] border border-white/10 relative overflow-hidden flex items-end p-1">
                                      <span className="text-[11px] font-black text-white/30 leading-none">{num}</span>
                                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#E50914]" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : t.id === 'prime' ? (
                              <div className="flex flex-col gap-1.5 flex-1 mt-2">
                                <div className="h-10 rounded bg-gradient-to-r from-[#00A8E1]/40 via-[#0f171e] to-transparent border border-[#00A8E1]/30 flex items-center px-2">
                                  <span className="px-1.5 py-0.5 rounded bg-[#00A8E1] text-[7px] font-black text-[#00050d]">
                                    INCLUÍDO
                                  </span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 flex-1">
                                  {[0, 1, 2].map((k) => (
                                    <div key={k} className="rounded bg-[#0f171e] border border-[#00A8E1]/35 relative overflow-hidden">
                                      <span className="absolute bottom-0 left-0 w-2/3 h-0.5 bg-[#00A8E1]" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5 flex-1 mt-2">
                                <div className="h-10 rounded bg-gradient-to-r from-[#7b5be4]/35 via-[#161a22] to-transparent border border-[#2d3139]" />
                                <div className="grid grid-cols-4 gap-1.5 flex-1">
                                  {[0, 1, 2, 3].map((k) => (
                                    <div key={k} className="rounded bg-[#161a22] border border-[#2d3139]" />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Theme Info */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-white">{t.name}</h3>
                                {t.isNew && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white"
                                    style={{ backgroundColor: t.accentColor }}
                                  >
                                    Novo
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-bold uppercase tracking-wider mt-0.5" style={{ color: t.accentColor }}>
                                {t.tagline}
                              </p>
                            </div>
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase shrink-0 border ${
                                isSelected
                                  ? 'text-white'
                                  : 'bg-white/5 text-slate-400 border-white/10 group-hover:text-white'
                              }`}
                              style={
                                isSelected
                                  ? { backgroundColor: t.accentColor, borderColor: t.accentColor }
                                  : undefined
                              }
                            >
                              {isSelected ? '✓ Ativo' : 'Ativar'}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed">{t.description}</p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {t.highlights.map((h) => (
                              <span
                                key={h}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10"
                              >
                                {h}
                              </span>
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Cartões Compactos</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Reduz o espaçamento interno para mostrar mais títulos de uma vez no ecrã.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInterfacePrefs({ ...interfacePrefs, compactCards: !interfacePrefs.compactCards });
                        triggerToast('Preferência de cartões atualizada!');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        interfacePrefs.compactCards
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {interfacePrefs.compactCards ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>

                  <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Selos de Qualidade & Pontuação IMDb</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Apresenta a classificação IMDb e qualidade (HD / 4K UHD) sobre os cartões e destaques.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInterfacePrefs({ ...interfacePrefs, showQualityBadges: !interfacePrefs.showQualityBadges });
                        triggerToast('Preferência de selos atualizada!');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        interfacePrefs.showQualityBadges
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {interfacePrefs.showQualityBadges ? 'Visível' : 'Oculto'}
                    </button>
                  </div>

                  <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-bold text-white">Rotação Automática do Banner Principal</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Alterna automaticamente entre os filmes e canais em destaque no banner principal.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInterfacePrefs({ ...interfacePrefs, autoHeroRotation: !interfacePrefs.autoHeroRotation });
                        triggerToast('Rotação do banner atualizada!');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        interfacePrefs.autoHeroRotation
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {interfacePrefs.autoHeroRotation ? 'Ativa' : 'Pausada'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'admin_domain' && isAdmin && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2d3139]/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Domínio de Armazenamento & Streaming
                    </h2>
                    <p className="text-xs text-slate-400">
                      Configure o domínio dedicado para guardar filmes e transmitir online via HTTP 206 para todos os utilizadores
                    </p>
                  </div>
                </div>
                {onOpenCreateMovie && (
                  <button
                    type="button"
                    onClick={onOpenCreateMovie}
                    className="px-4 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-[#7b5be4]/25 shrink-0"
                  >
                    <Upload className="w-4 h-4" />
                    Enviar Filme p/ Domínio
                  </button>
                )}
              </div>

              {/* Domain Configuration Form */}
              <form onSubmit={handleSaveDomainSettings} className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#7b5be4]" /> Endereço do Domínio de Filmes
                  </h3>
                  <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase rounded-full">
                    {domainEnabled ? 'Streaming Online Ativo' : 'Pausado'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Domínio Dedicado (Host / Subdomínio)
                    </label>
                    <input
                      type="text"
                      required
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="media.salgueirostreaming.ao"
                      className="w-full bg-[#161a22] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-4 py-3 text-sm font-mono text-white outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Nome do Servidor Media
                    </label>
                    <input
                      type="text"
                      value={domainLabel}
                      onChange={(e) => setDomainLabel(e.target.value)}
                      placeholder="Salgueiro Media Cloud Angola"
                      className="w-full bg-[#161a22] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-4 py-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                {/* Preset Domain Suggestions */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Sugestões rápidas:
                  </span>
                  {[
                    'media.salgueirostreaming.ao',
                    'vod.salgueirostreaming.ao',
                    'cdn.salgueirotv.ao',
                    typeof window !== 'undefined' ? window.location.host : 'localhost:3000',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDomainInput(preset)}
                      className="px-2.5 py-1 bg-[#161a22] hover:bg-[#7b5be4]/20 border border-[#2d3139] hover:border-[#7b5be4] rounded-lg text-[11px] font-mono text-slate-300 hover:text-white transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#2d3139]/50">
                  <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={domainEnabled}
                      onChange={(e) => setDomainEnabled(e.target.checked)}
                      className="w-4 h-4 accent-[#7b5be4]"
                    />
                    Ativar armazenamento direto e streaming HTTP 206 online para todos os filmes
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestDomainStreaming}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
                    >
                      Testar Streaming
                    </button>
                    <button
                      type="submit"
                      disabled={savingDomain}
                      className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {savingDomain ? 'A guardar...' : 'Criar / Guardar Domínio'}
                    </button>
                  </div>
                </div>

                {streamTestStatus && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-semibold">
                    {streamTestStatus}
                  </div>
                )}
              </form>

              {/* Endpoints & DNS Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-[#a78bfa]">
                    <Server className="w-4 h-4" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Endpoint Ativo na Internet</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Todos os filmes enviados ficam acessíveis imediatamente neste servidor de streaming:
                  </p>
                  <div className="p-3 bg-[#161a22] rounded-xl border border-[#2d3139] flex items-center justify-between gap-2">
                    <code className="text-xs text-emerald-300 truncate">
                      {getRuntimeOrigin()}/stream/media/videos/
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(`${getRuntimeOrigin()}/stream/media/videos/`);
                        triggerToast('URL do endpoint copiado!');
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white shrink-0"
                      title="Copiar URL"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-400">
                    <Link2 className="w-4 h-4" />
                    <h4 className="text-xs font-black uppercase tracking-wider">Apontamento DNS / CNAME</h4>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Para usar o seu domínio próprio (<span className="text-white font-mono">{normalizeDomainName(domainInput)}</span>) externamente, aponte o registo DNS:
                  </p>
                  <div className="p-3 bg-[#161a22] rounded-xl border border-[#2d3139] text-[11px] font-mono text-slate-300 space-y-1">
                    <div>TIPO: <span className="text-amber-400 font-bold">CNAME</span></div>
                    <div className="truncate">NOME: <span className="text-white">{normalizeDomainName(domainInput)}</span></div>
                    <div className="truncate">DESTINO: <span className="text-emerald-400">{typeof window !== 'undefined' ? window.location.hostname : 'servidor-salgueiro'}</span></div>
                  </div>
                </div>
              </div>

              {/* Stored Vault Files List */}
              <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      Repositório de Filmes Armazenados no Domínio ({vaultFiles.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Espaço ocupado: <span className="text-white font-bold">{formatBytes(vaultTotalBytes)}</span> • HTTP Range (Avanço/Recuo instantâneo)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={loadVaultRepository}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-slate-300 flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingVault ? 'animate-spin' : ''}`} />
                    Atualizar Lista
                  </button>
                </div>

                {vaultFiles.length === 0 ? (
                  <div className="py-10 text-center bg-[#161a22]/50 border border-dashed border-[#2d3139] rounded-2xl space-y-2">
                    <Film className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-semibold">
                      Nenhum filme armazenado no cofre deste domínio ainda.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Clique em "Enviar Filme p/ Domínio" para armazenar um vídeo e gerar o link online.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {vaultFiles.map((file) => {
                      const runtimeUrl = buildRuntimeStreamUrl(file.streamPath);
                      const customUrl = buildCustomDomainStreamUrl(file.streamPath, domainInput);
                      return (
                        <div
                          key={`${file.folder}-${file.filename}`}
                          className="p-3.5 bg-[#161a22] border border-[#2d3139] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-[#7b5be4]/15 border border-[#7b5be4]/30 flex items-center justify-center text-[#a78bfa] shrink-0">
                              {file.folder === 'videos' ? <Play className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{file.filename}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">
                                {formatBytes(file.size)} • {file.mimeType} • {customUrl}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(runtimeUrl);
                                triggerToast('Link direto de streaming copiado!');
                              }}
                              className="px-2.5 py-1.5 bg-white/5 hover:bg-[#7b5be4]/20 border border-white/10 rounded-lg text-[10px] font-bold text-slate-200 flex items-center gap-1"
                              title="Copiar link de streaming ativo"
                            >
                              <Copy className="w-3 h-3" /> Copiar Link
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVaultFile(file)}
                              className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                              title="Eliminar do domínio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'admin_branding' && isAdmin && (
            <div className="space-y-10 animate-fade-in">
              <div className="flex items-center gap-3">
                <Palette className="w-6 h-6 text-amber-500" />
                <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">Identidade Visual (Branding)</h2>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título Global da Plataforma</label>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={appTitle}
                      onChange={(e) => setAppTitle(e.target.value)}
                      className="flex-1 bg-[#0c0d10] border border-[#2d3139] rounded-2xl py-4 px-6 text-white text-sm font-bold focus:border-amber-500 outline-none transition-all"
                    />
                    <button 
                      onClick={() => handleSaveBranding()}
                      className="bg-amber-500 hover:bg-amber-600 text-black px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      Salvar Globalmente
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Imagem de Fundo Principal (Hero)</label>
                  <div className="relative group aspect-video rounded-3xl overflow-hidden border border-[#2d3139]">
                    <img src={heroImage} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-4">
                      <input 
                        type="text" 
                        placeholder="Cole o URL da nova imagem"
                        className="bg-[#0c0d10] border border-white/20 rounded-xl px-4 py-2 text-xs text-white w-2/3"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            setHeroImage(val);
                            void handleSaveBranding(appTitle, val);
                          }
                        }}
                      />
                      <p className="text-[10px] text-slate-400">Pressione Enter para atualizar para todos os utilizadores</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#2d3139]/50">
                   <div className="space-y-3">
                      <h4 className="text-white font-bold text-sm">Cor Principal</h4>
                      <div className="flex gap-2">
                         {['#7b5be4', '#ff4757', '#2ed573', '#1e90ff', '#ffa502'].map(c => (
                            <button key={c} className="w-8 h-8 rounded-full border-2 border-[#161a22] shadow-xl" style={{ backgroundColor: c }} />
                         ))}
                      </div>
                   </div>
                   <div className="space-y-3">
                      <h4 className="text-white font-bold text-sm">Estilo do Logotipo</h4>
                      <select className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-3 px-4 text-xs font-bold text-white">
                         <option>Bandeira Angola + Play (Atual)</option>
                         <option>Apenas Símbolo Salgueiro</option>
                         <option>Logo Minimalista</option>
                      </select>
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'admin_content' && isAdmin && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Film className="w-6 h-6 text-amber-500" />
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">
                      Gestão de Catálogo ({catalog.length})
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Todas as edições, remoções e legendas sincronizam globalmente em tempo real.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isBatchReplacingCatalogArtwork || catalog.length === 0}
                    onClick={handleBatchReplaceAllCatalogArtwork}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-[#7b5be4] hover:from-amber-400 hover:to-[#8e74eb] text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 active:scale-95 disabled:opacity-50"
                    title="Substituir capas e banners de todos os filmes do catálogo pela imagem original da web"
                  >
                    {isBatchReplacingCatalogArtwork ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-black" />
                    )}
                    <span>Substituir Todas as Capas e Banners (Web)</span>
                  </button>

                  {onDeduplicateMovies && (
                    <button
                      type="button"
                      onClick={async () => {
                        const removed = await onDeduplicateMovies();
                        triggerToast(
                          removed > 0
                            ? `${removed} filme(s) duplicado(s) eliminado(s) globalmente!`
                            : 'Nenhum filme duplicado encontrado.'
                        );
                      }}
                      className="px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar Duplicados ({duplicateMoviesCount})
                    </button>
                  )}
                  <button 
                    onClick={onOpenCreateMovie}
                    className="bg-amber-500 hover:bg-amber-400 text-black px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Filme / Série
                  </button>
                </div>
              </div>

              {batchCatalogArtworkProgress && (
                <div className="p-4 bg-gradient-to-r from-[#1e1b4b] to-[#162032] border border-[#7b5be4]/40 rounded-2xl space-y-2.5 shadow-xl animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-2 text-amber-300">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                      A substituir capas e banners da web: {batchCatalogArtworkProgress.current} de {batchCatalogArtworkProgress.total} filmes...
                    </span>
                    <span className="text-slate-300 font-mono text-[11px] truncate max-w-xs">
                      {batchCatalogArtworkProgress.currentTitle}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.round((batchCatalogArtworkProgress.current / batchCatalogArtworkProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Filter Tabs between Filmes and Séries */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 bg-[#0c0d10] p-1 rounded-xl border border-[#2d3139]">
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      catalogTypeFilter === 'all'
                        ? 'bg-[#7b5be4] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Todos ({catalog.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('movie')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      catalogTypeFilter === 'movie'
                        ? 'bg-[#7b5be4] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Menu Filmes ({catalog.filter((m) => m.type !== 'series').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogTypeFilter('series')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      catalogTypeFilter === 'series'
                        ? 'bg-[#7b5be4] text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Menu Séries ({catalog.filter((m) => m.type === 'series').length})
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Use o botão <strong className="text-white">"Mover p/ Séries / Filmes"</strong> em cada título para trocar de menu.
                </span>
              </div>

              {/* Search in Catalog */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Pesquisar por título, gênero ou ano..."
                  className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-2xl py-3 pl-11 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {/* Catalog Items List */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 no-scrollbar">
                {catalog
                  .filter((item) => {
                    if (catalogTypeFilter === 'movie' && item.type === 'series') return false;
                    if (catalogTypeFilter === 'series' && item.type !== 'series') return false;
                    const q = catalogSearch.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(q) ||
                      (item.originalTitle && item.originalTitle.toLowerCase().includes(q)) ||
                      item.genres.some((g) => g.toLowerCase().includes(q)) ||
                      String(item.year).includes(q)
                    );
                  })
                  .map((item) => {
                    const isCustom = item.id.startsWith('custom-');
                    const hasAutoSub = Boolean(item.generatedSubtitles && item.generatedSubtitles.length > 0);
                    const isGenThis = generatingSubMovieId === item.id;
                    return (
                      <div 
                        key={item.id} 
                        className="p-4 bg-[#0c0d10] border border-[#2d3139] rounded-2xl flex items-center justify-between group hover:border-amber-500/50 transition-all gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-14 h-16 bg-white/5 rounded-xl flex items-center justify-center font-black text-slate-500 overflow-hidden shrink-0 border border-white/5">
                            {item.thumbnailUrl ? (
                              <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              item.title.charAt(0)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">{item.title}</h4>
                              {isCustom && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded uppercase">
                                  Domínio
                                </span>
                              )}
                              {hasAutoSub && (
                                <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 text-[9px] font-bold rounded uppercase">
                                  Legenda PT-BR ✓
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                              {item.type === 'series' ? 'Série' : 'Filme'} • {item.year} • {item.quality} • {item.genres.slice(0, 2).join(', ')}
                            </p>
                            <p className="text-[10px] text-[#7b5be4] truncate max-w-sm mt-0.5 font-mono">
                              {item.videoUrl}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={replacingArtworkCatalogId === item.id || isBatchReplacingCatalogArtwork}
                            onClick={() => {
                              if (onPickMovieArtwork) {
                                onPickMovieArtwork(item);
                              } else {
                                void handleReplaceSingleCatalogItemArtwork(item);
                              }
                            }}
                            className="px-2.5 py-2 bg-[#7b5be4]/15 hover:bg-[#7b5be4] hover:text-white text-[#c4b5fd] rounded-xl text-[10px] font-black uppercase tracking-wider border border-[#7b5be4]/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                            title="Procurar na web e escolher capa e banner originais"
                          >
                            {replacingArtworkCatalogId === item.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            ) : (
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span className="hidden lg:inline">
                              {replacingArtworkCatalogId === item.id ? 'A substituir...' : 'Escolher Capa & Banner'}
                            </span>
                          </button>

                          {onGenerateMovieSubtitles && item.videoUrl && (
                            <button
                              type="button"
                              disabled={isGenThis}
                              onClick={async () => {
                                setGeneratingSubMovieId(item.id);
                                try {
                                  await onGenerateMovieSubtitles(item);
                                  triggerToast(`Legenda PT-BR gerada e guardada para "${item.title}"!`);
                                } catch (err) {
                                  triggerToast(
                                    err instanceof Error
                                      ? err.message
                                      : 'Erro ao gerar legenda PT-BR.'
                                  );
                                } finally {
                                  setGeneratingSubMovieId(null);
                                }
                              }}
                              className="px-2.5 py-2 bg-emerald-500/15 hover:bg-emerald-500 hover:text-black text-emerald-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 transition-all flex items-center gap-1.5 disabled:opacity-50"
                              title="Gerar legenda automática em Português (Brasil)"
                            >
                              {isGenThis ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Subtitles className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden md:inline">
                                {isGenThis ? 'A gerar...' : 'Legenda PT-BR'}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleToggleMovieMenuType(item)}
                            className={`px-2.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 shadow-sm active:scale-95 ${
                              item.type === 'series'
                                ? 'bg-amber-500/15 hover:bg-amber-500 hover:text-black text-amber-300 border-amber-500/30'
                                : 'bg-[#7b5be4]/20 hover:bg-[#7b5be4] hover:text-white text-[#c4b5fd] border-[#7b5be4]/40'
                            }`}
                            title={
                              item.type === 'series'
                                ? 'Mover este conteúdo para o menu Filmes'
                                : 'Mover este conteúdo para o menu Séries'
                            }
                          >
                            <Film className="w-3.5 h-3.5" />
                            <span>{item.type === 'series' ? 'Mover p/ Filmes' : 'Mover p/ Séries'}</span>
                          </button>
                          <button 
                            onClick={() => onEditMovie && onEditMovie(item)}
                            className="p-2.5 bg-white/5 hover:bg-amber-500 hover:text-black text-slate-400 rounded-xl transition-all border border-white/5"
                            title="Editar informações, categoria e link do filme/série"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleRemoveContent(item.id, item.title)}
                            className="p-2.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl border border-white/5 transition-all"
                            title="Eliminar do catálogo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeSection === 'addons' && isAdmin && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Puzzle className="w-6 h-6 text-[#7b5be4]" />
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">
                      Gestão de Listas IPTV & Links (.m3u / .m3u8)
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Configure URLs de streaming, elimine duplicados e remova canais sem resposta globalmente.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && onBatchReplaceChannelLogos && (
                    <button
                      type="button"
                      disabled={isSearchingChannelLogos}
                      onClick={async () => {
                        const res = await onBatchReplaceChannelLogos(true);
                        if (res) {
                          triggerToast(
                            res.updated > 0
                              ? `${res.updated} de ${res.total} canais atualizados com logótipos reais da web!`
                              : 'Pesquisa na web concluída para todos os canais.'
                          );
                        }
                      }}
                      className="px-3.5 py-2.5 bg-[#7b5be4]/20 hover:bg-[#7b5be4]/35 border border-[#7b5be4]/50 text-[#c4b5fd] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isSearchingChannelLogos ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {isSearchingChannelLogos
                        ? `A procurar logos (${liveChannels.length})...`
                        : 'Procurar & Substituir Logos na Web'}
                    </button>
                  )}
                  {isAdmin && onDeduplicateChannels && (
                    <button
                      type="button"
                      onClick={async () => {
                        const removed = await onDeduplicateChannels();
                        triggerToast(
                          removed > 0
                            ? `${removed} canal(is) duplicado(s) eliminado(s) globalmente!`
                            : 'Nenhum canal de TV duplicado encontrado.'
                        );
                      }}
                      className="px-3.5 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar Canais Duplicados ({duplicateChannelsCount})
                    </button>
                  )}
                  {isAdmin && onPurgeDeadChannels && (
                    <button
                      type="button"
                      disabled={isCheckingDeadChannels}
                      onClick={async () => {
                        const res = await onPurgeDeadChannels();
                        if (res) {
                          triggerToast(
                            `Verificados ${res.checked} canais: ${res.removed} canal(is) sem resposta eliminado(s) globalmente!`
                          );
                        }
                      }}
                      className="px-3.5 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {isCheckingDeadChannels ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <WifiOff className="w-3.5 h-3.5" />
                      )}
                      {isCheckingDeadChannels
                        ? `A verificar ${liveChannels.length} canais...`
                        : 'Eliminar Canais Sem Resposta'}
                    </button>
                  )}
                  {onReloadIptv && (
                    <button
                      type="button"
                      disabled={isFetchingIPTV}
                      onClick={() => {
                        onReloadIptv();
                        triggerToast('A sincronizar e atualizar lista de canais em TV ao Vivo...');
                      }}
                      className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      title="Atualizar canais e sincronizar com TV ao Vivo"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFetchingIPTV ? 'animate-spin' : ''}`} />
                      <span>{isFetchingIPTV ? 'A Atualizar Canais...' : `Atualizar Canais (${liveChannels.length})`}</span>
                    </button>
                  )}
                  {onOpenLiveTv && (
                    <button
                      type="button"
                      onClick={onOpenLiveTv}
                      className="px-3.5 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-[#7b5be4]/20 transition-all"
                      title="Abrir o menu TV ao Vivo"
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>Ver no Menu TV ao Vivo</span>
                    </button>
                  )}
                  {onOpenStremioAddons && (
                    <button
                      type="button"
                      onClick={onOpenStremioAddons}
                      className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-[#2d3139] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all"
                    >
                      <Puzzle className="w-4 h-4" />
                      Addons & Domínios
                    </button>
                  )}
                </div>
              </div>

              {lastUploadedNotice && (
                <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in shadow-xl shadow-emerald-950/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white uppercase tracking-wider">
                        Nova Lista Carregada: {lastUploadedNotice.name}
                      </h4>
                      <p className="text-[11px] text-emerald-300">
                        {lastUploadedNotice.count > 0 ? `${lastUploadedNotice.count} canais identificados.` : 'Lista adicionada com sucesso.'} Sincronize agora para assistir em TV ao Vivo.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onReloadIptv && (
                      <button
                        type="button"
                        onClick={() => {
                          onReloadIptv();
                          triggerToast('Lista de canais de TV atualizada!');
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetchingIPTV ? 'animate-spin' : ''}`} />
                        <span>Atualizar Canais Agora</span>
                      </button>
                    )}
                    {onOpenLiveTv && (
                      <button
                        type="button"
                        onClick={onOpenLiveTv}
                        className="px-4 py-2 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>Ver no Menu TV ao Vivo</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setLastUploadedNotice(null)}
                      className="text-slate-400 hover:text-white p-2"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Hidden File Input for Real Upload */}
              <input
                type="file"
                ref={fileInputRef}
                accept=".m3u,.m3u8,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Add New IPTV URL */}
              <div className="p-6 bg-[#0c0d10] border border-[#2d3139]/50 rounded-3xl space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Adicionar Nova Lista ou Link de Streaming
                </h3>
                <form onSubmit={handleAddIptv} className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <input 
                      type="url" 
                      required
                      value={newIptvUrl}
                      onChange={(e) => setNewIptvUrl(e.target.value)}
                      placeholder="https://exemplo.com/lista.m3u ou .m3u8 ou stream direto"
                      className="flex-1 bg-[#161a22] border border-[#2d3139] rounded-xl py-3 px-4 text-xs text-white focus:outline-none focus:border-[#7b5be4] transition-all"
                    />
                    <button 
                      type="submit" 
                      className="bg-[#7b5be4] hover:bg-[#8e74eb] text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shrink-0 shadow-lg shadow-[#7b5be4]/20"
                    >
                      <Plus className="w-4 h-4" /> Adicionar Link
                    </button>
                  </div>

                  {/* Real File Upload Box */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center p-8 border-2 border-dashed border-[#2d3139] rounded-2xl hover:border-[#7b5be4] transition-all cursor-pointer group bg-[#161a22]/30"
                  >
                    <div className="text-center space-y-2">
                      <Upload className="w-8 h-8 text-slate-500 group-hover:text-[#7b5be4] mx-auto transition-colors" />
                      <p className="text-xs text-slate-300 font-bold uppercase tracking-widest">
                        Carregar Ficheiro .M3U / .M3U8 do Computador
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Clique para selecionar um ficheiro local de canais IPTV
                      </p>
                    </div>
                  </div>
                </form>

                {/* Quick Add Direct Channel Toggle */}
                <div className="pt-2 border-t border-[#2d3139]/40">
                  <button
                    type="button"
                    onClick={() => setShowDirectChannelForm(!showDirectChannelForm)}
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {showDirectChannelForm ? 'Ocultar Adicionar Canal Individual' : '+ Adicionar Canal Individual Direto (.m3u8 / MP4)'}
                  </button>

                  {showDirectChannelForm && (
                    <form onSubmit={handleAddDirectChannel} className="mt-3 p-4 bg-[#161a22] rounded-2xl border border-slate-800 space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Novo Canal ao Vivo</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <input
                          type="text"
                          required
                          value={directChannelName}
                          onChange={(e) => setDirectChannelName(e.target.value)}
                          placeholder="Nome do Canal (Ex: Zap Viva)"
                          className="bg-[#0c0d10] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                        />
                        <input
                          type="url"
                          required
                          value={directChannelUrl}
                          onChange={(e) => setDirectChannelUrl(e.target.value)}
                          placeholder="URL Stream (http://...index.m3u8)"
                          className="bg-[#0c0d10] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                        />
                        <select
                          value={directChannelCategory}
                          onChange={(e) => setDirectChannelCategory(e.target.value)}
                          className="bg-[#0c0d10] border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                        >
                          <option value="Variedades">Variedades</option>
                          <option value="Notícias">Notícias</option>
                          <option value="Esportes">Esportes</option>
                          <option value="Filmes & Séries">Filmes & Séries</option>
                          <option value="Infantil">Infantil</option>
                        </select>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl uppercase tracking-wider transition-all"
                        >
                          Guardar Canal
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>

              {/* Uploaded M3U Files Section */}
              {uploadedIptvFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#7b5be4]" /> Ficheiros M3U Carregados ({uploadedIptvFiles.length})
                  </h3>
                  <div className="space-y-2">
                    {uploadedIptvFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-4 bg-[#0c0d10] border border-[#2d3139] rounded-2xl flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#7b5be4]/10 border border-[#7b5be4]/30 flex items-center justify-center text-[#7b5be4]">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white">{file.name}</h4>
                            <p className="text-[10px] text-slate-500">
                              {file.channelCount} canais identificados • Carregado em {file.uploadedAt}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveUploadedFile(file.id, file.name)}
                          className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          title="Remover ficheiro M3U"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Configured IPTV URLs with Inline Edit & Delete */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Listas e Links de Transmissão Configurados ({iptvUrls.length})
                  </h3>
                  {iptvUrls.length > 0 && (
                    <button
                      type="button"
                      onClick={handlePurgeAllIptv}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remover Listas / Servidores Inativos
                    </button>
                  )}
                </div>

                {iptvUrls.map((url, index) => {
                  const isEditing = editingIptvIndex === index;
                  return (
                    <div 
                      key={index} 
                      className="p-4 bg-[#0c0d10] border border-[#2d3139]/50 rounded-2xl group hover:border-[#7b5be4]/50 transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#161a22] flex items-center justify-center border border-[#2d3139] shrink-0">
                          <Database className="w-5 h-5 text-[#7b5be4]" />
                        </div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingIptvValue}
                            onChange={(e) => setEditingIptvValue(e.target.value)}
                            className="flex-1 bg-[#161a22] border border-[#7b5be4] rounded-xl px-3 py-2 text-xs text-white outline-none"
                            autoFocus
                          />
                        ) : (
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white truncate font-mono">{url}</h4>
                            <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">
                              {url.endsWith('.m3u8') ? 'Direct Stream HLS' : url.endsWith('.m3u') ? 'Playlist M3U' : 'Manifest / IPTV Link'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEditIptv(index)}
                              className="p-2 bg-emerald-500 text-black hover:bg-emerald-400 rounded-xl transition-all"
                              title="Salvar alterações"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingIptvIndex(null);
                                setEditingIptvValue('');
                              }}
                              className="p-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
                              title="Cancelar edição"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStartEditIptv(index, url)}
                              className="p-2 bg-[#161a22] hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 rounded-xl border border-[#2d3139] transition-all"
                              title="Editar link da lista"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemoveIptv(url)}
                              className="p-2 bg-[#161a22] hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded-xl border border-[#2d3139] transition-all"
                              title="Remover lista"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Active TV Channels Logo Manager */}
              {liveChannels.length > 0 && (
                <div className="p-5 bg-[#0c0d10] border border-[#2d3139]/60 rounded-3xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-[#7b5be4]" />
                        Logótipos dos Canais de Televisão ({liveChannels.length})
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Procure na web e substitua o logótipo individual de cada canal consoante o nome.
                      </p>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={channelLogoFilter}
                        onChange={(e) => setChannelLogoFilter(e.target.value)}
                        placeholder="Filtrar canal por nome..."
                        className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                    {liveChannels
                      .filter((ch) =>
                        !channelLogoFilter.trim() ||
                        ch.name.toLowerCase().includes(channelLogoFilter.trim().toLowerCase())
                      )
                      .map((ch) => (
                        <div
                          key={ch.id}
                          className="p-2.5 bg-[#161a22] border border-[#2d3139]/70 rounded-xl flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-11 h-9 rounded-lg bg-slate-950 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                              {ch.logo.startsWith('/') || ch.logo.startsWith('http') ? (
                                <img
                                  src={ch.logo}
                                  alt={ch.name}
                                  referrerPolicy="no-referrer"
                                  className="max-w-full max-h-full object-contain"
                                />
                              ) : (
                                <span className="text-base">{ch.logo}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{ch.name}</p>
                              <p className="text-[10px] text-slate-500 truncate">{ch.category}</p>
                            </div>
                          </div>
                          {isAdmin && onReplaceSingleChannelLogo && (
                            <button
                              type="button"
                              onClick={() => void openSettingsChannelLogoPicker(ch)}
                              className="px-2.5 py-1.5 bg-[#7b5be4]/15 hover:bg-[#7b5be4] text-[#c4b5fd] hover:text-white border border-[#7b5be4]/30 rounded-lg text-[10px] font-bold shrink-0 transition-all"
                              title={`Procurar logótipo na web para ${ch.name}`}
                            >
                              Web Logo
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {settingsLogoChannel && onReplaceSingleChannelLogo && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="max-w-xl w-full bg-[#161a22] border border-[#2d3139] rounded-3xl p-5 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">
                          Procurar Logótipo na Web — {settingsLogoChannel.name}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Selecione o logótipo original encontrado na web para este canal.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSettingsLogoChannel(null)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSettingsChannelLogoSearch} className="flex gap-2">
                      <input
                        type="text"
                        value={settingsLogoQuery}
                        onChange={(e) => setSettingsLogoQuery(e.target.value)}
                        placeholder="Nome do canal..."
                        className="flex-1 bg-[#0c0d10] border border-[#2d3139] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingSettingsLogo}
                        className="px-4 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isSearchingSettingsLogo ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Search className="w-3.5 h-3.5" />
                        )}
                        Procurar
                      </button>
                    </form>

                    <div className="max-h-72 overflow-y-auto pr-1">
                      {isSearchingSettingsLogo ? (
                        <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-[#7b5be4]" />
                          <span>A procurar logótipos na web...</span>
                        </div>
                      ) : settingsLogoResults.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Nenhum logótipo encontrado para "{settingsLogoQuery}". Tente outro termo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {settingsLogoResults.map((res) => (
                            <button
                              key={res.id}
                              type="button"
                              onClick={async () => {
                                await onReplaceSingleChannelLogo(settingsLogoChannel, res.logoUrl);
                                triggerToast(`Logo de "${settingsLogoChannel.name}" atualizado!`);
                                setSettingsLogoChannel(null);
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
                                <Check className="w-3 h-3" /> Aplicar
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'account' && (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#2d3139]/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#7b5be4]/15 border border-[#7b5be4]/30 rounded-xl text-[#7b5be4]">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Conta & Pagamento Mensal
                    </h2>
                    <p className="text-xs text-slate-400">
                      Consulte a data de pagamento, validade da subscrição mensal e estado do pacote
                    </p>
                  </div>
                </div>

                {user && (
                  <button
                    type="button"
                    onClick={handleRenewMonthlyPayment}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 shrink-0 active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Renovar Mensalidade (+30 Dias)
                  </button>
                )}
              </div>

              {user ? (
                (() => {
                  const payDate = user.paymentDate || defaultDates.paymentDate;
                  const expDate = user.expirationDate || defaultDates.expirationDate;
                  const metrics = getValidityMetrics(payDate, expDate);
                  const effectiveStatus = metrics.isExpired && user.paymentStatus !== 'Ativo'
                    ? 'Expirado'
                    : (user.paymentStatus || 'Ativo');

                  return (
                    <div className="space-y-6">
                      {/* Plan Summary Card */}
                      <div className="p-6 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Pacote Subscrito
                            </span>
                            <h3 className="text-lg font-black text-white mt-0.5">
                              {user.planName || 'Pacote Mensal Completo (4K UHD + TV ao Vivo)'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Titular: <span className="text-white font-semibold">{user.name}</span> ({user.email})
                            </p>
                          </div>

                          <div className="text-right">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                              effectiveStatus === 'Ativo'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : effectiveStatus === 'Pendente'
                                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border-red-500/30'
                            }`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {effectiveStatus}
                            </span>
                            <p className="text-sm font-black text-white mt-2">
                              {user.monthlyPrice || (user.role === 'admin' ? 'Isento (Admin)' : '5.000 Kz / mês')}
                            </p>
                          </div>
                        </div>

                        {/* Payment Date & Expiration Date Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="p-5 bg-[#161a22] rounded-2xl border border-[#2d3139] space-y-2">
                            <div className="flex items-center gap-2 text-sky-400">
                              <Calendar className="w-4 h-4" />
                              <span className="text-[11px] font-black uppercase tracking-widest">
                                Data do Último Pagamento
                              </span>
                            </div>
                            <p className="text-2xl font-black text-white font-mono">
                              {formatPtDate(payDate)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Método: <span className="text-slate-200 font-semibold">{user.paymentMethod || 'Multicaixa Express'}</span>
                            </p>
                          </div>

                          <div className={`p-5 bg-[#161a22] rounded-2xl border space-y-2 ${
                            metrics.daysRemaining <= 5 ? 'border-amber-500/50' : 'border-emerald-500/30'
                          }`}>
                            <div className={`flex items-center gap-2 ${
                              metrics.daysRemaining <= 5 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              <Clock className="w-4 h-4" />
                              <span className="text-[11px] font-black uppercase tracking-widest">
                                Data de Validade (Mensal)
                              </span>
                            </div>
                            <p className="text-2xl font-black text-white font-mono">
                              {formatPtDate(expDate)}
                            </p>
                            <p className={`text-xs font-bold ${
                              metrics.daysRemaining > 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                              {metrics.daysRemaining > 0
                                ? `Válido • Restam ${metrics.daysRemaining} dias`
                                : `Subscrição expirada há ${Math.abs(metrics.daysRemaining)} dias`}
                            </p>
                          </div>
                        </div>

                        {/* Monthly Billing Progress Bar */}
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-semibold">Validade do Ciclo Mensal</span>
                            <span className="text-white font-mono font-bold">{metrics.progressPercent}% restante</span>
                          </div>
                          <progress
                            value={metrics.progressPercent}
                            max={100}
                            className={`w-full h-2.5 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-white/10 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-all [&::-webkit-progress-value]:duration-500 ${
                              metrics.daysRemaining <= 5
                                ? '[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500'
                                : '[&::-webkit-progress-value]:bg-emerald-400 [&::-moz-progress-bar]:bg-emerald-400'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Admin / Editable Payment Configuration */}
                      {isAdmin && (
                        <form onSubmit={handleSaveAccountPaymentDetails} className="p-6 bg-[#0c0d10] rounded-2xl border border-amber-500/30 space-y-4">
                          <div className="flex items-center gap-2 text-amber-400">
                            <Edit2 className="w-4 h-4" />
                            <h3 className="text-xs font-black uppercase tracking-widest">
                              Gerir Datas de Pagamento Mensal (Administrador)
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Data de Pagamento
                              </label>
                              <input
                                type="date"
                                value={editPayDate}
                                onChange={(e) => setEditPayDate(e.target.value)}
                                className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Data de Validade
                              </label>
                              <input
                                type="date"
                                value={editExpDate}
                                onChange={(e) => setEditExpDate(e.target.value)}
                                className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Estado
                              </label>
                              <select
                                value={editPayStatus}
                                onChange={(e) => setEditPayStatus(e.target.value as any)}
                                className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              >
                                <option value="Ativo">Ativo</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Expirado">Expirado</option>
                                <option value="Teste Gratuito">Teste Gratuito</option>
                              </select>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Valor / Método
                              </label>
                              <input
                                type="text"
                                value={editMonthlyPrice}
                                onChange={(e) => setEditMonthlyPrice(e.target.value)}
                                placeholder="5.000 Kz / mês"
                                className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              Guardar Informações de Pagamento
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  );
                })()
              ) : (
                /* Guest / Unregistered View */
                <div className="p-8 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-6 text-center">
                  <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400">
                    <UserPlus className="w-8 h-8" />
                  </div>
                  <div className="space-y-2 max-w-lg mx-auto">
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      Utilizador Sem Registo (Conta Visitante)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Ainda não tem uma conta registada. Registe-se gratuitamente para ativar o seu acompanhamento de pagamento mensal, datas de validade e acesso aos pacotes completos.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left">
                    <div className="p-4 bg-[#161a22] rounded-xl border border-[#2d3139]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Data de Pagamento
                      </span>
                      <p className="text-sm font-bold text-slate-300 mt-1">Sem pagamento registado</p>
                    </div>
                    <div className="p-4 bg-[#161a22] rounded-xl border border-[#2d3139]">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        Validade do Pacote Mensal
                      </span>
                      <p className="text-sm font-bold text-amber-400 mt-1">Aguardar Registo</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    {onOpenRegister && (
                      <button
                        type="button"
                        onClick={onOpenRegister}
                        className="px-6 py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#7b5be4]/25 flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Registrar Grátis
                      </button>
                    )}
                    {onOpenLogin && (
                      <button
                        type="button"
                        onClick={onOpenLogin}
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                      >
                        <LogIn className="w-4 h-4" />
                        Iniciar Sessão
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'recycle_bin' && isAdmin && (() => {
            const filteredRecycled = recycledItems.filter((item) => {
              const matchesSearch =
                !recycleSearch.trim() ||
                item.title.toLowerCase().includes(recycleSearch.toLowerCase()) ||
                (item.subtitle || '').toLowerCase().includes(recycleSearch.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(recycleSearch.toLowerCase());

              if (!matchesSearch) return false;
              if (recycleCategoryFilter === 'all') return true;
              if (recycleCategoryFilter === 'movie_series') {
                return item.type === 'movie' || item.type === 'series';
              }
              if (recycleCategoryFilter === 'iptv') {
                return item.type === 'iptv_url' || item.type === 'iptv_file';
              }
              return item.type === recycleCategoryFilter;
            });

            const moviesSeriesCount = recycledItems.filter(i => i.type === 'movie' || i.type === 'series').length;
            const channelsCount = recycledItems.filter(i => i.type === 'channel').length;
            const addonsCount = recycledItems.filter(i => i.type === 'addon').length;
            const iptvCount = recycledItems.filter(i => i.type === 'iptv_url' || i.type === 'iptv_file').length;
            const configCount = recycledItems.filter(i => i.type === 'config').length;

            const handleRestoreSingle = async (item: RecycledItem) => {
              if (!onRestoreRecycledItem) return;
              setRestoringItemId(item.id);
              try {
                await onRestoreRecycledItem(item);
                triggerToast(`"${item.title}" recuperado e restaurado com sucesso!`);
              } catch {
                triggerToast(`Erro ao recuperar "${item.title}".`);
              } finally {
                setRestoringItemId(null);
              }
            };

            const handleRestoreAllFiltered = async () => {
              if (!onRestoreRecycledItem || filteredRecycled.length === 0) return;
              let restored = 0;
              for (const item of filteredRecycled) {
                try {
                  await onRestoreRecycledItem(item);
                  restored++;
                } catch {
                  // continue
                }
              }
              triggerToast(`${restored} item(ns) recuperado(s) e restaurado(s) na plataforma!`);
            };

            const getBadgeMeta = (item: RecycledItem) => {
              switch (item.type) {
                case 'movie':
                  return { label: 'Filme', cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30', icon: Film };
                case 'series':
                  return { label: 'Série', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Film };
                case 'channel':
                  return { label: 'Canal TV ao Vivo', cls: 'bg-red-500/15 text-red-300 border-red-500/30', icon: Tv };
                case 'addon':
                  return { label: 'Addon', cls: 'bg-[#7b5be4]/20 text-[#c4b5fd] border-[#7b5be4]/40', icon: Puzzle };
                case 'iptv_url':
                case 'iptv_file':
                  return { label: item.type === 'iptv_file' ? 'Ficheiro IPTV' : 'Lista IPTV', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: Radio };
                default:
                  return { label: 'Configuração', cls: 'bg-slate-500/20 text-slate-300 border-slate-500/30', icon: Settings };
              }
            };

            return (
              <div className="space-y-8 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl">
                      <Trash2 className="w-6 h-6 text-red-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-white tracking-tight uppercase">
                          Reciclagem (Apenas Administrador)
                        </h2>
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Admin Only
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Visualize todos os ficheiros, addons, filmes, séries, canais de TV e configurações apagadas e clique em &ldquo;Recuperar&rdquo; para restaurar.
                      </p>
                    </div>
                  </div>

                  {recycledItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRestoreAllFiltered}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Recuperar Todos ({filteredRecycled.length})
                      </button>

                      {confirmEmptyBin ? (
                        <div className="flex items-center gap-1.5 bg-red-950/50 border border-red-500/40 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={async () => {
                              if (onEmptyRecycleBin) {
                                await onEmptyRecycleBin();
                              }
                              setConfirmEmptyBin(false);
                              triggerToast('Reciclagem esvaziada permanentemente.');
                            }}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                          >
                            Confirmar Limpeza
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmEmptyBin(false)}
                            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-[10px] font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmEmptyBin(true)}
                          className="px-3.5 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Esvaziar Reciclagem
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Search & Category Filter Tabs */}
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recycleSearch}
                      onChange={(e) => setRecycleSearch(e.target.value)}
                      placeholder="Pesquisar ficheiro, filme, canal, addon ou configuração apagada..."
                      className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-3 pl-11 pr-4 text-xs text-white outline-none focus:border-[#7b5be4]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: `Todos (${recycledItems.length})` },
                      { id: 'movie_series', label: `Filmes & Séries (${moviesSeriesCount})` },
                      { id: 'channel', label: `Canais TV (${channelsCount})` },
                      { id: 'addon', label: `Addons (${addonsCount})` },
                      { id: 'iptv', label: `Listas IPTV (${iptvCount})` },
                      { id: 'config', label: `Configurações (${configCount})` },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRecycleCategoryFilter(tab.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                          recycleCategoryFilter === tab.id
                            ? 'bg-[#7b5be4] text-white border-[#7b5be4] shadow-md shadow-[#7b5be4]/25'
                            : 'bg-[#0c0d10] text-slate-400 border-[#2d3139] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deleted Items List */}
                {filteredRecycled.length === 0 ? (
                  <div className="p-12 text-center bg-[#0c0d10] border border-dashed border-[#2d3139] rounded-3xl space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                      <Trash2 className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-black text-white">
                      {recycledItems.length === 0
                        ? 'A Reciclagem está vazia'
                        : 'Nenhum ficheiro encontrado neste filtro'}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Sempre que remover filmes, séries, canais de TV em direto, addons, listas IPTV ou alterar configurações, os ficheiros apagados aparecem aqui para que possa recuperá-los a qualquer momento.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                    {filteredRecycled.map((item) => {
                      const badge = getBadgeMeta(item);
                      const BadgeIcon = badge.icon;
                      const isRestoring = restoringItemId === item.id;
                      const formattedDate = item.deletedAt
                        ? new Date(item.deletedAt).toLocaleString('pt-AO', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Data desconhecida';

                      return (
                        <div
                          key={item.id}
                          className="p-4 bg-[#0c0d10] border border-[#2d3139] hover:border-[#7b5be4]/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {item.thumbnailUrl ? (
                              <img
                                src={item.thumbnailUrl}
                                alt={item.title}
                                referrerPolicy="no-referrer"
                                className="w-12 h-16 object-cover rounded-xl bg-slate-800 shrink-0 border border-white/10"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-slate-400">
                                <BadgeIcon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-black text-white truncate">{item.title}</h4>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${badge.cls}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                              {item.subtitle && (
                                <p className="text-xs text-slate-400 truncate max-w-xl">{item.subtitle}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 font-semibold">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Apagado em {formattedDate}
                                </span>
                                {item.deletedBy && <span>por {item.deletedBy}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isRestoring}
                              onClick={() => handleRestoreSingle(item)}
                              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95"
                              title="Restaurar e devolver este ficheiro/configuração à plataforma"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                              {isRestoring ? 'A recuperar...' : 'Recuperar'}
                            </button>

                            {onPermanentDeleteRecycledItem && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await onPermanentDeleteRecycledItem(item.id);
                                  triggerToast(`"${item.title}" eliminado definitivamente da Reciclagem.`);
                                }}
                                className="p-2 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-white/5 transition-all"
                                title="Eliminar definitivamente da Reciclagem"
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
              </div>
            );
          })()}

          {activeSection === 'users' && isAdmin && (() => {
            const onlineEmailSet = new Set((onlineUsers || []).map((o: any) => (o.email || '').trim().toLowerCase()));
            const onlineUsersList = systemUsers.filter((u) => onlineEmailSet.has((u.email || '').trim().toLowerCase()));
            const offlineUsersList = systemUsers.filter((u) => !onlineEmailSet.has((u.email || '').trim().toLowerCase()));

            const activeCount = systemUsers.filter(
              (u) => u.accountActive !== false && u.paymentStatus !== 'Desativado' && u.paymentStatus !== 'Expirado'
            ).length;
            const inactiveCount = systemUsers.filter(
              (u) => u.accountActive === false || u.paymentStatus === 'Desativado'
            ).length;
            const expiredPendingCount = systemUsers.filter(
              (u) => u.accountActive !== false && (u.paymentStatus === 'Pendente' || u.paymentStatus === 'Expirado')
            ).length;

            const filteredUsers = systemUsers.filter((u) => {
              const q = userSearch.trim().toLowerCase();
              if (q && !(u.name || '').toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) {
                return false;
              }
              const isDeactivated = u.accountActive === false || u.paymentStatus === 'Desativado';
              const isExpPend = u.paymentStatus === 'Pendente' || u.paymentStatus === 'Expirado';
              if (userFilter === 'active') return !isDeactivated && !isExpPend;
              if (userFilter === 'inactive') return isDeactivated;
              if (userFilter === 'expired') return isExpPend;
              return true;
            });

            return (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-amber-500" />
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">
                      Gestão de Contas, Acessos & Mensalidades (30 Dias)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Visualize utilizadores online/offline, adicione ou remova contas e renove acessos por 30 dias.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Adicionar Utilizador
                </button>
              </div>

              {/* Online vs Offline Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Contas</p>
                    <p className="text-2xl font-black text-white mt-0.5 font-mono">{systemUsers.length}</p>
                  </div>
                  <Users className="w-8 h-8 text-[#7b5be4]" />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSection('admin_online')}
                  className="p-4 bg-[#161a22] hover:bg-emerald-500/10 border border-emerald-500/40 rounded-2xl flex items-center justify-between shadow-lg text-left transition-all"
                  title="Abrir monitorização em tempo real dos utilizadores online"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Online Agora (Total)</p>
                    <p className="text-2xl font-black text-emerald-300 mt-0.5 font-mono">{onlineUsers.length}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Registados + Visitantes</p>
                  </div>
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
                </button>
                <div className="p-4 bg-[#161a22] border border-sky-500/30 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">Contas Online</p>
                    <p className="text-2xl font-black text-sky-300 mt-0.5 font-mono">{onlineUsersList.length}</p>
                  </div>
                  <Activity className="w-7 h-7 text-sky-400" />
                </div>
                <div className="p-4 bg-[#161a22] border border-slate-700/80 rounded-2xl flex items-center justify-between shadow-lg">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contas Offline</p>
                    <p className="text-2xl font-black text-slate-300 mt-0.5 font-mono">{offlineUsersList.length}</p>
                  </div>
                  <span className="w-3.5 h-3.5 rounded-full bg-slate-600" />
                </div>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'all', label: `Todas (${systemUsers.length})` },
                    { id: 'active', label: `Ativas (${activeCount})` },
                    { id: 'inactive', label: `Não Ativas / Desativadas (${inactiveCount})` },
                    { id: 'expired', label: `Expiradas / Pendentes (${expiredPendingCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setUserFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-all ${
                        userFilter === tab.id
                          ? 'bg-[#7b5be4] border-[#7b5be4] text-white'
                          : 'bg-[#0c0d10] border-[#2d3139] text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Filtrar utilizador ou email..."
                    className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Add User Modal */}
              {showAddUserModal && (
                <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="max-w-md w-full bg-[#161a22] border border-[#2d3139] rounded-3xl p-6 space-y-5 shadow-2xl animate-fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-black text-white uppercase tracking-wider">Adicionar Novo Utilizador</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAddUserModal(false)}
                        className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateUserByAdmin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nome do Utilizador</label>
                        <input
                          type="text"
                          required
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="Ex: Carlos Manuel"
                          className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email (Identificador)</label>
                        <input
                          type="email"
                          required
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="carlos@streaming.ao"
                          className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-white outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cargo / Permissão</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value as any)}
                          className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-amber-500 rounded-xl px-4 py-3 text-xs text-white outline-none"
                        >
                          <option value="user">Utilizador Comum (Cliente)</option>
                          <option value="admin">Administrador Root</option>
                        </select>
                      </div>

                      <p className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                        ✓ Inclui automaticamente 30 dias de acesso completo a filmes e TV em direto.
                      </p>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAddUserModal(false)}
                          className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-bold uppercase tracking-wider"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20"
                        >
                          Criar Utilizador
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-[#2d3139]">
                      <th className="pb-4 px-2">Utilizador</th>
                      <th className="pb-4 px-2">Data Pagamento</th>
                      <th className="pb-4 px-2">Validade Mensal</th>
                      <th className="pb-4 px-2">Conta / Estado</th>
                      <th className="pb-4 px-2">Dispositivos</th>
                      <th className="pb-4 px-2 text-right">Ações de Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3139]/50">
                    {filteredUsers.map((u, i) => {
                      const isRowEditing = editingUserEmail === u.email;
                      const payDate = u.paymentDate || defaultDates.paymentDate;
                      const expDate = u.expirationDate || defaultDates.expirationDate;
                      const isAccountActive = u.accountActive !== false && u.paymentStatus !== 'Desativado';
                      const status = isAccountActive ? (u.paymentStatus || 'Ativo') : 'Desativado';
                      const emailKey = (u.email || '').trim().toLowerCase();
                      const isUserOnline = onlineEmailSet.has(emailKey);
                      const devs: UserDevice[] = allUserDevices[emailKey] || getUserDevices(u.email);
                      const activeDevsCount = devs.filter((d) => d.enabled !== false).length;
                      const isDevicesExpanded = expandedUserDevicesEmail === emailKey;

                      return (
                        <React.Fragment key={u.email || i}>
                        <tr className="group hover:bg-white/5 transition-all">
                          <td className="py-4 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`relative w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${
                                isAccountActive ? 'bg-[#2d3139]' : 'bg-red-500/20 text-red-300 border border-red-500/30'
                              }`}>
                                {u.initial || (u.name ? u.name.substring(0, 2).toUpperCase() : 'US')}
                                <span
                                  className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#161a22] ${
                                    isUserOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                                  }`}
                                  title={isUserOnline ? 'Online Agora' : 'Offline'}
                                />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-bold text-white">{u.name}</p>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                      isUserOnline
                                        ? 'bg-emerald-500/15 text-emerald-400'
                                        : 'bg-white/5 text-slate-500'
                                    }`}
                                  >
                                    {isUserOnline ? 'Online' : 'Offline'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-2 text-xs font-mono text-slate-300">
                            {isRowEditing ? (
                              <input
                                type="date"
                                value={editingRowPayDate}
                                onChange={(e) => setEditingRowPayDate(e.target.value)}
                                className="bg-[#0c0d10] border border-[#7b5be4] rounded-lg px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              formatPtDate(payDate)
                            )}
                          </td>
                          <td className="py-4 px-2 text-xs font-mono text-emerald-400">
                            {isRowEditing ? (
                              <input
                                type="date"
                                value={editingRowExpDate}
                                onChange={(e) => setEditingRowExpDate(e.target.value)}
                                className="bg-[#0c0d10] border border-[#7b5be4] rounded-lg px-2 py-1 text-xs text-white"
                              />
                            ) : (
                              formatPtDate(expDate)
                            )}
                          </td>
                          <td className="py-4 px-2">
                            {isRowEditing ? (
                              <select
                                value={editingRowStatus}
                                onChange={(e) => setEditingRowStatus(e.target.value)}
                                className="bg-[#0c0d10] border border-[#7b5be4] rounded-lg px-2 py-1 text-xs text-white"
                              >
                                <option value="Ativo">Ativo</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Expirado">Expirado</option>
                                <option value="Desativado">Desativado</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                status === 'Ativo'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : status === 'Pendente'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-red-500/15 text-red-400'
                              }`}>
                                {status}
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedUserDevicesEmail(isDevicesExpanded ? null : emailKey)
                              }
                              className="px-2.5 py-1 bg-[#0c0d10] hover:bg-[#7b5be4]/20 border border-[#2d3139] rounded-lg text-[10px] font-bold text-slate-200 flex items-center gap-1.5 transition-all"
                            >
                              <Smartphone className="w-3 h-3 text-[#a78bfa]" />
                              <span>{activeDevsCount}/{devs.length} Ativos</span>
                              {isDevicesExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                          <td className="py-4 px-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isRowEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveUserRowPayment(u)}
                                    className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg transition-colors"
                                    title="Guardar pagamento"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingUserEmail(null)}
                                    className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                                    title="Cancelar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUserAccountActive(u)}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border transition-all ${
                                      isAccountActive
                                        ? 'bg-red-500/10 hover:bg-red-500/25 text-red-300 border-red-500/30'
                                        : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                                    }`}
                                    title={isAccountActive ? 'Desativar conta' : 'Ativar conta'}
                                  >
                                    <Power className="w-3 h-3" />
                                    {isAccountActive ? 'Desativar' : 'Ativar'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUserEmail(u.email);
                                      setEditingRowPayDate(payDate);
                                      setEditingRowExpDate(expDate);
                                      setEditingRowStatus(status);
                                    }}
                                    className="p-1.5 hover:bg-white/5 text-slate-500 hover:text-amber-500 rounded-lg"
                                    title="Editar data de pagamento / validade"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleRemoveUser(u.email)}
                                    className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-500 rounded-lg"
                                    title="Remover utilizador"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isDevicesExpanded && (
                          <tr className="bg-[#0c0d10]/80">
                            <td colSpan={6} className="p-4">
                              <div className="space-y-2.5">
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#a78bfa]">
                                  Dispositivos de {u.name} ({devs.length} / {MAX_DEVICES_PER_ACCOUNT})
                                </p>
                                {devs.length === 0 ? (
                                  <p className="text-xs text-slate-500">Nenhum dispositivo registado nesta conta.</p>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {devs.map((dev) => {
                                      const devActive = dev.enabled !== false;
                                      return (
                                        <div
                                          key={dev.id}
                                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                                            devActive
                                              ? 'bg-[#161a22] border-[#2d3139]'
                                              : 'bg-red-950/20 border-red-500/30'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-[#0c0d10] flex items-center justify-center shrink-0">
                                              {renderDeviceIcon(dev.type)}
                                            </div>
                                            <div className="min-w-0">
                                              <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-white truncate">{dev.name}</span>
                                                <span
                                                  className={`px-1.5 py-0.5 text-[9px] font-black uppercase rounded ${
                                                    devActive
                                                      ? 'bg-emerald-500/15 text-emerald-400'
                                                      : 'bg-red-500/20 text-red-300'
                                                  }`}
                                                >
                                                  {devActive ? 'Ativo' : 'Desativado'}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-slate-500 truncate">
                                                {dev.browserOrOs} • {dev.location} • {dev.lastActive}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleAdminToggleDevice(u.email, dev, devs)}
                                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                                devActive
                                                  ? 'bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                                                  : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                                              }`}
                                            >
                                              {devActive ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleAdminRemoveDevice(u.email, dev, devs)}
                                              className="p-1.5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg"
                                              title="Desconectar dispositivo"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            );
          })()}

          {activeSection === 'admin_online' && isAdmin && (() => {
            const registeredOnline = onlineUsers.filter((u) => !u.isGuest).length;
            const guestsOnline = onlineUsers.filter((u) => u.isGuest).length;

            const provinceCountsMap = new Map<string, number>();
            const locationCountsMap = new Map<string, { city: string; province: string; country: string; count: number }>();

            onlineUsers.forEach((u) => {
              const prov = (u.province || 'Luanda').trim();
              const city = (u.city || prov).trim();
              const country = (u.country || 'Angola').trim();
              provinceCountsMap.set(prov, (provinceCountsMap.get(prov) || 0) + 1);
              const locKey = `${city}|${prov}|${country}`;
              const existingLoc = locationCountsMap.get(locKey);
              if (existingLoc) {
                existingLoc.count += 1;
              } else {
                locationCountsMap.set(locKey, { city, province: prov, country, count: 1 });
              }
            });

            const sortedProvinces = Array.from(provinceCountsMap.entries()).sort((a, b) => b[1] - a[1]);
            const sortedLocations = Array.from(locationCountsMap.values()).sort((a, b) => b.count - a.count);
            const filteredOnlineUsers =
              provinceFilter === 'ALL'
                ? onlineUsers
                : onlineUsers.filter((u) => (u.province || 'Luanda') === provinceFilter);

            return (
              <div className="space-y-8 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-[#2d3139]/60">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight uppercase">
                        Utilizadores Online, Locais & Províncias
                      </h2>
                      <p className="text-xs text-slate-400">
                        Monitorização em tempo real do total de utilizadores ativos na plataforma, suas províncias e localidades
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                      Ao Vivo • {onlineUsers.length} Online Agora
                    </span>
                  </div>
                </div>

                {/* Top Summary KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 bg-[#0c0d10] rounded-2xl border border-emerald-500/30 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Total de Utilizadores Online
                    </span>
                    <p className="text-3xl font-black text-emerald-400 font-mono">{onlineUsers.length}</p>
                    <p className="text-[11px] text-slate-400">Sessões ativas neste momento</p>
                  </div>

                  <div className="p-5 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Contas Registadas Online
                    </span>
                    <p className="text-3xl font-black text-white font-mono">{registeredOnline}</p>
                    <p className="text-[11px] text-slate-400">Clientes & Administrador</p>
                  </div>

                  <div className="p-5 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Visitantes Online
                    </span>
                    <p className="text-3xl font-black text-sky-400 font-mono">{guestsOnline}</p>
                    <p className="text-[11px] text-slate-400">A explorar a plataforma</p>
                  </div>

                  <div className="p-5 bg-[#0c0d10] rounded-2xl border border-[#7b5be4]/30 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Províncias / Locais Ativos
                    </span>
                    <p className="text-3xl font-black text-[#a78bfa] font-mono">{sortedProvinces.length}</p>
                    <p className="text-[11px] text-slate-400">{sortedLocations.length} cidade(s) conectadas</p>
                  </div>
                </div>

                {/* Provinces & Locations Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-6 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-400" /> Distribuição por Províncias
                      </h3>
                      {provinceFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setProvinceFilter('ALL')}
                          className="text-[10px] font-bold text-[#a78bfa] hover:underline uppercase"
                        >
                          Mostrar Todas
                        </button>
                      )}
                    </div>

                    {sortedProvinces.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">A aguardar sessões ativas...</p>
                    ) : (
                      <div className="space-y-3">
                        {sortedProvinces.map(([province, count]) => {
                          const pct = onlineUsers.length > 0 ? Math.round((count / onlineUsers.length) * 100) : 0;
                          const isSelected = provinceFilter === province;
                          return (
                            <button
                              key={province}
                              type="button"
                              onClick={() => setProvinceFilter(isSelected ? 'ALL' : province)}
                              className={`w-full text-left p-3 rounded-xl border transition-all space-y-1.5 ${
                                isSelected
                                  ? 'bg-[#7b5be4]/15 border-[#7b5be4]'
                                  : 'bg-[#161a22] border-[#2d3139] hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-white">{province}</span>
                                <span className="text-emerald-400 font-mono">
                                  {count} {count === 1 ? 'utilizador' : 'utilizadores'} ({pct}%)
                                </span>
                              </div>
                              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-400 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-[#0c0d10] rounded-2xl border border-[#2d3139] space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-400" /> Locais Conectados Agora
                    </h3>
                    {sortedLocations.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4">Nenhum local ativo detetado.</p>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {sortedLocations.map((loc) => (
                          <div
                            key={`${loc.city}-${loc.province}-${loc.country}`}
                            className="p-3 bg-[#161a22] border border-[#2d3139] rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {loc.city}, {loc.province}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">{loc.country}</p>
                            </div>
                            <span className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-black font-mono shrink-0">
                              {loc.count} online
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Live Connected Users Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Sessões Ativas em Tempo Real ({filteredOnlineUsers.length})
                  </h3>
                  <div className="overflow-x-auto bg-[#0c0d10] rounded-2xl border border-[#2d3139] p-4">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 border-b border-[#2d3139]">
                          <th className="pb-3 px-2">Utilizador</th>
                          <th className="pb-3 px-2">Província</th>
                          <th className="pb-3 px-2">Local / País</th>
                          <th className="pb-3 px-2">Dispositivo</th>
                          <th className="pb-3 px-2">A Ver Agora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2d3139]/50">
                        {filteredOnlineUsers.map((sess) => (
                          <tr key={sess.sessionId} className="hover:bg-white/5 transition-all">
                            <td className="py-3.5 px-2">
                              <div className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-white">{sess.userName || 'Visitante'}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {sess.isGuest ? 'Visitante' : sess.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-2 text-xs font-bold text-emerald-300">
                              {sess.province || 'Luanda'}
                            </td>
                            <td className="py-3.5 px-2 text-xs text-slate-300">
                              {sess.city || 'Luanda'} • {sess.country || 'Angola'}
                            </td>
                            <td className="py-3.5 px-2 text-xs text-slate-400">
                              {sess.deviceName || 'Web'}
                            </td>
                            <td className="py-3.5 px-2 text-xs font-semibold text-[#a78bfa]">
                              {sess.currentView || 'Início'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 1. Termos e Notificações de Privacidade */}
          {activeSection === 'privacy_terms' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Termos e Notificações de Privacidade
                    </h2>
                    <p className="text-xs text-slate-400">
                      SALGUEIRO STREAMING ANGOLA Online TV • Direitos, Proteção de Dados e Transparência
                    </p>
                  </div>
                </div>
                <div className="px-3.5 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-black uppercase tracking-wider">
                  Vigência 2026 • Ativo
                </div>
              </div>

              {/* Highlight Banner */}
              <div className="p-5 bg-gradient-to-r from-[#7b5be4]/20 via-[#161a22] to-amber-500/10 border border-[#7b5be4]/35 rounded-2xl flex items-center gap-4">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    A sua conta dá direito a acesso ilimitado a todos os canais angolanos e mundiais em direto, sem taxas adicionais.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-[#7b5be4]">
                    <ShieldCheck className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-white uppercase tracking-wider">1. Termos de Utilização do Serviço</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    O acesso aos conteúdos da plataforma SALGUEIRO STREAMING ANGOLA Online TV destina-se a fins de entretenimento pessoal e doméstico. O assinante dispõe de conexão para até 4 dispositivos em simultâneo com reprodução contínua em 4K UHD e som de alta fidelidade.
                  </p>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-emerald-400">
                    <Lock className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-white uppercase tracking-wider">2. Privacidade e Proteção de Dados</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Tratamos os dados de utilizadores com encriptação estrita, em conformidade com as boas práticas da Agência de Proteção de Dados de Angola (APD). As credenciais, histórico de visualização e favoritos permanecem privados e nunca são partilhados com terceiros.
                  </p>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-amber-400">
                    <Tv className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-white uppercase tracking-wider">3. Transmissões em Direto e Canais</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    A transmissão de canais de TV ao vivo é disponibilizada via fluxos HTTP Live Streaming (HLS .m3u8) e listas M3U geridas pelo administrador. A plataforma atualiza dinamicamente as rotas para garantir o menor atraso e estabilidade de sinal.
                  </p>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2.5 text-sky-400">
                    <CreditCard className="w-5 h-5" />
                    <h3 className="font-bold text-sm text-white uppercase tracking-wider">4. Notificações e Faturação</h3>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    As subscrições mensais são processadas de forma segura via Multicaixa Express ou transferência bancária para bancos em Angola. O utilizador recebe notificações no ecrã sobre renovações, novos lançamentos e novidades de programação.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl text-xs text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-bold text-slate-300">Dúvidas sobre os nossos termos ou privacidade?</p>
                  <p className="text-[11px] text-slate-500">Contacte a nossa equipa jurídica e de atendimento em Luanda.</p>
                </div>
                <a
                  href="tel:+244923742598"
                  className="px-4 py-2 bg-[#7b5be4] hover:bg-[#8e74eb] text-white font-bold text-xs rounded-xl flex items-center gap-2 shrink-0 transition-all"
                >
                  <span>Linha de Atendimento: +244 923742598</span>
                </a>
              </div>
            </div>
          )}

          {/* 2. Ajuda */}
          {activeSection === 'help' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-300">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Central de Ajuda & Suporte
                    </h2>
                    <p className="text-xs text-slate-400">
                      Perguntas frequentes, orientações de uso e suporte técnico personalizado
                    </p>
                  </div>
                </div>
                <a
                  href="tel:+244923742598"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                >
                  <span>Ligar: +244 923742598</span>
                </a>
              </div>

              {/* Live Support Card */}
              <div className="p-6 bg-gradient-to-br from-[#161a22] to-[#0c0d10] border border-amber-500/30 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="space-y-1.5">
                  <span className="px-2.5 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-widest">
                    Linha de Atendimento Oficial
                  </span>
                  <h3 className="text-xl font-black text-white">
                    Precisa de suporte com o player, canais ou pagamentos?
                  </h3>
                  <p className="text-xs text-slate-400 max-w-xl">
                    A nossa equipa técnica responde a questões de configuração, listas IPTV, renovação de conta e ativação de dispositivos.
                  </p>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <a
                    href="https://wa.me/244923742598"
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg transition-all"
                  >
                    WhatsApp: +244 923742598
                  </a>
                  <a
                    href="tel:+244923742598"
                    className="px-5 py-3 bg-white/5 hover:bg-white/10 text-white border border-[#2d3139] font-bold text-xs uppercase tracking-wider rounded-xl text-center transition-all"
                  >
                    Chamada: +244 923742598
                  </a>
                </div>
              </div>

              {/* FAQ Accordions */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Perguntas Mais Frequentes (FAQ)
                </h3>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Tv className="w-4 h-4 text-[#7b5be4]" />
                    Como carregar e atualizar listas de IPTV ficheiros .m3u ou .m3u8?
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    O administrador pode carregar ficheiros <strong className="text-white">.m3u</strong> ou <strong className="text-white">.m3u8</strong> diretamente no menu <strong className="text-white">TV ao Vivo</strong> ou em <strong className="text-white">Listas e IPTV</strong> no Painel de Controlo. O sistema lê os canais e exibe-os instantaneamente na grelha. Pode clicar no botão <strong className="text-emerald-400">Atualizar Lista de Canais</strong> a qualquer momento para sincronizar.
                  </p>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Subtitles className="w-4 h-4 text-[#7b5be4]" />
                    Como mudar o áudio e legendas para Português (Brasil ou Portugal)?
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    Durante a reprodução de qualquer filme ou série, clique no ícone de engrenagem / áudio no reprodutor. Poderá selecionar entre as faixas de áudio em Português (Brasil ou Portugal) ou pesquisar legendas online em português e aplicá-las com 1 clique.
                  </p>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-[#7b5be4]" />
                    Quantos dispositivos posso conectar à minha assinatura?
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    Cada assinatura da SALGUEIRO STREAMING ANGOLA permite conectar até <strong className="text-white">4 dispositivos em simultâneo</strong> (Smart TV, telemóveis, computadores ou tablets). Pode gerir ou desconectar dispositivos na secção de Perfil.
                  </p>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#7b5be4]" />
                    O que está incluso na assinatura mensal?
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    <strong className="text-amber-400">TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.</strong> Terá acesso a canais nacionais de Angola (TPA, Zap Viva, TV Zimbo), canais internacionais de desporto, infantis, notícias, documentários e cinema mundial 4K UHD.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. Enviar Feedback */}
          {activeSection === 'feedback' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Enviar Feedback
                    </h2>
                    <p className="text-xs text-slate-400">
                      Partilhe a sua experiência, sugira filmes, canais ou relate qualquer ocorrência
                    </p>
                  </div>
                </div>
              </div>

              {feedbackSubmitted ? (
                <div className="p-8 bg-emerald-500/15 border border-emerald-500/40 rounded-3xl text-center space-y-4 animate-scale-up">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider">
                    Feedback Enviado com Sucesso!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    O seu parecer foi registado e enviado diretamente para <strong className="text-white">Salgueiro Araujo</strong> e para a equipa técnica da plataforma. Obrigado por nos ajudar a tornar o streaming em Angola cada vez melhor!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSubmitted(false);
                      setFeedbackForm(prev => ({ ...prev, message: '' }));
                    }}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                  >
                    Enviar Novo Feedback
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!feedbackForm.message.trim()) {
                      triggerToast('Por favor, escreva a sua mensagem de feedback.');
                      return;
                    }
                    try {
                      const savedFeedback = JSON.parse(localStorage.getItem('salgueiro_user_feedbacks') || '[]');
                      savedFeedback.push({
                        ...feedbackForm,
                        date: new Date().toISOString(),
                      });
                      localStorage.setItem('salgueiro_user_feedbacks', JSON.stringify(savedFeedback));
                    } catch {}
                    setFeedbackSubmitted(true);
                    triggerToast('Obrigado! Feedback enviado para Salgueiro Araujo e equipa técnica.');
                  }}
                  className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-3xl space-y-5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        O Seu Nome
                      </label>
                      <input
                        type="text"
                        required
                        value={feedbackForm.name}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, name: e.target.value })}
                        placeholder="Nome completo ou de utilizador"
                        className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        O Seu Email
                      </label>
                      <input
                        type="email"
                        required
                        value={feedbackForm.email}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, email: e.target.value })}
                        placeholder="exemplo@gmail.com"
                        className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Assunto / Categoria
                      </label>
                      <select
                        value={feedbackForm.category}
                        onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                        className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                      >
                        <option value="Sugestões e Pedidos de Conteúdo">Sugestão de Filmes e Séries</option>
                        <option value="Canais de TV ao Vivo">Sugestão de Canais de TV ao Vivo</option>
                        <option value="Qualidade de Streaming / Áudio">Qualidade de Streaming / Áudio e Legendas</option>
                        <option value="Interface e Temas">Interface, Temas e Usabilidade</option>
                        <option value="Outro / Elogio">Elogio ou Outro Assunto</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Classificação da Experiência ({feedbackForm.rating} de 5 Estrelas)
                      </label>
                      <div className="flex items-center gap-2 pt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                            className={`p-2 rounded-xl text-xs font-black transition-all ${
                              star <= feedbackForm.rating
                                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                                : 'bg-[#161a22] text-slate-500 hover:text-white'
                            }`}
                          >
                            ★ {star}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      A Sua Mensagem
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={feedbackForm.message}
                      onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                      placeholder="Descreva a sua opinião, pedido de novos filmes/séries, sugestão de canal de TV ou qualquer melhoria..."
                      className="w-full bg-[#161a22] border border-[#2d3139] rounded-xl p-4 text-xs text-white focus:outline-none focus:border-[#7b5be4]"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-500">
                      Atendimento direto: +244 923742598
                    </span>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-[#7b5be4]/20 flex items-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Enviar Feedback</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 4. Dispositivos Compatíveis */}
          {activeSection === 'compatible_devices' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <Monitor className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Dispositivos Compatíveis
                    </h2>
                    <p className="text-xs text-slate-400">
                      Assista em qualquer ecrã com até 4 conexões simultâneas em 4K UHD
                    </p>
                  </div>
                </div>
                <div className="px-3.5 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-black uppercase tracking-wider">
                  4 Ecrãs em Simultâneo
                </div>
              </div>

              {/* Highlight Card */}
              <div className="p-5 bg-gradient-to-r from-[#7b5be4]/20 via-[#161a22] to-amber-500/10 border border-[#7b5be4]/35 rounded-2xl flex items-center gap-4">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">
                    TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Sincronize os seus favoritos, histórico e canais em todos os seus aparelhos compatíveis.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-amber-400">
                    <Tv className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Smart TVs</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Samsung Smart TV (Tizen OS 2018 ou superior)</li>
                    <li>LG Smart TV (webOS 4.0 ou superior)</li>
                    <li>Android TV & Google TV (Sony, TCL, Philips, etc.)</li>
                    <li>Hisense Smart TV (VIDAA OS)</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-sky-400">
                    <Smartphone className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Telemóveis & Tablets</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Smartphones Android (Android 8.0 ou superior)</li>
                    <li>Apple iPhone (iOS 14.0 ou superior)</li>
                    <li>Apple iPad (iPadOS 14.0 ou superior)</li>
                    <li>Tablets Android e Samsung Galaxy Tab</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <Monitor className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Computadores & Laptops</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Google Chrome (Windows, macOS, Linux)</li>
                    <li>Microsoft Edge</li>
                    <li>Mozilla Firefox</li>
                    <li>Apple Safari</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-[#7b5be4]">
                    <HardDrive className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">TV Boxes & Streaming</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Amazon Fire TV Stick 4K & Max</li>
                    <li>Apple TV 4K</li>
                    <li>Chromecast com Google TV</li>
                    <li>Xiaomi Mi Box S & TV Stick</li>
                    <li>Roku Express 4K & Streaming Stick</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-pink-400">
                    <Activity className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Consolas de Videojogos</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>PlayStation 5 & PlayStation 4</li>
                    <li>Xbox Series X|S & Xbox One</li>
                    <li>Reprodução fluida através do navegador integrado</li>
                  </ul>
                </div>

                <div className="p-5 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-3">
                  <div className="flex items-center gap-3 text-cyan-400">
                    <Globe className="w-6 h-6" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Requisitos de Rede</h3>
                  </div>
                  <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                    <li>Canais HD: Mínimo de 5 Mbps</li>
                    <li>Filmes 4K UHD: Mínimo de 15 a 25 Mbps</li>
                    <li>Compatível com Zap Fibra, TvCabo, Unitel e Africell</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 5. Informações da Plataforma (SALGUEIRO STREAMING ANGOLA Online TV) */}
          {activeSection === 'platform_info' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Informações da Plataforma (SALGUEIRO STREAMING ANGOLA Online TV)
                    </h2>
                    <p className="text-xs text-slate-400">
                      Especificações técnicas, arquitetura de rede e direitos de transmissão
                    </p>
                  </div>
                </div>
                <div className="px-3.5 py-1.5 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-xl text-[#c4b5fd] text-xs font-black uppercase tracking-wider">
                  Edição 4K UHD Angola
                </div>
              </div>

              {/* Main Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Identidade da Plataforma
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Nome Oficial:</span>
                      <span className="font-bold text-white">SALGUEIRO STREAMING ANGOLA Online TV</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Arquiteto & Criador:</span>
                      <span className="font-bold text-amber-400">Salgueiro Araujo</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Linha de Atendimento:</span>
                      <a href="tel:+244923742598" className="font-bold text-emerald-400 hover:underline">
                        +244 923742598
                      </a>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Entidade Responsável:</span>
                      <span className="font-bold text-slate-200">Salgueiro Streaming Angola e Transmissões ao Vivo S.A.</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Localização da Sede:</span>
                      <span className="font-bold text-slate-200">Luanda, República de Angola</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Capacidades & Engenharia de Streaming
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Resolução de Vídeo:</span>
                      <span className="font-bold text-emerald-400">4K Ultra HD (2160p) & Full HD 1080p</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Formatos e Protocolos:</span>
                      <span className="font-bold text-white">HLS (.m3u8), M3U, Stremio Addons v3</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Áudio & Legendas:</span>
                      <span className="font-bold text-slate-200">Português (Brasil e Portugal) Automáticos</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Servidor de Conteúdo:</span>
                      <span className="font-bold text-slate-200">HTTP 206 Partial Content Range Streaming</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-slate-400">Dispositivos Permitidos:</span>
                      <span className="font-bold text-amber-400">Até 4 Ecrãs Simultâneos por Conta</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal and Support Banner */}
              <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-3xl space-y-3">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  © 2026 Salgueiro Streaming Angola e Transmissões ao Vivo S.A. Todos os direitos reservados. Qualquer distribuição, cópia ou redistribuição não autorizada dos fluxos sem prévia autorização escrita da Salgueiro Streaming Angola é estritamente proibida.
                </p>
                <div className="pt-2 flex items-center justify-between flex-wrap gap-4 text-xs font-bold">
                  <span className="text-slate-300">
                    Criado por <strong className="text-white">Salgueiro Araujo</strong>
                  </span>
                  <a href="tel:+244923742598" className="text-emerald-400 hover:underline">
                    Linha de atendimento : +244 923742598
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 6. Qualidade / Streaming */}
          {activeSection === 'streaming' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <Tv className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Qualidade & Reprodução de Vídeo
                    </h2>
                    <p className="text-xs text-slate-400">
                      Ajuste a resolução padrão, taxa de dados e buffer de streaming
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Resolução de Transmissão Padrão
                  </h3>
                  <div className="space-y-2">
                    {['4K Ultra HD (2160p)', 'Full HD (1080p)', 'HD (720p)', 'Automático (Adaptativo)'].map((res, i) => (
                      <div
                        key={res}
                        onClick={() => triggerToast(`Resolução padrão ajustada para ${res}`)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          i === 0
                            ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white'
                            : 'bg-[#161a22] border-[#2d3139] text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-xs font-bold">{res}</span>
                        {i === 0 && <Check className="w-4 h-4 text-emerald-400" />}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Otimização de Conexão em Angola
                  </h3>
                  <div className="space-y-3 text-xs text-slate-400 leading-relaxed">
                    <p>
                      A plataforma utiliza servidores de proximidade e transcodificação sob demanda para reduzir o consumo de dados móveis em redes Unitel e Africell, mantendo a mais alta estabilidade em conexões Zap Fibra e TvCabo.
                    </p>
                    <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Protocolo</span>
                      <p className="text-xs font-bold text-emerald-400">HTTP 206 Partial Content + HLS m3u8 Ativo</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. Segurança */}
          {activeSection === 'security' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Segurança da Conta & Sessões
                    </h2>
                    <p className="text-xs text-slate-400">
                      Estado de proteção, encriptação e controlo de acessos
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Estado de Proteção
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Encriptação de Sessão:</span>
                      <span className="font-bold text-emerald-400">TLS 1.3 / AES-256</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-[#2d3139]/60">
                      <span className="text-slate-400">Controlo de Dispositivos:</span>
                      <span className="font-bold text-white">4 Dispositivos Máximo</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-slate-400">Autenticação:</span>
                      <span className="font-bold text-emerald-400">Verificada</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Linha de Emergência & Suporte
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Caso suspeite de acessos não autorizados à sua assinatura, contacte imediatamente a Linha de Atendimento para redefinir as suas credenciais.
                  </p>
                  <a
                    href="tel:+244923742598"
                    className="w-full py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-widest rounded-xl text-center block transition-all"
                  >
                    Linha de Atendimento : +244 923742598
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 8. Sobre */}
          {activeSection === 'about' && (
            <div className="space-y-8 animate-fade-in">
              <div className="pb-6 border-b border-[#2d3139]/60 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#7b5be4]/20 border border-[#7b5be4]/40 rounded-2xl text-[#c4b5fd]">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight uppercase">
                      Sobre a Plataforma
                    </h2>
                    <p className="text-xs text-slate-400">
                      SALGUEIRO STREAMING ANGOLA Online TV
                    </p>
                  </div>
                </div>
              </div>

              {/* Informative Cards */}
              <div className="p-6 bg-gradient-to-r from-[#7b5be4]/20 via-[#161a22] to-amber-500/10 border border-[#7b5be4]/35 rounded-3xl space-y-3">
                <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  Assinatura Completa
                </span>
                <h3 className="text-xl font-black text-white">
                  TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Criado por <strong className="text-white">Salgueiro Araujo</strong>, a plataforma integra o melhor do cinema mundial, canais angolanos e globais em direto com tecnologia adaptativa de alta performance.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setActiveSection('privacy_terms')}
                  className="p-4 bg-[#0c0d10] hover:bg-[#161a22] border border-[#2d3139] rounded-2xl text-left space-y-1.5 transition-all group"
                >
                  <FileText className="w-5 h-5 text-[#7b5be4] group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-bold text-white">Termos e Notificações de Privacidade</h4>
                  <p className="text-[11px] text-slate-500">Regulamentação de dados e termos de uso</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('help')}
                  className="p-4 bg-[#0c0d10] hover:bg-[#161a22] border border-[#2d3139] rounded-2xl text-left space-y-1.5 transition-all group"
                >
                  <AlertCircle className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-bold text-white">Ajuda & FAQ</h4>
                  <p className="text-[11px] text-slate-500">Perguntas frequentes e apoio técnico</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('feedback')}
                  className="p-4 bg-[#0c0d10] hover:bg-[#161a22] border border-[#2d3139] rounded-2xl text-left space-y-1.5 transition-all group"
                >
                  <Bell className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-bold text-white">Enviar Feedback</h4>
                  <p className="text-[11px] text-slate-500">Sugira filmes, canais e melhorias</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('compatible_devices')}
                  className="p-4 bg-[#0c0d10] hover:bg-[#161a22] border border-[#2d3139] rounded-2xl text-left space-y-1.5 transition-all group"
                >
                  <Monitor className="w-5 h-5 text-sky-400 group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-bold text-white">Dispositivos Compatíveis</h4>
                  <p className="text-[11px] text-slate-500">Smart TVs, telemóveis e computadores</p>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSection('platform_info')}
                  className="p-4 bg-[#0c0d10] hover:bg-[#161a22] border border-[#2d3139] rounded-2xl text-left space-y-1.5 transition-all group"
                >
                  <Info className="w-5 h-5 text-[#a78bfa] group-hover:scale-110 transition-transform" />
                  <h4 className="text-xs font-bold text-white">Informações da Plataforma</h4>
                  <p className="text-[11px] text-slate-500">Especificações e direitos de transmissão</p>
                </button>
              </div>

              <div className="p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl text-xs space-y-2 text-slate-400">
                <p className="font-bold text-white">
                  Criado por Salgueiro Araujo
                </p>
                <p>
                  Linha de atendimento : <a href="tel:+244923742598" className="text-amber-400 font-bold hover:underline">+244 923742598</a>
                </p>
                <p className="text-[10px] text-slate-500 leading-tight">
                  © 2026 Salgueiro Streaming Angola e Transmissões ao Vivo S.A. Todos os direitos reservados.
                </p>
              </div>
            </div>
          )}

          {/* Fallback for unhandled sections */}
          {!['profile', 'interface', 'account', 'admin_online', 'admin_domain', 'admin_branding', 'admin_content', 'addons', 'users', 'recycle_bin', 'privacy_terms', 'help', 'feedback', 'compatible_devices', 'platform_info', 'streaming', 'security', 'about'].includes(activeSection) && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20 animate-fade-in">
              <div className="w-20 h-20 bg-[#0c0d10] rounded-full flex items-center justify-center border border-[#2d3139]">
                <Settings className="w-8 h-8 text-slate-700 animate-spin-slow" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase tracking-widest">Painel Administrativo</h2>
                <p className="text-sm text-slate-500 max-w-xs mx-auto font-bold uppercase tracking-widest">
                  Esta funcionalidade está a ser migrada para o novo núcleo Salgueiro v2.0.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

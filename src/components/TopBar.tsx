import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Film,
  Clapperboard,
  Tv,
  Heart,
  Puzzle,
  Upload,
  Settings,
  Search,
  LogOut,
  Menu,
  X,
  Play,
  Palette,
  Trash2,
} from 'lucide-react';
import { UserProfile } from '../types/streaming';
import { DEFAULT_ADMIN_AVATAR } from '../data/avatars';
import { usePlatformTheme, PLATFORM_THEMES } from '../lib/themes';

interface TopBarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  onSearch: (query: string) => void;
  onRegister: () => void;
  onLogin: () => void;
  user: UserProfile | null;
  onLogout: () => void;
  onOpenFavorites?: () => void;
  onOpenAdminUpload?: () => void;
  onlineUsersCount?: number;
  onOpenOnlineUsers?: () => void;
  onOpenThemeSettings?: () => void;
  onOpenRecycleBin?: () => void;
  recycleCount?: number;
  appTitle?: string;
  watchlistCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  setActiveView,
  onSearch,
  onRegister,
  onLogin,
  user,
  onLogout,
  onOpenAdminUpload,
  onlineUsersCount = 0,
  onOpenOnlineUsers,
  onOpenThemeSettings,
  onOpenRecycleBin,
  recycleCount = 0,
  watchlistCount,
}) => {
  const { theme } = usePlatformTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';
  const resolvedAvatar = user?.avatarUrl || (isAdmin ? DEFAULT_ADMIN_AVATAR : '');
  const displayName = user?.name || (isAdmin ? 'Administrador' : 'Visitante');

  const navItems = [
    { id: 'board', label: 'Início', icon: LayoutGrid },
    { id: 'international_movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Clapperboard },
    { id: 'live_tv', label: 'TV ao Vivo', icon: Tv, isLive: true },
    { id: 'library', label: 'Favoritos', icon: Heart },
    ...(isAdmin ? [
      { id: 'addons', label: 'Addons', icon: Puzzle },
      { id: 'recycle_bin', label: 'Reciclagem', icon: Trash2, badgeCount: recycleCount },
    ] : []),
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  // Global hotkey '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (viewId: string) => {
    if (viewId === 'recycle_bin' && onOpenRecycleBin) {
      onOpenRecycleBin();
    } else {
      setActiveView(viewId);
    }
    setMobileMenuOpen(false);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    onSearch(val);
  };

  const headerStyleClass =
    theme === 'netflix'
      ? 'bg-[#141414]/95 border-[#262626]'
      : theme === 'prime'
      ? 'bg-[#00050d]/95 border-[#1b2a38]'
      : theme === 'stremio'
      ? 'bg-[#110e1f]/95 border-[#2b244d]'
      : 'bg-[#121620]/95 border-[#2d3139]/80';

  const getActiveButtonClass = () => {
    if (theme === 'netflix') return 'bg-[#e50914] text-white shadow-md shadow-[#e50914]/30';
    if (theme === 'prime') return 'bg-[#00a8e1] text-slate-950 font-black shadow-md shadow-[#00a8e1]/30';
    if (theme === 'stremio') return 'bg-[#7b5bf5] text-white shadow-md shadow-[#7b5bf5]/30';
    return 'bg-[#7b5be4] text-white shadow-md shadow-[#7b5be4]/30';
  };

  const getPrimaryAccentBtnClass = () => {
    if (theme === 'netflix') return 'bg-[#e50914] hover:bg-[#f6121d] text-white shadow-[#e50914]/25';
    if (theme === 'prime') return 'bg-[#00a8e1] hover:bg-[#1ac0f8] text-slate-950 shadow-[#00a8e1]/25';
    if (theme === 'stremio') return 'bg-[#7b5bf5] hover:bg-[#9073ff] text-white shadow-[#7b5bf5]/25';
    return 'bg-[#7b5be4] hover:bg-[#8b6bf5] text-white shadow-[#7b5be4]/20';
  };

  const activeThemeMeta = PLATFORM_THEMES.find((t) => t.id === theme) || PLATFORM_THEMES[0];

  return (
    <header className={`sticky top-0 z-50 w-full backdrop-blur-xl border-b shadow-2xl transition-colors duration-200 ${headerStyleClass}`}>
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 h-11 sm:h-12 flex items-center justify-between gap-2 sm:gap-3">
        {/* Left Zone: Brand Logo + Navigation Menu immediately after platform name */}
        <div className="flex items-center gap-3 lg:gap-4 shrink-0">
          <button
            onClick={() => handleNavClick('board')}
            className="flex items-center gap-2.5 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-accent)] rounded-lg py-0.5 pr-1.5 transition-transform active:scale-95 shrink-0"
            aria-label="Salgueiro Streaming Angola Início"
          >
            {/* Angola Flag Badge with Play Button */}
            <div className="w-10 h-7 rounded-md flex items-center justify-center shrink-0 shadow-md relative group overflow-hidden border border-white/25 bg-black">
              <div className="absolute inset-0 flex flex-col pointer-events-none">
                <div className="flex-1 bg-[#cc092f]" />
                <div className="flex-1 bg-black" />
              </div>
              <div className="relative z-10 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow">
                <Play className="w-3 h-3 text-black fill-black ml-0.5" />
              </div>
            </div>

            {/* Brand Signature: SALGUEIRO STREAMING / Online TV ANGOLA */}
            <div className="leading-tight select-none flex flex-col justify-center">
              <div className="flex items-center gap-1.5 font-sans">
                <span className="text-red-500 font-black tracking-tight text-xs lg:text-[13px] uppercase leading-none">
                  SALGUEIRO
                </span>
                <span className="text-white font-black tracking-tight text-xs lg:text-[13px] uppercase leading-none">
                  STREAMING
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-sans mt-0.5">
                <span className="text-slate-300 text-[9px] lg:text-[10px] font-bold normal-case leading-none tracking-wider">
                  Online TV
                </span>
                <span className="bg-white text-black px-1.5 py-0.2 rounded text-[8px] lg:text-[8.5px] font-black leading-none uppercase tracking-wider">
                  ANGOLA
                </span>
              </div>
            </div>
          </button>

          {/* Desktop Navigation positioned right after the platform name on the left */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive =
                activeView === item.id ||
                (item.id === 'international_movies' && activeView === 'national_movies');
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 group ${
                    isActive
                      ? getActiveButtonClass()
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${
                      isActive
                        ? theme === 'prime'
                          ? 'text-slate-950'
                          : 'text-white'
                        : item.isLive
                        ? 'text-red-400'
                        : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span>{item.label}</span>

                  {(item as any).badgeCount > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black bg-red-600 text-white rounded-full">
                      {(item as any).badgeCount}
                    </span>
                  )}

                  {item.isLive && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-red-600 text-white rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      VIVO
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Medium Screen Navigation (lg to xl) right after platform name */}
          <nav className="hidden lg:flex xl:hidden items-center gap-1">
            {navItems.slice(0, 5).map((item) => {
              const isActive = activeView === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? getActiveButtonClass()
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${item.isLive && !isActive ? 'text-red-400' : ''}`} />
                  <span className="text-[11px]">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Center/Right Zone: Expanded Search reaching almost to Ajustes, Theme Shortcut, Admin Upload, User Profile */}
        <div className="flex-1 flex items-center justify-end gap-2 min-w-0 pl-1 sm:pl-2">
          {/* Quick Search Input stretched leftward almost up to Ajustes */}
          <div className="relative group hidden sm:block flex-1 min-w-[140px]">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[var(--theme-accent)] transition-colors">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Pesquisar filmes, séries e canais..."
              className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] text-white text-xs rounded-lg py-1 pl-8 pr-7 focus:outline-none focus:border-[var(--theme-accent)] focus:ring-2 focus:ring-[var(--theme-accent)]/20 transition-all placeholder:text-slate-500"
            />
            <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
              <kbd className="hidden lg:flex px-1.5 py-0.5 text-[9px] bg-[var(--theme-border)] border border-white/10 rounded text-slate-400 font-mono">
                /
              </kbd>
            </div>
          </div>

          {/* Quick Theme Switcher Shortcut (Admin only) */}
          {isAdmin && onOpenThemeSettings && (
            <button
              type="button"
              onClick={onOpenThemeSettings}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-[var(--theme-border)] text-slate-200 hover:text-white rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0"
              title="Alterar Tema da Interface (Flix, prime, stream, Clássico)"
            >
              <Palette className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span className="hidden 2xl:inline">{activeThemeMeta.shortName}</span>
            </button>
          )}

          {/* Admin Live Online Users Counter (Visible on all screens) */}
          {isAdmin && onOpenOnlineUsers && (
            <button
              type="button"
              onClick={onOpenOnlineUsers}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-black transition-all whitespace-nowrap shrink-0 shadow-sm"
              title="Ver número e lista de utilizadores online em tempo real"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{onlineUsersCount} Online</span>
            </button>
          )}

          {/* Admin Upload CTA */}
          {isAdmin && onOpenAdminUpload && (
            <button
              onClick={onOpenAdminUpload}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 ${getPrimaryAccentBtnClass()}`}
              title="Carregar Filme no Servidor"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Upload</span>
            </button>
          )}

          {/* User Profile / Auth Area */}
          {user ? (
            <div className="relative flex items-center gap-2">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-0.5 pl-1.5 hover:bg-white/5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--theme-accent)]"
                aria-label="Menu do Utilizador"
              >
                <div className="flex flex-col items-end hidden md:flex text-right">
                  <span className="text-[11px] font-bold text-white leading-tight max-w-[110px] truncate">{displayName}</span>
                  <span className={`text-[8.5px] font-black uppercase tracking-wider ${isAdmin ? 'text-amber-400' : 'text-[var(--theme-accent)]'}`}>
                    {isAdmin ? 'Admin' : 'Premium'}
                  </span>
                </div>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden flex items-center justify-center text-white text-xs font-black shadow-md ring-2 ${isAdmin ? 'ring-amber-500/80 bg-[#92c5ff]' : 'ring-[var(--theme-accent)]/60 bg-[#92c5ff]'}`}>
                  {resolvedAvatar ? (
                    <img src={resolvedAvatar} alt={displayName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-10 w-60 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-2xl shadow-2xl p-2 z-50 text-xs animate-fade-in space-y-1">
                  <div className="px-3 py-2 border-b border-[var(--theme-border)]">
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Conta Conectada</p>
                    <p className="font-bold text-white text-sm truncate mt-0.5">{user.name}</p>
                    <p className="text-slate-400 text-[11px] truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleNavClick('settings');
                    }}
                    className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-[var(--theme-accent)]" />
                    <span>Definições &amp; Perfil</span>
                  </button>
                  {isAdmin && onOpenThemeSettings && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenThemeSettings();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-[var(--theme-accent)]" />
                        <span>Tema / Interface</span>
                      </span>
                      <span className="text-[10px] text-slate-400">{activeThemeMeta.shortName}</span>
                    </button>
                  )}
                  {isAdmin && onOpenRecycleBin && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenRecycleBin();
                      }}
                      className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center justify-between transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4 text-red-400" />
                        <span>Reciclagem</span>
                      </span>
                      {recycleCount > 0 && (
                        <span className="px-1.5 py-0.5 text-[10px] font-black bg-red-600 text-white rounded-full">
                          {recycleCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleNavClick('library');
                    }}
                    className="w-full text-left px-3 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <Heart className="w-4 h-4 text-[var(--theme-accent)]" />
                    <span>Favoritos ({watchlistCount ?? 0})</span>
                  </button>
                  {isAdmin && onOpenOnlineUsers && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onOpenOnlineUsers();
                      }}
                      className="w-full text-left px-3 py-2 text-emerald-300 hover:bg-emerald-500/10 rounded-xl flex items-center gap-2 transition-colors font-bold"
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{onlineUsersCount} Utilizadores Online</span>
                    </button>
                  )}
                  <div className="pt-1 border-t border-[var(--theme-border)]">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-xl flex items-center gap-2 transition-colors font-bold"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Terminar Sessão</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={onRegister}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-lg active:scale-95 ${getPrimaryAccentBtnClass()}`}
              >
                Registro
              </button>
              <button
                onClick={onLogin}
                className="px-3 py-1 bg-transparent hover:bg-white/5 border border-[var(--theme-border)] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
              >
                Entrar
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger Toggle (Visible on screens below xl) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl focus:outline-none"
            aria-label="Abrir Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-red-400" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Responsive Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-[var(--theme-surface-alt)] border-b border-[var(--theme-border)] px-4 py-4 space-y-3 animate-fade-in shadow-2xl">
          {/* Mobile Search Bar */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Pesquisar filmes, séries e canais..."
              className="w-full bg-[var(--theme-surface)] border border-[var(--theme-border)] text-white text-xs rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:border-[var(--theme-accent)]"
            />
          </div>

          {/* Navigation Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
            <button
              onClick={() => handleNavClick('board')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'board'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Início</span>
            </button>

            <button
              onClick={() => handleNavClick('international_movies')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'international_movies'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Film className={`w-4 h-4 ${activeView === 'international_movies' ? '' : 'text-sky-400'}`} />
              <span>Filmes</span>
            </button>

            <button
              onClick={() => handleNavClick('series')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'series'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clapperboard className={`w-4 h-4 ${activeView === 'series' ? '' : 'text-amber-400'}`} />
              <span>Séries</span>
            </button>

            <button
              onClick={() => handleNavClick('live_tv')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'live_tv'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv className={`w-4 h-4 ${activeView === 'live_tv' ? '' : 'text-red-400'}`} />
              <span>TV ao Vivo</span>
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse ml-auto" />
            </button>

            <button
              onClick={() => handleNavClick('library')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'library'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Favoritos</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => handleNavClick('addons')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                  activeView === 'addons'
                    ? getActiveButtonClass()
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Puzzle className="w-4 h-4" />
                <span>Addons</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => handleNavClick('recycle_bin')}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Reciclagem</span>
                {recycleCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black bg-red-600 text-white rounded-full">
                    {recycleCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => handleNavClick('settings')}
              className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'settings'
                  ? getActiveButtonClass()
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Ajustes</span>
            </button>

            {isAdmin && onOpenThemeSettings && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenThemeSettings();
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
              >
                <Palette className="w-4 h-4 text-[var(--theme-accent)]" />
                <span>Tema: {activeThemeMeta.shortName}</span>
              </button>
            )}
          </div>

          {/* Mobile Admin & Quick Tools */}
          {isAdmin && (
            <div className="pt-2 border-t border-[var(--theme-border)] flex flex-wrap items-center gap-2">
              {onOpenAdminUpload && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdminUpload();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl ${getPrimaryAccentBtnClass()}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload de Filme</span>
                </button>
              )}
              {onOpenOnlineUsers && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenOnlineUsers();
                  }}
                  className="flex items-center gap-1.5 py-2 px-3 bg-emerald-500/10 text-emerald-300 text-xs font-bold rounded-xl border border-emerald-500/30"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{onlineUsersCount} Online</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

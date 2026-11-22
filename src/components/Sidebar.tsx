import React from 'react';
import { LayoutGrid, Heart, Settings, Tv, Play, Film, Clapperboard, Upload, Puzzle } from 'lucide-react';
import { UserProfile } from '../types/streaming';
import { DEFAULT_ADMIN_AVATAR } from '../data/avatars';

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  appTitle: string;
  onOpenAdminUpload?: () => void;
  isAdmin?: boolean;
  user?: UserProfile | null;
  onlineUsersCount?: number;
  onOpenOnlineUsers?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  appTitle,
  onOpenAdminUpload,
  isAdmin,
  user,
  onlineUsersCount = 0,
  onOpenOnlineUsers,
}) => {
  const navItems = [
    { id: 'board', label: 'Início', icon: LayoutGrid },
    { id: 'international_movies', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Clapperboard },
    { id: 'live_tv', label: 'TV em direto', icon: Tv },
    { id: 'library', label: 'Favoritos', icon: Heart },
    ...(isAdmin ? [
      { id: 'addons', label: 'Addons', icon: Puzzle },
      { id: 'admin_upload', label: 'Upload de Filme', icon: Upload },
    ] : []),
  ];

  const resolvedAvatar = user?.avatarUrl || (isAdmin ? DEFAULT_ADMIN_AVATAR : '');
  const displayName = user?.name || 'Salgueiro User';
  const displaySubtitle = isAdmin ? 'Administrador' : (user ? 'Membro Premium' : 'Premium Angola');

  return (
    <aside className="w-20 lg:w-72 flex flex-col h-screen bg-[#161a22] border-r border-[#2d3139] fixed left-0 top-0 z-50 transition-all duration-300">
      {/* Brand Logo Section */}
      <div className="h-16 flex items-center px-4 border-b border-[#2d3139]">
        <div className="w-12 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-lg relative group overflow-hidden border-2 border-white/20 bg-black">
          {/* Angola Flag Background */}
          <div className="absolute inset-0 flex flex-col pointer-events-none">
            <div className="flex-1 bg-[#cc092f]" /> {/* Red */}
            <div className="flex-1 bg-black" /> {/* Black */}
          </div>
          {/* Play Button Overlay */}
          <div className="relative z-10 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
            <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
          </div>
        </div>
        <div className="hidden lg:flex flex-col justify-center ml-3 leading-tight select-none">
          <div className="flex items-center gap-1.5 font-sans">
            <span className="text-red-500 font-black tracking-tight text-[11px] uppercase leading-none">SALGUEIRO</span>
            <span className="text-white font-black tracking-tight text-[11px] uppercase leading-none">STREAMING</span>
          </div>
          <div className="flex items-center gap-1.5 font-sans mt-0.5">
            <span className="text-slate-300 text-[9px] font-bold normal-case leading-none">Online TV</span>
            <span className="bg-white text-black px-1.5 py-0.2 rounded text-[8px] font-black leading-none uppercase">ANGOLA</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 space-y-2 px-3">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'admin_upload' && onOpenAdminUpload) {
                  onOpenAdminUpload();
                } else {
                  setActiveView(item.id);
                }
              }}
              className={`w-full flex items-center p-3 rounded-xl transition-all group ${
                isActive 
                  ? 'sidebar-item-active' 
                  : 'text-slate-400 hover:text-white hover:bg-[#2d3139]/50'
              }`}
            >
              <item.icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${
                isActive 
                  ? 'text-white' 
                  : (item.id === 'live_tv' || item.id === 'library')
                    ? 'text-[#7b5be4]'
                    : ''
              }`} />
              <span className="hidden lg:block ml-4 font-semibold text-sm">{item.label}</span>
              {isActive && (
                <div className="hidden lg:block ml-auto w-1.5 h-1.5 bg-white rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-[#2d3139] space-y-2">
        {isAdmin && onOpenOnlineUsers && (
          <button
            type="button"
            onClick={onOpenOnlineUsers}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-300 transition-all"
            title="Ver utilizadores online e províncias"
          >
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse mx-1.5" />
              <span className="hidden lg:block ml-3 font-bold text-xs">Utilizadores Online</span>
            </div>
            <span className="text-xs font-black font-mono text-emerald-300">{onlineUsersCount}</span>
          </button>
        )}
        <button 
          onClick={() => setActiveView('settings')}
          className={`w-full flex items-center p-3 rounded-xl transition-all ${
            activeView === 'settings' 
              ? 'sidebar-item-active' 
              : 'text-slate-400 hover:text-white hover:bg-[#2d3139]/50'
          }`}
        >
          <Settings className={`w-6 h-6 ${activeView === 'settings' ? 'text-white' : ''}`} />
          <span className="hidden lg:block ml-4 font-semibold text-sm">Ajustes</span>
        </button>
        <div 
          onClick={() => setActiveView('settings')}
          className={`lg:flex items-center p-3 gap-3 cursor-pointer rounded-xl transition-all ${
            activeView === 'settings' ? 'bg-[#7b5be4]/10 border border-[#7b5be4]/20' : 'hover:bg-[#2d3139]/50'
          }`}
        >
          <div className={`w-9 h-9 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-white text-xs font-bold ring-2 shrink-0 ${isAdmin ? 'ring-amber-500' : 'ring-[#7b5be4]'}`}>
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              'SA'
            )}
          </div>
          <div className="hidden lg:block overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{displayName}</p>
            <p className={`text-[10px] truncate ${isAdmin ? 'text-amber-400 font-bold' : 'text-slate-500'}`}>{displaySubtitle}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

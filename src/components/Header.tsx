import React, { useState } from 'react';
import { Search, Bell, User, Check, Play, Tv, Film, Clapperboard, Heart, Grid, Menu, X, Globe } from 'lucide-react';
import { ContentType } from '../types/streaming';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSearch: () => void;
  watchlistCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenSearch,
  watchlistCount,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'inicio', label: 'Início', icon: Play },
    { id: 'filmes', label: 'Filmes', icon: Film },
    { id: 'series', label: 'Séries', icon: Clapperboard },
    { id: 'tv_ao_vivo', label: 'TV ao Vivo', icon: Tv, highlight: true },
    { id: 'esportes', label: 'Esportes', icon: Globe },
    { id: 'kids', label: 'Kids', icon: Heart },
    { id: 'categorias', label: 'Categorias', icon: Grid },
    { id: 'minha_area', label: 'Minha Área', icon: Heart, count: watchlistCount },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090e17]/95 backdrop-blur-md border-b border-slate-800/80 transition-all duration-300">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
        {/* Left: Brand & Main Navigation */}
        <div className="flex items-center gap-8 shrink-0">
          {/* Salgueiro Streaming Angola Signature Logo */}
          <button
            onClick={() => setActiveTab('inicio')}
            className="flex items-center gap-1.5 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8e1] rounded-md py-1"
            aria-label="Salgueiro Streaming Angola Início"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg relative group overflow-hidden border-2 border-white/20 bg-black">
                {/* Angola Flag Background */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                  <div className="flex-1 bg-[#cc092f]" />
                  <div className="flex-1 bg-black" />
                </div>
                {/* Play Button Overlay */}
                <div className="relative z-10 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                  <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black tracking-tight font-sans flex flex-col justify-center select-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-red-500 uppercase leading-none">SALGUEIRO</span>
                  <span className="text-white uppercase leading-none">STREAMING</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-slate-300 text-[10px] font-bold tracking-wider normal-case leading-none">Online TV</span>
                  <span className="bg-white text-black px-1.5 py-0.2 rounded text-[9px] font-black leading-none uppercase">ANGOLA</span>
                </div>
              </div>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-3 py-1.5 rounded-md transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    isActive
                      ? 'text-white font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.highlight && (
                    <span className="inline-flex items-center px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                      AO VIVO
                    </span>
                  )}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-bold bg-[#00a8e1] text-white rounded-full">
                      {item.count}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-[-14px] left-3 right-3 h-[3px] bg-[#00a8e1] rounded-t-full shadow-[0_0_12px_#00a8e1]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Zone: Search, Notifications, Profiles */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Quick Search Button */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-[#00a8e1]"
            title="Buscar filmes, séries e canais de TV"
            aria-label="Buscar"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline text-slate-400">Buscar no Salgueiro...</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] bg-slate-900 border border-slate-700 rounded text-slate-400 font-mono">
              /
            </kbd>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationMenu(!showNotificationMenu);
                setShowProfileMenu(false);
              }}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-full transition-colors relative"
              aria-label="Notificações"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00a8e1] rounded-full ring-2 ring-[#090e17]" />
            </button>

            {showNotificationMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-[#0f172a] border border-slate-700 rounded-lg shadow-2xl py-3 z-50">
                <div className="px-4 pb-2 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Notificações</span>
                  <span className="text-xs text-[#00a8e1] cursor-pointer hover:underline">Marcar lidas</span>
                </div>
                <div className="divide-y divide-slate-800/60 text-xs">
                  <div className="p-3 hover:bg-slate-800/40 transition-colors">
                    <span className="text-red-400 font-bold uppercase text-[10px]">Ao Vivo Agora</span>
                    <p className="text-slate-200 font-medium mt-0.5">Final Continental: Lions FC vs Eagles United</p>
                    <span className="text-slate-400 text-[11px]">Transmissão ao vivo no canal 101 Salgueiro Sports</span>
                  </div>
                  <div className="p-3 hover:bg-slate-800/40 transition-colors">
                    <span className="text-[#00a8e1] font-bold uppercase text-[10px]">Novo Lançamento</span>
                    <p className="text-slate-200 font-medium mt-0.5">Project Hail Mary (2026) já está disponível</p>
                    <span className="text-slate-400 text-[11px]">Em 1080p IMAX WEB-DL com áudio 5.1</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Menu */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotificationMenu(false);
              }}
              className="flex items-center gap-2 p-1 hover:bg-slate-800/60 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00a8e1]"
              aria-label="Perfil do usuário"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#00a8e1] to-emerald-400 flex items-center justify-center text-white font-bold text-xs ring-2 ring-slate-800">
                P
              </div>
              <span className="hidden sm:inline text-xs font-medium text-slate-200">
                Principal
              </span>
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-[#0f172a] border border-slate-700 rounded-lg shadow-2xl py-2 z-50 text-sm">
                <div className="px-4 py-2 border-b border-slate-800">
                  <p className="text-xs text-slate-400">Perfil Ativo</p>
                  <p className="font-semibold text-white">Perfil Principal</p>
                  <span className="text-[11px] text-[#00a8e1]">Membro Salgueiro Ativo</span>
                </div>
                <div className="py-1 text-slate-300">
                  <button
                    onClick={() => {
                      setActiveTab('minha_area');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                  >
                    <span>Minha Lista de Favoritos</span>
                    <span className="text-xs font-mono text-[#00a8e1]">{watchlistCount}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('tv_ao_vivo');
                      setShowProfileMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-slate-800 hover:text-white"
                  >
                    Guia de Canais EPG
                  </button>
                  <button
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-800 hover:text-white"
                  >
                    Preferências de Vídeo & 4K
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-slate-300 hover:text-white focus:outline-none"
            aria-label="Abrir Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#090e17] border-b border-slate-800 px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${
                activeTab === item.id
                  ? 'bg-[#00a8e1]/10 text-[#00a8e1] font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.highlight && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-600 text-white rounded">
                  AO VIVO
                </span>
              )}
              {item.count !== undefined && item.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-mono bg-slate-800 text-[#00a8e1] rounded">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

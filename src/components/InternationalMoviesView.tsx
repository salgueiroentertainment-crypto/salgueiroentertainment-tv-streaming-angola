import React, { useState } from 'react';
import {
  Film,
  Trash2,
  Upload,
  Sparkles,
  RefreshCw,
  Puzzle,
} from 'lucide-react';
import { InstalledStremioAddon, MediaItem } from '../types/streaming';
import { AddonCatalogSection } from '../lib/stremioAddons';
import { ContentCard } from './ContentCard';
import { usePlatformTheme } from '../lib/themes';

interface InternationalMoviesViewProps {
  localMovies: MediaItem[];
  addonMovieSections?: AddonCatalogSection[];
  addons?: InstalledStremioAddon[];
  setAddons?: React.Dispatch<React.SetStateAction<InstalledStremioAddon[]>>;
  onItemClick: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (e: React.MouseEvent, item: MediaItem) => void;
  onOpenAddonsManager?: () => void;
  isAdmin?: boolean;
  onOpenAdminUpload?: () => void;
  onClearAllInternationalMovies?: () => Promise<void> | void;
  isSyncingArtwork?: boolean;
  onAutoSyncMovieArtworks?: () => Promise<void> | void;
  onPickMovieArtwork?: (item: MediaItem) => void;
  onEditMovie?: (item: MediaItem) => void;
  isLoadingAddonCatalogs?: boolean;
  onRefreshAddonCatalogs?: () => void;
}

export const InternationalMoviesView: React.FC<InternationalMoviesViewProps> = ({
  localMovies,
  addonMovieSections = [],
  addons = [],
  onItemClick,
  isInWatchlist,
  onToggleWatchlist,
  onOpenAddonsManager,
  isAdmin = false,
  onOpenAdminUpload,
  onClearAllInternationalMovies,
  isSyncingArtwork = false,
  onAutoSyncMovieArtworks,
  onPickMovieArtwork,
  onEditMovie,
  isLoadingAddonCatalogs = false,
  onRefreshAddonCatalogs,
}) => {
  const { theme } = usePlatformTheme();
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [selectedAddonKey, setSelectedAddonKey] = useState<string>('all');

  const enabledAddonsCount = addons.filter((a) => a.enabled).length;
  const totalAddonMovies = addonMovieSections.reduce((sum, s) => sum + s.items.length, 0);
  const visibleAddonSections =
    selectedAddonKey === 'all'
      ? addonMovieSections
      : addonMovieSections.filter((s) => s.key === selectedAddonKey);

  const handleConfirmClearAll = async () => {
    if (!onClearAllInternationalMovies) return;
    setClearingAll(true);
    try {
      await onClearAllInternationalMovies();
      setConfirmClearAll(false);
    } finally {
      setClearingAll(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-4">
          <div
            className="p-3.5 rounded-2xl shadow-lg text-white"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Film className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">Filmes</h1>
            <p className="text-xs text-[var(--theme-muted)] font-bold uppercase tracking-widest mt-1">
              Catálogo da plataforma ({localMovies.length})
              {totalAddonMovies > 0 ? ` • Addons adicionados (${totalAddonMovies})` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {enabledAddonsCount > 0 && onRefreshAddonCatalogs && (
            <button
              type="button"
              disabled={isLoadingAddonCatalogs}
              onClick={onRefreshAddonCatalogs}
              className="px-4 py-2.5 bg-[var(--theme-surface)] hover:bg-[var(--theme-accent)]/20 border border-[var(--theme-border)] text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              title="Recarregar catálogos dos addons adicionados"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAddonCatalogs ? 'animate-spin text-[var(--theme-accent)]' : ''}`} />
              <span>{isLoadingAddonCatalogs ? 'A carregar addons...' : 'Atualizar Addons'}</span>
            </button>
          )}

          {isAdmin && onAutoSyncMovieArtworks && localMovies.length > 0 && (
            <button
              type="button"
              disabled={isSyncingArtwork}
              onClick={() => void onAutoSyncMovieArtworks()}
              className="px-4 py-2.5 bg-[var(--theme-surface)] hover:bg-[var(--theme-accent)]/20 border border-[var(--theme-border)] text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              title="Procurar na web as capas e banners originais de todos os filmes"
            >
              {isSyncingArtwork ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--theme-accent)]" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              <span>{isSyncingArtwork ? 'A atualizar capas...' : 'Atualizar Capas & Banners Web'}</span>
            </button>
          )}

          {isAdmin && localMovies.length > 0 && onClearAllInternationalMovies && (
            confirmClearAll ? (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-1.5">
                <button
                  type="button"
                  disabled={clearingAll}
                  onClick={handleConfirmClearAll}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase rounded-lg disabled:opacity-50"
                >
                  {clearingAll ? 'A eliminar...' : 'Confirmar Eliminação'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="px-4 py-2.5 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Todos ({localMovies.length})
              </button>
            )
          )}

          {isAdmin && onOpenAdminUpload && (
            <button
              type="button"
              onClick={onOpenAdminUpload}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              Carregar Filme do Computador
            </button>
          )}
        </div>
      </div>

      {/* Platform Movies Section */}
      {localMovies.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Film className="w-5 h-5 text-[var(--theme-accent)]" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Filmes na Plataforma
              </h2>
              <span className="text-xs font-bold text-[var(--theme-muted)]">({localMovies.length} títulos)</span>
            </div>
          </div>

          <div
            className={
              theme === 'prime'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6'
            }
          >
            {localMovies.map((item) => (
              <div key={item.id} className="relative group/admincard">
                <ContentCard
                  item={item}
                  onClick={onItemClick}
                  isInWatchlist={isInWatchlist(item.id)}
                  onToggleWatchlist={onToggleWatchlist}
                  variant={theme === 'prime' ? 'landscape' : 'poster'}
                  isAdmin={isAdmin}
                  onEditMovie={onEditMovie}
                />
                {isAdmin && onPickMovieArtwork && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickMovieArtwork(item);
                    }}
                    className="absolute top-2 left-2 z-20 px-2 py-1 rounded-lg bg-black/80 hover:bg-[#7b5be4] text-amber-300 hover:text-white border border-amber-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg transition-all opacity-90 group-hover/admincard:opacity-100"
                    title="Upload local, URL ou escolher capa e banner na web"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Capa/Banner</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : (
        addonMovieSections.length === 0 && !isLoadingAddonCatalogs && (
          <section className="p-8 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center text-slate-500">
              <Film className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h2 className="text-lg font-black text-white tracking-tight">
                Lista de Filmes Vazia
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nenhum filme disponível de momento.
                {isAdmin
                  ? ' Pode carregar novos filmes do seu computador ou instalar addons com catálogos.'
                  : ''}
              </p>
            </div>
            {isAdmin && onOpenAdminUpload && (
              <button
                type="button"
                onClick={onOpenAdminUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all"
              >
                <Upload className="w-4 h-4" />
                Carregar Filme do Computador
              </button>
            )}
          </section>
        )
      )}

      {/* Addons Catalogs Loading Skeleton */}
      {isLoadingAddonCatalogs && addonMovieSections.length === 0 && (
        <section className="space-y-4 pt-2">
          <div className="flex items-center gap-2.5">
            <Puzzle className="w-5 h-5 text-[#a78bfa] animate-pulse" />
            <h2 className="text-lg font-black text-white tracking-tight">
              A carregar catálogos dos addons instalados...
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="aspect-[2/3] rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] animate-pulse" />
            ))}
          </div>
        </section>
      )}

      {/* Installed Addons Movie Catalogs */}
      {addonMovieSections.length > 0 && (
        <section className="space-y-6 pt-4 border-t border-[var(--theme-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Puzzle className="w-5 h-5 text-[#a78bfa]" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Catálogos dos Addons Adicionados
              </h2>
              <span className="text-xs font-bold text-[var(--theme-muted)]">({totalAddonMovies} filmes)</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {addonMovieSections.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedAddonKey('all')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      selectedAddonKey === 'all'
                        ? 'bg-[var(--theme-accent)] text-white'
                        : 'bg-[var(--theme-surface)] text-slate-400 hover:text-white border border-[var(--theme-border)]'
                    }`}
                  >
                    Todos ({totalAddonMovies})
                  </button>
                  {addonMovieSections.map((sec) => (
                    <button
                      key={sec.key}
                      type="button"
                      onClick={() => setSelectedAddonKey(sec.key)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        selectedAddonKey === sec.key
                          ? 'bg-[var(--theme-accent)] text-white'
                          : 'bg-[var(--theme-surface)] text-slate-400 hover:text-white border border-[var(--theme-border)]'
                      }`}
                    >
                      {sec.addonName} • {sec.catalogName} ({sec.items.length})
                    </button>
                  ))}
                </>
              )}
              {isAdmin && onOpenAddonsManager && (
                <button
                  type="button"
                  onClick={onOpenAddonsManager}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#7b5be4]/20 hover:bg-[#7b5be4] text-white border border-[#7b5be4]/40 transition-all"
                >
                  Gerir Addons
                </button>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {visibleAddonSections.map((section) => (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#7b5be4]/20 border border-[#7b5be4]/35 text-[#c4b5fd] text-[10px] font-black uppercase tracking-wider">
                      {section.addonName}
                    </span>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {section.catalogName}
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400 font-bold">
                    {section.items.length} títulos
                  </span>
                </div>

                <div
                  className={
                    theme === 'prime'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                      : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6'
                  }
                >
                  {section.items.map((item) => (
                    <ContentCard
                      key={`${section.key}-${item.id}`}
                      item={item}
                      onClick={onItemClick}
                      isInWatchlist={isInWatchlist(item.id)}
                      onToggleWatchlist={onToggleWatchlist}
                      variant={theme === 'prime' ? 'landscape' : 'poster'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

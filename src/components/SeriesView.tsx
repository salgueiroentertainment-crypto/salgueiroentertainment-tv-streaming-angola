import React, { useState } from 'react';
import {
  Clapperboard,
  Upload,
  Sparkles,
  RefreshCw,
  Puzzle,
  CheckCircle2,
} from 'lucide-react';
import { InstalledStremioAddon, MediaItem } from '../types/streaming';
import { AddonCatalogSection } from '../lib/stremioAddons';
import { ContentCard } from './ContentCard';
import { usePlatformTheme } from '../lib/themes';

interface SeriesViewProps {
  localSeries: MediaItem[];
  addonSeriesSections?: AddonCatalogSection[];
  addons?: InstalledStremioAddon[];
  onItemClick: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (e: React.MouseEvent, item: MediaItem) => void;
  onOpenAddonsManager?: () => void;
  isAdmin?: boolean;
  onOpenAdminUpload?: () => void;
  isSyncingArtwork?: boolean;
  onAutoSyncSeriesArtworks?: () => Promise<void> | void;
  onPickMovieArtwork?: (item: MediaItem) => void;
  onEditMovie?: (item: MediaItem) => void;
  isLoadingAddonCatalogs?: boolean;
  onRefreshAddonCatalogs?: () => void;
}

export const SeriesView: React.FC<SeriesViewProps> = ({
  localSeries,
  addonSeriesSections = [],
  addons = [],
  onItemClick,
  isInWatchlist,
  onToggleWatchlist,
  onOpenAddonsManager,
  isAdmin = false,
  onOpenAdminUpload,
  isSyncingArtwork = false,
  onAutoSyncSeriesArtworks,
  onPickMovieArtwork,
  onEditMovie,
  isLoadingAddonCatalogs = false,
  onRefreshAddonCatalogs,
}) => {
  const { theme } = usePlatformTheme();
  const [selectedSectionKey, setSelectedSectionKey] = useState<string>('all');

  const enabledAddonsCount = addons.filter((a) => a.enabled).length;
  const totalAddonSeries = addonSeriesSections.reduce((sum, s) => sum + s.items.length, 0);
  const totalSeriesCount = localSeries.length + totalAddonSeries;

  const visibleSections =
    selectedSectionKey === 'all'
      ? addonSeriesSections
      : addonSeriesSections.filter((s) => s.key === selectedSectionKey);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[var(--theme-border)]">
        <div className="flex items-center gap-4">
          <div
            className="p-3.5 rounded-2xl shadow-lg text-white"
            style={{ backgroundColor: 'var(--theme-accent)' }}
          >
            <Clapperboard className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-black text-white tracking-tighter">Séries</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                Deteção Automática ({totalSeriesCount})
              </span>
            </div>
            <p className="text-xs text-[var(--theme-muted)] font-bold uppercase tracking-widest mt-1">
              Séries detetadas automaticamente na plataforma e nos catálogos dos addons
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
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAddonCatalogs ? 'animate-spin text-[var(--theme-accent)]' : ''}`} />
              <span>{isLoadingAddonCatalogs ? 'A carregar séries...' : 'Atualizar Addons'}</span>
            </button>
          )}

          {isAdmin && onAutoSyncSeriesArtworks && localSeries.length > 0 && (
            <button
              type="button"
              disabled={isSyncingArtwork}
              onClick={() => void onAutoSyncSeriesArtworks()}
              className="px-4 py-2.5 bg-[var(--theme-surface)] hover:bg-[var(--theme-accent)]/20 border border-[var(--theme-border)] text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
              title="Procurar na web as capas e banners originais de todas as séries"
            >
              {isSyncingArtwork ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--theme-accent)]" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              <span>{isSyncingArtwork ? 'A atualizar capas...' : 'Atualizar Capas Web'}</span>
            </button>
          )}

          {isAdmin && onOpenAddonsManager && (
            <button
              type="button"
              onClick={onOpenAddonsManager}
              className="px-4 py-2.5 bg-[#7b5be4]/20 hover:bg-[#7b5be4] border border-[#7b5be4]/40 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all"
            >
              <Puzzle className="w-4 h-4" />
              <span>Gerir Addons</span>
            </button>
          )}

          {isAdmin && onOpenAdminUpload && (
            <button
              type="button"
              onClick={onOpenAdminUpload}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Upload className="w-4 h-4" />
              Carregar Série
            </button>
          )}
        </div>
      </div>

      {/* Platform Detected Series Section */}
      {localSeries.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <Clapperboard className="w-5 h-5 text-[var(--theme-accent)]" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Séries na Plataforma
              </h2>
              <span className="text-xs font-bold text-[var(--theme-muted)]">({localSeries.length} títulos)</span>
            </div>
          </div>

          <div
            className={
              theme === 'prime'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6'
            }
          >
            {localSeries.map((item) => (
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
      )}

      {/* Stremio Addons Series Catalogs Section */}
      {isLoadingAddonCatalogs && addonSeriesSections.length === 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Puzzle className="w-5 h-5 text-[#a78bfa] animate-pulse" />
            <h2 className="text-lg font-black text-white tracking-tight">
              A detetar séries dos addons instalados...
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="aspect-[2/3] rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-border)] animate-pulse" />
            ))}
          </div>
        </section>
      )}

      {addonSeriesSections.length > 0 && (
        <section className="space-y-6 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Puzzle className="w-5 h-5 text-[#a78bfa]" />
              <h2 className="text-lg font-black text-white tracking-tight">
                Séries dos Addons Adicionados
              </h2>
              <span className="text-xs font-bold text-[var(--theme-muted)]">({totalAddonSeries} séries)</span>
            </div>

            {addonSeriesSections.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedSectionKey('all')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                    selectedSectionKey === 'all'
                      ? 'bg-[var(--theme-accent)] text-white'
                      : 'bg-[var(--theme-surface)] text-slate-400 hover:text-white border border-[var(--theme-border)]'
                  }`}
                >
                  Todos ({totalAddonSeries})
                </button>
                {addonSeriesSections.map((sec) => (
                  <button
                    key={sec.key}
                    type="button"
                    onClick={() => setSelectedSectionKey(sec.key)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                      selectedSectionKey === sec.key
                        ? 'bg-[var(--theme-accent)] text-white'
                        : 'bg-[var(--theme-surface)] text-slate-400 hover:text-white border border-[var(--theme-border)]'
                    }`}
                  >
                    {sec.addonName} • {sec.catalogName} ({sec.items.length})
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-8">
            {visibleSections.map((section) => (
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
                    {section.items.length} séries
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

      {totalSeriesCount === 0 && !isLoadingAddonCatalogs && (
        <section className="p-8 bg-[var(--theme-surface)] border border-[var(--theme-border)] rounded-3xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[var(--theme-bg)] border border-[var(--theme-border)] flex items-center justify-center text-slate-500">
            <Clapperboard className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-lg font-black text-white tracking-tight">
              Nenhuma Série Detetada Ainda
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Carregue uma série (ou episódio S01E01 / Temporada) ou adicione um addon com catálogos de séries para aparecerem automaticamente aqui.
            </p>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onOpenAdminUpload && (
                <button
                  type="button"
                  onClick={onOpenAdminUpload}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--theme-accent)] text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all"
                >
                  <Upload className="w-4 h-4" />
                  Carregar Série
                </button>
              )}
              {onOpenAddonsManager && (
                <button
                  type="button"
                  onClick={onOpenAddonsManager}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  <Puzzle className="w-4 h-4" />
                  Adicionar Addons
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

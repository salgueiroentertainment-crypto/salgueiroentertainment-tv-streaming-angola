import React from 'react';
import { ContentCard } from './ContentCard';
import { MediaItem } from '../types/streaming';
import {
  ChevronRight,
  Sparkles,
  History,
  LayoutGrid,
  Film,
  Clapperboard,
  Tv,
  Heart,
  Puzzle,
  Settings,
} from 'lucide-react';
import { HeroBanner } from './HeroBanner';
import { ContentRail } from './ContentRail';
import { usePlatformTheme } from '../lib/themes';

interface BoardViewProps {
  popular: MediaItem[];
  continueWatching: any[];
  onItemClick: (item: MediaItem) => void;
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (e: React.MouseEvent | null, item: MediaItem) => void;
  customHeroImage?: string;
  onNavigate?: (view: string) => void;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

const LOCAL_CHANNEL_FALLBACK = '/src/assets/images/live_sports_stadium_1794091825611.jpg';

export const BoardView: React.FC<BoardViewProps> = ({
  popular,
  continueWatching,
  onItemClick,
  onPlay,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
  customHeroImage,
  onNavigate,
  isAdmin = false,
  onEditMovie,
}) => {
  const { theme } = usePlatformTheme();

  const movieItems = popular.filter((i) => i.type === 'movie');
  const seriesItems = popular.filter((i) => i.type === 'series');
  const liveTvItems = popular.filter((i) => i.type === 'live_tv');

  const continueProgressMap: Record<string, number> = {};
  const continueItems: MediaItem[] = continueWatching.map((cw) => {
    continueProgressMap[cw.media.id] = cw.percentage ?? 25;
    return cw.media;
  });

  // ── 1. NETFLIX LAYOUT CLONE ────────────────────────────────────────────────
  if (theme === 'netflix') {
    return (
      <div className="space-y-8 animate-fade-in pb-12">
        <HeroBanner
          items={popular}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          isInWatchlist={isInWatchlist}
          onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
          customHeroImage={customHeroImage}
          isAdmin={isAdmin}
          onEditMovie={onEditMovie}
        />

        {continueItems.length > 0 && (
          <ContentRail
            title="Continuar a Assistir no Salgueiro"
            items={continueItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            progressMap={continueProgressMap}
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {movieItems.length > 0 && (
          <ContentRail
            title="Brasil & Angola: Top 10 em Filmes Hoje"
            items={movieItems.slice(0, 10)}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="top10"
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {movieItems.length > 0 && (
          <ContentRail
            title="Em Alta Agora • Catálogo Completo"
            subtitle={`${movieItems.length} títulos`}
            items={movieItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {seriesItems.length > 0 && (
          <ContentRail
            title="Séries em Destaque"
            subtitle={`${seriesItems.length} séries`}
            items={seriesItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {liveTvItems.length > 0 && (
          <ContentRail
            title="TV em Direto • Canais Angolanos & Mundiais"
            items={liveTvItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
          />
        )}
      </div>
    );
  }

  // ── 2. PRIME VIDEO LAYOUT CLONE ────────────────────────────────────────────
  if (theme === 'prime') {
    return (
      <div className="space-y-8 animate-fade-in pb-12">
        <HeroBanner
          items={popular}
          onPlay={onPlay}
          onOpenDetail={onOpenDetail}
          isInWatchlist={isInWatchlist}
          onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
          customHeroImage={customHeroImage}
          isAdmin={isAdmin}
          onEditMovie={onEditMovie}
        />

        {continueItems.length > 0 && (
          <ContentRail
            title="Continuar a Assistir"
            subtitle="Retome onde parou"
            items={continueItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            progressMap={continueProgressMap}
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {movieItems.length > 0 && (
          <ContentRail
            title="Filmes Incluídos no Salgueiro"
            subtitle="Seleção em 4K UHD"
            items={movieItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {seriesItems.length > 0 && (
          <ContentRail
            title="Séries no Salgueiro"
            subtitle={`${seriesItems.length} séries disponíveis`}
            items={seriesItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
            isAdmin={isAdmin}
            onEditMovie={onEditMovie}
          />
        )}

        {liveTvItems.length > 0 && (
          <ContentRail
            title="Canais ao Vivo • Salgueiro Sports & TV"
            items={liveTvItems}
            onPlay={onPlay}
            onOpenDetail={onOpenDetail}
            isInWatchlist={isInWatchlist}
            onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
            mode="landscape"
          />
        )}

        {/* Prime Widescreen Grid */}
        {movieItems.length > 0 && (
          <section className="space-y-4 px-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span className="text-xs font-black text-[#00a8e1] uppercase">Prime</span>
                <span>Explorar Todos os Filmes</span>
              </h2>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('international_movies')}
                  className="text-xs font-bold text-[#79b8f3] hover:text-[#00a8e1] flex items-center gap-1"
                >
                  Ver tudo <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {movieItems.slice(0, 8).map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onClick={onItemClick}
                  isInWatchlist={isInWatchlist(item.id)}
                  onToggleWatchlist={onToggleWatchlist}
                  variant="landscape"
                  isAdmin={isAdmin}
                  onEditMovie={onEditMovie}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ── 3. WEB.STREMIO.COM LAYOUT / SKIN CLONE ────────────────────────────────
  if (theme === 'stremio') {
    const stremioRailNav = [
      { id: 'board', label: 'Board', icon: LayoutGrid },
      { id: 'international_movies', label: 'Filmes', icon: Film },
      { id: 'series', label: 'Séries', icon: Clapperboard },
      { id: 'live_tv', label: 'TV Ao Vivo', icon: Tv },
      { id: 'library', label: 'Biblioteca', icon: Heart },
      ...(isAdmin ? [{ id: 'addons', label: 'Addons', icon: Puzzle }] : []),
      { id: 'settings', label: 'Ajustes', icon: Settings },
    ];

    return (
      <div className="stremio-board-backdrop rounded-3xl border border-[#7b5bf5]/20 p-3 sm:p-5 animate-fade-in">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sleek Left Vertical Dock (web.stremio.com style) */}
          <aside className="lg:w-20 flex-none flex lg:flex-col items-center justify-between lg:justify-start gap-2 bg-[#130f24]/90 backdrop-blur-md border border-[#7b5bf5]/20 rounded-2xl p-2 sm:py-4 overflow-x-auto no-scrollbar">
            {stremioRailNav.map((nav) => {
              const Icon = nav.icon;
              const isBoardActive = nav.id === 'board';
              return (
                <button
                  key={nav.id}
                  type="button"
                  onClick={() => onNavigate && onNavigate(nav.id)}
                  className={`flex flex-col items-center justify-center gap-1 w-16 h-14 rounded-xl text-[10px] font-bold transition-all shrink-0 ${
                    isBoardActive
                      ? 'bg-[#7b5bf5] text-white shadow-lg shadow-[#7b5bf5]/35'
                      : 'text-[#a39ec4] hover:text-white hover:bg-[#7b5bf5]/15'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="truncate max-w-[58px]">{nav.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Main Stremio Board Content */}
          <div className="flex-1 min-w-0 space-y-8 pb-6">
            <HeroBanner
              items={popular}
              onPlay={onPlay}
              onOpenDetail={onOpenDetail}
              isInWatchlist={isInWatchlist}
              onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
              customHeroImage={customHeroImage}
              isAdmin={isAdmin}
              onEditMovie={onEditMovie}
            />

            {continueItems.length > 0 && (
              <ContentRail
                title="Continuar a Assistir"
                subtitle="Progresso sincronizado"
                items={continueItems}
                onPlay={onPlay}
                onOpenDetail={onOpenDetail}
                isInWatchlist={isInWatchlist}
                onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
                mode="poster"
                progressMap={continueProgressMap}
                isAdmin={isAdmin}
                onEditMovie={onEditMovie}
              />
            )}

            {movieItems.length > 0 && (
              <ContentRail
                title="Board — Filmes em Destaque"
                subtitle="Catálogo Salgueiro Streaming"
                items={movieItems}
                onPlay={onPlay}
                onOpenDetail={onOpenDetail}
                isInWatchlist={isInWatchlist}
                onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
                mode="poster"
                isAdmin={isAdmin}
                onEditMovie={onEditMovie}
              />
            )}

            {seriesItems.length > 0 && (
              <ContentRail
                title="Board — Séries Detetadas"
                subtitle="Catálogo Salgueiro Streaming"
                items={seriesItems}
                onPlay={onPlay}
                onOpenDetail={onOpenDetail}
                isInWatchlist={isInWatchlist}
                onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
                mode="poster"
                isAdmin={isAdmin}
                onEditMovie={onEditMovie}
              />
            )}

            {liveTvItems.length > 0 && (
              <ContentRail
                title="Canais TV Ao Vivo — Stremio Addons & IPTV"
                items={liveTvItems}
                onPlay={onPlay}
                onOpenDetail={onOpenDetail}
                isInWatchlist={isInWatchlist}
                onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
                mode="landscape"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── 4. DEFAULT SALGUEIRO CLÁSSICO LAYOUT ───────────────────────────────────
  return (
    <div className="space-y-12 animate-fade-in pb-12">
      {/* Featured Slideshow Banner Section */}
      <HeroBanner
        items={popular}
        onPlay={onPlay}
        onOpenDetail={onOpenDetail}
        isInWatchlist={isInWatchlist}
        onToggleWatchlist={(item) => onToggleWatchlist(null, item)}
        customHeroImage={customHeroImage}
        isAdmin={isAdmin}
        onEditMovie={onEditMovie}
      />

      {/* Board Rails */}
      <div className="grid grid-cols-1 gap-12">
        {/* Continue Watching */}
        {continueWatching.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#7b5be4]/20 rounded-xl">
                  <History className="w-5 h-5 text-[#7b5be4]" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">Continuar Assistindo</h2>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('international_movies')}
                  className="text-slate-400 hover:text-[#7b5be4] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                  Ver todos <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {continueWatching.map((item) => (
                <div key={item.media.id} className="relative group">
                  <ContentCard
                    item={item.media}
                    onClick={onItemClick}
                    isInWatchlist={isInWatchlist(item.media.id)}
                    onToggleWatchlist={onToggleWatchlist}
                    progressPercent={item.percentage}
                    isAdmin={isAdmin}
                    onEditMovie={onEditMovie}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Popular Movies */}
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Mais Populares</h2>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('international_movies')}
                className="text-slate-400 hover:text-[#7b5be4] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                Explorar <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {popular.slice(0, 12).map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                onClick={onItemClick}
                isInWatchlist={isInWatchlist(item.id)}
                onToggleWatchlist={onToggleWatchlist}
                isAdmin={isAdmin}
                onEditMovie={onEditMovie}
              />
            ))}
          </div>
        </section>

        {/* Detected Series Section */}
        {seriesItems.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#7b5be4]/20 rounded-xl">
                  <Clapperboard className="w-5 h-5 text-[#a78bfa]" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight">Séries</h2>
              </div>
              {onNavigate && (
                <button
                  onClick={() => onNavigate('series')}
                  className="text-slate-400 hover:text-[#7b5be4] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
                >
                  Ver Séries <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {seriesItems.slice(0, 12).map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onClick={onItemClick}
                  isInWatchlist={isInWatchlist(item.id)}
                  onToggleWatchlist={onToggleWatchlist}
                  isAdmin={isAdmin}
                  onEditMovie={onEditMovie}
                />
              ))}
            </div>
          </section>
        )}

        {/* TV Channels Section */}
        <section className="space-y-6 bg-[#161a22]/30 p-8 rounded-3xl border border-[#2d3139]/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Canais Angolanos & Globais</h2>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('live_tv')}
                className="text-slate-400 hover:text-[#7b5be4] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                Ver Todos <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {liveTvItems.map((ch) => (
              <div
                key={ch.id}
                onClick={() => onItemClick(ch)}
                className="flex-none w-64 bg-[#161a22] p-4 rounded-2xl border border-[#2d3139] hover:border-[#7b5be4] transition-all cursor-pointer group"
              >
                <div className="aspect-video rounded-xl bg-black mb-3 overflow-hidden relative flex items-center justify-center">
                  <img
                    src={ch.bannerUrl || ch.thumbnailUrl || LOCAL_CHANNEL_FALLBACK}
                    alt={ch.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src = LOCAL_CHANNEL_FALLBACK;
                      }
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                    Live
                  </div>
                </div>
                <h4 className="text-sm font-bold text-white truncate">{ch.title}</h4>
                <p className="text-[10px] text-slate-500 mt-1 truncate">{ch.liveChannel?.currentShow}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

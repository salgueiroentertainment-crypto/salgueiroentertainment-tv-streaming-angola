import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Check, Info, Edit2 } from 'lucide-react';
import { MediaItem } from '../types/streaming';
import { usePlatformTheme } from '../lib/themes';

interface ContentRailProps {
  title: string;
  subtitle?: string;
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: MediaItem) => void;
  mode?: 'landscape' | 'poster' | 'top10';
  progressMap?: Record<string, number>;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

const LOCAL_RAIL_FALLBACK = '/src/assets/images/fenix_movie_banner_1794518590130.jpg';

export const ContentRail: React.FC<ContentRailProps> = ({
  title,
  subtitle,
  items,
  onPlay,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
  mode,
  progressMap,
  isAdmin = false,
  onEditMovie,
}) => {
  const { theme, prefs } = usePlatformTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isNetflix = theme === 'netflix';
  const isPrime = theme === 'prime';
  const isStremio = theme === 'stremio';

  const effectiveMode =
    mode || (isStremio ? 'poster' : 'landscape');

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="relative py-3 sm:py-4 group">
      {/* Rail Header */}
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            {isPrime && (
              <span className="text-xs font-black text-[#00a8e1] uppercase tracking-wider">
                Prime
              </span>
            )}
            {isNetflix && effectiveMode === 'top10' && (
              <span className="px-1.5 py-0.5 bg-[#E50914] text-white text-[10px] font-black rounded uppercase">
                TOP 10
              </span>
            )}
            <span>{title}</span>
          </h2>
          {subtitle && <span className="text-xs text-slate-400">· {subtitle}</span>}
        </div>
      </div>

      {/* Navigation Chevrons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-[55%] -translate-y-1/2 z-20 w-10 h-28 bg-black/75 hover:bg-black/95 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r-lg border-y border-r border-white/10 shadow-xl"
        aria-label="Rolar para esquerda"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-[55%] -translate-y-1/2 z-20 w-10 h-28 bg-black/75 hover:bg-black/95 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-l-lg border-y border-l border-white/10 shadow-xl"
        aria-label="Rolar para direita"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Carousel Track */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-3 pt-1 px-1"
      >
        {items.map((item, idx) => {
          const inWatchlist = isInWatchlist(item.id);
          const pct = progressMap?.[item.id];

          if (effectiveMode === 'top10') {
            return (
              <div
                key={item.id}
                onClick={() => onOpenDetail(item)}
                className="group/card relative flex-none flex items-end cursor-pointer pr-2"
              >
                <span className="netflix-rank-number z-0 -mr-5 mb-[-10px] transition-transform duration-300 group-hover/card:scale-105">
                  {idx + 1}
                </span>
                <div className="relative z-10 w-[135px] sm:w-[160px] aspect-[2/3] rounded-md overflow-hidden bg-[#181818] border border-white/10 group-hover/card:border-[#E50914] group-hover/card:scale-105 transition-all duration-300 shadow-2xl">
                  <img
                    src={item.thumbnailUrl || item.bannerUrl || LOCAL_RAIL_FALLBACK}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src = LOCAL_RAIL_FALLBACK;
                      }
                    }}
                  />
                  {isAdmin && onEditMovie && item.type !== 'live_tv' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMovie(item);
                      }}
                      className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg transition-all"
                      title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>Editar</span>
                    </button>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black via-black/80 to-transparent">
                    <p className="text-xs font-bold text-white truncate">{item.title}</p>
                    <p className="text-[10px] text-[#E50914] font-bold">#{idx + 1} Hoje</p>
                  </div>
                </div>
              </div>
            );
          }

          if (effectiveMode === 'poster') {
            return (
              <div
                key={item.id}
                onClick={() => onOpenDetail(item)}
                className={`group/card relative flex-none ${
                  prefs.compactCards ? 'w-[140px] sm:w-[160px]' : 'w-[155px] sm:w-[180px]'
                } cursor-pointer transition-transform duration-200 hover:-translate-y-1`}
              >
                <div
                  className={`aspect-[2/3] rounded-xl overflow-hidden relative border transition-all ${
                    isStremio
                      ? 'bg-[#17132b] border-[#7b5bf5]/25 group-hover/card:border-[#7b5bf5] group-hover/card:shadow-[0_0_24px_rgba(123,91,245,0.3)]'
                      : 'bg-[#181818] border-white/10 group-hover/card:border-white/40'
                  }`}
                >
                  <img
                    src={item.thumbnailUrl || item.bannerUrl || LOCAL_RAIL_FALLBACK}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallbackApplied) {
                        img.dataset.fallbackApplied = '1';
                        img.src = LOCAL_RAIL_FALLBACK;
                      }
                    }}
                  />
                  {prefs.showQualityBadges && (
                    <span className="absolute top-2 right-2 bg-black/75 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-white/10">
                      ★ {item.imdbScore}
                    </span>
                  )}
                  {typeof pct === 'number' && pct > 0 && (
                    <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
                      <div
                        className={`h-full ${isNetflix ? 'bg-[#E50914]' : 'bg-[#7b5bf5]'}`}
                        style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                      />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        isNetflix ? 'bg-[#E50914] text-white' : 'bg-[#7b5bf5] text-white'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(item);
                      }}
                      className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/25"
                    >
                      {inWatchlist ? <Check className="w-4 h-4 text-[#22b365]" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs font-bold text-white truncate px-0.5 group-hover/card:text-[#a78bfa]">
                  {item.title}
                </p>
                <div className="flex items-center justify-between gap-1.5 px-0.5 mt-0.5">
                  <p className="text-[10px] text-slate-400 truncate">
                    {item.year} · {item.genres[0]}
                  </p>
                  {isAdmin && onEditMovie && item.type !== 'live_tv' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMovie(item);
                      }}
                      className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow transition-all shrink-0"
                      title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>Editar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          }

          // Landscape 16:9 (Netflix / Prime carousel)
          return (
            <div
              key={item.id}
              onClick={() => onOpenDetail(item)}
              className={`group/card relative flex-none ${
                prefs.compactCards
                  ? 'w-[210px] sm:w-[250px]'
                  : 'w-[240px] sm:w-[290px] lg:w-[320px]'
              } aspect-[16/9] rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.04] hover:z-30 hover:shadow-2xl ${
                isPrime
                  ? 'bg-[#0f171e] border border-[#1d2d3d] hover:border-[#00a8e1]'
                  : isNetflix
                    ? 'bg-[#181818] border border-white/10 hover:border-white/40'
                    : 'bg-slate-900 border border-slate-800 hover:border-[#7b5be4]'
              }`}
            >
              <img
                src={item.bannerUrl || item.thumbnailUrl || LOCAL_RAIL_FALLBACK}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                loading="lazy"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (!img.dataset.fallbackApplied) {
                    img.dataset.fallbackApplied = '1';
                    img.src = LOCAL_RAIL_FALLBACK;
                  }
                }}
              />

              {/* Top Badge */}
              <div
                className={`absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border ${
                  isPrime
                    ? 'bg-[#00050d]/90 text-[#00a8e1] border-[#00a8e1]/40'
                    : isNetflix
                      ? 'bg-black/85 text-[#E50914] border-[#E50914]/40'
                      : 'bg-[#090e17]/90 text-[#7b5be4] border-slate-800'
                }`}
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>{isPrime ? 'Incluído' : isNetflix ? 'Salgueiro N' : 'Salgueiro'}</span>
              </div>

              {prefs.showQualityBadges && (
                <div className="absolute top-2 right-2 z-10 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-slate-200">
                  {item.quality}
                </div>
              )}

              {typeof pct === 'number' && pct > 0 && (
                <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20 z-20">
                  <div
                    className={`h-full ${
                      isNetflix ? 'bg-[#E50914]' : isPrime ? 'bg-[#00a8e1]' : 'bg-[#7b5be4]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                  />
                </div>
              )}

              {isAdmin && onEditMovie && item.type !== 'live_tv' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditMovie(item);
                  }}
                  className="absolute bottom-2 right-2 z-20 group-hover/card:opacity-0 px-2 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg transition-all"
                  title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                  <span>Editar</span>
                </button>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 p-3 sm:p-4 flex flex-col justify-end z-30">
                <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 mb-1">
                  {item.title}
                </h3>

                <div className="flex items-center gap-2 text-[11px] text-slate-300 mb-2">
                  <span className="text-emerald-400 font-semibold">{item.matchPercentage || 95}%</span>
                  <span aria-hidden="true">·</span>
                  <span className="px-1 bg-slate-800 text-[10px] rounded font-mono font-bold">
                    {item.rating}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{item.duration || `${item.year}`}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400">★ {item.imdbScore}</span>
                </div>

                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(item);
                      }}
                      className={`px-3 py-1.5 font-bold rounded-md flex items-center gap-1.5 text-xs transition-colors ${
                        isNetflix
                          ? 'bg-white hover:bg-slate-200 text-black'
                          : isPrime
                            ? 'bg-[#00a8e1] hover:bg-[#1cc0f8] text-[#00050d]'
                            : 'bg-white hover:bg-slate-200 text-slate-950'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Assistir</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(item);
                      }}
                      className={`p-2 rounded-md border transition-colors ${
                        inWatchlist
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-white'
                      }`}
                    >
                      {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isAdmin && onEditMovie && item.type !== 'live_tv' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditMovie(item);
                        }}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-md text-[11px] flex items-center gap-1 transition-colors"
                        title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetail(item);
                      }}
                      className="p-2 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-white rounded-md transition-colors"
                      title="Detalhes e Trailer"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

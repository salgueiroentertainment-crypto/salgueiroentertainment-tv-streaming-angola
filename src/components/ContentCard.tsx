import React, { useRef } from 'react';
import { Play, Plus, Check, Star, Edit2 } from 'lucide-react';
import { MediaItem } from '../types/streaming';
import { warmUpPlaybackTarget } from '../lib/mediaDomain';
import { usePlatformTheme } from '../lib/themes';

interface ContentCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (e: React.MouseEvent, item: MediaItem) => void;
  variant?: 'poster' | 'landscape';
  progressPercent?: number;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

const LOCAL_POSTER_FALLBACK = '/src/assets/images/fenix_movie_poster_1794518590385.jpg';

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onClick,
  isInWatchlist,
  onToggleWatchlist,
  variant = 'poster',
  progressPercent,
  isAdmin = false,
  onEditMovie,
}) => {
  const { theme, prefs } = usePlatformTheme();
  const hoverTimerRef = useRef<number | null>(null);

  const isNetflix = theme === 'netflix';
  const isPrime = theme === 'prime';
  const isStremio = theme === 'stremio';

  const handleMouseEnter = () => {
    if (!item.videoUrl || hoverTimerRef.current) return;
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null;
      warmUpPlaybackTarget(item.videoUrl);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const effectiveLandscape = variant === 'landscape' || (isPrime && variant !== 'poster');
  const imageSrc = effectiveLandscape
    ? (item.bannerUrl || item.thumbnailUrl || LOCAL_POSTER_FALLBACK)
    : (item.thumbnailUrl || item.bannerUrl || LOCAL_POSTER_FALLBACK);

  const cardSurfaceClasses = isNetflix
    ? 'bg-[#181818] rounded-md border border-white/10 hover:border-white/40 hover:scale-[1.03] hover:shadow-2xl'
    : isPrime
      ? 'bg-[#0f171e] rounded-lg border border-[#1f2e3c] hover:border-[#00a8e1] hover:ring-1 hover:ring-[#00a8e1]/60 hover:scale-[1.03]'
      : isStremio
        ? 'bg-[#17132b] rounded-xl border border-[#7b5bf5]/25 hover:border-[#7b5bf5] hover:shadow-[0_0_24px_rgba(123,91,245,0.28)] hover:-translate-y-1'
        : 'bg-[#161a22] rounded-xl border border-[#2d3139] hover:border-[#7b5be4]/50 shadow-lg hover:shadow-[#7b5be4]/10 hover:-translate-y-1';

  const playButtonClasses = isNetflix
    ? 'bg-[#E50914] hover:bg-[#f6121d] text-white'
    : isPrime
      ? 'bg-[#00a8e1] hover:bg-[#19bdf5] text-[#00050d]'
      : isStremio
        ? 'bg-[#7b5bf5] hover:bg-[#8e71ff] text-white'
        : 'bg-[#7b5be4] hover:bg-[#8e74eb] text-white';

  return (
    <div
      onClick={() => onClick(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative overflow-hidden transition-all duration-300 cursor-pointer ${cardSurfaceClasses}`}
    >
      {/* Artwork Image */}
      <div className={`${effectiveLandscape ? 'aspect-video' : 'aspect-[2/3]'} w-full overflow-hidden relative bg-black/40`}>
        <img
          src={imageSrc}
          alt={item.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (!img.dataset.fallbackApplied) {
              img.dataset.fallbackApplied = '1';
              img.src = LOCAL_POSTER_FALLBACK;
            }
          }}
        />

        {/* Prime Included Ribbon */}
        {isPrime && item.type !== 'live_tv' && (
          <div className="absolute top-2 left-2 bg-[#00050d]/85 backdrop-blur-md px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] font-extrabold text-[#00a8e1] border border-[#00a8e1]/40">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
            <span>PRIME</span>
          </div>
        )}

        {/* Netflix Top Badge */}
        {isNetflix && item.isTop10 && (
          <div className="absolute top-0 right-2 bg-[#E50914] px-1.5 py-0.5 rounded-b text-[9px] font-black text-white uppercase tracking-tight shadow">
            TOP 10
          </div>
        )}

        {/* Quality / Rating Badge */}
        {prefs.showQualityBadges && (
          <div
            className={`absolute top-2 ${isNetflix && item.isTop10 ? 'left-2' : 'right-2'} bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-bold text-amber-400 border border-white/10`}
          >
            <Star className="w-3 h-3 fill-amber-400" />
            <span>{item.imdbScore}</span>
          </div>
        )}

        {/* Progress Bar Overlay when watching */}
        {typeof progressPercent === 'number' && progressPercent > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-white/20">
            <div
              className={`h-full ${
                isNetflix
                  ? 'bg-[#E50914]'
                  : isPrime
                    ? 'bg-[#00a8e1]'
                    : 'bg-[#7b5bf5]'
              }`}
              style={{ width: `${Math.min(100, Math.max(4, progressPercent))}%` }}
            />
          </div>
        )}

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(item);
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl transform scale-75 group-hover:scale-100 transition-transform ${playButtonClasses}`}
          >
            <Play className="w-5 h-5 fill-current" />
          </button>
          <button
            onClick={(e) => onToggleWatchlist(e, item)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all transform scale-75 group-hover:scale-100 ${
              isInWatchlist
                ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                : 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
            }`}
          >
            {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Content Info */}
      <div className={prefs.compactCards ? 'p-2' : 'p-3'}>
        <h3
          className={`text-sm font-bold text-white truncate transition-colors ${
            isNetflix
              ? 'group-hover:text-[#E50914]'
              : isPrime
                ? 'group-hover:text-[#00a8e1]'
                : 'group-hover:text-[#7b5bf5]'
          }`}
        >
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          <span
            className={`text-[10px] font-bold uppercase tracking-widest shrink-0 ${
              isNetflix
                ? 'text-[#E50914]'
                : isPrime
                  ? 'text-[#00a8e1]'
                  : 'text-[#7b5be4]'
            }`}
          >
            {item.year}
          </span>
          <span className="text-[10px] text-slate-500">•</span>
          <span className="text-[10px] text-slate-400 truncate min-w-0">{item.genres[0]}</span>
          {item.type === 'live_tv' ? (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded uppercase shrink-0">
              <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
              Live
            </span>
          ) : isAdmin && onEditMovie ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditMovie(item);
              }}
              className="ml-auto px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow transition-all shrink-0"
              title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
            >
              <Edit2 className="w-2.5 h-2.5" />
              <span>Editar</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

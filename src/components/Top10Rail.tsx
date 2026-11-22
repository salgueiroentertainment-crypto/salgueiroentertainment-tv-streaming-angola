import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Plus, Check, Info } from 'lucide-react';
import { MediaItem } from '../types/streaming';

interface Top10RailProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: MediaItem) => void;
}

export const Top10Rail: React.FC<Top10RailProps> = ({
  items,
  onPlay,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const top10Sorted = [...items]
    .filter((item) => item.isTop10)
    .sort((a, b) => (a.top10Rank || 99) - (b.top10Rank || 99))
    .slice(0, 10);

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

  if (top10Sorted.length === 0) return null;

  return (
    <section className="relative py-4 px-4 sm:px-6 lg:px-8 group">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <span>Top 10 em Angola Hoje</span>
          <span className="text-xs font-semibold text-[#00a8e1] uppercase tracking-wider">
            Mais Assistidos
          </span>
        </h2>
      </div>

      {/* Chevrons */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-1 top-[55%] -translate-y-1/2 z-20 w-10 h-28 bg-[#090e17]/80 hover:bg-[#090e17] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r border-y border-r border-slate-700/60 shadow-xl"
        aria-label="Rolar para esquerda"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      <button
        onClick={() => scroll('right')}
        className="absolute right-1 top-[55%] -translate-y-1/2 z-20 w-10 h-28 bg-[#090e17]/80 hover:bg-[#090e17] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-l border-y border-l border-slate-700/60 shadow-xl"
        aria-label="Rolar para direita"
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      {/* Track with Giant Stylized Rank Numbers */}
      <div
        ref={scrollRef}
        className="flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth pb-4 pt-2"
      >
        {top10Sorted.map((item, idx) => {
          const rank = item.top10Rank || idx + 1;
          const inWatchlist = isInWatchlist(item.id);

          return (
            <div
              key={item.id}
              className="group/card relative flex-none flex items-center transition-all duration-300 hover:scale-105 hover:z-30"
            >
              {/* Giant Stylized Rank Number (Salgueiro signature) */}
              <div className="relative select-none -mr-4 sm:-mr-6 z-0">
                <span className="text-7xl sm:text-9xl font-black tracking-tighter text-transparent [-webkit-text-stroke:2px_#334155] group-hover/card:[-webkit-text-stroke:2px_#7b5be4] transition-all font-mono">
                  {rank}
                </span>
              </div>

              {/* Card Container */}
              <div className="relative w-[180px] sm:w-[220px] aspect-[16/9] rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shadow-lg group-hover/card:shadow-2xl group-hover/card:border-slate-600 z-10">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {/* Salgueiro Badge */}
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-[#090e17]/90 px-1.5 py-0.5 rounded text-[9px] font-bold text-[#7b5be4] uppercase">
                  Salgueiro
                </div>

                {/* Hover Details */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#090e17] via-[#090e17]/85 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                  <h4 className="text-xs font-bold text-white line-clamp-1 mb-1">{item.title}</h4>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-300 mb-2">
                    <span className="text-emerald-400 font-semibold">{item.matchPercentage}%</span>
                    <span>·</span>
                    <span>{item.rating}</span>
                    <span>·</span>
                    <span>★ {item.imdbScore}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPlay(item)}
                      className="p-1.5 bg-white text-slate-950 rounded hover:bg-slate-200 transition-colors"
                      title="Assistir agora"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                    </button>
                    <button
                      onClick={() => onToggleWatchlist(item)}
                      className="p-1.5 bg-slate-800 text-white rounded border border-slate-700 hover:bg-slate-700 transition-colors"
                      title={inWatchlist ? 'Remover' : 'Adicionar'}
                    >
                      {inWatchlist ? <Check className="w-3.5 h-3.5 text-[#00a8e1]" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onOpenDetail(item)}
                      className="p-1.5 bg-slate-800 text-white rounded border border-slate-700 hover:bg-slate-700 transition-colors"
                      title="Detalhes"
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

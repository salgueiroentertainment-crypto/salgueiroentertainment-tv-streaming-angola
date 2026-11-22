import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Tv, Users, Calendar } from 'lucide-react';
import { LiveChannel, MediaItem } from '../types/streaming';
import { warmUpPlaybackTarget } from '../lib/mediaDomain';

interface LiveChannelsRailProps {
  channels: LiveChannel[];
  onPlayChannel: (channel: LiveChannel) => void;
  onOpenEPG: () => void;
}

export const LiveChannelsRail: React.FC<LiveChannelsRailProps> = ({
  channels,
  onPlayChannel,
  onOpenEPG,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

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

  return (
    <section className="relative py-4 px-4 sm:px-6 lg:px-8 group">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              TV ao Vivo • Em Transmissão Agora
            </h2>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Canais abertos e fechados inclusos
          </span>
        </div>

        <button
          onClick={onOpenEPG}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#00a8e1] hover:text-[#38bdf8] transition-colors focus:outline-none"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Ver Guia de Programação Completo (EPG)</span>
        </button>
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

      {/* Channels List */}
      <div
        ref={scrollRef}
        className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth pb-3 pt-1"
      >
        {channels.map((channel) => (
          <div
            key={channel.id}
            onClick={() => onPlayChannel(channel)}
            onMouseEnter={() => {
              if (!channel.videoUrl) return;
              if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
              hoverTimerRef.current = window.setTimeout(() => {
                hoverTimerRef.current = null;
                warmUpPlaybackTarget(channel.videoUrl);
              }, 220);
            }}
            onMouseLeave={() => {
              if (hoverTimerRef.current) {
                window.clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
              }
            }}
            className="group/card relative flex-none w-[260px] sm:w-[320px] rounded-lg overflow-hidden bg-slate-900 border border-slate-800 cursor-pointer transition-all duration-300 hover:border-[#00a8e1] hover:scale-[1.03] hover:shadow-2xl"
          >
            {/* Top Bar with Channel Logo & Number */}
            <div className="p-3 bg-gradient-to-b from-slate-800/90 to-slate-900 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-slate-950/90 border border-slate-700/70 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                  {channel.logo.startsWith('/') || channel.logo.startsWith('http') ? (
                    <img 
                      src={channel.logo} 
                      alt={channel.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-xl">{channel.logo}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-[#00a8e1]">
                      CH {channel.channelNumber}
                    </span>
                    <span className="text-xs font-bold text-white line-clamp-1">
                      {channel.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{channel.category}</span>
                </div>
              </div>

              {/* Red Live Pill */}
              <div className="flex items-center gap-1 bg-red-600/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded text-[10px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span>AO VIVO</span>
              </div>
            </div>

            {/* Current Show Details */}
            <div className="p-3 space-y-2">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  No Ar Agora:
                </span>
                <p className="text-sm font-semibold text-white line-clamp-1 group-hover/card:text-[#00a8e1] transition-colors">
                  {channel.currentShow}
                </p>
              </div>

              {/* Progress Bar of the live show */}
              <div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00a8e1] h-full rounded-full transition-all duration-500"
                    style={{ width: `${channel.progressPercentage}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                  <span>{channel.progressPercentage}% decorrido</span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{channel.viewers}</span>
                  </span>
                </div>
              </div>

              {/* Next Show preview */}
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">A seguir: {channel.nextShow}</span>
              </div>

              {/* Hover Play CTA */}
              <div className="pt-2 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayChannel(channel);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-[#00a8e1] hover:text-white text-slate-200 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 group-hover/card:bg-[#00a8e1] group-hover/card:text-white"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Sintonizar Canal</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

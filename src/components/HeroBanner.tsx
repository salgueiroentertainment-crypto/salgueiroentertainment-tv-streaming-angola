import React, { useState, useEffect } from 'react';
import { Play, Info, Plus, Check, Volume2, VolumeX, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { MediaItem } from '../types/streaming';
import { usePlatformTheme } from '../lib/themes';

interface HeroBannerProps {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: MediaItem) => void;
  customHeroImage?: string;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

const LOCAL_HERO_FALLBACK = '/src/assets/images/hero_scifi_cyber_1794091825405.jpg';

export const HeroBanner: React.FC<HeroBannerProps> = ({
  items,
  onPlay,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
  customHeroImage,
  isAdmin = false,
  onEditMovie,
}) => {
  const { theme, prefs } = usePlatformTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const currentItem = items[currentIndex] || items[0];

  useEffect(() => {
    if (!prefs.autoHeroRotation || isPaused || items.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused, items.length, prefs.autoHeroRotation]);

  if (!currentItem) return null;

  const inWatchlist = isInWatchlist(currentItem.id);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const isNetflix = theme === 'netflix';
  const isPrime = theme === 'prime';
  const isStremio = theme === 'stremio';

  const scrimBg = isNetflix
    ? '#141414'
    : isPrime
      ? '#00050d'
      : isStremio
        ? '#0e0b1a'
        : '#090e17';

  const heightClass = isStremio
    ? 'h-[48vh] min-h-[380px] max-h-[540px] rounded-2xl border border-[#7b5bf5]/25'
    : isNetflix
      ? 'h-[68vh] min-h-[500px] max-h-[760px] rounded-xl'
      : isPrime
        ? 'h-[62vh] min-h-[460px] max-h-[700px] rounded-xl'
        : 'h-[65vh] min-h-[500px] max-h-[760px] rounded-2xl';

  return (
    <section
      className={`group relative w-full ${heightClass} select-none overflow-hidden`}
      style={{ backgroundColor: scrimBg }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Destaques Principais Salgueiro Streaming Angola"
    >
      {/* Background Cinematic Image with Crossfade */}
      <div className="absolute inset-0 w-full h-full">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
              idx === currentIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'
            } transform transition-transform duration-[8000ms]`}
          >
            <img
              src={(idx === 0 && customHeroImage) ? customHeroImage : (item.bannerUrl || item.thumbnailUrl || LOCAL_HERO_FALLBACK)}
              alt={item.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top sm:object-center"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallbackApplied) {
                  img.dataset.fallbackApplied = '1';
                  img.src = LOCAL_HERO_FALLBACK;
                }
              }}
            />
          </div>
        ))}

        {/* Theme-matched Scrims */}
        <div
          className="absolute inset-0 sm:w-2/3"
          style={{
            background: `linear-gradient(to right, ${scrimBg} 0%, ${scrimBg}d9 52%, transparent 100%)`,
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{
            background: `linear-gradient(to bottom, ${scrimBg}b3 0%, transparent 100%)`,
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-44"
          style={{
            background: `linear-gradient(to top, ${scrimBg} 0%, ${scrimBg}cc 45%, transparent 100%)`,
          }}
        />
      </div>

      {/* Main Content Info */}
      <div className="relative max-w-[1600px] mx-auto h-full px-4 sm:px-6 lg:px-10 flex flex-col justify-end pb-10 sm:pb-14 z-10">
        <div className="max-w-2xl space-y-3.5">
          {/* Theme Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {currentItem.type === 'live_tv' ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-red-600 text-white rounded">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  AO VIVO NA TV
                </span>
                {currentItem.liveChannel && (
                  <span className="text-xs font-medium text-slate-300">
                    Canal {currentItem.liveChannel.channelNumber} • {currentItem.liveChannel.channelName}
                  </span>
                )}
              </div>
            ) : isNetflix ? (
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 font-black text-xs tracking-[0.22em] text-white uppercase">
                  <span className="inline-flex items-center justify-center w-5 h-6 rounded-sm bg-[#E50914] text-white font-black text-sm leading-none">
                    S
                  </span>
                  <span>FILME EM DESTAQUE</span>
                </span>
                {currentItem.isTop10 && (
                  <span className="px-2 py-0.5 rounded bg-[#E50914] text-white text-[11px] font-black uppercase">
                    TOP {currentItem.top10Rank || 1} EM ANGOLA
                  </span>
                )}
              </div>
            ) : isPrime ? (
              <div className="flex items-center gap-2.5 text-xs font-bold">
                <span className="inline-flex items-center gap-1.5 text-white">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#00A8E1] text-[#00050d]">
                    <Check className="w-3 h-3 stroke-[3.5]" />
                  </span>
                  <span>Incluído no Salgueiro</span>
                </span>
                <span className="text-[#79b8f3] uppercase tracking-wider font-extrabold">
                  prime EDITION
                </span>
              </div>
            ) : isStremio ? (
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#c4b5fd] uppercase">
                <span className="inline-flex items-center gap-1.5 bg-[#7b5bf5]/25 px-2.5 py-1 rounded-lg border border-[#7b5bf5]/50 backdrop-blur-md">
                  <Check className="w-3.5 h-3.5 text-[#22b365] stroke-[3]" />
                  STREAM BOARD
                </span>
                <span className="text-slate-300 font-semibold">{currentItem.year}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#7b5be4] uppercase">
                <span className="inline-flex items-center gap-1 bg-[#7b5be4]/15 px-2.5 py-1 rounded border border-[#7b5be4]/30">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  INCLUÍDO NO SALGUEIRO
                </span>
                {currentItem.isTop10 && (
                  <span className="text-amber-400 font-bold">
                    #{currentItem.top10Rank} em Angola Hoje
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight line-clamp-2 drop-shadow-md">
            {currentItem.title}
          </h1>

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
            {currentItem.matchPercentage && (
              <span className="text-emerald-400 font-semibold">
                {currentItem.matchPercentage}% relevante
              </span>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-slate-800/90 text-slate-200 border border-slate-700">
              {currentItem.rating}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{currentItem.year}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{currentItem.duration}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-amber-400 font-semibold">IMDb {currentItem.imdbScore}</span>
            {prefs.showQualityBadges && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-slate-300 font-semibold">{currentItem.quality}</span>
              </>
            )}
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">{currentItem.genres.join(', ')}</span>
          </div>

          {/* Synopsis */}
          <p className="text-sm sm:text-base text-slate-200 line-clamp-3 leading-relaxed max-w-xl">
            {currentItem.synopsis}
          </p>

          {/* Interactive CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isNetflix ? (
              <>
                <button
                  onClick={() => onPlay(currentItem)}
                  className="flex items-center gap-2.5 px-7 py-3 bg-white hover:bg-white/85 text-black font-black rounded-md shadow-lg transition-all active:scale-95 text-sm sm:text-base whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-black text-black" />
                  <span>{currentItem.type === 'live_tv' ? 'Assistir ao Vivo' : 'Assistir'}</span>
                </button>
                <button
                  onClick={() => onOpenDetail(currentItem)}
                  className="flex items-center gap-2 px-6 py-3 bg-[#6d6d6eb3] hover:bg-[#6d6d6e80] text-white font-bold rounded-md backdrop-blur-sm transition-all active:scale-95 text-sm whitespace-nowrap"
                >
                  <Info className="w-5 h-5" />
                  <span>Mais Informações</span>
                </button>
              </>
            ) : isPrime ? (
              <>
                <button
                  onClick={() => onPlay(currentItem)}
                  className="flex items-center gap-2.5 px-6 py-3 bg-[#00a8e1] hover:bg-[#1cc0f8] text-[#00050d] font-black rounded-lg shadow-lg shadow-[#00a8e1]/25 transition-all active:scale-95 text-sm sm:text-base whitespace-nowrap"
                >
                  <Play className="w-5 h-5 fill-[#00050d]" />
                  <span>{currentItem.type === 'live_tv' ? 'Ver Canal ao Vivo' : 'Assistir Agora'}</span>
                </button>
                <button
                  onClick={() => onOpenDetail(currentItem)}
                  className="flex items-center gap-2 px-5 py-3 bg-white/15 hover:bg-white/25 text-white font-bold rounded-lg backdrop-blur-sm transition-all active:scale-95 text-sm whitespace-nowrap"
                >
                  <Info className="w-4 h-4" />
                  <span>Detalhes</span>
                </button>
              </>
            ) : isStremio ? (
              <>
                <button
                  onClick={() => onPlay(currentItem)}
                  className="flex items-center gap-2.5 px-6 py-3 bg-[#7b5bf5] hover:bg-[#8e71ff] text-white font-bold rounded-full shadow-lg shadow-[#7b5bf5]/35 transition-all active:scale-95 text-sm whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{currentItem.type === 'live_tv' ? 'Abrir Canal' : 'Reproduzir'}</span>
                </button>
                <button
                  onClick={() => onOpenDetail(currentItem)}
                  className="flex items-center gap-2 px-5 py-3 bg-[#17132b]/85 hover:bg-[#231d40] text-white font-semibold rounded-full border border-[#7b5bf5]/35 backdrop-blur-md transition-all active:scale-95 text-sm whitespace-nowrap"
                >
                  <Info className="w-4 h-4 text-[#a78bfa]" />
                  <span>Explorar Meta</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onPlay(currentItem)}
                  className="flex items-center gap-2.5 px-6 py-3 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 text-sm sm:text-base whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#00a8e1]"
                >
                  <Play className="w-5 h-5 fill-slate-950 text-slate-950" />
                  <span>{currentItem.type === 'live_tv' ? 'Assistir Transmissão ao Vivo' : 'Assistir Agora'}</span>
                </button>
                <button
                  onClick={() => onOpenDetail(currentItem)}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-800/80 hover:bg-slate-700 text-white font-semibold rounded-lg border border-slate-600/60 backdrop-blur-sm transition-all duration-200 active:scale-95 text-sm whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-[#00a8e1]"
                >
                  <Info className="w-4 h-4 text-slate-300" />
                  <span>Mais Informações</span>
                </button>
              </>
            )}

            {/* Watchlist Toggle Button */}
            <button
              onClick={() => onToggleWatchlist(currentItem)}
              className={`p-3 border transition-all duration-200 active:scale-95 ${
                isStremio ? 'rounded-full' : 'rounded-lg'
              } ${
                inWatchlist
                  ? isNetflix
                    ? 'bg-[#E50914]/25 border-[#E50914] text-white'
                    : isStremio
                      ? 'bg-[#22b365]/20 border-[#22b365] text-[#22b365]'
                      : 'bg-[#00a8e1]/20 border-[#00a8e1] text-[#00a8e1]'
                  : 'bg-slate-800/80 hover:bg-slate-700 border-slate-600/60 text-white'
              }`}
              title={inWatchlist ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
              aria-label={inWatchlist ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'}
            >
              {inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </button>

            {isAdmin && onEditMovie && currentItem.type !== 'live_tv' && (
              <button
                type="button"
                onClick={() => onEditMovie(currentItem)}
                className={`flex items-center gap-1.5 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider shadow-lg transition-all active:scale-95 whitespace-nowrap ${
                  isStremio ? 'rounded-full' : 'rounded-lg'
                }`}
                title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Utilities (Right Bottom): Mute & Pagination */}
      <div className="absolute right-4 sm:right-8 bottom-10 sm:bottom-14 z-20 flex items-center gap-3">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors backdrop-blur-sm"
          title={isMuted ? 'Ativar Áudio de Prévia' : 'Silenciar'}
          aria-label={isMuted ? 'Ativar Áudio' : 'Silenciar'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-sm px-3 py-2 rounded-full border border-slate-800">
          {items.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? isNetflix
                    ? 'w-6 bg-[#E50914]'
                    : isStremio
                      ? 'w-6 bg-[#7b5bf5]'
                      : 'w-6 bg-[#00a8e1]'
                  : 'w-2 bg-slate-600 hover:bg-slate-400'
              }`}
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Left / Right Carousel Navigation Arrows */}
      <button
        onClick={handlePrev}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-slate-700/60"
        aria-label="Slide anterior"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-900/70 hover:bg-slate-900 text-white opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-slate-700/60"
        aria-label="Próximo slide"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </section>
  );
};

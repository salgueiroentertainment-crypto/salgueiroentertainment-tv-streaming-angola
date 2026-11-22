import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Film, Plus, Check, Edit2 } from 'lucide-react';
import { MediaItem, LiveChannel, InstalledStremioAddon } from '../types/streaming';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  movies: MediaItem[];
  channels: LiveChannel[];
  installedAddons?: InstalledStremioAddon[];
  onPlayMovie: (item: MediaItem) => void;
  onPlayChannel: (channel: LiveChannel) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: MediaItem) => void;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  movies,
  channels,
  onPlayMovie,
  onPlayChannel,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
  isAdmin = false,
  onEditMovie,
}) => {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'movies' | 'live'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.key === '/' || (e.metaKey && e.key === 'k')) && !isOpen) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalized = query.toLowerCase().trim();

  const filteredMovies = movies.filter((m) => {
    if (filterType === 'live') return false;
    if (!normalized) return true;
    return (
      m.title.toLowerCase().includes(normalized) ||
      m.synopsis.toLowerCase().includes(normalized) ||
      m.genres.some((g) => g.toLowerCase().includes(normalized)) ||
      m.cast?.some((c) => c.name.toLowerCase().includes(normalized))
    );
  });

  const filteredChannels = channels.filter((c) => {
    if (filterType === 'movies') return false;
    if (!normalized) return true;
    return (
      c.name.toLowerCase().includes(normalized) ||
      c.currentShow.toLowerCase().includes(normalized) ||
      c.category.toLowerCase().includes(normalized)
    );
  });

  const popularKeywords = ['Ao Vivo', 'Zimbo', 'Futebol', 'Notícias', 'Variedades', 'HD'];

  return (
    <div className="fixed inset-0 z-50 bg-[#090e17]/95 backdrop-blur-xl overflow-y-auto p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Search Input Box */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl focus-within:border-[#7b5be4] transition-all">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, canal de TV, ator, gênero ou esporte..."
            className="w-full bg-transparent text-white placeholder-slate-400 text-sm sm:text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold"
          >
            Fechar (Esc)
          </button>
        </div>

        {/* Filter Buttons & Popular Suggestions */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filter Type */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                filterType === 'all' ? 'bg-[#7b5be4] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos os Resultados
            </button>
            <button
              onClick={() => setFilterType('movies')}
              className={`px-3 py-1.5 rounded font-medium transition-colors ${
                filterType === 'movies' ? 'bg-[#7b5be4] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Filmes & Séries
            </button>
            <button
              onClick={() => setFilterType('live')}
              className={`px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 ${
                filterType === 'live' ? 'bg-[#7b5be4] text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>TV ao Vivo</span>
            </button>
          </div>

          {/* Quick Keywords */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-slate-500">Sugestões:</span>
            {popularKeywords.map((kw) => (
              <button
                key={kw}
                onClick={() => setQuery(kw)}
                className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md text-xs border border-slate-700/50"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Live Channels Results Section */}
        {filteredChannels.length > 0 && filterType !== 'movies' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span>Canais de TV ao Vivo Encontrados ({filteredChannels.length})</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredChannels.map((ch) => (
                <div
                  key={ch.id}
                  onClick={() => {
                    onPlayChannel(ch);
                    onClose();
                  }}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-lg hover:border-[#7b5be4] transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-9 rounded-lg bg-slate-950 border border-slate-700/70 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                      {ch.logo.startsWith('/') || ch.logo.startsWith('http') ? (
                        <img
                          src={ch.logo}
                          alt={ch.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-xl">{ch.logo}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono font-bold text-[#7b5be4]">
                          CH {ch.channelNumber}
                        </span>
                        <h4 className="text-xs font-bold text-white">{ch.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-1">{ch.currentShow}</p>
                    </div>
                  </div>

                  <span className="p-2 bg-red-600 hover:bg-red-500 text-white rounded-md">
                    <Play className="w-3.5 h-3.5 fill-white" />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Movies Results Section */}
        {filteredMovies.length > 0 && filterType !== 'live' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Film className="w-4 h-4 text-[#00a8e1]" />
              <span>Filmes e Títulos em Streaming ({filteredMovies.length})</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMovies.map((movie) => {
                const inWatchlist = isInWatchlist(movie.id);

                return (
                  <div
                    key={movie.id}
                    className="group relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-[#7b5be4] transition-all shadow-md"
                  >
                    <div className="aspect-[16/9] w-full overflow-hidden">
                      <img
                        src={movie.thumbnailUrl}
                        alt={movie.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>

                    <div className="p-3 space-y-1.5">
                      <h4 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#7b5be4]">
                        {movie.title}
                      </h4>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="text-emerald-400 font-semibold">{movie.matchPercentage}%</span>
                        <span>·</span>
                        <span>{movie.rating}</span>
                        <span>·</span>
                        <span>{movie.duration || movie.year}</span>
                      </div>

                      <div className="pt-1 flex items-center justify-between">
                        <button
                          onClick={() => {
                            onPlayMovie(movie);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded text-xs flex items-center gap-1"
                        >
                          <Play className="w-3 h-3 fill-slate-950" />
                          <span>Assistir</span>
                        </button>

                        <div className="flex items-center gap-1">
                          {isAdmin && onEditMovie && movie.type !== 'live_tv' && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onEditMovie(movie);
                              }}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-black font-black rounded text-[11px] flex items-center gap-1"
                              title="Edição completa: Capa, Banner, Título e Ano de Lançamento"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          <button
                            onClick={() => onToggleWatchlist(movie)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-700"
                            title={inWatchlist ? 'Remover da lista' : 'Adicionar'}
                          >
                            {inWatchlist ? <Check className="w-3.5 h-3.5 text-[#7b5be4]" /> : <Plus className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              onOpenDetail(movie);
                              onClose();
                            }}
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                          >
                            Info
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty Search State */}
        {filteredMovies.length === 0 && filteredChannels.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Search className="w-12 h-12 text-slate-600 mx-auto" />
            <h4 className="text-lg font-bold text-white">Nenhum resultado encontrado</h4>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Não encontramos filmes ou canais correspondentes a "{query}". Tente buscar por "Futebol", "Zimbo", ou "Variedades".
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

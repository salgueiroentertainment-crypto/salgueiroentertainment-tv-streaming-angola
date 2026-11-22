import React from 'react';
import { Play, Trash2, Film, Tv, Heart, Check, Info } from 'lucide-react';
import { MediaItem, LiveChannel } from '../types/streaming';

interface MyAreaViewProps {
  watchlist: MediaItem[];
  continueWatching: {
    media: MediaItem;
    percentage: number;
    remainingMinutes: number;
  }[];
  favoriteChannels: LiveChannel[];
  onPlayMovie: (item: MediaItem) => void;
  onPlayChannel: (channel: LiveChannel) => void;
  onOpenDetail: (item: MediaItem) => void;
  onRemoveFromWatchlist: (item: MediaItem) => void;
  onRemoveContinueWatching: (id: string) => void;
  onExploreCatalog: () => void;
}

export const MyAreaView: React.FC<MyAreaViewProps> = ({
  watchlist,
  continueWatching,
  favoriteChannels,
  onPlayMovie,
  onPlayChannel,
  onOpenDetail,
  onRemoveFromWatchlist,
  onRemoveContinueWatching,
  onExploreCatalog,
}) => {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-10">
      {/* Page Header */}
      <div className="border-b border-slate-800 pb-6 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-[#7b5be4] fill-[#7b5be4]" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Minha Área
            </h1>
          </div>
          <p className="text-sm text-slate-400">
            Seus filmes salvos, títulos em andamento e canais de TV favoritos reunidos em um só lugar.
          </p>
        </div>

        <button
          onClick={onExploreCatalog}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
        >
          Explorar Todo o Catálogo
        </button>
      </div>

      {/* Continue Watching Section */}
      {continueWatching.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Continuar Assistindo</span>
            <span className="text-xs text-slate-400 font-normal">
              · Retome exatamente de onde parou
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {continueWatching.map((item) => (
              <div
                key={item.media.id}
                className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-[#00a8e1] transition-all"
              >
                <div className="aspect-[16/9] w-full relative overflow-hidden">
                  <img
                    src={item.media.thumbnailUrl}
                    alt={item.media.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#090e17] via-transparent to-transparent" />

                  {/* Play Overlay Button */}
                  <button
                    onClick={() => onPlayMovie(item.media)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-[#00a8e1] text-white flex items-center justify-center shadow-2xl opacity-90 hover:opacity-100 hover:scale-110 transition-all"
                    title="Retomar reprodução"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>

                  {/* Progress Bar */}
                  <div className="absolute bottom-0 inset-x-0 h-1.5 bg-slate-800">
                    <div
                      className="bg-[#00a8e1] h-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{item.media.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span className="text-[#00a8e1] font-semibold">{item.percentage}% assistido</span>
                      <span>·</span>
                      <span>Restam {item.remainingMinutes} min</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenDetail(item.media)}
                      className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                      title="Ver detalhes"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onRemoveContinueWatching(item.media.id)}
                      className="p-2 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded-lg text-xs transition-colors"
                      title="Remover do histórico"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Watchlist Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Minha Lista de Filmes & Séries</span>
            <span className="text-xs font-mono text-[#00a8e1] bg-[#00a8e1]/10 px-2 py-0.5 rounded-full">
              {watchlist.length} itens
            </span>
          </h2>
        </div>

        {watchlist.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <Film className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-white">Sua lista está vazia</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Navegue pelo catálogo e clique no botão "+" em qualquer filme ou série para salvar e assistir depois.
            </p>
            <button
              onClick={onExploreCatalog}
              className="mt-2 px-4 py-2 bg-[#00a8e1] hover:bg-[#0090c2] text-white font-bold rounded-lg text-xs"
            >
              Navegar Filmes em Destaque
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-[#00a8e1] transition-all"
              >
                <div className="aspect-[16/9] w-full overflow-hidden">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                <div className="p-3 space-y-2">
                  <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#00a8e1]">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="text-emerald-400 font-semibold">{item.matchPercentage}%</span>
                    <span>·</span>
                    <span>{item.rating}</span>
                    <span>·</span>
                    <span>★ {item.imdbScore}</span>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      onClick={() => onPlayMovie(item)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded text-xs flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-slate-950" />
                      <span>Assistir</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onOpenDetail(item)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded"
                        title="Detalhes"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onRemoveFromWatchlist(item)}
                        className="p-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-400 rounded transition-colors"
                        title="Remover da lista"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Favorite Live TV Channels */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Tv className="w-5 h-5 text-[#7b5be4]" />
          <span>Canais de TV Salvos</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {favoriteChannels.map((ch) => (
            <div
              key={ch.id}
              onClick={() => onPlayChannel(ch)}
              className="p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-[#00a8e1] transition-all cursor-pointer flex items-center justify-between"
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
                    <span className="text-xs font-mono font-bold text-[#00a8e1]">
                      CH {ch.channelNumber}
                    </span>
                    <h3 className="text-sm font-bold text-white">{ch.name}</h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{ch.currentShow}</p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayChannel(ch);
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Ao Vivo</span>
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

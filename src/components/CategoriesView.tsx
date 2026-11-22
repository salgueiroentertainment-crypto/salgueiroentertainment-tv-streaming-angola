import React, { useState } from 'react';
import { Play, Plus, Check, Info, Filter, ArrowUpDown } from 'lucide-react';
import { MediaItem, Genre } from '../types/streaming';

interface CategoriesViewProps {
  movies: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetail: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (item: MediaItem) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  movies,
  onPlay,
  onOpenDetail,
  isInWatchlist,
  onToggleWatchlist,
}) => {
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<'relevance' | 'imdb' | 'year'>('relevance');

  const genres: (string | 'Todos')[] = [
    'Todos',
    'Ação',
    'Ficção Científica',
    'Suspense',
    'Fantasia',
    'Esportes',
    'Comédia',
    'Documentário',
  ];

  let filtered = selectedGenre === 'Todos'
    ? [...movies]
    : movies.filter((m) => m.genres.includes(selectedGenre as Genre));

  if (sortBy === 'imdb') {
    filtered.sort((a, b) => b.imdbScore - a.imdbScore);
  } else if (sortBy === 'year') {
    filtered.sort((a, b) => b.year - a.year);
  } else {
    filtered.sort((a, b) => (b.matchPercentage || 90) - (a.matchPercentage || 90));
  }

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header & Controls */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Categorias & Gêneros
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Explore todo o acervo do Salgueiro Streaming Angola filtrando por seus estilos e temas preferidos.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          {/* Genre Segmented Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {genres.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGenre(g)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedGenre === g
                    ? 'bg-[#00a8e1] text-white shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <span className="text-slate-400">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#00a8e1]"
            >
              <option value="relevance">Mais Relevantes</option>
              <option value="imdb">Maior Nota IMDb</option>
              <option value="year">Lançamentos Recentes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((item) => {
          const inWatchlist = isInWatchlist(item.id);

          return (
            <div
              key={item.id}
              className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-[#00a8e1] transition-all hover:scale-[1.02] shadow-lg"
            >
              <div className="aspect-[16/9] w-full overflow-hidden relative">
                <img
                  src={item.thumbnailUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />

                {/* Salgueiro Badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#090e17]/90 px-2 py-0.5 rounded text-[10px] font-bold text-[#7b5be4] uppercase">
                  Salgueiro
                </div>

                <div className="absolute top-2 right-2 bg-slate-950/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
                  {item.quality}
                </div>
              </div>

              <div className="p-3.5 space-y-2">
                <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 group-hover:text-[#00a8e1]">
                  {item.title}
                </h3>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-semibold">{item.matchPercentage}%</span>
                  <span>·</span>
                  <span>{item.rating}</span>
                  <span>·</span>
                  <span>{item.duration || item.year}</span>
                  <span>·</span>
                  <span className="text-amber-400">★ {item.imdbScore}</span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2">
                  {item.synopsis}
                </p>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <button
                    onClick={() => onPlay(item)}
                    className="px-3 py-1.5 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded-md text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Assistir</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onToggleWatchlist(item)}
                      className={`p-1.5 rounded-md border transition-colors ${
                        inWatchlist
                          ? 'bg-[#00a8e1]/20 border-[#00a8e1] text-[#00a8e1]'
                          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                      }`}
                      title={inWatchlist ? 'Remover' : 'Adicionar'}
                    >
                      {inWatchlist ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onOpenDetail(item)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700"
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
    </div>
  );
};

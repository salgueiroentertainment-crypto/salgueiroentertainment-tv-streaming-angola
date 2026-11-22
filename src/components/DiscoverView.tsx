import React, { useState } from 'react';
import { ContentCard } from './ContentCard';
import { MediaItem, Genre } from '../types/streaming';
import { Filter, ChevronDown, ListFilter, SortAsc } from 'lucide-react';

interface DiscoverViewProps {
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (e: React.MouseEvent, item: MediaItem) => void;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

export const DiscoverView: React.FC<DiscoverViewProps> = ({
  items,
  onItemClick,
  isInWatchlist,
  onToggleWatchlist,
  isAdmin = false,
  onEditMovie,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('Todos');
  const [sortBy, setSortBy] = useState<string>('popular');

  const genres = ['Todos', 'Ação', 'Aventura', 'Ficção Científica', 'Suspense', 'Drama', 'Comédia', 'Fantasia', 'Esportes'];
  const types = [
    { id: 'all', label: 'Tudo' },
    { id: 'movie', label: 'Filmes' },
    { id: 'series', label: 'Séries' },
    { id: 'live_tv', label: 'Canais' },
  ];

  const filteredItems = items.filter(item => {
    const typeMatch = selectedType === 'all' || item.type === selectedType;
    const genreMatch = selectedGenre === 'Todos' || item.genres.includes(selectedGenre as Genre);
    return typeMatch && genreMatch;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-[#161a22] p-6 rounded-3xl border border-[#2d3139]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 p-1 bg-[#0c0d10] rounded-2xl border border-[#2d3139]">
            {types.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedType === type.id 
                    ? 'bg-[#7b5be4] text-white shadow-lg shadow-[#7b5be4]/30' 
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          <div className="h-8 w-px bg-[#2d3139] mx-2 hidden md:block" />

          <div className="relative group">
             <button className="flex items-center gap-2 px-4 py-2 bg-[#0c0d10] border border-[#2d3139] rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:border-[#7b5be4] transition-all">
                <ListFilter className="w-4 h-4" />
                Gênero: <span className="text-[#7b5be4]">{selectedGenre}</span>
                <ChevronDown className="w-4 h-4" />
             </button>
             {/* Dropdown - Simplificado para fins de UI */}
             <div className="absolute top-full left-0 mt-2 w-48 bg-[#161a22] border border-[#2d3139] rounded-2xl shadow-2xl py-2 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all z-50">
                {genres.map(g => (
                   <button 
                     key={g} 
                     onClick={() => setSelectedGenre(g)}
                     className="w-full text-left px-4 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-[#7b5be4] transition-all"
                   >
                      {g}
                   </button>
                ))}
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ordenar por</span>
           <button className="flex items-center gap-2 px-4 py-2 bg-[#0c0d10] border border-[#2d3139] rounded-xl text-xs font-bold text-[#7b5be4] hover:border-[#7b5be4] transition-all">
              <SortAsc className="w-4 h-4" />
              Popularidade
           </button>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        {filteredItems.map((item) => (
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

      {filteredItems.length === 0 && (
        <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-4">
          <Filter className="w-12 h-12 opacity-20" />
          <p className="font-bold uppercase tracking-widest text-xs">Nenhum resultado encontrado para estes filtros</p>
        </div>
      )}
    </div>
  );
};

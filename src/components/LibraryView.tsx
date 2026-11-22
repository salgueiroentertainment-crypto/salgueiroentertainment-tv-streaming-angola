import React, { useState } from 'react';
import { ContentCard } from './ContentCard';
import { MediaItem } from '../types/streaming';
import { Heart, Search, Film, Tv, Sparkles, Trash2 } from 'lucide-react';

interface LibraryViewProps {
  items: MediaItem[];
  onItemClick: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (e: React.MouseEvent, item: MediaItem) => void;
  onExplore?: () => void;
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  onItemClick,
  isInWatchlist,
  onToggleWatchlist,
  onExplore,
  isAdmin = false,
  onEditMovie,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'movies' | 'series' | 'live_tv'>('all');

  const filteredItems = items.filter(item => {
    if (activeTab === 'movies') return item.type === 'movie';
    if (activeTab === 'series') return item.type === 'series';
    if (activeTab === 'live_tv') return item.type === 'live_tv';
    return true;
  });

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#2d3139]">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#7b5be4] rounded-2xl shadow-lg shadow-[#7b5be4]/20">
            <Heart className="w-6 h-6 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">Meus Favoritos</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
              {items.length} {items.length === 1 ? 'item salvo' : 'itens salvos'} em Salgueiro Streaming
            </p>
          </div>
        </div>
        
        {/* Category Filters */}
        <div className="flex items-center gap-2 bg-[#161a22] p-1.5 rounded-2xl border border-[#2d3139]">
           <button 
             onClick={() => setActiveTab('all')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'all' ? 'bg-[#7b5be4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Tudo ({items.length})
           </button>
           <button 
             onClick={() => setActiveTab('movies')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'movies' ? 'bg-[#7b5be4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Filmes ({items.filter(i => i.type === 'movie').length})
           </button>
           <button 
             onClick={() => setActiveTab('series')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'series' ? 'bg-[#7b5be4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Séries ({items.filter(i => i.type === 'series').length})
           </button>
           <button 
             onClick={() => setActiveTab('live_tv')}
             className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'live_tv' ? 'bg-[#7b5be4] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
           >
             Canais TV ({items.filter(i => i.type === 'live_tv').length})
           </button>
        </div>
      </div>

      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="relative group">
              <ContentCard
                item={item}
                onClick={onItemClick}
                isInWatchlist={true}
                onToggleWatchlist={onToggleWatchlist}
                isAdmin={isAdmin}
                onEditMovie={onEditMovie}
              />
              {/* Quick Remove Button Overlay */}
              <button
                onClick={(e) => onToggleWatchlist(e, item)}
                className="absolute top-2 left-2 z-10 p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg backdrop-blur-sm"
                title="Remover dos Favoritos"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-[400px] flex flex-col items-center justify-center text-center space-y-6">
          <div className="w-24 h-24 bg-[#161a22] rounded-full flex items-center justify-center border border-[#2d3139]">
            <Heart className="w-10 h-10 text-slate-700" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-white">Nenhum favorito encontrado</h2>
            <p className="text-sm text-slate-500 max-w-xs mx-auto">
              Adicione filmes, séries ou canais aos seus favoritos para acessá-los rapidamente em qualquer dispositivo.
            </p>
          </div>
          {onExplore && (
            <button 
              onClick={onExplore}
              className="bg-[#7b5be4] text-white font-black px-8 py-3.5 rounded-2xl hover:bg-[#8e74eb] transition-all shadow-xl text-xs uppercase tracking-widest active:scale-95"
            >
              Explorar Catálogo
            </button>
          )}
        </div>
      )}
    </div>
  );
};

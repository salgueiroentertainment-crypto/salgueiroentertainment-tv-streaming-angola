import React, { useState } from 'react';
import {
  X,
  Play,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Sparkles,
  Info,
  Film,
  Users,
  Award
} from 'lucide-react';
import { MediaItem } from '../types/streaming';

interface MovieDetailModalProps {
  media: MediaItem | null;
  onClose: () => void;
  onPlay: (media: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  onToggleWatchlist: (media: MediaItem) => void;
  similarItems: MediaItem[];
  onSelectSimilar: (media: MediaItem) => void;
}

export const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
  media,
  onClose,
  onPlay,
  isInWatchlist,
  onToggleWatchlist,
  similarItems,
  onSelectSimilar,
}) => {
  const [activeTab, setActiveTab] = useState<'geral' | 'elenco' | 'semelhantes'>('geral');
  const [liked, setLiked] = useState<boolean | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!media) return null;

  const inWatchlist = isInWatchlist(media.id);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#090e17] border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl my-auto">
        {/* Close Button Top Right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Media Hero Banner */}
        <div className="relative aspect-[16/9] sm:aspect-[21/9] w-full bg-slate-950 overflow-hidden">
          <img
            src={media.bannerUrl}
            alt={media.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090e17] via-[#090e17]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090e17] via-[#090e17]/60 to-transparent w-2/3" />

          {/* Quick Overlay Text in Banner */}
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 bg-[#00a8e1] text-white px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                <Check className="w-3 h-3 stroke-[3]" />
                Incluído no Salgueiro
              </span>
              {media.isTop10 && (
                <span className="text-amber-400 text-xs font-bold">
                  Top #{media.top10Rank} em Angola
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-md">
              {media.title}
            </h2>
          </div>
        </div>

        {/* Main Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  onPlay(media);
                  onClose();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[#00a8e1] hover:bg-[#0090c2] text-white font-bold rounded-lg shadow-lg transition-transform active:scale-95 text-sm"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Assistir Agora</span>
              </button>

              <button
                onClick={() => onToggleWatchlist(media)}
                className={`p-3 rounded-lg border transition-all ${
                  inWatchlist
                    ? 'bg-[#00a8e1]/20 border-[#00a8e1] text-[#00a8e1]'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-white'
                }`}
                title={inWatchlist ? 'Remover da Lista' : 'Adicionar à Lista'}
              >
                {inWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setLiked(liked === true ? null : true)}
                className={`p-3 rounded-lg border transition-all ${
                  liked === true
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Gostei deste título"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>

              <button
                onClick={() => setLiked(liked === false ? null : false)}
                className={`p-3 rounded-lg border transition-all ${
                  liked === false
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                }`}
                title="Não recomendado para mim"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedLink ? 'Link Copiado!' : 'Compartilhar'}</span>
            </button>
          </div>

          {/* Metadata Row (Zero-Pill standard with dot separators) */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-300 font-medium">
            <span className="text-emerald-400 font-bold">{media.matchPercentage}% relevante</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-slate-800 text-slate-200 border border-slate-700">
              {media.rating}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{media.year}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{media.duration}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-amber-400 font-semibold">IMDb {media.imdbScore}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-400">{media.quality}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-[#00a8e1]">{media.genres.join(', ')}</span>
          </div>

          {/* Synopsis */}
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            {media.synopsis}
          </p>

          {/* Salgueiro Streaming Tabs */}
          <div className="border-b border-slate-800">
            <div className="flex items-center gap-6 text-sm font-semibold">
              <button
                onClick={() => setActiveTab('geral')}
                className={`pb-3 relative transition-colors ${
                  activeTab === 'geral' ? 'text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Visão Geral & Detalhes</span>
                {activeTab === 'geral' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a8e1]" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('elenco')}
                className={`pb-3 relative transition-colors ${
                  activeTab === 'elenco' ? 'text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Elenco & X-Ray</span>
                {activeTab === 'elenco' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a8e1]" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('semelhantes')}
                className={`pb-3 relative transition-colors ${
                  activeTab === 'semelhantes' ? 'text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Clientes Também Assistiram</span>
                {activeTab === 'semelhantes' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a8e1]" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'geral' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                    Direção
                  </span>
                  <span className="font-semibold text-white">{media.director || 'Marcus Stone'}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                    Idiomas de Áudio Disponíveis
                  </span>
                  <p className="text-slate-300">
                    {media.audio.join(', ')}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                    Legendas Disponíveis
                  </span>
                  <p className="text-slate-300">
                    {media.subtitles.join(', ')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 uppercase tracking-wider block text-[10px]">
                    Classificação Indicativa
                  </span>
                  <p className="text-slate-300">
                    Recomendado para maiores de {media.rating} anos. Contém violência moderada, suspense psicológico e ação intensa.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'elenco' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(media.cast || [
                  { name: 'Ryan Gosling', role: 'Detetive Ray Vance', character: 'Investigador da divisão cibernética' },
                  { name: 'Florence Pugh', role: 'Kira / Sintética-7', character: 'Androide desertora' },
                  { name: 'Marcus Stone', role: 'Comandante Kaelen', character: 'Chefe de segurança urbana' }
                ]).map((actor, idx) => (
                  <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                    <h4 className="text-xs font-bold text-white">{actor.name}</h4>
                    <p className="text-[11px] text-[#00a8e1] font-medium">{actor.role}</p>
                    <span className="text-[10px] text-slate-400">{actor.character}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'semelhantes' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {similarItems.slice(0, 4).map((sim) => (
                <div
                  key={sim.id}
                  onClick={() => onSelectSimilar(sim)}
                  className="group cursor-pointer rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-[#00a8e1] transition-all"
                >
                  <img
                    src={sim.thumbnailUrl}
                    alt={sim.title}
                    referrerPolicy="no-referrer"
                    className="w-full aspect-[16/9] object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="p-2 space-y-1">
                    <h5 className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#00a8e1]">
                      {sim.title}
                    </h5>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <span>★ {sim.imdbScore}</span>
                      <span>·</span>
                      <span>{sim.year}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

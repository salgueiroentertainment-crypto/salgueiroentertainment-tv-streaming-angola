import React, { useEffect, useState } from 'react';
import { Play, Plus, Check, Star, Clock, Globe, ArrowLeft, Share2, Info, Sparkles, Edit2, Trash2, ShieldAlert, Cpu, Server, Puzzle, Subtitles, RefreshCw, Zap } from 'lucide-react';
import { MediaItem, InstalledStremioAddon, StremioStreamItem } from '../types/streaming';
import { fetchStremioStreams } from '../lib/stremioAddons';
import { findBestPlaybackServers, isVaultStreamUrl, PlaybackServerCandidate, warmUpPlaybackTarget } from '../lib/mediaDomain';

interface DetailsViewProps {
  item: MediaItem;
  onBack: () => void;
  onPlay: (item: MediaItem) => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (item: MediaItem) => void;
  similarItems: MediaItem[];
  installedAddons?: InstalledStremioAddon[];
  isAdmin?: boolean;
  onEditMovie?: (item: MediaItem) => void;
  onDeleteMovie?: (id: string) => void;
  onPickArtwork?: (item: MediaItem) => void;
}

export const DetailsView: React.FC<DetailsViewProps> = ({
  item,
  onBack,
  onPlay,
  isInWatchlist,
  onToggleWatchlist,
  similarItems,
  installedAddons = [],
  isAdmin = false,
  onEditMovie,
  onDeleteMovie,
  onPickArtwork,
}) => {
  const [addonStreams, setAddonStreams] = useState<StremioStreamItem[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [rankedServers, setRankedServers] = useState<PlaybackServerCandidate[]>([]);
  const [bestServer, setBestServer] = useState<PlaybackServerCandidate | null>(null);
  const [searchingServers, setSearchingServers] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);

  const hasEnabledAddons = installedAddons.some((a) => a.enabled);

  const discoverBestServers = async (forceWebSearch: boolean, addonList: StremioStreamItem[] = addonStreams) => {
    setSearchingServers(true);
    try {
      const candidateUrls = addonList
        .filter((s) => Boolean(s.url))
        .map((s) => ({
          url: s.url as string,
          label: s.name || s.title || s.addonName || 'Addon',
          source: s.addonName || 'Addon Stremio',
        }));

      const res = await findBestPlaybackServers({
        title: item.title,
        originalTitle: item.originalTitle,
        type: item.type === 'live_tv' ? 'live_tv' : item.type === 'series' ? 'series' : 'movie',
        year: item.year,
        imdbId: item.id && /^tt\d+$/i.test(item.id) ? item.id : undefined,
        currentUrl: item.videoUrl,
        candidateUrls,
        searchWeb: forceWebSearch || !item.videoUrl,
        forceWebMovieSearch: forceWebSearch,
      });
      setRankedServers(res.servers || []);
      setBestServer(res.bestServer || null);
    } catch {
      // keep existing UI options
    } finally {
      setSearchingServers(false);
    }
  };

  useEffect(() => {
    let active = true;
    setRankedServers([]);
    setBestServer(null);
    if (item.videoUrl) {
      warmUpPlaybackTarget(item.videoUrl);
    }

    const runInitial = async () => {
      let loadedAddons: StremioStreamItem[] = [];
      if (hasEnabledAddons && item.type !== 'live_tv') {
        setLoadingStreams(true);
        try {
          loadedAddons = await fetchStremioStreams(item, installedAddons);
        } catch {
          loadedAddons = [];
        } finally {
          if (active) {
            setAddonStreams(loadedAddons);
            setLoadingStreams(false);
          }
        }
      } else {
        setAddonStreams([]);
      }

      if (active) {
        await discoverBestServers(!item.videoUrl, loadedAddons);
      }
    };

    void runInitial();
    return () => {
      active = false;
    };
  }, [item.id, item.videoUrl, hasEnabledAddons]);

  const handlePrimaryPlay = () => {
    if (item.videoUrl) {
      // Sempre abrir o filme usando o seu servidor principal conforme a sua URL de origem
      onPlay(item);
      return;
    }
    if (bestServer && bestServer.alive) {
      onPlay({
        ...item,
        videoUrl: bestServer.url || bestServer.playbackUrl,
      });
      return;
    }
    const firstStreamUrl = addonStreams.find((s) => s.url)?.url;
    if (firstStreamUrl) {
      onPlay({ ...item, videoUrl: firstStreamUrl });
      return;
    }
    const sourcesEl = document.getElementById('sources-section');
    if (sourcesEl) {
      sourcesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleShareMovie = async () => {
    const shareText = `${item.title} (${item.year}) - Salgueiro Streaming`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: shareText, url: window.location.href });
        return;
      }
    } catch {
      // fallback to clipboard below
    }
    try {
      await navigator.clipboard?.writeText(window.location.href);
    } catch {
      // ignore clipboard errors
    }
    setCopiedShare(true);
    window.setTimeout(() => setCopiedShare(false), 2200);
  };
  return (
    <div className="relative animate-fade-in pb-20">
      {/* Background Hero */}
      <div className="absolute top-0 left-0 right-0 h-[70vh] z-0">
        <img 
          src={item.bannerUrl} 
          alt={item.title} 
          className="w-full h-full object-cover object-top opacity-30 grayscale-[30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d10] via-[#0c0d10]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0c0d10] via-[#0c0d10]/20 to-transparent" />
      </div>

      {/* Content Layout */}
      <div className="relative z-10 pt-10 px-6 lg:px-12 max-w-7xl mx-auto">
        {/* Back Navigation */}
        <button 
           onClick={onBack}
           className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors group"
        >
           <div className="p-2 bg-[#161a22] rounded-xl border border-[#2d3139] group-hover:border-[#7b5be4] transition-all">
              <ArrowLeft className="w-5 h-5" />
           </div>
           <span className="text-xs font-bold uppercase tracking-widest">Voltar</span>
        </button>

        <div className="flex flex-col lg:flex-row gap-12">
          {/* Poster & Main Info */}
          <div className="flex-none w-full lg:w-80 space-y-6">
            <div className="aspect-[2/3] rounded-3xl overflow-hidden border border-[#2d3139] shadow-2xl shadow-black/50 ring-1 ring-white/5">
              <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={handlePrimaryPlay}
                disabled={!item.videoUrl && !addonStreams.some((s) => s.url) && !(bestServer && bestServer.alive)}
                className="w-full py-4 bg-[#7b5be4] hover:bg-[#8e74eb] disabled:opacity-70 text-white font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-[#7b5be4]/20 active:scale-95 text-sm uppercase tracking-widest"
              >
                <Play className="w-5 h-5 fill-white" />
                {item.videoUrl
                  ? 'Assistir no Servidor Principal'
                  : bestServer && bestServer.alive
                    ? 'Assistir no Melhor Servidor'
                    : 'Assistir Agora'}
              </button>
              <button
                onClick={() => onToggleWatchlist(item)}
                className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all border text-sm uppercase tracking-widest ${
                  isInWatchlist
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                }`}
              >
                {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {isInWatchlist ? 'Na Biblioteca' : 'Biblioteca'}
              </button>
            </div>

            <div className={`grid ${isAdmin && onEditMovie && item.type !== 'live_tv' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
               <button
                 type="button"
                 onClick={() => void handleShareMovie()}
                 className="py-3 bg-[#161a22] rounded-xl border border-[#2d3139] text-white flex items-center justify-center gap-2 hover:bg-[#2d3139] transition-all"
               >
                  {copiedShare ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4 text-[#7b5be4]" />}
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {copiedShare ? 'Link Copiado' : 'Partilhar'}
                  </span>
               </button>
               {isAdmin && onEditMovie && item.type !== 'live_tv' && (
                 <button
                   type="button"
                   onClick={() => onEditMovie(item)}
                   title="Editar capa, banner, URL de streaming e informações do filme"
                   className="py-3 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-black rounded-xl border border-amber-500/40 flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/10"
                 >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Editar</span>
                 </button>
               )}
            </div>

            {/* Admin Management Section */}
            {isAdmin && (
              <div className="p-4 bg-[#161a22] rounded-2xl border border-amber-500/30 space-y-3 shadow-xl">
                <div className="flex items-center gap-2 text-amber-400">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Ações do Administrador</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onEditMovie && onEditMovie(item)}
                    className="py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-400 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-amber-500/30"
                    title="Editar título, ano de lançamento, capa, banner, links ou sinopse"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Editar Filme</span>
                  </button>
                  {!confirmDeleteOpen ? (
                    <button
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-red-500/30"
                      title="Remover filme do catálogo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setConfirmDeleteOpen(false);
                          if (onDeleteMovie) onDeleteMovie(item.id);
                          onBack();
                        }}
                        className="flex-1 py-2.5 px-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[11px] transition-all"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteOpen(false)}
                        className="px-2 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-xl font-bold text-[11px] transition-all"
                      >
                        Não
                      </button>
                    </div>
                  )}
                </div>
                {onPickArtwork && item.type !== 'live_tv' && (
                  <button
                    type="button"
                    onClick={() => onPickArtwork(item)}
                    className="w-full py-2.5 px-3 bg-[#7b5be4]/15 hover:bg-[#7b5be4] text-[#c4b5fd] hover:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all border border-[#7b5be4]/40"
                    title="Alterar título, ano, fazer upload local, colar URL ou escolher capa e banner na web"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Capa, Banner, Título &amp; Ano</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Detailed Info & Source Add-ons */}
          <div className="flex-1 space-y-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-400/10 text-amber-400 px-3 py-1 rounded-lg border border-amber-400/20 flex items-center gap-1.5 text-xs font-black">
                   <Star className="w-4 h-4 fill-amber-400" />
                   {item.imdbScore} <span className="opacity-50 font-medium">IMDb</span>
                </div>
                <div className="bg-[#7b5be4]/10 text-[#7b5be4] px-3 py-1 rounded-lg border border-[#7b5be4]/20 text-xs font-black uppercase tracking-widest">
                   {item.quality}
                </div>
              </div>

              <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tighter leading-tight">
                {item.title}
              </h1>

              <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                   <Clock className="w-4 h-4 text-[#7b5be4]" />
                   <span>{item.duration || item.year}</span>
                </div>
                <span>•</span>
                <span>{item.genres.join(' / ')}</span>
                <span>•</span>
                <span className="text-emerald-500">{item.matchPercentage}% relevante</span>
              </div>

              <p className="text-slate-300 text-lg leading-relaxed max-w-3xl">
                {item.synopsis}
              </p>
            </div>

            {/* Playback Servers Section */}
            <div id="sources-section" className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#7b5be4]" />
                  <h2 className="text-xl font-black text-white tracking-tight uppercase tracking-widest">
                    Fontes de Reprodução & Servidores
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={searchingServers}
                  onClick={() => void discoverBestServers(true)}
                  className="px-4 py-2 bg-[#7b5be4]/15 hover:bg-[#7b5be4]/30 border border-[#7b5be4]/40 text-[#c4b5fd] text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2 transition-all disabled:opacity-60"
                >
                  {searchingServers ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  )}
                  {searchingServers ? 'A procurar servidores...' : 'Procurar Melhor Servidor (Web)'}
                </button>
              </div>

              {rankedServers.length > 0 && (
                <div className="space-y-2.5">
                  {rankedServers.map((srv) => (
                    <div
                      key={srv.id}
                      onClick={() => {
                        if (!srv.alive) return;
                        if (item.videoUrl && srv.url === item.videoUrl && srv.engine !== 'transcode' && srv.engine !== 'proxy') {
                          onPlay(item);
                          return;
                        }
                        onPlay({
                          ...item,
                          videoUrl: srv.isLocalVault && srv.engine === 'html5' ? srv.url : srv.playbackUrl,
                        });
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                        !srv.alive
                          ? 'bg-[#161a22]/40 border-[#2d3139]/60 opacity-50 cursor-not-allowed'
                          : srv.recommended
                            ? 'bg-emerald-500/10 border-emerald-500/50 hover:border-emerald-400 cursor-pointer group'
                            : 'bg-[#161a22] border-[#2d3139] hover:border-[#7b5be4]/60 cursor-pointer group'
                      }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#2d3139] bg-black/30 shrink-0">
                          {srv.recommended && srv.alive ? (
                            <Zap className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Server className="w-5 h-5 text-[#7b5be4]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate">{srv.label}</h4>
                            {srv.recommended && srv.alive && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase tracking-wider">
                                Melhor Servidor
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                            {srv.source} • {srv.quality} • {srv.reason}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {srv.alive && (
                          <span className="hidden sm:inline px-2 py-1 bg-white/5 text-slate-300 rounded-lg text-[10px] font-mono">
                            {srv.latencyMs}ms
                          </span>
                        )}
                        {srv.alive && (
                          <span className="p-2 bg-[#7b5be4] text-white rounded-lg group-hover:scale-105 transition-transform">
                            <Play className="w-4 h-4 fill-current" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {item.videoUrl && (
                  <>
                    <div
                      className="flex items-center justify-between p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl hover:border-[#7b5be4]/60 transition-all cursor-pointer group"
                      onClick={() => onPlay(item)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#2d3139] group-hover:bg-[#7b5be4]/15 transition-colors">
                          <Globe className="w-5 h-5 text-[#7b5be4]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Salgueiro Streaming Angola • Auto Cascata</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {item.quality} • Seleção Automática de Motor (HLS / MPEGTS / HTML5 / FFmpeg)
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-emerald-400">
                          Recomendado
                        </span>
                        <span className="p-2 bg-[#7b5be4] text-white rounded-lg">
                          <Play className="w-4 h-4 fill-current" />
                        </span>
                      </div>
                    </div>

                    {!isVaultStreamUrl(item.videoUrl) && (
                      <div
                        className="flex items-center justify-between p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl hover:border-sky-500/50 transition-all cursor-pointer group"
                        onClick={() =>
                          onPlay({
                            ...item,
                            videoUrl: `/api/proxy?url=${encodeURIComponent(item.videoUrl)}`,
                          })
                        }
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#2d3139] group-hover:bg-sky-500/10 transition-colors">
                            <Server className="w-5 h-5 text-sky-400" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-white">Salgueiro Servidor Proxy HTTPS</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              Correção Mixed-Content HTTP/HTTPS, CORS e Redirecionamentos
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-sky-400">
                            Proxy 206
                          </span>
                          <span className="p-2 bg-[#2d3139] group-hover:bg-sky-600 text-white rounded-lg transition-all">
                            <Play className="w-4 h-4 fill-current" />
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className="flex items-center justify-between p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl hover:border-amber-500/50 transition-all cursor-pointer group"
                      onClick={() =>
                        onPlay({
                          ...item,
                          videoUrl: `/api/transcode?vcodec=libx264&url=${encodeURIComponent(item.videoUrl)}`,
                        })
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#2d3139] group-hover:bg-amber-500/10 transition-colors">
                          <Cpu className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">Transcodificador FFmpeg • Compatibilidade Máxima</h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                            Converte MKV / HEVC 10-Bit / Dolby E-AC-3 → MP4 H.264 + AAC Estéreo
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-amber-400">
                          H.264 + AAC
                        </span>
                        <span className="p-2 bg-[#2d3139] group-hover:bg-amber-500 group-hover:text-black text-white rounded-lg transition-all">
                          <Play className="w-4 h-4 fill-current" />
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {loadingStreams && (
                  <div className="p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl text-xs text-slate-400 animate-pulse">
                    A procurar streams nos addons instalados...
                  </div>
                )}

                {addonStreams
                  .filter((s) => Boolean(s.url))
                  .map((s, idx) => (
                    <div
                      key={`${s.addonName || 'addon'}-${idx}`}
                      className="flex items-center justify-between p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl hover:border-[#7b5be4]/60 transition-all cursor-pointer group"
                      onClick={() => onPlay({ ...item, videoUrl: s.url || '' })}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-[#2d3139] group-hover:bg-[#7b5be4]/15 transition-colors shrink-0">
                          <Puzzle className="w-5 h-5 text-[#a78bfa]" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">
                            {s.name || s.addonName || 'Fonte de Addon'}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">
                            {s.title || s.description || 'Stream Externo'}
                          </p>
                        </div>
                      </div>
                      <span className="p-2 bg-[#7b5be4] text-white rounded-lg shrink-0">
                        <Play className="w-4 h-4 fill-current" />
                      </span>
                    </div>
                  ))}

                {item.generatedSubtitles && item.generatedSubtitles.length > 0 && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 font-semibold">
                    <Subtitles className="w-4 h-4 shrink-0" />
                    <span>
                      Legenda automática disponível: {item.generatedSubtitles.map((g) => g.label).join(', ')}
                    </span>
                  </div>
                )}

                {!item.videoUrl && !loadingStreams && addonStreams.filter((s) => s.url).length === 0 && (
                  <div className="p-4 bg-[#161a22] border border-[#2d3139] rounded-2xl text-xs text-slate-400">
                    Nenhuma fonte de vídeo direta disponível para este item.
                  </div>
                )}
              </div>
            </div>

            {/* Cast & Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-[#2d3139]">
               <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                    {item.type === 'live_tv' ? 'Origem / Transmissão' : 'Diretor'}
                  </h3>
                  <p className="text-white font-bold">
                    {item.director || (item.addonName ? `Via ${item.addonName}` : 'Salgueiro Streaming')}
                  </p>
               </div>
               <div className="space-y-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Idiomas</h3>
                  <p className="text-white font-bold">{item.audio.join(', ')}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Similar Rail */}
        <section className="mt-20 space-y-8">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-[#7b5be4]/10 rounded-xl">
                 <Info className="w-5 h-5 text-[#7b5be4]" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter">Títulos Relacionados</h2>
           </div>
           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {similarItems.slice(0, 6).map(sim => (
                 <div key={sim.id} className="aspect-[2/3] rounded-2xl overflow-hidden border border-[#2d3139] hover:border-[#7b5be4] transition-all cursor-pointer group" onClick={() => onPlay(sim)}>
                    <img src={sim.thumbnailUrl} alt={sim.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                 </div>
              ))}
           </div>
        </section>
      </div>
    </div>
  );
};

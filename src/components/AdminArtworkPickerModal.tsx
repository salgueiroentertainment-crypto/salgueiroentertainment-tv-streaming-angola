import React, { useEffect, useState } from 'react';
import {
  Check,
  Edit3,
  Film,
  Globe,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { MediaItem } from '../types/streaming';
import {
  searchOriginalMovieArtwork,
  uploadMediaToDomain,
  WebArtworkResult,
} from '../lib/mediaDomain';

interface AdminArtworkPickerModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onApplyArtwork: (
    item: MediaItem,
    thumbnailUrl: string,
    bannerUrl: string,
    extraMeta?: {
      title?: string;
      originalTitle?: string;
      source?: string;
      synopsis?: string;
      imdbScore?: number;
      year?: number;
    }
  ) => Promise<void> | void;
}

export const AdminArtworkPickerModal: React.FC<AdminArtworkPickerModalProps> = ({
  item,
  onClose,
  onApplyArtwork,
}) => {
  const [editedTitle, setEditedTitle] = useState('');
  const [editedOriginalTitle, setEditedOriginalTitle] = useState('');
  const [editedYear, setEditedYear] = useState<number>(2026);

  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'movie' | 'series'>('all');
  const [results, setResults] = useState<WebArtworkResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const [selectedPoster, setSelectedPoster] = useState('');
  const [selectedBanner, setSelectedBanner] = useState('');
  const [selectedMeta, setSelectedMeta] = useState<{
    source?: string;
    synopsis?: string;
    imdbScore?: number;
  }>({});

  const runSearch = async (q: string, t: 'all' | 'movie' | 'series') => {
    const clean = q.trim();
    if (!clean) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const found = await searchOriginalMovieArtwork(clean, t);
      setResults(found);
      if (found.length === 0) {
        setErrorMsg(
          `Nenhuma capa ou banner encontrado na web para "${clean}". Experimente pesquisar outro título ou carregue uma imagem local / URL.`
        );
      }
    } catch (err) {
      setResults([]);
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao procurar imagens na web.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!item) return;
    const initialTitle = (item.title || '').trim();
    const initialOrig = (item.originalTitle || item.title || '').trim();
    const initialQuery = initialOrig || initialTitle;
    const initialType: 'all' | 'movie' | 'series' =
      item.type === 'series' ? 'series' : 'movie';

    setEditedTitle(initialTitle);
    setEditedOriginalTitle(initialOrig);
    setEditedYear(Number(item.year) || 2026);
    setQuery(initialQuery);
    setSearchType(initialType);
    setSelectedPoster(item.thumbnailUrl || '');
    setSelectedBanner(item.bannerUrl || item.thumbnailUrl || '');
    setSelectedMeta({});
    setResults([]);
    setErrorMsg(null);
    setStatusNote(null);
    void runSearch(initialQuery, initialType);
  }, [item?.id]);

  if (!item) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query, searchType);
  };

  const handleLocalPosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingPoster(true);
    setErrorMsg(null);
    setStatusNote(null);
    try {
      const res = await uploadMediaToDomain(file, 'images');
      setSelectedPoster(res.streamPath);
      setStatusNote(`Capa local "${file.name}" carregada para o servidor!`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Falha no upload da capa: ${err.message}`
          : 'Não foi possível carregar a imagem local da capa.'
      );
    } finally {
      setUploadingPoster(false);
      input.value = '';
    }
  };

  const handleLocalBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setErrorMsg(null);
    setStatusNote(null);
    try {
      const res = await uploadMediaToDomain(file, 'images');
      setSelectedBanner(res.streamPath);
      setStatusNote(`Banner local "${file.name}" carregado para o servidor!`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `Falha no upload do banner: ${err.message}`
          : 'Não foi possível carregar a imagem local do banner.'
      );
    } finally {
      setUploadingBanner(false);
      input.value = '';
    }
  };

  const handleSave = async () => {
    const finalTitle = editedTitle.trim() || item.title;
    const finalOrig = editedOriginalTitle.trim() || finalTitle;
    const finalYear = Number(editedYear) > 1900 ? Number(editedYear) : item.year || 2026;
    const finalPoster = selectedPoster.trim() || selectedBanner.trim() || item.thumbnailUrl;
    const finalBanner = selectedBanner.trim() || finalPoster || item.bannerUrl;

    if (!finalTitle) {
      setErrorMsg('O título do filme não pode estar vazio.');
      return;
    }
    if (!finalPoster) {
      setErrorMsg('Escolha pelo menos uma imagem de capa ou banner antes de guardar.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      await onApplyArtwork(item, finalPoster, finalBanner, {
        ...selectedMeta,
        title: finalTitle,
        originalTitle: finalOrig,
        year: finalYear,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível guardar as alterações do filme.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#161a22] border border-[#2d3139] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#2d3139] flex items-center justify-between gap-4 bg-[#0c0d10]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Edit3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  Editar Filme, Capa &amp; Banner — {editedTitle || item.title}
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Altere título, ano de lançamento, faça upload local, cole URL ou escolha a capa e o banner na web.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editable Metadata + Poster/Banner Controls + Web Search */}
        <div className="px-6 py-4 bg-[#0c0d10]/40 border-b border-[#2d3139] space-y-3.5">
          {/* Row 1: Title, Original Title, Year */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Título do Filme
              </label>
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Título apresentado na plataforma"
                className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
              />
            </div>
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Título Original
              </label>
              <input
                type="text"
                value={editedOriginalTitle}
                onChange={(e) => setEditedOriginalTitle(e.target.value)}
                placeholder="Ex: Original English Title"
                className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Ano Lançamento
              </label>
              <input
                type="number"
                min={1900}
                max={2099}
                value={editedYear}
                onChange={(e) => setEditedYear(Number(e.target.value))}
                className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-3 py-2 text-xs font-mono font-bold text-white outline-none"
              />
            </div>
          </div>

          {/* Row 2: Poster (Local Upload + URL) & Banner (Local Upload + URL) & Save */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
            {/* Poster Preview + URL + Local Upload */}
            <div className="lg:col-span-4 flex items-center gap-3 p-3 rounded-2xl bg-[#0c0d10] border border-[#2d3139]">
              <div className="w-14 h-20 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                {selectedPoster ? (
                  <img
                    src={selectedPoster}
                    alt="Capa selecionada"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Capa (Poster)
                  </span>
                  <label
                    className={`px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500 hover:text-black border border-amber-500/35 text-amber-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                      uploadingPoster ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                    }`}
                    title="Carregar imagem de capa do computador"
                  >
                    {uploadingPoster ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Upload className="w-2.5 h-2.5" />
                    )}
                    <span>{uploadingPoster ? 'A enviar...' : 'Upload Local'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPoster}
                      onChange={handleLocalPosterUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={selectedPoster}
                  onChange={(e) => setSelectedPoster(e.target.value)}
                  placeholder="URL da Capa ou Upload Local..."
                  className="w-full bg-[#161a22] border border-[#2d3139] focus:border-[#7b5be4] rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono outline-none"
                />
              </div>
            </div>

            {/* Banner Preview + URL + Local Upload */}
            <div className="lg:col-span-5 flex items-center gap-3 p-3 rounded-2xl bg-[#0c0d10] border border-[#2d3139]">
              <div className="w-28 h-20 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 flex items-center justify-center">
                {selectedBanner ? (
                  <img
                    src={selectedBanner}
                    alt="Banner selecionado"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-slate-600" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-sky-400">
                    Banner (Fundo 16:9)
                  </span>
                  <label
                    className={`px-2 py-0.5 rounded-md bg-sky-500/15 hover:bg-sky-400 hover:text-black border border-sky-500/35 text-sky-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                      uploadingBanner ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                    }`}
                    title="Carregar imagem de banner do computador"
                  >
                    {uploadingBanner ? (
                      <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Upload className="w-2.5 h-2.5" />
                    )}
                    <span>{uploadingBanner ? 'A enviar...' : 'Upload Local'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingBanner}
                      onChange={handleLocalBannerUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={selectedBanner}
                  onChange={(e) => setSelectedBanner(e.target.value)}
                  placeholder="URL do Banner ou Upload Local..."
                  className="w-full bg-[#161a22] border border-[#2d3139] focus:border-[#7b5be4] rounded-lg px-2.5 py-1.5 text-[11px] text-white font-mono outline-none"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="lg:col-span-3 flex flex-col justify-center gap-2">
              <button
                type="button"
                disabled={saving || uploadingPoster || uploadingBanner}
                onClick={handleSave}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
                <span>{saving ? 'A guardar...' : 'Guardar Alterações'}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar título na web para encontrar capas e banners..."
                className="w-full bg-[#0c0d10] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl py-2.5 pl-10 pr-4 text-xs text-white outline-none"
              />
            </div>
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value as 'all' | 'movie' | 'series')}
              className="bg-[#0c0d10] border border-[#2d3139] rounded-xl px-3 py-2.5 text-xs font-bold text-white outline-none focus:border-[#7b5be4]"
            >
              <option value="all">Filmes &amp; Séries</option>
              <option value="movie">Apenas Filmes</option>
              <option value="series">Apenas Séries</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all shrink-0"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              <span>{loading ? 'A procurar...' : 'Procurar na Web'}</span>
            </button>
          </form>
        </div>

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {statusNote && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-semibold flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{statusNote}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-semibold">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-14 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-[#7b5be4]" />
              <p className="text-xs font-bold uppercase tracking-widest">
                A procurar automaticamente capas e banners originais na web...
              </p>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{results.length} resultado(s) da web — escolha a capa e/ou o banner pretendido:</span>
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((res) => {
                  const isPosterSelected = selectedPoster === res.posterUrl;
                  const resolvedBannerUrl = res.bannerUrl || res.posterUrl;
                  const isBannerSelected = selectedBanner === resolvedBannerUrl;
                  const hasSeparateBanner = Boolean(res.bannerUrl && res.bannerUrl !== res.posterUrl);

                  return (
                    <div
                      key={res.id}
                      className={`rounded-2xl bg-[#0c0d10] border p-3.5 flex flex-col gap-3 transition-all ${
                        isPosterSelected || isBannerSelected
                          ? 'border-emerald-500/70 ring-1 ring-emerald-500/30'
                          : 'border-[#2d3139] hover:border-slate-500'
                      }`}
                    >
                      {/* Images comparison inside card */}
                      <div className="flex gap-2.5 items-stretch">
                        {/* Poster */}
                        <div className="relative w-24 aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0">
                          <img
                            src={res.posterUrl}
                            alt={res.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-black text-white uppercase">
                            Capa
                          </span>
                          {isPosterSelected && (
                            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>

                        {/* Banner & Metadata */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 border border-white/10">
                            <img
                              src={resolvedBannerUrl}
                              alt={`${res.title} banner`}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-black text-sky-300 uppercase">
                              {hasSeparateBanner ? 'Banner Wide' : 'Banner / Capa'}
                            </span>
                            {isBannerSelected && (
                              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-sky-400 text-black flex items-center justify-center shadow">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">{res.title}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {res.year || ''} • {res.source}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Selection actions */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPoster(res.posterUrl);
                            setSelectedMeta((prev) => ({
                              ...prev,
                              source: res.source,
                              synopsis: res.synopsis || prev.synopsis,
                              imdbScore: res.imdbScore || prev.imdbScore,
                            }));
                            setStatusNote(`Capa de "${res.title}" selecionada.`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                            isPosterSelected
                              ? 'bg-emerald-500 text-black border-emerald-400'
                              : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                          }`}
                        >
                          {isPosterSelected ? '✓ Capa' : 'Usar Capa'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBanner(resolvedBannerUrl);
                            setSelectedMeta((prev) => ({
                              ...prev,
                              source: res.source,
                            }));
                            setStatusNote(`Banner de "${res.title}" selecionado.`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                            isBannerSelected
                              ? 'bg-sky-400 text-black border-sky-300'
                              : 'bg-white/5 hover:bg-white/10 text-slate-200 border-white/10'
                          }`}
                        >
                          {isBannerSelected ? '✓ Banner' : 'Usar Banner'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPoster(res.posterUrl);
                            setSelectedBanner(resolvedBannerUrl);
                            setSelectedMeta({
                              source: res.source,
                              synopsis: res.synopsis,
                              imdbScore: res.imdbScore,
                            });
                            setStatusNote(`Capa e Banner de "${res.title}" selecionados.`);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                            isPosterSelected && isBannerSelected
                              ? 'bg-[#7b5be4] text-white border-[#7b5be4]'
                              : 'bg-[#7b5be4]/15 hover:bg-[#7b5be4]/30 text-[#c4b5fd] border-[#7b5be4]/40'
                          }`}
                        >
                          Ambos
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (res.title) setEditedTitle(res.title);
                          if (res.originalTitle || res.title) setEditedOriginalTitle(res.originalTitle || res.title);
                          if (res.year && res.year > 1900) setEditedYear(res.year);
                          setSelectedPoster(res.posterUrl);
                          setSelectedBanner(resolvedBannerUrl);
                          setSelectedMeta({
                            source: res.source,
                            synopsis: res.synopsis,
                            imdbScore: res.imdbScore,
                          });
                          setStatusNote(`Título, Ano (${res.year || editedYear}), Capa e Banner aplicados de "${res.title}".`);
                        }}
                        className="w-full py-1 px-2 rounded-lg bg-white/[0.03] hover:bg-amber-500/15 text-[10px] font-bold text-slate-400 hover:text-amber-300 border border-white/5 transition-all"
                      >
                        Aplicar também Título &amp; Ano ({res.year || 'N/A'})
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

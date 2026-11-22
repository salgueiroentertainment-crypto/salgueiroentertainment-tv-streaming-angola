import React, { useEffect, useState } from 'react';
import {
  Puzzle,
  Cpu,
  Server,
  ShieldCheck,
  MapPin,
  Wifi,
  HardDrive,
  Plus,
  Trash2,
  Power,
  RefreshCw,
  Compass,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  CodecSupportReport,
  InstalledStremioAddon,
  MediaItem,
} from '../types/streaming';
import {
  probeBrowserCodecs,
  installStremioAddon,
  fetchStremioAddonCatalogDetailed,
  syncAllAddonManifests,
} from '../lib/stremioAddons';
import {
  MediaDomainConfig,
  DEFAULT_MEDIA_DOMAIN_CONFIG,
  getRuntimeOrigin,
  listVaultMediaFiles,
  formatBytes,
} from '../lib/mediaDomain';
import { ContentCard } from './ContentCard';

interface AddonsViewProps {
  addons?: InstalledStremioAddon[];
  setAddons?: React.Dispatch<React.SetStateAction<InstalledStremioAddon[]>>;
  onSyncAddons?: (nextAddons: InstalledStremioAddon[]) => void;
  isAdmin?: boolean;
  onSelectMedia?: (item: MediaItem) => void;
  isInWatchlist?: (id: string) => boolean;
  onToggleWatchlist?: (e: React.MouseEvent, item: MediaItem) => void;
  mediaDomainConfig?: MediaDomainConfig;
  onOpenDomainManager?: () => void;
}

const AFRICAN_REGIONAL_SERVERS = [
  {
    id: 'angola-luanda',
    name: 'Servidor Local Luanda (Angola Edge Node)',
    domain: 'luanda-edge.salgueirostreaming.ao',
    region: 'Luanda, Angola (Local Peering - BAIXÍSSIMA LATÊNCIA)',
    latency: '8ms',
    status: 'Ativo & Otimizado',
    type: 'Local Core Node',
  },
  {
    id: 'sadc-relay',
    name: 'Servidor Regional SADC (África Austral)',
    domain: 'sadc-relay.salgueirostreaming.co.za',
    region: 'Johannesburg / SADC Region (Cabo Submarino WACS/SAT3)',
    latency: '34ms',
    status: 'Ativo',
    type: 'Regional Relay',
  },
  {
    id: 'africa-cdn',
    name: 'Cloudflare Edge CDN (Sub-Saharan Africa)',
    domain: 'africa-cdn.salgueirohub.net',
    region: 'Multi-PoP Africa (Lagos, Nairobi, Cidade do Cabo)',
    latency: '22ms',
    status: 'Ativo',
    type: 'Global CDN Proxy',
  },
  {
    id: 'ao-domain',
    name: 'Domínio Oficial .AO & DNS Lusófono',
    domain: 'tv.salgueirostreaming.ao',
    region: 'Angola (DNS Local com Anycast)',
    latency: '12ms',
    status: 'Primário',
    type: 'Domain / DNS',
  },
];

export const AddonsView: React.FC<AddonsViewProps> = ({
  addons = [],
  setAddons,
  onSyncAddons,
  isAdmin = false,
  onSelectMedia,
  isInWatchlist = () => false,
  onToggleWatchlist,
  mediaDomainConfig = DEFAULT_MEDIA_DOMAIN_CONFIG,
  onOpenDomainManager,
}) => {
  const [addonUrlInput, setAddonUrlInput] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverHealth, setServerHealth] = useState<{ ok: boolean; ffmpeg: boolean; server: string } | null>(null);
  const [codecs, setCodecs] = useState<CodecSupportReport[]>([]);
  const [activeServer, setActiveServer] = useState<string>('angola-luanda');
  const [vaultStats, setVaultStats] = useState<{ count: number; totalBytes: number }>({ count: 0, totalBytes: 0 });

  // Explorer state for installed addon catalogs
  const [exploringAddonId, setExploringAddonId] = useState<string | null>(null);
  const [exploredItems, setExploredItems] = useState<MediaItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);

  useEffect(() => {
    setCodecs(probeBrowserCodecs());
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setServerHealth(data))
      .catch(() => setServerHealth({ ok: false, ffmpeg: false, server: 'Offline' }));
    listVaultMediaFiles()
      .then((res) => setVaultStats({ count: res.files?.length || 0, totalBytes: res.totalBytes || 0 }))
      .catch(() => {});
  }, []);

  const commitAddonsUpdate = (nextAddons: InstalledStremioAddon[]) => {
    if (setAddons) {
      setAddons(nextAddons);
    }
    if (onSyncAddons) {
      onSyncAddons(nextAddons);
    }
  };

  const handleInstallAddon = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = addonUrlInput.trim();
    if (!raw) return;

    setIsInstalling(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const installed = await installStremioAddon(raw);
      const exists = addons.some(
        (a) =>
          a.transportUrl.toLowerCase() === installed.transportUrl.toLowerCase() ||
          a.manifest.id === installed.manifest.id
      );
      const nextAddons = exists
        ? addons.map((a) =>
            a.manifest.id === installed.manifest.id ||
            a.transportUrl.toLowerCase() === installed.transportUrl.toLowerCase()
              ? installed
              : a
          )
        : [installed, ...addons];
      commitAddonsUpdate(nextAddons);
      setAddonUrlInput('');
      setStatusMsg(
        `Addon "${installed.manifest.name}" adicionado com sucesso${isAdmin ? ' e sincronizado para todos os utilizadores!' : '!'}`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar o manifesto deste addon. Verifique o URL (/manifest.json).'
      );
    } finally {
      setIsInstalling(false);
    }
  };

  const handleToggleAddon = (transportUrl: string) => {
    const nextAddons = addons.map((a) =>
      a.transportUrl === transportUrl ? { ...a, enabled: !a.enabled } : a
    );
    commitAddonsUpdate(nextAddons);
  };

  const handleUninstallAddon = (transportUrl: string, name: string) => {
    const nextAddons = addons.filter((a) => a.transportUrl !== transportUrl);
    commitAddonsUpdate(nextAddons);
    if (exploringAddonId === transportUrl) {
      setExploringAddonId(null);
      setExploredItems([]);
    }
    setStatusMsg(
      `Addon "${name}" desinstalado${isAdmin ? ' globalmente de toda a plataforma.' : '.'}`
    );
  };

  const handleUninstallAll = () => {
    commitAddonsUpdate([]);
    setExploringAddonId(null);
    setExploredItems([]);
    setStatusMsg('Todos os addons foram removidos da plataforma.');
  };

  const handleSyncAll = async () => {
    if (addons.length === 0) return;
    setIsSyncing(true);
    setErrorMsg(null);
    try {
      const updated = await syncAllAddonManifests(addons);
      commitAddonsUpdate(updated);
      setStatusMsg('Manifestos dos addons atualizados.');
    } catch {
      setErrorMsg('Falha ao atualizar alguns addons.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExploreCatalog = async (addon: InstalledStremioAddon) => {
    const catalogs = addon.manifest.catalogs || [];
    if (catalogs.length === 0) {
      setErrorMsg(`O addon "${addon.manifest.name}" não fornece catálogos navegáveis.`);
      return;
    }
    setExploringAddonId(addon.transportUrl);
    setIsLoadingCatalog(true);
    setErrorMsg(null);
    try {
      const firstCat = catalogs[0];
      const { items, setupNotice } = await fetchStremioAddonCatalogDetailed(
        addon,
        firstCat.type,
        firstCat.id
      );
      setExploredItems(items);
      if (setupNotice) {
        setStatusMsg(`${addon.manifest.name}: ${setupNotice}`);
      }
    } catch {
      setExploredItems([]);
      setErrorMsg(`Não foi possível obter o catálogo de "${addon.manifest.name}".`);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const activeAddonsCount = addons.filter((a) => a.enabled).length;

  return (
    <div className="space-y-10 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#2d3139]">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-[#7b5be4] rounded-2xl shadow-lg shadow-[#7b5be4]/25">
            <Puzzle className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tighter">
              Addons, Servidores & Domínios (África & Angola)
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
              Adicione addons externos por link manifest.json • Infraestrutura Luanda & SADC • Codecs H.264/HEVC/AAC
            </p>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-sm font-semibold flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl border bg-red-500/10 border-red-500/30 text-red-300 text-sm font-semibold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Add / Manage Addons Section */}
      <div className="bg-[#161a22] border border-[#2d3139] rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#7b5be4]" />
              Gestor de Addons ({activeAddonsCount} Ativos / {addons.length} Instalados)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Adicione qualquer addon compatível via URL (<code className="text-[#a78bfa]">https://.../manifest.json</code> ou <code className="text-[#a78bfa]">stremio://...</code>).
              {isAdmin && ' Alterações feitas pelo administrador sincronizam automaticamente para todos os utilizadores.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {addons.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-[#2d3139] text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  Sincronizar
                </button>
                <button
                  type="button"
                  onClick={handleUninstallAll}
                  className="px-3 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Desinstalar Todos
                </button>
              </>
            )}
          </div>
        </div>

        {/* Add Addon Form */}
        <form onSubmit={handleInstallAddon} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            required
            value={addonUrlInput}
            onChange={(e) => setAddonUrlInput(e.target.value)}
            placeholder="Cole o URL do Addon (ex: https://exemplo.com/manifest.json ou stremio://...)"
            className="flex-1 bg-[#0c0d10] border border-[#2d3139] focus:border-[#7b5be4] rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder:text-slate-500 outline-none"
          />
          <button
            type="submit"
            disabled={isInstalling}
            className="px-5 py-3 bg-[#7b5be4] hover:bg-[#8e74eb] disabled:opacity-60 text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#7b5be4]/25 transition-all shrink-0"
          >
            {isInstalling ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                A instalar...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Adicionar Addon
              </>
            )}
          </button>
        </form>

        {/* Installed Addons List or Clean Empty State */}
        {addons.length === 0 ? (
          <div className="p-6 bg-[#0c0d10] border border-dashed border-[#2d3139] rounded-2xl text-center space-y-2">
            <p className="text-sm font-bold text-white">
              Nenhum addon pré-instalado (0 ativos)
            </p>
            <p className="text-xs text-slate-400">
              A plataforma inicia limpa. Use o campo "Adicionar Addon" acima sempre que desejar instalar um novo addon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {addons.map((addon) => (
              <div
                key={addon.transportUrl}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                  addon.enabled
                    ? 'bg-[#0c0d10] border-[#7b5be4]/40'
                    : 'bg-[#0c0d10]/60 border-[#2d3139] opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#161a22] border border-[#2d3139] flex items-center justify-center overflow-hidden shrink-0">
                      {addon.manifest.logo ? (
                        <img
                          src={addon.manifest.logo}
                          alt={addon.manifest.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Puzzle className="w-5 h-5 text-[#7b5be4]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-white truncate">{addon.manifest.name}</h3>
                        <span className="px-1.5 py-0.5 bg-white/5 text-slate-400 text-[9px] font-mono rounded">
                          v{addon.manifest.version || '1.0'}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                            addon.enabled
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {addon.enabled ? 'Ativo' : 'Desativado'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {addon.manifest.description || addon.transportUrl}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono truncate mt-1">
                        {addon.transportUrl}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleAddon(addon.transportUrl)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                        addon.enabled
                          ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {addon.enabled ? 'Desativar' : 'Ativar'}
                    </button>

                    {(addon.manifest.catalogs?.length || 0) > 0 && addon.enabled && (
                      <button
                        type="button"
                        onClick={() => handleExploreCatalog(addon)}
                        className="px-3 py-1.5 bg-[#7b5be4]/20 hover:bg-[#7b5be4] text-[#a78bfa] hover:text-white border border-[#7b5be4]/40 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        Explorar Catálogo
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUninstallAddon(addon.transportUrl, addon.manifest.name)}
                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg border border-red-500/25 transition-all"
                    title="Desinstalar addon"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Explored Addon Catalog Results */}
        {exploringAddonId && (
          <div className="pt-4 border-t border-[#2d3139] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Conteúdo do Addon ({exploredItems.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setExploringAddonId(null);
                  setExploredItems([]);
                }}
                className="text-xs text-slate-400 hover:text-white font-bold"
              >
                Fechar Catálogo
              </button>
            </div>

            {isLoadingCatalog ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-[#0c0d10] rounded-2xl animate-pulse border border-[#2d3139]" />
                ))}
              </div>
            ) : exploredItems.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-5">
                {exploredItems.map((item) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    onClick={(m) => onSelectMedia && onSelectMedia(m)}
                    isInWatchlist={isInWatchlist(item.id)}
                    onToggleWatchlist={onToggleWatchlist || (() => {})}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Nenhum título devolvido por este catálogo.</p>
            )}
          </div>
        )}
      </div>

      {/* Dedicated Media Storage & Streaming Domain Banner */}
      <div className="bg-gradient-to-r from-[#161a22] via-[#121c24] to-[#161a22] border border-emerald-500/35 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Domínio de Armazenamento & Streaming de Filmes
              </h2>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase rounded-full">
                {mediaDomainConfig.streamingEnabled ? 'HTTP 206 Ativo' : 'Pausado'}
              </span>
            </div>
            <p className="text-xs text-[#a78bfa] font-mono font-bold truncate">
              https://{mediaDomainConfig.customDomain}/stream/media/videos/
            </p>
            <p className="text-xs text-slate-400">
              Endpoint na nuvem: <span className="text-slate-200 font-mono">{getRuntimeOrigin()}/stream/media/</span> • {vaultStats.count} ficheiro(s) guardado(s) ({formatBytes(vaultStats.totalBytes)})
            </p>
          </div>
        </div>
        {onOpenDomainManager && (
          <button
            type="button"
            onClick={onOpenDomainManager}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all shrink-0 shadow-lg shadow-emerald-500/20"
          >
            Gerir Domínio & Enviar Filmes
          </button>
        )}
      </div>

      {/* African & Angolan Regional Servers & Domains Section */}
      <div className="bg-[#161a22] border border-[#2d3139] rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Servidores, Domínios & Gateways Compatíveis com África e Angola
              </h2>
              <p className="text-xs text-slate-400">
                Selecione o nó de rede e domínio otimizado para transmissão sem interrupções em território angolano e SADC
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 animate-pulse" /> Rede Ativa
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AFRICAN_REGIONAL_SERVERS.map((srv) => {
            const isSelected = activeServer === srv.id;
            return (
              <div
                key={srv.id}
                onClick={() => {
                  setActiveServer(srv.id);
                  setStatusMsg(`Servidor ativo alterado para: ${srv.name} (${srv.domain})`);
                }}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                  isSelected
                    ? 'bg-[#7b5be4]/10 border-[#7b5be4] shadow-lg shadow-[#7b5be4]/15'
                    : 'bg-[#0c0d10] border-[#2d3139] hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{srv.name}</h3>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 bg-[#7b5be4] text-white text-[9px] font-black uppercase rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#a78bfa] font-mono font-semibold">{srv.domain}</p>
                  </div>
                  <span className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-mono text-emerald-400 shrink-0">
                    {srv.latency}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-white/5 text-slate-400">
                  <span>{srv.region}</span>
                  <span className="text-slate-200 font-bold">{srv.type}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Server Proxy & Codecs Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#161a22] border border-[#2d3139] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm">
              <Server className="w-5 h-5 text-[#7b5be4]" />
              <span>Servidor Media Engine</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                serverHealth?.ok
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {serverHealth?.ok ? 'Online' : 'Offline'}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Proxy HTTPS para Angola e África, otimizado para contornar bloqueios de operadoras locais (UNITEL, MVICO) e garantir reprodução fluida.
          </p>
          <div className="space-y-2 pt-2 border-t border-[#2d3139]/70 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Proxy HTTPS / IPTV HTTP</span>
              <span className="text-emerald-400 font-bold">/api/proxy ativo</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">FFmpeg Remux & H.264/AAC</span>
              <span className="text-emerald-400 font-bold">{serverHealth?.ffmpeg ? 'Pronto' : 'Verificando'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Motores do Reprodutor</span>
              <span className="text-sky-400 font-bold">HLS.js + MPEGTS.js + DASH</span>
            </div>
          </div>
        </div>

        {/* Browser Codec Matrix */}
        <div className="lg:col-span-2 bg-[#161a22] border border-[#2d3139] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-white font-bold text-sm">
              <Cpu className="w-5 h-5 text-[#7b5be4]" />
              <span>Diagnóstico de Codecs & Extensões de Vídeo do Navegador</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Fallback Automático Ativo
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {codecs.map((c) => (
              <div
                key={c.codec}
                className="flex items-center justify-between p-3 rounded-xl bg-[#0c0d10] border border-[#2d3139]"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-white truncate">{c.codec}</p>
                  <p className="text-[10px] text-slate-400 truncate">{c.serverFallback}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${
                    c.supported
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {c.supported ? 'Nativo' : 'Via Servidor'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

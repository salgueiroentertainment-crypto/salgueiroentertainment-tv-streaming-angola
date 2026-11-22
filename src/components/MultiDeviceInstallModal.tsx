import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  Globe,
  Laptop,
  Monitor,
  PlusSquare,
  Share,
  Smartphone,
  Terminal,
  Tv,
  X,
} from 'lucide-react';
import { DetectedPlatformOS, usePWAInstall } from '../hooks/usePWAInstall';

type InstallTabId = 'android' | 'ios' | 'smarttv' | 'windows' | 'macos' | 'linux';

interface MultiDeviceInstallSectionProps {
  onInstalledToast?: (msg: string) => void;
}

const mapOsToTab = (os: DetectedPlatformOS): InstallTabId => {
  if (os === 'smarttv') return 'smarttv';
  if (os === 'ios') return 'ios';
  if (os === 'windows') return 'windows';
  if (os === 'macos') return 'macos';
  if (os === 'linux') return 'linux';
  return 'android';
};

export const MultiDeviceInstallSection: React.FC<MultiDeviceInstallSectionProps> = ({
  onInstalledToast,
}) => {
  const { isInstallable, isInstalled, detectedOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<InstallTabId>(() => mapOsToTab(detectedOS));
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://salgueirostreaming.ao';

  const handleNativeInstall = async () => {
    const ok = await install();
    if (ok) {
      onInstalledToast?.('Aplicação Salgueiro instalada com sucesso neste dispositivo!');
    }
  };

  const triggerDownload = (url: string, label: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', '');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onInstalledToast?.(`Download iniciado: ${label}`);
  };

  const handleCopyUrl = () => {
    navigator.clipboard?.writeText(currentOrigin);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
    onInstalledToast?.('Endereço da plataforma copiado!');
  };

  const platforms: Array<{
    id: InstallTabId;
    label: string;
    badge: string;
    icon: React.FC<{ className?: string }>;
  }> = [
    { id: 'smarttv', label: 'Smart TV', badge: 'Tizen / webOS / Android TV', icon: Tv },
    { id: 'android', label: 'Android / APK', badge: 'Telemóvel & Tablet', icon: Smartphone },
    { id: 'ios', label: 'iPhone / iPad', badge: 'iOS Safari & Perfil', icon: Smartphone },
    { id: 'windows', label: 'Windows (.exe)', badge: 'PC & Portátil', icon: Monitor },
    { id: 'macos', label: 'macOS', badge: 'MacBook & iMac', icon: Laptop },
    { id: 'linux', label: 'Linux', badge: '.desktop / Ubuntu', icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      {/* Native One-Click Banner when Chromium/Edge/Android prompt is ready */}
      {isInstallable && !isInstalled && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#7b5be4]/25 via-[#161a22] to-emerald-500/20 border border-[#7b5be4]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> Instalação Instantânea Disponível
            </div>
            <h4 className="text-sm sm:text-base font-black text-white">
              Instalar Salgueiro Streaming diretamente neste dispositivo
            </h4>
            <p className="text-xs text-slate-300">
              Cria ícone nativo no ecrã inicial / ambiente de trabalho com arranque em ecrã inteiro.
            </p>
          </div>
          <button
            type="button"
            onClick={handleNativeInstall}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Instalar App Agora</span>
          </button>
        </div>
      )}

      {isInstalled && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/35 text-xs text-emerald-300 font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Este dispositivo já está a executar a aplicação Salgueiro instalada em modo standalone!</span>
        </div>
      )}

      {/* Platform Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {platforms.map((p) => {
          const Icon = p.icon;
          const isActive = activeTab === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1.5 ${
                isActive
                  ? 'bg-[#7b5be4]/20 border-[#7b5be4] text-white shadow-lg shadow-[#7b5be4]/15'
                  : 'bg-[#0c0d10] border-[#2d3139] text-slate-400 hover:text-white hover:border-slate-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#a78bfa]' : 'text-slate-400'}`} />
              <span className="text-xs font-black text-white leading-tight">{p.label}</span>
              <span className="text-[10px] text-slate-400 leading-tight truncate">{p.badge}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="p-5 sm:p-6 bg-[#0c0d10] border border-[#2d3139] rounded-2xl space-y-5">
        {activeTab === 'smarttv' && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <Tv className="w-5 h-5 text-amber-400" />
                  Smart TV (Samsung Tizen, LG webOS, Android TV &amp; TV Box)
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Compatível com Smart TVs com navegador web, Android TV / Google TV / Fire Stick e leitores IPTV de TV.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#161a22] border border-[#2d3139] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Endereço para abrir no Navegador da Smart TV
                </span>
                <p className="text-xs font-mono text-emerald-300 truncate mt-0.5">{currentOrigin}</p>
              </div>
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedUrl ? 'Copiado!' : 'Copiar Link'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
              <div className="p-3.5 rounded-xl bg-[#161a22]/70 border border-white/5 space-y-1.5">
                <p className="font-black text-white">1. Samsung Tizen / LG webOS</p>
                <p className="text-slate-400 leading-relaxed">
                  Abra o navegador da TV, introduza <span className="text-white font-mono">{currentOrigin}</span> e selecione{' '}
                  <strong>Adicionar aos Favoritos / Ecrã Inicial da TV</strong>.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#161a22]/70 border border-white/5 space-y-1.5">
                <p className="font-black text-white">2. Android TV / Google TV / Fire TV</p>
                <p className="text-slate-400 leading-relaxed">
                  Instale via Chrome / TV Bro (<strong>Instalar App WebAPK</strong>) ou importe a lista oficial de canais ao vivo diretamente para o leitor IPTV da TV.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="px-4 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar App na TV (Android TV)
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/tv-playlist?origin=${encodeURIComponent(currentOrigin)}`,
                    'Lista Smart TV (.m3u)'
                  )
                }
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar Lista Smart TV (.m3u)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'android' && (
          <div className="space-y-4">
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-400" />
              Android (Telemóvel, Tablet &amp; APK WebApp)
            </h4>
            <p className="text-xs text-slate-400">
              No Android, o Google Chrome e Microsoft Edge criam um aplicativo nativo (<strong>WebAPK</strong>) com ícone próprio no menu de aplicações, notificações e reprodução em ecrã inteiro.
            </p>

            <div className="space-y-2.5 bg-[#161a22] p-4 rounded-xl border border-[#2d3139] text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0">1</span>
                <span>Toque em <strong>Instalar App Android (WebAPK)</strong> abaixo ou abra o menu <strong>⋮</strong> do Chrome e escolha <strong>Instalar aplicação</strong>.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 font-black flex items-center justify-center shrink-0">2</span>
                <span>Para instalar em caixas Android / TV Box sem Play Store, pode também descarregar o lançador portátil offline para Android.</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar App Android (WebAPK)
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/android-launcher?origin=${encodeURIComponent(currentOrigin)}`,
                    'Lançador Android Salgueiro'
                  )
                }
                className="px-4 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar Pacote / Atalho Android (.html)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ios' && (
          <div className="space-y-4">
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-sky-400" />
              iOS (iPhone &amp; iPad)
            </h4>
            <p className="text-xs text-slate-400">
              Escolha entre a instalação rápida pelo <strong>Safari</strong> ou descarregue o perfil oficial Apple (<code>.mobileconfig</code>) para adicionar o ícone Salgueiro ao Ecrã Principal em ecrã inteiro.
            </p>

            <div className="space-y-2.5 bg-[#161a22] p-4 rounded-xl border border-[#2d3139] text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-[#7b5be4]/20 text-[#a78bfa] font-black flex items-center justify-center shrink-0">1</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  No Safari, toque em <strong>Partilhar</strong> <Share className="w-4 h-4 text-[#7b5be4] inline" />
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-[#7b5be4]/20 text-[#a78bfa] font-black flex items-center justify-center shrink-0">2</span>
                <span className="flex items-center gap-1.5 flex-wrap">
                  Selecione <strong>Adicionar ao Ecrã Principal</strong> <PlusSquare className="w-4 h-4 text-[#7b5be4] inline" /> e toque em <strong>Adicionar</strong>.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/ios-mobileconfig?origin=${encodeURIComponent(currentOrigin)}`,
                    'Perfil iOS (.mobileconfig)'
                  )
                }
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Instalar via Perfil iOS (.mobileconfig)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'windows' && (
          <div className="space-y-4">
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <Monitor className="w-5 h-5 text-sky-400" />
              Windows 10 / 11 (.exe / Aplicação Desktop)
            </h4>
            <p className="text-xs text-slate-400">
              Instale a plataforma como aplicação Windows dedicada no Menu Iniciar e Ambiente de Trabalho — sem barras do navegador.
            </p>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#2d3139] text-xs text-slate-300 space-y-2">
              <p>• <strong>Opção 1 (Automática Edge / Chrome):</strong> Clique no botão abaixo ou no ícone de instalação na barra de endereço.</p>
              <p>• <strong>Opção 2 (Instalador / Atalho Windows):</strong> Descarregue e execute o ficheiro <code>Instalar-Salgueiro-Streaming-Windows.cmd</code> que cria automaticamente o atalho no Ambiente de Trabalho e abre a aplicação.</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar App Windows Agora
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/desktop-launcher?os=windows&origin=${encodeURIComponent(currentOrigin)}`,
                    'Instalador Windows (.cmd)'
                  )
                }
                className="px-4 py-2.5 bg-sky-500 hover:bg-sky-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar Instalador Windows (.cmd)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'macos' && (
          <div className="space-y-4">
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <Laptop className="w-5 h-5 text-slate-200" />
              macOS (MacBook, iMac &amp; Mac Mini)
            </h4>
            <p className="text-xs text-slate-400">
              Execute a plataforma diretamente da Dock do macOS no Safari (macOS Sonoma+) ou Google Chrome, ou utilize o executável <code>.command</code>.
            </p>

            <div className="p-4 rounded-xl bg-[#161a22] border border-[#2d3139] text-xs text-slate-300 space-y-2">
              <p>• <strong>No Safari:</strong> Menu <strong>Ficheiro → Adicionar à Dock...</strong></p>
              <p>• <strong>No Chrome / Edge:</strong> Clique no botão abaixo ou descarregue o lançador macOS (<code>.command</code>).</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar App macOS
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/desktop-launcher?os=mac&origin=${encodeURIComponent(currentOrigin)}`,
                    'Lançador macOS (.command)'
                  )
                }
                className="px-4 py-2.5 bg-white hover:bg-slate-200 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar App Launcher macOS (.command)
              </button>
            </div>
          </div>
        )}

        {activeTab === 'linux' && (
          <div className="space-y-4">
            <h4 className="text-base font-black text-white flex items-center gap-2">
              <Terminal className="w-5 h-5 text-amber-400" />
              Linux (Ubuntu, Debian, Fedora, Arch &amp; Mint)
            </h4>
            <p className="text-xs text-slate-400">
              Instale via Chromium/Chrome PWA ou descarregue o ficheiro padrão <code>.desktop</code> para o menu de aplicações Linux (<code>~/.local/share/applications/</code>).
            </p>

            <div className="flex flex-wrap gap-2.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={handleNativeInstall}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Instalar App Linux
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `/api/install/desktop-launcher?os=linux&origin=${encodeURIComponent(currentOrigin)}`,
                    'Atalho Linux (.desktop)'
                  )
                }
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-xl flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descarregar Lançador Linux (.desktop)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface MultiDeviceInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalledToast?: (msg: string) => void;
}

export const MultiDeviceInstallModal: React.FC<MultiDeviceInstallModalProps> = ({
  isOpen,
  onClose,
  onInstalledToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[205] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#161a22] border border-[#2d3139] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-[#2d3139] flex items-center justify-between gap-4 bg-[#0c0d10]/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#7b5be4]/20 border border-[#7b5be4]/40 text-[#a78bfa]">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-tight">
                Instalar Salgueiro em Todos os Dispositivos
              </h2>
              <p className="text-[11px] text-slate-400">
                Smart TV • Android / APK • iPhone / iPad (iOS) • Windows • macOS • Linux
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <MultiDeviceInstallSection onInstalledToast={onInstalledToast} />
        </div>
      </div>
    </div>
  );
};

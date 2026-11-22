import React, { useState, useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share, PlusSquare, Tv } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { MultiDeviceInstallModal } from './MultiDeviceInstallModal';

interface PWAInstallPromptProps {
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({
  externalOpen = false,
  onExternalClose,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showMultiDeviceModal, setShowMultiDeviceModal] = useState(false);
  const [installToastMsg, setInstallToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (externalOpen) {
      setShowMultiDeviceModal(true);
    }
  }, [externalOpen]);

  useEffect(() => {
    const hasDismissed = localStorage.getItem('salgueiro_pwa_dismissed');
    if (!isInstalled && !hasDismissed) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  const showToast = (msg: string) => {
    setInstallToastMsg(msg);
    setTimeout(() => setInstallToastMsg(null), 4000);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (isInstallable) {
      const success = await install();
      if (success) {
        setShowBanner(false);
        showToast('Aplicação Salgueiro instalada com sucesso no seu dispositivo!');
        return;
      }
    }
    // Fallback for Smart TV / Desktop Firefox / Safari / Linux -> open full Multi-Device Install Center
    setShowBanner(false);
    setShowMultiDeviceModal(true);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('salgueiro_pwa_dismissed', 'true');
  };

  const closeMultiDeviceModal = () => {
    setShowMultiDeviceModal(false);
    onExternalClose?.();
  };

  return (
    <>
      {/* Offline Connectivity Toast */}
      {!isOnline && (
        <div className="fixed bottom-6 left-6 z-[100] bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs animate-slide-in-right">
          <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
          <span>Modo Offline — A utilizar dados guardados em cache.</span>
        </div>
      )}

      {/* Installation Toast */}
      {installToastMsg && (
        <div className="fixed bottom-6 right-6 z-[120] bg-emerald-500 text-white font-bold px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{installToastMsg}</span>
        </div>
      )}

      {/* Automatic Floating Install Invitation Banner */}
      {showBanner && !isInstalled && (
        <div className="fixed bottom-6 right-6 z-[90] max-w-sm w-[calc(100vw-3rem)] bg-[#161a22] border-2 border-[#7b5be4] rounded-3xl p-5 shadow-2xl shadow-[#7b5be4]/20 animate-fade-in space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#7b5be4] to-[#38bdf8] flex items-center justify-center text-white font-black shadow-lg">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Instalar Aplicação</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  TV • Android APK • iOS • PC • Mac • Linux
                </p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-slate-500 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Instale no seu telemóvel, Smart TV, Windows, macOS ou Linux para acesso rápido em ecrã inteiro.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#7b5be4]/30 flex items-center justify-center gap-2 active:scale-95"
              >
                <Download className="w-4 h-4" />
                Instalar Agora
              </button>
              <button
                onClick={handleDismiss}
                className="px-3.5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all"
              >
                Depois
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowBanner(false);
                setShowMultiDeviceModal(true);
              }}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-200 text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <Tv className="w-3.5 h-3.5 text-[#a78bfa]" />
              Escolher Dispositivo (TV, APK, iOS, Windows, Mac, Linux)
            </button>
          </div>
        </div>
      )}

      {/* iOS Safari Installation Guide Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#161a22] border border-[#2d3139] rounded-[32px] p-6 sm:p-8 space-y-5 shadow-2xl">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#7b5be4]/20 text-[#7b5be4] rounded-2xl flex items-center justify-center mx-auto border border-[#7b5be4]/30">
                <Smartphone className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Instalar no iPhone / iPad</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Safari ou Perfil WebClip iOS</p>
            </div>

            <div className="space-y-4 bg-[#0c0d10] p-4 rounded-2xl border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#7b5be4]/20 text-[#7b5be4] flex items-center justify-center font-black">1</div>
                <div className="flex-1 flex items-center gap-2">
                  <span>Toque no botão de <strong>Partilhar</strong></span>
                  <Share className="w-4 h-4 text-[#7b5be4] inline shrink-0" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#7b5be4]/20 text-[#7b5be4] flex items-center justify-center font-black">2</div>
                <div className="flex-1 flex items-center gap-2">
                  <span>Selecione <strong>Adicionar ao Ecrã Principal</strong></span>
                  <PlusSquare className="w-4 h-4 text-[#7b5be4] inline shrink-0" />
                </div>
              </div>
            </div>

            <a
              href={`/api/install/ios-mobileconfig?origin=${encodeURIComponent(window.location.origin)}`}
              download="Salgueiro-Streaming-iOS.mobileconfig"
              className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Descarregar Perfil iOS (.mobileconfig)
            </a>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <MultiDeviceInstallModal
        isOpen={showMultiDeviceModal}
        onClose={closeMultiDeviceModal}
        onInstalledToast={showToast}
      />
    </>
  );
};

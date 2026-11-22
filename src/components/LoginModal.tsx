import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, ArrowRight, ShieldCheck, Smartphone, Tv, Monitor, Tablet, AlertTriangle, RefreshCw } from 'lucide-react';
import { UserProfile, UserDevice } from '../types/streaming';
import {
  registerCurrentDevice,
  replaceDeviceWithCurrent,
  fetchUserDevicesFromFirestore,
} from '../lib/deviceManager';
import { fetchUserAccountPayment, getDefaultDatesForMonthlyPlan, saveUserAccountPayment } from '../lib/firebase';
import { DEFAULT_ADMIN_AVATAR, DEFAULT_USER_AVATAR } from '../data/avatars';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  onSwitchToRegister: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showDeviceLimitFlow, setShowDeviceLimitFlow] = useState(false);
  const [deviceLimitList, setDeviceLimitList] = useState<UserDevice[]>([]);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    
    // Admin Credentials Check (Primary & Secondary Admin)
    const isAdmin = 
      (email === 'salgueiro.angola@streaming.com' && password === 'Sa05051985') ||
      (email === 'salgueiroentertainment@gmail.com' && password === 'SE05051985');

    const defaults = getDefaultDatesForMonthlyPlan();
    const [existingPayment, remoteDevices] = await Promise.all([
      fetchUserAccountPayment(email).catch(() => null),
      fetchUserDevicesFromFirestore(email).catch(() => []),
    ]);

    if (
      !isAdmin &&
      (existingPayment?.accountActive === false || existingPayment?.paymentStatus === 'Desativado')
    ) {
      setIsSubmitting(false);
      setAuthError(
        'Esta conta está desativada pelo administrador. Contacte a Linha de Atendimento (+244 923742598).'
      );
      return;
    }

    const loggedUser: UserProfile = {
      email,
      name: isAdmin ? 'Administrador Salgueiro' : (existingPayment?.name || email.split('@')[0]),
      role: isAdmin ? 'admin' : 'user',
      avatarUrl: isAdmin 
        ? DEFAULT_ADMIN_AVATAR
        : (existingPayment?.avatarUrl || DEFAULT_USER_AVATAR),
      accountActive: isAdmin ? true : existingPayment?.accountActive !== false,
      planName: existingPayment?.planName || (isAdmin ? 'Plano Administrador Ilimitado' : 'Pacote Mensal Completo (4K UHD + TV ao Vivo)'),
      monthlyPrice: existingPayment?.monthlyPrice || (isAdmin ? 'Isento (Admin)' : '5.000 Kz / mês'),
      paymentDate: existingPayment?.paymentDate || defaults.paymentDate,
      expirationDate: existingPayment?.expirationDate || defaults.expirationDate,
      paymentStatus: existingPayment?.paymentStatus || 'Ativo',
      paymentMethod: existingPayment?.paymentMethod || 'Multicaixa Express',
    };

    if (!existingPayment) {
      saveUserAccountPayment(loggedUser).catch(() => {});
    }

    // Check device registration limit (Max 4 devices per account) & admin device lock
    setTimeout(() => {
      setIsSubmitting(false);
      if (isAdmin || (email && password)) {
        const deviceCheck = registerCurrentDevice(
          email,
          remoteDevices.length > 0 ? remoteDevices : undefined
        );

        if (!isAdmin && deviceCheck.deviceDisabled) {
          setAuthError(
            'Este dispositivo foi desativado pelo administrador. Solicite a reativação ou aceda noutro dispositivo autorizado.'
          );
          return;
        }

        if (deviceCheck.limitReached) {
          setPendingUser(loggedUser);
          setDeviceLimitList(deviceCheck.devices);
          setShowDeviceLimitFlow(true);
          return;
        }

        loggedUser.devices = deviceCheck.devices;
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onLoginSuccess(loggedUser);
          onClose();
        }, 1200);
      }
    }, 600);
  };

  const handleReplaceDevice = (deviceIdToReplace: string) => {
    if (!pendingUser) return;
    setIsSubmitting(true);
    const updatedDevices = replaceDeviceWithCurrent(
      pendingUser.email,
      deviceIdToReplace,
      deviceLimitList
    );
    pendingUser.devices = updatedDevices;

    setTimeout(() => {
      setIsSubmitting(false);
      setShowDeviceLimitFlow(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onLoginSuccess(pendingUser);
        onClose();
      }, 1200);
    }, 600);
  };

  const renderDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile': return <Smartphone className="w-5 h-5 text-sky-400" />;
      case 'tv': return <Tv className="w-5 h-5 text-amber-400" />;
      case 'tablet': return <Tablet className="w-5 h-5 text-emerald-400" />;
      default: return <Monitor className="w-5 h-5 text-[#7b5be4]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#161a22] border border-[#2d3139] rounded-[32px] overflow-hidden shadow-2xl">
        {/* Header decoration */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#38bdf8] to-[#7b5be4]" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 sm:p-10">
          {showDeviceLimitFlow ? (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 text-amber-500">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">
                  Limite de 4 Dispositivos Atingido
                </h2>
                <p className="text-slate-400 text-xs">
                  A sua conta já atingiu o máximo de <span className="text-white font-bold">4 dispositivos</span> autorizados. Escolha qual pretende desconectar para aceder neste dispositivo:
                </p>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto no-scrollbar">
                {deviceLimitList.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-3.5 bg-[#0c0d10] border border-[#2d3139] hover:border-[#7b5be4] rounded-2xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        {renderDeviceIcon(dev.type)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate">{dev.name}</h4>
                        <p className="text-[10px] text-slate-500 truncate">
                          {dev.browserOrOs} • {dev.lastActive}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleReplaceDevice(dev.id)}
                      className="px-3 py-2 bg-[#7b5be4] hover:bg-[#8e74eb] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shrink-0 active:scale-95 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Substituir
                    </button>
                  </div>
                ))}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDeviceLimitFlow(false)}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Voltar ao Login
                </button>
              </div>
            </div>
          ) : !success ? (
            <div className="space-y-8">
              <div className="space-y-2 text-center">
                <div className="w-16 h-16 bg-[#7b5be4]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <LogIn className="w-8 h-8 text-[#7b5be4]" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">Entrar</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Aceda à sua conta Salgueiro Streaming</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {authError && (
                  <div className="p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-xs font-semibold text-red-300 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mail ou Número de Telefone</label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                    <input 
                      type="text" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@exemplo.com ou +244 923 000 000"
                      className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[#7b5be4] focus:ring-4 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Palavra-passe</label>
                    <button type="button" className="text-[9px] font-black uppercase tracking-widest text-[#7b5be4] hover:underline">Esqueceu-se?</button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-[#7b5be4] focus:ring-4 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#7b5be4] hover:bg-[#8b6bf5] text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-[#7b5be4]/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Entrar na Plataforma
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <div className="text-center">
                <p className="text-xs text-slate-500">
                  Não tem uma conta?{' '}
                  <button 
                    onClick={onSwitchToRegister}
                    className="text-[#7b5be4] font-bold hover:underline"
                  >
                    Registe-se agora
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="py-12 space-y-6 text-center animate-scale-up">
              <div className={`w-20 h-20 ${
                (email === 'salgueiro.angola@streaming.com' || email === 'salgueiroentertainment@gmail.com') ? 'bg-[#7b5be4]/20' : 'bg-emerald-500/10'
              } rounded-full flex items-center justify-center mx-auto ring-4 ${
                (email === 'salgueiro.angola@streaming.com' || email === 'salgueiroentertainment@gmail.com') ? 'ring-[#7b5be4]/30' : 'ring-emerald-500/20'
              }`}>
                {(email === 'salgueiro.angola@streaming.com' || email === 'salgueiroentertainment@gmail.com') ? (
                  <ShieldCheck className="w-10 h-10 text-[#7b5be4]" />
                ) : (
                  <ShieldCheck className="w-10 h-10 text-emerald-500" />
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase">
                  {(email === 'salgueiro.angola@streaming.com' || email === 'salgueiroentertainment@gmail.com') ? 'Acesso Admin' : 'Bem-vindo!'}
                </h2>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                  {(email === 'salgueiro.angola@streaming.com' || email === 'salgueiroentertainment@gmail.com') ? 'Sessão administrativa iniciada' : 'Sua sessão foi iniciada.'}
                </p>
              </div>
              <p className="text-slate-500 text-xs">Preparando o seu catálogo personalizado...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

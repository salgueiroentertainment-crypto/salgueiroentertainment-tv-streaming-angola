import React, { useState } from 'react';
import { X, Mail, Phone, Lock, User, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { UserProfile } from '../types/streaming';
import { registerCurrentDevice } from '../lib/deviceManager';
import {
  getDefaultDatesForMonthlyPlan,
  saveUserAccountPayment,
  formatFirebaseAuthError,
} from '../lib/firebase';
import { PRESET_AVATARS } from '../data/avatars';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterSuccess?: (user: UserProfile) => void;
}

export const RegistrationModal: React.FC<RegistrationModalProps> = ({ isOpen, onClose, onRegisterSuccess }) => {
  const [registerMethod, setRegisterMethod] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(PRESET_AVATARS[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();
      const contactId = registerMethod === 'phone' ? cleanPhone : cleanEmail;

      if (registerMethod === 'email' && password.length < 6) {
        setErrorMessage('A palavra-passe deve ter pelo menos 6 caracteres.');
        setIsSubmitting(false);
        return;
      }

      if (registerMethod === 'phone' && cleanPhone.replace(/\D/g, '').length < 9) {
        setErrorMessage('Insira um número de telefone válido (ex: +244 923 000 000).');
        setIsSubmitting(false);
        return;
      }

      const regDevice = registerCurrentDevice(contactId);
      const { paymentDate, expirationDate } = getDefaultDatesForMonthlyPlan();

      const newUser: UserProfile = {
        email: contactId,
        phone: registerMethod === 'phone' ? cleanPhone : undefined,
        name: name.trim() || (registerMethod === 'phone' ? cleanPhone : cleanEmail.split('@')[0]),
        role: 'user',
        avatarUrl,
        accountActive: true,
        emailVerified: true,
        phoneVerified: registerMethod === 'phone',
        devices: regDevice.devices,
        planName: 'Pacote Mensal Completo (4K UHD + TV ao Vivo)',
        monthlyPrice: '5.000 Kz / mês',
        paymentDate,
        expirationDate,
        paymentStatus: 'Ativo',
        paymentMethod: 'Multicaixa Express',
      };

      await saveUserAccountPayment(newUser).catch(() => {});

      setIsSubmitting(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onRegisterSuccess) onRegisterSuccess(newUser);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(formatFirebaseAuthError(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-[370px] bg-[#161a22] border border-[#2d3139] rounded-2xl overflow-hidden shadow-2xl my-2">
        {/* Header decoration */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#7b5be4] to-[#38bdf8]" />

        <button
          onClick={onClose}
          aria-label="Fechar registo"
          className="absolute top-3.5 right-3.5 p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5">
          {!success ? (
            <div className="space-y-3.5">
              <div className="space-y-1 text-center">
                <div className="w-11 h-11 bg-[#93c5fd]/20 rounded-xl flex items-center justify-center mx-auto mb-1.5 overflow-hidden border-2 border-[#7b5be4]/30">
                  <img src={avatarUrl} alt="Avatar Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tighter uppercase">Criar Conta</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Escolha o avatar e registe-se</p>
              </div>

              {errorMessage && (
                <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-[11px] text-red-300 leading-snug">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-2.5">
                {/* Avatar Selection Picker */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Escolher Avatar</label>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    {PRESET_AVATARS.map((av, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => setAvatarUrl(av)}
                        className={`w-10 h-10 rounded-full overflow-hidden border-2 bg-[#92c5ff] transition-all ${
                          avatarUrl === av ? 'border-[#7b5be4] scale-110 shadow-md shadow-[#7b5be4]/30' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={av} alt={`Avatar ${idx + 1}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Nome Completo</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#7b5be4] focus:ring-2 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                {/* Registration Method Selector: Email or Phone Number */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Registar com E-mail ou Telefone
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-[#0c0d10] border border-[#2d3139] rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRegisterMethod('email')}
                      className={`py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        registerMethod === 'email'
                          ? 'bg-[#7b5be4] text-white shadow-md shadow-[#7b5be4]/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mail className="w-3 h-3" />
                      E-mail
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegisterMethod('phone')}
                      className={`py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                        registerMethod === 'phone'
                          ? 'bg-[#7b5be4] text-white shadow-md shadow-[#7b5be4]/25'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Phone className="w-3 h-3" />
                      Telefone
                    </button>
                  </div>
                </div>

                {registerMethod === 'email' ? (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Endereço de E-mail</label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="exemplo@salgueiro.ao"
                        className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#7b5be4] focus:ring-2 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Número de Telefone</label>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                      <input
                        type="tel"
                        required
                        minLength={7}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+244 923 000 000"
                        className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#7b5be4] focus:ring-2 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Palavra-passe</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#7b5be4] transition-colors" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#0c0d10] border border-[#2d3139] rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-[#7b5be4] focus:ring-2 focus:ring-[#7b5be4]/10 transition-all placeholder:text-slate-600"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#7b5be4] hover:bg-[#8b6bf5] text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-[#7b5be4]/20 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Finalizar Registro
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>

              <p className="text-[9px] text-center text-slate-500 leading-snug px-2">
                Ao registrar-se, concorda com os <span className="text-slate-300 underline cursor-pointer">Termos de Serviço</span>.
              </p>
            </div>
          ) : (
            <div className="py-6 space-y-3 text-center animate-scale-up">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/20">
                <ShieldCheck className="w-7 h-7 text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-black text-white tracking-tighter uppercase">Sucesso!</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Conta criada com sucesso.</p>
              </div>
              <p className="text-slate-500 text-[11px]">Entrando na plataforma...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

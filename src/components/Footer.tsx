import React from 'react';

interface FooterProps {
  appTitle: string;
}

export const Footer: React.FC<FooterProps> = ({ appTitle }) => {
  return (
    <footer className="mt-20 border-t border-[var(--theme-border)] bg-[var(--theme-surface-alt)] py-12 px-4 sm:px-6 lg:px-8 text-xs text-[var(--theme-muted)] transition-colors duration-300">
      <div className="max-w-[1600px] mx-auto space-y-8 pt-8">
        {/* Logo and Slogan */}
        <div className="flex flex-col items-center justify-center space-y-1">
          <div className="text-xl font-black tracking-tight font-sans flex flex-col items-center justify-center gap-1 select-none">
            <div className="flex items-center gap-2">
              <span className="text-red-500 leading-none">SALGUEIRO</span>
              <span className="text-white leading-none">STREAMING</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-slate-300 text-xs font-bold tracking-wider normal-case leading-none">Online TV</span>
              <span className="bg-white text-black px-2 py-0.5 rounded text-xs font-black leading-none uppercase">ANGOLA</span>
            </div>
          </div>
          <p className="text-xs text-[var(--theme-muted)] pt-1">
            TV ao vivo e milhares de filmes em 4K UHD inclusos na sua assinatura.
          </p>
        </div>

        {/* Links Navigation */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[var(--theme-muted)] text-xs font-medium">
          <a href="#termos" className="hover:text-[var(--theme-accent)] transition-colors">Termos e Notificações de Privacidade</a>
          <a href="#ajuda" className="hover:text-[var(--theme-accent)] transition-colors">Ajuda</a>
          <a href="#feedback" className="hover:text-[var(--theme-accent)] transition-colors">Enviar Feedback</a>
          <a href="#dispositivos" className="hover:text-[var(--theme-accent)] transition-colors">Dispositivos Compatíveis</a>
        </div>

        {/* Platform Info & Copyright */}
        <div className="text-center text-[11px] text-slate-500 pt-4 border-t border-[var(--theme-border)] space-y-1.5">
          <p className="text-slate-300 font-semibold">Informações da Plataforma ({appTitle})</p>
          <p className="text-slate-300 font-medium">Criado por Salgueiro Araujo</p>
          <p className="text-[var(--theme-accent)] font-bold">
            Linha de atendimento :{' '}
            <a href="tel:+244923742598" className="hover:underline">
              +244 923742598
            </a>
          </p>
          <p>© 2026 Salgueiro Streaming Angola e Transmissões ao Vivo S.A. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

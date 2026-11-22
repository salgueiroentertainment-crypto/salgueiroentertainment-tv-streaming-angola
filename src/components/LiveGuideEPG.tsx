import React, { useState } from 'react';
import { Play, Clock, Info, Tv, Filter, ChevronRight, Check } from 'lucide-react';
import { LiveChannel, EPGProgram } from '../types/streaming';

interface LiveGuideEPGProps {
  channels: LiveChannel[];
  onPlayChannel: (channel: LiveChannel) => void;
}

export const LiveGuideEPG: React.FC<LiveGuideEPGProps> = ({
  channels,
  onPlayChannel,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedProgram, setSelectedProgram] = useState<{
    channel: LiveChannel;
    program: EPGProgram;
  } | null>(null);

  const categories = ['Todos', 'Esportes', 'Notícias', 'Filmes & Séries', 'Variedades', 'Infantil'];

  const filteredChannels = selectedCategory === 'Todos'
    ? channels
    : channels.filter((c) => c.category === selectedCategory);

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">
      {/* Title & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Guia de TV ao Vivo (EPG)
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Programação em tempo real de canais abertos e por assinatura sem custo adicional no Salgueiro.
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#00a8e1] text-white shadow-md'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Program Guide Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-[#090e17] shadow-2xl">
        {/* Timeline Header */}
        <div className="grid grid-cols-12 bg-slate-900 border-b border-slate-800 text-xs font-semibold text-slate-300 py-3 px-4">
          <div className="col-span-12 sm:col-span-3 flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#7b5be4]" />
            <span>Canal</span>
          </div>
          <div className="hidden sm:grid col-span-9 grid-cols-3 gap-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#00a8e1]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>Agora (Em Exibição)</span>
            </div>
            <div className="text-slate-400">Próximo Horário</div>
            <div className="text-slate-400">Em Seguida</div>
          </div>
        </div>

        {/* Channels Rows */}
        <div className="divide-y divide-slate-800/80">
          {filteredChannels.map((channel) => (
            <div
              key={channel.id}
              className="grid grid-cols-12 items-center p-3 sm:p-4 hover:bg-slate-900/60 transition-colors gap-3"
            >
              {/* Channel Info Left */}
              <div className="col-span-12 sm:col-span-3 flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-10 rounded-lg bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    {channel.logo.startsWith('/') || channel.logo.startsWith('http') ? (
                      <img
                        src={channel.logo}
                        alt={channel.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-xl">{channel.logo}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-[#00a8e1]">
                        {channel.channelNumber}
                      </span>
                      <h3 className="text-sm font-bold text-white line-clamp-1">{channel.name}</h3>
                    </div>
                    <span className="text-[11px] text-slate-400">{channel.category}</span>
                  </div>
                </div>

                {/* Sintonizar Button */}
                <button
                  onClick={() => onPlayChannel(channel)}
                  className="sm:hidden px-3 py-1 bg-[#00a8e1] hover:bg-[#0090c2] text-white rounded text-xs font-bold flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Assistir</span>
                </button>
              </div>

              {/* Programs Columns */}
              <div className="col-span-12 sm:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {channel.schedule.map((prog, idx) => (
                  <div
                    key={prog.id}
                    onClick={() => {
                      if (prog.isLiveNow) {
                        onPlayChannel(channel);
                      } else {
                        setSelectedProgram({ channel, program: prog });
                      }
                    }}
                    className={`relative p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                      prog.isLiveNow
                        ? 'bg-slate-800/90 border-[#00a8e1] shadow-[0_0_15px_rgba(0,168,225,0.15)] hover:border-[#38bdf8]'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono text-slate-300">
                        {prog.startTime} - {prog.endTime}
                      </span>
                      {prog.isLiveNow ? (
                        <span className="px-1.5 py-0.2 bg-red-600 text-white text-[9px] font-bold rounded uppercase">
                          No Ar
                        </span>
                      ) : (
                        <span className="px-1 py-0.2 bg-slate-800 text-slate-400 text-[9px] rounded font-mono">
                          {prog.rating}
                        </span>
                      )}
                    </div>

                    <h4 className="text-xs font-semibold text-white line-clamp-1">
                      {prog.title}
                    </h4>

                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {prog.description}
                    </p>

                    {prog.isLiveNow && (
                      <div className="mt-2 flex items-center justify-between">
                        <div className="w-2/3 bg-slate-700 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-[#00a8e1] h-full rounded-full"
                            style={{ width: `${channel.progressPercentage}%` }}
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPlayChannel(channel);
                          }}
                          className="text-[11px] text-[#00a8e1] font-bold hover:underline flex items-center gap-0.5"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Assistir</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Program Details Modal if clicked on future show */}
      {selectedProgram && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#00a8e1]">
                {selectedProgram.channel.name} • Canal {selectedProgram.channel.channelNumber}
              </span>
              <button
                onClick={() => setSelectedProgram(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ Fechar
              </button>
            </div>

            <h3 className="text-xl font-bold text-white">{selectedProgram.program.title}</h3>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Horário: {selectedProgram.program.startTime} às {selectedProgram.program.endTime}</span>
              <span>·</span>
              <span className="font-bold text-slate-300">Classificação: {selectedProgram.program.rating}</span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              {selectedProgram.program.description}
            </p>

            <div className="pt-2 flex items-center justify-between border-t border-slate-800">
              <span className="text-xs text-slate-400">Lembrete ativado no seu perfil</span>
              <button
                onClick={() => {
                  onPlayChannel(selectedProgram.channel);
                  setSelectedProgram(null);
                }}
                className="px-4 py-2 bg-[#00a8e1] hover:bg-[#0090c2] text-white font-bold rounded-lg text-xs flex items-center gap-2"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Sintonizar Canal Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';

import { Usuario } from '@/lib/types';
import { formatarBRL } from '@/lib/money';

interface PainelCasalPendenteProps {
  usuario: Usuario;
  usuarioEsposa: Usuario | null;
  mesVoce: string | null;
  mesEsposa: string | null;
  liquidoVoce: number;
  liquidoEsposa: number;
  onVerVoce: () => void;
  onVerEsposa: () => void;
  onIrContracheque: () => void;
}

export default function PainelCasalPendente({
  usuario,
  usuarioEsposa,
  mesVoce,
  mesEsposa,
  liquidoVoce,
  liquidoEsposa,
  onVerVoce,
  onVerEsposa,
  onIrContracheque,
}: PainelCasalPendenteProps) {
  const nomeEsposa = usuarioEsposa?.nome || 'Parceiro(a)';
  const primeiroNomeEsposa = nomeEsposa.split(' ')[0];

  return (
    <div className="bg-slate-900/80 border border-amber-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden space-y-6">
      {/* Glow de Alerta no Fundo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full filter blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full filter blur-[80px] pointer-events-none" />

      {/* Header com Ícone de Bloqueio e Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-amber-500/10">
            🔒
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Painel Consolidado do Casal Travado
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                Sincronização Pendente
              </span>
            </div>
            <p className="text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              Para garantir a <strong>governança financeira e evitar projeções ilusórias</strong>, o painel conjunto do casal só consolida números quando ambos os cônjuges estiverem no <strong>mesmo mês de referência ativo</strong> e com seus rendimentos e dívidas cadastrados.
            </p>
          </div>
        </div>
      </div>

      {/* Diagnóstico de Paridade Lado a Lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
        
        {/* Card Usuário Ativo (Você) */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">👤</span>
              <span className="font-bold text-white text-base">Você ({usuario.nome})</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span>●</span> Mês Atualizado
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Holerite Ativo:</span>
              <span className="font-bold text-white">{mesVoce || 'Não cadastrado'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Salário Líquido:</span>
              <span className="font-mono font-bold text-emerald-400">
                R$ {formatarBRL(liquidoVoce)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Status dos Contratos:</span>
              <span className="text-slate-200 font-medium">Contratos mapeados em folha</span>
            </div>
          </div>

          <button
            onClick={onVerVoce}
            className="w-full mt-3 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
          >
            <span>👁️</span> Ver Apenas Meu Painel Individual
          </button>
        </div>

        {/* Card Parceiro(a) (Priscila) */}
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💑</span>
              <span className="font-bold text-white text-base">{nomeEsposa}</span>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <span>▲</span> Pendente de Atualização
            </span>
          </div>

          <div className="space-y-2 text-xs text-slate-300 pt-2 border-t border-white/5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Último Holerite:</span>
              <span className="font-bold text-amber-300">{mesEsposa || 'Não cadastrado'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Salário Líquido Cadastrado:</span>
              <span className="font-mono font-bold text-slate-300">
                R$ {formatarBRL(liquidoEsposa)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Pendências de Envio:</span>
              <span className="text-amber-400 font-bold">Holerites recentes, faturas & contratos</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={onVerEsposa}
              className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>🔍</span> Ver Perfil {primeiroNomeEsposa}
            </button>
            <button
              onClick={onIrContracheque}
              className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20 active:scale-95 cursor-pointer"
            >
              <span>📄</span> Enviar Holerite
            </button>
          </div>
        </div>

      </div>

      {/* Mensagem Explicativa de Rigor Contábil */}
      <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-4 text-xs text-slate-400 flex items-start gap-3 relative z-10">
        <span className="text-base flex-shrink-0">💡</span>
        <p className="leading-relaxed">
          <strong className="text-slate-200">Por que o painel conjunto fica travado?</strong> Se somássemos o seu salário de {mesVoce || 'mês atual'} com o holerite de {mesEsposa || 'mês passado'} da {primeiroNomeEsposa}, o sistema criaria um superávit ou déficit fictício que não reflete a realidade do mês. Assim que os dados pendentes forem cadastrados, o painel do casal é ativado automaticamente.
        </p>
      </div>
    </div>
  );
}

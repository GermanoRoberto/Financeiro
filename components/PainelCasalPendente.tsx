'use client';

import React, { useState } from 'react';
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
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  const nomeEsposa = usuarioEsposa?.nome || 'Parceiro(a)';
  const primeiroNomeEsposa = nomeEsposa.split(' ')[0];
  const nomeVoce = usuario.nome || 'Você';
  const primeiroNomeVoce = nomeVoce.split(' ')[0];

  return (
    <div className="bg-gradient-to-r from-amber-950/40 via-slate-900/80 to-blue-950/40 border border-amber-500/30 rounded-3xl p-5 sm:p-6 backdrop-blur-xl shadow-xl relative overflow-hidden space-y-4">
      {/* Glow de fundo */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full filter blur-[70px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/10 rounded-full filter blur-[70px] pointer-events-none" />

      {/* Banner Superior Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl flex-shrink-0 shadow-md">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Reconciliação Contínua do Casal
              </h3>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Meses Divergentes (Estimativa Ativa)
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              O painel conjunto está <strong>totalmente liberado</strong> com base nos últimos contracheques cadastrados ({primeiroNomeVoce}: <span className="text-blue-300 font-semibold">{mesVoce || 'N/D'}</span> | {primeiroNomeEsposa}: <span className="text-purple-300 font-semibold">{mesEsposa || 'N/D'}</span>).
            </p>
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
          <button
            onClick={onIrContracheque}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>📄</span>
            <span>Atualizar Holerite de {primeiroNomeEsposa}</span>
          </button>
          <button
            onClick={() => setDetalhesAbertos(!detalhesAbertos)}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-all flex items-center gap-1"
          >
            <span>{detalhesAbertos ? 'Ocultar' : 'Comparar'}</span>
            <span className="transform transition-transform text-[10px]" style={{ display: 'inline-block', transform: detalhesAbertos ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </button>
        </div>
      </div>

      {/* Detalhamento Expansível Lado a Lado */}
      {detalhesAbertos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/10 relative z-10 animate-fadeIn">
          {/* Card Usuário */}
          <div className="bg-slate-950/60 border border-blue-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">👤</span>
                <span className="font-bold text-white text-sm">{nomeVoce}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {mesVoce || 'Sem holerite'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="text-slate-400">Salário Líquido:</span>
              <span className="font-mono font-bold text-emerald-400">
                R$ {formatarBRL(liquidoVoce)}
              </span>
            </div>
            <button
              onClick={onVerVoce}
              className="w-full mt-2 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span>👁️</span> Ver Visão Individual de {primeiroNomeVoce}
            </button>
          </div>

          {/* Card Parceira */}
          <div className="bg-slate-950/60 border border-purple-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">👩</span>
                <span className="font-bold text-white text-sm">{nomeEsposa}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {mesEsposa || 'Sem holerite'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-300">
              <span className="text-slate-400">Salário Líquido:</span>
              <span className="font-mono font-bold text-emerald-400">
                R$ {formatarBRL(liquidoEsposa)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={onVerEsposa}
                className="py-2 px-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
              >
                <span>🔍</span> Ver {primeiroNomeEsposa}
              </button>
              <button
                onClick={onIrContracheque}
                className="py-2 px-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
              >
                <span>📤</span> Subir Holerite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

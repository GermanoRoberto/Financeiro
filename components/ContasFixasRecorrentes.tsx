'use client';

import React, { useMemo } from 'react';
import { GastoDiario } from '@/lib/types';
import { formatarBRL, somarValores } from '@/lib/money';

interface ContasFixasProps {
  gastos: GastoDiario[];
  mesReferencia?: string; // YYYY-MM
}

interface ItemContaFixa {
  id: string;
  nome: string;
  categoria: string;
  icone: string;
  valorEstimado: number;
  diaVencimento: number;
  termosIdentificacao: string[];
}

const CONTAS_FIXAS_PADRAO: ItemContaFixa[] = [
  {
    id: 'energia_cemig',
    nome: 'Energia Elétrica (CEMIG)',
    categoria: 'Utilidades',
    icone: '⚡',
    valorEstimado: 180.0,
    diaVencimento: 15,
    termosIdentificacao: ['cemig', 'energia', 'luz'],
  },
  {
    id: 'agua_copasa',
    nome: 'Água e Saneamento (COPASA)',
    categoria: 'Utilidades',
    icone: '💧',
    valorEstimado: 90.0,
    diaVencimento: 20,
    termosIdentificacao: ['copasa', 'agua', 'saneamento'],
  },
  {
    id: 'internet_fibra',
    nome: 'Internet Fibra / Banda Larga',
    categoria: 'Telecom',
    icone: '🌐',
    valorEstimado: 110.0,
    diaVencimento: 10,
    termosIdentificacao: ['internet', 'fibra', 'telecom', 'claro', 'vivo'],
  },
  {
    id: 'streaming_globoplay',
    nome: 'Globoplay',
    categoria: 'Assinaturas',
    icone: '📺',
    valorEstimado: 22.9,
    diaVencimento: 5,
    termosIdentificacao: ['globo globoplay', 'globoplay'],
  },
  {
    id: 'streaming_netflix',
    nome: 'Netflix',
    categoria: 'Assinaturas',
    icone: '🎬',
    valorEstimado: 20.9,
    diaVencimento: 6,
    termosIdentificacao: ['netflix.com', 'netflix'],
  },
];

export default function ContasFixasRecorrentes({
  gastos,
  mesReferencia,
}: ContasFixasProps) {
  // Mês de referência atual caso não seja passado
  const mesAtivo = useMemo(() => {
    if (mesReferencia && mesReferencia.length >= 7) return mesReferencia.substring(0, 7);
    return new Date().toISOString().substring(0, 7);
  }, [mesReferencia]);

  const anoMesExtenso = useMemo(() => {
    try {
      const [ano, mes] = mesAtivo.split('-');
      const d = new Date(Number(ano), Number(mes) - 1, 1);
      const str = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return str.charAt(0).toUpperCase() + str.slice(1);
    } catch {
      return mesAtivo;
    }
  }, [mesAtivo]);

  // Gastos do mês de referência
  const gastosMes = useMemo(() => {
    return gastos.filter((g) => (g.data || '').startsWith(mesAtivo));
  }, [gastos, mesAtivo]);

  // Conciliação de cada conta fixa com os gastos reais
  const statusContas = useMemo(() => {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHojeIso = hoje.toISOString().substring(0, 7);
    const ehMesAtual = mesAtivo === mesHojeIso;

    return CONTAS_FIXAS_PADRAO.map((conta) => {
      // Buscar gasto real correspondente no mês
      const gastoEncontrado = gastosMes.find((g) => {
        const desc = (g.estabelecimento || '').toLowerCase();
        return conta.termosIdentificacao.some((termo) => desc.includes(termo));
      });

      const pago = Boolean(gastoEncontrado);
      const valorReal = gastoEncontrado ? gastoEncontrado.valor : conta.valorEstimado;
      const dataPagamento = gastoEncontrado ? gastoEncontrado.data : null;

      // Status de vencimento
      let status: 'pago' | 'atrasado' | 'a_vencer' = 'a_vencer';
      let diasInfo = '';

      if (pago) {
        status = 'pago';
      } else if (ehMesAtual) {
        if (diaHoje > conta.diaVencimento) {
          status = 'atrasado';
          diasInfo = `${diaHoje - conta.diaVencimento} dias de atraso`;
        } else {
          status = 'a_vencer';
          const diff = conta.diaVencimento - diaHoje;
          diasInfo = diff === 0 ? 'Vence hoje!' : `Vence em ${diff} dias`;
        }
      } else {
        // Mês passado sem pagamento identificado
        status = 'atrasado';
        diasInfo = 'Não identificado no extrato';
      }

      return {
        ...conta,
        pago,
        valorReal,
        dataPagamento,
        status,
        diasInfo,
      };
    });
  }, [gastosMes, mesAtivo]);

  // KPIs
  const totalPrevisto = useMemo(
    () => somarValores(statusContas.map((c) => c.valorEstimado)),
    [statusContas]
  );
  const totalQuitado = useMemo(
    () => somarValores(statusContas.filter((c) => c.pago).map((c) => c.valorReal)),
    [statusContas]
  );
  const totalPendente = useMemo(
    () => somarValores(statusContas.filter((c) => !c.pago).map((c) => c.valorEstimado)),
    [statusContas]
  );

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-6 relative overflow-hidden">
      {/* Glow decorativo */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full filter blur-[70px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-xl shadow-inner">
            📅
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Provisionamento de Contas Fixas da Casa
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {anoMesExtenso}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Boletos e compromissos essenciais recorrentes com status de liquidação
            </p>
          </div>
        </div>
      </div>

      {/* Cards de Resumo de Provisão */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        <div className="bg-slate-950/40 border border-white/10 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-slate-400">Total Previsto no Mês</div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono tabular-nums">
            R$ {formatarBRL(totalPrevisto)}
          </div>
          <p className="text-[11px] text-slate-500">{statusContas.length} contas fixas mapeadas</p>
        </div>

        <div className="bg-slate-950/40 border border-emerald-500/20 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
            <span>✓</span> Já Quitado no Extrato
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tabular-nums">
            R$ {formatarBRL(totalQuitado)}
          </div>
          <p className="text-[11px] text-slate-500">
            {statusContas.filter((c) => c.pago).length} contas liquidadas
          </p>
        </div>

        <div className="bg-slate-950/40 border border-amber-500/20 rounded-2xl p-4 space-y-1">
          <div className="text-xs text-amber-400 font-semibold flex items-center gap-1">
            <span>⏳</span> Provisão Necessária Restante
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono tabular-nums">
            R$ {formatarBRL(totalPendente)}
          </div>
          <p className="text-[11px] text-slate-500">
            {statusContas.filter((c) => !c.pago).length} contas a vencer
          </p>
        </div>
      </div>

      {/* Tabela / Lista de Contas Recorrentes */}
      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <th className="pb-3 pr-4">Conta / Concessionária</th>
              <th className="pb-3 pr-4">Categoria</th>
              <th className="pb-3 pr-4">Vencimento</th>
              <th className="pb-3 pr-4">Valor</th>
              <th className="pb-3 pr-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-sm">
            {statusContas.map((c) => (
              <tr key={c.id} className="hover:bg-white/5 transition-colors">
                <td className="py-3.5 pr-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{c.icone}</span>
                    <span className="font-semibold text-white">{c.nome}</span>
                  </div>
                </td>
                <td className="py-3.5 pr-4 text-xs text-slate-400">{c.categoria}</td>
                <td className="py-3.5 pr-4 text-xs font-medium text-slate-300">
                  Dia {c.diaVencimento}
                </td>
                <td className="py-3.5 pr-4 font-mono font-bold text-white tabular-nums">
                  R$ {formatarBRL(c.valorReal)}
                </td>
                <td className="py-3.5 pr-4 text-center">
                  {c.status === 'pago' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span>✓</span> Pago {c.dataPagamento ? `(${new Date(c.dataPagamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })})` : ''}
                    </span>
                  )}
                  {c.status === 'a_vencer' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <span>⏳</span> {c.diasInfo}
                    </span>
                  )}
                  {c.status === 'atrasado' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <span>⚠️</span> {c.diasInfo}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

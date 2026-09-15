'use client';

import React, { useState, useMemo } from 'react';
import { GastoDiario, Usuario } from '@/lib/types';
import { formatarBRL, somarValores } from '@/lib/money';
import toast from 'react-hot-toast';

interface AcertoContasCasalProps {
  gastos: GastoDiario[];
  usuario: Usuario;
  usuarioEsposa: Usuario | null;
}

export default function AcertoContasCasal({
  gastos,
  usuario,
  usuarioEsposa,
}: AcertoContasCasalProps) {
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes_atual' | 'todos'>('mes_atual');
  const [copiado, setCopiado] = useState(false);

  const nomeVoce = usuario.nome || 'Você';
  const primeiroNomeVoce = nomeVoce.split(' ')[0];
  const nomeEsposa = usuarioEsposa?.nome || 'Parceiro(a)';
  const primeiroNomeEsposa = nomeEsposa.split(' ')[0];

  // Identificar mês atual em UTC/ISO (AAAA-MM)
  const mesAtualStr = useMemo(() => {
    const hoje = new Date();
    return hoje.toISOString().substring(0, 7);
  }, []);

  // Filtrar despesas elegíveis para o rateio do casal
  const despesasCasal = useMemo(() => {
    return gastos.filter((g) => {
      // Apenas despesas (desconsidera transferências entre contas e receitas extras)
      const cat = (g.categoria || '').toLowerCase();
      if (cat === 'receita_extra' || cat === 'transferencia') return false;

      // Filtrar por período se selecionado mês atual
      if (periodoFiltro === 'mes_atual') {
        const dataGasto = (g.data || '').substring(0, 7);
        if (dataGasto !== mesAtualStr) return false;
      }

      return true;
    });
  }, [gastos, periodoFiltro, mesAtualStr]);

  // Total pago por cada um
  const totalVoce = useMemo(() => {
    const gastosVoce = despesasCasal.filter((g) => g.usuario_id === usuario.id);
    return somarValores(gastosVoce.map((g) => g.valor || 0));
  }, [despesasCasal, usuario.id]);

  const totalEsposa = useMemo(() => {
    if (!usuarioEsposa) return 0;
    const gastosEsposa = despesasCasal.filter((g) => g.usuario_id === usuarioEsposa.id);
    return somarValores(gastosEsposa.map((g) => g.valor || 0));
  }, [despesasCasal, usuarioEsposa]);

  const totalGeral = totalVoce + totalEsposa;
  const cotaPorPessoa = totalGeral / 2;

  // Cálculo da compensação
  const diferenca = totalVoce - totalEsposa;
  const valorAcerto = Math.abs(diferenca) / 2;

  // Quem deve a quem
  const quemPaga = diferenca > 0 ? primeiroNomeEsposa : primeiroNomeVoce;
  const quemRecebe = diferenca > 0 ? primeiroNomeVoce : primeiroNomeEsposa;
  const estaEquilibrado = Math.round(valorAcerto * 100) === 0;

  // Porcentagens de desembolso
  const pctVoce = totalGeral > 0 ? Math.round((totalVoce / totalGeral) * 100) : 50;
  const pctEsposa = totalGeral > 0 ? 100 - pctVoce : 50;

  const copiarResumoWhatsApp = () => {
    const dataAtual = new Date();
    const nomeMes = dataAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    let texto = `🧾 *Fechamento Financeiro do Casal - ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}*\n\n`;
    texto += `💸 *Total Compartilhado:* R$ ${formatarBRL(totalGeral)}\n`;
    texto += `• ${primeiroNomeVoce} desembolsou: R$ ${formatarBRL(totalVoce)} (${pctVoce}%)\n`;
    texto += `• ${primeiroNomeEsposa} desembolsou: R$ ${formatarBRL(totalEsposa)} (${pctEsposa}%)\n`;
    texto += `⚖️ *Cota justa 50/50:* R$ ${formatarBRL(cotaPorPessoa)} para cada\n\n`;

    if (estaEquilibrado) {
      texto += `✨ *Contas perfeitamente empatadas! Ninguém deve nada a ninguém.* 🎉`;
    } else {
      texto += `👉 *Acerto:* ${quemPaga} transfere *R$ ${formatarBRL(valorAcerto)}* para ${quemRecebe} via Pix para empatar 50/50.`;
    }

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success('Resumo copiado para a área de transferência!');
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-xl relative overflow-hidden space-y-6">
      {/* Glow decorativo sutil */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full filter blur-[70px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full filter blur-[70px] pointer-events-none" />

      {/* Header do Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-xl shadow-inner">
            ⚖️
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Acerto de Contas do Casal
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Divisão 50/50
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Equilíbrio das despesas diárias pagas individualmente
            </p>
          </div>
        </div>

        {/* Seletor de Período e Botão WhatsApp */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-950/70 p-1 rounded-xl border border-white/5 flex items-center">
            <button
              onClick={() => setPeriodoFiltro('mes_atual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodoFiltro === 'mes_atual'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Mês Atual
            </button>
            <button
              onClick={() => setPeriodoFiltro('todos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                periodoFiltro === 'todos'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Histórico
            </button>
          </div>

          <button
            onClick={copiarResumoWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/5"
            title="Copiar resumo para enviar no WhatsApp"
          >
            <span>{copiado ? '✓' : '📋'}</span>
            <span>{copiado ? 'Copiado!' : 'Copiar p/ WhatsApp'}</span>
          </button>
        </div>
      </div>

      {/* Grid de Desembolso Individual */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        {/* Card Você */}
        <div className="bg-slate-950/40 border border-blue-500/20 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              {primeiroNomeVoce} pagou
            </span>
            <span className="font-mono text-blue-400 font-bold">{pctVoce}%</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
            R$ {formatarBRL(totalVoce)}
          </div>
          <p className="text-[11px] text-slate-500">
            {despesasCasal.filter((g) => g.usuario_id === usuario.id).length} lançamentos
          </p>
        </div>

        {/* Card Parceira */}
        <div className="bg-slate-950/40 border border-purple-500/20 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              {primeiroNomeEsposa} pagou
            </span>
            <span className="font-mono text-purple-400 font-bold">{pctEsposa}%</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight">
            R$ {formatarBRL(totalEsposa)}
          </div>
          <p className="text-[11px] text-slate-500">
            {despesasCasal.filter((g) => g.usuario_id === usuarioEsposa?.id).length} lançamentos
          </p>
        </div>

        {/* Card Total e Cota */}
        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Compartilhado</span>
            <span className="text-[10px] text-slate-500 font-mono">Meta: 50% cada</span>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-200 tabular-nums tracking-tight">
            R$ {formatarBRL(totalGeral)}
          </div>
          <p className="text-[11px] text-slate-400">
            Cota justa: <span className="text-white font-mono font-semibold">R$ {formatarBRL(cotaPorPessoa)}</span>
          </p>
        </div>
      </div>

      {/* Barra de Proporção Visual */}
      <div className="space-y-2 relative z-10">
        <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex border border-white/5 p-0.5">
          <div
            style={{ width: `${pctVoce}%` }}
            className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-l-full transition-all duration-500"
            title={`${primeiroNomeVoce}: ${pctVoce}%`}
          />
          <div
            style={{ width: `${pctEsposa}%` }}
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-r-full transition-all duration-500"
            title={`${primeiroNomeEsposa}: ${pctEsposa}%`}
          />
        </div>
        <div className="flex justify-between text-[11px] font-medium text-slate-400 px-1">
          <span className="text-blue-400 flex items-center gap-1">
            ▲ {primeiroNomeVoce} ({pctVoce}%)
          </span>
          <span className="text-purple-400 flex items-center gap-1">
            {primeiroNomeEsposa} ({pctEsposa}%) ▲
          </span>
        </div>
      </div>

      {/* Banner Conclusivo do Acerto (Call to Action) */}
      <div
        className={`rounded-2xl p-4 sm:p-5 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10 transition-all ${
          estaEquilibrado
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border-indigo-500/30 text-white'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
              estaEquilibrado
                ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                : 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
            }`}
          >
            {estaEquilibrado ? '🎉' : '💸'}
          </div>
          <div>
            {estaEquilibrado ? (
              <>
                <h4 className="font-bold text-sm text-emerald-200">
                  Despesas em Equilíbrio Perfeito!
                </h4>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Ambos contribuíram igualmente para os gastos deste período. Nenhum acerto pendente.
                </p>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                  Ajuste Sugerido para Fechar 50/50
                </div>
                <h4 className="font-bold text-base text-white mt-0.5">
                  <span className="text-indigo-400 font-extrabold">{quemPaga}</span> deve transferir{' '}
                  <span className="text-emerald-400 font-mono font-black text-lg">
                    R$ {formatarBRL(valorAcerto)}
                  </span>{' '}
                  para <span className="text-purple-400 font-extrabold">{quemRecebe}</span>
                </h4>
              </>
            )}
          </div>
        </div>

        {!estaEquilibrado && (
          <button
            onClick={copiarResumoWhatsApp}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer whitespace-nowrap"
          >
            Enviar Acerto
          </button>
        )}
      </div>
    </div>
  );
}

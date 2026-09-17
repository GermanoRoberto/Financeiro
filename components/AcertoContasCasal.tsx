'use client';

import React, { useState, useMemo } from 'react';
import { GastoDiario, Usuario, Contracheque, Desconto } from '@/lib/types';
import { formatarBRL, somarValores } from '@/lib/money';
import { isGastoCompartilhado } from '@/lib/gastosUtils';
import toast from 'react-hot-toast';

interface AcertoContasCasalProps {
  gastos: GastoDiario[];
  descontos?: Desconto[];
  contracheques?: Contracheque[];
  usuario: Usuario;
  usuarioEsposa: Usuario | null;
}

export default function AcertoContasCasal({
  gastos,
  descontos = [],
  contracheques = [],
  usuario,
  usuarioEsposa,
}: AcertoContasCasalProps) {
  const nomeVoce = usuario.nome || 'Você';
  const primeiroNomeVoce = nomeVoce.split(' ')[0];
  const nomeEsposa = usuarioEsposa?.nome || 'Parceiro(a)';
  const primeiroNomeEsposa = nomeEsposa.split(' ')[0];

  // Mapear contracheque_id -> contracheque para enriquecer descontos
  const ccMap = useMemo(() => {
    const map = new Map<string, Contracheque>();
    contracheques.forEach((cc) => map.set(cc.id, cc));
    return map;
  }, [contracheques]);

  // Identificar todos os meses disponíveis (tanto em gastos quanto em contracheques)
  const mesesDisponiveis = useMemo(() => {
    const setMeses = new Set<string>();
    gastos.forEach((g) => {
      if (g.data && g.data.length >= 7) setMeses.add(g.data.substring(0, 7));
    });
    contracheques.forEach((c) => {
      if (c.mes_referencia && c.mes_referencia.length >= 7) {
        setMeses.add(c.mes_referencia.substring(0, 7));
      }
    });
    return Array.from(setMeses).sort().reverse();
  }, [gastos, contracheques]);

  // Identificar o mês mais recente onde ambos possuem lançamentos ou contracheques
  const mesParidadePadrao = useMemo(() => {
    for (const mes of mesesDisponiveis) {
      const temCcVoce = contracheques.some(
        (c) => c.usuario_id === usuario.id && (c.mes_referencia || '').startsWith(mes)
      );
      const temCcEsposa = usuarioEsposa
        ? contracheques.some(
            (c) => c.usuario_id === usuarioEsposa.id && (c.mes_referencia || '').startsWith(mes)
          )
        : false;

      const temGastoVoce = gastos.some(
        (g) =>
          (g.data || '').startsWith(mes) &&
          g.usuario_id === usuario.id &&
          g.categoria !== 'receita_extra' &&
          g.categoria !== 'transferencia'
      );
      const temGastoEsposa = usuarioEsposa
        ? gastos.some(
            (g) =>
              (g.data || '').startsWith(mes) &&
              g.usuario_id === usuarioEsposa.id &&
              g.categoria !== 'receita_extra' &&
              g.categoria !== 'transferencia'
          )
        : false;

      if ((temCcVoce || temGastoVoce) && (temCcEsposa || temGastoEsposa)) {
        return mes;
      }
    }
    return mesesDisponiveis[0] || 'todos';
  }, [mesesDisponiveis, contracheques, gastos, usuario.id, usuarioEsposa]);

  const [periodoFiltro, setPeriodoFiltro] = useState<string>(mesParidadePadrao || 'todos');
  const [copiado, setCopiado] = useState(false);

  // Formatar nome do mês selecionado
  const formatarMesLabel = (mesIso: string) => {
    if (mesIso === 'todos') return 'Histórico Consolidado';
    try {
      const [ano, mes] = mesIso.split('-');
      const d = new Date(Number(ano), Number(mes) - 1, 1);
      const nome = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return nome.charAt(0).toUpperCase() + nome.slice(1);
    } catch {
      return mesIso;
    }
  };

  // 1. DESCONTOS EM FOLHA (Consignados, empréstimos, planos de saúde) do período
  const { totalFolhaVoce, totalFolhaEsposa } = useMemo(() => {
    const folhaVoce: Desconto[] = [];
    const folhaEsposa: Desconto[] = [];

    descontos.forEach((d) => {
      const cc = ccMap.get(d.contracheque_id) || (d as any).contracheque;
      if (!cc) return;

      const ccMes = (cc.mes_referencia || '').substring(0, 7);
      if (periodoFiltro !== 'todos' && ccMes !== periodoFiltro) return;

      const userId = cc.usuario_id;
      if (userId === usuario.id) {
        folhaVoce.push(d);
      } else if (usuarioEsposa && userId === usuarioEsposa.id) {
        folhaEsposa.push(d);
      }
    });

    return {
      totalFolhaVoce: somarValores(folhaVoce.map((d) => d.valor || 0)),
      totalFolhaEsposa: somarValores(folhaEsposa.map((d) => d.valor || 0)),
    };
  }, [descontos, ccMap, periodoFiltro, usuario.id, usuarioEsposa]);

  // 2. GASTOS DIÁRIOS (Extratos e contas correntes) do período
  const {
    totalCompartilhadoVoce,
    totalCompartilhadoEsposa,
    totalPessoalVoce,
    totalPessoalEsposa,
  } = useMemo(() => {
    const despesasPeriodo = gastos.filter((g) => {
      const cat = (g.categoria || '').toLowerCase();
      if (cat === 'receita_extra' || cat === 'transferencia') return false;

      if (periodoFiltro !== 'todos') {
        const dataGasto = (g.data || '').substring(0, 7);
        if (dataGasto !== periodoFiltro) return false;
      }
      return true;
    });

    const gVoce = despesasPeriodo.filter((g) => g.usuario_id === usuario.id);
    const gEsposa = usuarioEsposa ? despesasPeriodo.filter((g) => g.usuario_id === usuarioEsposa.id) : [];

    const compVoce = gVoce.filter(isGastoCompartilhado);
    const compEsposa = gEsposa.filter(isGastoCompartilhado);

    const pessVoce = gVoce.filter((g) => !isGastoCompartilhado(g));
    const pessEsposa = gEsposa.filter((g) => !isGastoCompartilhado(g));

    return {
      totalCompartilhadoVoce: somarValores(compVoce.map((g) => g.valor || 0)),
      totalCompartilhadoEsposa: somarValores(compEsposa.map((g) => g.valor || 0)),
      totalPessoalVoce: somarValores(pessVoce.map((g) => g.valor || 0)),
      totalPessoalEsposa: somarValores(pessEsposa.map((g) => g.valor || 0)),
    };
  }, [gastos, periodoFiltro, usuario.id, usuarioEsposa]);

  // 3. DESEMBOLSO COMPARTILHADO (O que entra no rateio 50/50: Folha + Despesas da Casa)
  const totalVoce = totalFolhaVoce + totalCompartilhadoVoce;
  const totalEsposa = totalFolhaEsposa + totalCompartilhadoEsposa;
  const totalGeral = totalVoce + totalEsposa;
  const cotaPorPessoa = totalGeral / 2;

  // Cálculo da compensação
  const diferenca = totalVoce - totalEsposa;
  const valorAcerto = Math.abs(diferenca) / 2;

  const estaEquilibrado = Math.round(valorAcerto * 100) === 0;

  // Porcentagens
  const pctVoce = totalGeral > 0 ? Math.round((totalVoce / totalGeral) * 100) : 50;
  const pctEsposa = totalGeral > 0 ? 100 - pctVoce : 50;

  // Verificação de assimetria de dados no período
  const temAssimetriaExtrato =
    (totalVoce === 0 && totalEsposa > 0) || (totalEsposa === 0 && totalVoce > 0);

  const parceiroSemDados = totalVoce === 0 ? primeiroNomeVoce : primeiroNomeEsposa;
  const parceiroComDados = totalVoce === 0 ? primeiroNomeEsposa : primeiroNomeVoce;

  const copiarResumoWhatsApp = () => {
    const nomeMes = formatarMesLabel(periodoFiltro);

    let texto = `🧾 *Fechamento Financeiro Integrado do Casal - ${nomeMes}*\n\n`;
    texto += `💸 *Total Compartilhado da Casa:* R$ ${formatarBRL(totalGeral)}\n\n`;
    texto += `• *${primeiroNomeVoce}* bancou para a casa: R$ ${formatarBRL(totalVoce)} (${pctVoce}%)\n`;
    texto += `  - Retido em folha (consignados/saúde): R$ ${formatarBRL(totalFolhaVoce)}\n`;
    texto += `  - Despesas da casa (cartões/contas): R$ ${formatarBRL(totalCompartilhadoVoce)}\n`;
    if (totalPessoalVoce > 0) {
      texto += `  - (Compras pessoais individuais: R$ ${formatarBRL(totalPessoalVoce)})\n`;
    }
    texto += `\n• *${primeiroNomeEsposa}* bancou para a casa: R$ ${formatarBRL(totalEsposa)} (${pctEsposa}%)\n`;
    texto += `  - Retido em folha (consignados/saúde): R$ ${formatarBRL(totalFolhaEsposa)}\n`;
    texto += `  - Despesas da casa (cartões/contas): R$ ${formatarBRL(totalCompartilhadoEsposa)}\n`;
    if (totalPessoalEsposa > 0) {
      texto += `  - (Compras pessoais individuais: R$ ${formatarBRL(totalPessoalEsposa)})\n`;
    }
    texto += `\n⚖️ *Cota de referência 50/50 da casa:* R$ ${formatarBRL(cotaPorPessoa)} para cada\n\n`;

    if (estaEquilibrado) {
      texto += `✨ *Contas da casa em equilíbrio!* 🎉`;
    } else {
      texto += `📊 *Balanço das Despesas Conjuntas:* Diferença de R$ ${formatarBRL(valorAcerto)} na partilha (${pctVoce}% ${primeiroNomeVoce} / ${pctEsposa}% ${primeiroNomeEsposa}).`;
    }

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success('Relatório analítico copiado com sucesso!');
    setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800/90 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-xl relative overflow-hidden space-y-6">
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
              Acerto Financeiro Integrado do Casal
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Folha + Despesas da Casa (50/50)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Consolida retenções em folha e despesas essenciais compartilhadas (exclui compras pessoais exclusivas)
            </p>
          </div>
        </div>

        {/* Seletor Dinâmico de Mês e Botão WhatsApp */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-white/10 rounded-xl px-2.5 py-1.5">
            <span className="text-xs text-slate-400 font-medium">Mês:</span>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value)}
              aria-label="Selecionar Mês de Referência"
              className="bg-transparent text-xs font-bold text-indigo-300 focus:outline-none cursor-pointer"
            >
              {mesesDisponiveis.map((mes) => (
                <option key={mes} value={mes} className="bg-slate-900 text-white">
                  {formatarMesLabel(mes)}
                </option>
              ))}
              <option value="todos" className="bg-slate-900 text-white">
                Histórico Geral (Todos)
              </option>
            </select>
          </div>

          {!temAssimetriaExtrato && (
            <button
              onClick={copiarResumoWhatsApp}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/5"
              title="Copiar resumo completo para WhatsApp"
            >
              <span>{copiado ? '✓' : '📋'}</span>
              <span>{copiado ? 'Copiado!' : 'Copiar p/ WhatsApp'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid de Desembolso Individual Detalhado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        {/* Card Você */}
        <div className="bg-slate-950/50 border border-blue-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              {primeiroNomeVoce}
            </span>
            <span className="font-mono text-blue-400 font-bold">{pctVoce}%</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalVoce)}
          </div>

          {/* Subtotais Transparentes: Folha vs Casa vs Pessoal */}
          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">📄 Retido em Folha:</span>
              <span className="font-mono font-semibold text-amber-300">
                R$ {formatarBRL(totalFolhaVoce)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">🏠 Despesas da Casa:</span>
              <span className="font-mono font-semibold text-blue-300">
                R$ {formatarBRL(totalCompartilhadoVoce)}
              </span>
            </div>
            {totalPessoalVoce > 0 && (
              <div className="flex justify-between items-center text-slate-400 text-[11px] pt-0.5 border-t border-white/5">
                <span className="text-slate-500">👤 Pessoal (individual):</span>
                <span className="font-mono text-slate-400">
                  R$ {formatarBRL(totalPessoalVoce)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card Parceira */}
        <div className="bg-slate-950/50 border border-purple-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              {primeiroNomeEsposa}
            </span>
            <span className="font-mono text-purple-400 font-bold">{pctEsposa}%</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalEsposa)}
          </div>

          {/* Subtotais Transparentes: Folha vs Casa vs Pessoal */}
          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">📄 Retida em Folha:</span>
              <span className="font-mono font-semibold text-amber-300">
                R$ {formatarBRL(totalFolhaEsposa)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">🏠 Despesas da Casa:</span>
              <span className="font-mono font-semibold text-purple-300">
                R$ {formatarBRL(totalCompartilhadoEsposa)}
              </span>
            </div>
            {totalPessoalEsposa > 0 && (
              <div className="flex justify-between items-center text-slate-400 text-[11px] pt-0.5 border-t border-white/5">
                <span className="text-slate-500">👤 Pessoal (individual):</span>
                <span className="font-mono text-slate-400">
                  R$ {formatarBRL(totalPessoalEsposa)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Card Total e Cota 50/50 */}
        <div className="bg-slate-950/50 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-white">Total Conjunto</span>
            <span className="text-xs text-slate-400 font-mono">50% para cada</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-200 tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalGeral)}
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">⚖️ Cota Justa (50%):</span>
              <span className="font-mono font-bold text-white">
                R$ {formatarBRL(cotaPorPessoa)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400 text-[11px]">
              <span>Base consolidada do período</span>
              <span className="text-slate-300 font-medium">{formatarMesLabel(periodoFiltro)}</span>
            </div>
          </div>
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
        <div className="flex justify-between text-xs font-medium text-slate-400 px-1">
          <span className="text-blue-400 flex items-center gap-1 font-semibold">
            ▲ {primeiroNomeVoce} ({pctVoce}%)
          </span>
          <span className="text-purple-400 flex items-center gap-1 font-semibold">
            {primeiroNomeEsposa} ({pctEsposa}%) ▲
          </span>
        </div>
      </div>

      {/* Banner de Conclusão / Compensação Justa */}
      {temAssimetriaExtrato ? (
        <div className="rounded-2xl p-4 sm:p-5 border bg-amber-500/10 border-amber-500/30 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-amber-500/20 border border-amber-500/40 text-amber-300">
              ⏳
            </div>
            <div>
              <h4 className="font-bold text-sm text-amber-200">
                Aguardando Lançamentos de {parceiroSemDados} ({formatarMesLabel(periodoFiltro)})
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5 max-w-2xl leading-relaxed">
                {parceiroComDados} possui desembolsos computados neste período, mas {parceiroSemDados} ainda não possui holerite ou extratos cadastrados. O acerto final só é emitido quando ambos tiverem seus dados importados.
              </p>
            </div>
          </div>
        </div>
      ) : (
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
                    Despesas e Folha em Equilíbrio Perfeito!
                  </h4>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    Ambos contribuíram igualmente para as despesas e retenções deste período. Nenhum acerto pendente.
                  </p>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                    Balanço da Partilha Conjunta ({formatarMesLabel(periodoFiltro)})
                  </div>
                  <h4 className="font-bold text-base text-white mt-0.5">
                    Diferença líquida de rateio da casa:{' '}
                    <span className="text-emerald-400 font-mono font-black text-lg">
                      R$ {formatarBRL(valorAcerto)}
                    </span>
                    <span className="text-xs font-normal text-slate-300 block sm:inline sm:ml-2">
                      ({primeiroNomeVoce}: {pctVoce}% | {primeiroNomeEsposa}: {pctEsposa}%)
                    </span>
                  </h4>
                </>
              )}
            </div>
          </div>

          <button
            onClick={copiarResumoWhatsApp}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-500/30 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
          >
            📋 Copiar Relatório Analítico
          </button>
        </div>
      )}
    </div>
  );
}

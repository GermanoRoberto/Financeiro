'use client';

import React, { useState, useMemo } from 'react';
import { GastoDiario, Usuario, Contracheque, Desconto } from '@/lib/types';
import { formatarBRL, somarValores } from '@/lib/money';
import { isGastoCompartilhado, isDescontoCompartilhavel } from '@/lib/gastosUtils';
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

      // Excluir encargos tributários e previdenciários legais (INSS, IRRF, FPM)
      if (!isDescontoCompartilhavel(d.tipo)) return;

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

  // 3. DESEMBOLSOS REGISTRADOS
  const totalVoce = totalFolhaVoce + totalCompartilhadoVoce;
  const totalEsposa = totalFolhaEsposa + totalCompartilhadoEsposa;
  const totalGeral = totalVoce + totalEsposa;

  const copiarResumoWhatsApp = () => {
    const nomeMes = formatarMesLabel(periodoFiltro);

    let texto = `🧾 *Consolidação Financeira do Casal - ${nomeMes}*\n\n`;
    texto += `• *${primeiroNomeVoce}* (Lançamentos Registrados): R$ ${formatarBRL(totalVoce)}\n`;
    texto += `  - Retido em folha (empréstimos/saúde): R$ ${formatarBRL(totalFolhaVoce)}\n`;
    texto += `  - Despesas da casa identificadas: R$ ${formatarBRL(totalCompartilhadoVoce)}\n`;
    if (totalPessoalVoce > 0) {
      texto += `  - Compras particulares individuais: R$ ${formatarBRL(totalPessoalVoce)}\n`;
    }
    texto += `\n• *${primeiroNomeEsposa}* (Lançamentos Registrados): R$ ${formatarBRL(totalEsposa)}\n`;
    texto += `  - Retido em folha (empréstimo CEF): R$ ${formatarBRL(totalFolhaEsposa)}\n`;
    texto += `  - Despesas da casa identificadas: R$ ${formatarBRL(totalCompartilhadoEsposa)}\n`;
    if (totalPessoalEsposa > 0) {
      texto += `  - Compras particulares individuais: R$ ${formatarBRL(totalPessoalEsposa)}\n`;
    }
    texto += `\n⚠️ *Nota de Integridade:* O financiamento do apartamento (pago por ${primeiroNomeEsposa}) ainda não foi cadastrado no sistema. Por haver assimetria de dados, divisões de 50/50 estão desabilitadas para não gerar cálculos distorcidos.`;

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success('Extrato consolidado copiado com sucesso!');
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
            📋
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Consolidação Financeira do Casal
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Lançamentos Registrados
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Demonstrativo dos valores, contas e empréstimos efetivamente lançados no sistema
            </p>
          </div>
        </div>

        {/* Seletor Dinâmico de Mês */}
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
        </div>
      </div>

      {/* Grid de Desembolso Individual Registrado */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        {/* Card Você */}
        <div className="bg-slate-950/50 border border-blue-500/20 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              {primeiroNomeVoce}
            </span>
            <span className="text-[11px] font-medium text-slate-400">Lançamentos Registrados</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalVoce)}
          </div>

          {/* Subtotais Transparentes */}
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
            <span className="text-[11px] font-medium text-slate-400">Lançamentos Registrados</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-white tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalEsposa)}
          </div>

          {/* Subtotais Transparentes */}
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

        {/* Card Total Lançado no Período */}
        <div className="bg-slate-950/50 border border-white/10 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-white">Total Lançado no Mês</span>
            <span className="text-xs text-slate-400 font-mono">{formatarMesLabel(periodoFiltro)}</span>
          </div>

          <div className="text-xl sm:text-2xl font-black text-slate-200 tabular-nums tracking-tight font-mono">
            R$ {formatarBRL(totalGeral)}
          </div>

          <div className="pt-2 border-t border-white/5 space-y-1 text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">👨 {primeiroNomeVoce}:</span>
              <span className="font-mono font-semibold text-blue-300">
                R$ {formatarBRL(totalVoce)}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-400">👩 {primeiroNomeEsposa}:</span>
              <span className="font-mono font-semibold text-purple-300">
                R$ {formatarBRL(totalEsposa)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Banner de Integridade e Esclarecimento de Assimetria */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 text-amber-200 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-amber-500/20 border border-amber-500/40 text-amber-300 mt-0.5 sm:mt-0">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-200">
              Financiamento do Apartamento Pendente de Cadastro por {primeiroNomeEsposa}
            </h4>
            <p className="text-xs text-amber-300/90 leading-relaxed max-w-3xl">
              O financiamento do apartamento é arcado por <strong>{primeiroNomeEsposa}</strong> (titular do contrato), porém <strong>ainda não foi lançado por ela nesta plataforma</strong>. Como <strong>{primeiroNomeVoce}</strong> já possui todos os seus gastos do dia a dia e empréstimos detalhados no sistema, qualquer cálculo de rateio ou divisão 50/50 seria fictício e distorcido. O painel mantém apenas a prestação de contas dos lançamentos reais existentes.
            </p>
          </div>
        </div>

        <button
          onClick={copiarResumoWhatsApp}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-500/30 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 self-stretch sm:self-center"
        >
          <span>{copiado ? '✓ Copiado!' : '📋 Copiar Prestação de Contas'}</span>
        </button>
      </div>
    </div>
  );
}

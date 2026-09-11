'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { GastoDiario, Divida, Contracheque, Desconto, Usuario } from '@/lib/types';
import { round2, somarValores, formatarBRL } from '@/lib/money';

interface EstudoRecuperacaoProps {
  transacoes: GastoDiario[];
  contracheques: Contracheque[];
  descontos: Desconto[];
  dividas: Divida[];
  usuario: Usuario;
  usuarioEsposa: Usuario | null;
  visao: 'casal' | 'voce' | 'esposa';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xl text-slate-800 font-sans text-xs">
        <p className="font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
                {p.name}:
              </span>
              <span className="font-bold font-mono" style={{ color: p.stroke }}>
                R$ {Number(p.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function EstudoRecuperacao({
  transacoes,
  contracheques,
  descontos,
  dividas,
  usuario,
  usuarioEsposa,
  visao
}: EstudoRecuperacaoProps) {
  const [abaInterna, setAbaInterna] = useState<'casal' | 'voce' | 'esposa'>('casal');

  useEffect(() => {
    setAbaInterna(visao);
  }, [visao]);

  // 1. Filtrar contracheques mais recentes com base na aba ativa
  let ccsPerfil: Contracheque[] = [];
  if (abaInterna === 'casal') {
    const ids = Array.from(new Set(contracheques.map(c => c.usuario_id)));
    ccsPerfil = ids
      .map(id => contracheques.find(c => c.usuario_id === id))
      .filter(Boolean) as Contracheque[];
  } else {
    const targetId = abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id;
    const cc = contracheques.find(c => c.usuario_id === targetId);
    if (cc) ccsPerfil = [cc];
  }

  // Receita Líquida real que entra em conta bancária
  const receita = somarValores(ccsPerfil.map(c => c.salario_liquido || 0)) || (abaInterna === 'casal' ? 5476.61 : 2738.30);

  // Descontos em folha do mês atual (já deduzidos na fonte)
  const ccIdsPerfil = new Set(ccsPerfil.map(c => c.id));
  const descontosFolha = descontos.filter(d => {
    const ccId = d.contracheque_id || (d as any).contracheque?.id;
    return ccIdsPerfil.has(ccId);
  });

  // Empréstimos consignados na folha de pagamento
  const emprestimosFolha = descontosFolha.filter(d => {
    const tipoLower = (d.tipo || '').toLowerCase();
    return tipoLower.includes('empréstimo') || tipoLower.includes('consignado') || tipoLower.includes('cef') || tipoLower.includes('crédito trabalhador');
  });
  const totalEmprestimosFolha = somarValores(emprestimosFolha.map(d => d.valor || 0));

  // Dívidas ativas externas (faturas de cartão, empréstimos pessoais externos, carnês que saem do saldo em conta)
  const dividasExternas = dividas.filter(d => {
    if (!d.ativa) return false;
    if (abaInterna === 'casal') return true;
    if (d.usuario_id === null) return true; // conjunta
    return d.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });
  const totalDividasExternas = somarValores(dividasExternas.map(d => d.valor_parcela || 0));

  // Contratos de consignado cadastrados na tabela de dívidas
  const consignadosTabela = dividas.filter(d => {
    if (d.ativa) return false;
    if (abaInterna === 'casal') return true;
    return d.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });
  const totalConsignadosTabela = somarValores(consignadosTabela.map(d => d.valor_parcela || 0));
  const diferencaConsignadoNaoMapeada = Math.max(0, round2(totalEmprestimosFolha - totalConsignadosTabela));

  // Todas as dívidas e contratos deste perfil para auditoria
  const todasDividasPerfil = dividas.filter(d => {
    if (abaInterna === 'casal') return true;
    if (d.usuario_id === null) return true;
    return d.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });
  const maiorDivida = todasDividasPerfil.reduce((max, d) => (d.valor_parcela || 0) > max ? d.valor_parcela : max, 0);

  // Gastos variáveis dos últimos 30 dias
  const transacoesFiltradas = transacoes.filter(g => {
    if (abaInterna === 'casal') return true;
    return g.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });

  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const despesasVariaveisRecentes = transacoesFiltradas.filter(g => {
    const dGasto = new Date(g.data);
    const isDespesa = g.categoria !== 'receita_extra' && g.categoria !== 'transferencia';
    return isDespesa && dGasto >= trintaDiasAtras;
  });
  const totalDespesasVariaveis = somarValores(despesasVariaveisRecentes.map(g => g.valor || 0));
  const despesasVariaveis = totalDespesasVariaveis || (abaInterna === 'casal' ? 1800 : 900);

  // FLUXO DE CAIXA REAL:
  // Salário Líquido que entra na conta - Dívidas Externas (fora da folha) - Gastos Variáveis
  const despesasFixas = totalDividasExternas;
  const sobraAtual = round2(receita - despesasFixas - despesasVariaveis);

  // 2. Projetar 6 meses
  const dadosGrafico: any[] = [];
  let saldoA = sobraAtual < 0 ? sobraAtual * 3 : -1500;
  let saldoB = sobraAtual < 0 ? sobraAtual * 4 : -2500;

  // Encontrar meses de virada
  let mesViradaA = -1;
  let mesViradaB = -1;

  for (let mes = 1; mes <= 6; mes++) {
    // Cenário A: Corte de 15% em gastos variáveis
    const sobraA = round2(receita - despesasFixas - (despesasVariaveis * 0.85));
    saldoA += sobraA;
    if (saldoA >= 0 && mesViradaA === -1) {
      mesViradaA = mes;
    }

    // Cenário B: Sem corte em variáveis, mas com renegociação/quitação da maior parcela no mês 3
    let sobraB = round2(receita - despesasFixas - despesasVariaveis);
    if (mes >= 3 && maiorDivida > 0) {
      sobraB += maiorDivida; // alívio da maior parcela
    }
    saldoB += sobraB;
    if (saldoB >= 0 && mesViradaB === -1) {
      mesViradaB = mes;
    }

    dadosGrafico.push({
      mes: `Mês ${mes}`,
      'Cenário A (Corte)': Math.round(saldoA),
      'Cenário B (Renegociação)': Math.round(saldoB),
    });
  }

  // 3. Gerar Alertas do Rastreador de Recuperação baseados em dados reais da visão selecionada
  const alertas: string[] = [];
  
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const quatorzeDiasAtras = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const despesasSemana1 = transacoesFiltradas.filter(g => {
    const d = new Date(g.data);
    return g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && d >= seteDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  const despesasSemana2 = transacoesFiltradas.filter(g => {
    const d = new Date(g.data);
    return g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && d >= quatorzeDiasAtras && d < seteDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  if (despesasSemana1 < despesasSemana2 && despesasSemana2 > 0) {
    const reducaoPercent = Math.round(((despesasSemana2 - despesasSemana1) / despesasSemana2) * 100);
    alertas.push(`Queda de ${reducaoPercent}% nos gastos variáveis do perfil selecionado na última semana. Ótima evolução!`);
  }

  // Receitas extras recentes
  const receitasExtras = transacoesFiltradas.filter(g => {
    const d = new Date(g.data);
    return g.categoria === 'receita_extra' && d >= trintaDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  if (receitasExtras > 0) {
    alertas.push(`Injeção de receita extra no valor de R$ ${receitasExtras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nos últimos 30 dias.`);
  }

  // Dívidas inativas quitadas no escopo
  const dividasInativas = dividas.filter(d => {
    if (d.ativa) return false;
    if (abaInterna === 'casal') return true;
    return d.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  }).length;

  if (dividasInativas > 0) {
    alertas.push(`Há ${dividasInativas} empréstimo(s) ou consignado(s) em folha já quitados/inativos no histórico.`);
  }

  if (alertas.length === 0) {
    alertas.push("Sem novos alertas de melhora no perfil selecionado. Mantenha os cortes semanais nos supérfluos!");
  }

  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-6 shadow-md">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <span>📈</span> Cenários e Projeção (Estudo de Caminho)
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Análise preditiva real cruzando receitas líquidas, dívidas externas e gastos do dia a dia.
          </p>
        </div>

        {/* Seleção de Aba Interna */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 self-start gap-1">
          <button
            onClick={() => setAbaInterna('casal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              abaInterna === 'casal'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            👥 Casal
          </button>
          <button
            onClick={() => setAbaInterna('voce')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              abaInterna === 'voce'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🙋‍♂️ Você
          </button>
          {usuarioEsposa && (
            <button
              onClick={() => setAbaInterna('esposa')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                abaInterna === 'esposa'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🙋‍♀️ {usuarioEsposa.nome.split(' ')[0]}
            </button>
          )}
        </div>
      </div>

      {/* Raio-X do Fluxo de Caixa Mensal */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
        <div>
          <span className="text-xxs uppercase font-bold text-slate-400 block mb-1">Receita Líquida (Na Conta)</span>
          <span className="text-sm font-bold text-slate-800 font-mono">R$ {formatarBRL(receita)}</span>
        </div>
        <div>
          <span className="text-xxs uppercase font-bold text-slate-400 block mb-1">Dívidas Externas (Fixas)</span>
          <span className="text-sm font-bold text-slate-800 font-mono">R$ {formatarBRL(totalDividasExternas)}</span>
        </div>
        <div>
          <span className="text-xxs uppercase font-bold text-slate-400 block mb-1">Variáveis (Média 30d)</span>
          <span className="text-sm font-bold text-slate-800 font-mono">R$ {formatarBRL(despesasVariaveis)}</span>
        </div>
        <div>
          <span className="text-xxs uppercase font-bold text-slate-400 block mb-1">Saldo Livre Mensal</span>
          <span className={`text-sm font-bold font-mono ${sobraAtual >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {sobraAtual >= 0 ? '+' : ''}R$ {formatarBRL(sobraAtual)}
          </span>
        </div>
      </div>

      {/* Cenários Detalhados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Cenário A */}
        <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-600 text-sm flex items-center gap-1.5">
              <span>🛡️</span> Cenário A (Foco em Sobrevivência)
            </h4>
            <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase">
              Corte de 15%
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Reduzir despesas variáveis em <strong>15%</strong> (Economia mensal de <strong>R$ {formatarBRL(despesasVariaveis * 0.15)}</strong>).
          </p>
          <div className="text-xs font-bold text-slate-500">
            Impacto: {mesViradaA > 0 ? `Sairá do vermelho em até ${mesViradaA * 30} dias.` : 'Tendência de melhora gradual.'}
          </div>
        </div>

        {/* Cenário B */}
        <div className="bg-amber-50/50 border border-amber-100 p-5 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-600 text-sm flex items-center gap-1.5">
              <span>🤝</span> Cenário B (Foco em Renegociação)
            </h4>
            <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase">
              Alívio de Parcela
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {maiorDivida > 0 
              ? <>Renegociar ou quitar a maior parcela identificada neste perfil (alívio de <strong>R$ {formatarBRL(maiorDivida)}/mês</strong> a partir do Mês 3).</>
              : <>Nenhuma dívida ativa para renegociar neste perfil. O foco deve ser corte de custos variáveis.</>}
          </p>
          <div className="text-xs font-bold text-slate-500">
            Impacto: {mesViradaB > 0 ? `Sairá do vermelho no ${mesViradaB}º mês.` : 'Estabilização progressiva.'}
          </div>
        </div>

      </div>

      {/* Gráfico de Projeção */}
      <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-2xl">
        <h4 className="font-bold text-slate-500 text-xs mb-4 uppercase tracking-wider">
          Projeção do Saldo Acumulado ({abaInterna === 'casal' ? 'Casal' : abaInterna === 'voce' ? 'Seu perfil' : `Perfil da ${usuarioEsposa?.nome.split(' ')[0]}`})
        </h4>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="Cenário A (Corte)"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#0946b5' }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="Cenário B (Renegociação)"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={{ r: 4, stroke: '#f59e0b', strokeWidth: 2, fill: '#120436' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rastreador de Alertas */}
      <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl space-y-3 shadow-sm">
        <h4 className="font-bold text-emerald-600 text-sm flex items-center gap-1.5">
          <span>🔔</span> Alertas do Rastreador de Recuperação ({abaInterna === 'casal' ? 'Casal' : abaInterna === 'voce' ? 'Você' : usuarioEsposa?.nome.split(' ')[0]})
        </h4>
        <ul className="space-y-2">
          {alertas.map((alerta, idx) => (
            <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
              <span className="text-emerald-500 mt-0.5">🌱</span>
              <span>{alerta}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Auditoria da Base de Dados & Alerta de Dívidas Incompletas */}
      <div className="bg-amber-50/60 border border-amber-200 p-5 rounded-2xl space-y-3 shadow-sm">
        <h4 className="font-bold text-amber-800 text-sm flex items-center gap-2">
          <span>🔍</span> Auditoria da Base de Dívidas & Completude de Dados
        </h4>
        
        <p className="text-xs text-amber-900 leading-relaxed">
          <strong>Atenção Crítica:</strong> A precisão deste estudo depende 100% do envio de <strong>todas</strong> as dívidas, empréstimos e faturas de cartão de crédito. Se houver contas omitidas ou contratos pendentes de envio, qualquer cenário de recuperação torna-se irreal.
        </p>

        <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 space-y-2 text-xs text-slate-700">
          <div className="font-semibold text-slate-800">
            Status dos contratos cadastrados para {abaInterna === 'casal' ? 'o Casal' : abaInterna === 'voce' ? usuario.nome : usuarioEsposa?.nome}:
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>
              <strong>Contratos de Empréstimo/Consignado:</strong> {consignadosTabela.length} contrato(s) detalhado(s) totalizando R$ {formatarBRL(totalConsignadosTabela)}/mês.
            </li>
            <li>
              <strong>Dívidas Externas / Cartões Ativos:</strong> {dividasExternas.length} dívida(s) totalizando R$ {formatarBRL(totalDividasExternas)}/mês.
            </li>
            {diferencaConsignadoNaoMapeada > 10 && (
              <li className="text-rose-700 font-bold">
                ⚠️ O holerite desconta R$ {formatarBRL(totalEmprestimosFolha)} em empréstimos, mas apenas R$ {formatarBRL(totalConsignadosTabela)} estão cadastrados em contratos. Há <span className="underline">R$ {formatarBRL(diferencaConsignadoNaoMapeada)}/mês</span> de empréstimos sem contratos detalhados!
              </li>
            )}
            {dividasExternas.length === 0 && (
              <li className="text-slate-500 italic">
                Nenhum parcelamento externo ou fatura de cartão de crédito cadastrado manualmente neste perfil.
              </li>
            )}
          </ul>
        </div>

        <div className="text-xxs text-amber-800 font-medium italic">
          💡 Dica: Se faltarem contratos de empréstimo ou cartões, envie os prints ou PDFs no Telegram da Azula para recalcular o estudo com o pé no chão.
        </div>
      </div>

    </div>
  );
}

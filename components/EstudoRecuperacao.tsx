'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { GastoDiario, Divida, Contracheque, Desconto, Usuario } from '@/lib/types';

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
      <div className="bg-slate-950/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl text-white font-sans text-xs">
        <p className="font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
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

  // 1. Filtrar dados com base na aba ativa
  const contrachequesFiltrados = contracheques.filter(c => {
    if (abaInterna === 'casal') return true;
    return c.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });

  // Obter salário líquido do contracheque mais recente
  const ccRecente = contrachequesFiltrados[0];
  const receita = ccRecente?.salario_liquido || (abaInterna === 'casal' ? 4500 : 2250);

  const descontosFiltrados = descontos.filter(d => {
    const ccId = (d as any).contracheque?.usuario_id;
    if (abaInterna === 'casal') return true;
    return ccId === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });
  const totalDescontosVal = descontosFiltrados.reduce((acc, d) => acc + (d.valor || 0), 0);

  const dividasFiltradas = dividas.filter(d => {
    if (!d.ativa) return false;
    if (abaInterna === 'casal') return true;
    if (d.usuario_id === null) return true; // conjunta
    return d.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });
  const totalDividasVal = dividasFiltradas.reduce((acc, d) => acc + d.valor_parcela, 0);

  const despesasFixas = totalDescontosVal + totalDividasVal;

  const transacoesFiltradas = transacoes.filter(g => {
    if (abaInterna === 'casal') return true;
    return g.usuario_id === (abaInterna === 'voce' ? usuario.id : usuarioEsposa?.id);
  });

  // Gastos diários despesas (excluindo receitas e transferências) dos últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  const despesasVariaveisRecentes = transacoesFiltradas.filter(g => {
    const dGasto = new Date(g.data);
    const isDespesa = g.categoria !== 'receita_extra' && g.categoria !== 'transferencia';
    return isDespesa && dGasto >= trintaDiasAtras;
  });
  const totalDespesasVariaveis = despesasVariaveisRecentes.reduce((acc, g) => acc + g.valor, 0);
  const despesasVariaveis = totalDespesasVariaveis || (abaInterna === 'casal' ? 1800 : 900);

  const maiorDivida = dividasFiltradas.reduce((max, d) => d.valor_parcela > max ? d.valor_parcela : max, 0);

  // 2. Projetar 6 meses
  const dadosGrafico: any[] = [];
  let saldoA = abaInterna === 'casal' ? -3500 : -1750;
  let saldoB = abaInterna === 'casal' ? -5000 : -2500;

  // Encontrar meses de virada
  let mesViradaA = -1;
  let mesViradaB = -1;

  for (let mes = 1; mes <= 6; mes++) {
    // Cenário A: Corte de 15% em gastos variáveis
    const sobraA = receita - despesasFixas - (despesasVariaveis * 0.85);
    saldoA += sobraA;
    if (saldoA >= 0 && mesViradaA === -1) {
      mesViradaA = mes;
    }

    // Cenário B: Sem corte em variáveis, mas com renegociação/quitação da maior dívida no mês 3
    let sobraB = receita - despesasFixas - despesasVariaveis;
    if (mes >= 3 && maiorDivida > 0) {
      sobraB += maiorDivida; // zera a maior parcela
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
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6 shadow-2xl">
      
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📈</span> Cenários e Projeção (Estudo de Caminho)
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Análise preditiva cruzando receitas, despesas fixas e despesas variáveis reais.
          </p>
        </div>

        {/* Seleção de Aba Interna */}
        <div className="flex bg-slate-950/40 p-1 rounded-2xl border border-white/5 self-start gap-1">
          <button
            onClick={() => setAbaInterna('casal')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              abaInterna === 'casal'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            👥 Casal
          </button>
          <button
            onClick={() => setAbaInterna('voce')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              abaInterna === 'voce'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🙋‍♂️ Você
          </button>
          {usuarioEsposa && (
            <button
              onClick={() => setAbaInterna('esposa')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                abaInterna === 'esposa'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🙋‍♀️ {usuarioEsposa.nome.split(' ')[0]}
            </button>
          )}
        </div>
      </div>

      {/* Cenários Detalhados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Cenário A */}
        <div className="bg-blue-950/30 border border-blue-500/20 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-blue-400 text-sm flex items-center gap-1.5">
              <span>🛡️</span> Cenário A (Foco em Sobrevivência)
            </h4>
            <span className="text-[10px] bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full font-bold uppercase">
              Corte de 15%
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Reduzir despesas variáveis em **15%** (Economia mensal de **R$ {Math.round(despesasVariaveis * 0.15).toLocaleString('pt-BR')}**).
          </p>
          <div className="text-xs font-bold text-slate-400">
            Impacto: {mesViradaA > 0 ? `Sairá do vermelho em até ${mesViradaA * 30} dias.` : 'Tendência de melhora gradual.'}
          </div>
        </div>

        {/* Cenário B */}
        <div className="bg-amber-950/30 border border-amber-500/20 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>🤝</span> Cenário B (Foco em Renegociação)
            </h4>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-bold uppercase">
              Alívio de Parcela
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Renegociar ou amortizar a maior parcela ativa deste perfil (economia mensal de **R$ {Math.round(maiorDivida).toLocaleString('pt-BR')}** a partir do Mês 3).
          </p>
          <div className="text-xs font-bold text-slate-400">
            Impacto: {mesViradaB > 0 ? `Sairá do vermelho no ${mesViradaB}º mês.` : 'Estabilização progressiva.'}
          </div>
        </div>

      </div>

      {/* Gráfico de Projeção */}
      <div className="bg-slate-950/35 border border-white/5 p-5 rounded-2xl">
        <h4 className="font-bold text-white text-xs mb-4 uppercase tracking-wider text-slate-400">
          Projeção do Saldo Acumulado ({abaInterna === 'casal' ? 'Casal' : abaInterna === 'voce' ? 'Seu perfil' : `Perfil da ${usuarioEsposa?.nome.split(' ')[0]}`})
        </h4>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dadosGrafico} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
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
      <div className="bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-2xl space-y-3">
        <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
          <span>🔔</span> Alertas do Rastreador de Recuperação ({abaInterna === 'casal' ? 'Casal' : abaInterna === 'voce' ? 'Você' : usuarioEsposa?.nome.split(' ')[0]})
        </h4>
        <ul className="space-y-2">
          {alertas.map((alerta, idx) => (
            <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">🌱</span>
              <span>{alerta}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

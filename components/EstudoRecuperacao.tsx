'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { GastoDiario, Divida } from '@/lib/types';

interface EstudoRecuperacaoProps {
  transacoes: GastoDiario[];
  salarioLiquido: number;
  totalDescontos: number;
  dividasAtivas: Divida[];
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
  salarioLiquido,
  totalDescontos,
  dividasAtivas
}: EstudoRecuperacaoProps) {
  
  // 1. Calcular receita e despesas com fallbacks de segurança
  const receita = salarioLiquido || 4500; // default para simulação se não houver contracheque
  
  const despesasFixas = totalDescontos + dividasAtivas.reduce((acc, d) => acc + d.valor_parcela, 0);

  // Gastos diários despesas (excluindo receitas e transferências) dos últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const despesasVariaveisRecentes = transacoes.filter(g => {
    const dGasto = new Date(g.data);
    const isDespesa = g.categoria !== 'receita_extra' && g.categoria !== 'transferencia';
    return isDespesa && dGasto >= trintaDiasAtras;
  });
  const totalDespesasVariaveis = despesasVariaveisRecentes.reduce((acc, g) => acc + g.valor, 0);
  const despesasVariaveis = totalDespesasVariaveis || 1800; // default para simulação se vazio

  const maiorDivida = dividasAtivas.reduce((max, d) => d.valor_parcela > max ? d.valor_parcela : max, 0);

  // 2. Projetar 6 meses
  const dadosGrafico: any[] = [];
  let saldoA = -1500;
  let saldoB = -2500;

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

  // 3. Gerar Alertas do Rastreador de Recuperação baseados em dados reais
  const alertas: string[] = [];
  
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const quatorzeDiasAtras = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
  
  const despesasSemana1 = transacoes.filter(g => {
    const d = new Date(g.data);
    return g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && d >= seteDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  const despesasSemana2 = transacoes.filter(g => {
    const d = new Date(g.data);
    return g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && d >= quatorzeDiasAtras && d < seteDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  if (despesasSemana1 < despesasSemana2 && despesasSemana2 > 0) {
    const reducaoPercent = Math.round(((despesasSemana2 - despesasSemana1) / despesasSemana2) * 100);
    alertas.push(`Identifiquei uma queda de ${reducaoPercent}% nos gastos variáveis na última semana e o saldo livre aumentou. A situação começou a demonstrar os primeiros sinais reais de melhora.`);
  }

  // Receitas extras recentes
  const receitasExtras = transacoes.filter(g => {
    const d = new Date(g.data);
    return g.categoria === 'receita_extra' && d >= trintaDiasAtras;
  }).reduce((acc, g) => acc + g.valor, 0);

  if (receitasExtras > 0) {
    alertas.push(`Entrada de receitas extras no valor de R$ ${receitasExtras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} nos últimos 30 dias ajudou a aliviar o fluxo de caixa.`);
  }

  // Quantidade de parcelas quitadas/inativas
  const dividasInativas = dividasAtivas.filter(d => !d.ativa).length;
  if (dividasInativas > 0) {
    alertas.push(`Houve a quitação ou suspensão de ${dividasInativas} linha(s) de crédito recentemente. Menos juros incidindo!`);
  }

  if (alertas.length === 0) {
    alertas.push("Nenhum alerta ativo de melhora por enquanto. Reduza pequenos gastos supérfluos esta semana para ativarmos o primeiro sinal de recuperação!");
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
      
      {/* Cabeçalho */}
      <div>
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <span>📈</span> Cenários e Projeção de Recuperação (Estudo de Caminho)
        </h3>
        <p className="text-xs text-slate-400 font-medium mt-1">
          Análise preditiva cruzando receitas de contracheques, parcelas fixas e média de gastos variáveis dos últimos 30 dias.
        </p>
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
              Corte de Gastos
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Corte imediato de <strong>15%</strong> nas despesas variáveis/flexíveis identificadas na planilha (redução mensal de <strong>R$ {Math.round(despesasVariaveis * 0.15)}</strong>).
          </p>
          <div className="text-xs font-bold text-slate-400">
            Impacto real: {mesViradaA > 0 ? `O saldo sairá do vermelho em até ${mesViradaA * 30} dias.` : 'O saldo sairá do vermelho no longo prazo.'}
          </div>
        </div>

        {/* Cenário B */}
        <div className="bg-amber-950/30 border border-amber-500/20 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>🤝</span> Cenário B (Foco em Renegociação)
            </h4>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-bold uppercase">
              Redução de Dívidas
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Manutenção dos gastos atuais, mas com amortização/renegociação direcionada à parcela de maior valor (redução de <strong>R$ {Math.round(maiorDivida)}</strong> mensais a partir do Mês 3).
          </p>
          <div className="text-xs font-bold text-slate-400">
            Impacto real: {mesViradaB > 0 ? `O saldo sairá do vermelho no ${mesViradaB}º mês.` : 'O saldo sairá do vermelho no longo prazo.'}
          </div>
        </div>

      </div>

      {/* Gráfico de Projeção */}
      <div className="bg-slate-950/35 border border-white/5 p-5 rounded-2xl">
        <h4 className="font-bold text-white text-xs mb-4 uppercase tracking-wider text-slate-400">
          Projeção de Recuperação do Saldo Bancário (Próximos 6 Meses)
        </h4>
        <div className="h-[280px] w-full">
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

      {/* Rastreador de Recuperação (Alertas) */}
      <div className="bg-emerald-950/20 border border-emerald-500/20 p-5 rounded-2xl space-y-3">
        <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
          <span>🔔</span> Alertas do Rastreador de Recuperação
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

'use client';

import { useMemo } from 'react';

interface ContrachequeRel {
  id: string;
  mes_referencia: string;
  salario_bruto: number;
  salario_liquido: number;
  usuario_nome: string;
  usuario_id: string;
}

interface GastoRel {
  id: string;
  valor: number;
  estabelecimento: string;
  categoria: string;
  data: string;
  confirmado: boolean;
  usuario_nome: string;
  usuario_id: string;
}

interface DividaRel {
  id: string;
  credor: string;
  valor_parcela: number;
  usuario_id: string | null;
  usuario_nome: string;
}

interface RelatorioMensalProps {
  contracheques: ContrachequeRel[];
  gastos: GastoRel[];
  dividas: DividaRel[];
  visao: 'casal' | 'voce' | 'esposa';
}

export default function RelatorioMensal({ contracheques, gastos, dividas, visao: _visao }: RelatorioMensalProps) {
  const relatorioMeses = useMemo(() => {
    // 1. Obter todos os meses únicos das datas de gastos e contracheques
    const mesesSet = new Set<string>();
    
    contracheques.forEach((c) => {
      const mes = c.mes_referencia.substring(0, 7); // YYYY-MM
      mesesSet.add(mes);
    });

    gastos.forEach((g) => {
      const mes = g.data.substring(0, 7); // YYYY-MM
      mesesSet.add(mes);
    });

    // Se estiver vazio, colocar o mês atual
    if (mesesSet.size === 0) {
      mesesSet.add(new Date().toISOString().substring(0, 7));
    }

    const listaMeses = Array.from(mesesSet).sort((a, b) => b.localeCompare(a)); // Mais recentes primeiro

    // 2. Calcular os fluxos para cada mês
    return listaMeses.map((mes) => {
      const anoMesExtenso = new Date(mes + '-02').toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      });

      // Filtrar itens do mês específico
      const contrachequesMes = contracheques.filter(
        (c) => c.mes_referencia.substring(0, 7) === mes
      );
      
      const gastosMes = gastos.filter(
        (g) => g.data.substring(0, 7) === mes && g.confirmado
      );

      // Entradas: Salário Líquido + Receita Extra
      const totalSalarioLiquido = contrachequesMes.reduce((acc, c) => acc + (c.salario_liquido || 0), 0);
      const totalReceitaExtra = gastosMes
        .filter((g) => g.categoria === 'receita_extra')
        .reduce((acc, g) => acc + g.valor, 0);
      
      const totalEntradas = totalSalarioLiquido + totalReceitaExtra;

      // Saídas: Gastos Normais + Dívidas (se houver contracheques no mês, assumimos que as dívidas ativas foram pagas)
      const totalGastosDiarios = gastosMes
        .filter((g) => g.categoria !== 'receita_extra' && g.categoria !== 'transferencia')
        .reduce((acc, g) => acc + g.valor, 0);

      // Soma de parcelas das dívidas manuais
      // Para simplificar, assumimos que a parcela mensal de todas as dívidas ativas é paga no mês
      const totalDividasMes = dividas.reduce((acc, d) => acc + d.valor_parcela, 0);

      const totalSaidas = totalGastosDiarios + totalDividasMes;

      // Transferências Internas
      const transferenciasMes = gastosMes.filter((g) => g.categoria === 'transferencia');
      const totalTransferencias = transferenciasMes.reduce((acc, g) => acc + g.valor, 0);

      const saldoLiquido = totalEntradas - totalSaidas;
      const poupancaPercent = totalEntradas > 0 ? Math.round((saldoLiquido / totalEntradas) * 100) : 0;

      return {
        mesKey: mes,
        mesNome: anoMesExtenso.charAt(0).toUpperCase() + anoMesExtenso.slice(1),
        totalSalarioLiquido,
        totalReceitaExtra,
        totalEntradas,
        totalGastosDiarios,
        totalDividasMes,
        totalSaidas,
        totalTransferencias,
        transferencias: transferenciasMes,
        saldoLiquido,
        poupancaPercent,
      };
    });
  }, [contracheques, gastos, dividas]);

  return (
    <div className="space-y-8">
      {relatorioMeses.map((rel) => {
        const isPositivo = rel.saldoLiquido >= 0;

        return (
          <div key={rel.mesKey} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            {/* Header do Mês */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{rel.mesNome}</h3>
                <p className="text-slate-400 text-xs mt-1">Resumo consolidado de fluxos financeiros</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Sobra do Mês:</span>
                <span className={`text-lg font-bold px-4 py-1.5 rounded-full ${
                  isPositivo 
                    ? 'bg-emerald-50 text-emerald-600' 
                    : 'bg-rose-50 text-rose-600'
                }`}>
                  R$ {rel.saldoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {isPositivo && rel.poupancaPercent > 0 && (
                    <span className="text-xs font-semibold ml-1.5 opacity-90">
                      (+{rel.poupancaPercent}%)
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Grid de Fluxo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Entradas */}
              <div className="bg-emerald-50/20 border border-emerald-500/10 rounded-2xl p-5">
                <h4 className="text-emerald-700 font-bold text-sm mb-4 flex items-center gap-2">
                  <span>📥</span> Entradas (Receitas)
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Salários Líquidos</span>
                    <span className="font-semibold text-slate-800">
                      R$ {rel.totalSalarioLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Receitas Extras</span>
                    <span className="font-semibold text-slate-800 text-emerald-600">
                      + R$ {rel.totalReceitaExtra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-t border-emerald-500/20 pt-2 flex justify-between font-bold text-slate-800 text-base">
                    <span>Total Entradas</span>
                    <span>R$ {rel.totalEntradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Saídas */}
              <div className="bg-rose-50/20 border border-rose-500/10 rounded-2xl p-5">
                <h4 className="text-rose-700 font-bold text-sm mb-4 flex items-center gap-2">
                  <span>📤</span> Saídas (Despesas)
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Gastos Diários</span>
                    <span className="font-semibold text-slate-800">
                      R$ {rel.totalGastosDiarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Dívidas Fixas/Parcelas</span>
                    <span className="font-semibold text-slate-800">
                      R$ {rel.totalDividasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="border-t border-rose-500/20 pt-2 flex justify-between font-bold text-slate-800 text-base">
                    <span>Total Saídas</span>
                    <span className="text-rose-600">R$ {rel.totalSaidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Transferências */}
              <div className="bg-purple-50/20 border border-purple-500/10 rounded-2xl p-5">
                <h4 className="text-purple-700 font-bold text-sm mb-4 flex items-center gap-2">
                  <span>🔄</span> Transferências Internas
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Movimentado</span>
                    <span className="font-semibold text-purple-700">
                      R$ {rel.totalTransferencias.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  {rel.transferencias.length === 0 ? (
                    <p className="text-slate-400 text-xs mt-2 italic">Nenhuma transferência entre o casal.</p>
                  ) : (
                    <div className="max-h-[80px] overflow-y-auto pt-1 space-y-1.5 border-t border-purple-500/15">
                      {rel.transferencias.map((t) => (
                        <div key={t.id} className="flex justify-between text-xxs text-slate-500">
                          <span className="truncate max-w-[120px]">{t.estabelecimento}</span>
                          <span className="font-medium text-slate-700">
                            R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

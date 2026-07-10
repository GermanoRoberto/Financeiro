'use client';

import { ProjecaoMes } from '@/lib/projecao';

interface TabMesesProps {
  projecao: ProjecaoMes[];
}

export default function TabMeses({ projecao }: TabMesesProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-lg font-bold text-slate-800">📋 Projeção Detalhada por Mês</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Visão consolidada para os próximos 12 meses</p>
        </div>
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
          Projeção 12M
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-400 uppercase tracking-wider text-xs font-bold border-b border-slate-100">
              <th className="px-6 py-4 text-left">Mês Referência</th>
              <th className="px-6 py-4 text-right">Descontos</th>
              <th className="px-6 py-4 text-right">Dívidas Manuais</th>
              <th className="px-6 py-4 text-right">Total Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projecao.map((mes, idx) => {
              const mesNome = mes.mesFormatado.charAt(0).toUpperCase() + mes.mesFormatado.slice(1);
              return (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  {/* Mês com Badge */}
                  <td className="px-6 py-4 font-semibold text-slate-800">
                    <span className="inline-block bg-blue-50/60 text-blue-600 border border-blue-100/50 px-3.5 py-1 rounded-full text-xs font-bold shadow-sm">
                      {mesNome}
                    </span>
                  </td>
                  
                  {/* Descontos */}
                  <td className="px-6 py-4 text-right font-medium text-slate-600 font-mono">
                    R$ {mes.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  
                  {/* Dívidas */}
                  <td className="px-6 py-4 text-right font-medium text-slate-600 font-mono">
                    R$ {mes.totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  
                  {/* Total Acumulado */}
                  <td className="px-6 py-4 text-right font-bold text-rose-600 font-mono bg-rose-50/20 group-hover:bg-rose-50/40 transition-colors">
                    R$ {mes.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

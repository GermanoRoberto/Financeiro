'use client';

import { ProjecaoMes } from '@/lib/projecao';

interface TabMesesProps {
  projecao: ProjecaoMes[];
}

export default function TabMeses({ projecao }: TabMesesProps) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl backdrop-blur-md overflow-hidden shadow-2xl">
      <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-950/20">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📋</span> Projeção Detalhada por Mês
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Visão consolidada para os próximos 12 meses</p>
        </div>
        <span className="bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
          Projeção 12M
        </span>
      </div>

      {/* Tabela para Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-950/30 text-slate-400 uppercase tracking-wider text-xs font-bold border-b border-white/10">
              <th className="px-6 py-4 text-left">Mês Referência</th>
              <th className="px-6 py-4 text-right">Descontos</th>
              <th className="px-6 py-4 text-right">Dívidas Manuais</th>
              <th className="px-6 py-4 text-right font-bold text-rose-400">Total Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-200">
            {projecao.map((mes, idx) => {
              const mesNome = mes.mesFormatado.charAt(0).toUpperCase() + mes.mesFormatado.slice(1);
              return (
                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4 font-semibold">
                    <span className="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3.5 py-1 rounded-full text-xs font-bold">
                      {mesNome}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium font-mono text-slate-300">
                    R$ {mes.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-medium font-mono text-slate-300">
                    R$ {mes.totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-rose-400 font-mono bg-rose-500/5 group-hover:bg-rose-500/10 transition-colors">
                    R$ {mes.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lista de Cards para Mobile */}
      <div className="block sm:hidden divide-y divide-white/5">
        {projecao.map((mes, idx) => {
          const mesNome = mes.mesFormatado.charAt(0).toUpperCase() + mes.mesFormatado.slice(1);
          return (
            <div key={idx} className="p-5 space-y-2 bg-slate-900/10">
              <div className="flex justify-between items-center">
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-0.5 rounded-full text-xs font-bold">
                  {mesNome}
                </span>
                <span className="text-xs text-slate-400 font-medium">Total Geral</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Descontos</span>
                  <span className="font-semibold font-mono">
                    R$ {mes.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Dívidas</span>
                  <span className="font-semibold font-mono">
                    R$ {mes.totalDividas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5 font-bold text-sm">
                <span className="text-slate-400 text-xs">Total Acumulado</span>
                <span className="text-rose-400 font-mono">
                  R$ {mes.totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import { ProjecaoMes } from '@/lib/projecao';

interface TabMesesProps {
  projecao: ProjecaoMes[];
}

export default function TabMeses({ projecao }: TabMesesProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-200">
              <th className="px-6 py-3 text-left font-semibold text-gray-700">Mês</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-700">Descontos</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-700">Dívidas</th>
              <th className="px-6 py-3 text-right font-semibold text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {projecao.map((mes, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-medium text-gray-800">
                  {mes.mesFormatado.charAt(0).toUpperCase() + mes.mesFormatado.slice(1)}
                </td>
                <td className="px-6 py-3 text-right text-gray-700">
                  R$ {mes.totalDescontos.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-right text-gray-700">
                  R$ {mes.totalDividas.toFixed(2)}
                </td>
                <td className="px-6 py-3 text-right font-semibold text-red-600">
                  R$ {mes.totalGeral.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

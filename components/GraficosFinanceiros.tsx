'use client';

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ProjecaoMes } from '@/lib/projecao';

interface GraficosFinanceirosProps {
  projecao: ProjecaoMes[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function GraficosFinanceiros({ projecao }: GraficosFinanceirosProps) {
  const dados6Meses = projecao.slice(0, 6).map((mes) => ({
    mes: mes.mesFormatado.split(' ')[0].substring(0, 3),
    descontos: mes.totalDescontos,
    dividas: mes.totalDividas,
  }));

  const tipoDespesasData = projecao[0]?.descontos?.reduce((acc: any[], d) => {
    const existe = acc.find((item) => item.name === d.tipo);
    if (existe) {
      existe.value += d.valor;
    } else {
      acc.push({ name: d.tipo, value: d.valor });
    }
    return acc;
  }, []) || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Gráfico de Barras - Projeção Mensal */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Projeção (6 Meses)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados6Meses}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
            <Legend />
            <Bar dataKey="descontos" fill="#3b82f6" name="Descontos" />
            <Bar dataKey="dividas" fill="#ef4444" name="Dívidas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de Pizza - Tipos de Desconto */}
      {tipoDespesasData.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">🥧 Composição de Descontos</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={tipoDespesasData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${((value / tipoDespesasData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {tipoDespesasData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico de Linhas - Tendência */}
      <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Tendência de Despesas</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={projecao.slice(0, 12).map((mes) => ({
            mes: mes.mesFormatado.split(' ')[0].substring(0, 3),
            total: mes.totalGeral,
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip formatter={(value) => `R$ ${Number(value).toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

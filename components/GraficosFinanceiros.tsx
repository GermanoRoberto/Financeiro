'use client';

import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ProjecaoMes } from '@/lib/projecao';

interface GraficosFinanceirosProps {
  projecao: ProjecaoMes[];
}

const COLORS = [
  '#3b82f6', // Azul
  '#8b5cf6', // Roxo
  '#ec4899', // Rosa
  '#10b981', // Verde
  '#f59e0b', // Amarelo/Laranja
  '#ef4444'  // Vermelho
];

// Componente customizado para Tooltips de Gráficos (Glassmorphism e Tipografia Outfit)
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl text-white font-sans text-xs">
        <p className="font-bold text-slate-400 mb-2 uppercase tracking-wider">{label}</p>
        <div className="space-y-1.5">
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center gap-4 justify-between">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill || p.color }} />
                {p.name}:
              </span>
              <span className="font-bold font-mono" style={{ color: p.fill || p.color }}>
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

export default function GraficosFinanceiros({ projecao }: GraficosFinanceirosProps) {
  const dados6Meses = projecao.slice(0, 6).map((mes) => ({
    mes: mes.mesFormatado.split(' ')[0].substring(0, 3).toUpperCase(),
    receita: mes.salarioBruto,
    despesas: mes.totalGeral,
    liquido: mes.salarioBruto - mes.totalGeral,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* Gráfico de Barras - Projeção Mensal */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">📊 Projeção Financeira (6 Meses)</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Visão comparativa entre receitas, despesas e saldo líquido</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={dados6Meses} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="barBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.95}/>
                <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0.95}/>
              </linearGradient>
              <linearGradient id="barRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.95}/>
                <stop offset="95%" stopColor="#9f1239" stopOpacity={0.95}/>
              </linearGradient>
              <linearGradient id="barGreen" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.95}/>
                <stop offset="95%" stopColor="#047857" stopOpacity={0.95}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} fontWeight={500} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            <Bar dataKey="receita" fill="url(#barBlue)" name="Receita (Bruta)" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="despesas" fill="url(#barRed)" name="Despesas Totais" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="liquido" fill="url(#barGreen)" name="Salário Líquido (Livre)" radius={[4, 4, 0, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfico de Pizza (Donut) - Tipos de Desconto */}
      {tipoDespesasData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-800">🥧 Composição de Descontos</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Distribuição das despesas por tipo no contracheque atual</p>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <PieChart>
              <Pie
                data={tipoDespesasData}
                cx="50%"
                cy="42%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                label={false}
                dataKey="value"
              >
                {tipoDespesasData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="horizontal"
                align="center"
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                formatter={(value: string) => {
                  const item = tipoDespesasData.find((d) => d.name === value);
                  const total = tipoDespesasData.reduce((acc, d) => acc + d.value, 0);
                  const percent = total > 0 ? ((item?.value || 0) / total * 100).toFixed(0) : 0;
                  const nomeCurto = value.length > 28 ? value.substring(0, 26) + '...' : value;
                  return <span className="text-slate-600 font-semibold">{nomeCurto} ({percent}%)</span>;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col justify-center items-center h-[382px] text-slate-400">
          <span>📋 Sem descontos registrados para detalhamento</span>
        </div>
      )}

      {/* Gráfico de Área (Tendência) - Tendência de Despesas */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 lg:col-span-2">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-slate-800">📈 Tendência e Evolução de Custos</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Prospecção de custos consolidados para os próximos 12 meses</p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={projecao.slice(0, 12).map((mes) => ({
            mes: mes.mesFormatado.split(' ')[0].substring(0, 3).toUpperCase(),
            total: mes.totalGeral,
          }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="mes" stroke="#94a3b8" fontSize={11} fontWeight={500} />
            <YAxis stroke="#94a3b8" fontSize={11} />
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            <Area type="monotone" dataKey="total" stroke="#3b82f6" name="Total Acumulado" strokeWidth={3} fillOpacity={1} fill="url(#areaGradient)" activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

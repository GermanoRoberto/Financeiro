'use client';

interface ResumoCardProps {
  titulo: string;
  valor: number;
  sufixo?: string;
  cor?: 'blue' | 'green' | 'red' | 'yellow';
}

const coresEspecialistas = {
  blue: {
    border: 'border-l-blue-500',
    bgIcon: 'bg-blue-50 text-blue-600',
    valColor: 'text-blue-600',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  green: {
    border: 'border-l-emerald-500',
    bgIcon: 'bg-emerald-50 text-emerald-600',
    valColor: 'text-emerald-700',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  red: {
    border: 'border-l-rose-500',
    bgIcon: 'bg-rose-50 text-rose-600',
    valColor: 'text-rose-700',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    )
  },
  yellow: {
    border: 'border-l-amber-500',
    bgIcon: 'bg-amber-50 text-amber-600',
    valColor: 'text-amber-700',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  }
};

export default function ResumoCard({ titulo, valor, sufixo = '', cor = 'blue' }: ResumoCardProps) {
  const config = coresEspecialistas[cor];

  return (
    <div className={`bg-white rounded-2xl border-y border-r border-slate-100 border-l-4 ${config.border} p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex justify-between items-center group`}>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-400 tracking-wider uppercase">{titulo}</p>
        <p className={`text-3xl font-extrabold tracking-tight ${config.valColor} font-mono`}>
          {cor === 'blue' || cor === 'green' ? 'R$ ' : ''}
          {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{sufixo}
        </p>
      </div>

      <div className={`p-3 rounded-xl ${config.bgIcon} transition-all duration-300 group-hover:scale-110 shadow-sm`}>
        {config.icon}
      </div>
    </div>
  );
}

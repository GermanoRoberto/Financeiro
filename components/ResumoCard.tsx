'use client';

interface ResumoCardProps {
  titulo: string;
  valor: number;
  sufixo?: string;
  cor?: 'blue' | 'green' | 'red' | 'yellow';
}

const coresEspecialistas = {
  blue: {
    borderLeft: 'border-l-cyan-500',
    glow: 'from-cyan-500/15 via-blue-500/5 to-transparent',
    bgIcon: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
    valColor: 'text-cyan-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  green: {
    borderLeft: 'border-l-emerald-500',
    glow: 'from-emerald-500/15 via-emerald-600/5 to-transparent',
    bgIcon: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    valColor: 'text-emerald-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  red: {
    borderLeft: 'border-l-rose-500',
    glow: 'from-rose-500/15 via-rose-600/5 to-transparent',
    bgIcon: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
    valColor: 'text-rose-400',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    )
  },
  yellow: {
    borderLeft: 'border-l-amber-500',
    glow: 'from-amber-500/15 via-amber-600/5 to-transparent',
    bgIcon: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    valColor: 'text-amber-400',
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
    <div className={`bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-white/10 border-l-4 ${config.borderLeft} p-6 shadow-xl shadow-slate-950/40 hover:shadow-2xl hover:border-white/20 hover:-translate-y-1 transition-all duration-300 flex justify-between items-center group relative overflow-hidden`}>
      {/* Glow de fundo sutil */}
      <div className={`absolute top-0 right-0 w-36 h-36 bg-gradient-to-br ${config.glow} rounded-full filter blur-2xl pointer-events-none transition-all duration-300 group-hover:scale-125`} />

      <div className="space-y-1.5 relative z-10">
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase">{titulo}</p>
        <p className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${config.valColor} font-mono tabular-nums`}>
          {cor === 'blue' || cor === 'green' ? 'R$ ' : ''}
          {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{sufixo}
        </p>
      </div>

      <div className={`p-3.5 rounded-2xl ${config.bgIcon} transition-all duration-300 group-hover:scale-110 shadow-lg relative z-10`}>
        {config.icon}
      </div>
    </div>
  );
}

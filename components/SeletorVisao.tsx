'use client';

interface SeletorVisaoProps {
  visao: 'casal' | 'voce' | 'esposa';
  onChange: (visao: 'casal' | 'voce' | 'esposa') => void;
  temEsposa: boolean;
  nomeParceiro?: string;
}

export default function SeletorVisao({ visao, onChange, temEsposa, nomeParceiro }: SeletorVisaoProps) {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-1.5 rounded-2xl flex inline-flex gap-1.5 shadow-xl shadow-slate-950/20 max-w-full overflow-x-auto">
      <button
        onClick={() => onChange('casal')}
        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
          visao === 'casal'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 active:scale-95'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <span>👫</span> Casal
      </button>
      <button
        onClick={() => onChange('voce')}
        className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
          visao === 'voce'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 active:scale-95'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <span>👤</span> Você
      </button>
      {temEsposa && (
        <button
          onClick={() => onChange('esposa')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
            visao === 'esposa'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 active:scale-95'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <span>💑</span> {nomeParceiro || 'Parceiro(a)'}
        </button>
      )}
    </div>
  );
}

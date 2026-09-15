'use client';

interface SeletorVisaoProps {
  visao: 'casal' | 'voce' | 'esposa';
  onChange: (visao: 'casal' | 'voce' | 'esposa') => void;
  temEsposa: boolean;
  nomeUsuario?: string;
  nomeParceiro?: string;
}

export default function SeletorVisao({
  visao,
  onChange,
  temEsposa,
  nomeUsuario = 'Você',
  nomeParceiro = 'Parceiro(a)'
}: SeletorVisaoProps) {
  const normUsuario = (nomeUsuario || '').toLowerCase();
  const normParceiro = (nomeParceiro || '').toLowerCase();
  const isUsuarioGermano = normUsuario.includes('germano');
  const isUsuarioPriscila = normUsuario.includes('priscila');

  const primeiroNomeUsuario = (nomeUsuario || 'Você').split(' ')[0];
  const primeiroNomeParceiro = (nomeParceiro || 'Parceiro(a)').split(' ')[0];

  const nomeGermano = isUsuarioGermano ? primeiroNomeUsuario : (normParceiro.includes('germano') ? primeiroNomeParceiro : 'Germano');
  const nomePriscila = isUsuarioPriscila ? primeiroNomeUsuario : (normParceiro.includes('priscila') ? primeiroNomeParceiro : 'Priscila');

  // Determinar se o usuário logado é Germano ou Priscila
  // Se for Germano: Germano é 'voce' e Priscila é 'esposa'
  // Se for Priscila: Priscila é 'voce' e Germano é 'esposa'
  const ehGermanoVoce = isUsuarioGermano || (!isUsuarioPriscila && true);

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl flex inline-flex items-center gap-2 shadow-2xl shadow-slate-950/40 max-w-full overflow-x-auto">
      {/* 1. Visão Conjunta / Casal */}
      <button
        onClick={() => onChange('casal')}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 ${
          visao === 'casal'
            ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <span>🏠</span>
        <span>Casal</span>
      </button>

      {/* 2. Germano */}
      <button
        onClick={() => onChange(ehGermanoVoce ? 'voce' : 'esposa')}
        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 ${
          (ehGermanoVoce && visao === 'voce') || (!ehGermanoVoce && visao === 'esposa')
            ? 'bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        }`}
      >
        <span>👤</span>
        <span>{nomeGermano}</span>
        {ehGermanoVoce && (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-white/20 text-white">
            Você
          </span>
        )}
      </button>

      {/* 3. Priscila */}
      {temEsposa && (
        <button
          onClick={() => onChange(ehGermanoVoce ? 'esposa' : 'voce')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap active:scale-95 ${
            (ehGermanoVoce && visao === 'esposa') || (!ehGermanoVoce && visao === 'voce')
              ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-rose-700 text-white shadow-lg shadow-pink-500/25 border border-pink-400/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <span>👩</span>
          <span>{nomePriscila}</span>
          {!ehGermanoVoce && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-white/20 text-white">
              Você
            </span>
          )}
        </button>
      )}
    </div>
  );
}

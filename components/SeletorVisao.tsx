'use client';

interface SeletorVisaoProps {
  visao: 'casal' | 'voce' | 'esposa';
  onChange: (visao: 'casal' | 'voce' | 'esposa') => void;
  temEsposa: boolean;
}

export default function SeletorVisao({ visao, onChange, temEsposa }: SeletorVisaoProps) {
  return (
    <div className="flex gap-3 mb-6">
      <button
        onClick={() => onChange('casal')}
        className={`px-6 py-2 rounded-lg font-medium transition-all ${
          visao === 'casal'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
        }`}
      >
        👫 Casal
      </button>
      <button
        onClick={() => onChange('voce')}
        className={`px-6 py-2 rounded-lg font-medium transition-all ${
          visao === 'voce'
            ? 'bg-blue-600 text-white shadow-lg'
            : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
        }`}
      >
        👤 Você
      </button>
      {temEsposa && (
        <button
          onClick={() => onChange('esposa')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            visao === 'esposa'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-500'
          }`}
        >
          💑 Esposa
        </button>
      )}
    </div>
  );
}

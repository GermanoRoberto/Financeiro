'use client';

interface ResumoCardProps {
  titulo: string;
  valor: number;
  sufixo?: string;
  cor?: 'blue' | 'green' | 'red' | 'yellow';
}

const cores = {
  blue: 'bg-blue-50 border-blue-200 text-blue-600',
  green: 'bg-green-50 border-green-200 text-green-600',
  red: 'bg-red-50 border-red-200 text-red-600',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
};

export default function ResumoCard({ titulo, valor, sufixo = '', cor = 'blue' }: ResumoCardProps) {
  return (
    <div className={`rounded-lg border-2 p-6 ${cores[cor]}`}>
      <p className="text-sm font-medium text-gray-600 mb-2">{titulo}</p>
      <p className="text-3xl font-bold">
        {cor === 'blue' || cor === 'green' ? 'R$' : ''}
        {valor.toFixed(2)}{sufixo}
      </p>
    </div>
  );
}

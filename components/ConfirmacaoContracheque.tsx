'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

interface ConfirmacaoContrachequeProps {
  dados: any;
  mesReferencia: string;
  onMesChange: (mes: string) => void;
  onConfirmar: (dados: any, mes: string) => void;
  onCancelar: () => void;
  carregando: boolean;
}

export default function ConfirmacaoContracheque({
  dados,
  mesReferencia,
  onMesChange,
  onConfirmar,
  onCancelar,
  carregando,
}: ConfirmacaoContrachequeProps) {
  const [dadosEditados, setDadosEditados] = useState(dados);

  const handleConfirmar = () => {
    if (!mesReferencia) {
      toast.error('Selecione o mês de referência');
      return;
    }
    onConfirmar(dadosEditados, mesReferencia);
  };

  const atualizarDesconto = (idx: number, campo: string, valor: any) => {
    const descontosAtualizados = [...dadosEditados.descontos];
    descontosAtualizados[idx] = {
      ...descontosAtualizados[idx],
      [campo]: valor,
    };
    setDadosEditados({
      ...dadosEditados,
      descontos: descontosAtualizados,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">✅ Confirmar Dados Extraídos</h2>

      {/* Mês de Referência */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Mês de Referência *
        </label>
        <input
          type="month"
          value={mesReferencia}
          onChange={(e) => onMesChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Salário */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Salário Bruto</label>
          <input
            type="number"
            step="0.01"
            value={dadosEditados.salario_bruto || ''}
            onChange={(e) =>
              setDadosEditados({
                ...dadosEditados,
                salario_bruto: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Salário Líquido</label>
          <input
            type="number"
            step="0.01"
            value={dadosEditados.salario_liquido || ''}
            onChange={(e) =>
              setDadosEditados({
                ...dadosEditados,
                salario_liquido: parseFloat(e.target.value),
              })
            }
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Descontos */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Descontos</h3>
        <div className="space-y-4">
          {dadosEditados.descontos?.map((desconto: any, idx: number) => (
            <div key={idx} className="border border-gray-300 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <input
                    type="text"
                    value={desconto.tipo || ''}
                    onChange={(e) => atualizarDesconto(idx, 'tipo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={desconto.valor || ''}
                    onChange={(e) => atualizarDesconto(idx, 'valor', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcela Atual</label>
                  <input
                    type="number"
                    value={desconto.parcela_atual || ''}
                    onChange={(e) =>
                      atualizarDesconto(idx, 'parcela_atual', e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parcelas Totais</label>
                  <input
                    type="number"
                    value={desconto.parcela_total || ''}
                    onChange={(e) =>
                      atualizarDesconto(idx, 'parcela_total', e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center mt-3">
                <input
                  type="checkbox"
                  checked={desconto.recorrente || false}
                  onChange={(e) => atualizarDesconto(idx, 'recorrente', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Recorrente</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-4 justify-end">
        <button
          onClick={onCancelar}
          disabled={carregando}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirmar}
          disabled={carregando}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {carregando ? 'Salvando...' : 'Confirmar e Salvar'}
        </button>
      </div>
    </div>
  );
}

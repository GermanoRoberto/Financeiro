'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface CadastroDividaProps {
  usuarioId: string;
  onSuccess: () => void;
}

export default function CadastroDivida({ usuarioId, onSuccess }: CadastroDividaProps) {
  const [formData, setFormData] = useState({
    credor: '',
    valor_total: '',
    valor_parcela: '',
    parcelas_restantes: '',
    vencimento_dia: '',
    conjunta: false,
  });
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.credor || !formData.valor_parcela || !formData.parcelas_restantes) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setCarregando(true);
      
      const { error } = await supabase.from('dividas').insert([
        {
          usuario_id: formData.conjunta ? null : usuarioId,
          credor: formData.credor,
          valor_total: formData.valor_total ? parseFloat(formData.valor_total) : null,
          valor_parcela: parseFloat(formData.valor_parcela),
          parcelas_restantes: parseInt(formData.parcelas_restantes),
          vencimento_dia: formData.vencimento_dia ? parseInt(formData.vencimento_dia) : null,
          ativa: true,
        },
      ]);

      if (error) throw error;

      toast.success('Dívida cadastrada com sucesso!');
      setFormData({
        credor: '',
        valor_total: '',
        valor_parcela: '',
        parcelas_restantes: '',
        vencimento_dia: '',
        conjunta: false,
      });
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar dívida');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">💳 Cadastrar Dívida</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Credor/Estabelecimento *
          </label>
          <input
            type="text"
            value={formData.credor}
            onChange={(e) => setFormData({ ...formData, credor: e.target.value })}
            placeholder="Ex: Banco X, Financeira Y"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor Total
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor_total}
              onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor da Parcela *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor_parcela}
              onChange={(e) => setFormData({ ...formData, valor_parcela: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parcelas Restantes *
            </label>
            <input
              type="number"
              value={formData.parcelas_restantes}
              onChange={(e) => setFormData({ ...formData, parcelas_restantes: e.target.value })}
              placeholder="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vencimento (dia do mês)
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.vencimento_dia}
              onChange={(e) => setFormData({ ...formData, vencimento_dia: e.target.value })}
              placeholder="1-31"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.conjunta}
            onChange={(e) => setFormData({ ...formData, conjunta: e.target.checked })}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">Dívida do casal (visível para ambos)</span>
        </label>

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
        >
          {carregando ? 'Salvando...' : 'Cadastrar Dívida'}
        </button>
      </form>
    </div>
  );
}

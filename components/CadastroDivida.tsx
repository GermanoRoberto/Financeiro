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
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md shadow-2xl">
      <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span>💳</span> Cadastrar Dívida
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Credor/Estabelecimento *
          </label>
          <input
            type="text"
            value={formData.credor}
            onChange={(e) => setFormData({ ...formData, credor: e.target.value })}
            placeholder="Ex: Banco X, Financeira Y"
            className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Valor Total (Opcional)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor_total}
              onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Valor da Parcela *
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.valor_parcela}
              onChange={(e) => setFormData({ ...formData, valor_parcela: e.target.value })}
              placeholder="0.00"
              className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Parcelas Restantes *
            </label>
            <input
              type="number"
              value={formData.parcelas_restantes}
              onChange={(e) => setFormData({ ...formData, parcelas_restantes: e.target.value })}
              placeholder="0"
              className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Vencimento (Dia do Mês)
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={formData.vencimento_dia}
              onChange={(e) => setFormData({ ...formData, vencimento_dia: e.target.value })}
              placeholder="1-31"
              className="w-full px-4 py-2.5 bg-slate-950/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer py-1 select-none">
          <input
            type="checkbox"
            checked={formData.conjunta}
            onChange={(e) => setFormData({ ...formData, conjunta: e.target.checked })}
            className="w-4.5 h-4.5 text-blue-600 rounded bg-slate-950/40 border-white/10 focus:ring-0 cursor-pointer"
          />
          <span className="text-sm text-slate-300">Dívida conjunta do casal</span>
        </label>

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-xl font-semibold shadow-lg shadow-blue-950/20 active:scale-[0.98] transition-all disabled:opacity-50 text-sm mt-2"
        >
          {carregando ? 'Salvando...' : 'Cadastrar Dívida'}
        </button>
      </form>
    </div>
  );
}

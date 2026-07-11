'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

interface CadastroTransacaoProps {
  usuarioId: string;
  onSuccess: () => void;
}

export default function CadastroTransacao({ usuarioId, onSuccess }: CadastroTransacaoProps) {
  const [tipo, setTipo] = useState<'despesa' | 'receita_extra' | 'transferencia'>('despesa');
  const [valor, setValor] = useState('');
  const [estabelecimento, setEstabelecimento] = useState('');
  const [categoria, setCategoria] = useState('outros');
  const [data, setData] = useState(new Date().toISOString().substring(0, 10));
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor || parseFloat(valor) <= 0) {
      toast.error('Insira um valor válido');
      return;
    }
    if (!estabelecimento) {
      toast.error('Insira uma descrição/estabelecimento');
      return;
    }

    try {
      setCarregando(true);

      const categoriaFinal = tipo === 'despesa' ? categoria : tipo;

      const { error } = await supabase.from('gastos_diarios').insert([
        {
          usuario_id: usuarioId,
          valor: parseFloat(valor),
          estabelecimento: estabelecimento.trim(),
          categoria: categoriaFinal,
          data: data,
          origem: 'web',
          confirmado: true,
        },
      ]);

      if (error) throw error;

      toast.success('Transação cadastrada com sucesso!');
      setValor('');
      setEstabelecimento('');
      setTipo('despesa');
      setCategoria('outros');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao cadastrar transação');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <span>➕</span> Novo Lançamento Manual
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Tipo de Transação
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTipo('despesa')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                tipo === 'despesa'
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              💸 Despesa (Gasto)
            </button>
            <button
              type="button"
              onClick={() => setTipo('receita_extra')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                tipo === 'receita_extra'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              💰 Receita Extra
            </button>
            <button
              type="button"
              onClick={() => setTipo('transferencia')}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                tipo === 'transferencia'
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200'
              }`}
            >
              🔄 Transferência
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Valor (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              required
              className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {tipo === 'despesa'
              ? 'Estabelecimento / Descrição'
              : tipo === 'receita_extra'
                ? 'Origem / Quem pagou'
                : 'Destinatário (ex: Para Germano / De Priscila)'}
          </label>
          <input
            type="text"
            value={estabelecimento}
            onChange={(e) => setEstabelecimento(e.target.value)}
            placeholder={tipo === 'despesa' ? 'Supermercado, Posto...' : 'Trabalho, Pix Recebido...'}
            required
            className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {tipo === 'despesa' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Categoria
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full bg-slate-950/40 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="alimentação" className="bg-slate-900">🍔 Alimentação</option>
              <option value="transporte" className="bg-slate-900">🚗 Transporte</option>
              <option value="saúde" className="bg-slate-900">💊 Saúde</option>
              <option value="diversão" className="bg-slate-900">🎮 Diversão</option>
              <option value="outros" className="bg-slate-900">📦 Outros</option>
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={carregando}
          className="w-full bg-white text-slate-950 font-bold rounded-xl py-3 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          {carregando ? 'Cadastrando...' : 'Lançar Transação'}
        </button>
      </form>
    </div>
  );
}

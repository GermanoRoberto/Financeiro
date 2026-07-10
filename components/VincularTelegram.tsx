'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function VincularTelegram() {
  const [codigo, setCodigo] = useState<string>('');
  const [carregando, setCarregando] = useState(false);

  const gerarCodigo = async () => {
    try {
      setCarregando(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Sessão expirada. Faça login novamente.');
        return;
      }

      const response = await fetch('/api/gerar-codigo-telegram', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar código');
      }

      setCodigo(data.codigo);
      toast.success('Código gerado com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao gerar código');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-slate-800 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
        <div className="text-4xl bg-amber-50 p-3 rounded-2xl border border-amber-100">
          🐈
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Conectar com a Azula (Telegram)</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Vincule a nossa gatinha passiva-agressiva para gerenciar gastos</p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="space-y-4">
        <p className="text-sm text-slate-600 leading-relaxed">
          A <b>Azula</b> é nossa assistente virtual no Telegram! Com ela vinculada ao seu perfil, você pode consultar o resumo financeiro, ver dívidas e enviar contracheques ou comprovantes de gastos tirando uma simples foto.
        </p>

        {codigo ? (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center space-y-4 animate-scaleUp">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Código de Vinculação</p>
            <div className="text-4xl font-extrabold text-blue-600 tracking-widest font-mono select-all">
              {codigo}
            </div>
            <div className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Abra o chat com o bot no Telegram e envie exatamente a mensagem abaixo:<br />
              <code className="bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg inline-block font-mono font-bold mt-2 text-sm select-all">
                /vincular {codigo}
              </code>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50/50 border border-amber-100/50 rounded-2xl p-5 text-xs text-amber-800 leading-relaxed">
            😺 <b>Dica da Azula:</b> <i>&quot;Se você não gerar o código, eu não posso fazer a mágica. E não venha reclamar se eu estiver dormindo quando você enviar.&quot;</i>
          </div>
        )}
      </div>

      {/* Botões de Ação */}
      <div className="pt-2">
        <button
          onClick={gerarCodigo}
          disabled={carregando}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-2xl shadow-lg shadow-blue-500/10 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none"
        >
          {carregando ? 'Gerando...' : codigo ? 'Gerar Outro Código' : 'Gerar Código de Vinculação'}
        </button>
      </div>
    </div>
  );
}

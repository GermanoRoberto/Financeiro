'use client';

import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { extrairContracheque } from '@/lib/geminiClient';
import { Contracheque, Desconto } from '@/lib/types';
import toast from 'react-hot-toast';
import ConfirmacaoContracheque from './ConfirmacaoContracheque';

interface UploadContrachequeProps {
  usuarioId: string;
  onUploadSuccess: () => void;
}

export default function UploadContracheque({ usuarioId, onUploadSuccess }: UploadContrachequeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [dadosExtraidos, setDadosExtraidos] = useState<any>(null);
  const [mesReferencia, setMesReferencia] = useState<string>('');

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCarregando(true);
      const dados = await extrairContracheque(file);
      setDadosExtraidos(dados);
      toast.success('Dados extraídos com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao extrair dados do contracheque');
    } finally {
      setCarregando(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmar = async (dados: any, mes: string) => {
    try {
      setCarregando(true);

      // Criar contracheque
      const { data: contraqueque, error: errorContracheque } = await supabase
        .from('contracheques')
        .insert([
          {
            usuario_id: usuarioId,
            mes_referencia: mes + '-01',
            salario_bruto: dados.salario_bruto,
            salario_liquido: dados.salario_liquido,
            dados_brutos: dados,
          },
        ])
        .select()
        .single();

      if (errorContracheque) throw errorContracheque;

      // Inserir descontos
      if (dados.descontos && Array.isArray(dados.descontos)) {
        const { error: errorDescontos } = await supabase.from('descontos').insert(
          dados.descontos.map((d: any) => ({
            contracheque_id: contraqueque.id,
            tipo: d.tipo,
            valor: d.valor,
            parcela_atual: d.parcela_atual,
            parcela_total: d.parcela_total,
            recorrente: d.recorrente,
            confirmado: true,
          }))
        );

        if (errorDescontos) throw errorDescontos;
      }

      toast.success('Contracheque salvo com sucesso!');
      setDadosExtraidos(null);
      setMesReferencia('');
      onUploadSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar contracheque');
    } finally {
      setCarregando(false);
    }
  };

  if (dadosExtraidos) {
    return (
      <ConfirmacaoContracheque
        dados={dadosExtraidos}
        mesReferencia={mesReferencia}
        onMesChange={setMesReferencia}
        onConfirmar={handleConfirmar}
        onCancelar={() => setDadosExtraidos(null)}
        carregando={carregando}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">📄 Upload de Contracheque</h2>

      <div className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <p className="text-4xl mb-4">📎</p>
        <p className="text-lg font-medium text-gray-700 mb-2">
          Clique ou arraste um arquivo aqui
        </p>
        <p className="text-gray-500">PDF ou imagem do contracheque</p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/*"
        onChange={handleFileSelect}
        disabled={carregando}
        className="hidden"
      />

      {carregando && (
        <div className="flex items-center justify-center mt-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
          <p className="text-gray-600">Processando arquivo...</p>
        </div>
      )}
    </div>
  );
}

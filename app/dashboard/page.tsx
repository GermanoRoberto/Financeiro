'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Usuario, Contracheque, Desconto, Divida, GastoDiario } from '@/lib/types';
import { logout } from '@/lib/auth';
import { projetarDescontos, calcularComprometimento } from '@/lib/projecao';
import DashboardHeader from '@/components/DashboardHeader';
import ResumoCard from '@/components/ResumoCard';
import SeletorVisao from '@/components/SeletorVisao';
import TabMeses from '@/components/TabMeses';
import UploadContracheque from '@/components/UploadContracheque';
import CadastroDivida from '@/components/CadastroDivida';
import GraficosFinanceiros from '@/components/GraficosFinanceiros';
import toast from 'react-hot-toast';

type Visao = 'casal' | 'voce' | 'esposa';

interface DashboardPageProps {
  usuario: Usuario;
}

export default function DashboardPage({ usuario }: DashboardPageProps) {
  const [visao, setVisao] = useState<Visao>('casal');
  const [contracheques, setContracheques] = useState<Contracheque[]>([]);
  const [descontos, setDescontos] = useState<Desconto[]>([]);
  const [dividas, setDividas] = useState<Divida[]>([]);
  const [gastos, setGastos] = useState<GastoDiario[]>([]);
  const [usuarioEsposa, setUsuarioEsposa] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'contracheque' | 'dividas'>('dashboard');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);

      // Carregar dados do usuário atual
      const { data: contratachequeData } = await supabase
        .from('contracheques')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('mes_referencia', { ascending: false });

      const { data: descontosData } = await supabase
        .from('descontos')
        .select(
          `*,
          contracheque:contracheques(usuario_id)`
        )
        .eq('contracheques.usuario_id', usuario.id);

      const { data: dividasData } = await supabase
        .from('dividas')
        .select('*')
        .or(`usuario_id.eq.${usuario.id},usuario_id.is.null`)
        .eq('ativa', true);

      const { data: gastosData } = await supabase
        .from('gastos_diarios')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('data', { ascending: false });

      setContracheques(contratachequeData || []);
      setDescontos(descontosData || []);
      setDividas(dividasData || []);
      setGastos(gastosData || []);

      // Carregar dados da esposa se existir
      const { data: usuariosData } = await supabase
        .from('usuarios_permitidos')
        .select('*')
        .neq('id', usuario.id)
        .limit(1)
        .single();

      if (usuariosData) {
        setUsuarioEsposa(usuariosData);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error.message);
      toast.error('Erro ao carregar dados');
    } finally {
      setCarregando(false);
    }
  };

  const usuarioAtivo = visao === 'esposa' && usuarioEsposa ? usuarioEsposa : usuario;

  // Filtrar dados conforme a visão
  const descontosAtivos = descontos.filter((d) => {
    if (visao === 'casal') return true;
    // Filtrar por usuário (via contrato)
    return true; // TODO: implementar filtro correto
  });

  const dividasAtivas = dividas.filter((d) => {
    if (visao === 'casal') return true;
    if (d.usuario_id === null) return true; // dívida conjunta
    return d.usuario_id === usuarioAtivo.id;
  });

  const contrachequeAtual = contracheques[0];
  const salarioBruto = contrachequeAtual?.salario_bruto || 0;
  const salarioLiquido = contrachequeAtual?.salario_liquido || 0;

  const totalDescontos = descontosAtivos.reduce((acc, d) => acc + (d.valor || 0), 0);
  const totalDividas = dividasAtivas.reduce(
    (acc, d) => acc + ((d.valor_parcela || 0) * (d.parcelas_restantes || 0)),
    0
  );
  const comprometimento = calcularComprometimento(totalDescontos, salarioBruto);

  const projecao = projetarDescontos(descontosAtivos, dividasAtivas, salarioBruto, 12);

  const handleLogout = async () => {
    await logout();
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader usuario={usuarioAtivo} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Seletor de Visão */}
        <SeletorVisao visao={visao} onChange={setVisao} temEsposa={!!usuarioEsposa} />

        {/* Abas de Navegação */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setAbaAtiva('dashboard')}
            className={`px-4 py-3 font-medium transition-colors ${
              abaAtiva === 'dashboard'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Dashboard
          </button>
          <button
            onClick={() => setAbaAtiva('contracheque')}
            className={`px-4 py-3 font-medium transition-colors ${
              abaAtiva === 'contracheque'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📄 Contracheques
          </button>
          <button
            onClick={() => setAbaAtiva('dividas')}
            className={`px-4 py-3 font-medium transition-colors ${
              abaAtiva === 'dividas'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            💳 Dívidas
          </button>
        </div>

        {/* Conteúdo das Abas */}
        {abaAtiva === 'dashboard' && (
          <div className="space-y-6">
            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResumoCard
                titulo="Salário Bruto"
                valor={salarioBruto}
                cor="blue"
              />
              <ResumoCard
                titulo="Salário Líquido"
                valor={salarioLiquido}
                cor="green"
              />
              <ResumoCard
                titulo="Comprometimento"
                valor={comprometimento}
                sufixo="%"
                cor={comprometimento > 50 ? 'red' : comprometimento > 30 ? 'yellow' : 'green'}
              />
            </div>

            {/* Gráficos */}
            <GraficosFinanceiros projecao={projecao} />

            {/* Tabela de Projeção */}
            <TabMeses projecao={projecao} />
          </div>
        )}

        {abaAtiva === 'contracheque' && (
          <UploadContracheque usuarioId={usuarioAtivo.id} onUploadSuccess={carregarDados} />
        )}

        {abaAtiva === 'dividas' && (
          <CadastroDivida usuarioId={usuarioAtivo.id} onSuccess={carregarDados} />
        )}
      </main>
    </div>
  );
}

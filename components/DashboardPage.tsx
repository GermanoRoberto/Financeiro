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
import VincularTelegram from '@/components/VincularTelegram';
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
  const [_gastos, setGastos] = useState<GastoDiario[]>([]);
  const [usuarioEsposa, setUsuarioEsposa] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'contracheque' | 'dividas' | 'telegram'>('dashboard');

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
  const descontosAtivos = descontos.filter((_d) => {
    if (visao === 'casal') return true;
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
  const comprometimento = calcularComprometimento(totalDescontos, salarioBruto);

  const projecao = projetarDescontos(descontosAtivos, dividasAtivas, salarioBruto, 12);

  const handleLogout = async () => {
    await logout();
  };

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#021f54] via-[#0946b5] to-[#120436] text-slate-100 font-sans relative overflow-x-hidden">
      
      {/* Círculos de Brilho / Gradiente em Segundo Plano (Glow Effect) */}
      <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-blue-500/10 filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-indigo-500/10 filter blur-[120px] pointer-events-none" />

      {/* Header Fixo */}
      <DashboardHeader usuario={usuario} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        {/* Barra superior de controles */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-md">
          {/* Seletor de Visão */}
          <SeletorVisao visao={visao} onChange={setVisao} temEsposa={!!usuarioEsposa} />

          {/* Abas de Navegação */}
          <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 max-w-full overflow-x-auto self-start md:self-auto">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                abaAtiva === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setAbaAtiva('contracheque')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                abaAtiva === 'contracheque'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📄 Contracheques
            </button>
            <button
              onClick={() => setAbaAtiva('dividas')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                abaAtiva === 'dividas'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💳 Dívidas
            </button>
            <button
              onClick={() => setAbaAtiva('telegram')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                abaAtiva === 'telegram'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🤖 Telegram
            </button>
          </div>
        </div>

        {/* Conteúdo Principal com base na aba ativa */}
        <div className="transition-all duration-300">
          {abaAtiva === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Seção de Resumos - Grid de Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

              {/* Seção de Gráficos */}
              <GraficosFinanceiros projecao={projecao} />

              {/* Tabela de Prospecção */}
              <TabMeses projecao={projecao} />
            </div>
          )}

          {abaAtiva === 'contracheque' && (
            <div className="animate-fadeIn max-w-3xl mx-auto">
              <UploadContracheque usuarioId={usuarioAtivo.id} onUploadSuccess={carregarDados} />
            </div>
          )}

          {abaAtiva === 'dividas' && (
            <div className="animate-fadeIn max-w-3xl mx-auto">
              <CadastroDivida usuarioId={usuarioAtivo.id} onSuccess={carregarDados} />
            </div>
          )}

          {abaAtiva === 'telegram' && (
            <div className="animate-fadeIn max-w-xl mx-auto">
              <VincularTelegram />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

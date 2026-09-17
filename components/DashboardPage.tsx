'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Usuario, Contracheque, Desconto, Divida, GastoDiario } from '@/lib/types';
import { logout } from '@/lib/auth';
import { projetarDescontos, calcularComprometimento } from '@/lib/projecao';
import { somarValores } from '@/lib/money';
import DashboardHeader from '@/components/DashboardHeader';
import ResumoCard from '@/components/ResumoCard';
import SeletorVisao from '@/components/SeletorVisao';
import TabMeses from '@/components/TabMeses';
import UploadContracheque from '@/components/UploadContracheque';
import CadastroDivida from '@/components/CadastroDivida';
import GraficosFinanceiros from '@/components/GraficosFinanceiros';
import VincularTelegram from '@/components/VincularTelegram';
import CadastroTransacao from '@/components/CadastroTransacao';
import PainelEmprestimos from '@/components/PainelEmprestimos';
import RelatorioMensal from '@/components/RelatorioMensal';
import EstudoRecuperacao from '@/components/EstudoRecuperacao';
import PainelCasalPendente from '@/components/PainelCasalPendente';
import AcertoContasCasal from '@/components/AcertoContasCasal';
import ContasFixasRecorrentes from '@/components/ContasFixasRecorrentes';
import { isGastoCompartilhado } from '@/lib/gastosUtils';
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
  const [abaAtiva, setAbaAtiva] = useState<'dashboard' | 'contracheque' | 'dividas' | 'telegram' | 'emprestimos' | 'relatorio'>('dashboard');
  const [contrachequesExpandidos, setContrachequesExpandidos] = useState<Record<string, boolean>>({});
  const [verTodasTransacoes, setVerTodasTransacoes] = useState(false);
  const [filtroEscopoTransacao, setFiltroEscopoTransacao] = useState<'todos' | 'compartilhado' | 'pessoal_voce' | 'pessoal_esposa'>('todos');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setCarregando(true);

      // Carregar dados de ambos os usuários
      const { data: contratachequeData } = await supabase
        .from('contracheques')
        .select('*')
        .order('mes_referencia', { ascending: false });

      const { data: descontosData } = await supabase
        .from('descontos')
        .select(
          `*,
          contracheque:contracheques(usuario_id)`
        );

      const { data: dividasData } = await supabase
        .from('dividas')
        .select('*');

      const { data: gastosData } = await supabase
        .from('gastos_diarios')
        .select('*')
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
        .maybeSingle();

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

  const formatarMesAno = (dataStr?: string | null) => {
    if (!dataStr) return 'Não cadastrado';
    try {
      const d = new Date(dataStr + (dataStr.length === 7 ? '-02' : 'T12:00:00Z'));
      return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    } catch {
      return dataStr;
    }
  };

  const isEncargoLegal = (tipo?: string) => {
    if (!tipo) return false;
    const t = tipo.toLowerCase();
    return (
      t.includes('inss') ||
      t.includes('irrf') ||
      t.includes('imposto') ||
      t.includes('previd') ||
      t.includes('rpps') ||
      t.includes('pensao') ||
      t.includes('pensão') ||
      t.includes('falta') ||
      t.includes('atraso') ||
      t.includes('sindic') ||
      t.includes('unimed') ||
      t.includes('saude') ||
      t.includes('saúde') ||
      t.includes('plano') ||
      t.includes('odonto')
    );
  };

  const usuarioAtivo = visao === 'esposa' && usuarioEsposa ? usuarioEsposa : usuario;

  // 1. Identificar contracheque mais recente de cada cônjuge
  const ccMaisRecenteVoce = contracheques
    .filter(c => c.usuario_id === usuario.id)
    .sort((a, b) => new Date(b.mes_referencia).getTime() - new Date(a.mes_referencia).getTime())[0];

  const ccMaisRecenteEsposa = usuarioEsposa
    ? contracheques
        .filter(c => c.usuario_id === usuarioEsposa.id)
        .sort((a, b) => new Date(b.mes_referencia).getTime() - new Date(a.mes_referencia).getTime())[0]
    : null;

  const mesVoceStr = ccMaisRecenteVoce?.mes_referencia || null;
  const mesEsposaStr = ccMaisRecenteEsposa?.mes_referencia || null;

  // Governança e Sincronização do Casal:
  // Só é considerado sincronizado se ambos têm contracheque cadastrado no mesmo mês de referência
  const casalSincronizado = Boolean(
    usuarioEsposa &&
    ccMaisRecenteVoce &&
    ccMaisRecenteEsposa &&
    mesVoceStr &&
    mesEsposaStr &&
    mesVoceStr.substring(0, 7) === mesEsposaStr.substring(0, 7)
  );

  // Filtrar contracheques conforme a visão
  const contrachequesAtivos = contracheques.filter((c) => {
    if (visao === 'casal') return true;
    return c.usuario_id === usuarioAtivo.id;
  });

  // Obter o contracheque mais recente de cada pessoa relevante para o resumo atual
  let contrachequesMesAtual: Contracheque[] = [];
  if (visao === 'casal') {
    // Reconciliação suave: consolida os holerites mais recentes de ambos (mesmo se meses divergentes)
    contrachequesMesAtual = [
      ...(ccMaisRecenteVoce ? [ccMaisRecenteVoce] : []),
      ...(ccMaisRecenteEsposa ? [ccMaisRecenteEsposa] : []),
    ];
  } else if (visao === 'voce') {
    contrachequesMesAtual = ccMaisRecenteVoce ? [ccMaisRecenteVoce] : [];
  } else {
    contrachequesMesAtual = ccMaisRecenteEsposa ? [ccMaisRecenteEsposa] : [];
  }

  const salarioBruto = somarValores(contrachequesMesAtual.map((c) => c.salario_bruto || 0));
  const salarioLiquido = somarValores(contrachequesMesAtual.map((c) => c.salario_liquido || 0));

  // Filtrar descontos conforme a visão
  const descontosAtivos = descontos.filter((d: any) => {
    const contrachequeObj = d.contracheque;
    const contrachequeUserId = contrachequeObj?.usuario_id;
    if (visao === 'casal') return true;
    return contrachequeUserId === usuarioAtivo.id;
  });

  // Descontos específicos dos contracheques do mês de referência atual para os KPIs do topo
  const ccIdsMesAtual = new Set(contrachequesMesAtual.map(c => c.id));
  const descontosMesAtual = descontosAtivos.filter((d: any) => {
    const ccId = d.contracheque_id || (d as any).contracheque?.id;
    return ccIdsMesAtual.has(ccId);
  });

  // Filtrar dividas conforme a visão (apenas ativas para projeção de caixa)
  const dividasAtivas = dividas.filter((d) => {
    if (!d.ativa) return false;
    if (visao === 'casal') return true;
    if (d.usuario_id === null) return true; // dívida conjunta
    return d.usuario_id === usuarioAtivo.id;
  });

  // Filtrar dividas para a listagem da aba de Dívidas (inclui inativas/consignados)
  const dividasAba = dividas.filter((d) => {
    if (visao === 'casal') return true;
    if (d.usuario_id === null) return true;
    return d.usuario_id === usuarioAtivo.id;
  });

  // Filtrar gastos conforme a visão
  const gastosFiltrados = useMemo(() => {
    return _gastos.filter((g) => {
      if (visao === 'casal') return true;
      return g.usuario_id === usuarioAtivo.id;
    });
  }, [_gastos, visao, usuarioAtivo.id]);

  // Diagnóstico do Impacto Orçamentário da Casa vs Gastos Pessoais
  const impactoOrcamentario = useMemo(() => {
    const despesasValidas = gastosFiltrados.filter((g) => {
      const cat = (g.categoria || '').toLowerCase();
      return cat !== 'receita_extra' && cat !== 'transferencia';
    });

    const totalGasto = somarValores(despesasValidas.map((g) => g.valor || 0));

    const despesasCasa = despesasValidas.filter(isGastoCompartilhado);
    const totalCasa = somarValores(despesasCasa.map((g) => g.valor || 0));

    const despesasPessoalVoce = despesasValidas.filter(
      (g) => g.usuario_id === usuario.id && !isGastoCompartilhado(g)
    );
    const totalPessoalVoce = somarValores(despesasPessoalVoce.map((g) => g.valor || 0));

    const despesasPessoalEsposa = despesasValidas.filter(
      (g) => usuarioEsposa && g.usuario_id === usuarioEsposa.id && !isGastoCompartilhado(g)
    );
    const totalPessoalEsposa = somarValores(despesasPessoalEsposa.map((g) => g.valor || 0));

    const pctCasa = totalGasto > 0 ? Math.round((totalCasa / totalGasto) * 100) : 0;
    const pctPessoalVoce = totalGasto > 0 ? Math.round((totalPessoalVoce / totalGasto) * 100) : 0;
    const pctPessoalEsposa = totalGasto > 0 ? Math.round((totalPessoalEsposa / totalGasto) * 100) : 0;

    return {
      totalGasto,
      totalCasa,
      totalPessoalVoce,
      totalPessoalEsposa,
      pctCasa,
      pctPessoalVoce,
      pctPessoalEsposa,
      qtdCasa: despesasCasa.length,
      qtdPessoalVoce: despesasPessoalVoce.length,
      qtdPessoalEsposa: despesasPessoalEsposa.length,
    };
  }, [gastosFiltrados, usuario.id, usuarioEsposa]);

  // Filtragem por Escopo (Todos, Casa, Pessoal Você, Pessoal Esposa)
  const gastosAposEscopo = useMemo(() => {
    return gastosFiltrados.filter((g) => {
      if (filtroEscopoTransacao === 'compartilhado') return isGastoCompartilhado(g);
      if (filtroEscopoTransacao === 'pessoal_voce') return g.usuario_id === usuario.id && !isGastoCompartilhado(g);
      if (filtroEscopoTransacao === 'pessoal_esposa') return Boolean(usuarioEsposa && g.usuario_id === usuarioEsposa.id && !isGastoCompartilhado(g));
      return true;
    });
  }, [gastosFiltrados, filtroEscopoTransacao, usuario.id, usuarioEsposa]);

  const gastosExibidos = useMemo(() => {
    if (verTodasTransacoes || filtroEscopoTransacao !== 'todos') return gastosAposEscopo;

    if (visao === 'casal') {
      const ultimosVoce = _gastos.filter(g => g.usuario_id === usuario.id).slice(0, 3);
      const ultimosEsposa = usuarioEsposa 
        ? _gastos.filter(g => g.usuario_id === usuarioEsposa.id).slice(0, 3) 
        : [];
      return [...ultimosVoce, ...ultimosEsposa].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    } else if (visao === 'voce') {
      return _gastos.filter(g => g.usuario_id === usuario.id).slice(0, 3);
    } else {
      return usuarioEsposa 
        ? _gastos.filter(g => g.usuario_id === usuarioEsposa.id).slice(0, 3) 
        : [];
    }
  }, [_gastos, gastosAposEscopo, visao, verTodasTransacoes, filtroEscopoTransacao, usuario.id, usuarioEsposa]);

  const totalDescontos = somarValores(descontosMesAtual.map((d: any) => d.valor || 0));
  const comprometimento = calcularComprometimento(totalDescontos, salarioBruto);

  const projecao = projetarDescontos(descontosMesAtual, dividasAba, salarioBruto, 12);

  const handleLogout = async () => {
    await logout();
  };

  const toggleContracheque = (id: string) => {
    setContrachequesExpandidos(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Funções de Exclusão e Confirmação
  const excluirContracheque = async (id: string) => {
    if (!confirm('Deseja realmente excluir este contracheque? Todos os descontos associados também serão excluídos.')) return;
    try {
      const { error } = await supabase.from('contracheques').delete().eq('id', id);
      if (error) throw error;
      toast.success('Contracheque excluído com sucesso!');
      carregarDados();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const excluirDivida = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta dívida?')) return;
    try {
      const { error } = await supabase.from('dividas').delete().eq('id', id);
      if (error) throw error;
      toast.success('Dívida excluída com sucesso!');
      carregarDados();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const excluirGasto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este gasto?')) return;
    try {
      const { error } = await supabase.from('gastos_diarios').delete().eq('id', id);
      if (error) throw error;
      toast.success('Gasto excluído com sucesso!');
      carregarDados();
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const confirmarGasto = async (id: string) => {
    try {
      const { error } = await supabase.from('gastos_diarios').update({ confirmado: true }).eq('id', id);
      if (error) throw error;
      toast.success('Gasto confirmado!');
      carregarDados();
    } catch (err: any) {
      toast.error('Erro ao confirmar: ' + err.message);
    }
  };

  const alterarCategoriaGasto = async (id: string, novaCategoria: string) => {
    try {
      const { error } = await supabase
        .from('gastos_diarios')
        .update({ categoria: novaCategoria })
        .eq('id', id);
      if (error) throw error;
      toast.success('Categoria atualizada!');
      carregarDados();
    } catch (err: any) {
      toast.error('Erro ao alterar categoria: ' + err.message);
    }
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
      
      {/* Círculos de Brilho em Segundo Plano (Glow Effect) */}
      <div className="absolute top-20 left-10 w-96 h-96 rounded-full bg-blue-500/10 filter blur-[100px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-indigo-500/10 filter blur-[120px] pointer-events-none" />

      {/* Header Fixo */}
      <DashboardHeader usuario={usuario} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        {/* Barra superior de controles */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-md">
          {/* Seletor de Visão com Nomes Explícitos */}
          <SeletorVisao
            visao={visao}
            onChange={setVisao}
            temEsposa={!!usuarioEsposa}
            nomeUsuario={usuario.nome}
            nomeParceiro={usuarioEsposa?.nome}
          />

          {/* Abas de Navegação */}
          <div className="flex bg-slate-950/40 p-1.5 rounded-2xl border border-white/5 max-w-full overflow-x-auto self-start md:self-auto">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setAbaAtiva('contracheque')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === 'contracheque'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📄 Contracheques
            </button>
            <button
              onClick={() => setAbaAtiva('emprestimos')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === 'emprestimos'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📈 Empréstimos
            </button>
            <button
              onClick={() => setAbaAtiva('dividas')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === 'dividas'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💳 Dívidas
            </button>
            <button
              onClick={() => setAbaAtiva('relatorio')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
                abaAtiva === 'relatorio'
                  ? 'bg-white text-slate-900 shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              📊 Relatório
            </button>
            <button
              onClick={() => setAbaAtiva('telegram')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${
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
              
              {/* Banner de Reconciliação Suave caso meses sejam divergentes na visão casal */}
              {visao === 'casal' && !casalSincronizado && (
                <PainelCasalPendente
                  usuario={usuario}
                  usuarioEsposa={usuarioEsposa}
                  mesVoce={formatarMesAno(mesVoceStr)}
                  mesEsposa={formatarMesAno(mesEsposaStr)}
                  liquidoVoce={ccMaisRecenteVoce?.salario_liquido || 0}
                  liquidoEsposa={ccMaisRecenteEsposa?.salario_liquido || 0}
                  onVerVoce={() => setVisao('voce')}
                  onVerEsposa={() => setVisao('esposa')}
                  onIrContracheque={() => setAbaAtiva('contracheque')}
                />
              )}

              {/* Acerto de Contas do Casal (Rateio 50/50 com Folha + Extratos) - Ativo na visão Casal */}
              {visao === 'casal' && (
                <AcertoContasCasal
                  gastos={_gastos}
                  descontos={descontos}
                  contracheques={contracheques}
                  usuario={usuario}
                  usuarioEsposa={usuarioEsposa}
                />
              )}

              {/* Contas Fixas Recorrentes e Provisão Futura da Casa - Ativo na visão Casal */}
              {visao === 'casal' && (
                <ContasFixasRecorrentes
                  gastos={_gastos}
                  mesReferencia={mesVoceStr ? mesVoceStr.substring(0, 7) : undefined}
                />
              )}

              {/* Seção de Resumos - Grid de Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ResumoCard
                  titulo="Salário Bruto"
                  valor={salarioBruto}
                  cor="blue"
                  subtitulo={visao === 'casal' && !casalSincronizado ? 'Estimativa combinada' : undefined}
                />
                <ResumoCard
                  titulo="Salário Líquido"
                  valor={salarioLiquido}
                  cor="green"
                  subtitulo={visao === 'casal' && !casalSincronizado ? 'Estimativa combinada' : undefined}
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

              {/* Estudo de Recuperação (Cenários e Alertas) */}
              <EstudoRecuperacao
                transacoes={_gastos}
                contracheques={contracheques}
                descontos={descontos}
                dividas={dividas}
                usuario={usuario}
                usuarioEsposa={usuarioEsposa}
                visao={visao}
                casalSincronizado={casalSincronizado}
                mesVoce={formatarMesAno(mesVoceStr)}
                mesEsposa={formatarMesAno(mesEsposaStr)}
              />

              {/* Tabela de Prospecção */}
              <TabMeses projecao={projecao} />

              {/* Listagem de Transações do Dia a Dia + Lançamento Manual */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>💸</span> Transações Diárias (Telegram e Site)
                    </h3>
                  </div>

                  {/* Painel Analítico: Impacto no Orçamento Familiar */}
                  {visao === 'casal' && (
                    <div className="mb-6 bg-slate-950/60 border border-white/10 rounded-2xl p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span>📊</span> Impacto Real no Orçamento Familiar
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          Total Desembolsado:{' '}
                          <strong className="text-white">
                            R$ {impactoOrcamentario.totalGasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </span>
                      </div>

                      {/* Grid de Métricas de Destinação */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3">
                          <div className="flex items-center justify-between text-xs text-emerald-300">
                            <span className="font-semibold">🏠 Sustentação do Lar</span>
                            <span className="font-mono font-bold">{impactoOrcamentario.pctCasa}%</span>
                          </div>
                          <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                            R$ {impactoOrcamentario.totalCasa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-emerald-400/70 mt-0.5">
                            {impactoOrcamentario.qtdCasa} despesas essenciais da casa
                          </div>
                        </div>

                        <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-3">
                          <div className="flex items-center justify-between text-xs text-blue-300">
                            <span className="font-semibold">👤 Individual {usuario.nome ? usuario.nome.split(' ')[0] : 'Você'}</span>
                            <span className="font-mono font-bold">{impactoOrcamentario.pctPessoalVoce}%</span>
                          </div>
                          <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                            R$ {impactoOrcamentario.totalPessoalVoce.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-blue-400/70 mt-0.5">
                            {impactoOrcamentario.qtdPessoalVoce} compras pessoais individuais
                          </div>
                        </div>

                        <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3">
                          <div className="flex items-center justify-between text-xs text-purple-300">
                            <span className="font-semibold">👤 Individual {usuarioEsposa?.nome ? usuarioEsposa.nome.split(' ')[0] : 'Esposa'}</span>
                            <span className="font-mono font-bold">{impactoOrcamentario.pctPessoalEsposa}%</span>
                          </div>
                          <div className="text-lg font-bold font-mono text-purple-400 mt-1">
                            R$ {impactoOrcamentario.totalPessoalEsposa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-purple-400/70 mt-0.5">
                            {impactoOrcamentario.qtdPessoalEsposa} compras pessoais individuais
                          </div>
                        </div>
                      </div>

                      {/* Barra comparativa de impacto */}
                      <div className="space-y-1 pt-1">
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-white/5">
                          <div style={{ width: `${impactoOrcamentario.pctCasa}%` }} className="bg-emerald-500 h-full" title={`Casa: ${impactoOrcamentario.pctCasa}%`} />
                          <div style={{ width: `${impactoOrcamentario.pctPessoalVoce}%` }} className="bg-blue-500 h-full" title={`Pessoal Você: ${impactoOrcamentario.pctPessoalVoce}%`} />
                          <div style={{ width: `${impactoOrcamentario.pctPessoalEsposa}%` }} className="bg-purple-500 h-full" title={`Pessoal Esposa: ${impactoOrcamentario.pctPessoalEsposa}%`} />
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          💡 <strong className="text-emerald-300">{impactoOrcamentario.pctCasa}%</strong> das despesas mantêm a família e <strong className="text-slate-200">{impactoOrcamentario.pctPessoalVoce + impactoOrcamentario.pctPessoalEsposa}%</strong> são despesas pessoais isoladas.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Filtro Rápido por Escopo */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-5 pb-3 border-b border-white/5">
                    <span className="text-xs text-slate-400 mr-1 font-semibold">Filtrar:</span>
                    <button
                      onClick={() => setFiltroEscopoTransacao('todos')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        filtroEscopoTransacao === 'todos'
                          ? 'bg-white text-slate-950 font-bold shadow'
                          : 'bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      Todos ({gastosFiltrados.length})
                    </button>
                    <button
                      onClick={() => setFiltroEscopoTransacao('compartilhado')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        filtroEscopoTransacao === 'compartilhado'
                          ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                          : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20'
                      }`}
                    >
                      <span>🏠</span> Gastos da Casa ({impactoOrcamentario.qtdCasa})
                    </button>
                    <button
                      onClick={() => setFiltroEscopoTransacao('pessoal_voce')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                        filtroEscopoTransacao === 'pessoal_voce'
                          ? 'bg-blue-500 text-slate-950 font-bold shadow'
                          : 'bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20'
                      }`}
                    >
                      <span>👤</span> Pessoal {usuario.nome ? usuario.nome.split(' ')[0] : 'Você'} ({impactoOrcamentario.qtdPessoalVoce})
                    </button>
                    {usuarioEsposa && (
                      <button
                        onClick={() => setFiltroEscopoTransacao('pessoal_esposa')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          filtroEscopoTransacao === 'pessoal_esposa'
                            ? 'bg-purple-500 text-slate-950 font-bold shadow'
                            : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20'
                        }`}
                      >
                        <span>👤</span> Pessoal {usuarioEsposa.nome ? usuarioEsposa.nome.split(' ')[0] : 'Esposa'} ({impactoOrcamentario.qtdPessoalEsposa})
                      </button>
                    )}
                  </div>

                  {gastosExibidos.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      Nenhuma transação encontrada com os filtros selecionados.
                    </div>
                  ) : (
                    <>
                      {/* Visualização de Tabela para Desktop */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-3 pr-4">Descrição / Estabelecimento</th>
                              <th className="pb-3 pr-4">Categoria</th>
                              <th className="pb-3 pr-4">Escopo</th>
                              <th className="pb-3 pr-4">Valor</th>
                              <th className="pb-3 pr-4">Data</th>
                              <th className="pb-3 pr-4">Quem gastou</th>
                              <th className="pb-3 pr-4">Status</th>
                              <th className="pb-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-sm">
                            {gastosExibidos.map((g) => {
                              const dono = g.usuario_id === usuario.id ? 'Você' : (usuarioEsposa?.nome || 'Esposa');
                              const dataFormatada = new Date(g.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                              
                              const isReceita = g.categoria === 'receita_extra';
                              const isTransf = g.categoria === 'transferencia';
                              const isCompartilhado = isGastoCompartilhado(g);

                              return (
                                <tr key={g.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-3.5 pr-4 font-semibold text-white capitalize">{g.estabelecimento || 'Não identificado'}</td>
                                  <td className="py-3.5 pr-4 text-slate-300">
                                    <select
                                      value={g.categoria || 'outros'}
                                      onChange={(e) => alterarCategoriaGasto(g.id, e.target.value)}
                                      className="bg-slate-900/90 border border-white/10 rounded-xl px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer font-medium"
                                    >
                                      <option value="moradia" className="bg-slate-950">🏠 Moradia (Casa)</option>
                                      <option value="alimentação" className="bg-slate-950">🍔 Alimentação (Casa)</option>
                                      <option value="saúde" className="bg-slate-950">💊 Saúde / Farmácia (Casa)</option>
                                      <option value="serviços" className="bg-slate-950">🛠️ Serviços / Contas (Casa)</option>
                                      <option value="transporte" className="bg-slate-950">🚗 Transporte (Casa)</option>
                                      <option value="educação" className="bg-slate-950">🎓 Educação (Casa)</option>
                                      <option value="pessoal" className="bg-slate-950">👤 Gasto Pessoal (Individual)</option>
                                      <option value="diversão" className="bg-slate-950">🎮 Lazer / Diversão</option>
                                      <option value="compras" className="bg-slate-950">🛍️ Compras Diversas</option>
                                      <option value="investimentos" className="bg-slate-950">📈 Investimentos</option>
                                      <option value="receita_extra" className="bg-slate-950">💰 Receita Extra</option>
                                      <option value="transferencia" className="bg-slate-950">🔄 Transferência</option>
                                      <option value="outros" className="bg-slate-950">📦 Outros</option>
                                    </select>
                                  </td>
                                  <td className="py-3.5 pr-4">
                                    {isCompartilhado ? (
                                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap inline-flex items-center gap-1">
                                        <span>🏠</span> Casa
                                      </span>
                                    ) : (
                                      <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-flex items-center gap-1">
                                        <span>👤</span> Pessoal
                                      </span>
                                    )}
                                  </td>
                                  <td className={`py-3.5 pr-4 font-bold ${
                                    isReceita 
                                      ? 'text-emerald-400' 
                                      : isTransf 
                                        ? 'text-purple-400' 
                                        : 'text-rose-400'
                                  }`}>
                                    {isReceita ? '+ ' : ''}R$ {g.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3.5 pr-4 text-slate-300">{dataFormatada}</td>
                                  <td className="py-3.5 pr-4">
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                      g.usuario_id === usuario.id 
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                        : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                    }`}>
                                      {dono}
                                    </span>
                                  </td>
                                  <td className="py-3.5 pr-4">
                                    {g.confirmado ? (
                                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        Confirmado
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => confirmarGasto(g.id)}
                                        className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20 transition-colors"
                                        title="Clique para Confirmar"
                                      >
                                        Pendente (Confirmar)
                                      </button>
                                    )}
                                  </td>
                                  <td className="py-3.5 text-center">
                                    <button
                                      onClick={() => excluirGasto(g.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                      title="Excluir Lançamento"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Visualização de Cards para Mobile (Ergonômico WCAG 2.1 AA) */}
                      <div className="block sm:hidden space-y-3.5">
                        {gastosExibidos.map((g) => {
                          const dono = g.usuario_id === usuario.id ? 'Você' : (usuarioEsposa?.nome ? usuarioEsposa.nome.split(' ')[0] : 'Esposa');
                          const dataFormatada = new Date(g.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                          
                          const isReceita = g.categoria === 'receita_extra';
                          const isTransf = g.categoria === 'transferencia';

                          return (
                            <div key={g.id} className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md backdrop-blur-md">
                              {/* Top: Estabelecimento e Valor */}
                              <div className="flex justify-between items-start gap-3">
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <h4 className="font-bold text-white capitalize text-sm sm:text-base truncate" title={g.estabelecimento || ''}>
                                    {g.estabelecimento || 'Não identificado'}
                                  </h4>
                                  <span className="text-xs text-slate-400 font-medium">{dataFormatada}</span>
                                </div>
                                <span className={`text-base font-extrabold font-mono tabular-nums whitespace-nowrap ${
                                  isReceita 
                                    ? 'text-emerald-400' 
                                    : isTransf 
                                      ? 'text-purple-400' 
                                      : 'text-rose-400'
                                }`}>
                                  {isReceita ? '+ ' : ''}R$ {g.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>

                              {/* Badges de Quem Gastou, Escopo e Status */}
                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                                    g.usuario_id === usuario.id 
                                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' 
                                      : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  }`}>
                                    <span>{g.usuario_id === usuario.id ? '👤' : '👩'}</span>
                                    <span>{dono}</span>
                                  </span>

                                  {isGastoCompartilhado(g) ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>🏠</span> Casa
                                    </span>
                                  ) : (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap inline-flex items-center gap-1">
                                      <span>👤</span> Pessoal
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {g.confirmado ? (
                                    <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                      ✓ Confirmado
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => confirmarGasto(g.id)}
                                      className="text-xs px-3 py-1.5 min-h-[36px] rounded-xl font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>⚡</span>
                                      <span>Confirmar</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Rodapé: Seletor de Categoria e Botão Excluir com Touch Targets Adequados */}
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex-1">
                                  <select
                                    value={g.categoria || 'outros'}
                                    onChange={(e) => alterarCategoriaGasto(g.id, e.target.value)}
                                    className="w-full bg-slate-950/80 border border-white/15 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium min-h-[42px]"
                                  >
                                    <option value="moradia">🏠 Moradia (Casa)</option>
                                    <option value="alimentação">🍔 Alimentação (Casa)</option>
                                    <option value="saúde">💊 Saúde / Farmácia (Casa)</option>
                                    <option value="serviços">🛠️ Serviços / Contas (Casa)</option>
                                    <option value="transporte">🚗 Transporte (Casa)</option>
                                    <option value="educação">🎓 Educação (Casa)</option>
                                    <option value="pessoal">👤 Gasto Pessoal (Individual)</option>
                                    <option value="diversão">🎮 Lazer / Diversão</option>
                                    <option value="compras">🛍️ Compras Diversas</option>
                                    <option value="investimentos">📈 Investimentos</option>
                                    <option value="receita_extra">💰 Receita Extra</option>
                                    <option value="transferencia">🔄 Transferência</option>
                                    <option value="outros">📦 Outros</option>
                                  </select>
                                </div>

                                <button
                                  onClick={() => excluirGasto(g.id)}
                                  className="min-w-[42px] min-h-[42px] p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/10 rounded-xl transition-all flex items-center justify-center text-sm cursor-pointer active:scale-95"
                                  title="Excluir Lançamento"
                                  aria-label="Excluir Lançamento"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Botão de Expansão */}
                      <div className="mt-6 flex justify-center border-t border-white/5 pt-4">
                        <button
                          onClick={() => setVerTodasTransacoes(!verTodasTransacoes)}
                          className="px-6 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all active:scale-[0.98] flex items-center gap-2"
                        >
                          {verTodasTransacoes ? '👁️ Mostrar apenas últimos gastos (3 de cada)' : '👁️ Ver Todas as Transações'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="lg:col-span-1">
                  <CadastroTransacao usuarioId={usuarioAtivo.id} onSuccess={carregarDados} />
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'contracheque' && (
            <div className="animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <UploadContracheque usuarioId={usuarioAtivo.id} onUploadSuccess={carregarDados} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <span>📄</span> Contracheques Cadastrados ({visao === 'casal' ? 'Casal' : visao === 'voce' ? 'Você' : (usuarioEsposa?.nome || 'Parceiro(a)')})
                    </h3>
                    
                    {contrachequesAtivos.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        Nenhum contracheque cadastrado para esta visão.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {contrachequesAtivos.map((cc) => {
                          const dono = cc.usuario_id === usuario.id ? 'Você' : (usuarioEsposa?.nome || 'Esposa');
                          const dataFormatada = new Date(cc.mes_referencia).toLocaleDateString('pt-BR', {
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'UTC'
                          });
                          const descontosCc = descontos.filter(d => d.contracheque_id === cc.id);
                          const encargosLegais = descontosCc.filter(d => isEncargoLegal(d.tipo));
                          const consignadosEmprestimos = descontosCc.filter(d => !isEncargoLegal(d.tipo));
                          const totalEncargos = encargosLegais.reduce((acc, d) => acc + (d.valor || 0), 0);
                          const totalConsignados = consignadosEmprestimos.reduce((acc, d) => acc + (d.valor || 0), 0);
                          const totalDescontosCc = totalEncargos + totalConsignados;
                          const isExpandido = !!contrachequesExpandidos[cc.id];

                          return (
                            <div key={cc.id} className="border border-white/5 bg-slate-950/40 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/10">
                              <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => toggleContracheque(cc.id)}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-white capitalize">{dataFormatada}</span>
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                      cc.usuario_id === usuario.id 
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                        : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                    }`}>
                                      {dono}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    Salário Base / Líquido • {encargosLegais.length} encargos legais • {consignadosEmprestimos.length} consignados
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 self-end sm:self-auto">
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400">Líquido</div>
                                    <div className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
                                      R$ {cc.salario_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400">Bruto</div>
                                    <div className="text-sm font-bold text-slate-300 font-mono tabular-nums">
                                      R$ {cc.salario_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        excluirContracheque(cc.id);
                                      }}
                                      className="p-2 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                      title="Excluir Contracheque"
                                    >
                                      🗑️
                                    </button>
                                    <span className="text-slate-400 transition-transform duration-300 transform"
                                      style={{ transform: isExpandido ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                    >
                                      ▼
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {isExpandido && (
                                <div className="px-5 pb-5 pt-3 border-t border-white/5 bg-slate-950/40 space-y-4">
                                  {descontosCc.length === 0 ? (
                                    <p className="text-xs text-slate-500">Sem descontos registrados neste contracheque.</p>
                                  ) : (
                                    <>
                                      {/* Grupo 1: Encargos Legais & Estatutários */}
                                      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">⚖️</span>
                                            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                              Encargos Legais & Previdenciários
                                            </h4>
                                          </div>
                                          <span className="text-xs font-bold font-mono text-amber-400 tabular-nums">
                                            Subtotal: R$ {totalEncargos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>

                                        {encargosLegais.length === 0 ? (
                                          <p className="text-xs text-slate-500 py-1">Nenhum encargo legal registrado.</p>
                                        ) : (
                                          <div className="divide-y divide-white/5">
                                            {encargosLegais.map((d) => (
                                              <div key={d.id} className="py-2 flex items-center justify-between text-xs sm:text-sm">
                                                <span className="font-medium text-slate-200 capitalize">{d.tipo}</span>
                                                <span className="font-semibold text-amber-300 font-mono tabular-nums">
                                                  - R$ {d.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Grupo 2: Empréstimos & Consignados em Folha */}
                                      <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm">🏦</span>
                                            <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                                              Empréstimos, Consignados & Retenções
                                            </h4>
                                          </div>
                                          <span className="text-xs font-bold font-mono text-rose-400 tabular-nums">
                                            Subtotal: R$ {totalConsignados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>

                                        {consignadosEmprestimos.length === 0 ? (
                                          <p className="text-xs text-slate-500 py-1">Nenhum consignado ou retenção financeira em folha.</p>
                                        ) : (
                                          <div className="divide-y divide-white/5">
                                            {consignadosEmprestimos.map((d) => (
                                              <div key={d.id} className="py-2 flex items-center justify-between text-xs sm:text-sm">
                                                <div className="space-y-0.5 flex items-center gap-2">
                                                  <span className="font-medium text-slate-200 capitalize">{d.tipo}</span>
                                                  {d.parcela_atual && d.parcela_total && (
                                                    <span className="text-[11px] text-slate-300 bg-white/10 px-2 py-0.5 rounded-full font-mono">
                                                      Parc. {d.parcela_atual}/{d.parcela_total}
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="font-semibold text-rose-400 font-mono tabular-nums">
                                                  - R$ {d.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      {/* Totalizador Consolidado */}
                                      <div className="pt-2 flex justify-between items-center text-sm font-bold text-slate-200 px-1">
                                        <span>Total Retido em Folha:</span>
                                        <span className="text-rose-400 font-mono tabular-nums text-base">
                                          R$ {totalDescontosCc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'dividas' && (
            <div className="animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <CadastroDivida usuarioId={usuarioAtivo.id} onSuccess={carregarDados} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                    <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                      <span>💳</span> Dívidas Cadastradas ({visao === 'casal' ? 'Casal' : visao === 'voce' ? 'Você' : (usuarioEsposa?.nome || 'Parceiro(a)')})
                    </h3>

                    {dividasAba.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        Nenhuma dívida cadastrada para esta visão.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-3 pr-4">Credor</th>
                              <th className="pb-3 pr-4">Valor Total</th>
                              <th className="pb-3 pr-4">Valor Parcela</th>
                              <th className="pb-3 pr-4 text-center">Restantes</th>
                              <th className="pb-3 pr-4">Dono</th>
                              <th className="pb-3 pr-4">Tipo</th>
                              <th className="pb-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-sm">
                            {dividasAba.map((d) => {
                              const dono = d.usuario_id === null 
                                ? 'Conjunta' 
                                : (d.usuario_id === usuario.id ? 'Você' : (usuarioEsposa?.nome || 'Esposa'));
                              const totalPendente = d.valor_total || (d.valor_parcela * (d.parcelas_restantes || 1));

                              return (
                                <tr key={d.id} className="hover:bg-white/5 transition-colors">
                                  <td className="py-3.5 pr-4 font-semibold text-white">{d.credor}</td>
                                  <td className="py-3.5 pr-4 text-slate-300">
                                    R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3.5 pr-4 font-bold text-rose-400">
                                    R$ {d.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-3.5 pr-4 text-center text-slate-300">{d.parcelas_restantes ?? '-'}</td>
                                  <td className="py-3.5 pr-4">
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                      d.usuario_id === null
                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                        : d.usuario_id === usuario.id
                                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                          : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                                    }`}>
                                      {dono}
                                    </span>
                                  </td>
                                  <td className="py-3.5 pr-4">
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                                      d.ativa
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {d.ativa ? 'Manual' : 'Consignado (Em Folha)'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 text-center">
                                    <button
                                      onClick={() => excluirDivida(d.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                                      title="Excluir Dívida"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'emprestimos' && (
            <div className="animate-fadeIn">
              <PainelEmprestimos 
                descontos={descontosAtivos.map(d => ({
                  id: d.id,
                  tipo: d.tipo,
                  valor: d.valor,
                  parcela_atual: d.parcela_atual !== undefined ? d.parcela_atual : null,
                  parcela_total: d.parcela_total !== undefined ? d.parcela_total : null,
                  contracheque_id: d.contracheque_id,
                  usuario_nome: contracheques.find(c => c.id === d.contracheque_id)?.usuario_id === usuario.id ? 'Germano' : (usuarioEsposa?.nome || 'Priscila'),
                  usuario_id: contracheques.find(c => c.id === d.contracheque_id)?.usuario_id || '',
                  mes_referencia: contracheques.find(c => c.id === d.contracheque_id)?.mes_referencia || ''
                }))}
                dividas={dividas.filter(d => visao === 'casal' || d.usuario_id === null || d.usuario_id === usuarioAtivo.id).map(d => ({
                  id: d.id,
                  credor: d.credor,
                  valor_total: d.valor_total !== undefined ? d.valor_total : null,
                  valor_parcela: d.valor_parcela,
                  parcelas_restantes: d.parcelas_restantes !== undefined ? d.parcelas_restantes : null,
                  usuario_id: d.usuario_id !== undefined ? d.usuario_id : null,
                  usuario_nome: d.usuario_id === null ? 'Conjunta' : d.usuario_id === usuario.id ? 'Germano' : (usuarioEsposa?.nome || 'Priscila')
                }))}
                visao={visao}
              />
            </div>
          )}

          {abaAtiva === 'relatorio' && (
            <div className="animate-fadeIn">
              <RelatorioMensal 
                contracheques={contrachequesAtivos.map(c => ({
                  id: c.id,
                  mes_referencia: c.mes_referencia,
                  salario_bruto: c.salario_bruto || 0,
                  salario_liquido: c.salario_liquido || 0,
                  usuario_nome: c.usuario_id === usuario.id ? 'Germano' : (usuarioEsposa?.nome || 'Priscila'),
                  usuario_id: c.usuario_id
                }))}
                gastos={gastosFiltrados.map(g => ({
                  id: g.id,
                  valor: g.valor,
                  estabelecimento: g.estabelecimento || 'Não identificado',
                  categoria: g.categoria || 'outros',
                  data: g.data,
                  confirmado: g.confirmado,
                  usuario_nome: g.usuario_id === usuario.id ? 'Germano' : (usuarioEsposa?.nome || 'Priscila'),
                  usuario_id: g.usuario_id
                }))}
                dividas={dividasAtivas.map(d => ({
                  id: d.id,
                  credor: d.credor,
                  valor_parcela: d.valor_parcela,
                  usuario_id: d.usuario_id !== undefined ? d.usuario_id : null,
                  usuario_nome: d.usuario_id === null ? 'Conjunta' : d.usuario_id === usuario.id ? 'Germano' : (usuarioEsposa?.nome || 'Priscila')
                }))}
                visao={visao}
              />
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

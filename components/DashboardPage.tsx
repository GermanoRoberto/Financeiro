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
import CadastroTransacao from '@/components/CadastroTransacao';
import PainelEmprestimos from '@/components/PainelEmprestimos';
import RelatorioMensal from '@/components/RelatorioMensal';
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

  // Filtrar contracheques conforme a visão
  const contrachequesAtivos = contracheques.filter((c) => {
    if (visao === 'casal') return true;
    return c.usuario_id === usuarioAtivo.id;
  });

  // Obter o contracheque mais recente para calcular o resumo do mês atual
  const ultimoMes = contrachequesAtivos[0]?.mes_referencia;
  const contrachequesMesAtual = contrachequesAtivos.filter(
    (c) => c.mes_referencia === ultimoMes
  );

  const salarioBruto = contrachequesMesAtual.reduce((acc, c) => acc + (c.salario_bruto || 0), 0);
  const salarioLiquido = contrachequesMesAtual.reduce((acc, c) => acc + (c.salario_liquido || 0), 0);

  // Filtrar descontos conforme a visão
  const descontosAtivos = descontos.filter((d: any) => {
    const contrachequeObj = d.contracheque;
    const contrachequeUserId = contrachequeObj?.usuario_id;
    if (visao === 'casal') return true;
    return contrachequeUserId === usuarioAtivo.id;
  });

  // Filtrar dividas conforme a visão (apenas ativas para projeção de caixa)
  const dividasAtivas = dividas.filter((d) => {
    if (!d.ativa) return false;
    if (visao === 'casal') return true;
    if (d.usuario_id === null) return true; // dívida conjunta
    return d.usuario_id === usuarioAtivo.id;
  });

  // Filtrar gastos conforme a visão
  const gastosFiltrados = _gastos.filter((g) => {
    if (visao === 'casal') return true;
    return g.usuario_id === usuarioAtivo.id;
  });

  const totalDescontos = descontosAtivos.reduce((acc, d) => acc + (d.valor || 0), 0);
  const comprometimento = calcularComprometimento(totalDescontos, salarioBruto);

  const projecao = projetarDescontos(descontosAtivos, dividasAtivas, salarioBruto, 12);

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
          {/* Seletor de Visão */}
          <SeletorVisao visao={visao} onChange={setVisao} temEsposa={!!usuarioEsposa} nomeParceiro={usuarioEsposa?.nome} />

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

              {/* Listagem de Transações do Dia a Dia + Lançamento Manual */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span>💸</span> Transações Diárias (Telegram e Site)
                  </h3>

                  {gastosFiltrados.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      Nenhuma transação registrada para esta visão.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <th className="pb-3 pr-4">Descrição / Estabelecimento</th>
                            <th className="pb-3 pr-4">Categoria</th>
                            <th className="pb-3 pr-4">Valor</th>
                            <th className="pb-3 pr-4">Data</th>
                            <th className="pb-3 pr-4">Quem gastou</th>
                            <th className="pb-3 pr-4">Status</th>
                            <th className="pb-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm">
                          {gastosFiltrados.map((g) => {
                            const dono = g.usuario_id === usuario.id ? 'Você' : (usuarioEsposa?.nome || 'Esposa');
                            const dataFormatada = new Date(g.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                            
                            const emojisMap: any = {
                              'alimentação': '🍔',
                              'transporte': '🚗',
                              'saúde': '💊',
                              'diversão': '🎮',
                              'receita_extra': '💰',
                              'transferencia': '🔄',
                              'outros': '📦'
                            };
                            const emoji = emojisMap[g.categoria || 'outros'] || '📦';

                            const isReceita = g.categoria === 'receita_extra';
                            const isTransf = g.categoria === 'transferencia';

                            return (
                              <tr key={g.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3.5 pr-4 font-semibold text-white capitalize">{g.estabelecimento || 'Não identificado'}</td>
                                <td className="py-3.5 pr-4 text-slate-300 capitalize flex items-center gap-1.5">
                                  <span>{emoji}</span> <span>{g.categoria?.replace('_', ' ') || 'outros'}</span>
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
                          const totalDescontosCc = descontosCc.reduce((acc, d) => acc + (d.valor || 0), 0);
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
                                    Salário Base / Líquido e {descontosCc.length} descontos
                                  </div>
                                </div>

                                <div className="flex items-center gap-6 self-end sm:self-auto">
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400">Líquido</div>
                                    <div className="text-sm font-bold text-emerald-400">
                                      R$ {cc.salario_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-xs text-slate-400">Bruto</div>
                                    <div className="text-sm font-bold text-slate-300">
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
                                <div className="px-5 pb-5 pt-2 border-t border-white/5 bg-slate-950/20">
                                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Detalhamento de Descontos</h4>
                                  {descontosCc.length === 0 ? (
                                    <p className="text-xs text-slate-500">Sem descontos registrados neste contracheque.</p>
                                  ) : (
                                    <div className="divide-y divide-white/5">
                                      {descontosCc.map((d) => (
                                        <div key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                                          <div className="space-y-0.5">
                                            <span className="font-semibold text-slate-200 capitalize">{d.tipo}</span>
                                            {d.parcela_atual && d.parcela_total && (
                                              <span className="ml-2 text-xs text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                                                Parc. {d.parcela_atual}/{d.parcela_total}
                                              </span>
                                            )}
                                          </div>
                                          <span className="font-bold text-rose-400">
                                            R$ {d.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="pt-3 flex justify-between text-sm font-bold text-slate-300">
                                        <span>Total Descontos</span>
                                        <span className="text-rose-400">
                                          R$ {totalDescontosCc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                      </div>
                                    </div>
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

                    {dividasAtivas.length === 0 ? (
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
                              <th className="pb-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-sm">
                            {dividasAtivas.map((d) => {
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

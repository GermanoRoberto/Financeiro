'use client';

import { round2, somarValores } from '@/lib/money';

interface DescontoEmp {
  id: string;
  tipo: string;
  valor: number;
  parcela_atual: number | null;
  parcela_total: number | null;
  contracheque_id: string;
  usuario_nome: string;
  usuario_id: string;
  mes_referencia: string;
}

interface DividaEmp {
  id: string;
  credor: string;
  valor_total: number | null;
  valor_parcela: number;
  parcelas_restantes: number | null;
  usuario_id: string | null;
  usuario_nome: string;
}

interface PainelEmprestimosProps {
  descontos: DescontoEmp[];
  dividas: DividaEmp[];
  visao: 'casal' | 'voce' | 'esposa';
}

export default function PainelEmprestimos({ descontos, dividas, visao: _visao }: PainelEmprestimosProps) {
  // 1. Filtrar descontos que são empréstimos / parcelamentos (têm parcela_total ou contêm palavras-chave de empréstimos)
  const emprestimosContracheque = descontos.filter(
    (d) => 
      (d.parcela_total !== null && d.parcela_total > 0) || 
      d.tipo.toUpperCase().includes('EMPRÉSTIMO') || 
      d.tipo.toUpperCase().includes('EMPRESTIMO') ||
      d.tipo.toUpperCase().includes('CONSIGNADO') ||
      d.tipo.toUpperCase().includes('FINANCIAMENTO') ||
      d.tipo.toUpperCase().includes('CEF')
  );

  // 2. Filtrar dívidas que são parcelamentos (têm parcelas_restantes)
  const dividasParceladas = dividas.filter(
    (d) => d.parcelas_restantes && d.parcelas_restantes > 0
  );

  // Calcular totais com precisão centesimal
  const totalContrachequeRestante = somarValores(
    emprestimosContracheque.map((d) => {
      const temParcelas = d.parcela_total !== null && d.parcela_total > 0;
      const atual = d.parcela_atual || 1;
      const total = d.parcela_total || 1;
      const restantes = temParcelas ? (total - atual + 1) : 1;
      return round2(d.valor * restantes);
    })
  );

  const totalDividasRestante = somarValores(
    dividasParceladas.map((d) => {
      const parcelas = d.parcelas_restantes || 0;
      return round2(d.valor_parcela * parcelas);
    })
  );

  const totalGeralRestante = somarValores([totalContrachequeRestante, totalDividasRestante]);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-950/40 border border-white/10 border-l-4 border-l-blue-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            Saldo devedor (Holerite)
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            R$ {totalContrachequeRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Descontos consignados em folha ativos
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-950/40 border border-white/10 border-l-4 border-l-indigo-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            Saldo devedor (Manuais)
          </div>
          <div className="text-2xl font-bold text-white font-mono tabular-nums">
            R$ {totalDividasRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Dívidas externas parceladas ativas
          </div>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-950/40 border border-white/10 border-l-4 border-l-purple-500 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">
            Total Devedor Geral
          </div>
          <div className="text-2xl font-bold text-purple-400 font-mono tabular-nums">
            R$ {totalGeralRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Soma de todos os empréstimos e parcelamentos
          </div>
        </div>
      </div>

      {/* Empréstimos em Holerite */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-950/40 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>💼</span> Empréstimos Consignados (Contracheque)
        </h3>
        
        {emprestimosContracheque.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum empréstimo consignado ativo localizado.</p>
        ) : (
          <>
            {/* Lista Mobile (Cards com touch target >= 44px) */}
            <div className="block md:hidden space-y-3">
              {emprestimosContracheque.map((emp) => {
                const temParcelas = emp.parcela_total !== null && emp.parcela_total > 0;
                const atual = emp.parcela_atual || 1;
                const total = emp.parcela_total || 1;
                const restantes = temParcelas ? (total - atual + 1) : 1;
                const saldoDevedor = round2(emp.valor * restantes);
                const percent = temParcelas ? Math.min(100, Math.round((atual / total) * 100)) : 0;

                return (
                  <div key={`m-${emp.id}`} className="p-4 rounded-2xl bg-slate-950/50 border border-white/10 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-full text-xxs font-bold uppercase tracking-wide ${
                        emp.usuario_nome === 'Germano' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                      }`}>
                        {emp.usuario_nome}
                      </span>
                      <span className="text-sm font-bold text-white font-mono tabular-nums">
                        {temParcelas ? `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Sob consulta'}
                      </span>
                    </div>

                    <div className="font-semibold text-white text-sm leading-snug">
                      {emp.tipo}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>Parcela mensal:</span>
                      <span className="font-bold text-slate-200 font-mono tabular-nums">R$ {emp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {temParcelas ? (
                      <div className="pt-2 border-t border-white/5 flex flex-col gap-1.5">
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              emp.usuario_nome === 'Germano' ? 'bg-blue-500' : 'bg-pink-500'
                            }`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xxs text-slate-400 font-medium">
                          <span>{atual} de {total} parcelas</span>
                          <span>{percent}% quitado</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1 text-xxs text-slate-400 italic">
                        Desconto mensal fixo / Sob consulta
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Dono</th>
                    <th className="pb-3 font-semibold">Credor/Contrato</th>
                    <th className="pb-3 font-semibold">Parcela Mensal</th>
                    <th className="pb-3 font-semibold text-center">Progresso</th>
                    <th className="pb-3 font-semibold text-right">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-sm">
                  {emprestimosContracheque.map((emp) => {
                    const temParcelas = emp.parcela_total !== null && emp.parcela_total > 0;
                    const atual = emp.parcela_atual || 1;
                    const total = emp.parcela_total || 1;
                    const restantes = temParcelas ? (total - atual + 1) : 1;
                    const saldoDevedor = round2(emp.valor * restantes);
                    const percent = temParcelas ? Math.min(100, Math.round((atual / total) * 100)) : 0;

                    return (
                      <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xxs font-bold uppercase ${
                            emp.usuario_nome === 'Germano' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                          }`}>
                            {emp.usuario_nome}
                          </span>
                        </td>
                        <td className="py-4 font-semibold text-white">
                          {emp.tipo}
                        </td>
                        <td className="py-4 text-slate-300 font-mono tabular-nums">
                          R$ {emp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4">
                          {temParcelas ? (
                            <div className="flex flex-col items-center justify-center gap-1 min-w-[120px]">
                              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${
                                    emp.usuario_nome === 'Germano' ? 'bg-blue-500' : 'bg-pink-500'
                                  }`} 
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-slate-400 text-xxs font-semibold">
                                {atual} de {total} parcelas ({percent}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Desconto mensal fixo / Sob consulta</span>
                          )}
                        </td>
                        <td className="py-4 text-right font-bold text-white font-mono tabular-nums">
                          {temParcelas ? (
                            `R$ ${saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          ) : (
                            <span className="text-slate-400 font-normal italic">Sob consulta</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Parcelamentos Manuais */}
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl shadow-slate-950/40 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>💳</span> Parcelamentos de Dívidas Externas
        </h3>

        {dividasParceladas.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum parcelamento externo ativo localizado.</p>
        ) : (
          <>
            {/* Lista Mobile (Cards com touch target >= 44px) */}
            <div className="block md:hidden space-y-3">
              {dividasParceladas.map((div) => {
                const restantes = div.parcelas_restantes || 0;
                const saldoDevedor = round2(div.valor_parcela * restantes);

                return (
                  <div key={`m-${div.id}`} className="p-4 rounded-2xl bg-slate-950/50 border border-white/10 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className={`px-2.5 py-1 rounded-full text-xxs font-bold uppercase tracking-wide ${
                        div.usuario_nome === 'Conjunta'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                          : div.usuario_nome === 'Germano'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                      }`}>
                        {div.usuario_nome}
                      </span>
                      <span className="text-sm font-bold text-white font-mono tabular-nums">
                        R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="font-semibold text-white text-sm leading-snug">
                      {div.credor}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>Valor da parcela:</span>
                      <span className="font-bold text-slate-200 font-mono tabular-nums">R$ {div.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Parcelas restantes:</span>
                      <span className="font-semibold text-slate-200">{restantes} {restantes === 1 ? 'mês' : 'meses'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3 font-semibold">Dono</th>
                    <th className="pb-3 font-semibold">Credor / Cartão</th>
                    <th className="pb-3 font-semibold">Valor da Parcela</th>
                    <th className="pb-3 font-semibold text-center">Restantes</th>
                    <th className="pb-3 font-semibold text-right">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-sm">
                  {dividasParceladas.map((div) => {
                    const restantes = div.parcelas_restantes || 0;
                    const saldoDevedor = round2(div.valor_parcela * restantes);

                    return (
                      <tr key={div.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xxs font-bold uppercase ${
                            div.usuario_nome === 'Conjunta'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : div.usuario_nome === 'Germano'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-pink-500/10 text-pink-400 border border-pink-500/20'
                          }`}>
                            {div.usuario_nome}
                          </span>
                        </td>
                        <td className="py-4 font-semibold text-white">
                          {div.credor}
                        </td>
                        <td className="py-4 text-slate-300 font-mono tabular-nums">
                          R$ {div.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 text-center font-semibold text-slate-300">
                          {restantes} meses
                        </td>
                        <td className="py-4 text-right font-bold text-white font-mono tabular-nums">
                          R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

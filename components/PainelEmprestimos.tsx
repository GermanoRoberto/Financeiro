'use client';

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
  // 1. Filtrar descontos que são empréstimos / parcelamentos (têm parcela_total)
  const emprestimosContracheque = descontos.filter(
    (d) => d.parcela_total && d.parcela_total > 0 && d.parcela_atual !== null
  );

  // 2. Filtrar dívidas que são parcelamentos (têm parcelas_restantes)
  const dividasParceladas = dividas.filter(
    (d) => d.parcelas_restantes && d.parcelas_restantes > 0
  );

  // Calcular totais
  const totalContrachequeRestante = emprestimosContracheque.reduce((acc, d) => {
    const atual = d.parcela_atual || 1;
    const total = d.parcela_total || 1;
    const restantes = total - atual + 1;
    return acc + d.valor * restantes;
  }, 0);

  const totalDividasRestante = dividasParceladas.reduce((acc, d) => {
    const parcelas = d.parcelas_restantes || 0;
    return acc + d.valor_parcela * parcelas;
  }, 0);

  const totalGeralRestante = totalContrachequeRestante + totalDividasRestante;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border-l-4 border-blue-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Saldo devedor (Holerite)
          </div>
          <div className="text-2xl font-bold text-slate-800">
            R$ {totalContrachequeRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Descontos consignados em folha ativos
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border-l-4 border-indigo-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Saldo devedor (Manuais)
          </div>
          <div className="text-2xl font-bold text-slate-800">
            R$ {totalDividasRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Dívidas externas parceladas ativas
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 shadow-sm border-l-4 border-purple-600 hover:-translate-y-0.5 transition-all duration-300">
          <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            Total Devedor Geral
          </div>
          <div className="text-2xl font-bold text-purple-700">
            R$ {totalGeralRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Soma de todos os empréstimos e parcelamentos
          </div>
        </div>
      </div>

      {/* Empréstimos em Holerite */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>💼</span> Empréstimos Consignados (Contracheque)
        </h3>
        
        {emprestimosContracheque.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum empréstimo consignado ativo localizado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Dono</th>
                  <th className="pb-3 font-semibold">Credor/Contrato</th>
                  <th className="pb-3 font-semibold">Parcela Mensal</th>
                  <th className="pb-3 font-semibold text-center">Progresso</th>
                  <th className="pb-3 font-semibold text-right">Saldo Devedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {emprestimosContracheque.map((emp) => {
                  const atual = emp.parcela_atual || 1;
                  const total = emp.parcela_total || 1;
                  const restantes = total - atual + 1;
                  const saldoDevedor = emp.valor * restantes;
                  const percent = Math.min(100, Math.round((atual / total) * 100));

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xxs font-bold uppercase ${
                          emp.usuario_nome === 'Germano' 
                            ? 'bg-blue-50 text-blue-600' 
                            : 'bg-pink-50 text-pink-600'
                        }`}>
                          {emp.usuario_nome}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-slate-800">
                        {emp.tipo}
                      </td>
                      <td className="py-4 text-slate-600">
                        R$ {emp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col items-center justify-center gap-1 min-w-[120px]">
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
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
                      </td>
                      <td className="py-4 text-right font-bold text-slate-800">
                        R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Parcelamentos Manuais */}
      <div className="bg-white rounded-3xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span>💳</span> Parcelamentos de Dívidas Externas
        </h3>

        {dividasParceladas.length === 0 ? (
          <p className="text-slate-400 text-sm">Nenhum parcelamento externo ativo localizado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Dono</th>
                  <th className="pb-3 font-semibold">Credor / Cartão</th>
                  <th className="pb-3 font-semibold">Valor da Parcela</th>
                  <th className="pb-3 font-semibold text-center">Restantes</th>
                  <th className="pb-3 font-semibold text-right">Saldo Devedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                {dividasParceladas.map((div) => {
                  const restantes = div.parcelas_restantes || 0;
                  const saldoDevedor = div.valor_parcela * restantes;

                  return (
                    <tr key={div.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-xxs font-bold uppercase ${
                          div.usuario_nome === 'Conjunta'
                            ? 'bg-purple-50 text-purple-600'
                            : div.usuario_nome === 'Germano'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-pink-50 text-pink-600'
                        }`}>
                          {div.usuario_nome}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-slate-800">
                        {div.credor}
                      </td>
                      <td className="py-4 text-slate-600">
                        R$ {div.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 text-center font-semibold text-slate-500">
                        {restantes} meses
                      </td>
                      <td className="py-4 text-right font-bold text-slate-800">
                        R$ {saldoDevedor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
  );
}

import { Desconto, Divida } from './types';
import { addMonths, startOfMonth } from 'date-fns';
import { round2, somarValores } from './money';

export interface ProjecaoMes {
  mes: Date;
  mesFormatado: string;
  descontos: Desconto[];
  dividas: Divida[];
  totalDescontos: number;
  totalDividas: number;
  totalGeral: number;
  salarioBruto: number;
}

export function projetarDescontos(
  descontos: Desconto[],
  dividas: Divida[],
  _salarioBruto: number = 0,
  mesesAFrente: number = 12
): ProjecaoMes[] {
  const meses: ProjecaoMes[] = [];
  const hoje = startOfMonth(new Date());

  // Mapear se o usuário possui contratos de consignados ativos na tabela de dívidas
  const usuarioIdsComConsignado = new Set(
    dividas.filter((d) => !d.ativa).map((d) => d.usuario_id)
  );

  for (let i = 0; i < mesesAFrente; i++) {
    const mes = addMonths(hoje, i);
    const mesFormatado = new Date(mes).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });

    // 1. Filtrar descontos puros em folha (impostos, planos de saúde) - NÃO inclui empréstimos
    const descontosDoMes = descontos.filter((d) => {
      if (!d.confirmado) return false;

      const tipoLower = (d.tipo || '').toLowerCase();
      const ehEmprestimo = tipoLower.includes('empréstimo') || 
                           tipoLower.includes('consignado') || 
                           tipoLower.includes('cef') || 
                           tipoLower.includes('crédito trabalhador');

      if (ehEmprestimo) return false; // Ignora empréstimo desta lista de descontos

      if (!d.recorrente) return i === 0; // não recorrente só no primeiro mês
      if (d.parcela_total) {
        const restantes = (d.parcela_total || 0) - (d.parcela_atual || 0);
        return i < restantes;
      }
      return true; // recorrente indefinido
    });

    // 2. Coletar descontos de empréstimos em folha para projetar como dívidas (apenas se não detalhados na tabela dividas)
    const descontosEmprestimoComoDivida = descontos.filter((d) => {
      if (!d.confirmado) return false;

      const tipoLower = (d.tipo || '').toLowerCase();
      const ehEmprestimo = tipoLower.includes('empréstimo') || 
                           tipoLower.includes('consignado') || 
                           tipoLower.includes('cef') || 
                           tipoLower.includes('crédito trabalhador');

      if (!ehEmprestimo) return false;

      // Obter ID do usuário do contracheque
      const cc = (d as any).contracheque;
      const usuarioId = cc?.usuario_id || null;

      // Se o usuário tem contratos de consignados cadastrados na tabela 'dividas',
      // nós ignoramos o desconto de folha para evitar dupla contagem, projetando apenas as parcelas exatas da tabela
      if (usuarioId && usuarioIdsComConsignado.has(usuarioId)) {
        return false;
      }

      if (!d.recorrente) {
        if (!d.parcela_total) return true; // Forçar recorrência padrão de empréstimo
      }

      if (d.parcela_total) {
        const restantes = (d.parcela_total || 0) - (d.parcela_atual || 0);
        return i < restantes;
      }
      return true;
    });

    // 3. Filtrar dívidas da tabela (manuais ativas + consignadas inativas) válidas para este mês
    // e reduzir a quantidade de parcelas restantes conforme os meses passam
    const dividasDoMes = dividas.filter((d) => {
      return d.parcelas_restantes > i;
    }).map((d) => ({
      ...d,
      parcelas_restantes: Math.max(0, d.parcelas_restantes - i)
    }));

    const totalDescontos = somarValores(descontosDoMes.map((d) => d.valor || 0));
    const totalDividasTabela = somarValores(dividasDoMes.map((d) => d.valor_parcela || 0));
    const totalDividasHolerite = somarValores(descontosEmprestimoComoDivida.map((d) => d.valor || 0));
    const totalDividas = somarValores([totalDividasTabela, totalDividasHolerite]);

    // Criar representações virtuais para empréstimos em folha não detalhados (ex: Priscila)
    // Reduzindo as parcelas restantes virtuais também
    const dividasVirtuais: Divida[] = descontosEmprestimoComoDivida.map((d) => {
      const totalPart = d.parcela_total || 12;
      const atualPart = d.parcela_atual || 1;
      const restantesHoje = Math.max(0, totalPart - atualPart + 1);
      return {
        id: d.id,
        usuario_id: (d as any).contracheque?.usuario_id || null,
        credor: `Consignado em Folha: ${d.tipo}`,
        valor_total: round2(d.valor * restantesHoje),
        valor_parcela: round2(d.valor),
        parcelas_restantes: Math.max(0, restantesHoje - i),
        vencimento_dia: 10,
        ativa: false,
        criado_em: d.criado_em,
      };
    });

    meses.push({
      mes,
      mesFormatado,
      descontos: descontosDoMes,
      dividas: [...dividasDoMes, ...dividasVirtuais],
      totalDescontos,
      totalDividas,
      totalGeral: somarValores([totalDescontos, totalDividas]),
      salarioBruto: _salarioBruto,
    });
  }

  return meses;
}

export function calcularComprometimento(
  totalDescontos: number,
  salarioBruto: number
): number {
  if (salarioBruto <= 0) return 0;
  return round2((totalDescontos / salarioBruto) * 100);
}

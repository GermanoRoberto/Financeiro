import { Desconto, Divida } from './types';
import { addMonths, startOfMonth } from 'date-fns';

export interface ProjecaoMes {
  mes: Date;
  mesFormatado: string;
  descontos: Desconto[];
  dividas: Divida[];
  totalDescontos: number;
  totalDividas: number;
  totalGeral: number;
}

export function projetarDescontos(
  descontos: Desconto[],
  dividas: Divida[],
  _salarioBruto: number = 0,
  mesesAFrente: number = 12
): ProjecaoMes[] {
  const meses: ProjecaoMes[] = [];
  const hoje = startOfMonth(new Date());

  for (let i = 0; i < mesesAFrente; i++) {
    const mes = addMonths(hoje, i);
    const mesFormatado = new Date(mes).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
    });

    // Filtrar descontos válidos para este mês
    const descontosDoMes = descontos.filter((d) => {
      if (!d.confirmado) return false;
      if (!d.recorrente) return i === 0; // não recorrente só no primeiro mês
      if (d.parcela_total) {
        const restantes = (d.parcela_total || 0) - (d.parcela_atual || 0);
        return i < restantes;
      }
      return true; // recorrente indefinido
    });

    // Filtrar dívidas ativas para este mês
    const dividasDoMes = dividas.filter((d) => {
      return d.ativa && (d.parcelas_restantes > i);
    });

    const totalDescontos = descontosDoMes.reduce((acc, d) => acc + (d.valor || 0), 0);
    const totalDividas = dividasDoMes.reduce((acc, d) => acc + (d.valor_parcela || 0), 0);

    meses.push({
      mes,
      mesFormatado,
      descontos: descontosDoMes,
      dividas: dividasDoMes,
      totalDescontos,
      totalDividas,
      totalGeral: totalDescontos + totalDividas,
    });
  }

  return meses;
}

export function calcularComprometimento(
  totalDescontos: number,
  salarioBruto: number
): number {
  if (salarioBruto <= 0) return 0;
  return (totalDescontos / salarioBruto) * 100;
}

/**
 * Módulo de Aritmética Financeira e Precisão Centesimal
 * Garante a eliminação de resíduos de ponto flutuante binário IEEE 754 (ex: 0.1 + 0.2 = 0.30000000000000004)
 */

export function round2(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function somarValores(valores: number[]): number {
  const soma = valores.reduce((acc, v) => acc + (typeof v === 'number' && !isNaN(v) ? v : 0), 0);
  return round2(soma);
}

export function multiplicarValores(a: number, b: number): number {
  return round2((a || 0) * (b || 0));
}

export function subtrairValores(a: number, b: number): number {
  return round2((a || 0) - (b || 0));
}

export function formatarBRL(valor: number): string {
  const limpo = round2(valor);
  return limpo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

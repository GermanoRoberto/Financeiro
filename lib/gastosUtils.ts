import { GastoDiario } from './types';

/**
 * Identifica se uma transação é pagamento/liquidação de fatura de cartão de crédito,
 * evitando dupla contagem no fluxo de caixa quando as compras individuais do cartão já existem.
 */
export function isLiquidacaoCartao(g: GastoDiario): boolean {
  const desc = (g.estabelecimento || '').toLowerCase();
  const cat = (g.categoria || '').toLowerCase();

  return (
    cat === 'liquidacao_cartao' ||
    desc.includes('pgto fatura') ||
    desc.includes('pagamento de fatura') ||
    desc.includes('pgto min latam') ||
    desc.includes('pagamento fatura') ||
    desc.includes('pagamento cartao') ||
    desc.includes('pgto cartao')
  );
}

/**
 * Identifica se uma transação é transferência entre contas ou entre os cônjuges.
 */
export function isTransferenciaInterna(g: GastoDiario): boolean {
  const cat = (g.categoria || '').toLowerCase();
  const desc = (g.estabelecimento || '').toLowerCase();

  if (cat === 'transferencia') return true;

  return (
    desc.includes('germano roberto') ||
    desc.includes('priscila aparecida') ||
    desc.includes('pix qrs germano') ||
    desc.includes('transferência enviada pelo pix - germano') ||
    desc.includes('transferência recebida pelo pix - germano')
  );
}

/**
 * Classifica se uma despesa é de responsabilidade compartilhada do casal
 * ou se é um gasto estritamente pessoal/individual.
 * 
 * - Compartilhado: Moradia (prestação Caixa, condomínio), Alimentação, Saúde/Farmácia, Educação, Serviços da casa, Transporte.
 * - Pessoal: Cursos particulares (Hotmart), vestuário/estética pessoal, compras avulsas não essenciais.
 */
export function isGastoCompartilhado(g: GastoDiario): boolean {
  // Se for receita ou transferência, não entra no rateio
  const cat = (g.categoria || '').toLowerCase();
  if (cat === 'receita_extra' || cat === 'transferencia' || isTransferenciaInterna(g)) {
    return false;
  }

  // Liquidação de fatura no banco não entra diretamente para não duplicar compras
  if (isLiquidacaoCartao(g)) {
    return false;
  }

  // Se tiver escopo explícito
  if (g.escopo === 'pessoal') return false;
  if (g.escopo === 'casal') return true;

  const desc = (g.estabelecimento || '').toLowerCase();

  // Gastos comprovadamente pessoais/individuais
  if (
    desc.includes('hotmart') ||
    desc.includes('marcela campos') ||
    desc.includes('maria luiza iung') ||
    desc.includes('shoppee') ||
    desc.includes('shopee') ||
    cat === 'pessoal'
  ) {
    return false;
  }

  // Categorias essenciais da casa são compartilhadas por padrão
  if (
    cat === 'moradia' ||
    cat === 'alimentação' ||
    cat === 'saúde' ||
    cat === 'serviços' ||
    cat === 'educação' ||
    cat === 'transporte'
  ) {
    return true;
  }

  // Estabelecimentos essenciais de sustento da família reconhecidos mesmo se categoria estiver 'outros'
  if (
    desc.includes('bahamas') ||
    desc.includes('supermercado') ||
    desc.includes('mercado') ||
    desc.includes('carrefour') ||
    desc.includes('padaria') ||
    desc.includes('lisboa') ||
    desc.includes('drogaria') ||
    desc.includes('farmacia') ||
    desc.includes('araujo') ||
    desc.includes('ifood') ||
    desc.includes('churrasco') ||
    desc.includes('posto') ||
    desc.includes('combustivel') ||
    desc.includes('cemig') ||
    desc.includes('copasa') ||
    desc.includes('claro') ||
    desc.includes('vivo')
  ) {
    return true;
  }

  // Demais compras avulsas não identificadas são tratadas como pessoais
  return false;
}

/**
 * Retorna se um desconto em folha representa desembolso compartilhado
 * (ex: consignados, empréstimos, coparticipação de saúde familiar),
 * excluindo retenções tributárias e previdenciárias governamentais (INSS, IRRF, FPM).
 */
export function isDescontoCompartilhavel(tipo?: string, descricao?: string): boolean {
  const texto = `${tipo || ''} ${descricao || ''}`.toLowerCase();

  if (
    texto.includes('inss') ||
    texto.includes('irrf') ||
    texto.includes('imposto') ||
    texto.includes('previd') ||
    texto.includes('rpps') ||
    texto.includes('fpm') ||
    texto.includes('sindic') ||
    texto.includes('contribuicao negocial') ||
    texto.includes('desc arred')
  ) {
    return false;
  }

  return true;
}


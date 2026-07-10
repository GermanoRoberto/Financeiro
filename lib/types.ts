export type Usuario = {
  id: string;
  email: string;
  nome: string;
  user_id?: string;
  telegram_chat_id?: number;
  criado_em: string;
};

export type Contracheque = {
  id: string;
  usuario_id: string;
  mes_referencia: string;
  salario_bruto?: number;
  salario_liquido?: number;
  dados_brutos?: any;
  criado_em: string;
};

export type Desconto = {
  id: string;
  contracheque_id: string;
  tipo: string;
  valor: number;
  parcela_atual?: number;
  parcela_total?: number;
  recorrente: boolean;
  confirmado: boolean;
  criado_em: string;
};

export type Divida = {
  id: string;
  usuario_id?: string;
  credor: string;
  valor_total?: number;
  valor_parcela: number;
  parcelas_restantes: number;
  vencimento_dia?: number;
  ativa: boolean;
  criado_em: string;
};

export type GastoDiario = {
  id: string;
  usuario_id: string;
  valor: number;
  estabelecimento?: string;
  categoria?: string;
  data: string;
  origem: string;
  confirmado: boolean;
  criado_em: string;
};

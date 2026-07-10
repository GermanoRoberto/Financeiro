-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lista fechada de usuários autorizados
CREATE TABLE usuarios_permitidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  user_id UUID UNIQUE, -- preenchido com auth.uid() no primeiro login válido
  telegram_chat_id BIGINT UNIQUE,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Contracheques (metadados + valores, nunca o arquivo original)
CREATE TABLE contracheques (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios_permitidos(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL, -- primeiro dia do mês, ex: 2026-07-01
  salario_bruto NUMERIC(12,2),
  salario_liquido NUMERIC(12,2),
  dados_brutos JSONB, -- resposta original do Gemini (para auditoria)
  criado_em TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id, mes_referencia)
);

-- Descontos extraídos de cada contracheque
CREATE TABLE descontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contracheque_id UUID NOT NULL REFERENCES contracheques(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- ex: 'consignado', 'plano_saude', 'inss', 'vale'
  valor NUMERIC(12,2) NOT NULL,
  parcela_atual INT,
  parcela_total INT,
  recorrente BOOLEAN DEFAULT true,
  confirmado BOOLEAN DEFAULT false, -- marca se foi confirmado pelo usuário
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Dívidas cadastradas manualmente (fora do contracheque)
CREATE TABLE dividas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios_permitidos(id) ON DELETE CASCADE, -- null = dívida conjunta
  credor TEXT NOT NULL,
  valor_total NUMERIC(12,2),
  valor_parcela NUMERIC(12,2) NOT NULL,
  parcelas_restantes INT,
  vencimento_dia INT, -- dia do mês, 1-31
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Gastos do dia a dia, capturados via Telegram
CREATE TABLE gastos_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES usuarios_permitidos(id) ON DELETE CASCADE,
  valor NUMERIC(12,2) NOT NULL,
  estabelecimento TEXT,
  categoria TEXT,
  data DATE NOT NULL,
  origem TEXT DEFAULT 'telegram', -- 'telegram' ou 'web'
  confirmado BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_contracheques_usuario ON contracheques(usuario_id);
CREATE INDEX idx_contracheques_mes ON contracheques(mes_referencia);
CREATE INDEX idx_descontos_contracheque ON descontos(contracheque_id);
CREATE INDEX idx_dividas_usuario ON dividas(usuario_id);
CREATE INDEX idx_gastos_usuario ON gastos_diarios(usuario_id);
CREATE INDEX idx_gastos_data ON gastos_diarios(data);

-- Row Level Security (RLS)
ALTER TABLE usuarios_permitidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracheques ENABLE ROW LEVEL SECURITY;
ALTER TABLE descontos ENABLE ROW LEVEL SECURITY;
ALTER TABLE dividas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos_diarios ENABLE ROW LEVEL SECURITY;

-- RLS Policies: usuarios_permitidos
CREATE POLICY "usuarios_podem_ver_proprios_dados"
ON usuarios_permitidos
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "usuarios_podem_atualizar_proprios_dados"
ON usuarios_permitidos
FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policies: contracheques
CREATE POLICY "acesso_restrito_ao_proprio_usuario"
ON contracheques
FOR ALL
USING (
  usuario_id IN (
    SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
  )
);

-- RLS Policies: descontos (cascata de contracheques)
CREATE POLICY "acesso_descontos_via_contracheque"
ON descontos
FOR ALL
USING (
  contracheque_id IN (
    SELECT id FROM contracheques
    WHERE usuario_id IN (
      SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies: dividas
CREATE POLICY "acesso_a_dividas_proprias_ou_conjuntas"
ON dividas
FOR ALL
USING (
  usuario_id IS NULL
  OR usuario_id IN (
    SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
  )
);

-- RLS Policies: gastos_diarios
CREATE POLICY "acesso_gastos_proprios"
ON gastos_diarios
FOR ALL
USING (
  usuario_id IN (
    SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
  )
);

-- Dados de teste
INSERT INTO usuarios_permitidos (email, nome)
VALUES ('germano@example.com', 'Germano'),
       ('esposa@example.com', 'Esposa')
ON CONFLICT (email) DO NOTHING;

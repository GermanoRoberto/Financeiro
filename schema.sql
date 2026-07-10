-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lista fechada de usuários autorizados
CREATE TABLE IF NOT EXISTS usuarios_permitidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  user_id UUID UNIQUE, -- preenchido com auth.uid() no primeiro login válido
  telegram_chat_id BIGINT UNIQUE,
  telegram_codigo TEXT UNIQUE,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Contracheques (metadados + valores, nunca o arquivo original)
CREATE TABLE IF NOT EXISTS contracheques (
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
CREATE TABLE IF NOT EXISTS descontos (
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
CREATE TABLE IF NOT EXISTS dividas (
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
CREATE TABLE IF NOT EXISTS gastos_diarios (
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
CREATE POLICY "permitir_leitura_todos_usuarios" ON usuarios_permitidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitir_update_proprio_usuario" ON usuarios_permitidos FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- RLS Policies: contracheques
CREATE POLICY "permitir_leitura_todos_contracheques" ON contracheques FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitir_insercao_proprio_contracheque" ON contracheques FOR INSERT TO authenticated WITH CHECK (usuario_id IN (SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()));
CREATE POLICY "permitir_update_proprio_contracheque" ON contracheques FOR UPDATE TO authenticated USING (usuario_id IN (SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()));
CREATE POLICY "permitir_delete_proprio_contracheque" ON contracheques FOR DELETE TO authenticated USING (usuario_id IN (SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()));

-- RLS Policies: descontos
CREATE POLICY "permitir_leitura_todos_descontos" ON descontos FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitir_escrita_propria_descontos" ON descontos FOR ALL TO authenticated USING (
  contracheque_id IN (
    SELECT id FROM contracheques
    WHERE usuario_id IN (
      SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
    )
  )
);

-- RLS Policies: dividas
CREATE POLICY "permitir_leitura_todas_dividas" ON dividas FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitir_escrita_propria_ou_conjunta_dividas" ON dividas FOR ALL TO authenticated USING (
  usuario_id IS NULL
  OR usuario_id IN (
    SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
  )
);

-- RLS Policies: gastos_diarios
CREATE POLICY "permitir_leitura_todos_gastos" ON gastos_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "permitir_escrita_propria_gastos" ON gastos_diarios FOR ALL TO authenticated USING (
  usuario_id IN (
    SELECT id FROM usuarios_permitidos WHERE user_id = auth.uid()
  )
);

-- Usuários autorizados
INSERT INTO usuarios_permitidos (email, nome)
VALUES ('germanorcarmo@gmail.com', 'Germano'),
       ('priscilaaparecida0@gmail.com', 'Priscila')
ON CONFLICT (email) DO NOTHING;

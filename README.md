# Financeiro Casal 💰

Aplicação web para controle financeiro compartilhado entre casais, com foco em mapeamento de dívidas, descontos em contracheques e projeção mensal de gastos.

## 🎯 Funcionalidades

- ✅ **Autenticação via Google OAuth** - Acesso restrito a emails autorizados
- ✅ **Upload de Contracheque** - Extração automática de dados via Gemini API
- ✅ **Gestão de Dívidas** - Cadastro manual de dívidas com parcelamento
- ✅ **Projeção Mensal** - Visualização de despesas futuras em gráficos
- ✅ **Visão do Casal** - Dashboard com alternância entre visões individual e conjunta
- ✅ **Cálculo de Comprometimento** - % de renda comprometida com despesas
- ✅ **Bot do Telegram** - Envio rápido de contracheques e consulta de resumo

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL) + Serverless Functions
- **IA**: Google Gemini API (extração de PDF/imagens)
- **Bot**: Telegram Bot API
- **Deploy**: Vercel

## 📋 Pré-requisitos

- Node.js 18+
- Conta Supabase
- Conta Google Cloud (OAuth)
- API Key do Google Gemini
- Bot Telegram criado
- Vercel (para deploy)

## 🚀 Instalação Local

### 1. Clonar o repositório

```bash
git clone https://github.com/GermanoRoberto/Financeiro.git
cd Financeiro
```

### 2. Instalar dependências

```bash
npm install
# ou
yarn install
```

### 3. Configurar variáveis de ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```bash
cp .env.example .env.local
```

Preencha as variáveis (veja seção de configuração abaixo).

### 4. Rodar migrações do banco de dados

```bash
# Execute o conteúdo de schema.sql no Supabase SQL Editor
# Ou use psql se tiver acesso direto
psql -h db-url -U postgres -d postgres -f schema.sql
```

### 5. Iniciar servidor de desenvolvimento

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## ⚙️ Configuração das Variáveis de Ambiente

### 🔑 Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Vá para **Settings → API** e copie:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...(sua chave anon)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...(sua chave service role)
```

### 🔐 Google OAuth

1. Vá para [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto
3. Habilite **Google+ API**
4. Vá para **Credenciais → Criar Credenciais → ID do Cliente OAuth**
5. Configure a origem autorizada como: `https://seu-projeto.supabase.co`
6. Copie o **Client ID**:

```env
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=seu-client-id.apps.googleusercontent.com
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET=seu-client-secret
```

### 🤖 Google Gemini API

1. Vá para [Google AI Studio](https://aistudio.google.com)
2. Clique em **"Get API Key"**
3. Copie a chave:

```env
NEXT_PUBLIC_GEMINI_API_KEY=sua-api-key
```

### 📱 Telegram Bot

1. Converse com [@BotFather](https://t.me/botfather) no Telegram
2. Use `/newbot` para criar um novo bot
3. Copie o token fornecido
4. Configure o webhook:

```bash
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-dominio.vercel.app/api/telegram-webhook",
    "secret_token": "seu-webhook-secret"
  }'
```

Variáveis de ambiente:

```env
TELEGRAM_BOT_TOKEN=seu-bot-token
TELEGRAM_WEBHOOK_SECRET=seu-webhook-secret
TELEGRAM_WEBHOOK_URL=https://seu-dominio.vercel.app/api/telegram-webhook
```

### 📧 Emails Autorizados

Lista de emails que podem acessar o sistema (separados por vírgula):

```env
NEXT_PUBLIC_AUTHORIZED_EMAILS=seu-email@gmail.com,email-esposa@gmail.com
```

## 🗄️ Configuração do Banco de Dados

### Executar migrations

1. Abra o **SQL Editor** no Supabase
2. Copie todo o conteúdo de `schema.sql`
3. Cole e execute

### Verificar RLS (Row Level Security)

Todas as políticas devem estar habilitadas:

```sql
SELECT schemaname, tablename FROM pg_tables 
WHERE schemaname = 'public';
```

## 🚀 Deploy na Vercel

### 1. Conectar repositório

1. Acesse [vercel.com](https://vercel.com)
2. Clique em **"New Project"**
3. Selecione este repositório GitHub

### 2. Configurar variáveis de ambiente

No dashboard da Vercel, vá para **Settings → Environment Variables** e adicione:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET
NEXT_PUBLIC_GEMINI_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_SECRET
TELEGRAM_WEBHOOK_URL
NEXT_PUBLIC_AUTHORIZED_EMAILS
```

### 3. Deploy

Clique em **"Deploy"** e aguarde.

### 4. Configurar domínio

Depois do deploy inicial, atualize o webhook do Telegram com o domínio real.

## 📝 Uso da Aplicação

### Dashboard

- **Visão Casal**: Vê dados combinados de ambos
- **Visão Você/Esposa**: Vê apenas dados pessoais
- **Cards de Resumo**: Salário bruto, líquido e comprometimento
- **Gráficos**: Projeção mensal, composição de descontos, tendência
- **Tabela**: Detalhamento mês a mês

### Upload de Contracheque

1. Vá para a aba **"Contracheques"**
2. Clique para fazer upload de PDF/imagem
3. Revise e edite os dados extraídos
4. Selecione o mês de referência
5. Clique em **"Confirmar e Salvar"**

### Cadastro de Dívidas

1. Vá para a aba **"Dívidas"**
2. Preencha as informações (credor, valor, parcelas)
3. Marque como "Dívida do casal" se for compartilhada
4. Clique em **"Cadastrar Dívida"**

### Bot Telegram

**Comandos disponíveis:**

- `/vincular <codigo>` - Vincular conta Telegram
- `/resumo` - Ver resumo do mês
- `/dividas` - Listar dívidas ativas

## 🔒 Segurança

- ✅ OAuth via Supabase (nunca armazena senha)
- ✅ Row Level Security (RLS) no banco de dados
- ✅ Nenhum arquivo original persistido (apenas dados extraídos)
- ✅ Sem CPF ou dados bancários completos armazenados
- ✅ Webhook Telegram validado com secret token
- ✅ HTTPS obrigatório na Vercel
- ✅ Variáveis sensíveis apenas no backend

## 📞 Suporte

Para dúvidas ou problemas:

1. Verifique se todas as variáveis estão corretas
2. Confirme que o RLS está ativado no Supabase
3. Teste localmente com `npm run dev`
4. Verifique os logs no Vercel

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para casais que querem controlar melhor suas finanças.**

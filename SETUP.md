# Guia de Configuração - Variáveis de Ambiente

## 📋 Resumo das Variáveis Necessárias

Antes de fazer o deploy, você precisa configurar as seguintes variáveis no Vercel:

### 1️⃣ **SUPABASE**

| Variável | Tipo | Valor Exemplo | Como Obter |
|----------|------|---------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://seu-projeto.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | `eyJhbGc...` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Private | `eyJhbGc...` | Supabase → Settings → API |

**Passo a passo Supabase:**
1. Vá para [https://supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Acesse **Settings → API**
4. Copie os valores das três chaves acima
5. Execute o `schema.sql` no SQL Editor

---

### 2️⃣ **GOOGLE OAUTH**

| Variável | Tipo | Valor Exemplo | Como Obter |
|----------|------|---------------|------------|
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` | Public | `123456.apps.googleusercontent.com` | Google Cloud Console |
| `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET` | Private | `GOCSPX-...` | Google Cloud Console |

**Passo a passo Google OAuth:**
1. Vá para [https://console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto
3. Ative **Google+ API**
4. Vá para **Credenciais**
5. Clique em **Criar Credenciais → ID do Cliente OAuth**
6. Configure origens autorizadas:
   - `http://localhost:3000` (local)
   - `https://seu-dominio.vercel.app` (produção)
7. Copie **Client ID** e **Client Secret**

⚠️ **Importante:** Configure também no Supabase:
1. Supabase → Authentication → Providers
2. Habilite Google
3. Insira o Client ID e Client Secret
4. Configure redirect URL: `https://seu-projeto.supabase.co/auth/v1/callback`

---

### 3️⃣ **GOOGLE GEMINI API**

| Variável | Tipo | Valor Exemplo | Como Obter |
|----------|------|---------------|------------|
| `NEXT_PUBLIC_GEMINI_API_KEY` | Public | `AIzaSyD...` | Google AI Studio |

**Passo a passo Gemini:**
1. Vá para [https://aistudio.google.com](https://aistudio.google.com)
2. Clique em **"Get API Key"**
3. Clique em **"Create API key in new Google Cloud project"**
4. Copie a chave gerada

---

### 4️⃣ **TELEGRAM BOT**

| Variável | Tipo | Valor Exemplo | Como Obter |
|----------|------|---------------|------------|
| `TELEGRAM_BOT_TOKEN` | Private | `123456:ABCdef...` | @BotFather no Telegram |
| `TELEGRAM_WEBHOOK_SECRET` | Private | `seu-webhook-secret-aleatorio` | Gere um valor aleatório |
| `TELEGRAM_WEBHOOK_URL` | Private | `https://seu-dominio.vercel.app/api/telegram-webhook` | URL do seu projeto Vercel |

**Passo a passo Telegram:**
1. Abra o Telegram e converse com [@BotFather](https://t.me/botfather)
2. Use `/newbot` para criar um novo bot
3. Escolha um nome (ex: "Financeiro Casal")
4. Escolha um username (ex: "financeiro_casal_bot")
5. Copie o token fornecido
6. Gere um `TELEGRAM_WEBHOOK_SECRET` aleatório (ex: use `openssl rand -hex 32`)
7. Depois que fizer deploy no Vercel, configure o webhook:

```bash
curl -X POST https://api.telegram.org/bot<SEU_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-dominio.vercel.app/api/telegram-webhook",
    "secret_token": "seu-webhook-secret"
  }'
```

---

### 5️⃣ **EMAILS AUTORIZADOS**

| Variável | Tipo | Valor Exemplo | Como Obter |
|----------|------|---------------|------------|
| `NEXT_PUBLIC_AUTHORIZED_EMAILS` | Public | `seu@gmail.com,esposa@gmail.com` | Defina você mesmo |

**Configuração:**
- Liste os emails separados por vírgula
- Apenas estes emails podem acessar o sistema
- Recomenda-se usar Google Workspace ou contas Google pessoais

---

## 🔧 Checklist de Configuração

### Local (Desenvolvimento)

- [ ] Arquivo `.env.local` criado
- [ ] Supabase URL e chaves configuradas
- [ ] Google OAuth Client ID e Secret configurados
- [ ] Gemini API Key configurada
- [ ] `npm install` executado
- [ ] `npm run dev` funcionando
- [ ] Login com Google funcionando
- [ ] Banco de dados contém tabelas (verificado em Supabase)

### Vercel (Produção)

- [ ] Repositório GitHub conectado
- [ ] Todas as 10 variáveis configuradas em **Settings → Environment Variables**
- [ ] Deploy bem-sucedido
- [ ] Login com Google funcionando em produção
- [ ] Webhook Telegram configurado com URL correta
- [ ] Teste: enviar `/resumo` para o bot

---

## 📦 Variáveis Resumidas para Copiar e Colar

Format as 10 variáveis que precisam estar no Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET=
NEXT_PUBLIC_GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=
NEXT_PUBLIC_AUTHORIZED_EMAILS=
```

---

## 🆘 Troubleshooting

### "Email não autorizado"

- Verifique se o email está correto em `NEXT_PUBLIC_AUTHORIZED_EMAILS`
- Sensibilidade a maiúsculas/minúsculas

### "Erro ao extrair do contracheque"

- Verifique se a Gemini API Key está válida
- Confirme que a quota da API não foi excedida

### "Bot não responde"

- Verifique o `TELEGRAM_BOT_TOKEN`
- Confirme que o webhook foi configurado corretamente
- Teste com: `curl -X POST https://api.telegram.org/bot<TOKEN>/getMe`

### "Erro de autenticação Supabase"

- Verifique as chaves de Supabase
- Confirm que o projeto está ativo
- Verifique RLS policies

---

**Pronto! Com todas essas variáveis configuradas, seu projeto deve funcionar perfeitamente.** 🚀

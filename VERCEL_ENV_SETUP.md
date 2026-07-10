# 🚀 VARIÁVEIS DE AMBIENTE PARA VERCEL

## ⚡ COPIE E COLE NO VERCEL

Accesse: **Vercel Dashboard → Seu Projeto → Settings → Environment Variables**

Adicione as seguintes 10 variáveis:

---

### 1️⃣ SUPABASE_URL
**Tipo:** Public  
**Valor:** `https://seu-projeto.supabase.co`  
**Onde obter:**
- Acesse [supabase.com](https://supabase.com)
- Seu Projeto → Settings → API
- Copie "Project URL"

---

### 2️⃣ SUPABASE_ANON_KEY
**Tipo:** Public  
**Valor:** `eyJhbGc...` (chave longa)  
**Onde obter:**
- Supabase → Settings → API
- Copie "anon public"

---

### 3️⃣ SUPABASE_SERVICE_ROLE_KEY
**Tipo:** Private (Secret)  
**Valor:** `eyJhbGc...` (chave ainda mais longa)  
**Onde obter:**
- Supabase → Settings → API
- Copie "service_role secret"

---

### 4️⃣ GOOGLE_OAUTH_CLIENT_ID
**Tipo:** Public  
**Valor:** `123456789.apps.googleusercontent.com`  
**Onde obter:**
- Acesse [console.cloud.google.com](https://console.cloud.google.com)
- Selecione seu projeto
- Credenciais → Seu OAuth Client ID
- Copie "Client ID"

---

### 5️⃣ GOOGLE_OAUTH_CLIENT_SECRET
**Tipo:** Private (Secret)  
**Valor:** `GOCSPX-...`  
**Onde obter:**
- Google Cloud Console → Credenciais
- Seu OAuth Client ID
- Copie "Client Secret"

---

### 6️⃣ GEMINI_API_KEY
**Tipo:** Public  
**Valor:** `AIzaSy...` (chave da API)  
**Onde obter:**
- Acesse [aistudio.google.com](https://aistudio.google.com)
- Clique "Get API Key"
- Clique "Create API key in new Google Cloud project"
- Copie a chave gerada

---

### 7️⃣ TELEGRAM_BOT_TOKEN
**Tipo:** Private (Secret)  
**Valor:** `123456:ABCdef...`  
**Onde obter:**
- Converse com [@BotFather](https://t.me/botfather) no Telegram
- Use `/newbot`
- Copie o token fornecido

---

### 8️⃣ TELEGRAM_WEBHOOK_SECRET
**Tipo:** Private (Secret)  
**Valor:** Qualquer string aleatória  
**Geração:** Use um gerador de strings aleatórias ou execute:
```bash
openssl rand -hex 32
```
**Exemplo:** `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

---

### 9️⃣ TELEGRAM_WEBHOOK_URL
**Tipo:** Private (Secret)  
**Valor:** `https://seu-dominio.vercel.app/api/telegram-webhook`  
**Onde obter:**
- Depois do primeiro deploy, você terá um domínio Vercel
- Formato: `https://seu-projeto.vercel.app`
- Adicione `/api/telegram-webhook` no final

---

### 🔟 AUTHORIZED_EMAILS
**Tipo:** Public  
**Valor:** `seu-email@gmail.com,esposa@gmail.com`  
**Onde obter:**
- Defina você mesmo
- Separados por vírgula (sem espaços)
- Apenas estes emails podem acessar o sistema

---

## 📋 CHECKLIST - PASSO A PASSO

### ✅ Antes de configurar no Vercel:

1. **Supabase:**
   - [ ] Criar projeto em supabase.com
   - [ ] Copiar URL e chaves
   - [ ] Executar `schema.sql` no SQL Editor
   - [ ] Verificar tabelas criadas

2. **Google Cloud:**
   - [ ] Criar projeto em console.cloud.google.com
   - [ ] Ativar Google+ API
   - [ ] Criar OAuth 2.0 Client ID
   - [ ] Configurar origens autorizadas
   - [ ] Copiar Client ID e Secret

3. **Google AI Studio:**
   - [ ] Ir para aistudio.google.com
   - [ ] Gerar API Key
   - [ ] Copiar chave

4. **Telegram Bot:**
   - [ ] Conversar com @BotFather
   - [ ] Criar novo bot
   - [ ] Copiar token
   - [ ] Gerar webhook secret

5. **Supabase OAuth Setup:**
   - [ ] Ir para Authentication → Providers
   - [ ] Ativar Google
   - [ ] Inserir Client ID e Secret do Google Cloud

### ✅ Configurar no Vercel:

1. [ ] Acessar Vercel Dashboard
2. [ ] Entrar no seu projeto
3. [ ] Settings → Environment Variables
4. [ ] Adicionar as 10 variáveis (uma por uma)
5. [ ] Clicar "Deploy" ou redeploy automático ativará

### ✅ Após Deploy:

1. [ ] Testar login com Google
2. [ ] Confirmar email está autorizado
3. [ ] Configurar webhook Telegram:
   ```bash
   curl -X POST https://api.telegram.org/bot<SEU_TOKEN>/setWebhook \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://seu-dominio.vercel.app/api/telegram-webhook",
       "secret_token": "seu-webhook-secret"
     }'
   ```
4. [ ] Testar bot Telegram: `/resumo`

---

## 📝 RESUMO - COPIE E COLE NO VERCEL

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

## 🎯 Ordem Recomendada de Setup

1. **Supabase** (5 min)
2. **Google Cloud** (10 min)
3. **Google AI Studio** (2 min)
4. **Telegram Bot** (3 min)
5. **Vercel** (5 min)
6. **Teste** (5 min)

**Tempo total: ~30 minutos** ⏱️

---

## ⚠️ IMPORTANTE

- **Nunca** compartilhe as chaves privadas (Secret)
- **Nunca** commite `.env.local` no Git
- As variáveis com `NEXT_PUBLIC_` são públicas (podem estar no cliente)
- As variáveis sem `NEXT_PUBLIC_` são privadas (apenas servidor)

---

**Pronto! Seu projeto está configurado e pronto para deploy! 🚀**

# Troubleshooting & FAQ

## ❓ Perguntas Frequentes

### P: Como adicionar mais usuários ao sistema?

R: Adicione o email à lista `NEXT_PUBLIC_AUTHORIZED_EMAILS` e redeploy, ou insira diretamente na tabela `usuarios_permitidos` no Supabase.

### P: Posso usar o Telegram sem vincular a conta?

R: Não, o bot valida o `chat_id` antes de processar comandos. Use `/vincular <codigo>` primeiro.

### P: Como faço backup dos dados?

R: Supabase faz backup automático. Você pode exportar via:
- Supabase Dashboard → Database → Export
- Ou usar `pg_dump` via linha de comando

### P: Qual é o limite de tamanho para upload de contracheque?

R: Next.js permite até 4MB por default. Você pode aumentar em `next.config.js`.

### P: Os dados são criptografados?

R: Sim, Supabase usa SSL/TLS em trânsito. Em repouso, está seguro no banco PostgreSQL.

---

## 🐛 Problemas Comuns

### Erro: "Cannot find module '@supabase/supabase-js'"

**Solução:**
```bash
npm install @supabase/supabase-js
```

### Erro: "GEMINI_API_KEY is not defined"

**Verificação:**
1. Confirme que `NEXT_PUBLIC_GEMINI_API_KEY` está no `.env.local`
2. Reinicie o servidor `npm run dev`
3. Verifique a chave no Google AI Studio

### Erro: "Row Level Security violation"

**Causa:** Usuário não tem permissão para acessar os dados.

**Solução:**
1. Verifique se `user_id` está preenchido em `usuarios_permitidos`
2. Confirme que as policies RLS estão corretas
3. Verifique se o email está na lista autorizada

### Erro: "Webhook Telegram não recebe mensagens"

**Verificação:**
```bash
# Teste o webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/getUpdates

# Configure o webhook novamente
curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://seu-dominio.vercel.app/api/telegram-webhook"}'
```

### Erro: "Login com Google não funciona"

**Checklist:**
1. [ ] `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` está correto
2. [ ] Google OAuth está habilitado no Supabase
3. [ ] Redirect URL está configurado no Google Cloud
4. [ ] Email está na lista autorizada

---

## 📊 Performance & Otimização

### Melhorar velocidade de carregamento

1. **Next.js Image Optimization:**
   ```jsx
   import Image from 'next/image';
   ```

2. **Code Splitting:**
   - Components são automaticamente code-split
   - Use `dynamic()` para lazy loading

3. **Database Indexing:**
   - Índices já estão criados no `schema.sql`
   - Adicione mais conforme necessário

### Monitorar performance

- Vercel Analytics → Performance
- Supabase → Query Performance
- Browser DevTools → Network & Performance

---

## 🔐 Segurança - Checklist

- [ ] Nenhuma senha armazenada (OAuth)
- [ ] RLS habilitado em todas as tabelas
- [ ] Service Role Key nunca exposto no frontend
- [ ] Webhook Telegram usa secret token
- [ ] HTTPS ativado (padrão Vercel)
- [ ] CORS configurado corretamente
- [ ] Rate limiting implementado (TODO)
- [ ] Backups automáticos habilitados

---

## 📞 Contato para Suporte

Se encontrar problemas não cobertos aqui:

1. Verifique os logs do Vercel: `vercel logs`
2. Verifique os logs do Supabase: Dashboard → Logs
3. Abra uma issue no GitHub: `GermanoRoberto/Financeiro`

---

**Última atualização:** 10/07/2026

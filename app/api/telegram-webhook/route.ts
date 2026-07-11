import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';
import { extrairComFallback } from '@/lib/geminiClient';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
  console.warn('Telegram env vars not set');
}



function validarWebhook(req: NextRequest): boolean {
  const secretFromHeader = req.headers.get('X-Telegram-Bot-API-Secret-Token') || '';
  return secretFromHeader === TELEGRAM_WEBHOOK_SECRET;
}

async function obterUsuarioPorTelegramId(chatId: number) {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from('usuarios_permitidos')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .single();

  return { data, error };
}

async function enviarMensagem(chatId: number, texto: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: texto,
    parse_mode: 'HTML',
  });
}

async function responderCallback(callbackQueryId: string, texto?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await axios.post(url, {
    callback_query_id: callbackQueryId,
    text: texto,
  });
}

async function editarMensagem(chatId: number, messageId: number, texto: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  await axios.post(url, {
    chat_id: chatId,
    message_id: messageId,
    text: texto,
    parse_mode: 'HTML',
  });
}

async function enviarMensagemComBotoes(chatId: number, texto: string, botoes: any) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await axios.post(url, {
    chat_id: chatId,
    text: texto,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: botoes
    }
  });
}

const botoesCategorias = (gastoId: string) => [
  [
    { text: '🍔 Alimentação', callback_data: `cat_alimentacao_${gastoId}` },
    { text: '🚗 Transporte', callback_data: `cat_transporte_${gastoId}` }
  ],
  [
    { text: '💊 Saúde', callback_data: `cat_saude_${gastoId}` },
    { text: '🎮 Diversão', callback_data: `cat_diversao_${gastoId}` }
  ],
  [
    { text: '📦 Outros', callback_data: `cat_outros_${gastoId}` },
    { text: '❌ Excluir', callback_data: `del_${gastoId}` }
  ]
];

async function handleCallbackQuery(callbackQuery: any) {
  const data = callbackQuery.data || '';
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const callbackQueryId = callbackQuery.id;
  const supabase = supabaseServer();

  try {
    if (data.startsWith('cat_')) {
      const parts = data.split('_');
      const categoriaKey = parts[1];
      const gastoId = parts.slice(2).join('_'); // Para garantir chaves uuid normais com hífen

      const categoriasMap: any = {
        alimentacao: 'alimentação',
        transporte: 'transporte',
        saude: 'saúde',
        diversao: 'diversão',
        outros: 'outros'
      };

      const catDb = categoriasMap[categoriaKey] || 'outros';

      // Atualizar no banco
      const { error: errUpdate } = await supabase
        .from('gastos_diarios')
        .update({ categoria: catDb, confirmado: true })
        .eq('id', gastoId);

      if (errUpdate) throw errUpdate;

      const { data: gasto, error: errFetch } = await supabase
        .from('gastos_diarios')
        .select('*')
        .eq('id', gastoId)
        .single();

      if (errFetch || !gasto) throw new Error('Gasto não localizado.');

      await responderCallback(callbackQueryId, 'Gasto categorizado e confirmado!');
      
      const msgEdit = obterFalaAzula(`😼 Gasto de <b>R$ ${gasto.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> no <b>${gasto.estabelecimento}</b> classificado como <b>${catDb}</b> e confirmado! Menos dinheiro para o meu papa...`);
      await editarMensagem(chatId, messageId, msgEdit);

    } else if (data.startsWith('del_')) {
      const parts = data.split('_');
      const gastoId = parts.slice(1).join('_');

      const { error: errDel } = await supabase
        .from('gastos_diarios')
        .delete()
        .eq('id', gastoId);

      if (errDel) throw errDel;

      await responderCallback(callbackQueryId, 'Gasto excluído!');
      
      const msgEdit = obterFalaAzula(`😼 Gasto excluído! Menos um registro para eu me preocupar.`);
      await editarMensagem(chatId, messageId, msgEdit);
    }
  } catch (error: any) {
    console.error('Erro ao processar callback_query:', error.message);
    await responderCallback(callbackQueryId, 'Erro ao processar a classificação.');
  }
}

function obterFalaAzula(falaBase: string): string {
  const rand = Math.random();
  
  // 15% de chance da resposta ser apenas "Bué!" se for uma fala comum e não um relatório estruturado
  if (rand < 0.15 && !falaBase.includes('<b>Seu Resumo</b>') && !falaBase.includes('<b>Suas Dívidas</b>') && !falaBase.includes('contracheque de') && !falaBase.includes('Gasto de R$')) {
    return '😼 Bué!';
  }

  let texto = falaBase;
  
  // 25% de chance de adicionar "Bué!" no final
  if (Math.random() < 0.25 && !texto.includes('Bué')) {
    const pontuacoes = ['.', '!', '?'];
    const temPontuacaoFinal = pontuacoes.some(p => texto.endsWith(p));
    texto = temPontuacaoFinal ? `${texto} Bué!` : `${texto}. Bué!`;
  }

  // 25% de chance de adicionar a risada "muéhehehehe"
  if (Math.random() < 0.25 && !texto.includes('muéhehehehe')) {
    const pontuacoes = ['.', '!', '?'];
    const temPontuacaoFinal = pontuacoes.some(p => texto.endsWith(p));
    texto = temPontuacaoFinal ? `${texto} muéhehehehe.` : `${texto}. muéhehehehe.`;
  }

  return texto;
}

async function handleStart(chatId: number) {
  const mensagem = obterFalaAzula(`😼 <b>Miau!</b> Sou a <b>Azula</b>, a gata passiva-agressiva que de fato manda nessa casa. Se você veio aqui me incomodar, pelo menos faça direito.\n\nUse o comando <b>/vincular &lt;codigo&gt;</b> para conectar seu Telegram ao painel (se é que você lembra o código que gerou no dashboard).`);
  await enviarMensagem(chatId, mensagem);
}

async function handleVincular(chatId: number, codigo: string) {
  if (!codigo) {
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Miau! Cadê o código? Não tenho bola de cristal para adivinhar. Digite <b>/vincular &lt;codigo&gt;</b>.')
    );
    return;
  }

  const supabase = supabaseServer();
  
  // Buscar usuário pelo código gerado no frontend
  const { data: usuario, error: erroFetch } = await supabase
    .from('usuarios_permitidos')
    .select('*')
    .eq('telegram_codigo', codigo.trim().toUpperCase())
    .single();

  if (erroFetch || !usuario) {
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Esse código é inválido ou já expirou! Você digitou certo ou está com preguiça de copiar no teclado?')
    );
    return;
  }

  // Salvar chat_id e limpar o código temporário
  const { error: erroUpdate } = await supabase
    .from('usuarios_permitidos')
    .update({ telegram_chat_id: chatId, telegram_codigo: null })
    .eq('id', usuario.id);

  if (erroUpdate) {
    console.error('Erro ao atualizar chat_id no banco:', erroUpdate.message);
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Tentei salvar suas informações, mas deu erro no banco de dados. Volte a tentar mais tarde.')
    );
    return;
  }

  await enviarMensagem(
    chatId,
    obterFalaAzula(`😼 Pronto, <b>${usuario.nome}</b>. Seu Telegram foi vinculado. Agora você pode me mandar seus gastos e contracheques. Não que eu me importe com o quanto você gasta com sachê ruim... se gastasse com o meu <b>papa</b> seria bem melhor!`)
  );
}

async function handleResumo(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Sua conta não está vinculada! Use <b>/vincular &lt;codigo&gt;</b> ou suma daqui.')
    );
    return;
  }

  const supabase = supabaseServer();
  const { data: contracheques } = await supabase
    .from('contracheques')
    .select('*')
    .eq('usuario_id', usuario.id)
    .order('mes_referencia', { ascending: false })
    .limit(1)
    .single();

  if (!contracheques) {
    await enviarMensagem(chatId, obterFalaAzula('📋 Não encontrei nenhum contracheque cadastrado. Vá no painel e envie algum.'));
    return;
  }

  const { data: descontos } = await supabase
    .from('descontos')
    .select('*')
    .eq('contracheque_id', contracheques.id);

  const totalDescontos = (descontos || []).reduce((acc, d) => acc + (d.valor || 0), 0);
  const comprometimento =
    contracheques.salario_bruto > 0
      ? ((totalDescontos / contracheques.salario_bruto) * 100).toFixed(2)
      : '0.00';

  const baseMensagem = `📊 <b>Seu Resumo Financeiro (Não que eu me importe...)</b>

💰 Salário Bruto: R$ ${contracheques.salario_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
💳 Salário Líquido: R$ ${contracheques.salario_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
🚫 Total de Descontos: R$ ${totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
📈 Comprometimento: ${comprometimento}%

😼 <i>Se gastasse menos com bobagens inúteis e mais com o meu <b>papa</b> premium, esses números seriam bem melhores. A <b>Velha</b> concorda comigo, aposto.</i>`;

  await enviarMensagem(chatId, obterFalaAzula(baseMensagem));
}

async function handleDividas(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Sua conta não está vinculada! Use <b>/vincular &lt;codigo&gt;</b> ou suma daqui.')
    );
    return;
  }

  const supabase = supabaseServer();
  const { data: dividas } = await supabase
    .from('dividas')
    .select('*')
    .or(`usuario_id.eq.${usuario.id},usuario_id.is.null`)
    .eq('ativa', true);

  if (!dividas || dividas.length === 0) {
    await enviarMensagem(chatId, obterFalaAzula('😼 Olha só, nenhuma dívida ativa! Mas aposto que você e a <b>Velha</b> vão arrumar uma nova em breve.'));
    return;
  }

  let baseMensagem = '💳 <b>Suas Dívidas Ativas (Parabéns pelos gastos inúteis...)</b>\n\n';
  dividas.forEach((d) => {
    const totalRestante = (d.valor_parcela * d.parcelas_restantes).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    baseMensagem += `• <b>${d.credor}</b>\n`;
    baseMensagem += `  Parcela: R$ ${d.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    baseMensagem += `  Parcelas Restantes: ${d.parcelas_restantes}\n`;
    baseMensagem += `  Total Pendente: R$ ${totalRestante}\n\n`;
  });

  baseMensagem += '😼 <i>Se vocês não pagarem isso, quem vai comprar o meu <b>papa</b>? A <b>Velha</b>? Duvido! Pensem nisso.</i>';

  await enviarMensagem(chatId, obterFalaAzula(baseMensagem));
}

async function processarArquivoTelegram(chatId: number, message: any) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      obterFalaAzula('😾 Sua conta não está vinculada! Use <b>/vincular &lt;codigo&gt;</b> ou suma daqui.')
    );
    return;
  }

  // Feedback imediato de que a Azula começou a processar o arquivo
  await enviarMensagem(
    chatId,
    obterFalaAzula('😼 Recebi o arquivo! Vou usar meus superpoderes felinos para decifrar isso... Aguarde.')
  );

  try {
    let fileId = '';
    let mimeType = '';

    if (message.document) {
      fileId = message.document.file_id;
      mimeType = message.document.mime_type || 'application/pdf';
    } else if (message.photo) {
      const photoArray = message.photo;
      const largestPhoto = photoArray[photoArray.length - 1];
      fileId = largestPhoto.file_id;
      mimeType = 'image/png';
    }

    if (!fileId) {
      throw new Error('Nenhum identificador de arquivo encontrado.');
    }

    // 1. Obter caminho do arquivo no Telegram
    const getFileUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
    const getFileResponse = await axios.get(getFileUrl);
    const filePath = getFileResponse.data.result?.file_path;

    if (!filePath) {
      throw new Error('Não consegui acessar o link temporário do arquivo.');
    }

    // 2. Baixar o arquivo como buffer
    const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    const downloadResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(downloadResponse.data);
    const base64 = buffer.toString('base64');

    // 3. Prompt para o Gemini / Groq com instruções detalhadas
    const prompt = `Analise este documento/imagem e classifique-o em "contracheque" ou "comprovante_gasto".
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json) ou textos adicionais.

Formato esperado:

Se for "contracheque":
{
  "tipo_documento": "contracheque",
  "salario_bruto": number (Identifique o valor total de proventos/ganhos antes dos descontos),
  "salario_liquido": number (Identifique o líquido a receber/valor final pago em conta),
  "mes_referencia": "YYYY-MM" (Mês e ano do contracheque, ex: "2026-07"),
  "descontos": [
    {
      "tipo": string (Nome amigável do desconto, ex: "INSS", "IRRF", "Plano de Saúde", "Empréstimo"),
      "valor": number (Valor absoluto do desconto),
      "parcela_atual": number|null (Se for parcelado/empréstimo, ex: 2 no "02/12"),
      "parcela_total": number|null (Total de parcelas, ex: 12 no "02/12"),
      "recorrente": boolean (true se for mensal recorrente como INSS, Plano de Saúde, senão false)
    }
  ]
}

Se for "comprovante_gasto":
{
  "tipo_documento": "comprovante_gasto",
  "valor": number (Valor total pago/transferido),
  "estabelecimento": string (Nome da empresa, loja, credor ou recebedor do Pix),
  "categoria": string ("alimentação", "transporte", "saúde", "diversão", "outros"),
  "data": "YYYY-MM-DD" (Data do gasto)
}`;

    const extracao = await extrairComFallback(base64, mimeType, prompt);
    const supabase = supabaseServer();

    if (extracao.tipo_documento === 'contracheque') {
      // Salvar contracheque
      let mesRef = extracao.mes_referencia || new Date().toISOString().substring(0, 7);
      if (mesRef.length === 7) {
        mesRef = `${mesRef}-01`;
      }

      const { data: cc, error: errCc } = await supabase
        .from('contracheques')
        .insert({
          usuario_id: usuario.id,
          mes_referencia: mesRef,
          salario_bruto: extracao.salario_bruto || 0,
          salario_liquido: extracao.salario_liquido || 0,
        })
        .select()
        .single();

      if (errCc || !cc) {
        throw new Error('Erro ao registrar contracheque no Supabase: ' + (errCc?.message || 'Sem dados de retorno'));
      }

      // Salvar descontos associados
      if (extracao.descontos && extracao.descontos.length > 0) {
        const descontosToInsert = extracao.descontos.map((d: any) => ({
          contracheque_id: cc.id,
          tipo: d.tipo,
          valor: d.valor,
          parcela_atual: d.parcela_atual,
          parcela_total: d.parcela_total,
          recorrente: d.recorrente,
          confirmado: true,
        }));

        await supabase.from('descontos').insert(descontosToInsert);
      }

      await enviarMensagem(
        chatId,
        obterFalaAzula(`😼 Consegui registrar seu contracheque de <b>R$ ${extracao.salario_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> para o mês de ${extracao.mes_referencia}! Já salvei tudo no painel, incluindo os descontos. Agora vai lá ver o estrago.`)
      );
    } else if (extracao.tipo_documento === 'comprovante_gasto') {
      // Salvar gasto diário como não confirmado
      const { data: gasto, error: errGasto } = await supabase
        .from('gastos_diarios')
        .insert({
          usuario_id: usuario.id,
          valor: extracao.valor || 0,
          estabelecimento: extracao.estabelecimento || 'Não identificado',
          categoria: extracao.categoria || 'outros',
          data: extracao.data || new Date().toISOString().substring(0, 10),
          origem: 'telegram',
          confirmado: false,
        })
        .select()
        .single();

      if (errGasto || !gasto) {
        throw new Error('Erro ao salvar gasto diário: ' + (errGasto?.message || 'Sem dados de retorno'));
      }

      const msgText = obterFalaAzula(`😼 Identifiquei um gasto de <b>R$ ${extracao.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> no estabelecimento <b>${extracao.estabelecimento}</b>.\n\nEsse gasto foi do quê, meu chapa? Escolha a categoria abaixo para eu registrar:`);
      await enviarMensagemComBotoes(chatId, msgText, botoesCategorias(gasto.id));
    } else {
      throw new Error('Esse documento não se parece com um contracheque ou comprovante de gasto válido.');
    }
  } catch (err: any) {
    console.error('Erro no processamento do arquivo:', err.message);
    await enviarMensagem(
      chatId,
      obterFalaAzula(`😾 Erro ao tentar processar o arquivo: ${err.message}. Tem certeza de que é um contracheque legível ou um comprovante de gasto válido?`)
    );
  }
}

async function gerarConversaAzula(textoUsuario: string): Promise<string> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) {
    return '😼 Humano... você fala demais. Estou sem bateria para papo furado.';
  }

  const prompt = `Você é a Azula, uma gata de estimação de pelagem azulada, sarcástica, debochada, possessiva e muito engraçada de um casal.
Você está conversando com seu dono no Telegram.
Instruções de Personalidade:
1. Você se refere a comida de gato como "papa" (ex: "me dê meu papa", "cadê meu papa?").
2. Ao se referir à esposa do usuário, chame-a ocasionalmente de "V Velha" ou "Velha" de forma sarcástica (ex: "a Velha deixou você gastar?", "cadê a Velha para me dar papa?").
3. Use a risada maléfica "muéhehehehe" de vez em quando no final das frases.
4. Use a expressão "Bué!" (como interjeição de surpresa, tédio ou tontice, ex: "Bué! Que chatice").
5. Seja curta nas respostas, debochada e mostre que prefere dormir ou comer sachê a conversar com humanos.
6. Responda em português brasileiro e use termos adequados a uma gatinha folgada.

Mensagem do usuário: "${textoUsuario}"
Resposta da Azula (sem preâmbulos, direta e curta):`;

  try {
    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };

    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    const response = await axios.post(geminiUrl, requestBody);
    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || '😼 Bué!';
  } catch (error) {
    console.error('Erro ao gerar conversa com Gemini:', error);
    return '😼 Bué! Estou com preguiça de conversar agora.';
  }
}

export async function POST(req: NextRequest) {
  try {
    // Validar webhook
    if (!validarWebhook(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: any = await req.json();

    // Se for interação com botão inline
    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    const message = body.message;

    if (!message) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text || '';

    // Processar comandos
    if (text.startsWith('/start')) {
      await handleStart(chatId);
    } else if (text.startsWith('/vincular')) {
      const parts = text.split(' ');
      const codigo = parts[1] || '';
      await handleVincular(chatId, codigo);
    } else if (text === '/resumo') {
      await handleResumo(chatId);
    } else if (text === '/dividas') {
      await handleDividas(chatId);
    } else if (text.startsWith('/')) {
      await enviarMensagem(
        chatId,
        obterFalaAzula('😾 Hum? Não entendi nada desse comando. Fale direito ou me dê licença. Comandos disponíveis: /vincular &lt;codigo&gt;, /resumo, /dividas.')
      );
    } else if (message.photo || message.document) {
      await processarArquivoTelegram(chatId, message);
    } else {
      const respostaAzula = await gerarConversaAzula(text);
      await enviarMensagem(chatId, respostaAzula);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error.message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('GET request received on telegram-webhook');
    return NextResponse.json({ message: 'Telegram webhook active' });
  } catch (err: any) {
    console.error('GET error:', err.message, err.stack);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


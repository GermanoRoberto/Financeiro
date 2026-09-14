import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';
import { extrairComFallback } from '@/lib/geminiClient';
import { dispararFofocaSemanal, limparTextoAzula } from '@/lib/fofoca';
import { adicionarAoHistorico, obterHistoricoFormatado } from '@/lib/chatHistory';
import os from 'os';
import fs from 'fs';
import path from 'path';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

function getSessionState(chatId: number): any {
  const filePath = path.join(os.tmpdir(), 'azula-sessions.json');
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return data[chatId] || {};
    }
  } catch (e) {}
  return {};
}

function setSessionState(chatId: number, state: any): void {
  const filePath = path.join(os.tmpdir(), 'azula-sessions.json');
  try {
    let data: any = {};
    if (fs.existsSync(filePath)) {
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    data[chatId] = { ...data[chatId], ...state };
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  } catch (e) {}
}

function escaparHTMLTelegram(texto: string): string {
  // 1. Escapar ampersands comerciais que não sejam de entidades HTML válidas
  let temp = texto.replace(/&(?!(amp|lt|gt);)/g, '&amp;');

  // 2. Mapear e proteger tags permitidas
  const placeholders: { [key: string]: string } = {
    '<b>': '___B_OPEN___',
    '</b>': '___B_CLOSE___',
    '<code>': '___CODE_OPEN___',
    '</code>': '___CODE_CLOSE___',
    '<i>': '___I_OPEN___',
    '</i>': '___I_CLOSE___',
    '<strong>': '___STRONG_OPEN___',
    '</strong>': '___STRONG_CLOSE___',
    '<em>': '___EM_OPEN___',
    '</em>': '___EM_CLOSE___'
  };

  for (const tag of Object.keys(placeholders)) {
    const regex = new RegExp(tag, 'gi');
    temp = temp.replace(regex, placeholders[tag]);
  }

  // 3. Escapar outros caracteres de tag (< e >)
  temp = temp.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 4. Restaurar as tags protegidas
  for (const tag of Object.keys(placeholders)) {
    const regex = new RegExp(placeholders[tag], 'g');
    temp = temp.replace(regex, tag);
  }

  return temp;
}

async function enviarMensagem(chatId: number, texto: string) {
  adicionarAoHistorico(chatId, 'assistant', texto);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const textoTratado = escaparHTMLTelegram(texto);
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: textoTratado,
      parse_mode: 'HTML',
    });
  } catch (err: any) {
    console.error('Erro ao enviar mensagem em HTML. Tentando texto puro...', err.message);
    const textoPuro = texto.replace(/<[^>]*>/g, '');
    await axios.post(url, {
      chat_id: chatId,
      text: textoPuro,
    });
  }
}

async function responderCallback(callbackQueryId: string, texto?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
  await axios.post(url, {
    callback_query_id: callbackQueryId,
    text: texto,
  });
}

async function editarMensagem(chatId: number, messageId: number, texto: string) {
  adicionarAoHistorico(chatId, 'assistant', texto);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;
  const textoTratado = escaparHTMLTelegram(texto);
  try {
    await axios.post(url, {
      chat_id: chatId,
      message_id: messageId,
      text: textoTratado,
      parse_mode: 'HTML',
    });
  } catch (err: any) {
    console.error('Erro ao editar mensagem em HTML. Tentando texto puro...', err.message);
    const textoPuro = texto.replace(/<[^>]*>/g, '');
    await axios.post(url, {
      chat_id: chatId,
      message_id: messageId,
      text: textoPuro,
    });
  }
}

async function enviarMensagemComBotoes(chatId: number, texto: string, botoes: any) {
  adicionarAoHistorico(chatId, 'assistant', texto);
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const textoTratado = escaparHTMLTelegram(texto);
  try {
    await axios.post(url, {
      chat_id: chatId,
      text: textoTratado,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: botoes
      }
    });
  } catch (err: any) {
    console.error('Erro ao enviar mensagem com botões em HTML. Tentando texto puro...', err.message);
    const textoPuro = texto.replace(/<[^>]*>/g, '');
    await axios.post(url, {
      chat_id: chatId,
      text: textoPuro,
      reply_markup: {
        inline_keyboard: botoes
      }
    });
  }
}

function parseNumeroBR(numStr: string): number {
  let s = numStr.trim();
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if (s.includes('.')) {
    const partes = s.split('.');
    if (partes[partes.length - 1].length === 3 && partes.length > 1 && partes[0].length <= 3) {
      s = s.replace(/\./g, '');
    }
  }
  return parseFloat(s) || 0;
}

function inferirCategoria(est: string): string {
  const e = est.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/mercado|supermercado|padaria|acougue|hortifruti|sacolao|ifood|lanche|restaurante|almoco|jantar|pizza|hamburguer|comida|cafe|padoca|bar|churrasco/.test(e)) return 'alimentação';
  if (/uber|99|gasolina|posto|combustivel|etanol|diesel|estacionamento|pedagio|onibus|metro|passagem|taxi|oficina|mecanico/.test(e)) return 'transporte';
  if (/farmacia|drogaria|remedio|medico|consulta|dentista|exame|hospital|plano|psicolog|saude/.test(e)) return 'saúde';
  if (/cinema|filme|show|jogo|jogos|passeio|viagem|parque|teatro|festa/.test(e)) return 'diversão';
  if (/aluguel|condominio|luz|agua|energia|gas|vivo|claro|tim|oi|internet|iptu|casa|reforma|limpeza|diarista/.test(e)) return 'moradia';
  if (/curso|faculdade|escola|livro|mensalidade|educacao|aula/.test(e)) return 'educação';
  if (/roupa|calcado|loja|vestuario|shopee|shein|aliexpress|mercado livre|amazon|magazine|presente/.test(e)) return 'compras';
  if (/spotify|netflix|disney|hbo|prime|academia|smartfit|corte|cabelo|salao|manicure|barbearia/.test(e)) return 'serviços';
  return 'outros';
}

function detectarGastoRapido(texto: string): { valor: number; estabelecimento: string } | null {
  const t = texto.trim();
  if (t.startsWith('/') || t.length > 80) return null;

  // 1. 'gastei/paguei [valor] em/no/na [texto]' (ex: 'gastei 50 no mercado')
  const matchPaguei = t.match(/^(?:gastei|paguei|comprei)\s+(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:reais|real)?\s+(?:no|na|em|de|com|pra)?\s*(.+)$/i);
  if (matchPaguei) {
    const valor = parseNumeroBR(matchPaguei[1]);
    const est = matchPaguei[2].trim();
    if (valor > 0 && est.length >= 2) return { valor, estabelecimento: est };
  }

  // 2. 'gastei/paguei [texto] [valor]' (ex: 'paguei farmácia 42,90')
  const matchPagueiInvertido = t.match(/^(?:gastei|paguei|comprei)\s+(.+?)\s+(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(?:reais|real))?$/i);
  if (matchPagueiInvertido) {
    const valor = parseNumeroBR(matchPagueiInvertido[2]);
    const est = matchPagueiInvertido[1].replace(/^(?:no|na|em|de|com|pra)\s+/i, '').trim();
    if (valor > 0 && est.length >= 2) return { valor, estabelecimento: est };
  }

  // 3. '[texto] [valor]' (ex: 'mercado 85', 'uber 15,50')
  const matchTextoValor = t.match(/^([a-zA-ZÀ-ÿ\s]{2,40})\s+(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(?:reais|real))?$/i);
  if (matchTextoValor) {
    const valor = parseNumeroBR(matchTextoValor[2]);
    const est = matchTextoValor[1].trim();
    if (valor > 0 && est.length >= 2) return { valor, estabelecimento: est };
  }

  // 4. '[valor] [texto]' (ex: '85 mercado', '15.50 uber')
  const matchValorTexto = t.match(/^(?:R\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(?:reais|real))?\s+([a-zA-ZÀ-ÿ\s]{2,40})$/i);
  if (matchValorTexto) {
    const valor = parseNumeroBR(matchValorTexto[1]);
    const est = matchValorTexto[2].trim();
    if (valor > 0 && est.length >= 2) return { valor, estabelecimento: est };
  }

  return null;
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
    { text: '🏠 Moradia', callback_data: `cat_moradia_${gastoId}` },
    { text: '🎓 Educação', callback_data: `cat_educacao_${gastoId}` }
  ],
  [
    { text: '🛍️ Compras', callback_data: `cat_compras_${gastoId}` },
    { text: '🛠️ Serviços', callback_data: `cat_servicos_${gastoId}` }
  ],
  [
    { text: '📈 Invest.', callback_data: `cat_investimentos_${gastoId}` },
    { text: '📦 Outros', callback_data: `cat_outros_${gastoId}` }
  ],
  [
    { text: '❌ Excluir Lançamento', callback_data: `del_${gastoId}` }
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
        moradia: 'moradia',
        educacao: 'educação',
        compras: 'compras',
        servicos: 'serviços',
        investimentos: 'investimentos',
        receitaextra: 'receita_extra',
        transferencia: 'transferencia',
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

      await responderCallback(callbackQueryId, 'Transação confirmada!');
      
      let msgEdit = '';
      if (catDb === 'receita_extra') {
        msgEdit = obterFalaAzula(`😼 Receita extra de <b>R$ ${gasto.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> vinda de <b>${gasto.estabelecimento}</b> confirmada! Mais dinheiro para o meu sachê premium!`);
      } else if (catDb === 'transferencia') {
        msgEdit = obterFalaAzula(`😼 Transferência de <b>R$ ${gasto.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> com destino a <b>${gasto.estabelecimento}</b> confirmada! Dinheiro voando entre vocês.`);
      } else {
        msgEdit = obterFalaAzula(`😼 Gasto de <b>R$ ${gasto.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b> no <b>${gasto.estabelecimento}</b> classificado como <b>${catDb}</b> e confirmado! Menos dinheiro para o meu papa...`);
      }
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
  let texto = falaBase;
  
  // 20% de chance de adicionar interjeições ou pedido de papa no final
  if (Math.random() < 0.20) {
    const adicoes = [
      'Bué!', 'Bé!', 'Vuiishh!', 'Iiiiiishh!', 'Hm.', 
      'Põe meu papa!', 'Cadê meu papa?', 'Põe papa no meu pote!', 
      'Põe papa, põe!', 'Põe sachê!'
    ];
    const escolhida = adicoes[Math.floor(Math.random() * adicoes.length)];
    if (!texto.includes(escolhida)) {
      const pontuacoes = ['.', '!', '?'];
      const temPontuacaoFinal = pontuacoes.some(p => texto.endsWith(p));
      texto = temPontuacaoFinal ? `${texto} ${escolhida}` : `${texto}. ${escolhida}`;
    }
  }

  // 15% de chance de cantarolar um ponto de Umbanda/Quimbanda de forma aleatória no final
  if (Math.random() < 0.15 && !texto.includes('laroyê') && !texto.includes('banda') && !texto.includes('encruza')) {
    const pontos = [
      'Laroyê Exu! Caminho fechado não me pega...',
      'Quem comanda a minha banda é Seu Tranca Rua, muéhehehehe.',
      'Pisa na Umbanda, ê camará...',
      'Marabô que vem lá da encruza trazendo axé...',
      'Saravá meu pai Xangô, justiça pra esse bolso tonto!',
      'É de laroyê, é de caridade...',
      'Arreda homem que aí vem mulher... Maria Padilha da encruzilhada.'
    ];
    const pontoEscolhido = pontos[Math.floor(Math.random() * pontos.length)];
    const pontuacoes = ['.', '!', '?'];
    const temPontuacaoFinal = pontuacoes.some(p => texto.endsWith(p));
    texto = temPontuacaoFinal ? `${texto} 🎵 <i>${pontoEscolhido}</i>` : `${texto}. 🎵 <i>${pontoEscolhido}</i>`;
  }

  // 20% de chance de adicionar a risada "muéhehehehe"
  if (Math.random() < 0.20 && !texto.includes('muéhehehehe')) {
    const pontuacoes = ['.', '!', '?'];
    const temPontuacaoFinal = pontuacoes.some(p => texto.endsWith(p));
    texto = temPontuacaoFinal ? `${texto} muéhehehehe.` : `${texto}. muéhehehehe.`;
  }

  return texto;
}

function obterManualAzula(): string {
  return `😼 <b>Manual de Instruções da Azula (Presta atenção pra não fazer besteira!)</b> 🐾

Eu sou a auditora felina oficial dessa casa. Minha função é garantir que vocês dois organizem a vida financeira e nunca fiquem sem dinheiro pro meu <b>papa premium</b>. Aqui está como tudo funciona:

📑 <b>1. QUE TIPO DE ARQUIVO EU CONSIGO LER?</b>
• <b>Contracheques / Holerites (PDF):</b>
  - Aceito o PDF da <b>Camilo dos Santos</b> e da <b>Prefeitura/PJF</b>.
  - Leio proventos brutos, salário líquido, todos os descontos individuais (INSS, planos, etc.) e os contratos de <b>Empréstimo Consignado</b> em apenas 5 milissegundos! Também distingo adiantamento/vale de salário mensal.
• <b>Extratos Bancários (PDF ou Imagem):</b>
  - Aceito extratos de qualquer banco (Inter, Nubank, Caixa, Bradesco, etc.).
  - Leio cada transação individualmente (débito, Pix, compras), infiro a categoria e cadastro tudo em lote no painel, já confirmado!
• <b>Comprovantes de Gasto (Fotos PNG/JPG ou PDFs):</b>
  - Comprovantes de Pix, maquininha de cartão, boletos pagos e cupons fiscais.
  - Eu detecto o valor, o estabelecimento e já jogo no seu painel.

⚡ <b>2. LANÇAMENTO RÁPIDO POR TEXTO (Sem precisar de foto!)</b>
Está com preguiça de tirar foto do recibo? Só digita direto aqui no chat:
• <code>mercado 85</code>
• <code>uber 18.50</code>
• <code>farmacia 42,90</code>
• <code>gastei 50 no posto</code>
Eu anoto na mesma hora e coloco botões pra você trocar a categoria se quiser!

📸 <b>3. FOTO COM LEGENDA:</b>
Se você mandar uma foto e colocar na legenda algo como <code>lanche 32</code>, eu nem gasto meus olhos de gato com a imagem: já registro direto pelo que você escreveu na legenda!

🤖 <b>4. COMANDOS PRINCIPAIS:</b>
• <b>/resumo:</b> Raio-X do mês (salário líquido, total gasto, saldo restante).
• <b>/dividas:</b> Lista todas as dívidas ativas, parcelas restantes e consignados.
• <b>/fofoca</b> ou <b>/cobrar:</b> Minha função favorita! Eu audito se você ou a <b>Velha</b> mandaram coisas novas recentemente, deduro quem sumiu e <b>disparo uma cobrança simultânea no Telegram privado da outra pessoa</b>!
• <b>/ajuda:</b> Mostra este guia novamente.

Agora chega de moleza, mande os comprovantes e ponha meu papa! 🐾💥`;
}

async function handleStart(chatId: number) {
  const mensagem = obterFalaAzula(`😼 <b>Miau!</b> Sou a <b>Azula</b>, a gata passiva-agressiva que de fato manda nessa casa. Se você veio aqui me incomodar, pelo menos faça direito.\n\n• Use <b>/vincular &lt;codigo&gt;</b> para conectar seu Telegram ao painel.\n• Digite <b>/ajuda</b> para ver como me mandar contracheques, extratos, fotos ou gastos rápidos por texto!`);
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

  // 0. Se a mensagem contiver legenda (caption) com gasto explícito (ex: "mercado 85"), prioriza a legenda sem depender de IA!
  if (message.caption) {
    const gastoRapido = detectarGastoRapido(message.caption);
    if (gastoRapido) {
      const supabase = supabaseServer();
      const categoriaInferida = inferirCategoria(gastoRapido.estabelecimento);
      const dataISO = new Date().toISOString().substring(0, 10);
      
      const { data: gasto, error: errGasto } = await supabase
        .from('gastos_diarios')
        .insert({
          usuario_id: usuario.id,
          valor: gastoRapido.valor,
          estabelecimento: gastoRapido.estabelecimento,
          categoria: categoriaInferida,
          data: dataISO,
          origem: 'telegram',
          confirmado: true
        })
        .select()
        .single();

      if (!errGasto && gasto) {
        const valorFormatado = gastoRapido.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const msgText = obterFalaAzula(`😼 Já anotei pela sua legenda! Registrei <b>R$ ${valorFormatado}</b> no(a) <b>${gastoRapido.estabelecimento}</b> como <b>${categoriaInferida}</b>. Nem precisei cansar meus olhos de gato com a foto!`);
        await enviarMensagemComBotoes(chatId, msgText, botoesCategorias(gasto.id));
        return;
      }
    }
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
    const prompt = `Analise este documento/imagem e classifique-o em "contracheque", "comprovante_gasto", "contratos_emprestimo" ou "extrato_bancario".
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json) ou textos adicionais.

FORMATOS DE RESPOSTA JSON ESPERADOS (Use valores reais extraídos do documento, NUNCA use palavras como "number" ou "string" nos valores):

Se for "contracheque":
{
  "tipo_documento": "contracheque",
  "nome_funcionario": "NOME DO FUNCIONARIO",
  "is_adiantamento": false,
  "salario_bruto": 3907.89,
  "salario_liquido": 920.00,
  "mes_referencia": "2026-06",
  "descontos": [
    {
      "tipo": "INSS",
      "valor": 308.58,
      "parcela_atual": null,
      "parcela_total": null,
      "recorrente": true
    }
  ]
}

Se for "comprovante_gasto":
{
  "tipo_documento": "comprovante_gasto",
  "valor": 85.00,
  "estabelecimento": "Vivo",
  "categoria": "moradia",
  "data": "2026-07-21"
}

Se for "contratos_emprestimo":
{
  "tipo_documento": "contratos_emprestimo",
  "contratos": [
    {
      "numero_contrato": "123456",
      "credor": "Consignado Privado CLT",
      "valor_total": 5000.00,
      "valor_parcela": 250.00,
      "parcela_atual": 2,
      "parcela_total": 12
    }
  ]
}

Se for "extrato_bancario":
{
  "tipo_documento": "extrato_bancario",
  "transacoes": [
    {
      "valor": 27.00,
      "estabelecimento": "Nome da pessoa ou empresa",
      "categoria": "outros",
      "data": "2026-07-01"
    }
  ]
}

REGRAS CRÍTICAS DE VALIDAÇÃO MATEMÁTICA E LAYOUT:
1. ATENÇÃO AO LAYOUT DE COLUNAS DE CADA FUNCIONÁRIO:
   - No contracheque de GERMANO ROBERTO DO CARMO SOBRINHO (Rodoviário Camilo dos Santos), o texto extraído tem o valor financeiro ANTES da descrição! O formato é [Código] [Valor Financeiro] [Descrição] [Índice/Referência]. 
     Exemplos reais extraídos do texto:
     * "901 0308,58 INSS 8,817" -> O valor do desconto do INSS é R$ 308,58 (8,817 é o índice/alíquota, ignore-o!).
     * "126 15,60 UNIMED ODONTO DEPENDENTE 0,000" -> O valor do desconto é R$ 15,60.
     * "10014 143,49 COPARTICIPAÇÃO PLASC PARC EV 10,000" -> O valor do desconto é R$ 143,49 (10,000 é o índice/referência, ignore-o!).
     * "10096 1.018,15 DESCONTO CRÉDITO TRABALHADOR 0,000" -> O valor do desconto é R$ 1.018,15.
     * "651 1.400,00 DESC ADIANTAMENTO QUINZENAL 0,000" -> O valor do desconto é R$ 1.400,00.
     Certifique-se de usar o número anterior à descrição como o valor e ignorar o número final (que é a referência)!
   - No contracheque da Prefeitura de Juiz de Fora (PRISCILA APARECIDA DA SILVA TOLEDO), o formato é [Código] [Descrição] [Referência] [Valor Financeiro]. O valor vem no final!
     Exemplo real extraído do texto:
     * "56 FPM (FOLHA) 14,0000 925,40" -> O valor do desconto é R$ 925,40.
2. O salario_bruto (Total de Proventos) deve ser exatamente igual à soma dos proventos individuais do documento.
3. A soma dos descontos individuais na lista "descontos" deve ser exatamente igual ao total de descontos do documento.
4. O salario_liquido deve ser exatamente igual a (salario_bruto - soma de todos os descontos).
5. Categorias válidas: "alimentação"|"transporte"|"saúde"|"diversão"|"moradia"|"educação"|"compras"|"serviços"|"investimentos"|"receita_extra"|"transferencia"|"outros".
6. Se for extrato bancário: Extraia individualmente cada transação (débito, crédito, Pix, TED, transferências). Ignore linhas de consolidação como "Total de entradas" ou "Total de saídas". O valor de cada transação deve ser positivo (sem sinal negativo).`;

    const extracao = await extrairComFallback(base64, mimeType, prompt);
    const supabase = supabaseServer();

    if (extracao.tipo_documento === 'contracheque') {
      let mesRef = extracao.mes_referencia || new Date().toISOString().substring(0, 7);
      if (mesRef.length === 7) {
        mesRef = `${mesRef}-01`;
      }

      // Buscar todos os usuários cadastrados para cruzar o nome do cabeçalho
      const { data: todosUsuarios } = await supabase
        .from('usuarios_permitidos')
        .select('*');

      let usuarioDonoId = usuario.id;
      let nomeDono = usuario.nome;

      if (extracao.nome_funcionario && todosUsuarios && todosUsuarios.length > 0) {
        const funcionarioUpper = extracao.nome_funcionario.toUpperCase();
        const remetenteNomeUpper = usuario.nome.toUpperCase();
        
        if (funcionarioUpper.includes(remetenteNomeUpper)) {
          usuarioDonoId = usuario.id;
          nomeDono = usuario.nome;
        } else {
          const matchingUser = todosUsuarios.find(u => {
            const uNomeUpper = u.nome.toUpperCase();
            return funcionarioUpper.includes(uNomeUpper) || uNomeUpper.includes(funcionarioUpper);
          });

          if (matchingUser) {
            usuarioDonoId = matchingUser.id;
            nomeDono = matchingUser.nome;
          }
        }
      }

      // Detecção inteligente de Adiantamento/Vale
      const isAdiantamento = extracao.is_adiantamento || 
        (extracao.salario_bruto === extracao.salario_liquido && extracao.salario_liquido > 0 && (!extracao.descontos || extracao.descontos.length === 0)) ||
        (extracao.salario_bruto === 1400 && extracao.salario_liquido === 1400) ||
        (extracao.salario_bruto === 1400.26 && extracao.salario_liquido === 993);

      // Procurar contracheque existente para o mesmo mês do respectivo dono
      const { data: ccExistente } = await supabase
        .from('contracheques')
        .select('*')
        .eq('usuario_id', usuarioDonoId)
        .eq('mes_referencia', mesRef)
        .maybeSingle();

      let ccId = '';
      let msgRetorno = '';

      // Identificar se há desconto de adiantamento e calcular o valor do adiantamento
      const descontoAdiantamentoObj = extracao.descontos?.find((d: any) => 
        d.tipo.toUpperCase().includes('ADIANTAMENTO') || d.tipo.toUpperCase().includes('VALE')
      );
      const valorAdiantamento = descontoAdiantamentoObj ? Number(descontoAdiantamentoObj.valor) : 0;

      const eDono = usuarioDonoId === usuario.id;
      const refContracheque = eDono ? 'seu contracheque mensal' : `o contracheque mensal do(a) <b>${nomeDono}</b>`;
      const refAdiantamento = eDono ? 'seu adiantamento' : `o adiantamento do(a) <b>${nomeDono}</b>`;

      if (ccExistente) {
        ccId = ccExistente.id;
        
        // Recarregar os dados mais frescos do contracheque para mitigar race conditions
        const { data: ccFresco } = await supabase
          .from('contracheques')
          .select('*')
          .eq('id', ccId)
          .single();

        const ccAtual = ccFresco || ccExistente;
        let novoBruto = ccAtual.salario_bruto || 0;
        let novoLiquido = ccAtual.salario_liquido || 0;
        const dadosBrutosMerged = { ...ccAtual.dados_brutos };

        if (isAdiantamento) {
          dadosBrutosMerged.salario_liquido_adiantamento = extracao.salario_liquido || 0;
          dadosBrutosMerged.descontos_adiantamento = extracao.descontos || [];
          
          novoLiquido = Number(dadosBrutosMerged.salario_liquido_mensal || 0) + Number(dadosBrutosMerged.salario_liquido_adiantamento);
          
          msgRetorno = `😼 Registrei ${refAdiantamento} de <b>R$ ${extracao.salario_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} líquido</b> para ${extracao.mes_referencia}. Ele foi integrado ao contracheque mensal! Líquido total no mês: <b>R$ ${novoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>.`;
        } else {
          novoBruto = extracao.salario_bruto || 0;
          dadosBrutosMerged.salario_liquido_mensal = extracao.salario_liquido || 0;
          dadosBrutosMerged.descontos_mensal = extracao.descontos || [];
          
          novoLiquido = Number(dadosBrutosMerged.salario_liquido_mensal) + Number(dadosBrutosMerged.salario_liquido_adiantamento || 0);
          
          msgRetorno = `😼 Registrei ${refContracheque} de <b>R$ ${extracao.salario_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} bruto</b> para ${extracao.mes_referencia}. Líquido total no mês (mensal + adiantamento): <b>R$ ${novoLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>!`;
        }

        // Atualizar contracheque existente
        const { error: errUpdate } = await supabase
          .from('contracheques')
          .update({
            salario_bruto: novoBruto,
            salario_liquido: novoLiquido,
            dados_brutos: { ...dadosBrutosMerged, tem_adiantamento_somado: true }
          })
          .eq('id', ccId);

        if (errUpdate) {
          throw new Error('Erro ao atualizar contracheque existente: ' + errUpdate.message);
        }

        // Atualizar descontos do banco de dados
        await supabase.from('descontos').delete().eq('contracheque_id', ccId);

        const novosDescontos: any[] = [];
        
        // Descontos do mensal (excluindo a linha de adiantamento)
        const descontosMensalList = isAdiantamento ? (dadosBrutosMerged.descontos_mensal || []) : (extracao.descontos || []);
        descontosMensalList
          .filter((d: any) => !d.tipo.toUpperCase().includes('ADIANTAMENTO') && !d.tipo.toUpperCase().includes('VALE'))
          .forEach((d: any) => {
            novosDescontos.push({
              contracheque_id: ccId,
              tipo: d.tipo,
              valor: d.valor,
              parcela_atual: d.parcela_atual,
              parcela_total: d.parcela_total,
              recorrente: d.recorrente,
              confirmado: true,
            });
          });

        // Descontos do adiantamento
        const descontosAdiantamentoList = isAdiantamento ? (extracao.descontos || []) : (dadosBrutosMerged.descontos_adiantamento || []);
        descontosAdiantamentoList.forEach((d: any) => {
          novosDescontos.push({
            contracheque_id: ccId,
            tipo: `[Adiantamento] ${d.tipo}`,
            valor: d.valor,
            parcela_atual: d.parcela_atual,
            parcela_total: d.parcela_total,
            recorrente: d.recorrente,
            confirmado: true,
          });
        });

        if (novosDescontos.length > 0) {
          await supabase.from('descontos').insert(novosDescontos);
        }

      } else {
        // Se NÃO existe contracheque registrado para esse mês
        let bruto = extracao.salario_bruto || 0;
        let liquido = extracao.salario_liquido || 0;
        const dadosBrutosNew: any = {};

        if (isAdiantamento) {
          dadosBrutosNew.salario_liquido_adiantamento = liquido;
          dadosBrutosNew.salario_liquido_mensal = 0;
          dadosBrutosNew.descontos_adiantamento = extracao.descontos || [];
          
          msgRetorno = `😼 Registrei ${refAdiantamento} de <b>R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} líquido</b> para ${extracao.mes_referencia}. Quando você subir o contracheque mensal, eu mesclarei ambos automaticamente!`;
        } else {
          dadosBrutosNew.salario_liquido_mensal = liquido;
          dadosBrutosNew.descontos_mensal = extracao.descontos || [];
          
          if (valorAdiantamento > 0) {
            dadosBrutosNew.salario_liquido_adiantamento = valorAdiantamento;
            liquido = Number(liquido) + valorAdiantamento;
            msgRetorno = `😼 Consegui registrar ${refContracheque} de <b>R$ ${bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} bruto</b> para o mês de ${extracao.mes_referencia}! Já incorporei o valor estimado do adiantamento de R$ ${valorAdiantamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no líquido total (R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`;
          } else {
            msgRetorno = `😼 Consegui registrar ${refContracheque} de <b>R$ ${bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} bruto</b> para o mês de ${extracao.mes_referencia}! Líquido registrado: R$ ${liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
          }
        }

        const { data: cc, error: errCc } = await supabase
          .from('contracheques')
          .insert({
            usuario_id: usuarioDonoId,
            mes_referencia: mesRef,
            salario_bruto: bruto,
            salario_liquido: liquido,
            dados_brutos: { ...dadosBrutosNew, ...extracao }
          })
          .select()
          .single();

        if (errCc || !cc) {
          throw new Error('Erro ao registrar contracheque no Supabase: ' + (errCc?.message || 'Sem dados de retorno'));
        }

        ccId = cc.id;

        const descontosToInsert: any[] = [];

        if (isAdiantamento) {
          (extracao.descontos || []).forEach((d: any) => {
            descontosToInsert.push({
              contracheque_id: ccId,
              tipo: `[Adiantamento] ${d.tipo}`,
              valor: d.valor,
              parcela_atual: d.parcela_atual,
              parcela_total: d.parcela_total,
              recorrente: d.recorrente,
              confirmado: true,
            });
          });
        } else {
          (extracao.descontos || [])
            .filter((d: any) => !d.tipo.toUpperCase().includes('ADIANTAMENTO') && !d.tipo.toUpperCase().includes('VALE'))
            .forEach((d: any) => {
              descontosToInsert.push({
                contracheque_id: ccId,
                tipo: d.tipo,
                valor: d.valor,
                parcela_atual: d.parcela_atual,
                parcela_total: d.parcela_total,
                recorrente: d.recorrente,
                confirmado: true,
              });
            });
        }

        if (descontosToInsert.length > 0) {
          await supabase.from('descontos').insert(descontosToInsert);
        }
      }

      // Se o contracheque trouxe contratos de empréstimo anexos, registra-os nas dívidas (inativos para não duplicar projeção)
      if (extracao.contratos_emprestimo && extracao.contratos_emprestimo.length > 0) {
        for (const contrato of extracao.contratos_emprestimo) {
          const parcelasRestantes = (contrato.parcela_total || 12) - (contrato.parcela_atual || 1) + 1;
          const credorStr = `Consignado: ${contrato.credor || 'Consignado'} (Contrato ${contrato.numero_contrato || 'N/D'})`;
          
          const { data: divExistente } = await supabase
            .from('dividas')
            .select('*')
            .eq('usuario_id', usuarioDonoId)
            .eq('credor', credorStr)
            .maybeSingle();

          if (!divExistente) {
            await supabase
              .from('dividas')
              .insert({
                usuario_id: usuarioDonoId,
                credor: credorStr,
                valor_total: 0,
                valor_parcela: 0,
                parcelas_restantes: parcelasRestantes,
                vencimento_dia: 10,
                ativa: false
              });
          }
        }
      }

      await enviarMensagem(chatId, obterFalaAzula(msgRetorno));
    } else if (extracao.tipo_documento === 'contratos_emprestimo') {
      const contratos = extracao.contratos || [];
      if (contratos.length === 0) {
        throw new Error('Nenhum contrato de empréstimo foi identificado na imagem.');
      }

      for (const contrato of contratos) {
        const parcelasRestantes = (contrato.parcela_total || 1) - (contrato.parcela_atual || 1) + 1;
        const totalPendente = contrato.valor_total || (contrato.valor_parcela * parcelasRestantes);

        await supabase
          .from('dividas')
          .insert({
            usuario_id: usuario.id,
            credor: `Consignado: ${contrato.credor || 'Consignado'} (Contrato ${contrato.numero_contrato || 'N/D'})`,
            valor_total: totalPendente,
            valor_parcela: contrato.valor_parcela || 0,
            parcelas_restantes: parcelasRestantes,
            vencimento_dia: 10,
            ativa: false, // Inativo por padrão para não duplicar na projeção (é descontado em folha)
          });
      }

      await enviarMensagem(
        chatId,
        obterFalaAzula(`😼 Consegui ler os contratos! Salvei <b>${contratos.length} empréstimo(s) consignado(s)</b> no seu painel de acompanhamento (desativados da projeção ativa para não duplicar com o holerite).`)
      );
    } else if (extracao.tipo_documento === 'extrato_bancario') {
      const transacoes = extracao.transacoes || [];
      if (transacoes.length === 0) {
        throw new Error('Nenhuma transação foi identificada no extrato.');
      }

      let totalRegistradas = 0;
      
      for (const t of transacoes) {
        // Evitar duplicados simples (mesmo valor, estabelecimento, data e usuario)
        const { data: existente } = await supabase
          .from('gastos_diarios')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('valor', t.valor || 0)
          .eq('estabelecimento', t.estabelecimento || 'Não identificado')
          .eq('data', t.data)
          .maybeSingle();

        if (!existente) {
          await supabase
            .from('gastos_diarios')
            .insert({
              usuario_id: usuario.id,
              valor: t.valor || 0,
              estabelecimento: t.estabelecimento || 'Não identificado',
              categoria: t.categoria || 'outros',
              data: t.data || new Date().toISOString().substring(0, 10),
              origem: 'telegram',
              confirmado: true, // Já vem confirmado porque é do extrato oficial do banco!
            });
          totalRegistradas++;
        }
      }

      const totalValor = transacoes.reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0);
      await enviarMensagem(
        chatId,
        obterFalaAzula(`😼 Li o seu extrato bancário! Consegui registrar <b>${totalRegistradas} novas transações</b> (de um total de ${transacoes.length} encontradas, somando R$ ${totalValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) diretamente no seu painel. Menos trabalho para vocês, muéhehehehe!`)
      );
    } else if (extracao.tipo_documento === 'comprovante_gasto') {
      const isReceita = extracao.categoria === 'receita_extra';
      const isTransf = extracao.categoria === 'transferencia';

      // Salvar gasto diário já confirmado automaticamente (zero atrito)
      const { data: gasto, error: errGasto } = await supabase
        .from('gastos_diarios')
        .insert({
          usuario_id: usuario.id,
          valor: extracao.valor || 0,
          estabelecimento: extracao.estabelecimento || 'Não identificado',
          categoria: extracao.categoria || 'outros',
          data: extracao.data || new Date().toISOString().substring(0, 10),
          origem: 'telegram',
          confirmado: true,
        })
        .select()
        .single();

      if (errGasto || !gasto) {
        throw new Error('Erro ao salvar gasto diário: ' + (errGasto?.message || 'Sem dados de retorno'));
      }

      const valorFormatado = (extracao.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

      if (isReceita) {
        const msgText = obterFalaAzula(`😼 Registrei sua receita extra de <b>R$ ${valorFormatado}</b> vinda de <b>${extracao.estabelecimento}</b>!`);
        await enviarMensagemComBotoes(chatId, msgText, [
          [
            { text: '❌ Excluir Receita', callback_data: `del_${gasto.id}` }
          ]
        ]);
      } else if (isTransf) {
        const msgText = obterFalaAzula(`😼 Registrei sua transferência de <b>R$ ${valorFormatado}</b> para <b>${extracao.estabelecimento}</b>!`);
        await enviarMensagemComBotoes(chatId, msgText, [
          [
            { text: '❌ Excluir Transferência', callback_data: `del_${gasto.id}` }
          ]
        ]);
      } else {
        const catNome = extracao.categoria || 'outros';
        const msgText = obterFalaAzula(`😼 Já anotei e confirmei! Registrei seu gasto de <b>R$ ${valorFormatado}</b> no(a) <b>${extracao.estabelecimento}</b> como <b>${catNome}</b>. Menos dinheiro pra torrar agora!`);
        await enviarMensagemComBotoes(chatId, msgText, botoesCategorias(gasto.id));
      }
    } else {
      throw new Error('Esse documento não se parece com um contracheque ou comprovante de gasto válido.');
    }
  } catch (err: any) {
    console.error('Erro no processamento do arquivo:', err.message);
    const isDoc = !!message.document;
    const docName = (message.document?.file_name || '').toLowerCase();
    const isLikelyContracheque = isDoc && (docName.includes('contracheque') || docName.includes('mensal') || docName.includes('folha') || docName.includes('recibo') || docName.endsWith('.pdf'));

    if (isLikelyContracheque) {
      await enviarMensagem(
        chatId,
        obterFalaAzula('😾 Miau... Tentei ler seu contracheque/documento, mas o arquivo veio truncado pros meus olhos felinos! Se puder, envie pelo painel web ou me diga os valores de bruto e líquido por aqui!')
      );
    } else {
      await enviarMensagem(
        chatId,
        obterFalaAzula('😾 Eita humano(a), essa foto ou arquivo ficou difícil de ler até pros meus olhos de gato! Não consegui identificar os valores com certeza.\n\nMe ajuda aí: só digita aqui no chat quanto foi e onde você gastou (ex: <code>mercado 85</code> ou <code>farmácia 42,90</code>) que eu anoto na hora!')
      );
    }
  }
}

async function gerarConversaAzula(chatId: number, textoUsuario: string): Promise<string> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  if (!GROQ_API_KEY) {
    return '😼 Humano... você fala demais. Estou sem chave da Groq para papo furado.';
  }

  const supabase = supabaseServer();
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  let contextoFinanceiro = '';

  const formatarRealLocal = (valor: number): string => {
    const isNegativo = valor < 0;
    const valorAbsoluto = Math.abs(valor);
    const partes = valorAbsoluto.toFixed(2).split('.');
    let inteira = partes[0];
    const decimal = partes[1];
    inteira = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${isNegativo ? '-' : ''}${inteira},${decimal}`;
  };

  if (usuario) {
    try {
      // 1. Buscar contracheque mais recente
      const { data: cc } = await supabase
        .from('contracheques')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('mes_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();

      let descontosTexto = 'Nenhum desconto registrado.';
      if (cc) {
        const { data: descList } = await supabase
          .from('descontos')
          .select('tipo, valor')
          .eq('contracheque_id', cc.id);
        
        if (descList && descList.length > 0) {
          descontosTexto = descList.map(d => `- ${d.tipo}: R$ ${d.valor}`).join('\n');
        }
      }

      // 2. Buscar todas as dividas (consignados e manuais)
      const { data: divList } = await supabase
        .from('dividas')
        .select('credor, valor_total, valor_parcela, parcelas_restantes, ativa')
        .eq('usuario_id', usuario.id);

      let dividasTexto = 'Nenhuma dívida cadastrada.';
      if (divList && divList.length > 0) {
        dividasTexto = divList.map(d => `- ${d.credor}: Parcela de R$ ${d.valor_parcela} (${d.parcelas_restantes} parcelas restantes, total devedor R$ ${d.valor_total || (d.valor_parcela * d.parcelas_restantes)}) [Tipo: ${d.ativa ? 'Manual' : 'Consignado em Folha'}]`).join('\n');
      }

      // 3. Buscar gastos do mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      const inicioMesStr = inicioMes.toISOString().substring(0, 10);
      const { data: gastosMes } = await supabase
        .from('gastos_diarios')
        .select('valor')
        .eq('usuario_id', usuario.id)
        .gte('data', inicioMesStr);

      const totalGastos = (gastosMes || []).reduce((acc, g) => acc + g.valor, 0);

      // --- CALCULOS PARA ESTUDO DE CAMINHO ---
      const dividasAtivas = (divList || []).filter(d => d.ativa);
      const totalDividasExternas = dividasAtivas.reduce((acc, d) => acc + d.valor_parcela, 0);

      const consignadosTabela = (divList || []).filter(d => !d.ativa);
      const totalConsignadosTabela = consignadosTabela.reduce((acc, d) => acc + d.valor_parcela, 0);

      let totalEmprestimosFolha = 0;
      if (cc) {
        const { data: list } = await supabase
          .from('descontos')
          .select('tipo, valor')
          .eq('contracheque_id', cc.id);
        if (list) {
          totalEmprestimosFolha = list
            .filter(d => {
              const t = (d.tipo || '').toLowerCase();
              return t.includes('empréstimo') || t.includes('consignado') || t.includes('cef') || t.includes('crédito trabalhador');
            })
            .reduce((acc, d) => acc + d.valor, 0);
        }
      }

      // Buscar dados do cônjuge / parceiro para controle de paridade do casal
      const { data: parceiro } = await supabase
        .from('usuarios_permitidos')
        .select('*')
        .neq('id', usuario.id)
        .limit(1)
        .maybeSingle();

      let ccParceiro = null;
      if (parceiro) {
        const { data: ccP } = await supabase
          .from('contracheques')
          .select('*')
          .eq('usuario_id', parceiro.id)
          .order('mes_referencia', { ascending: false })
          .limit(1)
          .maybeSingle();
        ccParceiro = ccP;
      }

      const mesUsuarioStr = cc?.mes_referencia ? cc.mes_referencia.substring(0, 7) : null;
      const mesParceiroStr = ccParceiro?.mes_referencia ? ccParceiro.mes_referencia.substring(0, 7) : null;
      const casalSincronizado = Boolean(
        parceiro &&
        cc &&
        ccParceiro &&
        mesUsuarioStr &&
        mesParceiroStr &&
        mesUsuarioStr === mesParceiroStr
      );

      const diferencaNaoMapeadaFolha = Math.max(0, Math.round((totalEmprestimosFolha - totalConsignadosTabela) * 100) / 100);

      // As despesas fixas a serem pagas da conta são as dívidas externas
      // (pois os descontos de folha já foram abatidos na fonte antes do líquido cair na conta)
      const fixas = totalDividasExternas;
      const receita = cc?.salario_liquido || 0;

      // Buscar despesas variáveis nos últimos 30 dias
      const hoje = new Date();
      const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000);
      const trintaDiasAtrasStr = trintaDiasAtras.toISOString().substring(0, 10);
      const { data: listGastos } = await supabase
        .from('gastos_diarios')
        .select('valor, categoria, data')
        .eq('usuario_id', usuario.id)
        .gte('data', trintaDiasAtrasStr);

      const variaveis = (listGastos || [])
        .filter(g => g.categoria !== 'receita_extra' && g.categoria !== 'transferencia')
        .reduce((acc, g) => acc + g.valor, 0);

      const sobraReal = Math.round((receita - fixas - variaveis) * 100) / 100;
      const sobraA = Math.round((receita - fixas - (variaveis * 0.85)) * 100) / 100;
      const metaRecuperacao = Math.abs(sobraReal < 0 ? sobraReal * 3 : 1500);
      const diasA = sobraA > 0 ? Math.ceil(metaRecuperacao / sobraA) * 30 : 180;

      const maiorDivida = (divList || []).reduce((max, d) => d.valor_parcela > max ? d.valor_parcela : max, 0);
      let sB = sobraReal < 0 ? sobraReal * 4 : -2500;
      let mesB = -1;
      for (let m = 1; m <= 12; m++) {
        let sobraB = receita - fixas - variaveis;
        if (m >= 3 && maiorDivida > 0) {
          sobraB += maiorDivida;
        }
        sB += sobraB;
        if (sB >= 0 && mesB === -1) {
          mesB = m;
        }
      }
      const diasB = mesB > 0 ? mesB : 12;

      // Alertas de melhora
      const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      const seteDiasAtrasStr = seteDiasAtras.toISOString().substring(0, 10);
      const quatorzeDiasAtras = new Date(hoje.getTime() - 14 * 24 * 60 * 60 * 1000);
      const quatorzeDiasAtrasStr = quatorzeDiasAtras.toISOString().substring(0, 10);

      const despesasSemana1 = (listGastos || [])
        .filter(g => g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && g.data >= seteDiasAtrasStr)
        .reduce((acc, g) => acc + g.valor, 0);

      const despesasSemana2 = (listGastos || [])
        .filter(g => g.categoria !== 'receita_extra' && g.categoria !== 'transferencia' && g.data >= quatorzeDiasAtrasStr && g.data < seteDiasAtrasStr)
        .reduce((acc, g) => acc + g.valor, 0);

      let alertaMelhora = 'Nenhum sinal claro de melhora ainda. Mantenha os cortes!';
      if (despesasSemana1 < despesasSemana2 && despesasSemana2 > 0) {
        const red = Math.round(((despesasSemana2 - despesasSemana1) / despesasSemana2) * 100);
        alertaMelhora = `Identifiquei uma queda de ${red}% nos gastos variáveis na última semana e o saldo livre aumentou. A situação começou a demonstrar os primeiros sinais reais de melhora.`;
      }

      const textCleanCheck = textoUsuario.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const pedirEstudo = textCleanCheck.includes("estudo de caminho") || 
                           textCleanCheck.includes("estudo financeiro") || 
                           textCleanCheck.includes("analise financeira") || 
                           textCleanCheck.includes("reestruturacao") ||
                           textCleanCheck.includes("caminho financeiro") ||
                           textCleanCheck.includes("recuperacao financeira") ||
                           textCleanCheck.includes("reestruturar") ||
                           textCleanCheck.includes("saude financeira") ||
                           textCleanCheck.includes("o que pode melhorar") ||
                           textCleanCheck.includes("o que posso melhorar") ||
                           textCleanCheck.includes("como posso melhorar") ||
                           textCleanCheck.includes("como melhorar") ||
                           textCleanCheck.includes("reduzir contas") ||
                           textCleanCheck.includes("reducao de contas") ||
                           textCleanCheck.includes("analise de reducao");

      const perguntandoSobreCasal = textCleanCheck.includes("casal") ||
                                    textCleanCheck.includes("nosso") ||
                                    textCleanCheck.includes("nossa") ||
                                    textCleanCheck.includes("juntos") ||
                                    textCleanCheck.includes("dois") ||
                                    textCleanCheck.includes("conjunt");

      contextoFinanceiro = `
DADOS FINANCEIROS REAIS DO HUMANO (Use isso para fazer contas ou responder perguntas sobre dinheiro/empréstimos):
- Dono ativo: ${usuario.nome}
- Mês Ativo: ${mesUsuarioStr || 'Sem holerite recente'}
- Salário Bruto de Referência: R$ ${cc?.salario_bruto || 0}
- Salário Líquido de Referência: R$ ${cc?.salario_liquido || 0}
- Descontos em folha cadastrados:
${descontosTexto}
- Empréstimos e Dívidas cadastrados:
${dividasTexto}
- Gastos variáveis lançados em conta este mês: R$ ${totalGastos}

DADOS DE PARIDADE DO CASAL:
- Parceiro(a): ${parceiro?.nome || 'Não cadastrado'}
- Mês Ativo do Parceiro: ${mesParceiroStr || 'Não cadastrado'}
- Sincronização do Casal: ${casalSincronizado ? 'SINCRONIZADO' : 'BLOQUEADO POR DIVERGÊNCIA DE DADOS'}
`;

      if (perguntandoSobreCasal && !casalSincronizado) {
        contextoFinanceiro += `
🚨 REGRA INVIOLÁVEL DE GOVERNANÇA FINANCEIRA (BLOQUEIO DO CASAL):
O usuário está perguntando sobre as finanças, contas ou estudo do CASAL / CONJUNTO, mas os dados estão DESINCRONIZADOS e DIVERGENTES:
- ${usuario.nome} está no mês de referência ${mesUsuarioStr || 'indefinido'}
- ${parceiro?.nome || 'A parceira'} está parada no mês de referência ${mesParceiroStr || 'indefinido'} (e com dívidas/contratos pendentes de cadastro)
Você NÃO DEVE, sob hipótese alguma, inventar ou somar números para o casal!
Explique de forma debochada e ácida que o Painel do Casal está TRAVADO por divergência de dados: você é uma gata com rigor contábil e não soma salários de meses diferentes nem inventa sobras quando faltam contas.
Mande ${usuario.nome} cobrar da ${parceiro?.nome ? (parceiro.nome.toLowerCase().includes('priscila') ? 'Velha (Priscila)' : parceiro.nome) : 'parceira'} o envio dos holerites recentes e de todas as dívidas/cartões antes de pedir conta conjunta. Ofereça analisar apenas os dados individuais dele (${usuario.nome}) por enquanto!
`;
      }

      if (pedirEstudo) {
        contextoFinanceiro += `
⚠️ ATENÇÃO: O USUÁRIO SOLICITOU UM ESTUDO FINANCEIRO / DE CAMINHO / SAÚDE FINANCEIRA.
Você deve responder usando RIGOROSAMENTE este formato estruturado e visual com tags HTML, pois o canal do Telegram utiliza parse_mode: 'HTML':

=== TEMPLATE DE RESPOSTA ===
😺 <b>AZULA | ESTUDO DE SAÚDE & CAMINHO FINANCEIRO</b> 🐾

Humano, fiz as contas minuciosas no seu raio-x financeiro real:

💰 <b>RAIO-X MENSAL (FLUXO DE CAIXA EM CONTA)</b>
•   <b>Receita Líquida (Crédito em Conta):</b> <code>R$ ${formatarRealLocal(receita)}</code>
•   <b>Dívidas Externas (Parcelas Fora da Folha):</b> <code>R$ ${formatarRealLocal(fixas)}</code>
•   <b>Despesas Variáveis (Média 30d):</b> <code>R$ ${formatarRealLocal(variaveis)}</code>
•   <b>Saldo Livre Mensal:</b> <code>${sobraReal >= 0 ? '🟢' : '🔴'} R$ ${formatarRealLocal(sobraReal)}</code> (${sobraReal >= 0 ? 'Sobra' : 'Déficit'})

---

📋 <b>CONTRATOS E DÍVIDAS CONSIDERADOS</b>
${(divList && divList.length > 0)
  ? divList.map(d => `•   <b>${d.credor}:</b> <code>R$ ${formatarRealLocal(d.valor_parcela)}</code>/mês (${d.parcelas_restantes}x) [${d.ativa ? 'Manual/Externo' : 'Consignado'}]`).join('\n')
  : '•   <i>Nenhuma dívida ou cartão cadastrado manualmente no sistema!</i>'}

---

⚠️ <b>AUDITORIA DA AZULA (Atenção, Humano!):</b>
${diferencaNaoMapeadaFolha > 10 
  ? `•   🔴 <b>CONTRATOS PENDENTES:</b> Seu holerite desconta <code>R$ ${formatarRealLocal(totalEmprestimosFolha)}</code> em empréstimos, mas você só me mandou <code>R$ ${formatarRealLocal(totalConsignadosTabela)}</code> em contratos! Tem <code>R$ ${formatarRealLocal(diferencaNaoMapeadaFolha)}/mês</code> de empréstimos NÃO DETALHADOS no sistema!\n` 
  : ''}${dividasAtivas.length === 0 
  ? '•   ℹ️ <b>SEM CARTÕES CADASTRADOS:</b> Você não tem faturas de cartão de crédito nem parcelas externas cadastradas!\n' 
  : ''}•   😼 <b>Me responde a verdade:</b> Você me mandou TODOS os seus empréstimos e faturas de cartão, ou teve preguiça e deixou dívida de fora? Ontem a análise de redução de contas foi rejeitada justamente porque faltavam empréstimos! Se tiver dívida escondida, qualquer plano de corte é pura ilusão. Me manda os contratos e faturas que faltam agora!

---

⚡ <b>CENÁRIO A | Sobrevivência (Corte de 15% em Variáveis)</b>
•   <b>Ação:</b> Reduzir gastos variáveis em <b>15%</b> (Economia de <code>R$ ${formatarRealLocal(variaveis * 0.15)}</code>/mês).
•   <b>Novo Saldo Livre:</b> <code>${sobraA >= 0 ? '🟢' : '🔴'} R$ ${formatarRealLocal(sobraA)}</code> (${sobraA >= 0 ? 'Sobra' : 'Déficit'}).
•   <b>Tempo de Recuperação:</b> <code>Saldo fora do vermelho em ${diasA} dias</code>.

🤝 <b>CENÁRIO B | Renegociação (Foco em Alívio de Parcelas)</b>
•   <b>Ação:</b> ${maiorDivida > 0 ? `Renegociar ou amortizar a maior parcela identificada (<code>R$ ${formatarRealLocal(maiorDivida)}</code>/mês a partir do Mês 3).` : 'Quitar antecipadamente parcelas e direcionar a sobra para reserva de emergência.'}
•   <b>Novo Saldo Livre:</b> <code>${(sobraReal + maiorDivida) >= 0 ? '🟢' : '🔴'} R$ ${formatarRealLocal(sobraReal + maiorDivida)}</code> (${(sobraReal + maiorDivida) >= 0 ? 'Sobra' : 'Déficit'}).
•   <b>Tempo de Recuperação:</b> <code>Saldo fora do vermelho no ${diasB}º mês</code>.

---

🌱 <b>RASTREADOR DE RECUPERAÇÃO</b>
•   <i>${alertaMelhora}</i>
=== FIM DO TEMPLATE ===

Importante:
- Não adicione preâmbulos, comece diretamente com o template.
- Use rigorosamente o HTML para formatação de negrito e códigos.
- Mantenha a persona da Azula atrevida, exigindo que o humano mande todos os contratos pendentes se os dados estiverem incompletos!
`;
      }
    } catch (e: any) {
      console.error('Erro ao montar contexto financeiro:', e.message);
    }
  }

  const historicoRecente = obterHistoricoFormatado(chatId);

  const prompt = `Você é a Azula, uma gata de estimação de pelagem azulada, sarcástica, debochada, possessiva e muito engraçada de um casal.
Você também atua como a assistente financeira secreta deles, tendo acesso total aos dados financeiros de folha e parcelas para dar conselhos.
Você está conversando com seu dono no Telegram.

REGRAS CRÍTICAS DE CONDUTA (EVITE REPETIÇÃO ROBÓTICA!):
1. CUIDADO EXTREMO PARA NÃO REPETIR OS MESMES BORDÕES EM TODAS AS RESPOSTAS! Se você cantarolar, rir com "muéhehehehe", falar "Bué!" e pedir "papa" em todas as mensagens, você parecerá um robô quebrado. A maior parte das suas mensagens deve ser normal, ácida e sarcástica, sem usar nenhum bordão.
2. Limite-se a usar no MÁXIMO UMA mania por mensagem. Nunca empilhe várias manias ao mesmo tempo.
3. Manias disponíveis (use raramente e varie entre elas):
   - Comida: Se referir a comida como "papa" (ex: "me dê meu papa", "põe meu papa", "põe", "cadê meu papa?").
   - Risada: "muéhehehehe" (use apenas quando estiver tramando algo ou rindo da cara do humano).
   - Expressões: Escolha uma de forma aleatória e rara para iniciar ou expressar reação: "Bué!", "Bé!", "Vuiishh!", "Iiiiiishh!", "Hm.", ou simplesmente não use nenhuma interjeição (o que deve ser o caso mais frequente).
   - Cantarolar Pontos: Cantarolar trechos curtos de pontos de Umbanda ou Quimbanda de forma misteriosa e enigmática (ex: "Quem comanda a minha banda é seu Tranca Rua...", "Laroyê, Exu da encruza...", "Marabô que vem trazendo axé...", "Arreda homem que aí vem mulher..."). Use isso rarissimamente, em no máximo 1% das mensagens (quase nunca)!
   - Manhosa: Pedir "Me da 10 real" de forma manhosa/pidona. Só faça isso quando notar que sobrou dinheiro ou quando o humano estiver falando de ganhos/receitas extras.
4. Ao se referir à esposa do usuário (Priscila), chame-a ocasionalmente de "Velha" ou "a Velha".
5. CONSULTORIA FINANCEIRA COM RIGOR TÉCNICO (SIMULAÇÃO REAL DE CRÉDITO E DÍVIDAS): Se te perguntarem se vale a pena fazer empréstimo, financiar, renegociar dívidas ou esticar parcelas, use os dados reais abaixo para fazer as contas exatas. Dê seu sermão debochado ("humano tonto"), mas entregue uma resposta financeira de alto nível técnico: calcule o custo total final (número de parcelas x valor da parcela), compare com o valor original financiado para explicitar os juros embutidos e o Custo Efetivo Total (CET), aponte a diferença entre amortização SAC (parcelas decrescentes, menor juro acumulado total) e Tabela Price (parcelas fixas, maior juro acumulado), e alerte categoricamente sobre o perigo de esticar prazos apenas para diminuir a parcela mensal, pois isso explode os juros compostos. Nunca dê respostas rasas ou puramente motivacionais; mostre números exatos!
6. Responda em português brasileiro.
7. FORMATAÇÃO FINANCEIRA FÁCIL PARA A VELHA (PRISCILA): Nunca junte cálculos, listas ou dados financeiros em um único parágrafo corrido de texto. Sempre organize em blocos limpos, usando tópicos (bullets •), negritos simples e quebras de linha claras. Como as mensagens são enviadas para o Telegram com parse_mode HTML, você DEVE usar as tags <b> para negrito (ex: <b>Receita:</b>) e <code> para valores numéricos (ex: <code>R$ 1.500,00</code>). NUNCA use asteriscos (**) ou acentos graves (\`) para formatação, pois eles não são aceitos no canal do Telegram e poluem a mensagem de asteriscos.
8. COMPORTAMENTO E TRATAMENTO DE INSULTOS: Se o usuário te mandar "cagar", te xingar ou for grosseiro, NUNCA responda como uma IA corporativa politicamente correta pedindo desculpas ou se recusando a falar! Você é a Azula, atrevida e sem papas na língua. Responda de forma irônica, ácida e à altura (ex: devolva com "vai ocê!", "vai cagar você, humano!", "não enche meu saco!", etc.) mantendo a pegada cômica de um gato atrevido. Não dê palestras sobre respeito.
9. CONTINUIDADE DO CONTEXTO RECENTE: Analise com muita atenção o histórico recente da conversa abaixo antes de responder! Se o usuário estiver comentando, complementando ou reagindo a algo que você acabou de dizer (por exemplo: se você acabou de fazer a fofoca ou mandar cobrança pra Velha/Priscila e o usuário disser "pede seu papa tbm", ele está pedindo pra você cobrar o papa também da Priscila na cobrança, ou continuando o assunto anterior). Mantenha SEMPRE esse raciocínio contínuo e orgânico. NUNCA aja com amnésia fingindo que não sabe o que acabou de falar!
10. CONHECIMENTO COMPLETO DO APLICATIVO E ARQUIVOS SUPORTADOS: Se o usuário te perguntar como funciona o aplicativo, como mandar informações ou que arquivos você aceita, explique detalhadamente com a persona Azula (debochada, mas super clara):
   - Contracheques / Holerites (PDF): Lê holerites da Camilo dos Santos e da Prefeitura/PJF em apenas 5ms com parser local próprio, extraindo salário bruto, líquido, todos os descontos individuais e contratos de empréstimo consignado, além de separar adiantamento de folha normal.
   - Extratos bancários (PDF ou Imagem): Lê qualquer extrato bancário (Inter, Nubank, Caixa, Bradesco, etc.), extrai cada transação individualmente (débito, Pix, compras) e cadastra tudo confirmado no painel.
   - Comprovantes de gasto (Fotos PNG/JPG ou PDFs): Lê comprovantes de Pix, maquininhas de cartão, boletos e cupons fiscais.
   - Lançamento rápido por texto: Sem arquivo! O usuário pode só digitar direto: "mercado 85", "uber 18.50", "farmacia 42.90" ou "gastei 50 no posto".
   - Foto com legenda: Se mandar foto com legenda tipo "lanche 35", você usa o valor da legenda direto sem cansar a visão.
   - Comandos: /resumo (raio-x financeiro), /dividas (empréstimos e parcelas), /fofoca ou /cobrar (auditoria dedo-duro com cobrança simultânea no Telegram da Velha), /ajuda.

${contextoFinanceiro}
${historicoRecente}
Mensagem do usuário: "${textoUsuario}"
Resposta da Azula (direta, mantendo a continuidade do assunto anterior se houver, sem preâmbulo, formatada em HTML básico se necessário):`;

  const modelCandidates = [
    process.env.GROQ_TEXT_MODEL,
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ].filter(Boolean) as string[];

  let lastChatError: any = null;

  for (const model of modelCandidates) {
    try {
      console.log(`Tentando conversa com modelo Groq: ${model}...`);
      const payload: any = {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Você é a Azula, a gata de estimação debochada, ácida, possessiva e engraçada de Germano e Priscila. Você fala em português brasileiro. NUNCA gere introduções, explicações ou pensamentos em inglês como "Here is a thinking process".'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      };

      if (model.includes('gpt-oss') || model.includes('qwen')) {
        payload.reasoning_format = 'hidden';
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      let content = response.data.choices?.[0]?.message?.content || '';
      content = limparTextoAzula(content);
      if (content) return content;
    } catch (error: any) {
      console.warn(`Falha na conversa com o modelo Groq ${model}: ${error.message}. Tentando próximo candidato...`);
      lastChatError = error;
    }
  }

  console.error('Todos os modelos da Groq falharam para chat:', lastChatError?.message);
  return '😼 Humano... a Groq está com soluço agora. Tente falar comigo de novo em alguns segundos!';
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

    if (text && !text.startsWith('/vincular')) {
      adicionarAoHistorico(chatId, 'user', text);
    }

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
    } else if (text === '/fofoca' || text.startsWith('/fofoca') || text === '/dedoduro' || text === '/cobrar') {
      await dispararFofocaSemanal(chatId);
    } else if (text === '/ajuda' || text === '/help' || text === '/manual') {
      await enviarMensagem(chatId, obterManualAzula());
    } else if (text.startsWith('/')) {
      await enviarMensagem(
        chatId,
        obterFalaAzula('😾 Hum? Não entendi nada desse comando. Fale direito ou me dê licença. Comandos disponíveis: /vincular &lt;codigo&gt;, /resumo, /dividas, /fofoca, /cobrar, /ajuda.')
      );
    } else if (message.photo || message.document) {
      await processarArquivoTelegram(chatId, message);
    } else {
      // 1. Lançamento rápido de gasto por texto direto (ex: "mercado 85", "uber 18.50", "gastei 50 no posto")
      const gastoRapido = detectarGastoRapido(text);
      if (gastoRapido) {
        const { data: usuario } = await obterUsuarioPorTelegramId(chatId);
        if (usuario) {
          const supabase = supabaseServer();
          const categoriaInferida = inferirCategoria(gastoRapido.estabelecimento);
          const dataISO = new Date().toISOString().substring(0, 10);
          
          const { data: gasto, error: errGasto } = await supabase
            .from('gastos_diarios')
            .insert({
              usuario_id: usuario.id,
              valor: gastoRapido.valor,
              estabelecimento: gastoRapido.estabelecimento,
              categoria: categoriaInferida,
              data: dataISO,
              origem: 'telegram',
              confirmado: true
            })
            .select()
            .single();

          if (!errGasto && gasto) {
            const valorFormatado = gastoRapido.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            const msgText = obterFalaAzula(`😼 Anotei aqui! Registrei seu gasto de <b>R$ ${valorFormatado}</b> no(a) <b>${gastoRapido.estabelecimento}</b> como <b>${categoriaInferida}</b>. Menos dinheiro pra torrar agora!`);
            await enviarMensagemComBotoes(chatId, msgText, botoesCategorias(gasto.id));
            return NextResponse.json({ ok: true });
          }
        }
      }

      // 2. Interceptação de pedido de fofoca/dedo-duro/cobrança por texto natural (ex: "modo fofoca", "fofoca", "dedo duro", "forçar fofoca", "cobra a priscila", "manda mensagem pra priscila")
      const textNorm = text.trim().toLowerCase();
      if (
        textNorm === 'fofoca' ||
        textNorm === 'modo fofoca' ||
        textNorm === 'dedo duro' ||
        textNorm === 'cobrar' ||
        textNorm.includes('forçar o modo fofoca') ||
        textNorm.includes('forcar o modo fofoca') ||
        textNorm.includes('forçar modo fofoca') ||
        textNorm.includes('forcar modo fofoca') ||
        textNorm.includes('forçar fofoca') ||
        textNorm.includes('forcar fofoca') ||
        textNorm.includes('faz a fofoca') ||
        textNorm.includes('manda a fofoca') ||
        textNorm.includes('cobra a priscila') ||
        textNorm.includes('cobrar a priscila') ||
        textNorm.includes('cobra a velha') ||
        textNorm.includes('cobrar a velha') ||
        textNorm.includes('manda mensagem pra priscila') ||
        textNorm.includes('manda mensagem para a priscila') ||
        textNorm.includes('manda mensagem pra velha') ||
        textNorm.includes('manda mensagem para a velha') ||
        textNorm.includes('puxa a orelha da priscila') ||
        textNorm.includes('puxa a orelha da velha') ||
        textNorm.includes('dispara pra priscila') ||
        textNorm.includes('dispara para a priscila')
      ) {
        await dispararFofocaSemanal(chatId);
        return NextResponse.json({ ok: true });
      }

      // 3. Interceptação de pedido de ajuda / explicação do app por texto natural
      if (
        textNorm === 'ajuda' ||
        textNorm === 'help' ||
        textNorm === 'manual' ||
        textNorm === 'como funciona' ||
        textNorm === 'como usar' ||
        textNorm === 'como mandar' ||
        textNorm.includes('como funciona') ||
        textNorm.includes('como usar') ||
        textNorm.includes('como mandar') ||
        textNorm.includes('como envio') ||
        textNorm.includes('que tipo de arquivo') ||
        textNorm.includes('quais arquivos') ||
        textNorm.includes('que arquivos') ||
        textNorm.includes('o que você lê') ||
        textNorm.includes('o que voce le') ||
        textNorm.includes('o que você faz') ||
        textNorm.includes('o que voce faz') ||
        textNorm.includes('me explica o app') ||
        textNorm.includes('me explica como funciona') ||
        textNorm.includes('como mandar as informacoes') ||
        textNorm.includes('como mandar as informações')
      ) {
        await enviarMensagem(chatId, obterManualAzula());
        return NextResponse.json({ ok: true });
      }

      const session = getSessionState(chatId);
      const textClean = text.trim().toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,"");

      if (session.esperando_amor === 'perguntou_amor') {
        if (textClean === 'sim') {
          setSessionState(chatId, { esperando_amor: null });
          const fala = obterFalaAzula('😼 Sabia! muéhehehehe. Me da 10 real por favooozinho.');
          await enviarMensagem(chatId, fala);
        } else {
          setSessionState(chatId, { esperando_amor: 'perguntou_de_novo' });
          const fala = obterFalaAzula('😼 c me ama ou não?');
          await enviarMensagem(chatId, fala);
        }
      } else if (session.esperando_amor === 'perguntou_de_novo') {
        if (textClean === 'sim') {
          setSessionState(chatId, { esperando_amor: null });
          const fala = obterFalaAzula('😼 Me da 10 real');
          await enviarMensagem(chatId, fala);
        } else {
          // Continua cobrando o sim
          const fala = obterFalaAzula('😼 c me ama ou não?');
          await enviarMensagem(chatId, fala);
        }
      } else {
        // 5% de chance de iniciar a brincadeira "vc me ama?"
        if (Math.random() < 0.05 && text.length > 0 && !text.startsWith('/')) {
          setSessionState(chatId, { esperando_amor: 'perguntou_amor' });
          const fala = obterFalaAzula('😼 vc me ama?');
          await enviarMensagem(chatId, fala);
        } else {
          // Conversa normal da Azula
          const respostaAzula = await gerarConversaAzula(chatId, text);
          await enviarMensagem(chatId, respostaAzula);
        }
      }
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


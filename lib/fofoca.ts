import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';

export function escaparHTMLTelegram(texto: string): string {
  let temp = texto.replace(/&(?!(amp|lt|gt);)/g, '&amp;');
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

  temp = temp.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (const tag of Object.keys(placeholders)) {
    const regex = new RegExp(placeholders[tag], 'g');
    temp = temp.replace(regex, tag);
  }

  return temp;
}

export async function enviarMensagemTelegram(chatId: number, texto: string) {
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

export async function chamarGroqFofoca(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) return '';

  const modelCandidates = [
    process.env.GROQ_TEXT_MODEL,
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ].filter(Boolean) as string[];

  for (const model of modelCandidates) {
    try {
      const payload: any = {
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 800
      };

      if (model.includes('gpt-oss')) {
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
          timeout: 4500
        }
      );
      let content = response.data.choices?.[0]?.message?.content || '';
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (content) return content;
    } catch (e: any) {
      console.warn(`Groq model ${model} falhou ou timed out no fofoca: ${e.message}`);
    }
  }
  return '';
}

export function gerarMensagemFallback(
  isGermano: boolean,
  totalGermano: number,
  totalPriscila: number,
  textoGastosGermano: string,
  textoGastosPriscila: string
): string {
  const formatar = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  if (isGermano) {
    return `😼 <b>Miau, Germano!</b> Acorda pra vida, humano!\n\nPassando aqui no meu dever oficial de auditora felina pra te dedurar a <b>Velha</b>: nos últimos 7 dias ela ${
      totalPriscila > 0
        ? `torrou <code>R$ ${formatar(totalPriscila)}</code> (${textoGastosPriscila})`
        : 'está quieta demais e provavelmente escondendo compras de mim'
    }!\n\nE você já gastou <code>R$ ${formatar(totalGermano)}</code>. Cadê os comprovantes recentes e os contracheques que você prometeu mandar? A Velha não me manda nada porque é preguiçosa, mas você pelo menos devia me manter informada! Bora atualizar esse painel antes que eu derrube as coisas da mesa! 🐾`;
  } else {
    return `😼 <b>Miau, Priscila!</b> Põe meu papa e presta atenção!\n\nPassando aqui pra te dedurar o seu marido: nos últimos 7 dias o Germano ${
      totalGermano > 0
        ? `gastou <code>R$ ${formatar(totalGermano)}</code> (${textoGastosGermano})`
        : 'não lançou quase nada e deve estar tramando alguma'
    }!\n\nE você? <b>Você NUNCA me manda nada!</b> Nem comprovante de gasto, nem contracheque recente... É uma preguiça sem fim de atualizar o painel! Manda os comprovantes logo ou vou miar no seu ouvido a noite inteira! 🐾💥`;
  }
}

export async function dispararFofocaSemanal(chatIdSolicitante?: number) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured');
  }

  const supabase = supabaseServer();

  // 1. Buscar usuários vinculados ao Telegram
  const { data: users, error: errUsers } = await supabase
    .from('usuarios_permitidos')
    .select('*')
    .not('telegram_chat_id', 'is', null);

  if (errUsers || !users || users.length === 0) {
    return { success: false, message: 'Nenhum usuário com Telegram vinculado.' };
  }

  // 2. Buscar gastos dos últimos 7 dias
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
  const seteDiasAtrasStr = seteDiasAtras.toISOString().substring(0, 10);

  const { data: listGastos } = await supabase
    .from('gastos_diarios')
    .select('valor, estabelecimento, categoria, data, usuario_id')
    .gte('data', seteDiasAtrasStr);

  const germano = users.find(u => u.email === 'germanorcarmo@gmail.com');
  const priscila = users.find(u => u.email === 'priscilaaparecida0@gmail.com');

  const descrGastos = (gastos: any[]) => {
    if (!gastos || gastos.length === 0) return 'Nenhum';
    return gastos.slice(0, 5).map(g => `${g.estabelecimento} (R$ ${g.valor.toFixed(2)})`).join(', ');
  };

  const gGermano = (listGastos || []).filter(g => germano && g.usuario_id === germano.id && g.categoria !== 'receita_extra');
  const gPriscila = (listGastos || []).filter(g => priscila && g.usuario_id === priscila.id && g.categoria !== 'receita_extra');

  const totalGermano = gGermano.reduce((acc, g) => acc + g.valor, 0);
  const totalPriscila = gPriscila.reduce((acc, g) => acc + g.valor, 0);

  const textoGastosGermano = descrGastos(gGermano);
  const textoGastosPriscila = descrGastos(gPriscila);

  // 3. Processamento paralelo
  const disparos = users.map(async (user) => {
    const isGermano = user.email === 'germanorcarmo@gmail.com';
    const prompt = `Você é a Azula, a gata de estimação debochada, sarcástica, possessiva e muito engraçada do casal Germano e Priscila.
Você está enviando uma mensagem semanal de cobrança surpresa para o(a) seu(sua) dono(a) ${user.nome} no Telegram para puxar a orelha deles e exigir atualizações.

DADOS REAIS DOS ÚLTIMOS 7 DIAS:
- Gasto total do Germano: R$ ${totalGermano.toFixed(2)} (Exemplos: ${textoGastosGermano})
- Gasto total da Priscila (a "Velha"): R$ ${totalPriscila.toFixed(2)} (Exemplos: ${textoGastosPriscila})

INSTRUÇÕES DA MENSAGEM:
1. Mantenha a persona de um gato debochado, sem paciência e irônico.
2. Seja DEDO DURO (snitch) de forma cômica:
   - Se você estiver falando com o Germano: DEDURE o que a Priscila (a "Velha") andou gastando. Se ela não gastou nada, diga que ela está quieta demais e provavelmente escondendo compras de você. Comente com Germano que a Priscila é uma preguiçosa que nunca te envia nenhum comprovante ou contracheque e que ele é o único que te mantém informada.
   - Se você estiver falando com a Priscila: DEDURE o que o Germano andou gastando. Puxe a orelha dela especificamente porque ela NUNCA envia os comprovantes de gastos dela nem os contracheques recentes (ela é super relapsa com isso e não manda nada!). Dê um belo sermão de gato nela por conta dessa preguiça de atualizar o painel.
3. Cobre que eles enviem novos comprovantes de gastos ou os contracheques recentes.
4. Escreva uma mensagem curta (máximo de 3 a 4 parGFraços curtos).
5. FORMATAÇÃO EXTREMAMENTE OBRIGATÓRIA: Use tags HTML como <b> para negritos (ex: <b>Miau!</b>) e <code> para valores (ex: <code>R$ 150,00</code>). NUNCA use asteriscos (**) ou crases (\`) para formatar, pois o Telegram não aceita markdown e a mensagem ficará cheia de símbolos.

Escreva a mensagem diretamente direcionada para ${user.nome} (sem preâmbulos ou introduções):`;

    let mensagem = await chamarGroqFofoca(prompt);

    if (!mensagem) {
      mensagem = gerarMensagemFallback(
        isGermano,
        totalGermano,
        totalPriscila,
        textoGastosGermano,
        textoGastosPriscila
      );
    }

    if (user.telegram_chat_id) {
      await enviarMensagemTelegram(Number(user.telegram_chat_id), mensagem);
      return { user: user.nome, status: 'enviado' };
    }
    return { user: user.nome, status: 'sem_chat_id' };
  });

  const resultados = await Promise.allSettled(disparos);

  // Se foi disparado por um chat específico no Telegram, envia confirmação para quem pediu
  if (chatIdSolicitante) {
    const solicitante = users.find(u => Number(u.telegram_chat_id) === chatIdSolicitante);
    const nomeOutro = solicitante?.email === 'germanorcarmo@gmail.com' ? 'a Velha (Priscila)' : 'o Germano';
    await enviarMensagemTelegram(
      chatIdSolicitante,
      `😼 <b>Prontinho!</b> Já fui fofoqueira e dedo-duro com sucesso! Puxei a orelha d'${nomeOutro} e mandei cobrança pra geral! muéhehehehe. 🐾`
    );
  }

  return {
    success: true,
    message: 'Fofocas semanais da Azula processadas com sucesso.',
    resultados: resultados.map(r => r.status === 'fulfilled' ? r.value : { status: 'erro' })
  };
}

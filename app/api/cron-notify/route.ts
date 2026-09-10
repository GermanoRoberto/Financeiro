import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';

export const dynamic = 'force-dynamic';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';

function escaparHTMLTelegram(texto: string): string {
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

async function enviarMensagem(chatId: number, texto: string) {
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

async function chamarGroq(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) return '';

  const modelCandidates = [
    'llama-3.3-70b-versatile',
    'llama-3.2-3b-preview',
    'llama-3.2-11b-vision-preview'
  ];

  for (const model of modelCandidates) {
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.8,
          max_tokens: 800
        },
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 4500
        }
      );
      const content = response.data.choices?.[0]?.message?.content || '';
      if (content.trim()) return content.trim();
    } catch (e: any) {
      console.warn(`Groq model ${model} falhou ou timed out no cron: ${e.message}`);
    }
  }
  return '';
}

function gerarMensagemFallback(
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

export async function GET(req: NextRequest) {
  try {
    // 1. Validação de Invocação:
    // Reconhece chamadas autênticas do agendador da Vercel (User-Agent vercel-cron ou cabeçalho x-vercel-cron-schedule),
    // ou Bearer token coincidente com CRON_SECRET, ou gatilho manual (?teste=true).
    const authHeader = req.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET || '';
    const userAgent = req.headers.get('user-agent') || '';
    const cronSchedule = req.headers.get('x-vercel-cron-schedule') || '';
    const isVercelCron = userAgent.includes('vercel-cron') || !!cronSchedule;
    const isBearerValid = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    const url = new URL(req.url);
    const isManualTest = url.searchParams.get('teste') === 'true' || url.searchParams.get('force') === 'true';

    if (cronSecret && !isBearerValid && !isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 });
    }

    const supabase = supabaseServer();

    // 2. Buscar usuários vinculados ao Telegram
    const { data: users, error: errUsers } = await supabase
      .from('usuarios_permitidos')
      .select('*')
      .not('telegram_chat_id', 'is', null);

    if (errUsers || !users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'Nenhum usuário com Telegram vinculado.' });
    }

    // 3. Buscar gastos dos últimos 7 dias
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

    // 4. Processamento paralelo (Promise.allSettled) com fallback resiliente
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
4. Escreva uma mensagem curta (máximo de 3 a 4 parágrafos curtos).
5. FORMATAÇÃO EXTREMAMENTE OBRIGATÓRIA: Use tags HTML como <b> para negritos (ex: <b>Miau!</b>) e <code> para valores (ex: <code>R$ 150,00</code>). NUNCA use asteriscos (**) ou crases (\`) para formatar, pois o Telegram não aceita markdown e a mensagem ficará cheia de símbolos.

Escreva a mensagem diretamente direcionada para ${user.nome} (sem preâmbulos ou introduções):`;

      let mensagem = await chamarGroq(prompt);

      if (!mensagem) {
        console.log(`Groq indisponível/timed out. Acionando mensagem de fallback da Azula para ${user.nome}...`);
        mensagem = gerarMensagemFallback(
          isGermano,
          totalGermano,
          totalPriscila,
          textoGastosGermano,
          textoGastosPriscila
        );
      }

      if (user.telegram_chat_id) {
        console.log(`Enviando cobrança semanal para ${user.nome} (${user.telegram_chat_id})...`);
        await enviarMensagem(Number(user.telegram_chat_id), mensagem);
        return { user: user.nome, status: 'enviado' };
      }
      return { user: user.nome, status: 'sem_chat_id' };
    });

    const resultados = await Promise.allSettled(disparos);

    return NextResponse.json({
      success: true,
      message: 'Mensagens semanais da Azula processadas com sucesso.',
      resultados: resultados.map(r => r.status === 'fulfilled' ? r.value : { status: 'erro' })
    });
  } catch (err: any) {
    console.error('Erro no cron-notify:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

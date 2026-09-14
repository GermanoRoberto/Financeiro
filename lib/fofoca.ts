import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';
import { adicionarAoHistorico } from '@/lib/chatHistory';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

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

export function limparTextoAzula(content: string): string {
  if (!content) return '';
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Remove preâmbulo de raciocínio comum em modelos de reasoning (ex: "Here's a thinking process: ...")
  cleaned = cleaned.replace(/^Here's a thinking process:?[\s\S]*?(?=\n\n(?:😼|Miau|<b>|[A-ZÀ-Ú]))/i, '').trim();

  // Se o modelo só gerou o processo de pensamento ou rascunhos sem o texto final
  if (
    /^Here's a thinking process:/i.test(cleaned) ||
    cleaned.includes('**Analyze User Input:**') ||
    cleaned.includes('**Persona:**') ||
    cleaned.includes('Draft 1:')
  ) {
    const draftSplit = cleaned.split(/Draft \d+:?\s*/i);
    if (draftSplit.length > 1) {
      cleaned = draftSplit[draftSplit.length - 1].trim();
    } else {
      return '';
    }
  }

  if (/^Here's a thinking process:/i.test(cleaned) || cleaned.length < 20) {
    return '';
  }

  return cleaned;
}

export async function chamarGroqFofoca(prompt: string): Promise<string> {
  if (!GROQ_API_KEY) return '';

  const modelCandidates = [
    process.env.GROQ_TEXT_MODEL,
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ].filter(Boolean) as string[];

  for (const model of modelCandidates) {
    try {
      const payload: any = {
        model: model,
        messages: [
          {
            role: 'system',
            content: 'Você é a Azula, a gata de estimação debochada, sarcástica e divertida do Germano e da Priscila. Você fala em português brasileiro. NUNCA gere introduções, explicações, rascunhos ou pensamentos em inglês como "Here\'s a thinking process". NUNCA use formatação markdown como asteriscos (**) ou crases (`). Use exclusivamente tags HTML do Telegram: <b> para negrito e <code> para valores e datas. Comece sua resposta IMEDIATAMENTE com a fala da Azula.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1200
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
          timeout: 6000
        }
      );
      let content = response.data.choices?.[0]?.message?.content || '';
      content = limparTextoAzula(content);
      if (content) return content;
    } catch (e: any) {
      console.warn(`Groq model ${model} falhou ou timed out no fofoca: ${e.message}`);
    }
  }
  return '';
}

export interface InfoUsuarioFofoca {
  qtdEnviosRecentes: number;
  dataUltimoEnvio: string;
  ultimoCC: string;
  totalGastos7d: number;
  exemplosGastos: string;
}

export function formatarDataBR(isoStr?: string | null): string {
  if (!isoStr) return 'nunca';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

export function formatarMesRef(mesRef?: string | null): string {
  if (!mesRef) return 'Nenhum cadastrado';
  const partes = mesRef.substring(0, 7).split('-');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const mesIdx = parseInt(partes[1], 10) - 1;
  return `${meses[mesIdx] || partes[1]}/${partes[0]}`;
}

export function gerarMensagemFallback(
  isGermano: boolean,
  infoPriscila: InfoUsuarioFofoca,
  infoGermano: InfoUsuarioFofoca
): string {
  const formatar = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  if (isGermano) {
    let fofocaVeia = '';
    if (infoPriscila.qtdEnviosRecentes === 0) {
      fofocaVeia = `• <b>Comprovantes novos:</b> Ela <b>NÃO MANDOU NADA</b> nos últimos 7 dias! A última vez que ela teve a coragem de registrar algo foi em <code>${infoPriscila.dataUltimoEnvio}</code> (quase 1 mês sumida)!\n• <b>Contracheques:</b> Pior ainda! O último dela cadastrado foi o de <code>${infoPriscila.ultimoCC}</code>! Tá devendo os holerites recentes na cara dura!`;
    } else {
      fofocaVeia = `• <b>Comprovantes novos:</b> Ela mandou <code>${infoPriscila.qtdEnviosRecentes} comprovante(s)</code> recentemente (${infoPriscila.exemplosGastos})!\n• <b>Contracheques:</b> Mas o último holerite registrado continua sendo o de <code>${infoPriscila.ultimoCC}</code>.`;
    }

    return `😼 <b>Miau, Germano!</b> Auditora oficial Azula na área!\n\nVim aqui cumprir meu papel sagrado de fofoqueira e dedo-duro pra te contar da <b>Véia (Mãe / Priscila)</b>:\n\n${fofocaVeia}\n\nEnquanto isso, você registrou <code>${infoGermano.qtdEnviosRecentes} lançamento(s)</code> recentemente e tá com seus contracheques em dia (${infoGermano.ultimoCC}). Pelo menos um humano nessa casa me mantém informada!\n\nMas não se ache muito: você já torrou <code>R$ ${formatar(infoGermano.totalGastos7d)}</code> essa semana. Vai lá cobrar a Véia pra mandar os comprovantes dela agora mesmo! 🐾💥`;
  } else {
    return `😼 <b>Miau, Priscila!</b> Põe meu sachê e presta atenção!\n\nPassando aqui pra puxar a sua orelha porque você tá com uma preguiça descomunal:\n\n• <b>Comprovantes:</b> Você <b>NÃO me manda nenhuma informação nova desde ${infoPriscila.dataUltimoEnvio}</b>! Sumiço total!\n• <b>Contracheques:</b> Seu último holerite registrado parou em <code>${infoPriscila.ultimoCC}</code>! Cadê os holerites de Julho e Agosto? Esqueceu que as contas continuam chegando?!\n• <b>E o Germano?</b> O Germano registrou <code>${infoGermano.qtdEnviosRecentes} lançamento(s)</code> recentemente e tá com os contracheques até ${infoGermano.ultimoCC} em dia!\n\nToma vergonha nessa cara e manda seus comprovantes e contracheques logo antes que eu derrube as coisas da mesa! 🐾💥`;
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

  const germano = users.find(u => u.email === 'germanorcarmo@gmail.com');
  const priscila = users.find(u => u.email === 'priscilaaparecida0@gmail.com');

  if (!germano || !priscila) {
    return { success: false, message: 'Usuários Germano e Priscila não encontrados no banco.' };
  }

  // 2. Datas de referência
  const agora = new Date();
  const seteDiasAtrasISO = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const seteDiasAtrasData = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  // 3. Gastos da semana pelo calendário
  const { data: listGastos } = await supabase
    .from('gastos_diarios')
    .select('valor, estabelecimento, categoria, data, usuario_id')
    .gte('data', seteDiasAtrasData);

  const descrGastos = (gastos: any[]) => {
    if (!gastos || gastos.length === 0) return 'Nenhum';
    return gastos.slice(0, 5).map(g => `${g.estabelecimento} (R$ ${g.valor.toFixed(2)})`).join(', ');
  };

  const gGermano = (listGastos || []).filter(g => g.usuario_id === germano.id && g.categoria !== 'receita_extra');
  const gPriscila = (listGastos || []).filter(g => g.usuario_id === priscila.id && g.categoria !== 'receita_extra');
  const totalGermano = gGermano.reduce((acc, g) => acc + g.valor, 0);
  const totalPriscila = gPriscila.reduce((acc, g) => acc + g.valor, 0);

  // 4. Envios recentes (por criado_em) e último envio/contracheque
  const [
    { data: enviosRecentesPriscila },
    { data: ultimoEnvioPriscila },
    { data: ccPriscila },
    { data: enviosRecentesGermano },
    { data: ultimoEnvioGermano },
    { data: ccGermano }
  ] = await Promise.all([
    supabase.from('gastos_diarios').select('valor, estabelecimento, categoria, data, criado_em').eq('usuario_id', priscila.id).gte('criado_em', seteDiasAtrasISO),
    supabase.from('gastos_diarios').select('valor, estabelecimento, data, criado_em').eq('usuario_id', priscila.id).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('contracheques').select('mes_referencia, salario_liquido, criado_em').eq('usuario_id', priscila.id).order('mes_referencia', { ascending: false }),
    supabase.from('gastos_diarios').select('valor, estabelecimento, categoria, data, criado_em').eq('usuario_id', germano.id).gte('criado_em', seteDiasAtrasISO),
    supabase.from('gastos_diarios').select('valor, estabelecimento, data, criado_em').eq('usuario_id', germano.id).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('contracheques').select('mes_referencia, salario_liquido, criado_em').eq('usuario_id', germano.id).order('mes_referencia', { ascending: false }),
  ]);

  const infoPriscila: InfoUsuarioFofoca = {
    qtdEnviosRecentes: enviosRecentesPriscila?.length || 0,
    dataUltimoEnvio: ultimoEnvioPriscila ? formatarDataBR(ultimoEnvioPriscila.criado_em) : 'nunca',
    ultimoCC: ccPriscila?.[0] ? formatarMesRef(ccPriscila[0].mes_referencia) : 'Nenhum cadastrado',
    totalGastos7d: totalPriscila,
    exemplosGastos: descrGastos(gPriscila)
  };

  const infoGermano: InfoUsuarioFofoca = {
    qtdEnviosRecentes: enviosRecentesGermano?.length || 0,
    dataUltimoEnvio: ultimoEnvioGermano ? formatarDataBR(ultimoEnvioGermano.criado_em) : 'nunca',
    ultimoCC: ccGermano?.[0] ? formatarMesRef(ccGermano[0].mes_referencia) : 'Nenhum cadastrado',
    totalGastos7d: totalGermano,
    exemplosGastos: descrGastos(gGermano)
  };

  // 5. Processamento paralelo de envio
  const disparos = users.map(async (user) => {
    const isGermano = user.email === 'germanorcarmo@gmail.com';
    const prompt = `Você é a Azula, a gata de estimação debochada, sarcástica, possessiva e muito engraçada do casal Germano e Priscila.
Você está enviando uma mensagem surpresa para ${user.nome} no Telegram no modo FOFOCA / DEDO-DURO.

SITUAÇÃO ATUAL E REAL DAS INFORMAÇÕES NO SISTEMA:
1. Priscila (a "Véia" ou "Mãe"):
   - Novos comprovantes/gastos enviados nos últimos 7 dias: ${infoPriscila.qtdEnviosRecentes} ${infoPriscila.qtdEnviosRecentes === 0 ? `(NÃO mandou NADA! O último envio dela foi em ${infoPriscila.dataUltimoEnvio}, quase 1 mês atrás!)` : `(Enviou ${infoPriscila.qtdEnviosRecentes}: ${infoPriscila.exemplosGastos})`}
   - Último contracheque/holerite cadastrado: ${infoPriscila.ultimoCC} (Está devendo os meses seguintes!)
   - Gasto registrado na semana: R$ ${infoPriscila.totalGastos7d.toFixed(2)}

2. Germano:
   - Novos comprovantes/gastos enviados nos últimos 7 dias: ${infoGermano.qtdEnviosRecentes} (Último envio em: ${infoGermano.dataUltimoEnvio})
   - Último contracheque/holerite cadastrado: ${infoGermano.ultimoCC} (Está em dia!)
   - Gasto registrado na semana: R$ ${infoGermano.totalGastos7d.toFixed(2)} (Exemplos: ${infoGermano.exemplosGastos})

INSTRUÇÕES OBRIGATÓRIAS:
1. Mantenha a persona: Azula é uma gata irônica, mandona, ácida e cômica.
2. Seja a DEDO DURO (snitch) número 1 da casa:
   - Se falando com Germano: Foque em dedurar que a Priscila ("a Véia" ou "a Mãe") NÃO MANDOU NENHUMA INFORMAÇÃO NOVA! Dedure que ela não manda comprovante desde ${infoPriscila.dataUltimoEnvio} e que o contracheque dela parou em ${infoPriscila.ultimoCC}. Elogie sarcasticamente o Germano por ter enviado coisas recentemente, mas mande ele cobrar a Véia imediatamente. (IMPORTANTE: NUNCA chame a Priscila de "Velha"! Use sempre "Véia", "a Véia", "Mãe" ou "Mamãe").
   - Se falando com Priscila: Trate-a com o humor da Azula chamando-a de "Mãe", "Mamãe" ou "Véia" (NUNCA use "Velha"). Dê uma bronca épica e engraçada nela por estar há semanas sem mandar NADA (desde ${infoPriscila.dataUltimoEnvio}), estar devendo os contracheques recentes enquanto o Germano já enviou tudo. Mande ela mandar os comprovantes e holerites agora.
3. Formatação HTML estrita do Telegram: Use <b> para negrito e <code> para valores e datas. NUNCA use asteriscos (**) ou crases (\`).
4. Mensagem direta, curta (3 a 4 parágrafos curtos) e sem preâmbulo.`;

    let mensagem = await chamarGroqFofoca(prompt);

    if (!mensagem) {
      mensagem = gerarMensagemFallback(
        isGermano,
        infoPriscila,
        infoGermano
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
    const nomeOutro = solicitante?.email === 'germanorcarmo@gmail.com' ? 'a Véia / Mãe (Priscila)' : 'o Germano';
    await enviarMensagemTelegram(
      chatIdSolicitante,
      `😼 <b>Missão cumprida!</b> Além de te dedurar tudo aqui, acabei de mandar uma cobrança direta lá no Telegram d'${nomeOutro} puxando a orelha e exigindo os comprovantes e contracheques atrasados! muéhehehehe. 🐾`
    );
  }

  return {
    success: true,
    message: 'Fofocas semanais da Azula processadas com sucesso.',
    resultados: resultados.map(r => r.status === 'fulfilled' ? r.value : { status: 'erro' })
  };
}

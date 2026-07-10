import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
  console.warn('Telegram env vars not set');
}

interface TelegramMessage {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
    photo?: Array<{
      file_id: string;
      file_size: number;
    }>;
    document?: {
      file_id: string;
      file_size: number;
    };
  };
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

async function handleStart(chatId: number) {
  const mensagem = `😼 <b>Miau!</b> Sou a <b>Azula</b>, a gata passiva-agressiva que de fato controla as finanças desta casa. Se você veio aqui me incomodar, pelo menos faça direito.\n\nUse o comando <b>/vincular &lt;codigo&gt;</b> para conectar seu Telegram ao painel (se é que você lembra o código que gerou no dashboard).`;
  await enviarMensagem(chatId, mensagem);
}

async function handleVincular(chatId: number, codigo: string) {
  if (!codigo) {
    await enviarMensagem(
      chatId,
      '😾 Miau! Cadê o código? Não tenho bola de cristal para adivinhar. Digite <b>/vincular &lt;codigo&gt;</b>.'
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
      '😾 Esse código é inválido ou já expirou! Você digitou certo ou está com preguiça de copiar no teclado?'
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
      '😾 Tentei salvar suas informações, mas deu erro no banco de dados. Volte a tentar mais tarde.'
    );
    return;
  }

  await enviarMensagem(
    chatId,
    `😼 Pronto, <b>${usuario.nome}</b>. Seu Telegram foi vinculado. Agora você pode me mandar seus gastos e contracheques. Não que eu me importe com o quanto você gasta com sachê ruim...`
  );
}

async function handleResumo(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      '😾 Sua conta não está vinculada! Use <b>/vincular &lt;codigo&gt;</b> ou suma daqui.'
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
    await enviarMensagem(chatId, '📋 Não encontrei nenhum contracheque cadastrado. Vá no painel e envie algum.');
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

  const mensagem = `
📊 <b>Seu Resumo Financeiro (Não que eu me importe...)</b>

💰 Salário Bruto: R$ ${contracheques.salario_bruto?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
💳 Salário Líquido: R$ ${contracheques.salario_liquido?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
🚫 Total de Descontos: R$ ${totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
📈 Comprometimento: ${comprometimento}%

😼 <i>Se gastasse menos com bobagens inúteis e mais com sachê premium para mim, esses números seriam bem melhores.</i>
  `;

  await enviarMensagem(chatId, mensagem);
}

async function handleDividas(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      '😾 Sua conta não está vinculada! Use <b>/vincular &lt;codigo&gt;</b> ou suma daqui.'
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
    await enviarMensagem(chatId, '😼 Olha só, nenhuma dívida ativa! Mas aposto que vai arrumar uma nova em breve.');
    return;
  }

  let mensagem = '💳 <b>Suas Dívidas Ativas (Parabéns pelos gastos inúteis...)</b>\n\n';
  dividas.forEach((d) => {
    const totalRestante = (d.valor_parcela * d.parcelas_restantes).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    mensagem += `• <b>${d.credor}</b>\n`;
    mensagem += `  Parcela: R$ ${d.valor_parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    mensagem += `  Parcelas Restantes: ${d.parcelas_restantes}\n`;
    mensagem += `  Total Pendente: R$ ${totalRestante}\n\n`;
  });

  mensagem += '😼 <i>Se vocês não pagarem isso, quem vai comprar minhas latinhas de atum? Pensem nisso.</i>';

  await enviarMensagem(chatId, mensagem);
}

export async function POST(req: NextRequest) {
  try {
    // Validar webhook
    if (!validarWebhook(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: TelegramMessage = await req.json();
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
        '😾 Hum? Não entendi nada desse comando. Fale direito ou me dê licença. Comandos disponíveis: /vincular &lt;codigo&gt;, /resumo, /dividas'
      );
    } else if (message.photo || message.document) {
      await enviarMensagem(
        chatId,
        '😼 Recebi esse arquivo aí. Vou mandar pro painel, mas não espere que eu faça carinho por isso...'
      );
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
  return NextResponse.json({ message: 'Telegram webhook active' });
}

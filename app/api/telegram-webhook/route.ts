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

async function handleVincular(chatId: number, _codigo: string) {
  // TODO: Validar código e vincular chat_id
  await enviarMensagem(
    chatId,
    '✅ Conta vinculada com sucesso! Agora você pode enviar contracheques e gastos.'
  );
}

async function handleResumo(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      '❌ Sua conta não está vinculada. Use /vincular <código>'
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
    await enviarMensagem(chatId, '📋 Nenhum contracheque encontrado.');
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
📊 <b>Seu Resumo Financeiro</b>

💰 Salário Bruto: R$ ${contracheques.salario_bruto?.toFixed(2)}
💳 Salário Líquido: R$ ${contracheques.salario_liquido?.toFixed(2)}
🚫 Total de Descontos: R$ ${totalDescontos.toFixed(2)}
📈 Comprometimento: ${comprometimento}%
  `;

  await enviarMensagem(chatId, mensagem);
}

async function handleDividas(chatId: number) {
  const { data: usuario } = await obterUsuarioPorTelegramId(chatId);

  if (!usuario) {
    await enviarMensagem(
      chatId,
      '❌ Sua conta não está vinculada. Use /vincular <código>'
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
    await enviarMensagem(chatId, '✅ Você não possui dívidas ativas.');
    return;
  }

  let mensagem = '💳 <b>Suas Dívidas Ativas</b>\n\n';
  (dividas || []).forEach((d) => {
    const totalRestante = (d.valor_parcela * d.parcelas_restantes).toFixed(2);
    mensagem += `• <b>${d.credor}</b>\n`;
    mensagem += `  Parcela: R$ ${d.valor_parcela.toFixed(2)}\n`;
    mensagem += `  Parcelas Restantes: ${d.parcelas_restantes}\n`;
    mensagem += `  Total: R$ ${totalRestante}\n\n`;
  });

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
    if (text.startsWith('/vincular')) {
      const [_, codigo] = text.split(' ');
      await handleVincular(chatId, codigo || '');
    } else if (text === '/resumo') {
      await handleResumo(chatId);
    } else if (text === '/dividas') {
      await handleDividas(chatId);
    } else if (text.startsWith('/')) {
      await enviarMensagem(
        chatId,
        '❓ Comando desconhecido. Comandos disponíveis: /vincular, /resumo, /dividas'
      );
    } else if (message.photo || message.document) {
      // TODO: Processar fotos/documentos
      await enviarMensagem(
        chatId,
        '⏳ Processando... (funcionalidade em desenvolvimento)'
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

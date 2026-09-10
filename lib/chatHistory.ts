import fs from 'fs';
import os from 'os';
import path from 'path';

export interface MensagemHistorico {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const HISTORY_FILE = path.join(os.tmpdir(), 'azula-history.json');
const MAX_HISTORY = 8;
const MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 horas

const memoryCache = new Map<number, MensagemHistorico[]>();

function carregarHistoricoDoDisco(): Record<string, MensagemHistorico[]> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function salvarHistoricoNoDisco(data: Record<string, MensagemHistorico[]>) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data), 'utf8');
  } catch (e) {}
}

export function adicionarAoHistorico(chatId: number, role: 'user' | 'assistant', content: string) {
  if (!chatId || !content) return;
  const textoLimpo = content.replace(/<[^>]*>/g, '').trim();
  if (!textoLimpo) return;

  let historico = memoryCache.get(chatId);
  if (!historico) {
    const disco = carregarHistoricoDoDisco();
    historico = disco[String(chatId)] || [];
  }

  const agora = Date.now();
  historico = historico.filter(m => agora - m.timestamp < MAX_AGE_MS);

  historico.push({
    role,
    content: textoLimpo.length > 350 ? textoLimpo.substring(0, 350) + '...' : textoLimpo,
    timestamp: agora
  });

  if (historico.length > MAX_HISTORY) {
    historico = historico.slice(-MAX_HISTORY);
  }

  memoryCache.set(chatId, historico);

  const disco = carregarHistoricoDoDisco();
  disco[String(chatId)] = historico;
  salvarHistoricoNoDisco(disco);
}

export function obterHistoricoFormatado(chatId: number): string {
  let historico = memoryCache.get(chatId);
  if (!historico) {
    const disco = carregarHistoricoDoDisco();
    historico = disco[String(chatId)] || [];
    memoryCache.set(chatId, historico);
  }

  const agora = Date.now();
  const validas = historico.filter(m => agora - m.timestamp < MAX_AGE_MS);
  if (validas.length === 0) return '';

  const linhas = validas.map(m => {
    const autor = m.role === 'assistant' ? 'Azula' : 'Usuário';
    return `- ${autor}: "${m.content}"`;
  });

  return `\nHISTÓRICO RECENTE DA CONVERSA (últimas interações neste chat com você):\n${linhas.join('\n')}\n`;
}

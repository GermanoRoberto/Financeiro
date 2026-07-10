import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Gerar código único (simplificado - usar UUID em produção)
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    // TODO: Salvar código em cache com TTL ou tabela de vinculação temporária

    return NextResponse.json({
      codigo,
      instrucoes: `Envie /vincular ${codigo} para o bot do Telegram para vincular sua conta.`,
    });
  } catch (error: any) {
    console.error('Erro ao gerar código:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar código' },
      { status: 500 }
    );
  }
}

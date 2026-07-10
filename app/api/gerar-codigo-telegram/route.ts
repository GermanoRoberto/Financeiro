import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseServer } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Gerar código único de 6 caracteres
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Salvar código na tabela de usuários permitidos usando o cliente administrativo
    const adminClient = supabaseServer();
    const { error: erroUpdate } = await adminClient
      .from('usuarios_permitidos')
      .update({ telegram_codigo: codigo })
      .eq('email', user.email);

    if (erroUpdate) {
      console.error('Erro ao salvar código no banco:', erroUpdate.message);
      return NextResponse.json({ error: 'Erro ao gerar código no banco de dados' }, { status: 500 });
    }

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

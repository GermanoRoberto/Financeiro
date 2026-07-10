import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { email, codigo } = await req.json();

    if (!email || !codigo) {
      return NextResponse.json(
        { error: 'email e codigo são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Buscar usuário
    const { data: usuario, error: erroUsuario } = await supabase
      .from('usuarios_permitidos')
      .select('*')
      .eq('email', email)
      .single();

    if (erroUsuario || !usuario) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // TODO: Validar código
    // Por enquanto, vamos aceitar qualquer código
    const { error: erroUpdate } = await supabase
      .from('usuarios_permitidos')
      .update({ telegram_chat_id: codigo }) // aqui seria chat_id do telegram
      .eq('id', usuario.id)
      .select()
      .single();

    if (erroUpdate) throw erroUpdate;

    return NextResponse.json({
      sucesso: true,
      mensagem: 'Conta vinculada com sucesso!',
    });
  } catch (error: any) {
    console.error('Erro ao vincular telegram:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao vincular' },
      { status: 500 }
    );
  }
}

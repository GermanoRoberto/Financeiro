import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseServer } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ authorized: false, error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user || !user.email) {
      return NextResponse.json({ authorized: false, error: 'Sessão inválida' }, { status: 401 });
    }

    const adminClient = supabaseServer();
    
    // Buscar registro do e-mail na lista de permitidos
    const { data: usuarioPermitido, error: erroFetch } = await adminClient
      .from('usuarios_permitidos')
      .select('*')
      .eq('email', user.email)
      .single();

    if (erroFetch && erroFetch.code !== 'PGRST116') {
      console.error('Erro ao consultar banco de dados:', erroFetch.message);
      return NextResponse.json({ authorized: false, error: 'Erro interno de banco de dados' }, { status: 500 });
    }

    if (!usuarioPermitido) {
      return NextResponse.json({ authorized: false, error: 'E-mail não autorizado para acessar o sistema' }, { status: 403 });
    }

    // Se o user_id não estiver associado (primeiro login), fazer a associação
    if (!usuarioPermitido.user_id) {
      const { data: usuarioAtualizado, error: erroUpdate } = await adminClient
        .from('usuarios_permitidos')
        .update({ user_id: user.id })
        .eq('id', usuarioPermitido.id)
        .select()
        .single();

      if (erroUpdate) {
        console.error('Erro ao atualizar user_id do usuário:', erroUpdate.message);
        return NextResponse.json({ authorized: false, error: 'Erro ao associar perfil de usuário' }, { status: 500 });
      }

      return NextResponse.json({ authorized: true, user: usuarioAtualizado });
    }

    // Se já estiver associado, verificar se o id bate com o do Supabase Auth
    if (usuarioPermitido.user_id !== user.id) {
      return NextResponse.json({ authorized: false, error: 'Vínculo de usuário inválido' }, { status: 403 });
    }

    return NextResponse.json({ authorized: true, user: usuarioPermitido });
  } catch (error: any) {
    console.error('Erro na API de autorização:', error.message);
    return NextResponse.json(
      { authorized: false, error: error.message || 'Erro ao autorizar' },
      { status: 500 }
    );
  }
}

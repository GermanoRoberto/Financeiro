import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { usuarioId, mes } = await req.json();

    if (!usuarioId || !mes) {
      return NextResponse.json(
        { error: 'usuarioId e mes são obrigatórios' },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    // Buscar contracheques do usuário
    const { data: contracheques, error: erroContracheques } = await supabase
      .from('contracheques')
      .select(
        `*,
        descontos(*)
      `
      )
      .eq('usuario_id', usuarioId)
      .gte('mes_referencia', `${mes}-01`)
      .lte('mes_referencia', `${mes}-31`);

    if (erroContracheques) throw erroContracheques;

    // Buscar dívidas do usuário
    const { data: dividas, error: erroDividas } = await supabase
      .from('dividas')
      .select('*')
      .or(`usuario_id.eq.${usuarioId},usuario_id.is.null`)
      .eq('ativa', true);

    if (erroDividas) throw erroDividas;

    return NextResponse.json({
      contracheques: contracheques || [],
      dividas: dividas || [],
    });
  } catch (error: any) {
    console.error('Erro ao buscar projeção:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar projeção' },
      { status: 500 }
    );
  }
}

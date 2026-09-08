import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = supabaseServer();
    
    // Consulta múltiplos endpoints do banco para gerar tráfego de atividade real no Supabase
    const [resUsuarios, resContracheques, resGastos] = await Promise.all([
      supabase.from('usuarios_permitidos').select('id').limit(1),
      supabase.from('contracheques').select('id').limit(1),
      supabase.from('gastos_diarios').select('id').limit(1)
    ]);
    
    if (resUsuarios.error || resContracheques.error || resGastos.error) {
      const errorMsg = resUsuarios.error?.message || resContracheques.error?.message || resGastos.error?.message;
      console.error('Erro no ping do Supabase:', errorMsg);
      return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
    
    console.log('Supabase Heartbeat executado com sucesso em múltiplas tabelas.');
    return NextResponse.json({
      success: true,
      message: 'Database active on all tables',
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Erro no endpoint de heartbeat:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

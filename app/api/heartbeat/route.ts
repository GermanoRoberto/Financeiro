import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = supabaseServer();
    // Faz um select simples limitado a 1 registro na tabela de contracheques para manter o banco ativo
    const { data, error } = await supabase.from('contracheques').select('id').limit(1);
    
    if (error) {
      console.error('Erro no ping do Supabase:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    
    console.log('Supabase Heartbeat executado com sucesso.');
    return NextResponse.json({ success: true, message: 'Database active', timestamp: new Date().toISOString() });
  } catch (err: any) {
    console.error('Erro no endpoint de heartbeat:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

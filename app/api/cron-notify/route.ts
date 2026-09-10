import { NextRequest, NextResponse } from 'next/server';
import { dispararFofocaSemanal } from '@/lib/fofoca';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || '';
    const cronSecret = process.env.CRON_SECRET || '';
    const userAgent = req.headers.get('user-agent') || '';
    const cronSchedule = req.headers.get('x-vercel-cron-schedule') || '';
    const isVercelCron = userAgent.includes('vercel-cron') || !!cronSchedule;
    const isBearerValid = !!cronSecret && authHeader === `Bearer ${cronSecret}`;
    const url = new URL(req.url);
    const isManualTest = url.searchParams.get('teste') === 'true' || url.searchParams.get('force') === 'true';

    if (cronSecret && !isBearerValid && !isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resultado = await dispararFofocaSemanal();
    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error('Erro no cron-notify:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

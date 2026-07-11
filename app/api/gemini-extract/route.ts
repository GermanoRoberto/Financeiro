import { NextRequest, NextResponse } from 'next/server';
import { extrairContrachequeDoBase64, extrairGastoDoBase64 } from '@/lib/geminiClient';

export async function POST(req: NextRequest) {
  try {
    const { file, tipo } = await req.json();

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    const mimeType = file.type || 'application/pdf';
    const base64 = file.data;

    let dados;
    if (tipo === 'contracheque') {
      dados = await extrairContrachequeDoBase64(base64, mimeType);
    } else if (tipo === 'gasto') {
      dados = await extrairGastoDoBase64(base64, mimeType);
    } else {
      return NextResponse.json(
        { error: 'Tipo inválido. Use contracheque ou gasto' },
        { status: 400 }
      );
    }

    return NextResponse.json(dados);
  } catch (error: any) {
    console.error('Erro na extração via extrator:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    );
  }
}

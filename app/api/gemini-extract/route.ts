import { NextRequest, NextResponse } from 'next/server';
import { extrairComFallback } from '@/lib/geminiClient';

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

    let prompt = '';
    if (tipo === 'contracheque') {
      prompt = `Extraia os dados do contracheque e responda APENAS em JSON válido, sem markdown ou preâmbulo.
Formato esperado:
{
  "salario_bruto": number,
  "salario_liquido": number,
  "descontos": [
    {
      "tipo": string,
      "valor": number,
      "parcela_atual": number|null,
      "parcela_total": number|null,
      "recorrente": boolean
    }
  ]
}`;
    } else if (tipo === 'gasto') {
      prompt = `Extraia informações do comprovante/recibo e responda APENAS em JSON válido, sem markdown ou preâmbulo.
Formato esperado:
{
  "valor": number,
  "estabelecimento": string,
  "categoria": string ("alimentação", "transporte", "saúde", "diversão", "outros"),
  "data": "YYYY-MM-DD" (se visível)
}`;
    } else {
      return NextResponse.json(
        { error: 'Tipo inválido. Use contracheque ou gasto' },
        { status: 400 }
      );
    }

    const dados = await extrairComFallback(base64, mimeType, prompt);
    return NextResponse.json(dados);
  } catch (error: any) {
    console.error('Erro na extração via extrator:', error.message);
    return NextResponse.json(
      { error: error.message || 'Erro ao processar arquivo' },
      { status: 500 }
    );
  }
}

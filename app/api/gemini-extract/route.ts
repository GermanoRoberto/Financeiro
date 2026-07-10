import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

if (!GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY não configurada');
}

interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inlineData?: {
        mimeType: string;
        data: string;
      };
    }>;
  }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

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

    const requestBody: GeminiRequest = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
    };

    const response = await axios.post<GeminiResponse>(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody
    );

    const textContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Fazer parse do JSON
    try {
      const jsonStr = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const dados = JSON.parse(jsonStr);
      return NextResponse.json(dados);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', textContent);
      return NextResponse.json(
        { error: 'Falha ao extrair dados. Resposta inválida da IA.' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    const detalheErro = error.response?.data?.error?.message || error.message;
    console.error('Erro na extração via Gemini:', detalheErro);
    return NextResponse.json(
      { error: detalheErro || 'Erro ao processar arquivo' },
      { status: 500 }
    );
  }
}

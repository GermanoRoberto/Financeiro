import axios from 'axios';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
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

export async function extrairContracheque(file: File): Promise<any> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    const mimeType = file.type || 'application/pdf';
    
    const prompt = `Extraia os dados do contracheque e responda APENAS em JSON válido, sem markdown ou preâmbulo.
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
    
    // Tentar fazer parse do JSON
    try {
      // Remove markdown code blocks se existirem
      const jsonStr = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', textContent);
      throw new Error('Falha ao extrair dados do contracheque. Resposta inválida da IA.');
    }
  } catch (error: any) {
    console.error('Erro na extração via Gemini:', error.message);
    throw error;
  }
}

export async function extrairGasto(file: File): Promise<any> {
  try {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    const mimeType = file.type || 'image/png';
    
    const prompt = `Extraia informações do comprovante/recibo e responda APENAS em JSON válido, sem markdown ou preâmbulo.
Formato esperado:
{
  "valor": number,
  "estabelecimento": string,
  "categoria": string ("alimentação", "transporte", "saúde", "diversão", "outros"),
  "data": "YYYY-MM-DD" (se visível)
}`;

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
    
    try {
      const jsonStr = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      return JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', textContent);
      throw new Error('Falha ao extrair dados do gasto.');
    }
  } catch (error: any) {
    console.error('Erro na extração via Gemini:', error.message);
    throw error;
  }
}

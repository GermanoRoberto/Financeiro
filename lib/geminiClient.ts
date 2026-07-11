import axios from 'axios';

async function extrairComGroq(base64: string, mimeType: string, prompt: string): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada na Vercel.');
  }

  const isImage = mimeType.startsWith('image/');
  const model = isImage ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';

  const messages: any[] = [];
  if (isImage) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`
          }
        }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: `${prompt}\n\n[Nota: Conteúdo do arquivo em base64]:\n${base64.substring(0, 10000)}`
    });
  }

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: model,
      messages: messages,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    },
    {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const textContent = response.data.choices?.[0]?.message?.content || '';
  return JSON.parse(textContent);
}

export async function extrairComFallback(base64: string, mimeType: string, prompt: string): Promise<any> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

  try {
    const requestBody = {
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

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      requestBody
    );

    const textContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (geminiError: any) {
    const errorMsg = geminiError.response?.data?.error?.message || geminiError.message;
    console.warn(`Erro no Gemini (tentando fallback para Groq): ${errorMsg}`);

    const hasGroqKey = !!(process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);
    if (!hasGroqKey) {
      throw new Error(`Falha na extração com Gemini: ${errorMsg}. (Groq não configurada)`);
    }

    try {
      return await extrairComGroq(base64, mimeType, prompt);
    } catch (groqError: any) {
      console.error('Erro também no Groq:', groqError.message);
      throw new Error(`Falha em ambos extratores. Gemini: ${errorMsg}. Groq: ${groqError.message}`);
    }
  }
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

    return await extrairComFallback(base64, mimeType, prompt);
  } catch (error: any) {
    console.error('Erro na extração de contracheque:', error.message);
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

    return await extrairComFallback(base64, mimeType, prompt);
  } catch (error: any) {
    console.error('Erro na extração de gasto:', error.message);
    throw error;
  }
}

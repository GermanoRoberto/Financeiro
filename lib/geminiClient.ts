import axios from 'axios';

const PROMPT_CONTRACHEQUE = `Analise detalhadamente o contracheque/holerite brasileiro fornecido.
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json) ou textos adicionais.

Instruções de Extração:
1. "salario_bruto": Identifique o valor total de proventos (também chamado de "Total de Vencimentos", "Total de Proventos" ou a soma de todos os ganhos antes dos descontos). Deve ser um número decimal.
2. "salario_liquido": Identifique o valor líquido a receber (também chamado de "Líquido a Receber", "Total Líquido", "Valor Líquido" ou o valor final depositado em conta). Deve ser um número decimal.
3. "descontos": Uma lista com todos os descontos aplicados (itens sob a coluna "Descontos" ou que representem deduções, como INSS, IRRF, Plano de Saúde, Vale Transporte, Vale Refeição, Empréstimos, Coparticipação, Sindicato, etc.).
   Para cada desconto, extraia:
   - "tipo": O nome amigável do desconto (ex: "INSS", "IRRF", "Plano de Saúde", "Empréstimo Consignado", "Vale Transporte").
   - "valor": O valor absoluto do desconto como número decimal.
   - "parcela_atual": Se for um desconto parcelado (ex: empréstimos que mostram "02/12" ou "parc 3 de 10" na descrição), extraia o número da parcela atual. Caso contrário, retorne null.
   - "parcela_total": O número total de parcelas (ex: 12 ou 10 no exemplo anterior). Caso contrário, retorne null.
   - "recorrente": Um booleano indicando se é um desconto recorrente (mensal permanente como INSS, IRRF, Plano de Saúde, coparticipação padrão) ou não (como empréstimos parcelados, adiantamentos pontuais).

Formato do JSON de retorno esperado:
{
  "salario_bruto": 0.00,
  "salario_liquido": 0.00,
  "descontos": [
    {
      "tipo": "Nome do Desconto",
      "valor": 0.00,
      "parcela_atual": number|null,
      "parcela_total": number|null,
      "recorrente": boolean
    }
  ]
}`;

const PROMPT_GASTO = `Analise o comprovante de pagamento/recibo de compra/comprovante de Pix fornecido.
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown ou textos adicionais.

Instruções de Extração:
1. "valor": O valor total pago ou transferido. Deve ser um número decimal.
2. "estabelecimento": O nome da empresa, mercado, loja ou pessoa recebedora (credor/beneficiário). Tente identificar o nome fantasia ou razão social.
3. "categoria": Classifique o gasto em uma das seguintes opções exatas: "alimentação", "transporte", "saúde", "diversão", "outros".
   - "alimentação": Supermercados, restaurantes, padarias, iFood, lanchonetes.
   - "transporte": Postos de combustível, Uber, 99, passagens, pedágio, estacionamento.
   - "saúde": Farmácias, médicos, exames, dentistas.
   - "diversão": Cinema, shows, streaming, jogos, viagens de lazer.
   - "outros": Qualquer gasto que não se encaixe nas categorias acima.
4. "data": A data em que o gasto foi realizado, no formato "YYYY-MM-DD" (ex: "2026-07-11"). Se não encontrar a data, use a data atual.

Formato do JSON de retorno esperado:
{
  "valor": 0.00,
  "estabelecimento": "Nome do Estabelecimento",
  "categoria": "alimentação"|"transporte"|"saúde"|"diversão"|"outros",
  "data": "YYYY-MM-DD"
}`;

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

export async function extrairContrachequeDoBase64(base64: string, mimeType: string): Promise<any> {
  return extrairComFallback(base64, mimeType, PROMPT_CONTRACHEQUE);
}

export async function extrairGastoDoBase64(base64: string, mimeType: string): Promise<any> {
  return extrairComFallback(base64, mimeType, PROMPT_GASTO);
}

export async function extrairContracheque(file: File): Promise<any> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = file.type || 'application/pdf';
  return extrairContrachequeDoBase64(base64, mimeType);
}

export async function extrairGasto(file: File): Promise<any> {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const mimeType = file.type || 'image/png';
  return extrairGastoDoBase64(base64, mimeType);
}

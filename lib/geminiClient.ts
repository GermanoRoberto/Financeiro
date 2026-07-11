import axios from 'axios';
import { PDFParse } from 'pdf-parse';

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

async function extrairComGroq(base64: string, mimeType: string, prompt: string, isTextOnly: boolean): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada na Vercel.');
  }

  const isImage = mimeType.startsWith('image/');
  const model = isImage && !isTextOnly ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';

  const messages: any[] = [];
  if (isImage && !isTextOnly) {
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
      content: prompt
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
  const hasGroqKey = !!(process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);
  
  let promptFinal = prompt;
  let base64OrText = base64;
  let mimeTypeFinal = mimeType;
  let isTextOnly = false;

  // Se for um arquivo PDF, vamos extrair o texto localmente via pdf-parse.
  // Isso resolve o problema de enviar binários pesados para as IAs, economiza tokens
  // e permite que a Groq (que não aceita PDF diretamente) consiga ler as informações perfeitamente!
  if (mimeType === 'application/pdf') {
    try {
      console.log('Extraindo texto do PDF via pdf-parse...');
      const buffer = Buffer.from(base64, 'base64');
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const textResult = await parser.getText();
      
      if (textResult && textResult.text && textResult.text.trim().length > 0) {
        base64OrText = textResult.text;
        mimeTypeFinal = 'text/plain';
        isTextOnly = true;
        promptFinal = `${prompt}\n\n[Texto extraído do PDF]:\n${base64OrText}`;
        console.log(`Texto extraído do PDF com sucesso (${base64OrText.length} caracteres).`);
      }
    } catch (pdfError: any) {
      console.warn(`Erro ao extrair texto do PDF via pdf-parse: ${pdfError.message}. Enviando PDF binário original.`);
    }
  }

  // 1. Tentar primeiro com a Groq (IA principal para dados/OCR)
  if (hasGroqKey) {
    try {
      console.log('Iniciando extração via Groq (Principal)...');
      return await extrairComGroq(base64OrText, mimeTypeFinal, promptFinal, isTextOnly);
    } catch (groqError: any) {
      console.warn(`Erro na Groq (tentando fallback para Gemini): ${groqError.message}`);
    }
  }

  // 2. Tentar com Gemini como backup secundário
  try {
    console.log('Iniciando extração via Gemini (Backup)...');
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada na Vercel.');
    }

    const parts: any[] = [{ text: promptFinal }];
    if (!isTextOnly) {
      parts.push({
        inlineData: {
          mimeType: mimeTypeFinal,
          data: base64OrText,
        },
      });
    }

    const requestBody = {
      contents: [
        {
          parts: parts,
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
    console.error('Erro também no Gemini:', errorMsg);
    throw new Error(`Falha na extração de dados. (Erro: ${errorMsg})`);
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

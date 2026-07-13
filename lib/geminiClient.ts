import axios from 'axios';

const PROMPT_CONTRACHEQUE = `Analise detalhadamente o contracheque/holerite brasileiro fornecido.
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown (sem \`\`\`json) ou textos adicionais.

Instruções de Extração:
1. "salario_bruto": Identifique o valor total de proventos (também chamado de "Total de Vencimentos", "Total de Proventos" ou a soma de todos os ganhos antes dos descontos). Deve ser um número decimal. NÃO confunda com o Salário Base.
2. "salario_liquido": Identifique o valor líquido a receber (também chamado de "Líquido a Receber", "Total Líquido", "Valor Líquido" ou o valor final depositado em conta). Deve ser um número decimal.
3. "descontos": Uma lista com todos os descontos aplicados (itens sob a coluna "Descontos" ou que representem deduções, como INSS, IRRF, Plano de Saúde, Vale Transporte, Vale Refeição, Empréstimos, Coparticipação, Sindicato, etc.).
   ATENÇÃO: Extraia TODOS os descontos do documento. No contracheque da Prefeitura de Juiz de Fora, a rubrica "FPM (FOLHA)" ou "FPM" é a previdência municipal dos servidores, que é um DESCONTO obrigatório e deve ser extraído exatamente com o nome "FPM (FOLHA)"!
   Para cada desconto, extraia:
   - "tipo": Descrição/Nome do desconto exatamente como consta escrito no contracheque, ex: "FPM (FOLHA)", "IRRF", "EMPRÉSTIMO CEF", "INSS", "COPARTICIPAÇÃO PLASC".
   - "valor": O valor absoluto do desconto como número decimal. ATENÇÃO: Cada linha de evento segue o formato [Código] [Descrição] [Índice/Referência] [Proventos] [Descontos]. O campo Índice/Referência (ex: 14,0000) não é um desconto, ignore-o! Extraia apenas o valor da coluna real de Descontos, ex: 925.40.
   - "parcela_atual": Se for um desconto parcelado (ex: empréstimos que mostram "02/12" ou "parc 3 de 10" na descrição), extraia o número da parcela atual. Caso contrário, retorne null.
   - "parcela_total": O número total de parcelas (ex: 12 ou 10 no exemplo anterior). Caso contrário, retorne null.
   - "recorrente": Um booleano indicando se é um desconto recorrente (mensal permanente como INSS, FPM, Plano de Saúde, coparticipação padrão) ou não (como empréstimos parcelados, adiantamentos pontuais).

REGRAS CRÍTICAS DE VALIDAÇÃO MATEMÁTICA E LAYOUT:
1. ATENÇÃO AO LAYOUT DE COLUNAS DE CADA FUNCIONÁRIO:
   - No contracheque de GERMANO ROBERTO DO CARMO SOBRINHO (Rodoviário Camilo dos Santos), o texto extraído tem o valor financeiro ANTES da descrição! O formato é [Código] [Valor Financeiro] [Descrição] [Índice/Referência]. 
     Exemplos reais extraídos do texto:
     * "901 0308,58 INSS 8,817" -> O valor do desconto do INSS é R$ 308,58 (8,817 é o índice/alíquota, ignore-o!).
     * "126 15,60 UNIMED ODONTO DEPENDENTE 0,000" -> O valor do desconto é R$ 15,60.
     * "10014 143,49 COPARTICIPAÇÃO PLASC PARC EV 10,000" -> O valor do desconto é R$ 143,49 (10,000 é o índice/referência, ignore-o!).
     * "10096 1.018,15 DESCONTO CRÉDITO TRABALHADOR 0,000" -> O valor do desconto é R$ 1.018,15.
     * "651 1.400,00 DESC ADIANTAMENTO QUINZENAL 0,000" -> O valor do desconto é R$ 1.400,00.
     Certifique-se de usar o número anterior à descrição como o valor e ignorar o número final (que é a referência)!
   - No contracheque da Prefeitura de Juiz de Fora (PRISCILA APARECIDA DA SILVA TOLEDO), o formato é [Código] [Descrição] [Referência] [Valor Financeiro]. O valor vem no final!
     Exemplo real extraído do texto:
     * "56 FPM (FOLHA) 14,0000 925,40" -> O valor do desconto é R$ 925,40.
2. O salario_bruto (Total de Proventos) deve ser exatamente igual à soma dos proventos individuais do documento.
3. A soma dos descontos individuais na lista "descontos" deve ser exatamente igual ao total de descontos do documento (ex: 3814.14 ou 2987.89).
4. O salario_liquido deve ser exatamente igual a (salario_bruto - soma de todos os descontos).
Use essas regras matemáticas para validar os números extraídos. Se faltar algum valor na lista de descontos para fechar a conta do líquido, encontre qual linha de desconto foi omitida e adicione-a à lista.

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

const PROMPT_GASTO = `Analise o comprovante de pagamento, recibo de compra, comprovante de Pix ou fatura de consumo/cobrança (como contas de internet, telefone, água, luz ou boletos) fornecido.
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown ou textos adicionais.

Instruções de Extração:
1. "valor": O valor total pago, transferido, recebido ou o valor total da fatura/boleto a pagar (ex: 85.00). Deve ser um número decimal.
2. "estabelecimento": O nome da empresa emissora da fatura, mercado, loja ou pessoa recebedora (credor/beneficiário, ex: "Vivo", "Claro", "Coelba"). Em caso de PIX recebido, coloque o nome do pagador. Em caso de transferência entre o casal, coloque o nome de quem recebeu a transferência (ex: "Para Priscila" ou "Para Germano").
3. "categoria": Classifique a transação em uma das seguintes opções exatas: "alimentação", "transporte", "saúde", "diversão", "receita_extra", "transferencia", "outros".
   - "alimentação": Supermercados, restaurantes, padarias, iFood, lanchonetes.
   - "transporte": Postos de combustível, Uber, 99, passagens, pedágio, estacionamento.
   - "saúde": Farmácias, médicos, exames, dentistas.
   - "diversão": Cinema, shows, streaming, jogos, viagens de lazer.
   - "receita_extra": Entradas de dinheiro, PIX recebido de terceiros, bônus, salários adicionais, dinheiro extra ganho (que não seja transferência do próprio cônjuge).
   - "transferencia": Dinheiro transferido entre o casal (ex: PIX do marido para a esposa, ou da esposa para o marido).
   - "outros": Contas de consumo, telefone, internet, tarifas, impostos ou qualquer gasto/transação que não se encaixe nas categorias acima.
4. "data": A data em que o gasto/transação foi realizado ou a data de vencimento da fatura, no formato "YYYY-MM-DD" (ex: "2026-07-21"). Se não encontrar a data, use a data atual.

Formato do JSON de retorno esperado:
{
  "valor": 0.00,
  "estabelecimento": "Nome do Estabelecimento ou Recebedor",
  "categoria": "alimentação"|"transporte"|"saúde"|"diversão"|"receita_extra"|"transferencia"|"outros",
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

  const payload: any = {
    model: model,
    messages: messages,
    temperature: 0.1
  };

  // Os modelos de visão da Groq (llama-3.2-11b-vision-preview) NÃO suportam o parâmetro response_format: { type: "json_object" }.
  // Se for modelo de visão, enviamos sem essa opção e limpamos a resposta de markdown/backticks no javascript.
  if (model !== 'llama-3.2-11b-vision-preview') {
    payload.response_format = { type: 'json_object' };
  }

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    payload,
    {
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const textContent = response.data.choices?.[0]?.message?.content || '';
  const jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

async function extrairComGemini(base64OrText: string, mimeType: string, prompt: string, isTextOnly: boolean): Promise<any> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no .env/Vercel.');
  }

  let contents: any[] = [];
  if (isTextOnly) {
    contents = [
      {
        parts: [{ text: prompt }]
      }
    ];
  } else {
    contents = [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64OrText
            }
          }
        ]
      }
    ];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(
    url,
    {
      contents,
      generationConfig: {
        responseMimeType: "application/json"
      }
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  const textContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

export async function extrairComFallback(base64: string, mimeType: string, prompt: string): Promise<any> {
  let promptFinal = prompt;
  let base64OrText = base64;
  let mimeTypeFinal = mimeType;
  let isTextOnly = false;

  // Se for um arquivo PDF, vamos extrair o texto localmente via pdf-parse.
  if (mimeType === 'application/pdf') {
    try {
      console.log('Extraindo texto do PDF via pdf-parse...');
      const buffer = Buffer.from(base64, 'base64');
      const pdf = require('pdf-parse');
      const dataResult = await pdf(buffer);
      
      if (dataResult && dataResult.text && dataResult.text.trim().length > 0) {
        base64OrText = dataResult.text;
        mimeTypeFinal = 'text/plain';
        isTextOnly = true;
        promptFinal = `${prompt}\n\n[Texto extraído do PDF]:\n${base64OrText}`;
        console.log(`Texto extraído do PDF com sucesso (${base64OrText.length} caracteres).`);
      } else {
        throw new Error('O PDF parece estar vazio ou não possui texto copiável (pode ser um documento escaneado/imagem).');
      }
    } catch (pdfError: any) {
      console.error(`Erro ao extrair texto do PDF via pdf-parse: ${pdfError.message}`);
      throw new Error(`Não consegui ler as informações do PDF. Certifique-se de que o PDF tem texto selecionável e não é uma imagem escaneada. (Erro: ${pdfError.message})`);
    }
  }

  // Tenta extrair com Groq primeiro
  try {
    console.log('Iniciando extração via Groq...');
    return await extrairComGroq(base64OrText, mimeTypeFinal, promptFinal, isTextOnly);
  } catch (groqError: any) {
    const groqMsg = groqError.response?.data?.error?.message || groqError.message;
    console.warn(`Falha na extração com Groq: ${groqMsg}. Tentando fallback automático para Gemini...`);
    
    // Se falhar (ex: chave inválida ou erro na API da Groq), tenta com Gemini
    try {
      return await extrairComGemini(base64OrText, mimeTypeFinal, promptFinal, isTextOnly);
    } catch (geminiError: any) {
      const geminiMsg = geminiError.response?.data?.error?.message || geminiError.message;
      console.error(`Falha no fallback para Gemini: ${geminiMsg}`);
      throw new Error(`Ambos os serviços de extração de dados falharam. Groq: ${groqMsg} | Gemini: ${geminiMsg}`);
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

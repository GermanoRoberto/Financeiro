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
3. "categoria": Classifique a transação em uma das seguintes opções exatas: "alimentação", "transporte", "saúde", "diversão", "moradia", "educação", "compras", "serviços", "investimentos", "receita_extra", "transferencia", "outros".
   - "alimentação": Supermercados, restaurantes, padarias, iFood, lanchonetes.
   - "transporte": Postos de combustível, Uber, 99, passagens, pedágio, estacionamento.
   - "saúde": Farmácias, médicos, exames, dentistas.
   - "diversão": Cinema, shows, streaming de lazer, jogos, viagens de lazer, passeios.
   - "moradia": Contas de consumo residenciais (aluguel, condomínio, água, luz, gás, internet residencial, IPTU, manutenção da casa).
   - "educação": Cursos, faculdade, escola, livros didáticos, mensalidades escolares.
   - "compras": Roupas, calçados, eletrônicos, móveis, presentes, lojas de departamentos.
   - "serviços": Assinaturas recorrentes de aplicativos/serviços (Spotify, Netflix, academia, licenças), cabeleireiro, prestadores de serviços gerais.
   - "investimentos": Transferências para contas de investimento, poupança, aportes.
   - "receita_extra": Entradas de dinheiro, PIX recebido de terceiros, bônus, salários adicionais, dinheiro extra ganho (que não seja transferência do próprio cônjuge).
   - "transferencia": Dinheiro transferido entre o casal (ex: PIX do marido para a esposa, ou da esposa para o marido).
   - "outros": Qualquer gasto/transação que não se encaixe nas categorias acima.
4. "data": A data em que o gasto/transação foi realizado ou a data de vencimento da fatura, no formato "YYYY-MM-DD" (ex: "2026-07-21"). Se não encontrar a data, use a data atual.

Formato do JSON de retorno esperado:
{
  "valor": 0.00,
  "estabelecimento": "Nome do Estabelecimento ou Recebedor",
  "categoria": "alimentação"|"transporte"|"saúde"|"diversão"|"moradia"|"educação"|"compras"|"serviços"|"investimentos"|"receita_extra"|"transferencia"|"outros",
  "data": "YYYY-MM-DD"
}`;

async function extrairComGroq(base64: string, mimeType: string, prompt: string, isTextOnly: boolean): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || '';
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada na Vercel.');
  }

  const isImage = mimeType.startsWith('image/');
  
  // Lista de candidatos de modelos de imagem (Visão/OCR)
  const visionCandidates = [
    process.env.GROQ_VISION_MODEL,
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct'
  ].filter(Boolean) as string[];

  // Lista de candidatos de modelos de texto
  const textCandidates = [
    process.env.GROQ_TEXT_MODEL,
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ].filter(Boolean) as string[];

  const candidates = isImage && !isTextOnly ? visionCandidates : textCandidates;
  let lastError: any = null;

  for (const model of candidates) {
    let payload: any = null;
    try {
      console.log(`Tentando extrair dados com o modelo Groq: ${model}...`);
      
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

      payload = {
        model: model,
        messages: messages,
        temperature: 0.1
      };

      // Apenas forçamos response_format json_object nos modelos Llama de texto conhecidos para evitar quebras em outros modelos
      if (model.includes('llama-3.3') || model.includes('llama-3.1')) {
        payload.response_format = { type: 'json_object' };
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 12000
        }
      );

      const textContent = response.data.choices?.[0]?.message?.content || '';
      const jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (err: any) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || err.message;
      
      // AUTO-RETRY 429 (Rate Limit): se a Groq pedir para esperar, nós esperamos e tentamos de novo
      if (status === 429) {
        let retryAfterMs = 2000;
        const matchSeconds = errMsg.match(/try again in ([\d\.]+)s/i);
        if (matchSeconds) {
          retryAfterMs = Math.ceil(parseFloat(matchSeconds[1]) * 1000) + 500;
        } else {
          const matchMs = errMsg.match(/retry in ([\d\.]+)ms/i);
          if (matchMs) {
            retryAfterMs = Math.ceil(parseFloat(matchMs[1])) + 100;
          }
        }

        // Se o tempo para liberar a cota for aceitável (menor que 8 segundos), fazemos a pausa e retentativa
        if (retryAfterMs < 8000) {
          console.log(`[Groq Rate Limit] Limite atingido. Aguardando ${retryAfterMs}ms para tentar novamente no modelo ${model}...`);
          await new Promise(resolve => setTimeout(resolve, retryAfterMs));
          try {
            const responseRetry = await axios.post(
              'https://api.groq.com/openai/v1/chat/completions',
              payload,
              {
                headers: {
                  'Authorization': `Bearer ${GROQ_API_KEY}`,
                  'Content-Type': 'application/json'
                },
                timeout: 12000
              }
            );
            const textContentRetry = responseRetry.data.choices?.[0]?.message?.content || '';
            const jsonStrRetry = textContentRetry.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(jsonStrRetry);
          } catch (retryErr: any) {
            err = retryErr;
          }
        }
      }

      console.warn(`Falha na chamada com o modelo Groq ${model}: ${err.response?.data?.error?.message || err.message}. Tentando próximo candidato...`);
      lastError = err;
    }
  }

  throw lastError || new Error('Nenhum modelo da Groq conseguiu processar a requisição.');
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
  
  try {
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
        },
        timeout: 15000
      }
    );

    const textContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (err: any) {
    const status = err.response?.status;
    
    // AUTO-RETRY 429 (Gemini Rate Limit): se o Gemini estourar o limite de cota grátis por minutos, espera 3 segundos e tenta de novo
    if (status === 429) {
      console.log(`[Gemini Rate Limit] Limite atingido. Aguardando 3000ms para tentar novamente no Gemini...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      try {
        const responseRetry = await axios.post(
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
            },
            timeout: 15000
          }
        );
        const textContentRetry = responseRetry.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonStrRetry = textContentRetry.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(jsonStrRetry);
      } catch (retryErr: any) {
        err = retryErr;
      }
    }
    throw err;
  }
}

export async function extrairComFallback(base64: string, mimeType: string, prompt: string): Promise<any> {
  let promptFinal = prompt;
  let base64OrText = base64;
  let mimeTypeFinal = mimeType;
  let isTextOnly = false;
  let extractedPdfText = '';

  // Se for um arquivo PDF, vamos extrair o texto localmente via pdf-parse.
  if (mimeType === 'application/pdf') {
    try {
      console.log('Extraindo texto do PDF via pdf-parse...');
      const buffer = Buffer.from(base64, 'base64');
      const pdf = require('pdf-parse');
      const dataResult = await pdf(buffer);
      
      if (dataResult && dataResult.text && dataResult.text.trim().length > 0) {
        extractedPdfText = dataResult.text;
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

  // REGRA LOCAL (Sem Dependência de IA): Verifica se o PDF bate com padrões conhecidos
  if (isTextOnly && extractedPdfText) {
    try {
      // 1. Fatura Vivo
      if (extractedPdfText.includes('Sua Fatura Digital Vivo') || (extractedPdfText.includes('Resumo de fatura') && extractedPdfText.includes('Valor da fatura'))) {
        console.log('Detectada Fatura Vivo! Processando localmente sem IA...');
        const matchValor = extractedPdfText.match(/Valor da fatura:\s*R\$\s*([\d,.]+)/i);
        const matchVencimento = extractedPdfText.match(/Data de vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
        
        if (matchValor && matchVencimento) {
          const valor = parseFloat(matchValor[1].replace(/\./g, '').replace(',', '.'));
          const dataISO = `${matchVencimento[3]}-${matchVencimento[2]}-${matchVencimento[1]}`;
          return {
            tipo_documento: 'comprovante_gasto',
            valor: valor,
            estabelecimento: 'Vivo',
            categoria: 'outros',
            data: dataISO
          };
        }
      }

      // 2. Extrato Nubank de Germano
      if (extractedPdfText.includes('Saldo final do período') && extractedPdfText.includes('Germano Roberto do Carmo') && extractedPdfText.includes('VALORES EM R$')) {
        console.log('Detectado Extrato Nubank! Processando localmente sem IA...');
        const transacoes = parseNubankLocal(extractedPdfText);
        if (transacoes && transacoes.length > 0) {
          return {
            tipo_documento: 'extrato_bancario',
            transacoes: transacoes
          };
        }
      }
    } catch (localError: any) {
      console.warn('Falha ao rodar parser local de regex:', localError.message);
    }
  }

  // Tenta extrair com Groq primeiro se não bater nas regras locais
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

function parseNubankLocal(text: string): any[] {
  const dateRegex = /(\d{2})\s+([A-Z]{3})\s+(\d{4})/g;
  const dates: any[] = [];
  let match;

  while ((match = dateRegex.exec(text)) !== null) {
    dates.push({
      dateStr: match[0],
      day: match[1],
      monthStr: match[2],
      year: match[3],
      index: match.index
    });
  }

  const transactions: any[] = [];
  const meses: Record<string, string> = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
    'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12',
    'AGO': '08', 'SET': '09', 'OUT': '10', 'DEZ': '12'
  };

  for (let i = 0; i < dates.length; i++) {
    const currentDate = dates[i];
    const nextDate = dates[i + 1];
    const segment = text.substring(currentDate.index, nextDate ? nextDate.index : text.length);

    const mesNum = meses[currentDate.monthStr.toUpperCase()] || '07';
    const formattedDate = `${currentDate.year}-${mesNum}-${currentDate.day}`;

    const lines = segment.split('\n').map(l => l.trim()).filter(Boolean);
    
    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      
      if (line.includes('Total de entradas') || line.includes('Total de saídas') || line.includes('Saldo final') || line.includes('Extrato gerado')) {
        continue;
      }

      const isDebito = line.includes('Compra no débito') || line.includes('debito');
      const isPixEnviado = line.includes('Transferência enviada pelo Pix') || line.includes('enviada pelo Pix');
      const isPixRecebido = line.includes('Transferência recebida pelo Pix') || line.includes('recebida pelo Pix');
      const isTransferenciaRecebida = line.includes('Transferência Recebida') || line.includes('Recebida');
      
      if (isDebito || isPixEnviado || isPixRecebido || isTransferenciaRecebida) {
        let valor = 0;
        let estabelecimento = 'Não identificado';
        let categoria = 'outros';

        if (line.includes('NuPay99')) {
          const matchNuPay = line.match(/NuPay99\s*([\d\.]+,?\d{2})/i);
          if (matchNuPay) {
            const valStr = matchNuPay[1].replace(/\./g, '').replace(',', '.');
            valor = parseFloat(valStr);
            estabelecimento = 'NuPay 99';
          }
        } else {
          let cleanLine = line
            .replace(/Compra no débito via NuPay/gi, '')
            .replace(/Compra no débito/gi, '')
            .replace(/Transferência enviada pelo Pix/gi, '')
            .replace(/Transferência recebida pelo Pix/gi, '')
            .replace(/Transferência recebida pelo Pix via/gi, '')
            .replace(/Transferência Recebida/gi, '')
            .replace(/Transferência recebida/gi, '')
            .replace(/Transferência enviada/gi, '')
            .trim();

          const matchVal = cleanLine.match(/^(.*?)([\d\.]+,?\d{2})$/);
          if (matchVal) {
            estabelecimento = matchVal[1].trim();
            const valStr = matchVal[2].replace(/\./g, '').replace(',', '.');
            valor = parseFloat(valStr);
            
            estabelecimento = estabelecimento
              .replace(/^-/, '')
              .replace(/-\s*•••\..*$/, '')
              .replace(/via\s*Open Banking/gi, '')
              .trim();
              
            if (!estabelecimento) estabelecimento = 'Estabelecimento';
          }
        }

        if (isPixRecebido || isTransferenciaRecebida) {
          categoria = 'receita_extra';
        } else if (estabelecimento.toLowerCase().includes('uber') || estabelecimento.toLowerCase().includes('99')) {
          categoria = 'transporte';
        } else if (estabelecimento.toLowerCase().includes('spotify') || estabelecimento.toLowerCase().includes('netflix')) {
          categoria = 'diversão';
        }

        if (valor > 0) {
          transactions.push({
            data: formattedDate,
            valor: valor,
            estabelecimento: estabelecimento,
            categoria: categoria
          });
        }
      }
    }
  }

  return transactions;
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

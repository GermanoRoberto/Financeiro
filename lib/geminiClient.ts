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

function parseJSONSeguro(texto: string, model: string): any {
  let cleaned = texto.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const firstOpen = cleaned.indexOf('{');
  if (firstOpen === -1) {
    throw new Error(`Nenhum objeto JSON encontrado na resposta do modelo ${model}. Resposta: "${cleaned.substring(0, 150)}..."`);
  }
  let s = cleaned.substring(firstOpen);

  // 1. Tentar parse direto
  try {
    return JSON.parse(s);
  } catch (e) {}

  // 2. Tentar remover vírgulas sobressalentes
  try {
    const semVirgula = s.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(semVirgula);
  } catch (e) {}

  // 3. Tentar corrigir se o modelo ecoou os tipos do schema (ex: "valor": number, "categoria": string)
  try {
    const corrigidoTipos = s
      .replace(/:\s*number\b/gi, ': 0')
      .replace(/:\s*string\b/gi, ': ""')
      .replace(/:\s*boolean\b/gi, ': false')
      .replace(/:\s*null\b/gi, ': null')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(corrigidoTipos);
  } catch (e) {}

  // 4. Truncamento no meio de arrays/objetos (ex: extratos bancários longos cortados no limite de tokens)
  // Caminha de trás para frente procurando o último item completo fechado com '}'
  let lastClose = s.lastIndexOf('}');
  while (lastClose > 0) {
    let candidate = s.substring(0, lastClose + 1).replace(/,\s*$/, '');
    
    // Contar chaves e colchetes abertos para balancear e fechar a estrutura
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    for (let i = 0; i < candidate.length; i++) {
      const c = candidate[i];
      if (c === '"' && candidate[i - 1] !== '\\') inString = !inString;
      if (!inString) {
        if (c === '{') openBraces++;
        else if (c === '}') openBraces--;
        else if (c === '[') openBrackets++;
        else if (c === ']') openBrackets--;
      }
    }

    let closer = candidate;
    for (let b = 0; b < openBrackets; b++) closer += ']';
    for (let b = 0; b < openBraces; b++) closer += '}';

    try {
      return JSON.parse(closer);
    } catch (e) {
      try {
        const closerLimpo = closer
          .replace(/:\s*number\b/gi, ': 0')
          .replace(/:\s*string\b/gi, ': ""')
          .replace(/:\s*boolean\b/gi, ': false')
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(closerLimpo);
      } catch (e2) {}
    }

    lastClose = s.lastIndexOf('}', lastClose - 1);
  }

  throw new Error(`Falha ao decodificar JSON (Modelo: ${model}, Resposta: "${cleaned.substring(0, 150)}...")`);
}

async function extrairComGroq(base64: string, mimeType: string, prompt: string, isTextOnly: boolean): Promise<any> {
  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY não configurada na Vercel.');
  }

  const isImage = mimeType.startsWith('image/');
  
  // Lista de candidatos de modelos de imagem (Visão/OCR da Groq)
  const visionCandidates = [
    process.env.GROQ_VISION_MODEL,
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'qwen/qwen3.8-27b'
  ].filter(Boolean) as string[];

  // Lista de candidatos de modelos de texto (Modelos ativos após a depreciação de agosto/2026)
  const textCandidates = [
    process.env.GROQ_TEXT_MODEL,
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.8-27b'
  ].filter(Boolean) as string[];

  const candidates = isImage && !isTextOnly ? visionCandidates : textCandidates;
  const errorsList: string[] = [];

  for (const model of candidates) {
    let payload: any = null;
    try {
      console.log(`Tentando extrair dados com o modelo Groq: ${model}...`);
      
      const messages: any[] = [];
      if (isImage && !isTextOnly) {
        messages.push({
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: `ATENÇÃO: Sua resposta deve ser ESTRITAMENTE um objeto JSON válido, sem texto introdutório, sem markdown e sem blocos de pensamento. Inicie diretamente com "{" e termine com "}".\n\n${prompt}` 
            },
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
          role: 'system',
          content: 'Você é um extrator de dados financeiros de alta precisão. Responda ESTRITAMENTE com um objeto JSON válido iniciando com "{" e terminando com "}". Não inclua nenhuma saudação, comentário, explicação, bloco markdown ou texto fora do JSON.'
        });
        messages.push({
          role: 'user',
          content: prompt
        });
      }

      // Modelos como qwen3.8 no tier on-demand possuem limite estrito de 1000 OTPM
      const maxTokens = model.includes('qwen3.8') ? 950 : 3500;

      payload = {
        model: model,
        messages: messages,
        temperature: 0.1,
        max_tokens: maxTokens
      };

      if (model.includes('gpt-oss')) {
        payload.reasoning_format = 'hidden';
      }

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const textContent = response.data.choices?.[0]?.message?.content || '';
      return parseJSONSeguro(textContent, model);
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
                timeout: 15000
              }
            );
            const textContentRetry = responseRetry.data.choices?.[0]?.message?.content || '';
            return parseJSONSeguro(textContentRetry, model);
          } catch (retryErr: any) {
            err = retryErr;
          }
        }
      }

      const finalErrMsg = err.response?.data?.error?.message || err.message;
      console.warn(`Falha na chamada com o modelo Groq ${model}: ${finalErrMsg}. Tentando próximo candidato...`);
      errorsList.push(`${model}: ${finalErrMsg}`);
    }
  }

  throw new Error(`A extração de dados falhou em todos os candidatos do Groq:\n` + errorsList.join('\n'));
}

export async function extrairComFallback(base64: string, mimeType: string, prompt: string): Promise<any> {
  let promptFinal = prompt;
  let base64OrText = base64;
  let mimeTypeFinal = mimeType;
  let isTextOnly = false;
  let extractedPdfText = '';

  // Se for um arquivo PDF, vamos tentar extrair o texto localmente via pdf-parse.
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
        console.log('O PDF parece ser uma imagem (sem texto copiável). Acionando fallback do Gemini para PDF visual...');
        return await extrairComGeminiPDF(base64, prompt);
      }
    } catch (pdfError: any) {
      console.log(`Erro no pdf-parse (${pdfError.message}). Acionando fallback do Gemini para PDF visual...`);
      try {
        return await extrairComGeminiPDF(base64, prompt);
      } catch (geminiError: any) {
        throw new Error(`Não consegui ler as informações do PDF. Erro de OCR: ${geminiError.message}`);
      }
    }
  }

  // Se for um arquivo de texto plano (.txt, .ofx, .csv, .html, etc.)
  let isPlainTxt = mimeType.startsWith('text/') || 
                   mimeType === 'application/x-ofx' || 
                   mimeType === 'application/xml' || 
                   mimeType === 'application/json';

  // Se o tipo for genérico (octet-stream), inspecionamos os primeiros bytes para ver se é texto plano
  if (!isPlainTxt && mimeType === 'application/octet-stream') {
    try {
      const buffer = Buffer.from(base64, 'base64');
      const sample = buffer.slice(0, 500).toString('utf8');
      if (!sample.includes('\x00')) {
        isPlainTxt = true;
      }
    } catch (e) {}
  }

  if (isPlainTxt && !isTextOnly) {
    try {
      console.log('Decodificando arquivo de texto plano...');
      const buffer = Buffer.from(base64, 'base64');
      const textContent = buffer.toString('utf8');
      
      base64OrText = textContent;
      mimeTypeFinal = 'text/plain';
      isTextOnly = true;
      promptFinal = `${prompt}\n\n[Conteúdo do arquivo]:\n${base64OrText}`;
      console.log(`Arquivo de texto decodificado com sucesso (${base64OrText.length} caracteres).`);
    } catch (txtError: any) {
      console.error(`Erro ao decodificar arquivo de texto: ${txtError.message}`);
    }
  }

  // REGRA LOCAL (Sem Dependência de IA): Verifica se o texto bate com padrões conhecidos
  const textToParse = extractedPdfText || (isTextOnly ? base64OrText : '');
  if (isTextOnly && textToParse) {
    try {
      // 1. Arquivos OFX (Qualquer banco que exporte OFX)
      if (textToParse.includes('<OFX>') || textToParse.includes('<STMTTRN>')) {
        console.log('Detectado arquivo OFX! Processando localmente sem IA...');
        const transacoes = parseOfxLocal(textToParse);
        if (transacoes && transacoes.length > 0) {
          return {
            tipo_documento: 'extrato_bancario',
            transacoes: transacoes
          };
        }
      }

      // 2. Extrato da Caixa (Formato TXT Internet Banking ou Formato Mobile App)
      const isCaixaTxt = textToParse.includes('CAIXA') && (textToParse.includes('Extrato por período') || textToParse.includes('Lançamentos'));
      const isCaixaMobile = (textToParse.includes('Extrato por Período') || textToParse.includes('Extrato por período')) && 
                            (textToParse.includes('Deb Pix') || textToParse.includes('Credito Salario') || textToParse.includes('Saldo do dia') || textToParse.includes('CAIXA'));
      if (isCaixaTxt || isCaixaMobile) {
        console.log('Detectado Extrato Caixa! Processando localmente sem IA...');
        const transacoes = isCaixaMobile ? parseCaixaMobileLocal(textToParse) : parseCaixaTxtLocal(textToParse);
        if (transacoes && transacoes.length > 0) {
          return {
            tipo_documento: 'extrato_bancario',
            transacoes: transacoes
          };
        }
      }

      // 3. Fatura Vivo
      if (textToParse.includes('Sua Fatura Digital Vivo') || (textToParse.includes('Resumo de fatura') && textToParse.includes('Valor da fatura'))) {
        console.log('Detectada Fatura Vivo! Processando localmente sem IA...');
        const matchValor = textToParse.match(/Valor da fatura:\s*R\$\s*([\d,.]+)/i);
        const matchVencimento = textToParse.match(/Data de vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
        
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

      // 4. Extrato Nubank (Germano ou Priscila)
      if (textToParse.includes('Saldo final do período') && (textToParse.includes('Germano Roberto do Carmo') || textToParse.includes('Priscila Aparecida da Silva')) && textToParse.includes('VALORES EM R$')) {
        console.log('Detectado Extrato Nubank! Processando localmente sem IA...');
        const transacoes = parseNubankLocal(textToParse);
        if (transacoes && transacoes.length > 0) {
          return {
            tipo_documento: 'extrato_bancario',
            transacoes: transacoes
          };
        }
      }

      // 5. Contracheque Camilo dos Santos (Germano)
      if (textToParse.includes('RODOVIARIO CAMILO DOS SANTOS') || textToParse.includes('CAMILO DOS SANTOS')) {
        console.log('Detectado Contracheque Camilo dos Santos! Processando localmente sem IA...');
        const cc = parseContrachequeCamiloLocal(textToParse);
        if (cc) {
          return cc;
        }
      }

      // 6. Contracheque Prefeitura de Juiz de Fora (Priscila)
      if (textToParse.includes('PREFEITURA DE JUIZ DE FORA') || textToParse.includes('MUNICÍPIO DE JUIZ DE FORA')) {
        console.log('Detectado Contracheque PJF! Processando localmente sem IA...');
        const cc = parseContrachequePjfLocal(textToParse);
        if (cc) {
          return cc;
        }
      }
    } catch (localError: any) {
      console.warn('Falha ao rodar parser local de regex:', localError.message);
    }
  }

  console.log('Iniciando extração via Groq...');
  return await extrairComGroq(base64OrText, mimeTypeFinal, promptFinal, isTextOnly);
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

          // 1. Verificar se a linha termina com CNPJ raiz + valor concatenado (Ex: 38.372.26767,80)
          const cnpjValMatch = cleanLine.match(/^(.*?)(\d{2}\.\d{3}\.\d{3})(\d+,\d{2})$/);
          if (cnpjValMatch) {
            estabelecimento = cnpjValMatch[1].trim();
            const valStr = cnpjValMatch[3].replace(',', '.');
            valor = parseFloat(valStr);
          } else {
            // 2. Formato normal: descrição + valor monetário
            const matchVal = cleanLine.match(/^(.*?)([\d\.]+(,\d{2}))$/);
            if (matchVal) {
              estabelecimento = matchVal[1].trim();
              const valStr = matchVal[2].replace(/\./g, '').replace(',', '.');
              valor = parseFloat(valStr);
            } else {
              // 3. Se o valor quebrou para as próximas linhas
              for (let k = 1; k <= 3; k++) {
                const nextLine = lines[j + k];
                if (nextLine && nextLine.match(/^\s*([\d\.]+,?\d{2})\s*$/)) {
                  const nextValMatch = nextLine.match(/^\s*([\d\.]+,?\d{2})\s*$/);
                  if (nextValMatch) {
                    const valStr = nextValMatch[1].replace(/\./g, '').replace(',', '.');
                    valor = parseFloat(valStr);
                    let desc = cleanLine
                      .replace(/^-/, '')
                      .replace(/-\s*•••\..*$/, '')
                      .replace(/via\s*Open Banking/gi, '')
                      .trim();
                    desc = desc.replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}$/, '').trim();
                    estabelecimento = desc || 'Estabelecimento';
                    break;
                  }
                }
              }
            }
          }

          estabelecimento = estabelecimento
            .replace(/^-/, '')
            .replace(/-\s*•••\..*$/, '')
            .replace(/via\s*Open Banking/gi, '')
            .replace(/\s*-\s*\d{2}\.\d{3}\.\d{3}.*$/, '')
            .replace(/\s*-\s*$/, '')
            .trim();
            
          if (!estabelecimento) estabelecimento = 'Estabelecimento';
        }

        const estLower = estabelecimento.toLowerCase();
        if (isPixRecebido || isTransferenciaRecebida) {
          categoria = 'receita_extra';
        } else if (estLower.includes('shpp') || estLower.includes('shopee') || line.includes('38.372.267')) {
          estabelecimento = 'Shopee';
          categoria = 'outros';
        } else if (estLower.includes('hotmart') || line.includes('13.427.325')) {
          estabelecimento = 'Hotmart';
          categoria = 'outros';
        } else if (estLower.includes('ifood')) {
          estabelecimento = 'iFood';
          categoria = 'alimentação';
        } else if (estLower.includes('uber') || estLower.includes('99')) {
          categoria = 'transporte';
        } else if (estLower.includes('spotify') || estLower.includes('netflix')) {
          categoria = 'diversão';
        }

        // Sanity check: se valor for absurdo (> 50.000) de um extrato pessoal, ignorar erro de OCR/regex
        if (valor > 0 && valor < 50000) {
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

function parseOfxLocal(text: string): any[] {
  const transactions: any[] = [];
  const blocks = text.split(/<STMTTRN>/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split(/<\/STMTTRN>/i)[0];
    const amtMatch = block.match(/<TRNAMT>\s*(-?[\d\.]+)/i);
    const nameMatch = block.match(/<NAME>\s*(.*?)(?=\r?\n|<|$)/i);
    const memoMatch = block.match(/<MEMO>\s*(.*?)(?=\r?\n|<|$)/i);
    const dateMatch = block.match(/<DTPOSTED>\s*(\d{8})/i);

    if (amtMatch && (nameMatch || memoMatch) && dateMatch) {
      const valor = Math.abs(parseFloat(amtMatch[1]));
      let desc = (memoMatch ? memoMatch[1] : nameMatch![1]).trim();
      const dateStr = dateMatch[1];
      const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
      
      desc = desc
        .replace(/^-/, '')
        .replace(/-\s*•••\..*$/, '')
        .replace(/via\s*Open Banking/gi, '')
        .trim();

      let categoria = 'outros';
      const valorOriginal = parseFloat(amtMatch[1]);
      const isCredito = valorOriginal > 0;

      if (isCredito) {
        categoria = 'receita_extra';
      } else if (desc.toLowerCase().includes('uber') || desc.toLowerCase().includes('99')) {
        categoria = 'transporte';
      } else if (desc.toLowerCase().includes('spotify') || desc.toLowerCase().includes('netflix')) {
        categoria = 'diversão';
      }

      transactions.push({
        data: formattedDate,
        valor: valor,
        estabelecimento: desc || 'Estabelecimento',
        categoria: categoria
      });
    }
  }
  return transactions;
}

function parseCaixaTxtLocal(text: string): any[] {
  const transactions: any[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  for (const line of lines) {
    const match = line.match(/^(\d{2})\/(\d{2})\/(\d{4})\b/);
    if (match) {
      const day = match[1];
      const month = match[2];
      const year = match[3];
      const formattedDate = `${year}-${month}-${day}`;

      const valMatch = line.match(/([\d\.]+,\d{2})\s*([DC])\b/i);
      if (valMatch) {
        const valStr = valMatch[1].replace(/\./g, '').replace(',', '.');
        const valor = parseFloat(valStr);
        const tipo = valMatch[2].toUpperCase();

        let clean = line
          .replace(/^\d{2}\/\d{2}\/\d{4}\s*(-\s*\d{2}:\d{2}:\d{2})?/, '')
          .replace(/^\s*\d{6}\s*/, '')
          .replace(/[\d\.]+,\d{2}\s*[DC].*$/, '')
          .trim();

        if (clean.toUpperCase().includes('SALDO DIA')) {
          continue;
        }

        let categoria = 'outros';
        if (tipo === 'C') {
          categoria = 'receita_extra';
        } else if (clean.toLowerCase().includes('uber') || clean.toLowerCase().includes('99')) {
          categoria = 'transporte';
        } else if (clean.toLowerCase().includes('spotify') || clean.toLowerCase().includes('netflix')) {
          categoria = 'diversão';
        }

        transactions.push({
          data: formattedDate,
          valor: valor,
          estabelecimento: clean || 'Caixa',
          categoria: categoria
        });
      }
    }
  }
  return transactions;
}

function parseCaixaMobileLocal(text: string): any[] {
  const isCaixaMobile = (text.includes('Extrato por Período') || text.includes('Extrato por período')) && 
                        (text.includes('Deb Pix') || text.includes('Credito Salario') || text.includes('Saldo do dia'));
  if (!isCaixaMobile) return [];

  const yearMatch = text.match(/\bde\s+(\d{4})\b/i);
  const ano = yearMatch ? yearMatch[1] : '2026';

  const meses: Record<string, string> = {
    'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
    'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions: any[] = [];

  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === 'Voltar' || lines[i] === 'Compartilhar') {
      startIndex = i + 1;
    }
  }

  let descBuffer: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('Saldo do dia') || line.includes('Saldo Anterior')) {
      descBuffer = [];
      if (i + 1 < lines.length && lines[i + 1].match(/^-?R\$\s*[\d\.,]+/)) {
        i++;
      }
      continue;
    }

    const valMatch = line.match(/^(-)?R\$\s*([\d\.,]+)$/);
    if (valMatch) {
      const isNegativo = !!valMatch[1];
      const valStr = valMatch[2].replace(/\./g, '').replace(',', '.');
      const valor = parseFloat(valStr);

      let dataTransacao = '';
      if (i + 1 < lines.length && lines[i + 1].match(/^(\d{2})([A-Z]{3})$/i)) {
        i++;
        const dateMatch = lines[i].match(/^(\d{2})([A-Z]{3})$/i);
        if (dateMatch) {
          const dia = dateMatch[1];
          const mesStr = dateMatch[2].toUpperCase();
          const mesNum = meses[mesStr] || '09';
          dataTransacao = `${ano}-${mesNum}-${dia}`;
        }
      }

      let desc = descBuffer.join(' ').trim();
      descBuffer = [];

      if (desc && valor > 0 && valor < 50000) {
        let categoria = 'outros';
        if (!isNegativo || desc.toLowerCase().includes('credito salario') || desc.toLowerCase().includes('pix recebido') || desc.toLowerCase().includes('deposito')) {
          categoria = 'receita_extra';
        } else if (desc.toLowerCase().includes('drogaria') || desc.toLowerCase().includes('farmacia')) {
          categoria = 'saude';
        } else if (desc.toLowerCase().includes('padaria') || desc.toLowerCase().includes('doces') || desc.toLowerCase().includes('lanchonete') || desc.toLowerCase().includes('restaurante')) {
          categoria = 'alimentacao';
        } else if (desc.toLowerCase().includes('prestacao hab') || desc.toLowerCase().includes('habitacao')) {
          categoria = 'moradia';
        } else if (desc.toLowerCase().includes('juros') || desc.toLowerCase().includes('iof')) {
          categoria = 'taxas_bancarias';
        }

        transactions.push({
          data: dataTransacao || `${ano}-09-01`,
          valor: valor,
          estabelecimento: desc,
          categoria: categoria
        });
      }
    } else {
      descBuffer.push(line);
    }
  }

  return transactions;
}

function parseContrachequeCamiloLocal(text: string): any {
  const isCamilo = (text.includes('RODOVIARIO CAMILO DOS SANTOS') || text.includes('CAMILO DOS SANTOS')) &&
                   (text.includes('DEMONSTRATIVO DE PAGAMENTO') || text.includes('RECIBO DE PAGAMENTO') || text.includes('DEMONSTRATIVO DE PAGAMENTO - Folha Normal'));
  if (!isCamilo) return null;

  const parseMoeda = (s?: string) => s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : 0;

  const provMatch = text.match(/Proventos:?\s*R\$\s*([\d\.,]+)/i) || text.match(/R\$\s*([\d\.,]+)\s*Proventos/i);
  const descMatch = text.match(/Descontos:?\s*R\$\s*([\d\.,]+)/i) || text.match(/R\$\s*([\d\.,]+)\s*Descontos/i);
  const liqMatch = text.match(/Valor líquido:?\s*R\$\s*([\d\.,]+)/i) || text.match(/R\$\s*([\d\.,]+)\s*Valor líquido/i);
  const refMatch = text.match(/Referência:?\s*(\d{2})\/(\d{4})/i);

  const salarioBruto = parseMoeda(provMatch?.[1]);
  const totalDescontosDoc = parseMoeda(descMatch?.[1]);
  const salarioLiquido = parseMoeda(liqMatch?.[1]) || (salarioBruto > 0 && totalDescontosDoc > 0 ? salarioBruto - totalDescontosDoc : 0);
  const mesReferencia = refMatch ? `${refMatch[2]}-${refMatch[1]}` : new Date().toISOString().substring(0, 7);

  const proventosKeywords = [
    'SALARIO BASE', 'ARREDONTAMENTO', 'RESSARC. PROV', 'ATESTADO MEDICO',
    'HORA EXTRA', 'DSR', 'GRATIFICACAO', 'INSALUBRIDADE', 'PERICULOSIDADE', 'PROVENTO'
  ];

  const codigosConhecidos: Record<string, string> = {
    'SALARIO BASE': '1',
    'ARREDONTAMENTO': '500',
    'RESSARC. PROV. CRED. ADTO': '10104',
    'ATESTADO MEDICO': '10130',
    'UNIMED ODONTO DEPENDENTE': '126',
    'COPARTICIPAÇÃO PLASC': '144',
    'DESC ARRED MES ANTERIOR': '501',
    'DESC ADIANTAMENTO QUINZENAL': '651',
    'INSS': '9010',
    'COPARTICIPAÇÃO PLASC PARC EV': '10014',
    'CONTRIBUICAO  NEGOCIAL ADM': '10056',
    'CONTRIBUICAO NEGOCIAL ADM': '10056',
    'DESCONTO CRÉDITO TRABALHADOR': '10096',
    'IRRF': '9012'
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const descontos: any[] = [];
  const proventos: any[] = [];

  for (const line of lines) {
    const m = line.match(/^(\d+?[\d\.,]+?)([A-ZÀ-Ú].+?)(\d+,\d{3})$/);
    if (m) {
      const prefix = m[1];
      const desc = m[2].trim();

      let valorFinal: number | null = null;

      for (const [nome, cod] of Object.entries(codigosConhecidos)) {
        if (desc.includes(nome) && prefix.startsWith(cod)) {
          const valStr = prefix.substring(cod.length);
          if (valStr.includes(',')) {
            valorFinal = parseMoeda(valStr);
            break;
          }
        }
      }

      if (valorFinal === null) {
        for (let codLen = 1; codLen <= 5; codLen++) {
          if (prefix.length > codLen) {
            const candVal = prefix.substring(codLen);
            if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(candVal)) {
              valorFinal = parseMoeda(candVal);
              break;
            }
          }
        }
      }

      if (valorFinal !== null && valorFinal > 0) {
        const isProv = proventosKeywords.some(kw => desc.includes(kw));
        if (isProv) {
          proventos.push({ tipo: desc, valor: valorFinal });
        } else {
          descontos.push({
            tipo: desc,
            valor: valorFinal,
            parcela_atual: null,
            parcela_total: null,
            recorrente: !desc.includes('ADIANTAMENTO')
          });
        }
      }
    }
  }

  // Contratos de empréstimo anexos (se houver páginas de Crédito do Trabalhador)
  const contratos: any[] = [];
  const contractBlocks = text.split(/CRÉDITO DO TRABALHADOR/i);
  for (let i = 1; i < contractBlocks.length; i++) {
    const block = contractBlocks[i];
    const numMatch = block.match(/(\d{6,12})\s*NÚMERO DO CONTRATO:/i) || block.match(/NÚMERO DO CONTRATO:\s*(\d{6,12})/i);
    let credor = 'PARATI CFI S A';
    if (block.includes('PICPAY')) credor = 'PICPAY BANK';
    else if (block.includes('PARATI')) credor = 'PARATI CFI S A';
    else if (block.includes('SANTANDER')) credor = 'SANTANDER';
    else if (block.includes('BRADESCO')) credor = 'BRADESCO';
    else if (block.includes('ITAU') || block.includes('ITAÚ')) credor = 'ITAÚ';
    else if (block.includes('CAIXA')) credor = 'CAIXA';

    const intMatches = block.match(/^\s*(\d{1,2})\s*$/gm);
    const parcAtual = (intMatches && intMatches.length > 0) ? parseInt(intMatches[0].trim(), 10) : 1;
    const parcTotal = (intMatches && intMatches.length > 1) ? parseInt(intMatches[1].trim(), 10) : 12;

    if (numMatch) {
      contratos.push({
        numero_contrato: numMatch[1],
        credor: credor,
        parcela_atual: parcAtual,
        parcela_total: parcTotal
      });
    }
  }

  const isAdiantamento = (salarioBruto === salarioLiquido && salarioLiquido > 0 && descontos.length === 0) ||
                         text.includes('DEMONSTRATIVO DE ADIANTAMENTO');

  return {
    tipo_documento: 'contracheque',
    nome_funcionario: 'GERMANO ROBERTO DO CARMO SOBRINHO',
    is_adiantamento: isAdiantamento,
    salario_bruto: salarioBruto,
    salario_liquido: salarioLiquido,
    mes_referencia: mesReferencia,
    descontos: descontos,
    contratos_emprestimo: contratos
  };
}

function parseContrachequePjfLocal(text: string): any {
  const isPjf = text.includes('PREFEITURA DE JUIZ DE FORA') || text.includes('MUNICÍPIO DE JUIZ DE FORA');
  if (!isPjf) return null;

  const parseMoeda = (s?: string) => s ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : 0;

  // 1. Mês de referência: "Agosto de 2026" ou "08/2026"
  const mesesExtenso: Record<string, string> = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
    'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
    'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
  };

  let mesReferencia = '';
  const refExtensoMatch = text.match(/(?:Janeiro|Fevereiro|Março|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)\s+de\s+(\d{4})/i);
  if (refExtensoMatch) {
    const nomeMes = refExtensoMatch[0].split(/\s+de\s+/i)[0].toLowerCase();
    const ano = refExtensoMatch[1];
    const numMes = mesesExtenso[nomeMes] || '08';
    mesReferencia = `${ano}-${numMes}`;
  } else {
    const refMatch = text.match(/(?:Mês\/Ano|Referência|Competência):?\s*(\d{2})\/(\d{4})/i);
    mesReferencia = refMatch ? `${refMatch[2]}-${refMatch[1]}` : new Date().toISOString().substring(0, 7);
  }

  // 2. Totais do rodapé
  const provMatch = text.match(/(?:Total de Vencimentos|Total de Proventos|Proventos):?\s*R?\$?\s*([\d\.,]+)/i);
  const descMatch = text.match(/(?:Total de Descontos|Descontos):?\s*R?\$?\s*([\d\.,]+)/i) ||
                    text.match(/([\d\.,]+)\s*\n\s*TOTAL DE DESCONTOS/i);
  const liqMatch = text.match(/(?:Líquido a Receber|Total Líquido|Valor Líquido):?\s*R?\$?\s*([\d\.,]+)/i);

  let salarioBruto = parseMoeda(provMatch?.[1]);
  let totalDescontos = parseMoeda(descMatch?.[1]);
  let salarioLiquido = parseMoeda(liqMatch?.[1]);

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const proventos: any[] = [];
  const descontos: any[] = [];
  const contratos: any[] = [];

  // Regex tolerante a concatenação de colunas sem espaços (Betha Cloud / PJF)
  // Ex: 1SALARIO145,00006.078,26
  // Ex: 56FPM (FOLHA)14,0000880,30
  // Ex: 665EMPRÉSTIMO CEF2.200,28002.200,28
  const eventRegex = /^(\d+)\s*([A-ZÀ-Ú\s\.\-\/\(\)]+?)\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2,4})\s*((?:\d{1,3}(?:\.\d{3})*|\d+),\d{2})$/;

  for (const line of lines) {
    const m = line.match(eventRegex);
    if (m) {
      const desc = m[2].trim();
      const val = parseMoeda(m[4]);

      // Distinção precisa entre Desconto e Provento
      const isDescontoExplicit = desc.includes('FPM') || desc.includes('IRRF') || desc.includes('PREV') || 
                                 desc.includes('EMPRÉSTIMO') || desc.includes('EMPRESTIMO') || 
                                 desc.includes('CONSIGNADO') || desc.includes('FALTAS') || 
                                 desc.includes('CEF') || desc.includes('SINDICATO') || desc.includes('SEGURO');

      if (isDescontoExplicit) {
        if (val > 0) {
          const isEmprestimo = desc.includes('EMPRÉSTIMO') || desc.includes('EMPRESTIMO') || desc.includes('CONSIGNADO');
          descontos.push({
            tipo: desc,
            valor: val,
            parcela_atual: null,
            parcela_total: null,
            recorrente: true
          });

          if (isEmprestimo) {
            contratos.push({
              banco: desc.includes('CEF') ? 'Caixa Econômica' : 'Banco Consignado',
              descricao: desc,
              valor_parcela: val,
              parcela_atual: null,
              parcela_total: null
            });
          }
        }
      } else {
        if (val > 0) {
          proventos.push({
            tipo: desc,
            valor: val
          });
        }
      }
    }
  }

  const somaProventos = proventos.reduce((acc, p) => acc + p.valor, 0);
  const somaDescontos = descontos.reduce((acc, d) => acc + d.valor, 0);

  if (!salarioBruto && somaProventos > 0) salarioBruto = somaProventos;
  if (!totalDescontos && somaDescontos > 0) totalDescontos = somaDescontos;
  if (!salarioLiquido && salarioBruto > 0) salarioLiquido = Math.round((salarioBruto - totalDescontos) * 100) / 100;

  return {
    tipo_documento: 'contracheque',
    nome_funcionario: 'PRISCILA APARECIDA DA SILVA TOLEDO',
    is_adiantamento: false,
    salario_bruto: salarioBruto,
    total_descontos: totalDescontos,
    salario_liquido: salarioLiquido,
    mes_referencia: mesReferencia,
    proventos: proventos,
    descontos: descontos,
    contratos_emprestimo: contratos
  };
}

async function extrairComGeminiPDF(base64: string, prompt: string): Promise<any> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
  if (!GEMINI_API_KEY) {
    throw new Error('Chave do Gemini não configurada localmente ou na Vercel.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000
  });

  const textContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const inicio = textContent.indexOf('{');
  const fim = textContent.lastIndexOf('}');
  let jsonStr = textContent;
  if (inicio !== -1 && fim !== -1 && fim > inicio) {
    jsonStr = textContent.substring(inicio, fim + 1);
  } else {
    jsonStr = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  }
  try {
    return JSON.parse(jsonStr);
  } catch (parseErr: any) {
    throw new Error(`Falha ao decodificar JSON no Gemini (Resposta: "${jsonStr.substring(0, 120)}..."): ${parseErr.message}`);
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

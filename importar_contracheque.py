import os
import sys
import json
import requests
from dotenv import load_dotenv

# Caminho absoluto para o diretório do projeto para achar o arquivo .env
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, '.env'))

# Configurações do Supabase e Groq carregadas do .env do projeto
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
# Usamos a SERVICE_ROLE_KEY pois ela tem permissão total de escrita/bypass RLS para a automação
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
GROQ_API_KEY = os.getenv('GROQ_API_KEY')

def verificar_configuracoes():
    erros = []
    if not SUPABASE_URL:
        erros.append("NEXT_PUBLIC_SUPABASE_URL")
    if not SUPABASE_KEY:
        erros.append("SUPABASE_SERVICE_ROLE_KEY")
    if not GROQ_API_KEY:
        erros.append("GROQ_API_KEY (Adicione ao seu arquivo .env se estiver apenas na Vercel)")
    
    if erros:
        print("\n❌ ERRO: Faltam configurações no seu arquivo .env:")
        for erro in erros:
            print(f"  - {erro}")
        print("\nAbra o arquivo '.env' e certifique-se de preencher essas variáveis.")
        sys.exit(1)

def extrair_texto_pdf(caminho_pdf):
    try:
        from pypdf import PdfReader
    except ImportError:
        print("\n📦 Instalando biblioteca 'pypdf' para leitura de PDF...")
        os.system(f'"{sys.executable}" -m pip install pypdf')
        from pypdf import PdfReader

    if not os.path.exists(caminho_pdf):
        print(f"\n❌ Erro: O arquivo '{caminho_pdf}' não foi encontrado.")
        sys.exit(1)

    print(f"📖 Lendo PDF: {os.path.basename(caminho_pdf)}...")
    reader = PdfReader(caminho_pdf)
    texto = ""
    for page in reader.pages:
        texto += page.extract_text() or ""
    return texto

def extrair_dados_com_groq(texto_pdf):
    print("🤖 Enviando texto para extração inteligente via Groq (llama-3.3-70b)...")
    
    prompt = f"""Analise detalhadamente o contracheque/holerite brasileiro fornecido em formato texto.
Extraia as informações e responda APENAS com um objeto JSON válido, sem markdown (sem ```json) ou textos adicionais.

Instruções de Extração:
1. "salario_bruto": Identifique o valor total de proventos (soma de todos os ganhos antes dos descontos). Deve ser um número decimal.
2. "salario_liquido": Identifique o valor líquido a receber (valor final depositado em conta). Deve ser um número decimal.
3. "mes_referencia": O mês de referência no formato "YYYY-MM" (ex: se for 06/2026, retorne "2026-06").
4. "descontos": Uma lista com todos os descontos aplicados (INSS, IRRF, Planos, Adiantamento, Empréstimos, Coparticipações).
   Para cada desconto, extraia:
   - "tipo": O nome amigável do desconto (ex: "INSS", "IRRF", "Plano de Saúde", "Empréstimo", "Vale Transporte").
   - "valor": O valor absoluto do desconto como número decimal.
   - "parcela_atual": Se for parcelado (ex: "03/10" na descrição), extraia o número da parcela atual (ex: 3). Caso contrário, null.
   - "parcela_total": O número total de parcelas (ex: 10). Caso contrário, null.
   - "recorrente": Um booleano indicando se é recorrente (mensal permanente como INSS, IRRF, Plano de Saúde) ou temporário (empréstimos parcelados, adiantamentos pontuais).

Formato do JSON esperado:
{{
  "salario_bruto": 0.00,
  "salario_liquido": 0.00,
  "mes_referencia": "YYYY-MM",
  "descontos": [
    {{
      "tipo": "Nome do Desconto",
      "valor": 0.00,
      "parcela_atual": number|null,
      "parcela_total": number|null,
      "recorrente": boolean
    }}
  ]
}}

[Texto do Contracheque]:
{texto_pdf}"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }
    
    response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
    if response.status_code != 200:
        raise Exception(f"Erro na API do Groq: {response.text}")
        
    res_data = response.json()
    conteudo = res_data['choices'][0]['message']['content']
    return json.loads(conteudo)

def selecionar_usuario():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    url = f"{SUPABASE_URL}/rest/v1/usuarios_permitidos?select=id,nome,email"
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        raise Exception(f"Erro ao buscar usuários no Supabase: {response.text}")
        
    usuarios = response.json()
    if not usuarios:
        print("❌ Nenhum usuário cadastrado na tabela 'usuarios_permitidos'.")
        sys.exit(1)
        
    print("\n👥 Para quem é este contracheque?")
    for i, u in enumerate(usuarios):
        print(f"  [{i + 1}] {u['nome']} ({u['email']})")
        
    while True:
        try:
            escolha = int(input("\nEscolha o número correspondente: ")) - 1
            if 0 <= escolha < len(usuarios):
                return usuarios[escolha]['id'], usuarios[escolha]['nome']
            print("Opção inválida. Digite um número da lista.")
        except ValueError:
            print("Por favor, insira um número válido.")

def salvar_no_supabase(usuario_id, dados):
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    # 1. Salvar Contracheque
    payload_contracheque = {
        "usuario_id": usuario_id,
        "mes_referencia": f"{dados['mes_referencia']}-01",
        "salario_bruto": dados['salario_bruto'],
        "salario_liquido": dados['salario_liquido'],
        "dados_brutos": dados
    }
    
    print("\n💾 Salvando contracheque no Supabase...")
    url_cc = f"{SUPABASE_URL}/rest/v1/contracheques"
    res_cc = requests.post(url_cc, headers=headers, json=payload_contracheque)
    
    if res_cc.status_code != 201:
        # Se for duplicado (mesmo mês), vamos avisar
        if "duplicate key value" in res_cc.text:
            print("⚠️ Nota: Já existe um contracheque cadastrado para este mês (ele foi somado ou atualizado conforme as regras de múltiplos contracheques).")
        raise Exception(f"Erro ao salvar contracheque: {res_cc.text}")
        
    contracheque_salvo = res_cc.json()[0]
    contracheque_id = contracheque_salvo['id']
    
    # 2. Salvar Descontos
    descontos = dados.get('descontos', [])
    if descontos:
        print(f"📊 Cadastrando {len(descontos)} descontos associados...")
        payload_descontos = []
        for d in descontos:
            payload_descontos.append({
                "contracheque_id": contracheque_id,
                "tipo": d['tipo'],
                "valor": d['valor'],
                "parcela_atual": d.get('parcela_atual'),
                "parcela_total": d.get('parcela_total'),
                "recorrente": d.get('recorrente', True),
                "confirmado": True
            })
            
        url_desc = f"{SUPABASE_URL}/rest/v1/descontos"
        res_desc = requests.post(url_desc, headers=headers, json=payload_descontos)
        if res_desc.status_code != 201:
            raise Exception(f"Erro ao salvar descontos: {res_desc.text}")
            
    print("✅ Tudo salvo com sucesso no banco de dados!")

def main():
    verificar_configuracoes()
    
    # Se não passou argumento de arquivo, pede o caminho
    if len(sys.argv) < 2:
        caminho_pdf = input("Digite o caminho completo ou arrastar o arquivo PDF aqui: ").strip('"').strip("'")
    else:
        caminho_pdf = sys.argv[1]
        
    try:
        texto = extrair_texto_pdf(caminho_pdf)
        dados = extrair_dados_com_groq(texto)
        
        print("\n🔍 Dados Extraídos:")
        print(f"  📅 Mês de Referência: {dados['mes_referencia']}")
        print(f"  💰 Salário Bruto: R$ {dados['salario_bruto']:.2f}")
        print(f"  💵 Salário Líquido: R$ {dados['salario_liquido']:.2f}")
        print(f"  🚫 Total de Descontos: {len(dados.get('descontos', []))} itens identificados")
        
        usuario_id, nome_usuario = selecionar_usuario()
        salvar_no_supabase(usuario_id, dados)
        
        print(f"\n🎉 Sucesso! Contracheque de {nome_usuario} para o mês {dados['mes_referencia']} importado com sucesso!")
        
    except Exception as e:
        print(f"\n❌ Erro durante o processo: {e}")

if __name__ == '__main__':
    main()

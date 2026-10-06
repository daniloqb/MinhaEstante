/**
 * Serviço de Inteligência Artificial para Geração de Resumos Literários
 * Suporta execução tanto no navegador (via proxy backend /api/resumo)
 * quanto dentro do aplicativo nativo Android (.APK), conectando-se diretamente
 * à API oficial do Google Gemini sem bloqueios de CORS ou domínios locais.
 */

export interface GenerateBookSummaryParams {
  titulo: string;
  autores?: string[];
  sinopse?: string | null;
  anoPublicacao?: number | null;
  formato?: string;
  userApiKey?: string;
}

export function isRunningInAndroidApk(): boolean {
  if (typeof window === 'undefined') return false;
  const isAppAssets = window.location.origin.includes('appassets') || window.location.protocol === 'file:';
  const hasAndroidBridge = Boolean((window as any).AndroidApp);
  return isAppAssets || hasAndroidBridge;
}

export async function generateBookSummary(params: GenerateBookSummaryParams): Promise<string> {
  const isApk = isRunningInAndroidApk();

  // 1. No navegador web comum, tenta primeiro o endpoint do servidor local
  if (!isApk && typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    try {
      const response = await fetch('/api/resumo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          titulo: params.titulo,
          autores: params.autores,
          sinopse: params.sinopse,
          anoPublicacao: params.anoPublicacao,
          formato: params.formato,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.resumo) {
          return data.resumo;
        }
      }
    } catch (err) {
      console.warn('Requisição ao /api/resumo falhou, tentando conexão direta com Gemini...', err);
    }
  }

  // 2. Conexão direta com a API do Google Gemini (necessária no APK do smartphone)
  const apiKey =
    params.userApiKey ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('minha_estante_google_api_key') : null) ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    '';

  if (!apiKey) {
    throw new Error(
      'Não foi possível conectar ao serviço de IA. Verifique sua conexão com a internet ou configure sua chave gratuita do Gemini nas Configurações do app.'
    );
  }

  const prompt = `Você é um bibliotecário sábio, leitor voraz e especialista literário acolhedor.
O usuário leu ou deseja relembrar os principais pontos do seguinte livro da sua estante pessoal:

• Título: "${params.titulo}"
• Autor(es): ${params.autores && params.autores.length > 0 ? params.autores.join(', ') : 'Não especificado'}
${params.sinopse ? `• Sinopse / Contexto fornecido: "${params.sinopse}"` : ''}
${params.anoPublicacao ? `• Ano de Publicação: ${params.anoPublicacao}` : ''}
• Formato na Estante: ${params.formato === 'ebook' ? 'E-book / Digital' : 'Livro Físico'}

Por favor, elabore um resumo envolvente e estruturado em português do Brasil com a seguinte organização:

1. 📖 **Visão Geral & Premissa**:
Do que se trata o livro, seu contexto inicial e o gancho principal que move a história.

2. 🎭 **Personagens Centrais & Atmosfera**:
Quem são os protagonistas marcantes e qual o tom / ambientação da narrativa.

3. 🧭 **Enredo & Momentos Cruciais**:
Como a trama se desenvolve, os pontos de virada essenciais para quem leu há algum tempo e deseja recordar os acontecimentos marcantes (destaque o clímax e os dilemas centrais).

4. 💡 **Por Que Vale a Pena Recordar**:
Qual a mensagem central, reflexão atemporal ou impacto que a obra deixa no leitor.

Use formatação Markdown limpa com tópicos legíveis e parágrafos fluidos. Seja fiel à obra.`;

  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.7,
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        const rawMsg = errorBody?.error?.message || '';
        const status = errorBody?.error?.status || '';

        if (
          res.status === 429 ||
          status === 'RESOURCE_EXHAUSTED' ||
          rawMsg.toLowerCase().includes('quota') ||
          rawMsg.toLowerCase().includes('exceeded')
        ) {
          throw new Error(
            'Limite temporário de requisições gratuitas atingido. A cota da IA do Google renova-se automaticamente a cada minuto. Por favor, aguarde 1 a 2 minutos e tente novamente, ou insira sua chave gratuita pessoal do Gemini em Configurações para acesso prioritário.'
          );
        }

        throw new Error(rawMsg || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Tentativa direta com ${model} falhou:`, err?.message || err);
    }
  }

  throw (
    lastError ||
    new Error('Não foi possível gerar o resumo. Verifique sua conexão com a internet e tente novamente.')
  );
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '15mb' }));

// Helper to get Gemini client
const getAiClient = (customKey?: string) => {
  const apiKey = (customKey || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('Chave da API do Google Gemini não configurada.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// API: Resumo literário do livro via Gemini
app.post('/api/resumo', async (req, res) => {
  try {
    const { titulo, autores, sinopse, anoPublicacao, formato, userApiKey } = req.body;
    const headerKey = (req.headers['x-goog-api-key'] as string) || '';
    if (!titulo) {
      return res.status(400).json({ error: 'Título do livro é obrigatório.' });
    }

    const ai = getAiClient(userApiKey || headerKey);
    const prompt = `Você é um bibliotecário sábio, leitor voraz e especialista literário acolhedor.
O usuário leu ou deseja relembrar os principais pontos do seguinte livro da sua estante pessoal:

• Título: "${titulo}"
• Autor(es): ${Array.isArray(autores) ? autores.join(', ') : (autores || 'Não especificado')}
${sinopse ? `• Sinopse / Contexto fornecido: "${sinopse}"` : ''}
${anoPublicacao ? `• Ano de Publicação: ${anoPublicacao}` : ''}
• Formato na Estante: ${formato === 'ebook' ? 'E-book / Digital' : 'Livro Físico'}

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

    let generatedText = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.7,
          },
        });
        if (response.text) {
          generatedText = response.text;
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Tentativa com ${model} falhou, tentando próximo...`, err?.message || err);
      }
    }

    if (!generatedText) {
      throw lastError || new Error('Não foi possível obter resposta da IA no momento.');
    }

    res.json({ resumo: generatedText });
  } catch (error: any) {
    console.error('Erro ao gerar resumo do livro:', error);
    res.status(500).json({
      error: error.message || 'Erro ao consultar a IA para o resumo literário.',
    });
  }
});

// API: Proxy para baixar e converter imagens de capas externas em Data URL (evitando bloqueios de CORS no cliente)
app.post('/api/fetch-image', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'URL de imagem válida é obrigatória.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const imageResp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);

    if (!imageResp.ok) {
      return res
        .status(imageResp.status)
        .json({ error: `Servidor remoto de imagem respondeu com erro ${imageResp.status}` });
    }

    const contentType = imageResp.headers.get('content-type') || 'image/jpeg';
    const buffer = await imageResp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    res.json({ dataUrl });
  } catch (error: any) {
    console.error('Erro ao baixar imagem:', error);
    res.status(500).json({ error: error.message || 'Falha ao baixar imagem.' });
  }
});

// Servir arquivos APK e AAB diretamente
app.get(['/booknook.aab', '/minha-estante.aab'], (req, res) => {
  const isMinhaEstante = req.path.includes('minha-estante');
  const targetName = isMinhaEstante ? 'minha-estante.aab' : 'booknook.aab';
  let filePath = path.resolve(process.cwd(), targetName);
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'booknook.aab');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'public', targetName);
  }
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${targetName}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('Arquivo .AAB ainda não gerado ou não encontrado.');
  }
});

app.get(['/minha-estante.apk', '/app-debug.apk', '/booknook.apk'], (req, res) => {
  const isDebug = req.path.includes('app-debug');
  const fileName = isDebug ? 'app-debug.apk' : 'minha-estante.apk';
  const filePath = path.resolve(process.cwd(), fileName);

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('Arquivo .APK ainda não gerado ou não encontrado.');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Minha Estante] Servidor rodando em http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});

import express from 'express';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';

// Carrega variáveis do arquivo .env nativamente no Node.js
try {
  process.loadEnvFile?.();
} catch {
  // Ignora se .env não existir
}

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Health check endpoint para Cloud Run e monitoramento
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Configuração segura de CORS: permitir origens da aplicação, esquemas locais do Android e requisições do app
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    !origin ||
    origin === 'null' ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.includes('appassets.androidplatform.net') ||
    origin.includes('run.app')
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-goog-api-key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Limite de corpo seguro (JSON 2MB é mais do que suficiente para metadados)
app.use(express.json({ limit: '2mb' }));

// Mecanismo de Rate Limiting em memória para proteção contra abusos
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

// Limpeza periódica do mapa de rate limit a cada 10 minutos
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// Validador SSRF para URLs externas
function isSafeExternalUrl(targetUrl: string): boolean {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const b0 = parseInt(ipMatch[1], 10);
      const b1 = parseInt(ipMatch[2], 10);
      if (b0 === 10 || b0 === 127 || (b0 === 169 && b1 === 254) || (b0 === 192 && b1 === 168)) {
        return false;
      }
      if (b0 === 172 && b1 >= 16 && b1 <= 31) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

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
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 30, 60 * 1000)) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento antes de gerar outro resumo.' });
  }

  try {
    const { titulo, autores, sinopse, anoPublicacao, formato, userApiKey } = req.body;
    const headerKey = (req.headers['x-goog-api-key'] as string) || '';
    if (!titulo || typeof titulo !== 'string' || titulo.length > 500) {
      return res.status(400).json({ error: 'Título do livro é obrigatório e deve ser válido.' });
    }

    const ai = getAiClient(userApiKey || headerKey);
    const prompt = `Você é um bibliotecário sábio, leitor voraz e especialista literário acolhedor.
O usuário leu ou deseja relembrar os principais pontos do seguinte livro da sua estante pessoal:

• Título: "${titulo.slice(0, 300)}"
• Autor(es): ${Array.isArray(autores) ? autores.join(', ').slice(0, 300) : (autores ? String(autores).slice(0, 300) : 'Não especificado')}
${sinopse ? `• Sinopse / Contexto fornecido: "${String(sinopse).slice(0, 2000)}"` : ''}
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
    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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

// API: Recuperar ISBN-13 do livro via Gemini
app.post('/api/isbn', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Muitas requisições. Aguarde um momento.' });
  }

  try {
    const { termo, userApiKey } = req.body;
    const headerKey = (req.headers['x-goog-api-key'] as string) || '';
    if (!termo || typeof termo !== 'string' || termo.length > 300) {
      return res.status(400).json({ error: 'Termo de pesquisa é obrigatório.' });
    }

    const ai = getAiClient(userApiKey || headerKey);
    const prompt = `retornar somente o número do isbn 13 do livro ${termo.trim()}`;

    let isbn13 = '';
    const modelsToTry = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.1,
          },
        });
        if (response.text) {
          const match = response.text.replace(/[-\s]/g, '').match(/97[89][0-9]{10}/);
          if (match) {
            isbn13 = match[0];
            break;
          }
        }
      } catch (err: any) {
        console.warn(`Tentativa de ISBN com ${model} falhou:`, err?.message || err);
      }
    }

    res.json({ isbn: isbn13 || null });
  } catch (error: any) {
    console.error('Erro ao pesquisar ISBN via IA:', error);
    res.status(500).json({ error: error.message || 'Erro ao consultar a IA para o ISBN.' });
  }
});

// API: Descoberta e pesquisa de livros mundial (Google Books, Open Library, etc.)
app.get('/api/books/search', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Muitas pesquisas. Aguarde alguns instantes.' });
  }

  const query = String(req.query.q || '').trim();
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  if (!query) {
    return res.status(400).json({ error: 'Parâmetro q (consulta) é obrigatório.' });
  }

  const startIndex = cursor ? parseInt(cursor, 10) || 0 : 0;
  const maxResults = 30;
  const clientKey = (req.headers['x-goog-api-key'] as string) || (req.query.key as string) || '';
  const serverKey = process.env.GOOGLE_BOOKS_API_KEY || '';
  const effectiveKey = clientKey || serverKey;
  const keyParam = effectiveKey ? `&key=${encodeURIComponent(effectiveKey)}` : '';
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${maxResults}&hl=pt-BR${keyParam}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const [googleResp, olResp] = await Promise.allSettled([
      fetch(googleUrl, { signal: controller.signal }),
      fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20`, { signal: controller.signal }),
    ]);
    clearTimeout(timeout);

    const items: any[] = [];
    let googleTotal = 0;

    if (googleResp.status === 'fulfilled' && googleResp.value.ok) {
      const gData = await googleResp.value.json();
      googleTotal = gData.totalItems || 0;
      if (Array.isArray(gData.items)) {
        for (const item of gData.items) {
          const info = item.volumeInfo || {};
          const isbns = info.industryIdentifiers || [];
          const isbn13 = isbns.find((id: any) => id.type === 'ISBN_13')?.identifier || null;
          const isbn10 = isbns.find((id: any) => id.type === 'ISBN_10')?.identifier || null;
          const rawCover = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail;
          const cleanCover = rawCover ? String(rawCover).replace(/^http:\/\//i, 'https://').replace(/([?&])edge=curl&?/gi, '').replace(/[?&]$/, '') : null;

          items.push({
            origem: 'google',
            idExterno: item.id,
            volumeId: item.id,
            titulo: info.title || 'Sem título',
            subtitulo: info.subtitle || null,
            autores: Array.isArray(info.authors) ? info.authors : [],
            editora: info.publisher || null,
            anoPublicacao: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
            paginas: info.pageCount || null,
            isbn10,
            isbn13,
            generos: Array.isArray(info.categories) ? info.categories : [],
            descricao: info.description || null,
            capaUrl: cleanCover,
            idioma: info.language || null,
            fontes: ['google'],
          });
        }
      }
    }

    const nextIndex = startIndex + items.length;
    const hasMore = nextIndex < googleTotal && items.length > 0;

    res.json({
      books: items,
      hasMore,
      nextCursor: hasMore ? String(nextIndex) : null,
      totalResults: items.length,
    });
  } catch (err: any) {
    console.error('Erro na pesquisa de livros:', err);
    res.status(500).json({ error: 'Erro ao consultar catálogo bibliográfico.' });
  }
});

// API: Consulta direta de livro por ISBN
app.get('/api/books/isbn/:isbn', async (req, res) => {
  const isbn = String(req.params.isbn || '').replace(/[-\s]/g, '');
  if (!isbn) {
    return res.status(400).json({ error: 'ISBN inválido.' });
  }

  try {
    const brasilResp = await fetch(`https://brasilapi.com.br/api/isbn/v1/${isbn}`);
    if (brasilResp.ok) {
      const bData = await brasilResp.json();
      return res.json({
        origem: 'brasilapi',
        idExterno: isbn,
        titulo: bData.title,
        subtitulo: bData.subtitle || null,
        autores: Array.isArray(bData.authors) ? bData.authors : [],
        editora: bData.publisher || null,
        anoPublicacao: bData.year || null,
        paginas: bData.page_count || null,
        isbn10: isbn.length === 10 ? isbn : null,
        isbn13: isbn.length === 13 ? isbn : null,
        generos: Array.isArray(bData.subjects) ? bData.subjects : [],
        descricao: bData.synopsis || null,
        capaUrl: bData.cover_url || `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
        fontes: ['brasilapi'],
      });
    }

    const serverKey = process.env.GOOGLE_BOOKS_API_KEY || '';
    const keyParam = serverKey ? `&key=${encodeURIComponent(serverKey)}` : '';
    const googleResp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&hl=pt-BR${keyParam}`);
    if (googleResp.ok) {
      const gData = await googleResp.json();
      const first = gData?.items?.[0];
      if (first) {
        const info = first.volumeInfo || {};
        return res.json({
          origem: 'google',
          idExterno: first.id,
          volumeId: first.id,
          titulo: info.title,
          subtitulo: info.subtitle || null,
          autores: info.authors || [],
          editora: info.publisher || null,
          anoPublicacao: info.publishedDate ? parseInt(info.publishedDate.slice(0, 4), 10) || null : null,
          paginas: info.pageCount || null,
          isbn10: isbn.length === 10 ? isbn : null,
          isbn13: isbn.length === 13 ? isbn : null,
          generos: info.categories || [],
          descricao: info.description || null,
          capaUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || null,
          fontes: ['google'],
        });
      }
    }

    res.status(404).json({ error: 'Livro não localizado para este ISBN.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao buscar ISBN.' });
  }
});

// API: Proxy para baixar e converter imagens de capas externas em Data URL (evitando bloqueios de CORS no cliente com proteção SSRF e limite de tamanho)
app.post('/api/fetch-image', async (req, res) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp, 60, 60 * 1000)) {
    return res.status(429).json({ error: 'Muitas requisições de download de imagens. Aguarde alguns instantes.' });
  }

  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !isSafeExternalUrl(url)) {
      return res.status(400).json({ error: 'URL de imagem externa inválida ou não permitida.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const imageResp = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
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
    if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
      return res.status(400).json({ error: 'O recurso fornecido não é uma imagem válida.' });
    }

    const contentLength = imageResp.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'A imagem excede o tamanho máximo permitido de 8MB.' });
    }

    const buffer = await imageResp.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) {
      return res.status(413).json({ error: 'A imagem excede o tamanho máximo permitido de 8MB.' });
    }

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
  const isBooknook = req.path.includes('booknook');
  const fileName = isDebug ? 'app-debug.apk' : isBooknook ? 'booknook.apk' : 'minha-estante.apk';
  let filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'booknook.apk');
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'minha-estante.apk');
  }

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

app.get('/upload_certificate.pem', (req, res) => {
  let filePath = path.resolve(process.cwd(), 'upload_certificate.pem');
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), 'public', 'upload_certificate.pem');
  }
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="upload_certificate.pem"');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('Certificado PEM não encontrado.');
  }
});

app.get('/booknook-release-key.jks', (req, res) => {
  const filePath = path.resolve(process.cwd(), 'booknook-release-key.jks');
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="booknook-release-key.jks"');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.status(404).send('Keystore JKS não encontrada.');
  }
});


async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.resolve(distPath, 'index.html'));
      }
      next();
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

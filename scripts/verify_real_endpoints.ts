/**
 * Script de verificação de conectividade e resposta real das fontes públicas de livros
 */

async function testEndpoint(name: string, url: string, validate: (data: any) => boolean) {
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MinhaEstante/2.0' } });
    const duration = Date.now() - start;
    if (!res.ok) {
      console.log(`[${name}] HTTP ${res.status} (${duration}ms) - FALHA`);
      return { ok: false, status: res.status, duration };
    }
    const data = await res.json();
    const isValid = validate(data);
    console.log(`[${name}] HTTP ${res.status} (${duration}ms) - ${isValid ? 'SUCESSO' : 'RETORNO INESPERADO'}`);
    return { ok: isValid, status: res.status, duration, sample: Array.isArray(data.items || data.docs || data.results) ? (data.items || data.docs || data.results).length : 'data' };
  } catch (err: any) {
    const duration = Date.now() - start;
    console.log(`[${name}] ERRO REDE: ${err.message} (${duration}ms)`);
    return { ok: false, error: err.message, duration };
  }
}

async function main() {
  console.log('=== VERIFICAÇÃO DE FONTES PÚBLICAS EM TEMPO REAL ===\n');

  // 1. Google Books (Sem chave - público)
  await testEndpoint(
    'Google Books - Texto',
    'https://www.googleapis.com/books/v1/volumes?q=O+Passeador+de+Livros&maxResults=5',
    (data) => Array.isArray(data.items) && data.items.length > 0
  );

  await testEndpoint(
    'Google Books - ISBN',
    'https://www.googleapis.com/books/v1/volumes?q=isbn:9786555604047',
    (data) => Array.isArray(data.items)
  );

  // 2. Open Library (Busca textual)
  await testEndpoint(
    'Open Library - Texto',
    'https://openlibrary.org/search.json?q=O+Passeador+de+Livros&limit=5',
    (data) => Array.isArray(data.docs) && data.docs.length > 0
  );

  // 3. BrasilAPI (ISBN direto)
  await testEndpoint(
    'BrasilAPI - ISBN',
    'https://brasilapi.com.br/api/isbn/v1/9786555604047',
    (data) => data.title && data.title.includes('Passeador')
  );

  // 4. Inventaire (Busca aberta por termo no inventaire.io canônico)
  await testEndpoint(
    'Inventaire - Busca',
    'https://inventaire.io/api/search?search=Carsten+Henn&types=works&limit=5',
    (data) => Array.isArray(data.results)
  );

  // 5. Open Library Covers (Head / Get)
  try {
    const coverRes = await fetch('https://covers.openlibrary.org/b/isbn/9786555604047-M.jpg?default=false');
    console.log(`[Open Library Covers] HTTP ${coverRes.status} (${coverRes.headers.get('content-type')})`);
  } catch (err: any) {
    console.log(`[Open Library Covers] Falha: ${err.message}`);
  }

  console.log('\n=== VERIFICAÇÃO CONCLUÍDA ===');
}

main();

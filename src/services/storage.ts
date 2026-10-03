import { Book, EstanteStats, ReadingStatus } from '../types/book';

const STORAGE_KEY_BOOKS = 'minha_estante_livros_v1';
const STORAGE_KEY_SCHEMA_VERSION = 'minha_estante_schema_version';
const STORAGE_KEY_BACKUP_PRE_MIGRATION = 'minha_estante_backup_pre_migration_v1';
const STORAGE_KEY_THEME = 'minha_estante_light_oak';
const STORAGE_KEY_VIEW_MODE = 'minha_estante_view_mode';
const STORAGE_KEY_GROUP_BY = 'minha_estante_group_by';
const STORAGE_KEY_API_KEY = 'minha_estante_google_api_key';

export const CURRENT_SCHEMA_VERSION = 2;

export const INITIAL_SEED_BOOKS: Book[] = [
  {
    id: 1,
    titulo: 'Dom Casmurro',
    subtitulo: 'Edição comemorativa',
    autores: ['Machado de Assis'],
    editora: 'Garnier',
    anoPublicacao: 1899,
    paginas: 256,
    isbn13: '9788535902778',
    generos: ['Literatura Brasileira', 'Romance', 'Clássico'],
    descricao: "Uma das maiores obras-primas da literatura em língua portuguesa. Narra a história de Bento Santiago e sua obsessão ciumenta por Capitu, os 'olhos de ressaca'.",
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788535902778-M.jpg',
    tenho_fisico: true,
    status_leitura: 'nenhum',
    observacoes: 'Edição física de capa dura comprada em sebo.',
    origem: 'manual',
    dataCadastro: Date.now() - 1000000,
    dataAtualizacao: Date.now() - 1000000,
  },
  {
    id: 2,
    titulo: 'Cem Anos de Solidão',
    subtitulo: null,
    autores: ['Gabriel García Márquez'],
    editora: 'Record',
    anoPublicacao: 1967,
    paginas: 448,
    isbn13: '9788501012074',
    generos: ['Realismo Mágico', 'Ficção', 'Clássico Latino'],
    descricao: 'A épica saga da família Buendía na mítica aldeia de Macondo, tecida entre milagres, guerras e solidão.',
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788501012074-M.jpg',
    tenho_fisico: true,
    status_leitura: 'quero_ler',
    observacoes: 'Comprei e vou ler em breve.',
    origem: 'manual',
    dataCadastro: Date.now() - 2000000,
    dataAtualizacao: Date.now() - 2000000,
  },
  {
    id: 3,
    titulo: 'O Nome da Rosa',
    subtitulo: null,
    autores: ['Umberto Eco'],
    editora: 'Record',
    anoPublicacao: 1980,
    paginas: 544,
    isbn13: '9788501017369',
    generos: ['Mistério', 'Ficção Histórica', 'Filosofia'],
    descricao: 'Durante a última semana de novembro de 1327, em um mosteiro franciscano no norte da Itália, o frade Guilherme de Baskerville investiga assassinatos misteriosos ligados a uma biblioteca labiríntica.',
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788501017369-M.jpg',
    tenho_fisico: true,
    status_leitura: 'lido',
    mesLeitura: 11,
    anoLeitura: 2025,
    nota: 9,
    observacoes: 'Li um livro que é meu. A descrição da biblioteca clássica é deslumbrante.',
    origem: 'manual',
    dataCadastro: Date.now() - 3000000,
    dataAtualizacao: Date.now() - 3000000,
  },
  {
    id: 4,
    titulo: 'A Metamorfose',
    subtitulo: null,
    autores: ['Franz Kafka'],
    editora: 'Companhia das Letras',
    anoPublicacao: 1915,
    paginas: 104,
    isbn13: '9788571646858',
    generos: ['Ficção', 'Existencialismo', 'Clássico'],
    descricao: 'Gregor Samsa acorda certa manhã transformado em um inseto monstruoso.',
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788571646858-M.jpg',
    tenho_fisico: false,
    status_leitura: 'lido',
    mesLeitura: 8,
    anoLeitura: 2025,
    nota: 9,
    observacoes: 'Li um exemplar emprestado da biblioteca pública.',
    origem: 'manual',
    dataCadastro: Date.now() - 4000000,
    dataAtualizacao: Date.now() - 4000000,
  },
  {
    id: 5,
    titulo: 'Grande Sertão: Veredas',
    subtitulo: null,
    autores: ['João Guimarães Rosa'],
    editora: 'Companhia das Letras',
    anoPublicacao: 1956,
    paginas: 624,
    isbn13: '9788535931983',
    generos: ['Literatura Brasileira', 'Romance'],
    descricao: 'O monólogo de Riobaldo, ex-jagunço que relembra sua vida pelas veredas do sertão e seu sentimento por Diadorim.',
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788535931983-M.jpg',
    tenho_fisico: false,
    status_leitura: 'quero_ler',
    origem: 'manual',
    dataCadastro: Date.now() - 5000000,
    dataAtualizacao: Date.now() - 5000000,
  },
  {
    id: 6,
    titulo: 'O Retrato de Dorian Gray',
    subtitulo: null,
    autores: ['Oscar Wilde'],
    editora: 'Penguin',
    anoPublicacao: 1890,
    paginas: 280,
    isbn13: '9788563560377',
    generos: ['Ficção Gótica', 'Clássico'],
    descricao: 'A busca eterna pela juventude e a degeneração da alma humana.',
    capaUrl: 'https://covers.openlibrary.org/b/isbn/9788563560377-M.jpg',
    tenho_fisico: false,
    status_leitura: 'quero_ler',
    origem: 'manual',
    dataCadastro: Date.now() - 6000000,
    dataAtualizacao: Date.now() - 6000000,
  },
];

/**
 * Normaliza string para comparação de duplicados
 */
function normalizeString(val?: string | null): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Identifica se dois livros são duplicados
 */
export function areBooksDuplicate(a: Partial<Book>, b: Partial<Book>): boolean {
  const cleanIsbn = (s?: string | null) => (s ? s.replace(/[-\s]/g, '').trim() : '');

  const a13 = cleanIsbn(a.isbn13);
  const b13 = cleanIsbn(b.isbn13);
  const a10 = cleanIsbn(a.isbn10);
  const b10 = cleanIsbn(b.isbn10);

  if (a13 && b13 && a13 === b13) return true;
  if (a10 && b10 && a10 === b10) return true;
  if (a13 && b10 && a13 === b10) return true;
  if (a10 && b13 && a10 === b13) return true;

  const normTitleA = normalizeString(a.titulo);
  const normTitleB = normalizeString(b.titulo);
  if (normTitleA && normTitleB && normTitleA === normTitleB) {
    const normAuthorA = normalizeString(a.autores?.[0]);
    const normAuthorB = normalizeString(b.autores?.[0]);
    if (!normAuthorA || !normAuthorB || normAuthorA === normAuthorB) {
      return true;
    }
  }

  return false;
}

/**
 * Mescla dois registros duplicados em um único registro preservando informações
 */
export function mergeDuplicateBooks(a: Book, b: Book): Book {
  // Combina posse física
  const combinedTenhoFisico = Boolean(a.tenho_fisico || b.tenho_fisico);

  // Status de leitura: 'lido' tem precedência sobre 'quero_ler' que tem precedência sobre 'nenhum'
  let combinedStatus: ReadingStatus = 'nenhum';
  if (a.status_leitura === 'lido' || b.status_leitura === 'lido') {
    combinedStatus = 'lido';
  } else if (a.status_leitura === 'quero_ler' || b.status_leitura === 'quero_ler') {
    combinedStatus = 'quero_ler';
  }

  // Preserva nota, ano e mês de leitura
  const nota = a.nota != null ? a.nota : b.nota != null ? b.nota : null;
  const anoLeitura = a.anoLeitura != null ? a.anoLeitura : b.anoLeitura != null ? b.anoLeitura : null;
  const mesLeitura = a.mesLeitura != null ? a.mesLeitura : b.mesLeitura != null ? b.mesLeitura : null;

  // Mescla observações
  let observacoes = a.observacoes || null;
  if (b.observacoes && b.observacoes !== a.observacoes) {
    observacoes = a.observacoes ? `${a.observacoes}\n\n${b.observacoes}` : b.observacoes;
  }

  // Mescla gêneros únicos
  const generosSet = new Set<string>([...(a.generos || []), ...(b.generos || [])]);

  // Autores
  const autores = (a.autores && a.autores.length > 0) ? a.autores : (b.autores || []);

  return {
    ...b,
    ...a,
    id: Math.min(a.id, b.id),
    titulo: a.titulo || b.titulo,
    subtitulo: a.subtitulo || b.subtitulo || null,
    autores,
    editora: a.editora || b.editora || null,
    anoPublicacao: a.anoPublicacao != null ? a.anoPublicacao : b.anoPublicacao != null ? b.anoPublicacao : null,
    paginas: a.paginas != null ? a.paginas : b.paginas != null ? b.paginas : null,
    isbn10: a.isbn10 || b.isbn10 || null,
    isbn13: a.isbn13 || b.isbn13 || null,
    generos: Array.from(generosSet),
    descricao: a.descricao || b.descricao || null,
    capaUrl: a.capaUrl || b.capaUrl || null,
    tenho_fisico: combinedTenhoFisico,
    status_leitura: combinedStatus,
    nota,
    anoLeitura,
    mesLeitura,
    observacoes,
    dataCadastro: Math.min(a.dataCadastro || Date.now(), b.dataCadastro || Date.now()),
    dataAtualizacao: Math.max(a.dataAtualizacao || Date.now(), b.dataAtualizacao || Date.now()),
  };
}

/**
 * Migra lista de livros antigos para a nova regra de negócio independente
 */
export function migrateLegacyBooks(rawBooks: any[]): Book[] {
  if (!Array.isArray(rawBooks)) return [];

  // 1. Converte campos individuais para cada livro
  const converted: Book[] = rawBooks.map((raw, idx) => {
    let tenho_fisico = false;
    let status_leitura: ReadingStatus = 'nenhum';

    if (typeof raw.tenho_fisico === 'boolean') {
      tenho_fisico = raw.tenho_fisico;
    }

    if (raw.status_leitura === 'lido' || raw.status_leitura === 'quero_ler' || raw.status_leitura === 'nenhum') {
      status_leitura = raw.status_leitura;
    } else if (raw.status) {
      // Regra de migração solicitada:
      // - "Meus Livros" -> tenho_fisico = true, status_leitura = nenhum
      // - "lido" -> status_leitura = lido, tenho_fisico = false
      // - "quero_ler" -> status_leitura = quero_ler, tenho_fisico = false
      if (raw.status === 'meus_livros') {
        tenho_fisico = true;
        status_leitura = 'nenhum';
      } else if (raw.status === 'lido') {
        status_leitura = 'lido';
        if (typeof raw.tenho_fisico !== 'boolean') tenho_fisico = false;
      } else if (raw.status === 'quero_ler') {
        status_leitura = 'quero_ler';
        if (typeof raw.tenho_fisico !== 'boolean') tenho_fisico = false;
      }
    }

    return {
      id: raw.id || idx + 1,
      origem: raw.origem || 'manual',
      idExterno: raw.idExterno || null,
      titulo: raw.titulo || 'Sem título',
      subtitulo: raw.subtitulo || null,
      autores: Array.isArray(raw.autores) ? raw.autores : [],
      editora: raw.editora || null,
      anoPublicacao: raw.anoPublicacao != null ? parseInt(raw.anoPublicacao, 10) || null : null,
      paginas: raw.paginas != null ? parseInt(raw.paginas, 10) || null : null,
      isbn10: raw.isbn10 || null,
      isbn13: raw.isbn13 || null,
      generos: Array.isArray(raw.generos) ? raw.generos : [],
      descricao: raw.descricao || null,
      capaUrl: raw.capaUrl || null,
      tenho_fisico,
      status_leitura,
      mesLeitura: raw.mesLeitura != null ? parseInt(raw.mesLeitura, 10) || null : null,
      anoLeitura: raw.anoLeitura != null ? parseInt(raw.anoLeitura, 10) || null : null,
      nota: raw.nota != null ? parseInt(raw.nota, 10) || null : null,
      observacoes: raw.observacoes || null,
      dataCadastro: raw.dataCadastro || Date.now(),
      dataAtualizacao: raw.dataAtualizacao || Date.now(),
    };
  });

  // 2. Mescla registros duplicados (ex.: um livro em Meus Livros e outro em Lido/Quero ler)
  const merged: Book[] = [];
  for (const book of converted) {
    const existingIdx = merged.findIndex((m) => areBooksDuplicate(m, book));
    if (existingIdx >= 0) {
      merged[existingIdx] = mergeDuplicateBooks(merged[existingIdx], book);
    } else {
      merged.push(book);
    }
  }

  return merged;
}

export const BookStorage = {
  loadBooks(): Book[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (!data) {
        this.saveAllBooks(INITIAL_SEED_BOOKS);
        localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
        return INITIAL_SEED_BOOKS;
      }

      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return INITIAL_SEED_BOOKS;
      }

      const schemaVersion = parseInt(localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION) || '1', 10);
      const needsMigration =
        schemaVersion < CURRENT_SCHEMA_VERSION ||
        parsed.some((b) => typeof b.tenho_fisico !== 'boolean' || !b.status_leitura);

      if (needsMigration) {
        // Antes da migração, gerar backup JSON automático
        try {
          localStorage.setItem(STORAGE_KEY_BACKUP_PRE_MIGRATION, data);
        } catch (e) {
          console.warn('Não foi possível salvar backup pré-migração no localStorage', e);
        }

        const migrated = migrateLegacyBooks(parsed);
        this.saveAllBooks(migrated);
        localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
        return migrated;
      }

      return parsed;
    } catch (err) {
      console.error('Erro ao carregar livros do storage', err);
      return INITIAL_SEED_BOOKS;
    }
  },

  saveAllBooks(books: Book[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
    } catch (e) {
      console.error('Falha ao salvar livros no localStorage', e);
    }
  },

  saveBook(book: Book, allBooks: Book[]): { updatedBooks: Book[]; savedId: number } {
    const now = Date.now();
    let updatedBooks: Book[];
    let savedId = book.id;

    if (book.id && book.id > 0) {
      // Atualização
      updatedBooks = allBooks.map((b) => (b.id === book.id ? { ...book, dataAtualizacao: now } : b));
    } else {
      // Inserção
      const maxId = allBooks.reduce((max, b) => Math.max(max, b.id || 0), 0);
      savedId = maxId + 1;
      const newBook: Book = {
        ...book,
        id: savedId,
        dataCadastro: book.dataCadastro || now,
        dataAtualizacao: now,
      };
      updatedBooks = [newBook, ...allBooks];
    }

    this.saveAllBooks(updatedBooks);
    return { updatedBooks, savedId };
  },

  deleteBook(id: number, allBooks: Book[]): Book[] {
    const filtered = allBooks.filter((b) => b.id !== id);
    this.saveAllBooks(filtered);
    return filtered;
  },

  findPotentialDuplicate(
    isbn13: string | null | undefined,
    isbn10: string | null | undefined,
    titulo: string,
    autores: string[] | undefined,
    allBooks: Book[]
  ): Book | undefined {
    return allBooks.find((book) =>
      areBooksDuplicate({ isbn13, isbn10, titulo, autores }, book)
    );
  },

  calculateStats(books: Book[]): EstanteStats {
    return this.computeStats(books);
  },

  computeStats(books: Book[]): EstanteStats {
    const currentYear = new Date().getFullYear();
    // Meus Livros: tenho_fisico === true
    const meusLivros = books.filter((b) => b.tenho_fisico);
    // Lidos: status_leitura === 'lido'
    const lidos = books.filter((b) => b.status_leitura === 'lido');
    // Quero Ler: status_leitura === 'quero_ler'
    const queroLer = books.filter((b) => b.status_leitura === 'quero_ler');

    const totalPaginasLidas = lidos.reduce((acc, b) => acc + (b.paginas || 0), 0);
    const livrosAnoAtual = lidos.filter((b) => b.anoLeitura === currentYear);
    const paginasAnoAtual = livrosAnoAtual.reduce((acc, b) => acc + (b.paginas || 0), 0);

    const livrosComNota = lidos.filter((b) => b.nota != null && b.nota >= 0);
    const notaMedia =
      livrosComNota.length > 0
        ? livrosComNota.reduce((sum, b) => sum + (b.nota || 0), 0) / livrosComNota.length
        : null;

    // Lidos por ano
    const porAno: Record<number, number> = {};
    lidos.forEach((book) => {
      if (book.anoLeitura != null) {
        porAno[book.anoLeitura] = (porAno[book.anoLeitura] || 0) + 1;
      }
    });

    // Top Autores
    const autoresMap: Record<string, number> = {};
    lidos.forEach((book) => {
      book.autores?.forEach((autor) => {
        const trimmed = autor.trim();
        if (trimmed) {
          autoresMap[trimmed] = (autoresMap[trimmed] || 0) + 1;
        }
      });
    });
    const topAutores: [string, number][] = Object.entries(autoresMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    // Top Gêneros
    const generosMap: Record<string, number> = {};
    lidos.forEach((book) => {
      book.generos?.forEach((gen) => {
        const trimmed = gen.trim();
        if (trimmed) {
          generosMap[trimmed] = (generosMap[trimmed] || 0) + 1;
        }
      });
    });
    const topGeneros: [string, number][] = Object.entries(generosMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    return {
      totalMeusLivros: meusLivros.length,
      totalLidos: lidos.length,
      totalQueroLer: queroLer.length,
      totalPaginasLidas,
      paginasLidasAnoAtual: paginasAnoAtual,
      livrosLidosAnoAtual: livrosAnoAtual.length,
      notaMedia,
      lidosPorAno: porAno,
      topAutores,
      topGeneros,
    };
  },

  // Export JSON
  exportJson(books: Book[]): string {
    return JSON.stringify(
      {
        version: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        books,
      },
      null,
      2
    );
  },

  // Export CSV com os novos campos independentes
  exportCsv(books: Book[]): string {
    const escapeCsv = (str: string | null | undefined): string => {
      if (str == null) return '';
      const clean = String(str).replace(/"/g, '""');
      if (clean.includes(',') || clean.includes('\n') || clean.includes('"')) {
        return `"${clean}"`;
      }
      return clean;
    };

    const headers = [
      'id',
      'origem',
      'titulo',
      'subtitulo',
      'autores',
      'editora',
      'ano_publicacao',
      'paginas',
      'isbn10',
      'isbn13',
      'generos',
      'descricao',
      'capa_url',
      'tenho_fisico',
      'status_leitura',
      'mes_leitura',
      'ano_leitura',
      'nota',
      'observacoes',
    ];

    const rows = books.map((b) => [
      b.id,
      escapeCsv(b.origem),
      escapeCsv(b.titulo),
      escapeCsv(b.subtitulo),
      escapeCsv(b.autores?.join('; ')),
      escapeCsv(b.editora),
      b.anoPublicacao ?? '',
      b.paginas ?? '',
      escapeCsv(b.isbn10),
      escapeCsv(b.isbn13),
      escapeCsv(b.generos?.join('; ')),
      escapeCsv(b.descricao),
      escapeCsv(b.capaUrl),
      b.tenho_fisico ? 'sim' : 'nao',
      escapeCsv(b.status_leitura),
      b.mesLeitura ?? '',
      b.anoLeitura ?? '',
      b.nota ?? '',
      escapeCsv(b.observacoes),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },

  // Import JSON com migração transparente
  importJson(jsonString: string, currentBooks: Book[]): { count: number; updatedBooks: Book[] } {
    try {
      const parsed = JSON.parse(jsonString);
      const rawList = Array.isArray(parsed) ? parsed : Array.isArray(parsed.books) ? parsed.books : [];
      if (rawList.length === 0) return { count: 0, updatedBooks: currentBooks };

      const migrated = migrateLegacyBooks(rawList);

      // Mescla com livros atuais evitando duplicatas
      let updated = [...currentBooks];
      let addedOrUpdatedCount = 0;

      for (const item of migrated) {
        const existingIdx = updated.findIndex((b) => areBooksDuplicate(b, item));
        if (existingIdx >= 0) {
          updated[existingIdx] = mergeDuplicateBooks(updated[existingIdx], item);
        } else {
          const maxId = updated.reduce((max, b) => Math.max(max, b.id || 0), 0);
          updated.push({ ...item, id: maxId + 1 });
        }
        addedOrUpdatedCount++;
      }

      this.saveAllBooks(updated);
      return { count: addedOrUpdatedCount, updatedBooks: updated };
    } catch (e) {
      console.error('Falha ao importar JSON', e);
      throw new Error('Formato de arquivo JSON inválido');
    }
  },

  // Import CSV
  importCsv(csvString: string, currentBooks: Book[]): { count: number; updatedBooks: Book[] } {
    const lines = csvString.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { count: 0, updatedBooks: currentBooks };

    const parseCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += c;
        }
      }
      result.push(current);
      return result;
    };

    const parseMonth = (raw?: string | null): number | null => {
      if (!raw) return null;
      const num = parseInt(raw, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) return num;
      const lower = raw.toLowerCase().trim();
      if (lower.startsWith('jan')) return 1;
      if (lower.startsWith('fev') || lower.startsWith('feb')) return 2;
      if (lower.startsWith('mar')) return 3;
      if (lower.startsWith('abr') || lower.startsWith('apr')) return 4;
      if (lower.startsWith('mai') || lower.startsWith('may')) return 5;
      if (lower.startsWith('jun')) return 6;
      if (lower.startsWith('jul')) return 7;
      if (lower.startsWith('ago') || lower.startsWith('aug')) return 8;
      if (lower.startsWith('set') || lower.startsWith('sep')) return 9;
      if (lower.startsWith('out') || lower.startsWith('oct')) return 10;
      if (lower.startsWith('nov')) return 11;
      if (lower.startsWith('dez') || lower.startsWith('dec')) return 12;
      return null;
    };

    const headerLine = lines[0];
    const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());

    const titleIdx = headers.findIndex((h) => h.includes('titul') || h.includes('title') || h === 'nome');
    const authorIdx = headers.findIndex((h) => h.includes('autor') || h.includes('author'));
    const yearIdx = headers.findIndex((h) => h.includes('ano_leitura') || h.includes('ano leitura') || h === 'ano');
    const monthIdx = headers.findIndex((h) => h.includes('mes_leitura') || h.includes('mês') || h.includes('mes'));
    const ratingIdx = headers.findIndex((h) => h.includes('nota') || h.includes('rating') || h.includes('estrelas'));
    const pagesIdx = headers.findIndex((h) => h.includes('pagina') || h.includes('pages'));
    const tenhoFisicoIdx = headers.findIndex((h) => h.includes('tenho') || h.includes('posse') || h.includes('fisico') || h.includes('own'));
    const statusLeituraIdx = headers.findIndex((h) => h.includes('status_leitura') || h.includes('leitura'));
    const legacyStatusIdx = headers.findIndex((h) => h === 'status');

    let maxId = currentBooks.reduce((max, b) => Math.max(max, b.id || 0), 0);
    const importedBooks: Book[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cols = parseCsvLine(line);

      const title = titleIdx >= 0 && titleIdx < cols.length ? cols[titleIdx].trim() : '';
      if (!title) continue;

      const rawAuthor = authorIdx >= 0 && authorIdx < cols.length ? cols[authorIdx].trim() : '';
      const authors = rawAuthor
        ? rawAuthor
            .split(/[;,]/)
            .map((a) => a.trim())
            .filter(Boolean)
        : [];

      const rawYear = yearIdx >= 0 && yearIdx < cols.length ? cols[yearIdx].trim() : null;
      const year = rawYear ? parseInt(rawYear, 10) || null : null;

      const rawMonth = monthIdx >= 0 && monthIdx < cols.length ? cols[monthIdx].trim() : null;
      const month = parseMonth(rawMonth);

      const rawRating = ratingIdx >= 0 && ratingIdx < cols.length ? cols[ratingIdx].trim() : null;
      const parsedRating = rawRating ? Math.min(10, Math.max(0, parseInt(rawRating, 10))) : null;

      const rawPages = pagesIdx >= 0 && pagesIdx < cols.length ? cols[pagesIdx].trim() : null;
      const pages = rawPages ? parseInt(rawPages, 10) || null : null;

      let tenho_fisico = false;
      let status_leitura: ReadingStatus = 'nenhum';

      if (tenhoFisicoIdx >= 0 && tenhoFisicoIdx < cols.length) {
        const val = cols[tenhoFisicoIdx].toLowerCase().trim();
        tenho_fisico = val === 'sim' || val === 'true' || val === '1' || val === 'yes' || val === 's';
      }

      if (statusLeituraIdx >= 0 && statusLeituraIdx < cols.length) {
        const val = cols[statusLeituraIdx].toLowerCase().trim();
        if (val.includes('lido') || val === 'read') status_leitura = 'lido';
        else if (val.includes('quero') || val.includes('wish')) status_leitura = 'quero_ler';
        else status_leitura = 'nenhum';
      } else if (legacyStatusIdx >= 0 && legacyStatusIdx < cols.length) {
        const val = cols[legacyStatusIdx].toLowerCase().trim();
        if (val.includes('meus') || val.includes('tenho')) {
          tenho_fisico = true;
          status_leitura = 'nenhum';
        } else if (val.includes('lido')) {
          status_leitura = 'lido';
        } else if (val.includes('quero')) {
          status_leitura = 'quero_ler';
        }
      }

      maxId++;
      importedBooks.push({
        id: maxId,
        origem: 'manual',
        titulo: title,
        autores: authors,
        anoLeitura: year,
        mesLeitura: month,
        nota: isNaN(parsedRating as number) ? null : parsedRating,
        tenho_fisico,
        status_leitura,
        paginas: isNaN(pages as number) ? null : pages,
        generos: [],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });
    }

    if (importedBooks.length > 0) {
      let updated = [...currentBooks];
      for (const item of importedBooks) {
        const existingIdx = updated.findIndex((b) => areBooksDuplicate(b, item));
        if (existingIdx >= 0) {
          updated[existingIdx] = mergeDuplicateBooks(updated[existingIdx], item);
        } else {
          updated.push(item);
        }
      }

      this.saveAllBooks(updated);
      return { count: importedBooks.length, updatedBooks: updated };
    }

    return { count: 0, updatedBooks: currentBooks };
  },

  // Configurações
  loadTheme(): boolean {
    return localStorage.getItem(STORAGE_KEY_THEME) === 'true';
  },
  saveTheme(isLightOak: boolean): void {
    localStorage.setItem(STORAGE_KEY_THEME, String(isLightOak));
  },

  loadViewMode(): 'CAPAS' | 'LISTA' {
    return (localStorage.getItem(STORAGE_KEY_VIEW_MODE) as 'CAPAS' | 'LISTA') || 'CAPAS';
  },
  saveViewMode(mode: 'CAPAS' | 'LISTA'): void {
    localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
  },

  loadGroupBy(): 'ANO' | 'AUTOR' | 'GENERO' {
    return (localStorage.getItem(STORAGE_KEY_GROUP_BY) as 'ANO' | 'AUTOR' | 'GENERO') || 'ANO';
  },
  saveGroupBy(group: 'ANO' | 'AUTOR' | 'GENERO'): void {
    localStorage.setItem(STORAGE_KEY_GROUP_BY, group);
  },

  loadApiKey(): string {
    return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
  },
  saveApiKey(key: string): void {
    localStorage.setItem(STORAGE_KEY_API_KEY, key);
  },
};

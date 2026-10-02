import { Book, EstanteStats } from '../types/book';

const STORAGE_KEY_BOOKS = 'minha_estante_livros_v1';
const STORAGE_KEY_THEME = 'minha_estante_light_oak';
const STORAGE_KEY_VIEW_MODE = 'minha_estante_view_mode';
const STORAGE_KEY_GROUP_BY = 'minha_estante_group_by';
const STORAGE_KEY_API_KEY = 'minha_estante_google_api_key';

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
    status: 'lido',
    mesLeitura: 5,
    anoLeitura: 2026,
    nota: 10,
    observacoes: 'Releitura magnífica! A prosa irônica de Machado continua insuperável.',
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
    status: 'lido',
    mesLeitura: 2,
    anoLeitura: 2026,
    nota: 10,
    observacoes: 'Obra arrebatadora do início ao fim.',
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
    status: 'lido',
    mesLeitura: 11,
    anoLeitura: 2025,
    nota: 9,
    observacoes: 'A descrição da biblioteca clássica é deslumbrante.',
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
    status: 'lido',
    mesLeitura: 8,
    anoLeitura: 2025,
    nota: 9,
    observacoes: 'Curto e perturbador.',
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
    status: 'quero_ler',
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
    status: 'quero_ler',
    origem: 'manual',
    dataCadastro: Date.now() - 6000000,
    dataAtualizacao: Date.now() - 6000000,
  },
];

export const BookStorage = {
  loadBooks(): Book[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY_BOOKS);
      if (!data) {
        this.saveAllBooks(INITIAL_SEED_BOOKS);
        return INITIAL_SEED_BOOKS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : INITIAL_SEED_BOOKS;
    } catch {
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
    title: string,
    allBooks: Book[]
  ): Book | undefined {
    const cleanIsbn13 = isbn13?.replace(/[-\s]/g, '').trim();
    const cleanIsbn10 = isbn10?.replace(/[-\s]/g, '').trim();
    const normTitle = title.toLowerCase().trim();

    return allBooks.find((book) => {
      const bIsbn13 = book.isbn13?.replace(/[-\s]/g, '').trim();
      const bIsbn10 = book.isbn10?.replace(/[-\s]/g, '').trim();

      if (cleanIsbn13 && (bIsbn13 === cleanIsbn13 || bIsbn10 === cleanIsbn13)) return true;
      if (cleanIsbn10 && (bIsbn10 === cleanIsbn10 || bIsbn13 === cleanIsbn10)) return true;
      if (normTitle && book.titulo.toLowerCase().trim() === normTitle) return true;
      return false;
    });
  },

  computeStats(books: Book[]): EstanteStats {
    const currentYear = new Date().getFullYear();
    const lidos = books.filter((b) => b.status === 'lido');
    const queroLer = books.filter((b) => b.status === 'quero_ler');

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
    return JSON.stringify(books, null, 2);
  },

  // Export CSV
  exportCsv(books: Book[]): string {
    const escapeCsv = (str: string | null | undefined): string => {
      if (str == null) return '';
      const clean = str.replace(/"/g, '""');
      if (clean.includes(',') || clean.includes('\n') || clean.includes('"')) {
        return `"${clean}"`;
      }
      return clean;
    };

    const headers =
      'id,origem,titulo,subtitulo,autores,editora,ano_publicacao,paginas,isbn13,isbn10,generos,status,mes_leitura,ano_leitura,nota,observacoes\n';

    const rows = books.map((b) => {
      return [
        b.id,
        b.origem,
        escapeCsv(b.titulo),
        escapeCsv(b.subtitulo),
        escapeCsv(b.autores?.join(';')),
        escapeCsv(b.editora),
        b.anoPublicacao || '',
        b.paginas || '',
        escapeCsv(b.isbn13),
        escapeCsv(b.isbn10),
        escapeCsv(b.generos?.join(';')),
        b.status,
        b.mesLeitura || '',
        b.anoLeitura || '',
        b.nota != null ? b.nota : '',
        escapeCsv(b.observacoes),
      ].join(',');
    });

    return headers + rows.join('\n');
  },

  // Import JSON
  importJson(jsonString: string, currentBooks: Book[]): { count: number; updatedBooks: Book[] } {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) throw new Error('O conteúdo deve ser uma lista JSON válida de livros.');

    let maxId = currentBooks.reduce((max, b) => Math.max(max, b.id || 0), 0);
    const imported: Book[] = parsed.map((item) => {
      maxId++;
      return {
        id: maxId,
        origem: item.origem || 'manual',
        idExterno: item.idExterno || null,
        titulo: item.titulo || 'Sem título',
        subtitulo: item.subtitulo || null,
        autores: Array.isArray(item.autores) ? item.autores : item.autores ? [String(item.autores)] : [],
        editora: item.editora || null,
        anoPublicacao: item.anoPublicacao ? Number(item.anoPublicacao) : null,
        paginas: item.paginas ? Number(item.paginas) : null,
        isbn10: item.isbn10 || null,
        isbn13: item.isbn13 || null,
        generos: Array.isArray(item.generos) ? item.generos : [],
        descricao: item.descricao || null,
        capaUrl: item.capaUrl || null,
        capaLocalPath: null,
        status: item.status === 'quero_ler' ? 'quero_ler' : 'lido',
        mesLeitura: item.mesLeitura ? Number(item.mesLeitura) : null,
        anoLeitura: item.anoLeitura ? Number(item.anoLeitura) : null,
        nota: item.nota != null ? Number(item.nota) : null,
        observacoes: item.observacoes || null,
        dataCadastro: item.dataCadastro || Date.now(),
        dataAtualizacao: Date.now(),
      };
    });

    const updated = [...imported, ...currentBooks];
    this.saveAllBooks(updated);
    return { count: imported.length, updatedBooks: updated };
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
    const statusIdx = headers.findIndex((h) => h.includes('status'));
    const pagesIdx = headers.findIndex((h) => h.includes('pagina') || h.includes('pages'));

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

      const rawStatus = statusIdx >= 0 && statusIdx < cols.length ? cols[statusIdx].trim().toLowerCase() : '';
      const status = rawStatus.includes('quero') || rawStatus.includes('wish') ? 'quero_ler' : 'lido';

      const rawPages = pagesIdx >= 0 && pagesIdx < cols.length ? cols[pagesIdx].trim() : null;
      const pages = rawPages ? parseInt(rawPages, 10) || null : null;

      maxId++;
      importedBooks.push({
        id: maxId,
        origem: 'manual',
        titulo: title,
        autores: authors,
        anoLeitura: year,
        mesLeitura: month,
        nota: isNaN(parsedRating as number) ? null : parsedRating,
        status,
        paginas: isNaN(pages as number) ? null : pages,
        generos: [],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      });
    }

    if (importedBooks.length > 0) {
      const updated = [...importedBooks, ...currentBooks];
      this.saveAllBooks(updated);
      return { count: importedBooks.length, updatedBooks: updated };
    }

    return { count: 0, updatedBooks: currentBooks };
  },

  // Settings
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

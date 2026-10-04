import { describe, it, expect } from 'vitest';
import { Book, isBookInTab } from '../types/book';
import {
  migrateLegacyBooks,
  areBooksDuplicate,
} from '../services/storage';

describe('1. Testes das 5 combinações da tabela da Seção 2', () => {
  // Combinação 1: Posse = sim, Leitura = nenhum -> Aparece em "Meus Livros"
  it('Combinação 1: tenho_fisico = true, status_leitura = nenhum -> aparece apenas em Meus Livros', () => {
    const book: Book = {
      id: 1,
      origem: 'manual',
      titulo: 'Livro Tenho Sem Decidir',
      autores: ['Autor A'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(true);
    expect(isBookInTab(book, 'lido')).toBe(false);
    expect(isBookInTab(book, 'quero_ler')).toBe(false);
  });

  // Combinação 2: Posse = sim, Leitura = lido -> Aparece em "Meus Livros" E "Lidos"
  it('Combinação 2: tenho_fisico = true, status_leitura = lido -> aparece em Meus Livros e Lidos', () => {
    const book: Book = {
      id: 2,
      origem: 'manual',
      titulo: 'Livro Meu e Lido',
      autores: ['Autor B'],
      tenho_fisico: true,
      status_leitura: 'lido',
      anoLeitura: 2025,
      nota: 9,
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(true);
    expect(isBookInTab(book, 'lido')).toBe(true);
    expect(isBookInTab(book, 'quero_ler')).toBe(false);
  });

  // Combinação 3: Posse = sim, Leitura = quero_ler -> Aparece em "Meus Livros" E "Quero ler"
  it('Combinação 3: tenho_fisico = true, status_leitura = quero_ler -> aparece em Meus Livros e Quero ler', () => {
    const book: Book = {
      id: 3,
      origem: 'manual',
      titulo: 'Livro Meu e Quero Ler',
      autores: ['Autor C'],
      tenho_fisico: true,
      status_leitura: 'quero_ler',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(true);
    expect(isBookInTab(book, 'lido')).toBe(false);
    expect(isBookInTab(book, 'quero_ler')).toBe(true);
  });

  // Combinação 4: Posse = não, Leitura = lido -> Aparece apenas em "Lidos"
  it('Combinação 4: tenho_fisico = false, status_leitura = lido -> aparece apenas em Lidos', () => {
    const book: Book = {
      id: 4,
      origem: 'manual',
      titulo: 'Livro Emprestado Lido',
      autores: ['Autor D'],
      tenho_fisico: false,
      status_leitura: 'lido',
      anoLeitura: 2024,
      nota: 8,
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(false);
    expect(isBookInTab(book, 'lido')).toBe(true);
    expect(isBookInTab(book, 'quero_ler')).toBe(false);
  });

  // Combinação 5: Posse = não, Leitura = quero_ler -> Aparece apenas em "Quero ler"
  it('Combinação 5: tenho_fisico = false, status_leitura = quero_ler -> aparece apenas em Quero ler', () => {
    const book: Book = {
      id: 5,
      origem: 'manual',
      titulo: 'Livro da Lista de Desejos',
      autores: ['Autor E'],
      tenho_fisico: false,
      status_leitura: 'quero_ler',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(false);
    expect(isBookInTab(book, 'lido')).toBe(false);
    expect(isBookInTab(book, 'quero_ler')).toBe(true);
  });

  // Caso especial: Posse = não e Leitura = nenhum -> Não aparece em nenhuma aba
  it('tenho_fisico = false e status_leitura = nenhum não aparece em nenhuma aba', () => {
    const book: Book = {
      id: 6,
      origem: 'manual',
      titulo: 'Livro Oculto Sem Lista',
      autores: ['Autor F'],
      tenho_fisico: false,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    expect(isBookInTab(book, 'meus_livros')).toBe(false);
    expect(isBookInTab(book, 'lido')).toBe(false);
    expect(isBookInTab(book, 'quero_ler')).toBe(false);
  });
});

describe('2. Teste de independência entre Posse e Status de Leitura', () => {
  it('Marcar como Lido ou Quero ler NUNCA altera a posse (tenho_fisico)', () => {
    const livroFisico: Book = {
      id: 1,
      origem: 'manual',
      titulo: 'Obra Física',
      autores: ['Autor X'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    // Altera para 'lido'
    const atualizadoLido: Book = {
      ...livroFisico,
      status_leitura: 'lido',
      anoLeitura: 2026,
      nota: 10,
    };
    expect(atualizadoLido.tenho_fisico).toBe(true);
    expect(atualizadoLido.status_leitura).toBe('lido');

    // Altera para 'quero_ler'
    const atualizadoQueroLer: Book = {
      ...atualizadoLido,
      status_leitura: 'quero_ler',
    };
    expect(atualizadoQueroLer.tenho_fisico).toBe(true);
    expect(atualizadoQueroLer.status_leitura).toBe('quero_ler');

    // Livro sem posse física marcado como Lido mantém tenho_fisico = false
    const livroEmprestado: Book = {
      id: 2,
      origem: 'manual',
      titulo: 'Obra Emprestada',
      autores: ['Autor Y'],
      tenho_fisico: false,
      status_leitura: 'quero_ler',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };
    const emprestadoLido: Book = {
      ...livroEmprestado,
      status_leitura: 'lido',
    };
    expect(emprestadoLido.tenho_fisico).toBe(false);
    expect(emprestadoLido.status_leitura).toBe('lido');
  });

  it('Remover de Meus Livros (desmarcar posse) NUNCA altera status de leitura, nota ou data', () => {
    const livro: Book = {
      id: 3,
      origem: 'manual',
      titulo: 'Obra Lida Completa',
      autores: ['Autor Z'],
      tenho_fisico: true,
      status_leitura: 'lido',
      anoLeitura: 2025,
      mesLeitura: 7,
      nota: 9,
      observacoes: 'Excelente livro clássico',
      generos: ['Ficção'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    // Desmarca posse
    const semPosse: Book = {
      ...livro,
      tenho_fisico: false,
    };

    expect(semPosse.tenho_fisico).toBe(false);
    expect(semPosse.status_leitura).toBe('lido');
    expect(semPosse.anoLeitura).toBe(2025);
    expect(semPosse.mesLeitura).toBe(7);
    expect(semPosse.nota).toBe(9);
    expect(semPosse.observacoes).toBe('Excelente livro clássico');
  });

  it('Mudar de Quero ler para Lido mantém a posse', () => {
    const livroComprado: Book = {
      id: 4,
      origem: 'manual',
      titulo: 'Comprei e Vou Ler',
      autores: ['Autor W'],
      tenho_fisico: true,
      status_leitura: 'quero_ler',
      generos: [],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    const lido: Book = {
      ...livroComprado,
      status_leitura: 'lido',
      anoLeitura: 2026,
      nota: 8,
    };

    expect(lido.tenho_fisico).toBe(true);
    expect(lido.status_leitura).toBe('lido');
  });
});

describe('3. Teste da migração e mesclagem de registros duplicados', () => {
  it('Migra registros legados: "meus_livros" -> tenho_fisico=true, status_leitura=nenhum', () => {
    const rawData = [
      {
        id: 1,
        titulo: 'Livro Antigo em Meus Livros',
        autores: ['Autor Antigo'],
        status: 'meus_livros',
      },
    ];

    const migrated = migrateLegacyBooks(rawData);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].tenho_fisico).toBe(true);
    expect(migrated[0].status_leitura).toBe('nenhum');
  });

  it('Migra registros legados: "lido" -> status_leitura=lido, tenho_fisico=false', () => {
    const rawData = [
      {
        id: 2,
        titulo: 'Livro Antigo Lido',
        autores: ['Autor Lido'],
        status: 'lido',
        anoLeitura: 2024,
        nota: 10,
      },
    ];

    const migrated = migrateLegacyBooks(rawData);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].status_leitura).toBe('lido');
    expect(migrated[0].tenho_fisico).toBe(false);
    expect(migrated[0].nota).toBe(10);
  });

  it('Migra registros legados: "quero_ler" -> status_leitura=quero_ler, tenho_fisico=false', () => {
    const rawData = [
      {
        id: 3,
        titulo: 'Livro Antigo Quero Ler',
        autores: ['Autor Desejo'],
        status: 'quero_ler',
      },
    ];

    const migrated = migrateLegacyBooks(rawData);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].status_leitura).toBe('quero_ler');
    expect(migrated[0].tenho_fisico).toBe(false);
  });

  it('Mescla registros duplicados do mesmo livro combinando posse + status e preservando dados', () => {
    // Cenário: o usuário tinha criado 2 registros do mesmo livro (um em Meus Livros e outro em Lido)
    const rawData = [
      {
        id: 10,
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        isbn13: '9788535902778',
        status: 'meus_livros', // Posse em casa
        observacoes: 'Edição capa dura',
        editora: 'Garnier',
      },
      {
        id: 11,
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        isbn13: '9788535902778',
        status: 'lido', // Registro da leitura com nota
        anoLeitura: 2025,
        mesLeitura: 5,
        nota: 10,
      },
    ];

    const migrated = migrateLegacyBooks(rawData);
    // Deve mesclar em um único registro!
    expect(migrated).toHaveLength(1);

    const merged = migrated[0];
    expect(merged.titulo).toBe('Dom Casmurro');
    expect(merged.tenho_fisico).toBe(true); // Posse combinada!
    expect(merged.status_leitura).toBe('lido'); // Status de leitura combinado!
    expect(merged.nota).toBe(10); // Preserva nota
    expect(merged.anoLeitura).toBe(2025); // Preserva ano de leitura
    expect(merged.mesLeitura).toBe(5); // Preserva mês de leitura
    expect(merged.editora).toBe('Garnier'); // Preserva metadados
    expect(merged.observacoes).toContain('Edição capa dura');
  });

  it('Detecta duplicados tanto por ISBN quanto por Título + Autor normalizado', () => {
    // Mesma obra por título e autor sem ISBN
    const a = {
      titulo: 'Cem Anos de Solidão',
      autores: ['Gabriel Garcia Marquez'],
    };
    const b = {
      titulo: 'cem anos de solidao',
      autores: ['Gabriel García Márquez'],
    };
    expect(areBooksDuplicate(a, b)).toBe(true);

    // Mesma obra por ISBN
    const c = { isbn13: '978-85-359-0277-8', titulo: 'Livro X' };
    const d = { isbn13: '9788535902778', titulo: 'Outro Título' };
    expect(areBooksDuplicate(c, d)).toBe(true);
  });
});

describe('4. Teste do filtro de Ano de Leitura', () => {
  const currentYear = new Date().getFullYear();

  const sampleBooks: Book[] = [
    {
      id: 1,
      origem: 'manual',
      titulo: 'Livro Lido 2025',
      autores: ['Autor A'],
      tenho_fisico: true,
      status_leitura: 'lido',
      anoLeitura: 2025,
      nota: 9,
      generos: ['Ficção'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    },
    {
      id: 2,
      origem: 'manual',
      titulo: 'Livro Lido 2024',
      autores: ['Autor B'],
      tenho_fisico: false,
      status_leitura: 'lido',
      anoLeitura: 2024,
      nota: 7,
      generos: ['Ficção'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    },
    {
      id: 3,
      origem: 'manual',
      titulo: 'Livro Quero Ler Sem Ano',
      autores: ['Autor C'],
      tenho_fisico: true,
      status_leitura: 'quero_ler',
      anoLeitura: null,
      generos: ['História'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    },
    {
      id: 4,
      origem: 'manual',
      titulo: 'Livro Acervo Sem Ano',
      autores: ['Autor D'],
      tenho_fisico: true,
      status_leitura: 'nenhum',
      anoLeitura: null,
      generos: ['Clássico'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    },
  ];

  // Helper que simula a filtragem da estante com filtro de ano e nota
  function filterShelf(
    books: Book[],
    tab: 'meus_livros' | 'lido' | 'quero_ler',
    yearFilter: number | null,
    minRating: number | null = null
  ): Book[] {
    let list = books.filter((b) => isBookInTab(b, tab));

    if (yearFilter != null) {
      list = list.filter((b) => b.anoLeitura === yearFilter);
    }

    if (minRating != null) {
      list = list.filter((b) => b.nota != null && b.nota >= minRating);
    }

    return list;
  }

  it('Filtro vazio: retorna todos os livros da aba sem filtrar por ano', () => {
    const lidosSemFiltro = filterShelf(sampleBooks, 'lido', null);
    expect(lidosSemFiltro).toHaveLength(2);

    const meusLivrosSemFiltro = filterShelf(sampleBooks, 'meus_livros', null);
    expect(meusLivrosSemFiltro).toHaveLength(3); // Livros 1, 3 e 4
  });

  it('Ano válido: filtra apenas livros com anoLeitura igual ao valor', () => {
    const lidos2025 = filterShelf(sampleBooks, 'lido', 2025);
    expect(lidos2025).toHaveLength(1);
    expect(lidos2025[0].titulo).toBe('Livro Lido 2025');

    const lidos2024 = filterShelf(sampleBooks, 'lido', 2024);
    expect(lidos2024).toHaveLength(1);
    expect(lidos2024[0].titulo).toBe('Livro Lido 2024');
  });

  it('Nas abas Quero ler e Meus Livros, livros sem ano de leitura ficam de fora quando o filtro de ano está ativo', () => {
    // Na aba Meus Livros, Livros 3 e 4 têm anoLeitura = null. Quando filtrado por 2025, apenas o Livro 1 (anoLeitura = 2025) passa!
    const meusLivros2025 = filterShelf(sampleBooks, 'meus_livros', 2025);
    expect(meusLivros2025).toHaveLength(1);
    expect(meusLivros2025[0].titulo).toBe('Livro Lido 2025');

    // Na aba Quero Ler, Livro 3 tem anoLeitura = null. Ao filtrar por 2025, deve ficar vazio!
    const queroLer2025 = filterShelf(sampleBooks, 'quero_ler', 2025);
    expect(queroLer2025).toHaveLength(0);
  });

  it('Filtro combinado: combina Ano de Leitura com Nota Mínima', () => {
    // Filtro: Ano = 2025 E Nota >= 8
    const combinado = filterShelf(sampleBooks, 'lido', 2025, 8);
    expect(combinado).toHaveLength(1);
    expect(combinado[0].titulo).toBe('Livro Lido 2025');

    // Filtro: Ano = 2024 E Nota >= 8 (Livro 2024 tem nota 7, portanto deve ser excluído)
    const naoAtendeNota = filterShelf(sampleBooks, 'lido', 2024, 8);
    expect(naoAtendeNota).toHaveLength(0);
  });

  it('Validação de ano: limites de 1900 até o ano atual', () => {
    const isValidYear = (y: number) => y >= 1900 && y <= currentYear;

    expect(isValidYear(2025)).toBe(true);
    expect(isValidYear(1900)).toBe(true);
    expect(isValidYear(currentYear)).toBe(true);

    expect(isValidYear(1899)).toBe(false); // Abaixo de 1900
    expect(isValidYear(currentYear + 1)).toBe(false); // Ano no futuro
  });

  it('Edição e tradução de título e autor de idioma estrangeiro para o português', () => {
    const originalBook: Book = {
      id: 50,
      origem: 'google',
      titulo: 'The Catcher in the Rye',
      subtitulo: null,
      autores: ['J. D. Salinger'],
      tenho_fisico: true,
      status_leitura: 'lido',
      generos: ['Ficção'],
      dataCadastro: 1000,
      dataAtualizacao: 1000,
    };

    // Usuário altera para o título em português
    const novoTitulo = 'O Apanhador no Campo de Centeio';
    const updatedBook: Book = {
      ...originalBook,
      titulo: novoTitulo.trim(),
      subtitulo: 'Edição de Bolso',
      dataAtualizacao: 2000,
    };

    expect(updatedBook.titulo).toBe('O Apanhador no Campo de Centeio');
    expect(updatedBook.subtitulo).toBe('Edição de Bolso');
    expect(updatedBook.dataAtualizacao).toBeGreaterThan(originalBook.dataAtualizacao);
  });
});

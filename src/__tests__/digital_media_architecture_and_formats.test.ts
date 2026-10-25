import { describe, it, expect, beforeEach } from 'vitest';
import {
  Book,
  getBookFormats,
  hasBookFormat,
  toggleBookFormat,
  updateBookFormats,
  VALID_BOOK_FORMATS,
  formatFormatNames,
  isBookInTab,
  getReadingStatusLabel,
  getStatusLabel,
} from '../types/book';
import {
  DigitalAttachmentDescriptor,
  EbookLastVisitedPosition,
  AudiobookLastVisitedPosition,
  ReadingCycle,
  DEFAULT_BACKUP_EXPORT_OPTIONS,
} from '../types/digitalMediaArchitecture';
import { BookRepository } from '../services/database/bookRepository';
import { DatabaseService } from '../services/database/databaseService';
import { BookStorage, migrateLegacyBooks } from '../services/storage';

describe('14. Preparação Arquitetural para Leitura Digital e Audiolivros', () => {
  let db: DatabaseService;
  let repo: BookRepository;

  beforeEach(async () => {
    db = DatabaseService.createTestInstance();
    await db.initialize();
    repo = new BookRepository(db);
    await repo.initialize();
  });

  describe('Regra 1: Classificação de formatos independente de arquivos digitais', () => {
    it('permite cadastrar livro como audiolivro ou e-book sem nenhum anexo ou arquivo', async () => {
      const bookData: Omit<Book, 'id'> = {
        origem: 'manual',
        titulo: 'Neuromancer (Audiolivro)',
        autores: ['William Gibson'],
        formato: 'audiolivro',
        formatos: ['audiolivro'],
        tenho_fisico: false,
        status_leitura: 'quero_ler',
        generos: ['Cyberpunk', 'Ficção Científica'],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      const saved = await repo.insert(bookData);
      expect(saved.id).toBeGreaterThan(0);
      expect(saved.formato).toBe('audiolivro');
      expect(saved.formatos).toEqual(['audiolivro']);
      expect(hasBookFormat(saved, 'audiolivro')).toBe(true);
      expect(hasBookFormat(saved, 'ebook')).toBe(false);
      expect(hasBookFormat(saved, 'fisico')).toBe(false);
    });

    it('permite múltiplos formatos simultâneos no mesmo livro (Físico + E-book + Audiolivro)', async () => {
      const bookData: Omit<Book, 'id'> = {
        origem: 'manual',
        titulo: 'Duna Edição Completa',
        autores: ['Frank Herbert'],
        formato: 'fisico',
        formatos: ['fisico', 'ebook', 'audiolivro'],
        tenho_fisico: true,
        status_leitura: 'lido',
        nota: 10,
        generos: ['Ficção Científica'],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      const saved = await repo.insert(bookData);
      const loaded = await repo.getById(saved.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.formatos).toContain('fisico');
      expect(loaded?.formatos).toContain('ebook');
      expect(loaded?.formatos).toContain('audiolivro');
      expect(hasBookFormat(loaded, 'fisico')).toBe(true);
      expect(hasBookFormat(loaded, 'ebook')).toBe(true);
      expect(hasBookFormat(loaded, 'audiolivro')).toBe(true);
      expect(loaded?.tenho_fisico).toBe(true);
    });
  });

  describe('Regra 2 & 3: Modelo bibliográfico sem bytes e descritores de anexo', () => {
    it('o modelo Book e a linha do banco não possuem colunas de bytes ou blob de arquivo', () => {
      const sampleBook: Book = {
        id: 1,
        origem: 'manual',
        titulo: 'Ensaio sobre a Cegueira',
        autores: ['José Saramago'],
        formato: 'ebook',
        formatos: ['ebook'],
        tenho_fisico: false,
        status_leitura: 'nenhum',
        generos: ['Ficção'],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      // Garante que não existem propriedades de bytes no Book
      expect((sampleBook as any).epubBytes).toBeUndefined();
      expect((sampleBook as any).pdfBytes).toBeUndefined();
      expect((sampleBook as any).audioBytes).toBeUndefined();
    });

    it('a entidade DigitalAttachmentDescriptor armazena apenas metadados e caminhos relativos fora do SQLite', () => {
      const ebookAttachment: DigitalAttachmentDescriptor = {
        id: 'att-ebook-001',
        bookId: 101,
        category: 'ebook',
        format: 'epub',
        fileName: 'ensaio_cegueira.epub',
        relativePath: 'media/ebooks/101-ensaio_cegueira.epub',
        fileSizeBytes: 2450890,
        mimeType: 'application/epub+zip',
        dataCriacao: Date.now(),
        dataAtualizacao: Date.now(),
      };

      expect(ebookAttachment.category).toBe('ebook');
      expect(ebookAttachment.format).toBe('epub');
      expect(ebookAttachment.relativePath).toContain('media/ebooks');
      expect((ebookAttachment as any).bytes).toBeUndefined();
    });
  });

  describe('Regra 4 & 5: Última posição visitada desacoplada do status de leitura', () => {
    it('as posições de e-book e audiolivro são entidades autônomas', () => {
      const ebookPos: EbookLastVisitedPosition = {
        attachmentId: 'att-ebook-001',
        bookId: 101,
        epubCfi: 'epubcfi(/6/4[chap03]!/4/2/10/2)',
        percentage: 42.5,
        updatedAt: Date.now(),
      };

      const audioPos: AudiobookLastVisitedPosition = {
        attachmentId: 'att-audio-001',
        bookId: 101,
        currentTimeSeconds: 1250,
        durationSeconds: 36000,
        playbackRate: 1.25,
        updatedAt: Date.now(),
      };

      expect(ebookPos.percentage).toBe(42.5);
      expect(audioPos.playbackRate).toBe(1.25);
      expect((ebookPos as any).status_leitura).toBeUndefined();
      expect((audioPos as any).status_leitura).toBeUndefined();
    });
  });

  describe('Regra 6: Ciclos de leitura e releituras sem apagar histórico', () => {
    it('estrutura ReadingCycle permite registrar múltiplas leituras concluídas e ciclos em andamento', () => {
      const leitura1: ReadingCycle = {
        id: 'cycle-1',
        bookId: 50,
        dataInicio: '2023-01-10',
        dataConclusao: '2023-01-25',
        anoConclusao: 2023,
        mesConclusao: 1,
        nota: 9,
        formatoLido: 'fisico',
        status: 'lido',
      };

      const releitura2: ReadingCycle = {
        id: 'cycle-2',
        bookId: 50,
        dataInicio: '2025-02-01',
        formatoLido: 'audiolivro',
        status: 'lendo',
      };

      expect(leitura1.status).toBe('lido');
      expect(releitura2.status).toBe('lendo');
      expect(leitura1.nota).toBe(9);
      expect(releitura2.formatoLido).toBe('audiolivro');
    });
  });

  describe('Regra 7: Compatibilidade retroativa e migração', () => {
    it('getBookFormats infere formato legado corretamente', () => {
      // Livro legado apenas com formato='ebook'
      const legacyEbook: Partial<Book> = { formato: 'ebook', tenho_fisico: false };
      expect(getBookFormats(legacyEbook)).toEqual(['ebook']);

      // Livro legado físico
      const legacyFisico: Partial<Book> = { formato: 'fisico', tenho_fisico: true };
      expect(getBookFormats(legacyFisico)).toEqual(['fisico']);

      // Livro sem nenhum campo de formato
      expect(getBookFormats(null)).toEqual(['fisico']);
    });

    it('migrateLegacyBooks preserva campos formato e tenho_fisico enquanto popula formatos', () => {
      const rawBooks = [
        {
          id: 1,
          titulo: 'O Hobbit',
          autores: ['J.R.R. Tolkien'],
          formato: 'ebook',
          tenho_fisico: false,
          status_leitura: 'lido',
        },
        {
          id: 2,
          titulo: 'Clean Code',
          autores: ['Robert C. Martin'],
          formato: 'fisico',
          tenho_fisico: true,
          status_leitura: 'nenhum',
        },
        {
          id: 3,
          titulo: 'Audiobook Castelo Animado',
          autores: ['Diana Wynne Jones'],
          formato: 'audiolivro',
          tenho_fisico: false,
          status_leitura: 'quero_ler',
        },
      ];

      const migrated = migrateLegacyBooks(rawBooks);
      expect(migrated[0].formato).toBe('ebook');
      expect(migrated[0].formatos).toEqual(['ebook']);
      expect(migrated[0].tenho_fisico).toBe(false);

      expect(migrated[1].formato).toBe('fisico');
      expect(migrated[1].formatos).toEqual(['fisico']);
      expect(migrated[1].tenho_fisico).toBe(true);

      expect(migrated[2].formato).toBe('audiolivro');
      expect(migrated[2].formatos).toEqual(['audiolivro']);
      expect(migrated[2].tenho_fisico).toBe(false);
    });

    it('formata nomes legíveis de múltiplos formatos na interface', () => {
      expect(formatFormatNames(['fisico'])).toBe('Livro Físico');
      expect(formatFormatNames(['ebook'])).toBe('E-book Digital');
      expect(formatFormatNames(['audiolivro'])).toBe('Audiolivro');
      expect(formatFormatNames(['fisico', 'ebook', 'audiolivro'])).toBe(
        'Livro Físico, E-book Digital, Audiolivro'
      );
    });

    it('rótulos de status suportam lendo e abandonado com total estabilidade', () => {
      expect(getReadingStatusLabel('lendo')).toBe('Lendo');
      expect(getReadingStatusLabel('abandonado')).toBe('Abandonado');
      expect(getStatusLabel('audiolivro')).toBe('Audiolivros');
      expect(getStatusLabel('lendo')).toBe('Lendo');
    });
  });

  describe('Regra 8: Preservação do backup padrão com opções futuras', () => {
    it('as opções padrão de backup mantêm os binários desligados por padrão', () => {
      expect(DEFAULT_BACKUP_EXPORT_OPTIONS.includeDatabase).toBe(true);
      expect(DEFAULT_BACKUP_EXPORT_OPTIONS.includeCovers).toBe(true);
      expect(DEFAULT_BACKUP_EXPORT_OPTIONS.includeEbookFiles).toBe(false);
      expect(DEFAULT_BACKUP_EXPORT_OPTIONS.includeAudiobookFiles).toBe(false);
    });
  });

  describe('Consultas e Abas da Estante com Audiolivro', () => {
    it('livro com formato audiolivro aparece na aba "todos" e respeita status de leitura', () => {
      const audioBook: Book = {
        id: 77,
        origem: 'manual',
        titulo: 'Sapiens Audiolivro',
        autores: ['Yuval Noah Harari'],
        formato: 'audiolivro',
        formatos: ['audiolivro'],
        tenho_fisico: false,
        status_leitura: 'quero_ler',
        generos: ['História'],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      expect(isBookInTab(audioBook, 'todos')).toBe(true);
      expect(isBookInTab(audioBook, 'quero_ler')).toBe(true);
      expect(isBookInTab(audioBook, 'meus_livros')).toBe(false);
      expect(isBookInTab(audioBook, 'ebook')).toBe(false);
    });

    it('livro híbrido com posse física e e-book aparece tanto em Meus Livros quanto em E-books', () => {
      const hybridBook: Book = {
        id: 88,
        origem: 'manual',
        titulo: '1984 Híbrido',
        autores: ['George Orwell'],
        formato: 'fisico',
        formatos: ['fisico', 'ebook'],
        tenho_fisico: true,
        status_leitura: 'lido',
        generos: ['Distopia'],
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      expect(isBookInTab(hybridBook, 'todos')).toBe(true);
      expect(isBookInTab(hybridBook, 'meus_livros')).toBe(true);
      expect(isBookInTab(hybridBook, 'ebook')).toBe(true);
      expect(isBookInTab(hybridBook, 'lido')).toBe(true);
    });

    it('calcula estatísticas incluindo totalAudiolivros', () => {
      const sampleList: Book[] = [
        {
          id: 1,
          origem: 'manual',
          titulo: 'Livro 1',
          autores: ['Autor A'],
          formato: 'fisico',
          formatos: ['fisico'],
          tenho_fisico: true,
          status_leitura: 'lido',
          generos: ['Geral'],
          dataCadastro: Date.now(),
          dataAtualizacao: Date.now(),
        },
        {
          id: 2,
          origem: 'manual',
          titulo: 'Livro 2',
          autores: ['Autor B'],
          formato: 'ebook',
          formatos: ['ebook'],
          tenho_fisico: false,
          status_leitura: 'quero_ler',
          generos: ['Geral'],
          dataCadastro: Date.now(),
          dataAtualizacao: Date.now(),
        },
        {
          id: 3,
          origem: 'manual',
          titulo: 'Livro 3',
          autores: ['Autor C'],
          formato: 'audiolivro',
          formatos: ['audiolivro'],
          tenho_fisico: false,
          status_leitura: 'quero_ler',
          generos: ['Geral'],
          dataCadastro: Date.now(),
          dataAtualizacao: Date.now(),
        },
      ];

      const stats = BookStorage.calculateStats(sampleList);
      expect(stats.totalFisicos).toBe(1);
      expect(stats.totalEbooks).toBe(1);
      expect(stats.totalAudiolivros).toBe(1);
    });

    it('adicionar da busca com targetAction audiolivro atribui corretamente formato e formatos', () => {
      const searchedBook = {
        origem: 'google' as const,
        idExterno: 'ext-aud-1',
        titulo: 'O Pequeno Príncipe em Áudio',
        autores: ['Antoine de Saint-Exupéry'],
        generos: ['Clássico'],
      };

      const initialFormat = 'audiolivro';
      const initialFormats = ['audiolivro'] as const;

      const newBook: Book = {
        id: 0,
        origem: searchedBook.origem,
        idExterno: searchedBook.idExterno,
        titulo: searchedBook.titulo,
        autores: searchedBook.autores,
        generos: searchedBook.generos,
        formato: initialFormat,
        formatos: [...initialFormats],
        tenho_fisico: false,
        status_leitura: 'nenhum',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      expect(newBook.formato).toBe('audiolivro');
      expect(newBook.formatos).toEqual(['audiolivro']);
      expect(hasBookFormat(newBook, 'audiolivro')).toBe(true);
      expect(hasBookFormat(newBook, 'ebook')).toBe(false);
      expect(hasBookFormat(newBook, 'fisico')).toBe(false);
    });

    it('atualização de obra existente para audiolivro preserva outros formatos sem duplicar', () => {
      const existing: Book = {
        id: 42,
        origem: 'manual',
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        generos: ['Literatura Brasileira'],
        formato: 'ebook',
        formatos: ['ebook'],
        tenho_fisico: false,
        status_leitura: 'lido',
        dataCadastro: Date.now(),
        dataAtualizacao: Date.now(),
      };

      const currentFormats = getBookFormats(existing);
      const nextFormats = currentFormats.includes('audiolivro')
        ? currentFormats
        : [...currentFormats, 'audiolivro' as const];

      const updated: Book = {
        ...existing,
        formato: 'audiolivro',
        formatos: nextFormats,
        dataAtualizacao: Date.now(),
      };

      expect(updated.formato).toBe('audiolivro');
      expect(updated.formatos).toEqual(['ebook', 'audiolivro']);
      expect(hasBookFormat(updated, 'audiolivro')).toBe(true);
      expect(hasBookFormat(updated, 'ebook')).toBe(true);
    });
  });

  describe('15. Padronização da Seleção de Formatos (Físico, E-book, Audiolivro)', () => {
    describe('Tabela da Verdade Canônica de Toggle (toggleBookFormat)', () => {
      it('VALID_BOOK_FORMATS contém exatamente os 3 formatos suportados', () => {
        expect(VALID_BOOK_FORMATS).toEqual(['fisico', 'ebook', 'audiolivro']);
      });

      it('Físico + clique em E-book -> Físico + E-book', () => {
        const result = toggleBookFormat(['fisico'], 'ebook');
        expect(result).toEqual(['fisico', 'ebook']);
      });

      it('Físico + E-book + clique em Audiolivro -> Físico + E-book + Audiolivro', () => {
        const result = toggleBookFormat(['fisico', 'ebook'], 'audiolivro');
        expect(result).toEqual(['fisico', 'ebook', 'audiolivro']);
      });

      it('Físico + E-book + Audiolivro + clique em Físico -> E-book + Audiolivro', () => {
        const result = toggleBookFormat(['fisico', 'ebook', 'audiolivro'], 'fisico');
        expect(result).toEqual(['ebook', 'audiolivro']);
      });

      it('E-book + Audiolivro + clique em E-book -> Audiolivro', () => {
        const result = toggleBookFormat(['ebook', 'audiolivro'], 'ebook');
        expect(result).toEqual(['audiolivro']);
      });

      it('Audiolivro (único) + clique em Audiolivro -> permanece Audiolivro (mínimo 1 formato)', () => {
        const result = toggleBookFormat(['audiolivro'], 'audiolivro');
        expect(result).toEqual(['audiolivro']);
      });

      it('Físico (único) + clique em Físico -> permanece Físico (mínimo 1 formato)', () => {
        const result = toggleBookFormat(['fisico'], 'fisico');
        expect(result).toEqual(['fisico']);
      });

      it('E-book + clique em Físico -> E-book + Físico', () => {
        const result = toggleBookFormat(['ebook'], 'fisico');
        expect(result).toEqual(['ebook', 'fisico']);
      });

      it('ignora formatos inválidos e sanitiza duplicatas mantendo pelo menos um válido', () => {
        const result = toggleBookFormat(['fisico', 'fisico' as any, 'invalido' as any], 'ebook');
        expect(result).toEqual(['fisico', 'ebook']);
      });
    });

    describe('Sincronização atômica do Book com updateBookFormats', () => {
      it('atualiza tenho_fisico e formato legado proporcionalmente à seleção', () => {
        const initialBook: Book = {
          id: 50,
          origem: 'manual',
          titulo: 'Grande Sertão: Veredas',
          autores: ['João Guimarães Rosa'],
          generos: ['Romance'],
          formato: 'fisico',
          formatos: ['fisico'],
          tenho_fisico: true,
          status_leitura: 'lido',
          nota: 10,
          anoLeitura: 2024,
          mesLeitura: 5,
          observacoes: 'Edição comemorativa',
          dataCadastro: 1000,
          dataAtualizacao: 1000,
        };

        // 1. Ativa E-book
        const withEbook = updateBookFormats(initialBook, 'ebook');
        expect(withEbook.formatos).toEqual(['fisico', 'ebook']);
        expect(withEbook.tenho_fisico).toBe(true);
        expect(withEbook.formato).toBe('ebook');
        expect(withEbook.titulo).toBe(initialBook.titulo);
        expect(withEbook.nota).toBe(10);
        expect(withEbook.anoLeitura).toBe(2024);

        // 2. Ativa Audiolivro
        const withAudio = updateBookFormats(withEbook, 'audiolivro');
        expect(withAudio.formatos).toEqual(['fisico', 'ebook', 'audiolivro']);
        expect(withAudio.tenho_fisico).toBe(true);
        expect(withAudio.formato).toBe('audiolivro');

        // 3. Remove Físico
        const withoutFisico = updateBookFormats(withAudio, 'fisico');
        expect(withoutFisico.formatos).toEqual(['ebook', 'audiolivro']);
        expect(withoutFisico.tenho_fisico).toBe(false); // posse física desativada de forma sincronizada!
        expect(['ebook', 'audiolivro']).toContain(withoutFisico.formato); // formato legado aponta para um dos ativos

        // 4. Remove E-book (sobra Audiolivro)
        const onlyAudio = updateBookFormats(withoutFisico, 'ebook');
        expect(onlyAudio.formatos).toEqual(['audiolivro']);
        expect(onlyAudio.tenho_fisico).toBe(false);
        expect(onlyAudio.formato).toBe('audiolivro');

        // 5. Tenta remover Audiolivro (deve manter Audiolivro)
        const attemptRemoveLast = updateBookFormats(onlyAudio, 'audiolivro');
        expect(attemptRemoveLast.formatos).toEqual(['audiolivro']);
        expect(attemptRemoveLast.tenho_fisico).toBe(false);
        expect(attemptRemoveLast.formato).toBe('audiolivro');
      });

      it('cliques rápidos e múltiplos convergem para o mesmo estado canônico', () => {
        let current: Book = {
          id: 99,
          origem: 'manual',
          titulo: 'Ensaio Sobre a Cegueira',
          autores: ['José Saramago'],
          generos: ['Ficção'],
          formato: 'fisico',
          formatos: ['fisico'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          dataCadastro: 2000,
          dataAtualizacao: 2000,
        };

        // Simula cliques sucessivos rápidos: ativa ebook, ativa audiolivro, remove fisico
        current = updateBookFormats(current, 'ebook');
        current = updateBookFormats(current, 'audiolivro');
        current = updateBookFormats(current, 'fisico');

        expect(current.formatos).toEqual(['ebook', 'audiolivro']);
        expect(current.tenho_fisico).toBe(false);
        expect(getBookFormats(current)).toEqual(['ebook', 'audiolivro']);
        expect(hasBookFormat(current, 'fisico')).toBe(false);
        expect(hasBookFormat(current, 'ebook')).toBe(true);
        expect(hasBookFormat(current, 'audiolivro')).toBe(true);
      });
    });

    describe('Sincronização entre telas (Detalhes, Editar e Explorar)', () => {
      it('obra adicionada na busca com 3 formatos é persistida e lida com os 3 formatos', async () => {
        const bookToAdd: Book = {
          id: 0,
          origem: 'google',
          idExterno: 'ext-trio',
          titulo: 'O Nome da Rosa',
          autores: ['Umberto Eco'],
          generos: ['Mistério'],
          formato: 'fisico',
          formatos: ['fisico', 'ebook', 'audiolivro'],
          tenho_fisico: true,
          status_leitura: 'nenhum',
          dataCadastro: Date.now(),
          dataAtualizacao: Date.now(),
        };

        const saved = await repo.insert(bookToAdd);
        expect(saved.id).toBeGreaterThan(0);

        const loaded = await repo.getById(saved.id);
        expect(loaded).not.toBeNull();
        expect(loaded!.formatos).toEqual(['fisico', 'ebook', 'audiolivro']);
        expect(getBookFormats(loaded)).toEqual(['fisico', 'ebook', 'audiolivro']);
        expect(loaded!.tenho_fisico).toBe(true);

        // Simulando abertura em Detalhes da Obra e remoção de E-book
        const updatedInDetails = updateBookFormats(loaded!, 'ebook');
        const savedAfterDetails = await repo.update(updatedInDetails);
        expect(savedAfterDetails.formatos).toEqual(['fisico', 'audiolivro']);

        // Simulando abertura subsequente em Editar Obra & Leitura
        const loadedForEdit = await repo.getById(savedAfterDetails.id);
        const formatosInEditModal = getBookFormats(loadedForEdit);
        expect(formatosInEditModal).toEqual(['fisico', 'audiolivro']);
        expect(formatosInEditModal.includes('ebook')).toBe(false);
      });
    });
  });
});

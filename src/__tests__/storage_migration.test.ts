import { describe, it, expect, beforeEach } from 'vitest';
import {
  BookStorage,
  migrateLegacyBooks,
  STORAGE_KEY_BOOKS,
  STORAGE_KEY_SCHEMA_VERSION,
  STORAGE_KEY_BACKUP_PRE_MIGRATION,
} from '../services/storage';
import { Book } from '../types/book';

// Mock simples e fiel do LocalStorage para ambiente de teste Node
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
Object.defineProperty(globalThis, 'localStorage', {
  value: mockStorage,
  writable: true,
});

describe('Fase 2: Testes de Integridade de Migração de Dados e Persistência (v1 -> v2)', () => {
  beforeEach(() => {
    mockStorage.clear();
  });

  it('1. Migra livros do Schema v1 (legado com categoria "meus_livros") para Schema v2 com tenho_fisico=true', () => {
    const rawLegacyBooks = [
      {
        id: 1,
        titulo: 'O Pequeno Príncipe',
        autores: ['Antoine de Saint-Exupéry'],
        categoria: 'meus_livros',
        isbn13: '9788522005239',
        paginas: 96,
        capaUrl: 'https://images.example.com/cover1.jpg',
      },
    ];

    const migrated = migrateLegacyBooks(rawLegacyBooks as any);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].titulo).toBe('O Pequeno Príncipe');
    expect(migrated[0].tenho_fisico).toBe(true);
    expect(migrated[0].status_leitura).toBe('nenhum');
    expect(migrated[0].capaUrl).toBe('https://images.example.com/cover1.jpg');
    expect(migrated[0].formato).toBe('fisico');
  });

  it('2. Migra livros com categoria "lidos" para tenho_fisico=false e status_leitura="lido"', () => {
    const rawLegacyBooks = [
      {
        id: 2,
        titulo: '1984',
        autores: ['George Orwell'],
        categoria: 'lidos',
        nota: 10,
        anoLeitura: 2024,
      },
    ];

    const migrated = migrateLegacyBooks(rawLegacyBooks as any);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].tenho_fisico).toBe(false);
    expect(migrated[0].status_leitura).toBe('lido');
    expect(migrated[0].nota).toBe(10);
    expect(migrated[0].anoLeitura).toBe(2024);
  });

  it('3. Mescla registros duplicados (livro em "meus_livros" e "lidos") sem perder avaliações ou notas', () => {
    const rawBooksWithDuplicate = [
      {
        id: 10,
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        categoria: 'meus_livros',
        isbn13: '9788594318602',
        capaUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      },
      {
        id: 11,
        titulo: 'Dom Casmurro',
        autores: ['Machado de Assis'],
        categoria: 'lidos',
        isbn13: '9788594318602',
        nota: 9,
        anoLeitura: 2023,
        observacoes: 'Excelente releitura clássica',
      },
    ];

    const migrated = migrateLegacyBooks(rawBooksWithDuplicate as any);
    expect(migrated).toHaveLength(1);
    const book = migrated[0];
    expect(book.titulo).toBe('Dom Casmurro');
    expect(book.tenho_fisico).toBe(true);
    expect(book.status_leitura).toBe('lido');
    expect(book.nota).toBe(9);
    expect(book.anoLeitura).toBe(2023);
    expect(book.observacoes).toBe('Excelente releitura clássica');
    expect(book.capaUrl).toContain('data:image/png;base64');
  });

  it('4. Salva backup preventivo no localStorage antes da migração em STORAGE_KEY_BACKUP_PRE_MIGRATION', () => {
    const legacyRawJson = JSON.stringify([
      {
        id: 50,
        titulo: 'A Metamorfose',
        autores: ['Franz Kafka'],
        categoria: 'meus_livros',
      },
    ]);

    mockStorage.setItem(STORAGE_KEY_BOOKS, legacyRawJson);
    mockStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, '1');

    const loaded = BookStorage.loadBooks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].tenho_fisico).toBe(true);

    // Verifica que o backup foi gerado exatamente com o payload original
    const backup = mockStorage.getItem(STORAGE_KEY_BACKUP_PRE_MIGRATION);
    expect(backup).toBe(legacyRawJson);
    expect(mockStorage.getItem(STORAGE_KEY_SCHEMA_VERSION)).toBe('2');
  });

  it('5. Preserva capas customizadas em Data URL (base64) e URLs HTTP/HTTPS sem truncar', () => {
    const customDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...custom-cover-data...';
    const rawBooks = [
      {
        id: 99,
        titulo: 'Livro com Capa da Galeria',
        autores: ['Autor Local'],
        tenho_fisico: true,
        status_leitura: 'nenhum',
        capaUrl: customDataUrl,
      },
    ];

    const migrated = migrateLegacyBooks(rawBooks as any);
    expect(migrated[0].capaUrl).toBe(customDataUrl);
  });

  it('6. Nunca apaga livros pré-existentes na inicialização do aplicativo', () => {
    const existingBooks: Book[] = [
      {
        id: 777,
        origem: 'manual',
        titulo: 'Livro Valioso do Usuário',
        autores: ['Autor Importante'],
        tenho_fisico: true,
        status_leitura: 'nenhum',
        generos: ['Memórias'],
        dataCadastro: 1234567,
        dataAtualizacao: 1234567,
      },
    ];

    mockStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(existingBooks));
    mockStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, '2');

    const loaded = BookStorage.loadBooks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].titulo).toBe('Livro Valioso do Usuário');
  });
});

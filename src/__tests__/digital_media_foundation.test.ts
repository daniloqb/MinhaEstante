import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService } from '../services/database/databaseService';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../services/database/readerPositionRepository';
import { ReadingSessionRepository } from '../services/database/readingSessionRepository';
import { ReadingProgressRepository } from '../services/database/readingProgressRepository';
import { Book } from '../types/book';

describe('MinhaEstante 2.0 - Fase 1: Fundação de Dados e Arquitetura', () => {
  let db: DatabaseService;
  let bookRepo: BookRepository;
  let attachmentRepo: BookAttachmentRepository;
  let positionRepo: ReaderPositionRepository;
  let sessionRepo: ReadingSessionRepository;
  let progressRepo: ReadingProgressRepository;

  let testBook: Book;

  beforeEach(async () => {
    db = DatabaseService.createTestInstance();
    await db.initialize();

    bookRepo = new BookRepository(db);
    attachmentRepo = new BookAttachmentRepository(db);
    positionRepo = new ReaderPositionRepository(db);
    sessionRepo = new ReadingSessionRepository(db);
    progressRepo = new ReadingProgressRepository(db);

    // Cria livro base de teste
    testBook = await bookRepo.insert({
      titulo: 'Dom Casmurro',
      autores: ['Machado de Assis'],
      origem: 'manual',
      formato: 'fisico',
      formatos: ['fisico', 'ebook', 'audiolivro'],
      tenho_fisico: true,
      status_leitura: 'quero_ler',
      dataCadastro: 1000,
      dataAtualizacao: 1000,
      generos: ['Romance'],
    });
  });

  // ==========================================
  // PARTE A — TESTES DE BOOK ATTACHMENT
  // ==========================================
  describe('1. BookAttachment (Anexos Digitais)', () => {
    it('1.1. Cria vínculo EPUB válido', async () => {
      const att = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'dom_casmurro.epub',
        mimeType: 'application/epub+zip',
        sizeBytes: 1542000,
        storageProvider: 'saf_document',
        storageReference: 'content://com.android.providers.media.documents/document/1234',
        checksum: 'sha256-abc123epub',
      });

      expect(att.id).toBeTruthy();
      expect(att.bookId).toBe(testBook.id);
      expect(att.type).toBe('ebook');
      expect(att.format).toBe('epub');
      expect(att.filename).toBe('dom_casmurro.epub');
      expect(att.sizeBytes).toBe(1542000);
    });

    it('1.2. Cria vínculo PDF válido', async () => {
      const att = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'pdf',
        filename: 'dom_casmurro.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 4200000,
        storageProvider: 'opfs',
        storageReference: '/books/pdf/dom_casmurro.pdf',
      });

      expect(att.format).toBe('pdf');
      expect(att.type).toBe('ebook');
    });

    it('1.3. Cria vínculo MP3 válido', async () => {
      const att = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'mp3',
        filename: 'dom_casmurro_audio.mp3',
        mimeType: 'audio/mpeg',
        sizeBytes: 85000000,
        storageProvider: 'saf_document',
        storageReference: 'content://audio/1',
      });

      expect(att.format).toBe('mp3');
      expect(att.type).toBe('audiobook');
    });

    it('1.4. Cria vínculo M4A válido', async () => {
      const att = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'm4a',
        filename: 'dom_casmurro.m4a',
        mimeType: 'audio/mp4',
        sizeBytes: 72000000,
        storageProvider: 'saf_document',
        storageReference: 'content://audio/2',
      });

      expect(att.format).toBe('m4a');
    });

    it('1.5. Cria vínculo M4B válido', async () => {
      const att = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'm4b',
        filename: 'dom_casmurro_chapters.m4b',
        mimeType: 'audio/x-m4b',
        sizeBytes: 95000000,
        storageProvider: 'saf_document',
        storageReference: 'content://audio/3',
      });

      expect(att.format).toBe('m4b');
    });

    it('1.6. Associa e-book e audiolivro ao mesmo livro simultaneamente (coexistência)', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'casmurro.epub',
        sizeBytes: 1000,
        storageProvider: 'web_local',
        storageReference: 'ref-epub',
      });

      const audio = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'mp3',
        filename: 'casmurro.mp3',
        sizeBytes: 5000,
        storageProvider: 'web_local',
        storageReference: 'ref-audio',
      });

      const all = await attachmentRepo.getByBookId(testBook.id);
      expect(all.length).toBe(2);
      expect(all.some((a) => a.type === 'ebook')).toBe(true);
      expect(all.some((a) => a.type === 'audiobook')).toBe(true);
      expect(ebook.id).not.toBe(audio.id);
    });

    it('1.7. Impede dois e-books simultâneos para a mesma obra', async () => {
      await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'versao1.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-1',
      });

      await expect(
        attachmentRepo.create({
          bookId: testBook.id,
          type: 'ebook',
          format: 'pdf',
          filename: 'versao2.pdf',
          sizeBytes: 200,
          storageProvider: 'web_local',
          storageReference: 'ref-2',
        })
      ).rejects.toThrow(/já possui um anexo do tipo 'ebook'/i);
    });

    it('1.8. Impede dois audiolivros simultâneos para a mesma obra', async () => {
      await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'mp3',
        filename: 'audio1.mp3',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-1',
      });

      await expect(
        attachmentRepo.create({
          bookId: testBook.id,
          type: 'audiobook',
          format: 'm4b',
          filename: 'audio2.m4b',
          sizeBytes: 200,
          storageProvider: 'web_local',
          storageReference: 'ref-2',
        })
      ).rejects.toThrow(/já possui um anexo do tipo 'audiobook'/i);
    });

    it('1.9. Impede combinações inválidas de tipo e formato', async () => {
      // ebook com mp3
      await expect(
        attachmentRepo.create({
          bookId: testBook.id,
          type: 'ebook',
          format: 'mp3' as any,
          filename: 'invalido.mp3',
          sizeBytes: 100,
          storageProvider: 'web_local',
          storageReference: 'ref-x',
        })
      ).rejects.toThrow(/combinação inválida/i);

      // audiobook com epub
      await expect(
        attachmentRepo.create({
          bookId: testBook.id,
          type: 'audiobook',
          format: 'epub' as any,
          filename: 'invalido.epub',
          sizeBytes: 100,
          storageProvider: 'web_local',
          storageReference: 'ref-y',
        })
      ).rejects.toThrow(/combinação inválida/i);
    });

    it('1.10. Rejeita referência a livro inexistente', async () => {
      await expect(
        attachmentRepo.create({
          bookId: 999999, // livro que não existe
          type: 'ebook',
          format: 'epub',
          filename: 'fantasma.epub',
          sizeBytes: 100,
          storageProvider: 'web_local',
          storageReference: 'ref-ghost',
        })
      ).rejects.toThrow(/não encontrado/i);
    });
  });

  // ==========================================
  // PARTE B — TESTES DE READER POSITION
  // ==========================================
  describe('2. ReaderPosition (Posição de Leitura e Reprodução)', () => {
    it('2.1. Salva e recupera posição EPUB CFI', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'obra.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-epub',
      });

      const pos = await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'epubcfi(/6/4[chap01]!/4/2/10[p01]/1:0)',
      });

      expect(pos.id).toBeTruthy();
      expect(pos.attachmentId).toBe(ebook.id);
      expect(pos.locationType).toBe('epub_cfi');
      expect(pos.location).toBe('epubcfi(/6/4[chap01]!/4/2/10[p01]/1:0)');

      const retrieved = await positionRepo.getByAttachmentId(ebook.id);
      expect(retrieved?.location).toBe('epubcfi(/6/4[chap01]!/4/2/10[p01]/1:0)');
    });

    it('2.2. Salva e recupera página PDF', async () => {
      const pdf = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'pdf',
        filename: 'manual.pdf',
        sizeBytes: 500,
        storageProvider: 'web_local',
        storageReference: 'ref-pdf',
      });

      const pos = await positionRepo.savePosition({
        attachmentId: pdf.id,
        locationType: 'pdf_page',
        location: '42',
      });

      expect(pos.locationType).toBe('pdf_page');
      expect(pos.location).toBe('42');
    });

    it('2.3. Salva e recupera posição de áudio em segundos', async () => {
      const audio = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'mp3',
        filename: 'audio.mp3',
        sizeBytes: 1000,
        storageProvider: 'web_local',
        storageReference: 'ref-audio',
      });

      const pos = await positionRepo.savePosition({
        attachmentId: audio.id,
        locationType: 'audio_seconds',
        location: '3645.75',
      });

      expect(pos.locationType).toBe('audio_seconds');
      expect(pos.location).toBe('3645.75');
    });

    it('2.4. Atualiza uma posição existente preservando relação 1:1 por anexo', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'obra.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-epub',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-capitulo-1',
      });

      // Segunda chamada atualiza a mesma posição
      const updated = await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-capitulo-5',
      });

      expect(updated.location).toBe('cfi-capitulo-5');
      const count = await positionRepo.count();
      expect(count).toBe(1);
    });

    it('2.5. Preserva posições independentes para e-book e audiolivro do mesmo livro', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'livro.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-1',
      });

      const audio = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'audiobook',
        format: 'mp3',
        filename: 'livro.mp3',
        sizeBytes: 500,
        storageProvider: 'web_local',
        storageReference: 'ref-2',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'epubcfi(/6/2[cap1])',
      });

      await positionRepo.savePosition({
        attachmentId: audio.id,
        locationType: 'audio_seconds',
        location: '1250',
      });

      const ebookPos = await positionRepo.getByAttachmentId(ebook.id);
      const audioPos = await positionRepo.getByAttachmentId(audio.id);

      expect(ebookPos?.location).toBe('epubcfi(/6/2[cap1])');
      expect(audioPos?.location).toBe('1250');
      expect(ebookPos?.id).not.toBe(audioPos?.id);
    });

    it('2.6. Recupera a posição corretamente do repositório', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'obra.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-epub',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-teste',
      });

      const found = await positionRepo.getByAttachmentId(ebook.id);
      expect(found).not.toBeNull();
      expect(found?.location).toBe('cfi-teste');
    });

    it('2.7. Rejeita posições inválidas ou incompatíveis com o formato do anexo', async () => {
      const pdf = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'pdf',
        filename: 'doc.pdf',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-pdf',
      });

      // Página negativa é inválida
      await expect(
        positionRepo.savePosition({
          attachmentId: pdf.id,
          locationType: 'pdf_page',
          location: '-5',
        })
      ).rejects.toThrow(/localização inválida/i);

      // locationType incompatível (audio_seconds para PDF)
      await expect(
        positionRepo.savePosition({
          attachmentId: pdf.id,
          locationType: 'audio_seconds',
          location: '120',
        })
      ).rejects.toThrow(/tipo de localização incompatível/i);
    });

    it('2.8. Garante que salvar posição NÃO altere o status_leitura do livro', async () => {
      expect(testBook.status_leitura).toBe('quero_ler');

      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'obra.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-epub',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-pos-1',
      });

      // Recarrega livro do banco e verifica
      const reloaded = await bookRepo.getById(testBook.id);
      expect(reloaded?.status_leitura).toBe('quero_ler');
    });
  });

  // ==========================================
  // PARTE C — TESTES DE READING SESSION
  // ==========================================
  describe('3. ReadingSession (Acompanhamento Deliberado de Leitura)', () => {
    it('3.1. Cria e recupera sessão ativa explicitamente', async () => {
      const session = await sessionRepo.create({
        bookId: testBook.id,
      });

      expect(session.id).toBeTruthy();
      expect(session.bookId).toBe(testBook.id);
      expect(session.status).toBe('active');
      expect(session.startedAt).toBeGreaterThan(0);
      expect(session.completedAt).toBeNull();
      expect(session.abandonedAt).toBeNull();

      const active = await sessionRepo.getActiveSession(testBook.id);
      expect(active?.id).toBe(session.id);
    });

    it('3.2. Conclui uma sessão de leitura', async () => {
      const session = await sessionRepo.create({ bookId: testBook.id });
      const completed = await sessionRepo.complete(session.id, 1700000000000);

      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBe(1700000000000);

      const active = await sessionRepo.getActiveSession(testBook.id);
      expect(active).toBeNull(); // Não há mais sessão ativa
    });

    it('3.3. Abandona uma sessão de leitura', async () => {
      const session = await sessionRepo.create({ bookId: testBook.id });
      const abandoned = await sessionRepo.abandon(session.id, 1700000005000);

      expect(abandoned.status).toBe('abandoned');
      expect(abandoned.abandonedAt).toBe(1700000005000);

      const active = await sessionRepo.getActiveSession(testBook.id);
      expect(active).toBeNull();
    });

    it('3.4. Permite iniciar nova releitura após conclusão da primeira leitura', async () => {
      // 1ª Leitura
      const firstSession = await sessionRepo.create({ bookId: testBook.id });
      await sessionRepo.complete(firstSession.id);

      // Releitura (2ª Sessão deliberada)
      const secondSession = await sessionRepo.create({ bookId: testBook.id });
      expect(secondSession.id).not.toBe(firstSession.id);
      expect(secondSession.status).toBe('active');

      const history = await sessionRepo.getHistoryByBookId(testBook.id);
      expect(history.length).toBe(2);
      expect(history.some((s) => s.id === firstSession.id && s.status === 'completed')).toBe(true);
      expect(history.some((s) => s.id === secondSession.id && s.status === 'active')).toBe(true);
    });

    it('3.5. Preserva sessões históricas completas sem sobrescrever dados anteriores', async () => {
      // 1ª sessão concluída em 2024
      const s1 = await sessionRepo.create({ bookId: testBook.id, startedAt: 1000 });
      await sessionRepo.complete(s1.id, 2000);

      // 2ª sessão abandonada em 2025
      const s2 = await sessionRepo.create({ bookId: testBook.id, startedAt: 3000 });
      await sessionRepo.abandon(s2.id, 4000);

      // 3ª sessão ativa em 2026
      const s3 = await sessionRepo.create({ bookId: testBook.id, startedAt: 5000 });

      const history = await sessionRepo.getHistoryByBookId(testBook.id);
      expect(history.length).toBe(3);

      const foundS1 = history.find((s) => s.id === s1.id);
      expect(foundS1?.status).toBe('completed');
      expect(foundS1?.completedAt).toBe(2000);

      const foundS2 = history.find((s) => s.id === s2.id);
      expect(foundS2?.status).toBe('abandoned');
      expect(foundS2?.abandonedAt).toBe(4000);

      const foundS3 = history.find((s) => s.id === s3.id);
      expect(foundS3?.status).toBe('active');
    });

    it('3.6. Impede duas sessões simultaneamente ativas para a mesma obra', async () => {
      await sessionRepo.create({ bookId: testBook.id });

      // Tentativa de criar segunda sessão ativa sem concluir a primeira
      await expect(sessionRepo.create({ bookId: testBook.id })).rejects.toThrow(
        /já existe uma sessão de leitura ativa/i
      );
    });

    it('3.7. Permite acompanhamento de livro físico sem nenhum anexo digital', async () => {
      // O livro de teste não possui anexos criados ainda
      const attachments = await attachmentRepo.getByBookId(testBook.id);
      expect(attachments.length).toBe(0);

      const physicalSession = await sessionRepo.create({ bookId: testBook.id });
      expect(physicalSession.status).toBe('active');

      const progress = await progressRepo.saveProgress({
        sessionId: physicalSession.id,
        unit: 'pages',
        currentValue: 120,
        totalValue: 350,
        source: 'manual',
      });

      expect(progress.unit).toBe('pages');
      expect(progress.currentValue).toBe(120);
      expect(progress.totalValue).toBe(350);
    });

    it('3.8. Garante que criação da sessão seja ação explícita (anexar arquivo não cria sessão)', async () => {
      // Anexa e-book
      await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'livro.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-1',
      });

      // Nenhuma sessão deve ter sido criada automaticamente
      const active = await sessionRepo.getActiveSession(testBook.id);
      expect(active).toBeNull();
      const history = await sessionRepo.getHistoryByBookId(testBook.id);
      expect(history.length).toBe(0);
    });
  });

  // ==========================================
  // PARTE D — TESTES DE READING PROGRESS
  // ==========================================
  describe('4. ReadingProgress (Progresso de Leitura Acompanhado)', () => {
    let activeSession: any;

    beforeEach(async () => {
      activeSession = await sessionRepo.create({ bookId: testBook.id });
    });

    it('4.1. Registra e recupera página atual de livro físico', async () => {
      const p = await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'pages',
        currentValue: 45,
        totalValue: 200,
        source: 'manual',
      });

      expect(p.unit).toBe('pages');
      expect(p.currentValue).toBe(45);
      expect(p.totalValue).toBe(200);
      expect(p.source).toBe('manual');

      const found = await progressRepo.getBySessionId(activeSession.id);
      expect(found?.currentValue).toBe(45);
    });

    it('4.2. Registra progresso percentual de e-book', async () => {
      const p = await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'percentage',
        currentValue: 68.5,
        totalValue: 100,
        source: 'reader_device',
      });

      expect(p.unit).toBe('percentage');
      expect(p.currentValue).toBe(68.5);
      expect(p.source).toBe('reader_device');
    });

    it('4.3. Registra tempo acompanhado de audiolivro em segundos', async () => {
      const p = await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'seconds',
        currentValue: 1800, // 30 min
        totalValue: 7200, // 2 horas
        source: 'reader_device',
      });

      expect(p.unit).toBe('seconds');
      expect(p.currentValue).toBe(1800);
      expect(p.totalValue).toBe(7200);
    });

    it('4.4. Rejeita valores negativos de progresso', async () => {
      await expect(
        progressRepo.saveProgress({
          sessionId: activeSession.id,
          unit: 'pages',
          currentValue: -10,
          totalValue: 100,
          source: 'manual',
        })
      ).rejects.toThrow(/progresso inválido/i);
    });

    it('4.5. Rejeita progresso superior ao total conhecido (currentValue > totalValue)', async () => {
      await expect(
        progressRepo.saveProgress({
          sessionId: activeSession.id,
          unit: 'pages',
          currentValue: 250,
          totalValue: 200,
          source: 'manual',
        })
      ).rejects.toThrow(/progresso inválido/i);
    });

    it('4.6. Preserva a unidade de medida e permite atualizar o progresso', async () => {
      await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'pages',
        currentValue: 10,
        totalValue: 100,
        source: 'manual',
      });

      const updated = await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'pages',
        currentValue: 25,
        totalValue: 100,
        source: 'manual',
      });

      expect(updated.currentValue).toBe(25);
      const count = await progressRepo.count();
      expect(count).toBe(1); // Relação 1:1 por sessão
    });

    it('4.7. Diferencia progresso deliberado de posição visitada', async () => {
      // Anexo com posição visitada (ex: folheou até a página 150)
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'pdf',
        filename: 'livro.pdf',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-1',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'pdf_page',
        location: '150', // última página visitada
      });

      // Progresso deliberadamente acompanhado pelo leitor (parou na página 50)
      await progressRepo.saveProgress({
        sessionId: activeSession.id,
        unit: 'pages',
        currentValue: 50,
        totalValue: 300,
        source: 'manual',
      });

      const pos = await positionRepo.getByAttachmentId(ebook.id);
      const prog = await progressRepo.getBySessionId(activeSession.id);

      expect(pos?.location).toBe('150');
      expect(prog?.currentValue).toBe(50);
      expect(pos?.location).not.toBe(String(prog?.currentValue));
    });
  });

  // ==========================================
  // PARTE E — TESTES DE INTEGRIDADE E EXCLUSÃO
  // ==========================================
  describe('5. Integridade Referencial e Exclusão em Cascata', () => {
    it('5.1. Excluir um anexo remove automaticamente sua posição visitada associada', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'temp.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-del',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-1',
      });

      expect(await positionRepo.getByAttachmentId(ebook.id)).not.toBeNull();

      // Deleta anexo
      await attachmentRepo.delete(ebook.id);

      // Posição deve ter sido excluída em cascata
      expect(await positionRepo.getByAttachmentId(ebook.id)).toBeNull();
    });

    it('5.2. Excluir uma sessão remove automaticamente seu progresso associado', async () => {
      const session = await sessionRepo.create({ bookId: testBook.id });
      await progressRepo.saveProgress({
        sessionId: session.id,
        unit: 'percentage',
        currentValue: 30,
        totalValue: 100,
        source: 'manual',
      });

      expect(await progressRepo.getBySessionId(session.id)).not.toBeNull();

      // Deleta sessão
      await sessionRepo.delete(session.id);

      // Progresso deve ter sido excluído em cascata
      expect(await progressRepo.getBySessionId(session.id)).toBeNull();
    });

    it('5.3. Excluir um livro remove anexos, posições, sessões e progressos associados', async () => {
      const ebook = await attachmentRepo.create({
        bookId: testBook.id,
        type: 'ebook',
        format: 'epub',
        filename: 'del.epub',
        sizeBytes: 100,
        storageProvider: 'web_local',
        storageReference: 'ref-del',
      });

      await positionRepo.savePosition({
        attachmentId: ebook.id,
        locationType: 'epub_cfi',
        location: 'cfi-del',
      });

      const session = await sessionRepo.create({ bookId: testBook.id });
      await progressRepo.saveProgress({
        sessionId: session.id,
        unit: 'pages',
        currentValue: 10,
        totalValue: 100,
        source: 'manual',
      });

      // Exclui livro da biblioteca
      await bookRepo.delete(testBook.id);

      // Todos os metadados filhos devem estar limpos
      expect(await attachmentRepo.getByBookId(testBook.id)).toEqual([]);
      expect(await positionRepo.getByAttachmentId(ebook.id)).toBeNull();
      expect(await sessionRepo.getHistoryByBookId(testBook.id)).toEqual([]);
      expect(await progressRepo.getBySessionId(session.id)).toBeNull();
    });
  });
});

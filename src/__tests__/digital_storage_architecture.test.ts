import { beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { BookRepository } from '../services/database/bookRepository';
import { BookAttachmentRepository } from '../services/database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../services/database/readerPositionRepository';
import { DatabaseService } from '../services/database/databaseService';
import type { Book } from '../types/book';
import {
  DigitalFileStorageService, planAttachmentChange, storageFailure,
} from '../services/storage/digital';
import type {
  AttachmentChangePlan, AttachmentChangeRequest, DeleteManagedFileRequest, DetachAttachmentRequest,
  StorageResult, StoredDigitalFile,
} from '../services/storage/digital';
import { DigitalStorageTestProvider, storedFile } from './helpers/DigitalStorageTestProvider';

function success<T>(result: StorageResult<T>): T {
  expect(result.status).toBe('success');
  if (result.status !== 'success') throw new Error('Contrato de teste não satisfeito');
  return result.value;
}

describe('Fase 2.1: armazenamento separado da bibliografia (fakes e banco em memória)', () => {
  let bookRepo: BookRepository;
  let attachments: BookAttachmentRepository;
  let positions: ReaderPositionRepository;
  let provider: DigitalStorageTestProvider;
  let service: DigitalFileStorageService;
  let book: Book;
  beforeEach(async () => {
    const db = DatabaseService.createTestInstance();
    await db.initialize();
    bookRepo = new BookRepository(db);
    attachments = new BookAttachmentRepository(db);
    positions = new ReaderPositionRepository(db);
    provider = new DigitalStorageTestProvider();
    service = new DigitalFileStorageService([provider]);
    book = await bookRepo.insert({
      origem: 'manual', titulo: 'Obra sintética', autores: ['Autor de teste'], generos: [],
      formatos: ['fisico'], formato: 'fisico', tenho_fisico: false, status_leitura: 'quero_ler',
      nota: 7, anoLeitura: 2025, mesLeitura: 3, dataCadastro: 1000, dataAtualizacao: 1000,
    });
    // Compara leituras do mesmo contrato normalizado, incluindo todos os campos opcionais.
    book = (await bookRepo.getById(book.id))!;
  });

  async function importEbook(): Promise<StoredDigitalFile> {
    return success(await service.importFile({ operationId: 'ebook-import', selected: provider.selection, type: 'ebook', format: 'epub' }));
  }
  function change(imported: StoredDigitalFile, type: 'ebook' | 'audiobook' = 'ebook'): AttachmentChangeRequest {
    return { bookId: book.id, type, imported, intent: 'attach' };
  }

  it('seleção e importação não criam anexos nem alteram posse, modalidades, leitura ou dados do livro', async () => {
    await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub', 'mp3'] });
    expect(await attachments.count()).toBe(0);
    await importEbook();
    expect(await attachments.count()).toBe(0);
    expect(await bookRepo.getById(book.id)).toEqual(book);
  });

  it('resultado importado produz dados do contrato existente, sem persistência implícita', async () => {
    const imported = await importEbook();
    const plan = success(planAttachmentChange(change(imported), null));
    expectTypeOf(plan.next).toMatchTypeOf<Parameters<BookAttachmentRepository['create']>[0]>();
    expect(plan.next).toMatchObject({ bookId: book.id, type: 'ebook', storageProvider: provider.id, storageReference: imported.file.storageReference, checksum: imported.integrity.checksum.value });
    expect(plan.next.id).toBeUndefined();
    expect('tenho_fisico' in plan.next).toBe(false);
    expect('formatos' in plan.next).toBe(false);
    expect('status_leitura' in plan.next).toBe(false);
    expect(await attachments.count()).toBe(0);
  });

  it('o mesmo livro aceita um e-book e um audiolivro em slots independentes', async () => {
    const ebook = await importEbook();
    const audio = success(await service.importFile({ operationId: 'audio-import', selected: provider.selection, type: 'audiobook', format: 'm4b' }));
    const ebookPlan = success(planAttachmentChange(change(ebook), null));
    const audioPlan = success(planAttachmentChange(change(audio, 'audiobook'), null));
    // Integração explícita apenas neste banco em memória, usando o repositório da Fase 1.
    await attachments.create(ebookPlan.next);
    await attachments.create(audioPlan.next);
    expect((await attachments.getByBookId(book.id)).map((a) => a.type).sort()).toEqual(['audiobook', 'ebook']);
    expect(await bookRepo.getById(book.id)).toEqual(book);
  });

  it('um segundo anexo da mesma categoria exige substituição explícita do vínculo esperado', async () => {
    const first = success(planAttachmentChange(change(await importEbook()), null));
    const current = await attachments.create(first.next);
    const second = storedFile(provider.id, 'replacement');
    expect(planAttachmentChange(change(second), current)).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    expect(planAttachmentChange({ ...change(second), intent: 'replace', expectedAttachmentId: 'different-id' }, current))
      .toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    const plan = success(planAttachmentChange({ ...change(second), intent: 'replace', expectedAttachmentId: current.id }, current));
    expect(plan.action).toBe('replace');
    expect(plan.previousFile?.storageReference).toBe(current.storageReference);
    expect(plan.oldFilePolicy).toBe('retain-until-committed-and-unreferenced');
    expect(plan.onMetadataFailure).toBe('retain-unlinked-import-for-recovery');
    expect(await attachments.getById(current.id)).toEqual(current);
    expect(provider.deleteManagedFile).not.toHaveBeenCalled();
  });

  it('plano de substituição não transfere nem modifica posições visitadas', async () => {
    const current = await attachments.create(success(planAttachmentChange(change(await importEbook()), null)).next);
    const position = await positions.savePosition({ attachmentId: current.id, locationType: 'epub_cfi', location: 'epubcfi(/6/2)' });
    const plan = success(planAttachmentChange({ ...change(storedFile(provider.id, 'replacement')), intent: 'replace', expectedAttachmentId: current.id }, current));
    expect(plan.readerPositionPolicy).toBe('requires-integration-decision');
    expect(plan.next.id).toBeUndefined();
    expect(await positions.getByAttachmentId(current.id)).toEqual(position);
    expect(await attachments.getById(current.id)).toEqual(current);
  });

  it('rejeita substituição sobre outro livro/categoria ou sem vínculo anterior', async () => {
    const input = change(await importEbook());
    const current = await attachments.create(success(planAttachmentChange(input, null)).next);
    expect(planAttachmentChange({ ...input, intent: 'replace', expectedAttachmentId: current.id }, null)).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    expect(planAttachmentChange({ ...input, bookId: book.id + 1, intent: 'replace', expectedAttachmentId: current.id }, current)).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
    const audio = { ...storedFile(), metadata: { ...storedFile().metadata, format: 'mp3' as const } };
    expect(planAttachmentChange({ ...change(audio, 'audiobook'), intent: 'replace', expectedAttachmentId: current.id }, current)).toEqual(storageFailure('ATTACHMENT_CONFLICT'));
  });

  it('um arquivo selecionado ou incompleto não pode produzir plano de associação', () => {
    expect(planAttachmentChange(change(provider.selection as unknown as StoredDigitalFile), null)).toEqual(storageFailure('INVALID_FILE'));
  });

  it('arquivo ausente e erros de armazenamento não apagam nem atualizam bibliografia', async () => {
    expect(await service.checkAccess(storedFile().file)).toEqual(storageFailure('FILE_NOT_FOUND'));
    provider.importFile.mockResolvedValueOnce(storageFailure('INSUFFICIENT_SPACE'));
    expect(await service.importFile({ operationId: 'failure', selected: provider.selection, type: 'ebook', format: 'epub' })).toEqual(storageFailure('INSUFFICIENT_SPACE'));
    expect(await bookRepo.getById(book.id)).toEqual(book);
    expect(await attachments.count()).toBe(0);
  });

  it('desassociar e excluir são contratos distintos; excluir livro não chama o armazenamento', async () => {
    expectTypeOf<DetachAttachmentRequest>().not.toMatchTypeOf<DeleteManagedFileRequest>();
    const imported = await importEbook();
    const current = await attachments.create(success(planAttachmentChange(change(imported), null)).next);
    await attachments.delete(current.id);
    expect(provider.files.has(imported.file.storageReference)).toBe(true);
    await bookRepo.delete(book.id);
    expect(provider.deleteManagedFile).not.toHaveBeenCalled();
    expect(provider.files.has(imported.file.storageReference)).toBe(true);
  });

  it('plano de associação permanece metadado serializável sem binários', async () => {
    const plan: AttachmentChangePlan = success(planAttachmentChange(change(await importEbook()), null));
    expect(JSON.parse(JSON.stringify(plan)).next.storageReference).toBe(plan.next.storageReference);
    expect(JSON.stringify(plan)).not.toMatch(/base64|arrayBuffer|blob/);
  });
});

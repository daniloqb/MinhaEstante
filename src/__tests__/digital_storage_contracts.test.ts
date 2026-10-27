import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  DIGITAL_STORAGE_ERROR_CODES, DIGITAL_STORAGE_PROVIDER_IDS, DigitalFileStorageService, DigitalStorageException,
  createDigitalFileStorageService, libraryLocationReference, managedFileReference, normalizeSelectedFile,
  normalizeStorageError, normalizeStoredFile, sourceFileReference, storageFailure, storageSuccess,
} from '../services/storage/digital';
import type {
  DigitalStorageErrorCode, IDigitalFileStorageService, ImportDigitalFileRequest, LibraryLocationReference,
  ManagedFileReference, OpaqueReference, SelectedDigitalFile, SourceFileReference, StoredDigitalFile,
} from '../services/storage/digital';
import { DigitalStorageTestProvider, TEST_SHA256, selectedFile, storedFile } from './helpers/DigitalStorageTestProvider';

describe('Fase 2.1: contratos de armazenamento (sem SAF/OPFS)', () => {
  let provider: DigitalStorageTestProvider;
  let service: DigitalFileStorageService;
  let request: ImportDigitalFileRequest;
  beforeEach(() => {
    provider = new DigitalStorageTestProvider();
    service = new DigitalFileStorageService([provider]);
    request = { selected: provider.selection, type: 'ebook', format: 'epub', operationId: 'operation-1' };
  });

  it('mantém tipos diferentes para origem, arquivo gerenciado, localização e estados', () => {
    expectTypeOf<SourceFileReference>().not.toMatchTypeOf<ManagedFileReference>();
    expectTypeOf<LibraryLocationReference>().not.toMatchTypeOf<ManagedFileReference>();
    expectTypeOf<OpaqueReference<'source'>>().not.toMatchTypeOf<OpaqueReference<'managed'>>();
    expectTypeOf<SelectedDigitalFile>().not.toMatchTypeOf<StoredDigitalFile>();
    expectTypeOf<DigitalFileStorageService>().toMatchTypeOf<IDigitalFileStorageService>();
    const ref = managedFileReference(provider.id, 'content://opaque/tree/document%3A42');
    expect(managedFileReference(JSON.parse(JSON.stringify(ref)).storageProvider, JSON.parse(JSON.stringify(ref)).storageReference)).toEqual(ref);
    expect(ref.storageReference).toBe('content://opaque/tree/document%3A42');
  });

  it.each(['android', 'web'] as const)('seleção centralizada de plataforma %s usa só o provedor injetado', (platform) => {
    const p = new DigitalStorageTestProvider(DIGITAL_STORAGE_PROVIDER_IDS[platform]);
    const instance = createDigitalFileStorageService(platform, [provider, p]);
    expect(instance.getCapabilities().status).toBe('success');
    expect(p.getCapabilities).toHaveBeenCalledOnce();
    expect(provider.getCapabilities).not.toHaveBeenCalled();
  });

  it('sem provedor concreto o recurso é indisponível, sem sucesso fictício', async () => {
    const unavailable = createDigitalFileStorageService('android');
    expect(unavailable.getCapabilities()).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
    expect(await unavailable.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] })).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
    expect(await unavailable.importFile(request)).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
  });

  it('rejeita identidades duplicadas em vez de sobrescrever um provedor', () => {
    expect(() => new DigitalFileStorageService([provider, new DigitalStorageTestProvider(provider.id)])).toThrow(DigitalStorageException);
  });

  it('capacidades não implicam configuração, permissão ou arquivo acessível', async () => {
    expect(service.getCapabilities().status).toBe('success');
    provider.configuration = { state: 'not-configured' };
    expect(await service.importFile(request)).toEqual(storageFailure('NOT_CONFIGURED'));
    expect(provider.importFile).not.toHaveBeenCalled();
    provider.configuration = { state: 'configured', permission: 'revoked', location: libraryLocationReference(provider.id, 'location-1') };
    expect(await service.importFile(request)).toEqual(storageFailure('PERMISSION_REVOKED'));
    provider.configuration = { ...provider.configuration, permission: 'granted' };
    provider.checkAccess.mockResolvedValueOnce(storageFailure('FILE_NOT_FOUND'));
    expect(await service.importFile(request)).toEqual(storageFailure('FILE_NOT_FOUND'));
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('distingue implementação e disponibilidade no ambiente', async () => {
    provider.capabilities = { ...provider.capabilities, available: { ...provider.capabilities.available, selectFile: false } };
    expect(service.getCapabilities()).toMatchObject({ status: 'success', value: { implemented: { selectFile: true }, available: { selectFile: false } } });
    expect(await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] })).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(provider.interaction.selectSource).not.toHaveBeenCalled();
    provider.capabilities = { ...provider.capabilities, providerAvailability: 'unavailable' };
    expect(await service.getConfiguration()).toEqual(storageFailure('PROVIDER_UNAVAILABLE'));
  });

  it.each([
    ['denied', 'PERMISSION_DENIED'], ['revoked', 'PERMISSION_REVOKED'], ['unknown', 'PERMISSION_REQUIRED'],
  ] as const)('permissão %s retorna %s sem abrir seletor ou copiar', async (permission, code) => {
    provider.configuration = { state: 'configured', permission, location: libraryLocationReference(provider.id, 'location-1') };
    expect(await service.importFile(request)).toEqual(storageFailure(code));
    expect(provider.importFile).not.toHaveBeenCalled();
    expect(provider.interaction.requestConfiguration).not.toHaveBeenCalled();
  });

  it('não aceita capacidade disponível que o provedor não implementa', () => {
    provider.capabilities = { ...provider.capabilities, implemented: { ...provider.capabilities.implemented, importFile: false } };
    expect(service.getCapabilities()).toEqual(storageFailure('OPERATION_FAILED'));
  });

  it('despacha o seletor no mesmo turno, antes de qualquer await', async () => {
    let returned = false;
    provider.interaction.selectSource.mockImplementationOnce(() => {
      expect(returned).toBe(false);
      return Promise.resolve(storageSuccess(provider.selection));
    });
    const pending = service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] });
    returned = true;
    expect(provider.interaction.selectSource).toHaveBeenCalledOnce();
    expect(await pending).toEqual(storageSuccess(provider.selection));
    expect(provider.getConfiguration).not.toHaveBeenCalled();
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('configuração também é uma solicitação interativa explícita', async () => {
    const pending = service.requestConfiguration({ interaction: 'user-initiated' });
    expect(provider.interaction.requestConfiguration).toHaveBeenCalledOnce();
    expect((await pending).status).toBe('success');
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('consulta configuração sem abrir seletor nem pedir permissão', async () => {
    expect(await service.getConfiguration()).toEqual(storageSuccess(provider.configuration));
    expect(provider.interaction.requestConfiguration).not.toHaveBeenCalled();
    expect(provider.interaction.selectSource).not.toHaveBeenCalled();
  });

  it.each(DIGITAL_STORAGE_ERROR_CODES)('normaliza erro %s sem expor informações privadas', async (code) => {
    const privateError = { code, message: '/private/path/personal.epub', stack: 'private-stack', contents: 'private-content' };
    provider.importFile.mockRejectedValueOnce(privateError);
    const result = await service.importFile(request);
    expect(result).toEqual(storageFailure(code));
    expect(JSON.stringify(result)).not.toMatch(/private/);
  });

  it('erros desconhecidos e AbortError são previsíveis e sem mensagem original', () => {
    expect(normalizeStorageError(new Error('private-data')).code).toBe('OPERATION_FAILED');
    expect(normalizeStorageError({ name: 'AbortError', message: 'private-data' }).code).toBe('OPERATION_CANCELLED');
    expect(normalizeStorageError({ code: 'UNKNOWN', message: 'private-data' }).code).toBe('OPERATION_FAILED');
  });

  it('cancelar seleção difere de cancelar importação', async () => {
    provider.interaction.selectSource.mockResolvedValueOnce(storageFailure('USER_CANCELLED'));
    expect(await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub'] })).toEqual({ status: 'cancelled', code: 'USER_CANCELLED' });
    const controller = new AbortController();
    controller.abort();
    expect(await service.importFile(request, { signal: controller.signal })).toEqual({ status: 'cancelled', code: 'OPERATION_CANCELLED' });
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('cancelamento durante preflight não começa a cópia', async () => {
    const controller = new AbortController();
    provider.checkAccess.mockImplementationOnce(async () => { controller.abort(); return storageSuccess({ accessible: true }); });
    expect(await service.importFile(request, { signal: controller.signal })).toEqual(storageFailure('OPERATION_CANCELLED'));
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('respeita cancelamento do provedor durante importação e mantém resultado já confirmado', async () => {
    const controller = new AbortController();
    provider.importFile.mockImplementationOnce(async () => {
      controller.abort();
      return storageFailure('OPERATION_CANCELLED');
    });
    expect(await service.importFile(request, { signal: controller.signal })).toEqual(storageFailure('OPERATION_CANCELLED'));
    const late = new AbortController();
    provider.importFile.mockImplementationOnce(async () => {
      late.abort();
      return storageSuccess(storedFile());
    });
    expect(await service.importFile(request, { signal: late.signal })).toEqual(storageSuccess(storedFile()));
  });

  it.each(['cancelOperations', 'importProgress'] as const)('rejeita observação/controle %s não disponível', async (feature) => {
    provider.capabilities = { ...provider.capabilities, available: { ...provider.capabilities.available, [feature]: false } };
    const context = feature === 'cancelOperations' ? { signal: new AbortController().signal } : { onProgress: vi.fn() };
    expect(await service.importFile(request, context)).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('rejeita importação sem estratégia incremental/nativa', async () => {
    provider.capabilities = { ...provider.capabilities, available: { ...provider.capabilities.available, nativeCopy: false, streamWrite: false } };
    expect(await service.importFile(request)).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('aceita cópia nativa sem exigir stream ou conteúdo binário em JavaScript', async () => {
    provider.capabilities = { ...provider.capabilities, available: { ...provider.capabilities.available, streamRead: false, streamWrite: false } };
    const onProgress = vi.fn();
    const signal = new AbortController().signal;
    const result = await service.importFile(request, { onProgress, signal });
    expect(result.status).toBe('success');
    expect(provider.importFile).toHaveBeenCalledWith(request, { onProgress, signal });
    expect(onProgress.mock.calls.map(([progress]) => progress.stage)).toEqual(['validating', 'preparing', 'copying', 'verifying', 'committing']);
    expect(JSON.stringify(result)).not.toMatch(/base64|arrayBuffer|blob/);
  });

  it('rejeita resultado incompleto e divergência de tamanho sem associar arquivos', async () => {
    provider.importFile.mockResolvedValueOnce(storageSuccess(selectedFile() as unknown as StoredDigitalFile));
    expect(await service.importFile(request)).toEqual(storageFailure('INVALID_FILE'));
    const bad = storedFile();
    provider.importFile.mockResolvedValueOnce(storageSuccess({ ...bad, integrity: { ...bad.integrity, sizeBytes: 100 } }));
    expect(await service.importFile(request)).toEqual(storageFailure('INTEGRITY_MISMATCH'));
  });

  it('normaliza checksum e descarta campos extras de respostas', async () => {
    const stored = storedFile();
    provider.importFile.mockResolvedValueOnce(storageSuccess({ ...stored, privatePath: 'private', bytes: 'private', integrity: { ...stored.integrity, checksum: { algorithm: 'sha256', value: TEST_SHA256.toUpperCase() } } } as StoredDigitalFile));
    expect(await service.importFile(request)).toEqual(storageSuccess(stored));
  });

  it.each([0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejeita tamanho inválido %s', async (sizeBytes) => {
    expect(await service.importFile({ ...request, selected: { ...request.selected, sizeBytes } })).toEqual(storageFailure('INVALID_FILE'));
    expect(provider.importFile).not.toHaveBeenCalled();
  });

  it('tamanho desconhecido da origem é permitido, mas destino deve ter tamanho e hash válidos', async () => {
    const result = await service.importFile({ ...request, selected: { ...request.selected, sizeBytes: undefined } });
    expect(result.status).toBe('success');
    expect(() => normalizeStoredFile({ ...storedFile(), integrity: { sizeBytes: 512_000_000, checksum: { algorithm: 'sha256', value: 'bad' } } })).toThrow(DigitalStorageException);
  });

  it('rejeita nomes com caminho e combinações de categoria/formato inválidas', async () => {
    expect(() => normalizeSelectedFile({ ...selectedFile(), filename: '../private.epub' }, provider.id)).toThrow(DigitalStorageException);
    expect(await service.importFile({ ...request, type: 'audiobook' })).toEqual(storageFailure('UNSUPPORTED_FORMAT'));
  });

  it('rejeita resultados de outro provedor, operação ou formato', async () => {
    provider.importFile.mockResolvedValueOnce(storageSuccess(storedFile('other_provider')));
    expect(await service.importFile(request)).toEqual(storageFailure('PROVIDER_MISMATCH'));
    provider.importFile.mockResolvedValueOnce(storageSuccess(storedFile(provider.id, 'other-operation')));
    expect(await service.importFile(request)).toEqual(storageFailure('INVALID_FILE'));
    const stored = storedFile();
    provider.importFile.mockResolvedValueOnce(storageSuccess({ ...stored, metadata: { ...stored.metadata, format: 'pdf' } }));
    expect(await service.importFile(request)).toEqual(storageFailure('INVALID_FILE'));
  });

  it('verificação de integridade não silencia divergência de checksum', async () => {
    const stored = storedFile();
    provider.verifyIntegrity.mockResolvedValueOnce(storageSuccess({ ...stored.integrity, checksum: { algorithm: 'sha256', value: 'b'.repeat(64) } }));
    expect(await service.verifyIntegrity(stored.file, stored.integrity)).toEqual(storageFailure('INTEGRITY_MISMATCH'));
  });

  it('referências antigas continuam roteadas pelo próprio provedor após trocar o padrão', async () => {
    const old = storedFile();
    provider.files.set(old.file.storageReference, old);
    const other = new DigitalStorageTestProvider('other_provider');
    const changed = new DigitalFileStorageService([provider, other], other.id);
    expect(await changed.getMetadata(old.file)).toEqual(storageSuccess({ file: old.file, metadata: old.metadata }));
    provider.configuration = { state: 'configured', permission: 'granted', location: libraryLocationReference(provider.id, 'new-location') };
    expect((await changed.getMetadata(old.file)).status).toBe('success');
    expect(other.getMetadata).not.toHaveBeenCalled();
  });

  it('fornece e libera token de leitura efêmero distinto da referência persistida', async () => {
    const stored = storedFile();
    const file = stored.file;
    provider.files.set(file.storageReference, stored);
    const access = await service.acquireReadAccess(file);
    expect(access.status).toBe('success');
    if (access.status !== 'success') throw new Error('Contrato de leitura');
    expect(access.value.token).not.toBe(file.storageReference);
    expect(await service.releaseReadAccess(access.value)).toEqual(storageSuccess(undefined));
  });

  it.each(['readAccess', 'deleteManagedFiles', 'sha256'] as const)('rejeita operação sem capacidade %s', async (feature) => {
    provider.capabilities = { ...provider.capabilities, available: { ...provider.capabilities.available, [feature]: false } };
    const stored = storedFile();
    const result = feature === 'readAccess' ? await service.acquireReadAccess(stored.file)
      : feature === 'sha256' ? await service.verifyIntegrity(stored.file, stored.integrity)
      : await service.deleteManagedFile({ file: stored.file, intent: 'delete-managed-file' });
    expect(result).toEqual(storageFailure('UNSUPPORTED_OPERATION'));
    expect(provider.acquireReadAccess).not.toHaveBeenCalled();
    expect(provider.verifyIntegrity).not.toHaveBeenCalled();
    expect(provider.deleteManagedFile).not.toHaveBeenCalled();
  });

  it('exclusão exige intenção explícita e referência gerenciada, nunca uma seleção externa', async () => {
    const external = sourceFileReference(provider.id, 'content://external/document/1');
    expect(await service.deleteManagedFile({ file: external as unknown as ManagedFileReference, intent: 'delete-managed-file' })).toEqual(storageFailure('INVALID_REFERENCE'));
    expect(provider.deleteManagedFile).not.toHaveBeenCalled();
    expect(await service.deleteManagedFile({ file: managedFileReference(provider.id, 'unregistered-external'), intent: 'delete-managed-file' })).toEqual(storageFailure('FILE_NOT_FOUND'));
    const result = await service.importFile(request);
    if (result.status !== 'success') throw new Error('Contrato de importação');
    expect(await service.deleteManagedFile({ file: result.value.file, intent: 'delete-managed-file' })).toEqual(storageSuccess(undefined));
  });

  it('erros tipados podem ser utilizados sem caminhos, stack ou conteúdo', () => {
    const code: DigitalStorageErrorCode = 'PERMISSION_REVOKED';
    expect(new DigitalStorageException(code).message).toBe(code);
    expect(() => managedFileReference(provider.id, '')).toThrow(DigitalStorageException);
  });
});

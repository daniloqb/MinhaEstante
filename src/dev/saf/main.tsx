import { runDigitalConformance } from '../digital/conformance';
import { nativeConformanceHarness } from '../digital/nativeHarness';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { AndroidSafPlugin, AndroidSafStorageProvider } from '../../services/storage/digital/android';
import { createPlatformDigitalLibrary } from '../../services/storage/digital/platform';
import type { DigitalFileStorageService } from '../../services/storage/digital/DigitalFileStorageService';
import type { SelectedDigitalFile } from '../../services/storage/digital/contracts';
import type { DigitalImportProgress } from '../../services/storage/digital/contracts';
import { normalizeStorageError } from '../../services/storage/digital/errors';
import { createSafDiagnosticController } from './controller';
import type { SafDiagnosticController } from './controller';
import './style.css';

let provider: AndroidSafStorageProvider;
let service: DigitalFileStorageService;
let controller: SafDiagnosticController;
declare global { interface Window { minhaEstanteSafDiagnostic?: SafDiagnosticController } }
function Diagnostic() {
  const [output, setOutput] = useState('Pronto. Nenhum seletor abre automaticamente.');
  const [selected, setSelected] = useState<SelectedDigitalFile>();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<DigitalImportProgress>();
  const [includeLarge, setIncludeLarge] = useState(false);
  const [fixtures, setFixtures] = useState<{ index: number; format: string | undefined; fixture: string; sizeBytes: number | undefined }[]>([]);
  const [operation, setOperation] = useState('');
  const [fault, setFault] = useState('');
  const [failSQLite, setFailSQLite] = useState(false);
  controller.onProgress = setProgress;
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      setOutput(JSON.stringify(await work(), (key, value: unknown) => {
        if (key === 'filename') return undefined;
        return typeof value === 'string' && value.includes('content://') ? '[referência privada]' : value;
      }, 2));
      setOperation(controller.state.operationId || operation);
    }
    catch (error) { setOutput(JSON.stringify({ status: 'error', error: normalizeStorageError(error) })); }
    finally { setBusy(false); }
  }
  async function status() {
    const result = await provider.getSafStatus();
    if (result.status !== 'success') return result;
    const { configuration, ...safe } = result.value;
    return { status: 'success', ...safe, configured: configuration.state === 'configured' };
  }
  function metadata(value: SelectedDigitalFile) {
    return { status: 'success', mimeType: value.mimeType ?? 'não informado',
      format: value.filename.split('.').pop()?.toLowerCase(), sizeBytes: value.sizeBytes ?? 'não informado', access: value.access };
  }
  return <main>
    <h1>MinhaEstante DEV · SAF 2.2B</h1>
    <p>Instalação isolada. Use uma pasta e documentos exclusivos de teste.</p>
    <p>O teste de acesso cria um arquivo pequeno próprio, confere seus bytes e tenta removê-lo. Verifique o resultado da limpeza.</p>
    <div className="controls">
      <button id="select-folder" disabled={busy} onClick={() => void run(async () => {
        const result = await service.requestConfiguration({ interaction: 'user-initiated' });
        return result.status === 'success' ? status() : result;
      })}>Selecionar pasta</button>
      <button id="folder-status" disabled={busy} onClick={() => void run(status)}>Consultar pasta configurada</button>
      <button id="select-document" disabled={busy} onClick={() => void run(async () => {
        const result = await service.selectSource({ interaction: 'user-initiated', acceptedFormats: ['epub', 'pdf', 'mp3', 'm4a', 'm4b'] });
        if (result.status !== 'success') return result;
        setSelected(result.value);
        controller.setSelected(result.value);
        return metadata(result.value);
      })}>Selecionar documento</button>
      <button id="document-metadata" disabled={busy || !selected} onClick={() => void run(async () => {
        if (!selected) return { status: 'error', code: 'INVALID_REFERENCE' };
        const result = await provider.getSelectedMetadata(selected.source);
        return result.status === 'success' ? metadata(result.value) : result;
      })}>Consultar documento selecionado</button>
      <button id="check-document" disabled={busy || !selected} onClick={() => void run(() =>
        service.checkAccess(selected!.source))}>Verificar leitura do documento</button>
      <button id="test-access" disabled={busy} onClick={() => void run(() => provider.runDiagnostics({ interaction: 'user-initiated' }))}>Testar acesso (arquivo temporário)</button>
      <button id="persistence" disabled={busy} onClick={() => void run(status)}>Consultar persistência</button>
      <button id="create-dev-book" disabled={busy} onClick={() => void run(() => controller.createBook())}>Criar livro sintético no SQLite DEV</button>
      <label><input type="checkbox" checked={includeLarge} onChange={(e) => setIncludeLarge(e.target.checked)} /> Incluir PDF sintético de 100 MiB nas fontes de teste</label>
      <button id="generate-sources" disabled={busy} onClick={() => void run(async () => {
        const result = await controller.generateSources(includeLarge); setFixtures(result); setSelected(controller.state.selected); return result;
      })}>Gerar fontes sintéticas válidas na pasta DEV</button>
      <select id="fixture" disabled={busy} onChange={(e) => setSelected(controller.selectFixture(Number(e.target.value)))}>
        {fixtures.map((f) => <option key={f.index} value={f.index}>{f.index} · {f.format} · {f.fixture} · {f.sizeBytes ?? '?'} bytes</option>)}
      </select>
      <label>Injeção de falha DEV <select id="fault" value={fault} onChange={(e) => setFault(e.target.value)}>
        <option value="">Nenhuma</option>
        {['before-intent', 'after-create-before-uri', 'after-copy', 'before-ready', 'slow-copy', 'read-failure', 'write-failure', 'no-space', 'corrupt-destination-read', 'unknown-size', 'permission-revoked', 'destination-unavailable'].map((f) => <option key={f}>{f}</option>)}
      </select></label>
      <label><input type="checkbox" checked={failSQLite} onChange={(e) => setFailSQLite(e.target.checked)} /> Falhar próximo INSERT de anexo (somente teste DEV)</label>
      <button id="import-only" disabled={busy || !selected} onClick={() => void run(() => controller.importSelected({ fault }))}>Importar sem associar</button>
      <button id="import-link" disabled={busy || !selected} onClick={() => void run(() => controller.importSelected({ link: true, fault, failSQLite }))}>Importar e associar ao livro DEV</button>
      <p>Substituir conteúdo diferente remove a posição atual somente com confirmação; sessões e progresso permanecem.</p>
      <button id="replace-link" disabled={busy || !selected} onClick={() => void run(() => controller.importSelected({ link: true, replace: true, fault, failSQLite }))}>Importar e substituir anexo DEV</button>
      <button id="replace-clear-position" disabled={busy || !selected} onClick={() => void run(() => controller.importSelected({ link: true, replace: true, positionDecision: 'invalidate-current', fault, failSQLite }))}>Confirmar substituição DEV e invalidar posição incompatível</button>
      <button id="seed-position" disabled={busy} onClick={() => void run(() => controller.seedPosition('ebook'))}>Salvar posição sintética de e-book DEV</button>
      <button id="inspect-position" disabled={busy} onClick={() => void run(() => controller.positionsAndHistory())}>Consultar posições, sessões e progresso DEV</button>
      <button id="retained-files" disabled={busy} onClick={() => void run(() => controller.retainedFiles())}>Consultar arquivos retidos para revisão (sem exclusão)</button>
      <button id="detach-clear-position" disabled={busy} onClick={() => void run(() => controller.detach('ebook', 'remove-current'))}>Confirmar desassociação DEV e remover posição atual (preserva bytes e histórico)</button>
      <button id="cancel-import" onClick={() => controller.cancel()}>Cancelar importação em andamento</button>
      <button id="query-dev-book" disabled={busy} onClick={() => void run(() => controller.queryBook())}>Consultar vínculos e regras do livro DEV</button>
      <label>Operação <input id="operation-id" value={operation} onChange={(e) => setOperation(e.target.value)} /></label>
      <button id="reauthorize-file-directory" disabled={busy || !operation} onClick={() => void run(() => AndroidSafPlugin.selectDirectory({ interaction: 'user-initiated', diagnosticOperationId: operation }))}>Reautorizar pasta original da operação DEV (seletor SAF)</button>
      <button id="managed-metadata" disabled={busy || !operation} onClick={() => void run(() => controller.metadata(operation))}>Consultar arquivo armazenado</button>
      <button id="verify-integrity" disabled={busy || !operation} onClick={() => void run(() => controller.verify(operation))}>Verificar SHA-256 do destino</button>
      <button id="list-operations" disabled={busy} onClick={() => void run(() => controller.list())}>Consultar journal e operações pendentes</button>
      <button id="clear-fault" disabled={busy || !operation} onClick={() => void run(() => controller.clearFault(operation))}>Desativar injeção de falha desta operação</button>
      <button id="recover-operation" disabled={busy || !operation} onClick={() => void run(() => controller.recover(operation))}>Recuperar operação e reconciliar SQLite</button>
      <button id="discard-incomplete" disabled={busy || !operation} onClick={() => void run(() => controller.discardIncomplete(operation))}>Descartar temporário próprio incompleto</button>
      <button id="delete-managed" disabled={busy || !operation} onClick={() => void run(() => controller.deleteUnlinked(operation))}>Excluir bytes do arquivo gerenciado sem vínculo</button>
      <button id="detach-ebook" disabled={busy} onClick={() => void run(() => controller.detach('ebook'))}>Desassociar e-book DEV (preserva bytes)</button>
      <button id="detach-audio" disabled={busy} onClick={() => void run(() => controller.detach('audiobook'))}>Desassociar áudio DEV (preserva bytes)</button>
      <button id="test-native-sqlite" disabled={busy} onClick={() => void run(() => controller.nativeTransactionRegression())}>Testar rollback e concorrência SQLite DEV</button>
    </div>
    <p>Após encerrar e reabrir o app DEV, consulte a persistência. Reiniciar o celular exige autorização separada.</p>
    {progress && <div id="import-progress">
      <p>{progress.operationId} · {progress.stage} · {progress.bytesProcessed} bytes{progress.totalBytes ? ` / ${progress.totalBytes}` : ''}</p>
      {progress.totalBytes ? <progress max={progress.totalBytes} value={progress.bytesProcessed} /> : <progress />}
    </div>}
    <pre id="saf-result" role="status" aria-live="polite">{output}</pre>
  </main>;
}

// The separate entry is still denied unless native build and application ID both match.
async function start() {
  const root = document.getElementById('root');
  if (!root) return;
  try {
    const gate = await AndroidSafPlugin.getDevelopmentEnvironment();
    if (gate.status === 'success' && gate.value.enabled) {
      const composed = await createPlatformDigitalLibrary();
      if (composed.status !== 'success') throw new Error('PROVIDER_UNAVAILABLE');
      provider = composed.value.provider as AndroidSafStorageProvider; service = composed.value.service;
      controller = createSafDiagnosticController(provider, service);
      window.minhaEstanteSafDiagnostic = controller;
      (window as any).runDigitalConformance=async()=>runDigitalConformance(await nativeConformanceHarness(controller));
      createRoot(root).render(<Diagnostic />); return;
    }
  } catch { /* No native debug plugin in Web or production. */ }
  root.textContent = 'Diagnóstico disponível somente na variante Android DEV.';
}
void start();

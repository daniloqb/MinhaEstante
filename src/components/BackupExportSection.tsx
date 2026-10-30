import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { WoodPalette } from '../theme/woodTheme';
import { defaultDigitalBackupOptions } from '../services/storage/backupV2/contracts';
import type { DigitalBackupOptions } from '../services/storage/backupV2/contracts';
import { createBackupExporter } from '../services/storage/backupV2/export/runtime';
import { ExportFailure } from '../services/storage/backupV2/export/types';
import type { ExportProgress, ExportReport, PreparedExport } from '../services/storage/backupV2/export/types';
import { backupExportMessages } from '../services/storage/backupV2/i18n/messages';
type Runtime = Awaited<ReturnType<typeof createBackupExporter>>;

export default function BackupExportSection({ palette, legacyExport, exporterFactory = createBackupExporter }: {
  palette: WoodPalette; legacyExport: () => Promise<void>; exporterFactory?: () => Promise<Runtime>;
}) {
  const { locale } = useI18n(), text = backupExportMessages[locale];
  const [runtime, setRuntime] = useState<Runtime>(), [options, setOptions] = useState(defaultDigitalBackupOptions), [plan, setPlan] = useState<PreparedExport>();
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState<ExportProgress>(), [report, setReport] = useState<ExportReport>(), [error, setError] = useState<string>();
  const [elapsed, setElapsed] = useState(0);
  const [blockedFile, setBlockedFile] = useState<string>();
  const controller = useRef<AbortController | undefined>(undefined), action = useRef<HTMLButtonElement>(null);
  const focusAfterExport = useRef(false);
  const selected = options.includeEbooks || options.includeAudiobooks;
  useEffect(() => { let alive = true; void exporterFactory().then(value => { if (alive) setRuntime(value); }).catch(() => { if (alive) setError('CAPABILITY_UNAVAILABLE'); });
    return () => { alive = false; controller.current?.abort(); }; }, [exporterFactory]);
  useEffect(() => { if (!busy) return; const start = performance.now(); setElapsed(0); const timer = setInterval(() => setElapsed(Math.floor((performance.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [busy]);
  useEffect(() => { if (!busy && focusAfterExport.current) { focusAfterExport.current = false; action.current?.focus(); } }, [busy]);
  function reset() { setPlan(undefined); setProgress(undefined); setOptions(defaultDigitalBackupOptions()); }
  function choose(value: Partial<DigitalBackupOptions>) { setOptions(prior => ({ ...prior, ...value })); setPlan(undefined); setReport(undefined); setError(undefined); setBlockedFile(undefined); }
  async function prepare() {
    if (!selected) { await legacyExport(); return; }
    if (!runtime || !runtime.supported) return;
    const stop = new AbortController(); controller.current = stop; setBusy(true); setPlan(undefined); setProgress(undefined); setError(undefined); setBlockedFile(undefined); setReport(undefined);
    try { setPlan(await runtime.coordinator.prepare(options, stop.signal)); }
    catch (e) { setError(e instanceof ExportFailure ? e.code : 'IO_FAILED'); if (e instanceof ExportFailure) setBlockedFile(e.file?.filename); }
    finally { setBusy(false); }
  }
  function save() {
    if (!runtime || !plan || busy) return;
    const stop = new AbortController(); controller.current = stop;
    // Invoke the picker in this synchronous gesture, before any unrelated await.
    let destination: ReturnType<Runtime['select']>;
    try { destination = runtime.select(plan); }
    catch (e) { setError(e instanceof ExportFailure ? e.code : 'IO_FAILED'); setPlan(undefined); return; }
    setBusy(true); setError(undefined);
    void (async () => {
      try {
        const target = await destination;
        const outcome = await runtime.coordinator.export(plan, target, stop.signal, setProgress);
        setReport(outcome); reset();
      } catch (e) { setError(stop.signal.aborted || e instanceof DOMException && e.name === 'AbortError' ? 'CANCELLED' : e instanceof ExportFailure ? e.code : 'IO_FAILED'); setPlan(undefined); }
      finally { focusAfterExport.current = true; setBusy(false); }
    })();
  }
  const errorMessage = (code?: string) => code === 'CANCELLED' ? text.cancelled : code === 'INSUFFICIENT_SPACE' ? text.space
    : code === 'MEDIA_UNAVAILABLE' || code === 'PERMISSION_REQUIRED' ? text.unavailable : code === 'CONFLICT' ? text.conflict
    : code === 'LIMIT_EXCEEDED' ? text.limit : code === 'CAPABILITY_UNAVAILABLE' ? text.unsupported : text.failed;
  return <section data-backup-v2-dev aria-busy={busy} className="rounded-xl border p-3 flex flex-col gap-3" style={{ borderColor: palette.woodBorder, color: palette.textOnPaper }}>
    <h3 className="font-serif font-bold">{text.title} (DEV)</h3>
    <p className="text-sm">{text.warning}</p>
    <label className="flex items-center gap-2"><input type="checkbox" checked={options.includeEbooks} disabled={busy} onChange={event => choose({ includeEbooks: event.target.checked })} />{text.ebooks}</label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={options.includeAudiobooks} disabled={busy} onChange={event => choose({ includeAudiobooks: event.target.checked })} />{text.audio}</label>
    <p>{selected ? text.v2 : text.standard}</p>
    {selected && runtime && !runtime.supported && <p role="status">{runtime.reason === 'mobile-unverified' ? text.mobileBlocked : text.unsupported}</p>}
    {!!runtime?.unfinished.length && <p role="status">{text.recovery} ({runtime.unfinished.length})</p>}
    {plan && <div className="text-sm" data-backup-preview>
      <p>{text.books}: {plan.plan.booksCount} · {text.covers}: {plan.plan.coversCount}</p>
      <p>{text.ebooks}: {plan.manifest.media.filter(row => row.type === 'ebook' && row.state === 'included').length} · {text.audio}: {plan.manifest.media.filter(row => row.type === 'audiobook' && row.state === 'included').length}</p>
      <p>{text.files}: {plan.payloads.length + 1} · {text.inputBytes}: {plan.totalBytes.toLocaleString()} · {text.omitted}: {plan.plan.omitted.length}</p>
      <p>{text.unknownSizes}: {plan.plan.space.unknownMediaSizes} · {text.technicalLimit}: {runtime?.maxBytes.toLocaleString()}</p>
      <p>{text.spaceEstimate}: {runtime?.availableBytes?.toLocaleString() ?? text.unknown}</p>
      {runtime?.native && <p>{text.staging}</p>}
    </div>}
    <div className="flex flex-wrap gap-2">
      <button ref={action} type="button" className="rounded-lg px-3 py-2 border" disabled={busy || selected && (!runtime?.supported)} onClick={() => { void prepare(); }}>{selected ? text.prepare : text.standard}</button>
      {plan && <button type="button" className="rounded-lg px-3 py-2 border" disabled={busy} onClick={save}>{text.destination}</button>}
      {busy && <button type="button" className="rounded-lg px-3 py-2 border" onClick={() => controller.current?.abort()}>{text.cancel}</button>}
    </div>
    {busy && <p className="text-sm">{text.elapsed}: {elapsed}</p>}
    <div role="status" aria-live="polite" aria-atomic="true" className="text-sm break-words">
      {busy && <><p>{progress?.stage === 'verifying' ? text.verifying : progress?.stage === 'finalizing' ? text.finalizing : progress ? text.exporting : text.preparing}</p>
        <progress aria-label={text.exporting} max={progress?.totalBytes ?? undefined} value={progress?.totalBytes ? Math.min(progress.bytesProcessed, progress.totalBytes) : undefined} />
        {progress && <p>{progress.currentPath} · {text.files}: {progress.filesProcessed}/{progress.totalFiles ?? text.unknown} · {text.inputBytes}: {progress.bytesProcessed.toLocaleString()} · {text.outputBytes}: {progress.outputBytes.toLocaleString()}</p>}</>}
      {error && <p>{errorMessage(error)}</p>}
      {blockedFile && <p>{text.blocked}: {blockedFile}</p>}
      {report && <><p>{report.status === 'verified' ? text.verified : errorMessage(report.error)}</p>
        {report.status !== 'verified' && report.outputClosed && <p>{text.writtenUnverified}</p>}
        {report.partialMayRemain && <p>{text.partial}</p>}
        {report.receipt && <p>{text.outputBytes}: {report.receipt.outputBytes.toLocaleString()} · SHA-256: {report.receipt.zipSha256}</p>}
        <p>{text.ebooks}: {report.requested.ebooks} · {text.audio}: {report.requested.audiobooks} · {text.included}: {report.includedMedia}</p>
        <p>{text.omitted}: {report.omitted.length}</p>
        {!!report.omitted.length && <ul>{report.omitted.map(file => <li key={file.attachmentId}>{file.filename}</li>)}</ul>}
        {!!report.blockedFiles.length && <><p>{text.blocked}</p><ul>{report.blockedFiles.map(file => <li key={file.attachmentId}>{file.filename}</li>)}</ul></>}
      </>}
    </div>
  </section>;
}

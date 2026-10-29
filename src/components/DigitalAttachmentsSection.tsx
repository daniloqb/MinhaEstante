import { useEffect, useId, useMemo, useRef, useSyncExternalStore } from 'react';
import { AlertCircle, BookOpen, CheckCircle, Headphones, LoaderCircle, RefreshCw, Upload } from 'lucide-react';
import type { Book } from '../types/book';
import type { AttachmentType } from '../types/digitalMedia';
import type { WoodPalette } from '../theme/woodTheme';
import type { LocaleId, Translations } from '../i18n/types';
import { useI18n } from '../i18n/I18nContext';
import { PaperCard } from './PaperCard';
import { attachmentsPresentation, type AttachmentConfirmation, type AttachmentsViewState } from '../services/storage/digital/attachmentsPresentation';
import type { DigitalStorageErrorCode } from '../services/storage/digital/contracts';

type Text = Translations['attachments'];
export function attachmentErrorText(code: DigitalStorageErrorCode | undefined, t: Text): string {
  switch (code) {
    case 'FILE_NOT_FOUND': return t.missing;
    case 'FILE_UNAVAILABLE': case 'NOT_CONFIGURED': return t.unavailable;
    case 'PERMISSION_REQUIRED': case 'PERMISSION_DENIED': case 'PERMISSION_REVOKED': return t.permission;
    case 'INVALID_FILE': return t.invalid;
    case 'UNSUPPORTED_FORMAT': return t.unsupported;
    case 'PROVIDER_UNAVAILABLE': case 'UNSUPPORTED_OPERATION': case 'PROVIDER_MISMATCH': return t.providerUnavailable;
    case 'INSUFFICIENT_SPACE': return t.quota;
    case 'INTEGRITY_MISMATCH': return t.integrityFailure;
    case 'LINK_PERSISTENCE_FAILED': return t.persistenceFailed;
    case 'RECOVERY_REQUIRED': return t.pending;
    case 'ATTACHMENT_CONFLICT': case 'OPERATION_CONFLICT': return t.conflict;
    case 'POSITION_POLICY_REQUIRED': return t.positionChanged;
    default: return t.failed;
  }
}
export function attachmentSize(bytes: number, locale: LocaleId) {
  const index = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(bytes / 1024 ** index)} ${['B', 'KiB', 'MiB', 'GiB'][index]}`;
}
export function attachmentProgress(state: AttachmentsViewState) {
  const p = state.busy?.progress;
  return p && p.totalBytes && p.totalBytes > 0 ? Math.min(100, Math.floor(p.bytesProcessed / p.totalBytes * 100)) : undefined;
}
interface ViewProps {
  state: AttachmentsViewState;
  palette: WoodPalette;
  locale: LocaleId;
  t: Text;
  loadingText: string;
  onAdd: (type: AttachmentType) => void;
  onConfigure: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onReplace?: (type: AttachmentType) => void;
  onDetach?: (type: AttachmentType) => void;
  onVerify?: (type: AttachmentType) => void;
  onRecover?: (type: AttachmentType) => void;
  onConfirm?: () => void;
  onDismiss?: () => void;
}
export function AttachmentConfirmationDialog({ confirmation, palette, t, onConfirm, onDismiss, returnFocusId, returnFocusElement }: {
  confirmation: AttachmentConfirmation; palette: WoodPalette; t: Text; onConfirm: () => void; onDismiss: () => void; returnFocusId: string;
  returnFocusElement?: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current, opener = returnFocusElement ?? document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected && !(opener as HTMLButtonElement).disabled) opener.focus();
      else document.getElementById(returnFocusId)?.focus();
    };
  }, [returnFocusId, returnFocusElement]);
  const replace = confirmation.kind === 'replace';
  const buttonClass = 'min-h-11 px-4 py-2 rounded-lg font-sans font-semibold text-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  return <dialog ref={ref} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onDismiss(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }}
    className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border p-0 shadow-2xl backdrop:bg-black/65 backdrop:backdrop-blur-xs"
    style={{ backgroundColor: palette.paperSurface, color: palette.textOnPaper, borderColor: palette.woodBorder }}>
    <PaperCard palette={palette} elevated className="flex flex-col gap-4 !border-0">
      <h2 id={titleId} className="font-serif text-2xl font-bold">{replace ? t.confirmReplace : t.confirmDetach}</h2>
      <div id={descriptionId} className="flex flex-col gap-3 font-sans text-sm leading-relaxed [overflow-wrap:anywhere]">
        <p>{confirmation.previous.type === 'ebook' ? t.ebook : t.audiobook}</p>
        <p><strong>{t.previousFile}: </strong>{confirmation.previous.filename} · {confirmation.previous.format.toUpperCase()}</p>
        {replace ? <>
          <p><strong>{t.newFile}: </strong>{confirmation.imported.metadata.filename} · {confirmation.imported.metadata.format.toUpperCase()}</p>
          <p>{confirmation.identical ? t.identical : t.different}</p>
          <p>{confirmation.identical ? t.positionPreserved : confirmation.hasPosition ? t.positionInvalidated : t.noPosition}</p>
        </> : <><p>{t.detachNotice}</p><p>{confirmation.hasPosition ? t.positionRemoved : t.noPosition}</p></>}
        <p>{t.historyPreserved}</p><p>{t.retentionNotice}</p>
        {replace && <p>{t.preparedNotice}</p>}
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button type="button" autoFocus onClick={onDismiss} className={`${buttonClass} border`} style={{ borderColor: palette.woodBorder, outlineColor: palette.woodBorder }}>{t.cancelAction}</button>
        <button type="button" onClick={onConfirm} className={buttonClass} style={{ backgroundColor: palette.woodDark, color: palette.textOnWood, outlineColor: palette.woodBorder }}>{replace ? t.confirmReplace : t.confirmDetach}</button>
      </div>
    </PaperCard>
  </dialog>;
}
/** Presentational view: no file APIs, storage writes or duplicated domain decisions. */
export function DigitalAttachmentsView({ state, palette, locale, t, loadingText, onAdd, onConfigure, onCancel, onRefresh,
  onReplace, onDetach, onVerify, onRecover, onConfirm, onDismiss }: ViewProps) {
  const sectionTitleId = useId();
  const actionTrigger = useRef<HTMLElement | null>(null);
  const buttonClass = 'min-h-11 px-4 py-2 rounded-lg font-sans text-sm font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-default focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:brightness-95';
  const buttonStyle = { backgroundColor: palette.woodDark, color: palette.textOnWood, outlineColor: palette.woodBorder };
  const percent = attachmentProgress(state);
  const feedback = state.feedback;
  const message = feedback?.kind === 'success' ? feedback.message ? t[feedback.message] : t.completed : feedback?.kind === 'cancelled' ? t.cancelled
    : feedback ? attachmentErrorText(feedback.code, t) : '';
  return <section aria-label={t.title} aria-busy={state.loading || !!state.busy} className="min-w-0 w-full">
    <PaperCard palette={palette} elevated className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={sectionTitleId} tabIndex={-1} className="font-serif text-2xl font-bold" style={{ color: palette.textOnPaper }}>{t.title}</h2>
        <button type="button" onClick={onRefresh} disabled={state.loading || !!state.busy} className={`${buttonClass} inline-flex items-center gap-2 border`} style={{ color: palette.textOnPaper, borderColor: palette.paperBorder, outlineColor: palette.woodBorder }}>
          <RefreshCw size={16} aria-hidden="true" />{t.refresh}
        </button>
      </div>
      <p className="font-sans text-sm leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>{t.backupNotice}</p>
      {state.loading && <p role="status" className="font-sans text-sm">{loadingText}</p>}
      {!state.loading && !state.persisted && <p className="font-sans text-sm">{t.saveFirst}</p>}
      {!state.loading && state.persisted && state.supported && !state.configured && state.needsConfiguration !== false && <div className="flex flex-col items-start gap-2">
        <p className="font-sans text-sm">{t.prepareHint}</p>
        <button type="button" className={buttonClass} style={buttonStyle} disabled={!!state.busy} onClick={onConfigure}>{t.prepare}</button>
      </div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0" aria-busy={state.loading}>
        {(['ebook', 'audiobook'] as const).map(type => {
          const item = state.items.find(row => row.attachment.type === type);
          const Icon = type === 'ebook' ? BookOpen : Headphones;
          const label = type === 'ebook' ? t.ebook : t.audiobook;
          const disabled = state.loading || !state.persisted || !state.manageable || !!state.busy || state.pending.includes(type);
          return <div key={type} data-attachment-slot={type} className="min-w-0 rounded-xl border p-4 flex flex-col gap-3" style={{ backgroundColor: palette.paperSurface, borderColor: palette.paperBorder }}>
            <h3 className="font-serif text-xl font-bold flex items-center gap-2"><Icon size={21} aria-hidden="true" />{label}</h3>
            {item ? <>
              <p className="font-sans text-base font-semibold [overflow-wrap:anywhere]" title={item.attachment.filename}>{item.attachment.filename}</p>
              <p className="font-sans text-sm" style={{ color: palette.textSecondaryOnPaper }}>{item.attachment.format.toUpperCase()} · {attachmentSize(item.attachment.sizeBytes, locale)}</p>
              <p className="font-sans text-sm flex items-start gap-2">
                {item.availability === 'available' ? <CheckCircle size={17} className="shrink-0 mt-0.5" aria-hidden="true" /> : <AlertCircle size={17} className="shrink-0 mt-0.5" aria-hidden="true" />}
                {t[item.availability]}
              </p>
              <p className="font-sans text-sm" style={{ color: palette.textSecondaryOnPaper }}>{item.integrity === 'failed' ? t.integrityFailure : item.integrity === 'verified' ? t.integrityVerified : item.integrity === 'recorded' ? t.integrityRecorded : t.integrityUnknown}</p>
              {['permission', 'unavailable', 'missing', 'providerUnavailable'].includes(item.availability) && <p className="font-sans text-sm leading-relaxed">{t.accessHelp}</p>}
              <details className="font-sans text-sm mt-auto">
                <summary className={`${buttonClass} border list-inside`} style={{ borderColor: palette.paperBorder, outlineColor: palette.woodBorder }}>{t.manage}</summary>
                <div role="group" aria-label={`${label} · ${item.attachment.filename}`} className="flex flex-col gap-2 pt-2">
                  <button type="button" onClick={event => { actionTrigger.current = event.currentTarget; onReplace?.(type); }} disabled={disabled || !state.configured || !state.supported || !onReplace} className={buttonClass} style={buttonStyle}>{t.replace}</button>
                  <button type="button" onClick={() => onVerify?.(type)} disabled={disabled || !onVerify} className={`${buttonClass} border`} style={{ borderColor: palette.paperBorder, outlineColor: palette.woodBorder }}>{item.availability === 'available' ? t.verify : t.retry}</button>
                  <button type="button" onClick={event => { actionTrigger.current = event.currentTarget; onDetach?.(type); }} disabled={disabled || !onDetach} className={`${buttonClass} border`} style={{ borderColor: palette.paperBorder, outlineColor: palette.woodBorder }}>{t.detach}</button>
                </div>
              </details>
            </> : <>
              <p className="font-sans text-sm leading-relaxed" style={{ color: palette.textSecondaryOnPaper }}>{type === 'ebook' ? t.noEbook : t.noAudiobook}</p>
              <p className="font-sans text-sm" style={{ color: palette.textSecondaryOnPaper }}>{type === 'ebook' ? 'EPUB · PDF' : 'MP3 · M4A · M4B'}</p>
              {state.pending.includes(type) && <p className="font-sans text-sm">{t.pending}</p>}
              <button type="button" onClick={() => onAdd(type)} disabled={state.loading || !state.persisted || !state.configured || !state.supported || !!state.busy || state.pending.includes(type)}
                className={`${buttonClass} mt-auto w-full inline-flex items-center justify-center gap-2`} style={buttonStyle}>
                <Upload size={17} className="shrink-0" aria-hidden="true" />{type === 'ebook' ? t.addEbook : t.addAudiobook}
              </button>
            </>}
            {state.recoverable?.includes(type) && onRecover && <button type="button" onClick={() => onRecover(type)} disabled={state.loading || !!state.busy} className={`${buttonClass} border`} style={{ borderColor: palette.paperBorder }}>{t.recover}</button>}
          </div>;
        })}
      </div>
      {state.busy && <div className="rounded-lg border p-3 flex flex-col gap-2 min-w-0" style={{ borderColor: palette.paperBorder }}>
        <p role="status" aria-live="polite" aria-atomic="true" className="font-sans text-sm font-semibold flex gap-2 items-center">
          <LoaderCircle size={18} className="animate-spin shrink-0" aria-hidden="true" />{state.busy.cancelling ? t.cancelling : t[state.busy.stage]}
        </p>
        {state.busy.filename && <p className="font-sans text-sm [overflow-wrap:anywhere]">{state.busy.filename}</p>}
        {state.busy.progress && <>
          <progress aria-label={t[state.busy.stage]} max={100} value={percent} className="w-full h-3" style={{ accentColor: palette.woodBorder }} />
          <p className="font-sans text-sm tabular-nums" aria-live="off">{attachmentSize(state.busy.progress.bytesProcessed, locale)}{state.busy.progress.totalBytes ? ` / ${attachmentSize(state.busy.progress.totalBytes, locale)}` : ''}{percent !== undefined ? ` · ${percent}%` : ''}</p>
        </>}
        {state.canCancel && <button type="button" onClick={onCancel} disabled={state.busy.cancelling} className={`${buttonClass} self-start border`} style={{ color: palette.textOnPaper, borderColor: palette.woodBorder }}>{t.cancelAction}</button>}
      </div>}
      <p role="status" aria-live="polite" aria-atomic="true" className={message ? 'font-sans text-sm leading-relaxed flex items-start gap-2' : 'sr-only'}>
        {message && (feedback?.kind === 'success' ? <CheckCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" /> : <AlertCircle size={18} className="shrink-0 mt-0.5" aria-hidden="true" />)}{message}
      </p>
      {state.confirmation && onConfirm && onDismiss && <AttachmentConfirmationDialog confirmation={state.confirmation} palette={palette} t={t} onConfirm={onConfirm} onDismiss={onDismiss} returnFocusId={sectionTitleId} returnFocusElement={actionTrigger.current} />}
    </PaperCard>
  </section>;
}
export default function DigitalAttachmentsSection({ book, palette }: { book: Book; palette: WoodPalette }) {
  const { t, locale } = useI18n();
  const presentation = useMemo(() => attachmentsPresentation(book), [book.id, book.uuid]);
  const state = useSyncExternalStore(presentation.subscribe, presentation.getSnapshot, presentation.getSnapshot);
  useEffect(() => {
    void presentation.refresh();
    const refresh = () => { if (document.visibilityState === 'visible') void presentation.refresh(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [presentation]);
  const pending = state.pending.join(',');
  useEffect(() => {
    if (!pending || state.busy) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void presentation.refresh(); }, 2500);
    return () => clearInterval(timer);
  }, [presentation, pending, !!state.busy]);
  return <DigitalAttachmentsView state={state} palette={palette} locale={locale} t={t.attachments} loadingText={t.common.loading}
    onAdd={type => { void presentation.add(type); }} onConfigure={() => { void presentation.configure(); }}
    onCancel={presentation.cancel} onRefresh={() => { void presentation.refresh(); }} onReplace={type => { void presentation.replace(type); }}
    onDetach={type => { void presentation.requestDetach(type); }} onVerify={type => { void presentation.verify(type); }}
    onRecover={type => { void presentation.recover(type); }} onConfirm={() => { void presentation.confirm(); }} onDismiss={presentation.cancelConfirmation} />;
}

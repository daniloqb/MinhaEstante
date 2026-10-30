import JSZip from 'jszip';
import { IncrementalSha256 } from '../../digital/web/sha256';
import type { BackupArchiveFile, BackupMediaEntry, BackupReadingData, BackupV2Manifest, DigitalBackupOptions } from '../contracts';
import { planBackupExport } from '../planning';
import { backupMediaPath } from '../validation';
import { boundedBlobStream, PROOF_CHUNK_BYTES } from './streamingProof';
import type { ProofInput, ProofSource } from './streamingProof';

const encoder = new TextEncoder();
const uuids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'];
export function blobProofSource(archivePath: string, bytes: Blob): ProofSource {
  return { archivePath, sizeBytes: bytes.size, open: () => boundedBlobStream(bytes) };
}
/** Valid PDF with a real xref and an unused binary stream, generated without a file-sized array. */
export function syntheticPdfSource(paddingBytes: number): ProofSource {
  if (!Number.isSafeInteger(paddingBytes) || paddingBytes < 0 || paddingBytes > 256 * 1024 ** 2) throw new Error('Synthetic size outside the proof budget');
  let head = '%PDF-1.4\n'; const offsets = [0];
  const object = (value: string) => { offsets.push(encoder.encode(head).length); head += `${offsets.length - 1} 0 obj\n${value}\nendobj\n`; };
  object('<< /Type /Catalog /Pages 2 0 R >>');
  object('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>');
  object('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const content = 'BT /F1 12 Tf 30 150 Td (Synthetic ZIP proof) Tj ET';
  object(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  offsets.push(encoder.encode(head).length);
  head += `6 0 obj\n<< /Length ${paddingBytes} >>\nstream\n`;
  const suffix = '\nendstream\nendobj\n', prefix = encoder.encode(head);
  const xref = prefix.length + paddingBytes + suffix.length;
  const tail = encoder.encode(`${suffix}xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return { archivePath: 'media/ebooks/proof-pdf.pdf', sizeBytes: prefix.length + paddingBytes + tail.length,
    open() {
      let phase = 0, left = paddingBytes, seed = 0x12345678;
      return new ReadableStream<Uint8Array>({ pull(controller) {
        if (phase === 0) { phase++; controller.enqueue(prefix); return; }
        if (left > 0) {
          const bytes = new Uint8Array(Math.min(left, PROOF_CHUNK_BYTES));
          for (let i = 0; i < bytes.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; bytes[i] = seed & 255; }
          left -= bytes.length; controller.enqueue(bytes); return;
        }
        if (phase === 1) { phase++; controller.enqueue(tail); return; }
        controller.close();
      } }, { highWaterMark: 1 });
    } };
}
export async function describeProofSource(source: ProofSource): Promise<BackupArchiveFile> {
  const sha = new IncrementalSha256(); let sizeBytes = 0;
  const reader = (await source.open()).getReader();
  try { while (true) { const next = await reader.read(); if (next.done) break; sha.update(next.value); sizeBytes += next.value.length; } }
  finally { reader.releaseLock(); }
  return { archivePath: source.archivePath, sizeBytes, sha256: sha.hex() };
}
async function syntheticEpub() {
  const zip = new JSZip(), date = new Date('2000-01-01T00:00:00Z');
  const entry = (path: string, text: string, stored = false) => zip.file(path, text, { date, compression: stored ? 'STORE' : 'DEFLATE', createFolders: false });
  entry('mimetype', 'application/epub+zip', true);
  entry('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  entry('content.opf', '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:10000000-0000-4000-8000-000000000001</dc:identifier><dc:title>Prova sintética</dc:title><dc:language>pt-BR</dc:language><meta property="dcterms:modified">2026-10-29T00:00:00Z</meta></metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>');
  entry('chapter.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Prova</title></head><body><p>Leitura sintética.</p></body></html>');
  entry('nav.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Sumário</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">Capítulo</a></li></ol></nav></body></html>');
  return new Blob([await zip.generateAsync({ type: 'uint8array' }) as BlobPart], { type: 'application/epub+zip' });
}
/** Only small fixtures are materialized. The stress PDF remains a reopenable generator. */
export async function syntheticProofInput(paddingBytes = 0, options: DigitalBackupOptions = { includeEbooks: true, includeAudiobooks: true }): Promise<ProofInput> {
  if (!options.includeEbooks && !options.includeAudiobooks) throw new Error('Both unchecked must route to the unchanged legacy service');
  const pdf = syntheticPdfSource(paddingBytes);
  const mp3 = new Uint8Array(417 * 100);
  for (let i = 0; i < 100; i++) mp3.set([255, 251, 144, 0], i * 417); // Valid MPEG-1 Layer III silent frames, as in the existing native fixture.
  const sources = [blobProofSource('media/ebooks/proof-epub.epub', await syntheticEpub()), pdf,
    blobProofSource('media/audiobooks/proof-mp3.mp3', new Blob([mp3], { type: 'audio/mpeg' }))];
  const descriptors = await Promise.all(sources.map(describeProofSource));
  const media: BackupMediaEntry[] = descriptors.map((file, i) => {
    const type = i === 2 ? 'audiobook' : 'ebook', format = i === 0 ? 'epub' : i === 1 ? 'pdf' : 'mp3';
    const id = i === 0 ? 'proof-epub' : i === 1 ? 'proof-pdf' : 'proof-mp3';
    const selected = type === 'ebook' ? options.includeEbooks : options.includeAudiobooks;
    const common = { id, bookUuid: i === 1 ? uuids[1] : uuids[0], type, format, filename: `Obra sintética — ação 日本語.${format}`,
      sizeBytes: file.sizeBytes, sha256: file.sha256, createdAt: 1, updatedAt: 2 } as const;
    return selected ? { ...common, state: 'included', archivePath: backupMediaPath(id, type, format) }
      : { ...common, state: 'omitted', reason: 'category-not-selected' };
  });
  const books = uuids.map((uuid, i) => ({ id: i + 1, uuid, origem: 'manual', titulo: `Prova sintética ${i + 1} — 日本語`, autores: ['Autor sintético'], generos: [],
    tenho_fisico: false, formato: 'fisico', formatos: ['fisico'], status_leitura: 'quero_ler', nota: 8, dataCadastro: 1, dataAtualizacao: 2,
    capaLocalPath: i === 0 ? 'covers/proof.png' : null }));
  const reading: BackupReadingData = { readerPositions: options.includeEbooks ? [{ id: 'proof-position', attachmentId: 'proof-epub', locationType: 'epub_cfi', location: 'epubcfi(/6/2)', updatedAt: 2 }] : [],
    sessions: [{ id: 'proof-session', bookUuid: uuids[0], status: 'active', startedAt: 1, updatedAt: 2 }],
    progress: [{ id: 'proof-progress', sessionId: 'proof-session', unit: 'pages', currentValue: 3, totalValue: 20, source: 'manual', updatedAt: 2 }] };
  const json = (path: string, value: unknown) => blobProofSource(path, new Blob([JSON.stringify(value)]));
  // Generated 1x1 RGBA PNG, including valid CRCs; no personal cover or fixture download.
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,11,73,68,65,84,120,156,99,96,0,2,0,0,5,0,1,122,94,171,63,0,0,0,0,73,69,78,68,174,66,96,130]);
  const payloads = [json('books.json', books), json('reading.json', reading), blobProofSource('covers/proof.png', new Blob([png]))];
  const [bibliography, readingFile, cover] = await Promise.all(payloads.map(describeProofSource));
  const plan = planBackupExport({ bookUuids: uuids, coversCount: 1, options, attachments: media.map(attachment => ({ attachment, availability: 'accessible' })) });
  if (!plan.valid || plan.value.format !== 'v2') throw new Error('Invalid synthetic plan');
  const manifest: BackupV2Manifest = { format: 'minhaestante-backup', backupVersion: 2, backupId: `proof-synthetic-${paddingBytes}`,
    createdAt: '2026-10-29T18:00:00Z', options, counts: { books: 2, covers: 1, eligibleMedia: 3,
      includedMedia: media.filter(entry => entry.state === 'included').length, omittedMedia: media.filter(entry => entry.state === 'omitted').length, unavailableMedia: 0 },
    bibliography: { ...bibliography, archivePath: 'books.json' }, reading: { ...readingFile, archivePath: 'reading.json' }, covers: [cover], media, acknowledgedOmissions: [] };
  return { manifest, bookUuids: uuids, sources: [...payloads, ...sources.filter(source => media.some(entry => entry.state === 'included' && entry.archivePath === source.archivePath))] };
}

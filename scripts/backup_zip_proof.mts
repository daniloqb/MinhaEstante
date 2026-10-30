/** Synthetic filesystem runner. Never imports the app, catalog or production backup service. */
import { createReadStream, createWriteStream, openAsBlob } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { syntheticProofInput } from '../src/services/storage/backupV2/experimental/syntheticDataset';
import { verifyProofZip, writeProofZip } from '../src/services/storage/backupV2/experimental/streamingProof';
import { backupManifestFiles, validateBackupFileIntegrity } from '../src/services/storage/backupV2/validation';

const [mode, rootArg] = process.argv.slice(2);
const root = resolve(rootArg ?? '/tmp/minhaestante-4-2a-proof');
if (!/^\/tmp\/minhaestante-4-2a-[a-zA-Z0-9_-]+$/.test(root)) throw new Error('An exclusive /tmp/minhaestante-4-2a-* root is required');
if (mode === 'prepare') {
  await mkdir(root, { recursive: true });
  const prior = await readdir(root);
  if (prior.length) throw new Error('prepare requires a new empty synthetic root');
  await writeFile(join(root, 'proof-root.json'), JSON.stringify({ label: 'Backup v2 — Streaming Proof of Concept', version: 1 }));
  const sizes = [0, 1024 ** 2, 16 * 1024 ** 2, 64 * 1024 ** 2, 128 * 1024 ** 2];
  await writeFile(join(root, 'sizes.json'), JSON.stringify(sizes));
  for (const size of sizes) {
    const input = await syntheticProofInput(size), directory = join(root, `input-${size}`);
    await mkdir(directory);
    for (const source of input.sources) {
      const file = join(directory, source.archivePath); await mkdir(resolve(file, '..'), { recursive: true });
      await pipeline(Readable.fromWeb(await source.open() as never), createWriteStream(file, { flags: 'wx' }));
    }
    await writeFile(join(directory, 'manifest.json'), JSON.stringify(input.manifest));
    console.log(JSON.stringify({ preparedPaddingBytes: size, files: input.sources.length + 1, media: input.manifest.media.map(file => ({ id: file.id, sizeBytes: file.sizeBytes, sha256: file.sha256 })) }));
    if (size === 0) {
      for (const forceZip64 of [false, true]) {
        const filename = `web-node-${forceZip64 ? 'zip64' : 'small'}.zip`;
        const output = Writable.toWeb(createWriteStream(join(root, filename), { flags: 'wx' })) as WritableStream<Uint8Array>;
        const metrics = await writeProofZip(input, output, { forceZip64 });
        const verified = await verifyProofZip(await openAsBlob(join(root, filename)));
        await writeFile(join(root, filename.replace('.zip', '.json')), JSON.stringify({ metrics, verified }, null, 2));
      }
    }
  }
} else if (mode === 'verify') {
  const marker = JSON.parse(await readFile(join(root, 'proof-root.json'), 'utf8'));
  if (marker.version !== 1) throw new Error('Unknown synthetic root');
  const results = [];
  for (const filename of (await readdir(root)).filter(name => /^(kotlin|web)-(?!.*count).*\.zip$/.test(name)).sort()) {
    const verified = await verifyProofZip(await openAsBlob(join(root, filename)));
    const result = { filename, inputBytes: verified.inputBytes, maxChunk: verified.maxChunk, entries: verified.entries };
    results.push(result); console.log(JSON.stringify({ filename, passed: true, inputBytes: verified.inputBytes, maxChunk: verified.maxChunk }));
  }
  // JVM reader returns observations, which are checked against the SAME v2 integrity contract.
  const reportNames = ['kotlin-read-report.json'];
  if ((await readdir(root)).includes('android-read-web-report.json')) reportNames.push('android-read-web-report.json');
  let comparedArchives = 0;
  for (const reportName of reportNames) {
    const nativeReport = JSON.parse(await readFile(join(root, reportName), 'utf8')) as { filename: string; entries: { archivePath: string; sizeBytes: number; sha256: string }[] }[];
    for (const report of nativeReport.filter(report => !report.filename.includes('count'))) {
      if (!/^(kotlin|web)-[a-zA-Z0-9_.-]+\.zip$/.test(report.filename)) throw new Error('Unknown synthetic artifact');
      const web = await verifyProofZip(await openAsBlob(join(root, report.filename)));
      for (const expected of backupManifestFiles(web.manifest)) {
        const actual = report.entries.find(entry => entry.archivePath === expected.archivePath);
        if (!actual || !validateBackupFileIntegrity(expected, { archivePath: actual.archivePath, sizeBytes: actual.sizeBytes, checksum: { algorithm: 'sha256', value: actual.sha256 } }).valid) throw new Error('JVM/Web semantic mismatch');
      }
      comparedArchives++;
    }
  }
  await writeFile(join(root, 'web-read-report.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ semanticComparison: 'passed', reports: reportNames, comparedArchives }));
} else if (mode === 'copy') {
  // Explicit synthetic artifact transfer; streaming, no whole-file buffer.
  const [from, to] = process.argv.slice(4);
  if (!from || !to || !from.startsWith(root + '/') || !to.startsWith(root + '/')) throw new Error('Only proof-owned files');
  await pipeline(createReadStream(from), createWriteStream(to, { flags: 'wx' }));
} else throw new Error('Usage: tsx scripts/backup_zip_proof.mts prepare|verify /tmp/minhaestante-4-2a-ROOT');

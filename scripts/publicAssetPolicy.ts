import fs from 'node:fs';
import path from 'node:path';

/** Fail closed before publishing imported private fixtures or signing material. Never log their names. */
export function assertPublicAssetsSafe(root: string): void {
  if (!fs.existsSync(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (/\.(?:zip|apk|aab|jks|keystore|p12|key|env|base64)$/i.test(entry.name) || entry.name === '.env'
      || entry.name.startsWith('.env.') || entry.name === 'aistudio') {
      // Empty legacy import directories are harmless.
      if (entry.isDirectory() && fs.readdirSync(path.join(root, entry.name)).length === 0) continue;
      throw new Error('Private/imported files are forbidden in public assets. Preserve them outside the repository.');
    }
    if (entry.isSymbolicLink()) throw new Error('Public asset symlinks require removal before publishing.');
    if (entry.isDirectory()) assertPublicAssetsSafe(path.join(root, entry.name));
  }
}

/** Old packages can contain a removed public fixture. Inspect entries before offering a download. */
export async function assertAndroidPackageSafe(file: string): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(await fs.promises.readFile(file));
  if (Object.keys(zip.files).some((entry) => /(?:^|\/)aistudio\//i.test(entry)
    || /(?:^|\/)(?:\.env(?:\.[^/]*)?|[^/]+\.(?:zip|jks|keystore|p12|key|base64))$/i.test(entry))) {
    throw new Error('Package contains private/imported assets and cannot be published.');
  }
}

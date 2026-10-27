import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { assertAndroidPackageSafe, assertPublicAssetsSafe } from '../../scripts/publicAssetPolicy';

describe('publication guard', () => {
  it('allows ordinary nested application icons', () => {
    const root = mkdtempSync(join(tmpdir(), 'public-policy-'));
    try { mkdirSync(join(root, 'icons')); writeFileSync(join(root, 'icons', 'app.svg'), '<svg/>'); expect(() => assertPublicAssetsSafe(root)).not.toThrow(); }
    finally { rmSync(root, { recursive: true }); }
  });
  it('blocks packages with private imports and allows sanitized packages', async () => {
    const root = mkdtempSync(join(tmpdir(), 'package-policy-'));
    try {
      const zip = new JSZip(); zip.file('assets/public/index.html', '<html/>');
      const file = join(root, 'synthetic.apk'); writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
      await expect(assertAndroidPackageSafe(file)).resolves.toBeUndefined();
      zip.file('assets/public/assets/aistudio/private.zip', 'synthetic');
      writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer' }));
      await expect(assertAndroidPackageSafe(file)).rejects.toThrow('private/imported');
    } finally { rmSync(root, { recursive: true }); }
  });
  it.each(['private.zip', 'signing.JKS', 'signing.keystore', '.env', '.env.production', 'signing.key', 'aistudio'])('blocks %s before copying public assets', (name) => {
    const root = mkdtempSync(join(tmpdir(), 'public-policy-'));
    try { writeFileSync(join(root, name), 'synthetic'); expect(() => assertPublicAssetsSafe(root)).toThrow('Private/imported files'); }
    finally { rmSync(root, { recursive: true }); }
  });
});

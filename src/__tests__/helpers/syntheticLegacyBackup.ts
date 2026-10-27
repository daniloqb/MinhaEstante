import JSZip from 'jszip';

/** Generated, nonpersonal legacy fixture; distributions never need a user's backup. */
export async function syntheticLegacyBackup(): Promise<Uint8Array> {
  const zip = new JSZip();
  const books = Array.from({ length: 215 }, (_, i) => ({
    id: i + 1, origem: 'manual', titulo: `Synthetic legacy ${i + 1}`, autores: ['Synthetic author'], generos: [],
    formato: 'fisico', tenho_fisico: i < 26 || i >= 100,
    status_leitura: i < 97 ? 'lido' : i < 100 ? 'quero_ler' : 'nenhum',
    anoLeitura: i < 97 ? 2020 : undefined, mesLeitura: i < 97 ? 2 : undefined, nota: i % 10 + 1,
    dataCadastro: 1000 + i, dataAtualizacao: 2000 + i,
    ...(i < 207 ? { capaLocalPath: `covers/synthetic-${i + 1}.jpg` } : {}),
  }));
  // A tiny generated JPEG-shaped binary; tests check byte preservation, not image decoding.
  const cover = new Uint8Array(160).fill(42); cover.set([255, 216, 255]); cover.set([255, 217], 158);
  books.forEach((book) => { if (book.capaLocalPath) zip.file(book.capaLocalPath, cover); });
  zip.file('manifest.json', JSON.stringify({ appId: 'com.booknookapp', appName: 'Booknook', version: 1,
    schemaVersion: 2, booksCount: 215, coversCount: 207, exportedAt: new Date(0).toISOString() }));
  zip.file('books.json', JSON.stringify(books));
  return zip.generateAsync({ type: 'uint8array' });
}

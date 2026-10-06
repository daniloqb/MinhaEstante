import { Book } from '../types/book';

const BACKUP_FILENAME = 'minha-estante-backup.json';

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

export interface SyncResult {
  success: boolean;
  mergedBooks: Book[];
  addedFromDrive: number;
  uploadedToDrive: number;
  lastSyncTime: number;
  message: string;
}

/**
 * Procura pelo arquivo minha-estante-backup.json no Google Drive do usuário
 */
export async function findDriveBackupFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`);
  // Removemos espaços estritos para máxima compatibilidade com o escopo restrito drive.file
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,size)&pageSize=10`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const rawMsg = errorBody?.error?.message || '';
    if (
      res.status === 403 &&
      (rawMsg.toLowerCase().includes('scope') ||
        rawMsg.toLowerCase().includes('insufficient') ||
        rawMsg.toLowerCase().includes('permission'))
    ) {
      throw new Error(
        'Permissão insuficiente para o Google Drive. A sua conta Google conectou, mas a caixinha de permissão para salvar arquivos no Google Drive não foi marcada. Toque em "Sair" e conecte novamente marcando a caixinha de autorização.'
      );
    }
    if (res.status === 401) {
      throw new Error('Sua sessão com o Google expirou. Por favor, conecte-se novamente.');
    }
    throw new Error(rawMsg || `Erro ao consultar Google Drive (${res.status})`);
  }

  const data = await res.json();
  const files: DriveFileInfo[] = data.files || [];
  return files.length > 0 ? files[0] : null;
}

/**
 * Baixa o conteúdo do backup do Google Drive
 */
export async function downloadDriveBackup(accessToken: string, fileId: string): Promise<Book[]> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Erro ao baixar arquivo do Google Drive (${res.status})`);
  }

  const jsonText = await res.text();
  try {
    const parsed = JSON.parse(jsonText);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && Array.isArray(parsed.books)) {
      return parsed.books;
    }
    return [];
  } catch {
    throw new Error('O arquivo de backup no Google Drive não está em um formato JSON válido.');
  }
}

/**
 * Salva ou atualiza o arquivo de backup no Google Drive do usuário
 */
export async function uploadDriveBackup(
  accessToken: string,
  books: Book[],
  existingFileId?: string | null
): Promise<DriveFileInfo> {
  const fileContent = JSON.stringify(books, null, 2);

  if (existingFileId) {
    // Atualizar arquivo existente
    const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`;
    const res = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: fileContent,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const rawMsg = err?.error?.message || '';
      if (
        res.status === 403 &&
        (rawMsg.toLowerCase().includes('scope') ||
          rawMsg.toLowerCase().includes('insufficient') ||
          rawMsg.toLowerCase().includes('permission'))
      ) {
        throw new Error(
          'Permissão insuficiente para atualizar no Google Drive. Toque em Sair e conecte novamente autorizando o salvamento de arquivos.'
        );
      }
      throw new Error(rawMsg || `Erro ao atualizar backup no Drive (${res.status})`);
    }

    return await res.json();
  }

  // Criar novo arquivo via upload multipart
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: BACKUP_FILENAME,
    mimeType: 'application/json',
    description: 'Backup pessoal sincronizado pelo aplicativo Minha Estante',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const rawMsg = err?.error?.message || '';
    if (
      res.status === 403 &&
      (rawMsg.toLowerCase().includes('scope') ||
        rawMsg.toLowerCase().includes('insufficient') ||
        rawMsg.toLowerCase().includes('permission'))
    ) {
      throw new Error(
        'Permissão insuficiente para criar arquivo no Google Drive. Toque em Sair e conecte novamente autorizando o salvamento de arquivos.'
      );
    }
    throw new Error(rawMsg || `Erro ao criar arquivo no Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Mescla livros locais com livros vindos do Google Drive sem perda de dados
 */
export function mergeBooks(localBooks: Book[], remoteBooks: Book[]): {
  merged: Book[];
  addedFromRemote: number;
  uploadedToRemote: number;
} {
  const mergedMap = new Map<number, Book>();

  // 1. Carrega locais
  for (const b of localBooks) {
    mergedMap.set(b.id, b);
  }

  let addedFromRemote = 0;

  // 2. Mescla com remotos
  for (const rb of remoteBooks) {
    const local = mergedMap.get(rb.id);
    if (!local) {
      // Livro novo que existia no Drive e não no local
      mergedMap.set(rb.id, rb);
      addedFromRemote++;
    } else {
      // Se ambos têm o livro, mantém a versão com dataAtualizacao mais recente
      const localUpdated = local.dataAtualizacao || local.dataCadastro || 0;
      const remoteUpdated = rb.dataAtualizacao || rb.dataCadastro || 0;

      if (remoteUpdated > localUpdated) {
        mergedMap.set(rb.id, rb);
      }
    }
  }

  const merged = Array.from(mergedMap.values());
  const uploadedToRemote = merged.length - addedFromRemote;

  return { merged, addedFromRemote, uploadedToRemote };
}

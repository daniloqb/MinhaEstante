/**
 * MinhaEstante 2.0 - Fase 1: Fundação de Dados e Arquitetura
 * Modelos para Biblioteca Digital, Posição de Leitura e Acompanhamento Deliberado
 */

// ==========================================
// PARTE A — MODELO DE ARQUIVOS DIGITAIS
// ==========================================

export type AttachmentType = 'ebook' | 'audiobook';

export type AttachmentFormat = 'epub' | 'pdf' | 'mp3' | 'm4a' | 'm4b';

export interface BookAttachment {
  /** Identificador único e imutável (UUID v4) */
  id: string;
  /** Chave estrangeira para books.id */
  bookId: number;

  /** Tipo de anexo digital */
  type: AttachmentType;
  /** Formato do arquivo digital */
  format: AttachmentFormat;

  /** Nome do arquivo original (ex.: 'memorias_postumas.epub') */
  filename: string;
  /** Tipo MIME inferido ou detectado (ex.: 'application/epub+zip') */
  mimeType?: string | null;

  /** Tamanho em bytes do arquivo */
  sizeBytes: number;

  /** Identificador do provedor de armazenamento (ex.: 'saf_document', 'opfs', 'web_local') */
  storageProvider: string;
  /** Referência opaca ou caminho relativo gerenciado pelo provedor */
  storageReference: string;

  /** Checksum de integridade (SHA-256 ou hash de verificação de arquivo) */
  checksum?: string | null;

  createdAt: number;
  updatedAt: number;
}

// ==========================================
// PARTE B — POSIÇÃO DE LEITURA E REPRODUÇÃO
// ==========================================

export type ReaderLocationType = 'epub_cfi' | 'pdf_page' | 'audio_seconds';

export interface ReaderPosition {
  /** Identificador único da posição salva (UUID v4) */
  id: string;
  /** Referência ao anexo digital correspondente (book_attachments.id) */
  attachmentId: string;

  /** Tipo de localização segundo a mídia */
  locationType: ReaderLocationType;

  /** Representação do local (EPUB CFI, número da página, segundos decorridos) */
  location: string;

  updatedAt: number;
}

// ==========================================
// PARTE C — ACOMPANHAMENTO DELIBERADO
// ==========================================

export type ReadingSessionStatus = 'active' | 'completed' | 'abandoned';

export interface ReadingSession {
  /** Identificador único do ciclo de leitura (UUID v4) */
  id: string;
  /** Chave estrangeira para books.id */
  bookId: number;

  /** Situação da sessão */
  status: ReadingSessionStatus;

  /** Timestamp de início deliberado do acompanhamento */
  startedAt: number;
  /** Timestamp de conclusão (quando status === 'completed') */
  completedAt?: number | null;
  /** Timestamp de abandono (quando status === 'abandoned') */
  abandonedAt?: number | null;

  updatedAt: number;
}

export type ProgressUnit = 'pages' | 'percentage' | 'seconds';

export type ProgressSource = 'manual' | 'reader_device';

export interface ReadingProgress {
  /** Identificador único do registro de progresso (UUID v4) */
  id: string;
  /** Chave estrangeira para reading_sessions.id */
  sessionId: string;

  /** Unidade de medida */
  unit: ProgressUnit;
  /** Valor atual atingido */
  currentValue: number;
  /** Total conhecido (páginas totais, 100%, ou duração total em segundos) */
  totalValue?: number | null;

  /** Origem da marcação de progresso */
  source: ProgressSource;

  updatedAt: number;
}

// ==========================================
// VALIDADORES E REGRAS DE DOMÍNIO
// ==========================================

/**
 * Valida se a combinação de tipo e formato de anexo é permitida:
 * - 'ebook' aceita apenas 'epub' ou 'pdf'
 * - 'audiobook' aceita apenas 'mp3', 'm4a' ou 'm4b'
 */
export function isValidAttachmentTypeAndFormat(type: AttachmentType, format: AttachmentFormat): boolean {
  if (type === 'ebook') {
    return format === 'epub' || format === 'pdf';
  }
  if (type === 'audiobook') {
    return format === 'mp3' || format === 'm4a' || format === 'm4b';
  }
  return false;
}

/**
 * Retorna o tipo de localização esperado para um formato de anexo
 */
export function getExpectedLocationTypeForFormat(format: AttachmentFormat): ReaderLocationType {
  switch (format) {
    case 'epub':
      return 'epub_cfi';
    case 'pdf':
      return 'pdf_page';
    case 'mp3':
    case 'm4a':
    case 'm4b':
      return 'audio_seconds';
  }
}

/**
 * Valida se a representação de localização é válida para o respectivo tipo
 */
export function isValidReaderLocation(locationType: ReaderLocationType, location: string): boolean {
  if (!location || typeof location !== 'string') return false;
  const trimmed = location.trim();
  if (trimmed.length === 0) return false;

  switch (locationType) {
    case 'epub_cfi':
      // EPUB CFI estrutural (ex: epubcfi(/6/4[chap01]!/4/2/10)) ou seletor CFI válido
      return trimmed.length >= 2;

    case 'pdf_page': {
      // Número inteiro positivo da página (1-indexed: página 1 em diante)
      const pageNum = Number(trimmed);
      return Number.isInteger(pageNum) && pageNum >= 1;
    }

    case 'audio_seconds': {
      // Tempo decorrido em segundos (ponto flutuante >= 0)
      const seconds = Number(trimmed);
      return !Number.isNaN(seconds) && seconds >= 0;
    }

    default:
      return false;
  }
}

/**
 * Valida valores e limites de ReadingProgress
 */
export function isValidReadingProgress(
  unit: ProgressUnit,
  currentValue: number,
  totalValue?: number | null
): boolean {
  if (typeof currentValue !== 'number' || Number.isNaN(currentValue) || currentValue < 0) {
    return false;
  }

  if (totalValue != null) {
    if (typeof totalValue !== 'number' || Number.isNaN(totalValue) || totalValue < 0) {
      return false;
    }
    if (currentValue > totalValue) {
      return false;
    }
  }

  if (unit === 'percentage') {
    if (currentValue > 100) return false;
    if (totalValue != null && totalValue !== 100) return false;
  }

  return true;
}

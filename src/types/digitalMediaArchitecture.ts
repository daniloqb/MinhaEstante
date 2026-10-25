/**
 * digitalMediaArchitecture.ts
 *
 * Preparação arquitetural para a futura evolução de leitura digital (EPUB/PDF),
 * audiolivros (MP3/M4A/M4B) e acompanhamento deliberado de leitura no MinhaEstante.
 *
 * REGRAS ARQUITETURAIS:
 * 1. A classificação de formatos do livro é independente dos arquivos digitais associados.
 * 2. O modelo bibliográfico NÃO armazena bytes de EPUB, PDF ou áudio. Arquivos residem no filesystem.
 * 3. A futura associação dos arquivos utilizará entidades próprias (no máximo 1 anexo por categoria: 1 e-book + 1 audiolivro).
 * 4. A última posição visitada é independente do status ou acompanhamento deliberado de leitura.
 * 5. Abrir um arquivo NÃO altera automaticamente o status de leitura.
 * 6. O status 'lendo' e histórico de ciclos NÃO apaga leituras concluídas anteriores.
 * 7. Formatos existentes são migrados com total compatibilidade retroativa (preservando 'formato' e 'tenho_fisico').
 * 8. O backup padrão (.json) permanece inalterado e leve, com checkboxes futuros opcionais para inclusão de binários.
 * 9. Serviços de leitor e reprodutor serão independentes, compartilhando apenas infraestrutura de armazenamento.
 */

import { BookFormat, ReadingStatus } from './book';

/**
 * Categorias de anexos digitais suportados.
 * Um livro pode ter no máximo 1 anexo por categoria simultaneamente.
 */
export type DigitalAttachmentCategory = 'ebook' | 'audiobook';

/**
 * Extensões e formatos de mídia digital aceitos
 */
export type EbookFileFormat = 'epub' | 'pdf';
export type AudiobookFileFormat = 'mp3' | 'm4a' | 'm4b';
export type DigitalMediaFormat = EbookFileFormat | AudiobookFileFormat;

/**
 * Entidade descritora de anexo digital (NÃO armazena bytes).
 * O arquivo binário é armazenado fora do SQLite, no sistema de arquivos do dispositivo.
 */
export interface DigitalAttachmentDescriptor {
  /** Identificador único do anexo */
  id: string;

  /** Vínculo com a entidade bibliográfica Book (id da obra) */
  bookId: number;

  /** Categoria do arquivo (e-book ou audiolivro) */
  category: DigitalAttachmentCategory;

  /** Formato do arquivo (epub, pdf, mp3, m4a, m4b) */
  format: DigitalMediaFormat;

  /** Nome original do arquivo importado pelo usuário */
  fileName: string;

  /** Caminho relativo no armazenamento do aplicativo (ex.: 'media/ebooks/123-obra.epub') */
  relativePath: string;

  /** Tamanho do arquivo em bytes para exibição na UI */
  fileSizeBytes: number;

  /** Tipo MIME do arquivo (ex.: 'application/epub+zip', 'audio/mpeg') */
  mimeType: string;

  /** Checksum/hash opcional para integridade em backups e deduplicação */
  checksum?: string | null;

  /** Data de importação do arquivo no dispositivo */
  dataCriacao: number;

  /** Data da última alteração de metadados do anexo */
  dataAtualizacao: number;
}

/**
 * Persistência independente da última posição visitada no E-book (EPUB / PDF).
 * Desacoplada do acompanhamento deliberado de leitura (Regra 4).
 */
export interface EbookLastVisitedPosition {
  attachmentId: string;
  bookId: number;

  /** Localizador Canônico CFI para arquivos EPUB (ex.: 'epubcfi(/6/4[chap01]!/4/2/10/2)') */
  epubCfi?: string | null;

  /** Número da página atual para PDF ou EPUB paginado (1-indexed) */
  pageNumber?: number | null;

  /** Total de páginas conhecidas do documento */
  totalPages?: number | null;

  /** Progresso percentual da leitura (0.0 a 100.0) */
  percentage?: number | null;

  /** Timestamp da última visita */
  updatedAt: number;
}

/**
 * Persistência independente da última posição visitada no Audiolivro (MP3 / M4A / M4B).
 * Desacoplada do acompanhamento deliberado de leitura (Regra 4).
 */
export interface AudiobookLastVisitedPosition {
  attachmentId: string;
  bookId: number;

  /** Posição atual de reprodução em segundos */
  currentTimeSeconds: number;

  /** Duração total do audiolivro em segundos */
  durationSeconds: number;

  /** Velocidade de reprodução escolhida pelo usuário (ex.: 1.0, 1.25, 1.5, 2.0) */
  playbackRate: number;

  /** Timestamp da última reprodução */
  updatedAt: number;
}

/**
 * Histórico e ciclo deliberado de leitura (Regra 6).
 * Permite registrar múltiplas leituras e releituras sem apagar os registros de conclusão anteriores.
 */
export interface ReadingCycle {
  id: string;
  bookId: number;
  dataInicio?: string | null; // YYYY-MM-DD
  dataConclusao?: string | null; // YYYY-MM-DD
  anoConclusao?: number | null;
  mesConclusao?: number | null;
  nota?: number | null; // 0 a 10
  formatoLido?: BookFormat; // Físico, E-book ou Audiolivro
  paginasLidas?: number | null;
  minutosOuvidos?: number | null;
  status: ReadingStatus;
  observacoes?: string | null;
}

/**
 * Opções futuras de exportação/backup (Regra 8).
 * Preserva o comportamento padrão leve (apenas metadados e capas),
 * oferecendo checkboxes opcionais e independentes para e-books e audiolivros.
 */
export interface BackupExportOptions {
  /** Sempre verdadeiro: exporta banco de dados bibliográfico e histórico */
  includeDatabase: true;

  /** Sempre verdadeiro: inclui capas locais já armazenadas no dispositivo */
  includeCovers: boolean;

  /** Opcional: incluir arquivos de e-books associados (EPUB/PDF) */
  includeEbookFiles: boolean;

  /** Opcional: incluir arquivos de audiolivros associados (MP3/M4A/M4B) */
  includeAudiobookFiles: boolean;
}

/**
 * Opções padrão de backup, garantindo que o comportamento existente permaneça intacto
 */
export const DEFAULT_BACKUP_EXPORT_OPTIONS: BackupExportOptions = {
  includeDatabase: true,
  includeCovers: true,
  includeEbookFiles: false,
  includeAudiobookFiles: false,
};

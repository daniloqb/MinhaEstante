# MinhaEstante 2.0 — Fundação de Dados e Arquitetura

**Documento Técnico da Fase 1 — Modelos, Esquema SQLite e Contratos Arquiteturais**

---

## 1. Objetivos Gerais da Versão 2.0

O **MinhaEstante 2.0** evolui o aplicativo de uma ferramenta exclusivamente voltada para a catalogação estática de livros físicos e e-books para um ambiente integrado de **biblioteca pessoal digital e acompanhamento de leitura**, preservando integralmente a identidade clássica em madeira, a simplicidade de uso e o armazenamento offline.

Nesta primeira fase, foram implementados os alicerces estruturais:
- Entidades tipadas para anexos digitais, posição de leitura e ciclos de leitura.
- Esquema relacional SQLite (Versão 2) com suporte a integridade referencial estrita e migrações idempotentes.
- Repositórios de persistência desacoplados da interface visual.
- Preservação total de 100% das telas, fluxos de catalogação, busca e backups da Versão 1.1.

---

## 2. Estrutura dos Novos Modelos

### 2.1. Anexo Digital (`BookAttachment`)
Representa metadados de arquivos digitais associados a uma obra catalogada, sem armazenar dados binários no banco de dados.

```typescript
export type AttachmentType = 'ebook' | 'audiobook';
export type AttachmentFormat = 'epub' | 'pdf' | 'mp3' | 'm4a' | 'm4b';

export interface BookAttachment {
  id: string;              // UUID v4 estável
  bookId: number;          // Chave estrangeira para books.id
  type: AttachmentType;    // 'ebook' ou 'audiobook'
  format: AttachmentFormat;// 'epub' | 'pdf' | 'mp3' | 'm4a' | 'm4b'
  filename: string;        // Nome original do arquivo
  mimeType?: string | null;// MIME type inferido
  sizeBytes: number;       // Tamanho em bytes
  storageProvider: string; // Ex: 'saf_document', 'opfs', 'web_local'
  storageReference: string;// URI/caminho opaco gerenciado pelo provedor
  checksum?: string | null;// SHA-256 de integridade
  createdAt: number;
  updatedAt: number;
}
```

### 2.2. Posição de Leitura e Reprodução (`ReaderPosition`)
Retém a última localização visitada no arquivo digital (mesmo em consultas breves).

```typescript
export type ReaderLocationType = 'epub_cfi' | 'pdf_page' | 'audio_seconds';

export interface ReaderPosition {
  id: string;                        // UUID v4
  attachmentId: string;              // Chave estrangeira para book_attachments.id
  locationType: ReaderLocationType;  // 'epub_cfi' | 'pdf_page' | 'audio_seconds'
  location: string;                  // Seletor CFI, número de página ou segundos
  updatedAt: number;
}
```

### 2.3. Sessão de Leitura (`ReadingSession`)
Representa um ciclo deliberado de leitura iniciado intencionalmente pelo usuário.

```typescript
export type ReadingSessionStatus = 'active' | 'completed' | 'abandoned';

export interface ReadingSession {
  id: string;                     // UUID v4
  bookId: number;                 // Chave estrangeira para books.id
  status: ReadingSessionStatus;   // 'active' | 'completed' | 'abandoned'
  startedAt: number;
  completedAt?: number | null;
  abandonedAt?: number | null;
  updatedAt: number;
}
```

### 2.4. Progresso de Leitura (`ReadingProgress`)
Representa o avanço deliberado dentro de uma sessão de leitura ativa ou histórica.

```typescript
export type ProgressUnit = 'pages' | 'percentage' | 'seconds';
export type ProgressSource = 'manual' | 'reader_device';

export interface ReadingProgress {
  id: string;               // UUID v4
  sessionId: string;        // Chave estrangeira para reading_sessions.id
  unit: ProgressUnit;       // 'pages' | 'percentage' | 'seconds'
  currentValue: number;     // Valor atual atingido (>= 0)
  totalValue?: number | null;// Total conhecido (se aplicável, >= currentValue)
  source: ProgressSource;   // 'manual' | 'reader_device'
  updatedAt: number;
}
```

---

## 3. Diagrama de Relações entre as Entidades

```
┌───────────────────────────────────────────────────────────────┐
│                             books                             │
│  - id: INTEGER PRIMARY KEY                                    │
│  - uuid: TEXT (identificador estável multiplataforma)        │
│  - titulo, autores_json, formatos_json, status_leitura, etc.  │
└───────────────────────────────┬───────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │ 1:N (max 1 ebook,                             │ 1:N (histórico)
        │      max 1 audiobook)                         │
        ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       book_attachments        │               │       reading_sessions        │
│  - id: TEXT PRIMARY KEY       │               │  - id: TEXT PRIMARY KEY       │
│  - book_id: INTEGER (FK)      │               │  - book_id: INTEGER (FK)      │
│  - type: 'ebook'|'audiobook'  │               │  - status: active|completed...│
│  - format: epub|pdf|mp3...    │               │  - started_at, completed_at...│
│  UNIQUE(book_id, type)        │               │  UNIQUE(book_id) WHERE active │
└───────────────┬───────────────┘               └───────────────┬───────────────┘
                │ 1:1                                           │ 1:1
                ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│       reader_positions        │               │       reading_progress        │
│  - id: TEXT PRIMARY KEY       │               │  - id: TEXT PRIMARY KEY       │
│  - attachment_id: TEXT (FK)   │               │  - session_id: TEXT (FK)      │
│  - location_type: cfi|page|sec│               │  - unit: pages|percent|seconds│
│  - location: TEXT             │               │  - current_value, total_value │
│  UNIQUE(attachment_id)        │               │  UNIQUE(session_id)           │
└───────────────────────────────┘               └───────────────────────────────┘
```

---

## 4. Esquema SQLite Introduzido (DDL Versão 2)

```sql
-- 1. Anexos de Mídia Digital (E-books e Audiolivros)
CREATE TABLE IF NOT EXISTS book_attachments (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL,
  storage_provider TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  checksum TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  CONSTRAINT uq_book_attachment_type UNIQUE(book_id, type)
);

CREATE INDEX IF NOT EXISTS idx_book_attachments_book_id ON book_attachments(book_id);
CREATE INDEX IF NOT EXISTS idx_book_attachments_type ON book_attachments(type);

-- 2. Posição de Leitura e Reprodução
CREATE TABLE IF NOT EXISTS reader_positions (
  id TEXT PRIMARY KEY,
  attachment_id TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (attachment_id) REFERENCES book_attachments(id) ON DELETE CASCADE,
  CONSTRAINT uq_reader_position_attachment UNIQUE(attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_reader_positions_attachment_id ON reader_positions(attachment_id);

-- 3. Acompanhamento Deliberado de Leitura
CREATE TABLE IF NOT EXISTS reading_sessions (
  id TEXT PRIMARY KEY,
  book_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  abandoned_at INTEGER,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_status ON reading_sessions(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_sessions_active_unique ON reading_sessions(book_id) WHERE status = 'active';

-- 4. Progresso de Leitura Acompanhado
CREATE TABLE IF NOT EXISTS reading_progress (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  unit TEXT NOT NULL,
  current_value REAL NOT NULL,
  total_value REAL,
  source TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES reading_sessions(id) ON DELETE CASCADE,
  CONSTRAINT uq_reading_progress_session UNIQUE(session_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_session_id ON reading_progress(session_id);
```

---

## 5. Versão das Migrações e Idempotência

- **Versão anterior:** `CURRENT_DB_VERSION = 1` (criava `schema_migrations` e `books`).
- **Nova versão:** `CURRENT_DB_VERSION = 2`.
- **Tabela de controle:** `schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`.
- **Comportamento Transacional e Idempotente:**
  1. A conexão executa `PRAGMA foreign_keys = ON;`.
  2. Verifica `schema_migrations`: se a versão 2 não foi aplicada, inicia transação (`BEGIN TRANSACTION`).
  3. Adiciona colunas ausentes na tabela `books` (`uuid` e `formatos_json`) via `ALTER TABLE books ADD COLUMN ...`.
  4. Executa a criação das 4 novas tabelas com cláusula `IF NOT EXISTS`.
  5. Insere `(2, Date.now())` na tabela `schema_migrations`.
  6. Finaliza a transação com `COMMIT`. Em caso de erro, executa `ROLLBACK`, preservando a consistência do banco.

---

## 6. Regras de Integridade e Restrições

1. **Chaves Estrangeiras:**
   - `book_attachments.book_id -> books.id ON DELETE CASCADE`.
   - `reader_positions.attachment_id -> book_attachments.id ON DELETE CASCADE`.
   - `reading_sessions.book_id -> books.id ON DELETE CASCADE`.
   - `reading_progress.session_id -> reading_sessions.id ON DELETE CASCADE`.
2. **Restrições de Unicidade:**
   - `UNIQUE(book_id, type)` em `book_attachments`: impede múltiplos e-books ou múltiplos audiolivros no mesmo livro.
   - `UNIQUE(attachment_id)` em `reader_positions`: cada anexo retém exatamente uma posição mais recente.
   - `UNIQUE(book_id) WHERE status = 'active'` em `reading_sessions`: impede duas sessões simultaneamente ativas para o mesmo livro.
   - `UNIQUE(session_id)` em `reading_progress`: cada ciclo de leitura possui um único progresso correspondente.

---

## 7. Diferença entre Modalidade da Obra e Arquivo Associado

- **Modalidade da Obra (`BookFormat: 'fisico' | 'ebook' | 'audiolivro'`):**
  Representa a intenção de catalogação ou a posse declarada pelo usuário. O usuário pode marcar um livro como "E-book" sem possuir nenhum arquivo digital em seu dispositivo.
- **Arquivo Associado (`BookAttachment`):**
  Representa um arquivo real (EPUB, PDF, MP3, M4A ou M4B) vinculado à obra e gerenciado por um provedor de armazenamento local.
- **Regra de Independência:**
  Vincular um arquivo digital **não altera** compulsoriamente os formatos declarados da obra, e desvincular um arquivo não apaga a modalidade correspondente na estante.

---

## 8. Diferença entre Última Posição Visitada e Progresso Deliberado

- **Última Posição Visitada (`ReaderPosition`):**
  - Associada diretamente ao anexo digital (`attachmentId`).
  - Atualizada automaticamente ao folhear uma página ou pausar um áudio.
  - Não altera o status do livro (`status_leitura`).
  - Não cria sessão de leitura.
- **Progresso Deliberado (`ReadingProgress`):**
  - Associado à decisão explícita do leitor de registrar seu avanço em uma sessão (`sessionId`).
  - Pode ser alimentado manualmente (páginas de livro físico) ou sincronizado deliberadamente a partir do leitor.
  - Distingue o fato de abrir um livro para consulta do ato consciente de acompanhamento de leitura.

---

## 9. Regras de Histórico e Releitura

1. Um livro pode acumular múltiplos ciclos históricos de leitura (`status = 'completed'` ou `'abandoned'`).
2. Quando uma sessão é concluída (`complete`), o campo `completedAt` é carimbado e ela se torna imutável no histórico.
3. O usuário pode então iniciar um novo ciclo deliberado de leitura para a mesma obra (releitura), gerando uma nova sessão com `status = 'active'`.
4. As releituras nunca sobrescrevem ou apagam as sessões anteriores, preservando estatísticas temporais e hábitos de leitura.

---

## 10. Estratégia Futura de Armazenamento (Fase 2)

Nenhum arquivo binário é armazenado como BLOB no SQLite. Na Fase 2:
- **Android:** Utilizará o Storage Access Framework (SAF) e o seletor de documentos do sistema operacional, armazenando no banco apenas URIs persistentes seguras (`takePersistableUriPermission`) ou referências copiadas para o diretório de dados privados do aplicativo (`FilesystemDirectory.Data`).
- **Web / PWA:** Utilizará o Origin Private File System (OPFS) ou IndexedDB com URLs de Blob efêmeras criadas sob demanda.
- **Detecção de Arquivos Inacessíveis:** A arquitetura prevê validação assíncrona da existência do arquivo antes da abertura nos leitores, sinalizando arquivos ausentes ou movidos sem corromper o registro bibliográfico.

---

## 11. Estratégia Futura de Backup

- **Backup Padrão (Versão 1.1):** Preservado integralmente. Exporta o catálogo bibliográfico e capas locais portáteis no arquivo ZIP com o manifesto existente.
- **Evolução Opcional (Fase Futura):**
  - Checkbox opcional: `[ ] Incluir arquivos de e-books (EPUB/PDF)`.
  - Checkbox opcional: `[ ] Incluir arquivos de audiolivros (MP3/M4A/M4B)`.
  - Ambos iniciam **desmarcados por padrão**, mantendo o backup rápido e leve.
  - Caso selecionados, o manifesto do ZIP conterá a tabela de anexos e os arquivos correspondentes serão embutidos em pastas dedicadas (`ebooks/`, `audiobooks/`).

---

## 12. Compatibilidade com a Versão 1.1

- **Telas e Componentes:** Nenhuma tela (Início, Estante, Pesquisa, Detalhes, Editar, Estatísticas) foi alterada.
- **Formatos:** A seleção múltipla e independente de `fisico`, `ebook` e `audiolivro` permanece 100% preservada.
- **Persistência de Livros:** A tabela `books` preserva todos os registros e colunas anteriores. A coluna `uuid` adicionada é retrocompatível e transparente.
- **Restauração de Backups:** Backups criados na versão 1.1 continuam sendo restaurados com sucesso.

---

## 13. Contratos Disponíveis para a Próxima Fase (Fase 2)

Os seguintes contratos estão prontos e testados para consumo na Fase 2:
1. `bookAttachmentRepository`: Métodos `create`, `getById`, `getByBookAndType`, `getByBookId`, `update`, `delete`, `exists`.
2. `readerPositionRepository`: Métodos `savePosition`, `getByAttachmentId`, `deleteByAttachmentId`, `validateLocation`.
3. `readingSessionRepository`: Métodos `create`, `getActiveSession`, `getHistoryByBookId`, `complete`, `abandon`.
4. `readingProgressRepository`: Métodos `saveProgress`, `getBySessionId`, `validateProgress`.
5. `isValidAttachmentTypeAndFormat` e `isValidReaderLocation`: Validadores puros de domínio.

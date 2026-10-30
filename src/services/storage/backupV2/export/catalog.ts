import { BookRepository } from '../../../database/bookRepository';
import { BookAttachmentRepository } from '../../../database/bookAttachmentRepository';
import { ReaderPositionRepository } from '../../../database/readerPositionRepository';
import { ReadingSessionRepository } from '../../../database/readingSessionRepository';
import { ReadingProgressRepository } from '../../../database/readingProgressRepository';
import type { IDatabaseService } from '../../../database/types';
import type { CatalogSnapshot } from './types';
import { ExportFailure, checkCancelled } from './types';

export class BackupCatalogRepository {
  constructor(private readonly db: IDatabaseService, private readonly selectedUuids?: readonly string[]) {}
  async read(signal?: AbortSignal): Promise<CatalogSnapshot> {
    await this.db.initialize(); checkCancelled(signal);
    if (!this.db.readInSnapshot) throw new ExportFailure('CAPABILITY_UNAVAILABLE');
    return this.db.readInSnapshot(async tx => {
      const repository = new BookRepository(tx);
      const books = this.selectedUuids ? (await Promise.all(this.selectedUuids.map(uuid => repository.getByUuid(uuid)))).filter((book): book is NonNullable<typeof book> => !!book)
        : await repository.getAll();
      if (this.selectedUuids && books.length !== this.selectedUuids.length) throw new ExportFailure('INVALID_REFERENCE');
      const attachments: CatalogSnapshot['attachments'] = [],
        positions: CatalogSnapshot['positions'] = [], sessions: CatalogSnapshot['sessions'] = [], progress: CatalogSnapshot['progress'] = [];
      for (const book of books) {
        checkCancelled(signal);
        const rows = await new BookAttachmentRepository(tx).getByBookId(book.id); attachments.push(...rows);
        for (const row of rows) { const position = await new ReaderPositionRepository(tx).getByAttachmentId(row.id); if (position) positions.push(position); }
        const history = await new ReadingSessionRepository(tx).getHistoryByBookId(book.id); sessions.push(...history);
        for (const session of history) { const value = await new ReadingProgressRepository(tx).getBySessionId(session.id); if (value) progress.push(value); }
      }
      return structuredClone({ books, attachments, positions, sessions, progress });
    });
  }
}

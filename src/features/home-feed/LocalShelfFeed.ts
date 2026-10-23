import { Book } from '../../types/book';
import { HomeBookItem, HomeBookSection } from './types';

export class LocalShelfFeed {
  /**
   * Seção 1: "Sua Estante"
   * Últimos 10 livros cadastrados que pertencem à coleção (posse física ou e-book).
   * Ordenados por dataCadastro decrescente (do mais recente para o mais antigo).
   */
  static getPersonalShelfSection(books: Book[]): HomeBookSection {
    const ownedBooks = (books || []).filter(
      (b) => Boolean(b.tenho_fisico) || b.formato === 'ebook'
    );

    // Ordenação estrita por dataCadastro decrescente
    const sorted = [...ownedBooks].sort((a, b) => (b.dataCadastro || 0) - (a.dataCadastro || 0));
    const slice = sorted.slice(0, 10);

    const items: HomeBookItem[] = slice.map((book) => ({
      id: `local_${book.id}`,
      isLocal: true,
      localBook: book,
      titulo: book.titulo,
      autores: book.autores || [],
      capaUrl: book.capaUrl,
      anoPublicacao: book.anoPublicacao,
      editora: book.editora,
      generos: book.generos || [],
      isbn13: book.isbn13,
      isbn10: book.isbn10,
      rating: book.nota,
    }));

    return {
      id: 'section_personal_shelf',
      type: 'personal-shelf',
      title: 'Sua Estante',
      subtitle: ownedBooks.length > 0 ? `${ownedBooks.length} ${ownedBooks.length === 1 ? 'livro na estante' : 'livros na estante'}` : undefined,
      books: items,
      state: items.length > 0 ? 'ready' : 'empty',
      canViewAll: ownedBooks.length > 10,
    };
  }

  /**
   * Seção 7: "Continue sua jornada literária"
   * Prioridade 1: Livros marcados como Quero Ler (status_leitura === 'quero_ler')
   * Prioridade 2: Obras na estante que ainda não foram lidas (status_leitura === 'nenhum')
   * Prioridade 3: Livros de autores que o leitor já avaliou positivamente
   */
  static getReadingJourneySection(books: Book[]): HomeBookSection {
    const all = books || [];
    const items: HomeBookItem[] = [];

    // 1. Quero Ler
    const queroLer = all.filter((b) => b.status_leitura === 'quero_ler');
    for (const b of queroLer) {
      if (items.length >= 10) break;
      items.push({
        id: `journey_ql_${b.id}`,
        isLocal: true,
        localBook: b,
        titulo: b.titulo,
        autores: b.autores || [],
        capaUrl: b.capaUrl,
        anoPublicacao: b.anoPublicacao,
        editora: b.editora,
        generos: b.generos || [],
        isbn13: b.isbn13,
        isbn10: b.isbn10,
        rating: b.nota,
        reason: 'Da sua lista Quero Ler',
      });
    }

    // 2. Não lidos na estante
    if (items.length < 10) {
      const unreadOwned = all.filter(
        (b) => (b.tenho_fisico || b.formato === 'ebook') && b.status_leitura === 'nenhum'
      );
      for (const b of unreadOwned) {
        if (items.length >= 10) break;
        if (!items.some((i) => i.localBook?.id === b.id)) {
          items.push({
            id: `journey_unread_${b.id}`,
            isLocal: true,
            localBook: b,
            titulo: b.titulo,
            autores: b.autores || [],
            capaUrl: b.capaUrl,
            anoPublicacao: b.anoPublicacao,
            editora: b.editora,
            generos: b.generos || [],
            isbn13: b.isbn13,
            isbn10: b.isbn10,
            rating: b.nota,
            reason: 'Aguardando sua leitura na estante',
          });
        }
      }
    }

    // 3. Autores lidos e bem avaliados (se houver espaço)
    if (items.length < 10) {
      const highRatedAuthors = new Set(
        all
          .filter((b) => b.status_leitura === 'lido' && (b.nota || 0) >= 8)
          .flatMap((b) => b.autores || [])
      );

      const moreByFavoriteAuthors = all.filter(
        (b) =>
          b.status_leitura !== 'lido' &&
          b.autores?.some((a) => highRatedAuthors.has(a)) &&
          !items.some((i) => i.localBook?.id === b.id)
      );

      for (const b of moreByFavoriteAuthors) {
        if (items.length >= 10) break;
        items.push({
          id: `journey_author_${b.id}`,
          isLocal: true,
          localBook: b,
          titulo: b.titulo,
          autores: b.autores || [],
          capaUrl: b.capaUrl,
          anoPublicacao: b.anoPublicacao,
          editora: b.editora,
          generos: b.generos || [],
          isbn13: b.isbn13,
          isbn10: b.isbn10,
          rating: b.nota,
          reason: 'Do mesmo autor de obras que você amou',
        });
      }
    }

    return {
      id: 'section_reading_journey',
      type: 'reading-journey',
      title: 'Continue sua jornada literária',
      subtitle: 'Títulos da sua lista e obras para explorar a seguir',
      books: items,
      state: items.length > 0 ? 'ready' : 'empty',
      canViewAll: false,
    };
  }
}

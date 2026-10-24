import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection } from './types';
import { HomeFeedCache } from './HomeFeedCache';

export class NewReleasesFeed {
  private static CACHE_KEY = 'home_feed_new_releases_v2';
  private static CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

  /**
   * Extrai e valida um ano de publicação a partir de strings de data variadas
   * (ex: "2025", "2025-03-12", "March 2025", "12/04/2025")
   * Retorna null se não houver ano verificável. NUNCA atribui o ano atual arbitrariamente.
   */
  static extractVerifiedYear(rawDate?: string | number | null): number | null {
    if (!rawDate) return null;
    if (typeof rawDate === 'number') {
      if (rawDate >= 1900 && rawDate <= 2100) return rawDate;
      return null;
    }
    const str = String(rawDate).trim();
    // Procura padrão de 4 dígitos para ano
    const match = str.match(/\b(20\d{2}|19\d{2})\b/);
    if (match) {
      const year = parseInt(match[1], 10);
      if (year >= 1900 && year <= 2100) return year;
    }
    return null;
  }

  /**
   * Classifica a obra entre "Novidade literária" (obra inédita recente) ou "Edição recente" (republicação)
   */
  static classifyRelease(
    editionYear: number,
    firstPublishYear?: number | null
  ): 'new-work' | 'new-edition' {
    if (firstPublishYear && typeof firstPublishYear === 'number') {
      // Se a primeira publicação da obra foi há mais de 3 anos do ano da edição, é uma reedição
      if (editionYear - firstPublishYear >= 3) {
        return 'new-edition';
      }
    }
    return 'new-work';
  }

  static async getNewReleasesSection(
    books: Book[],
    signal?: AbortSignal
  ): Promise<HomeBookSection> {
    const cached = HomeFeedCache.get(this.CACHE_KEY);
    if (cached && !cached.isStale) {
      return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
    }

    const currentYear = new Date().getFullYear();
    const minYear = currentYear - 2; // Janela dos últimos 24 meses

    const fetchTask = async (): Promise<HomeBookSection> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      try {
        // Consulta na Open Library com ordenação por novidades recentes (termo com 3+ caracteres para evitar HTTP 422)
        const olUrl = `https://openlibrary.org/search.json?q=livros&sort=new&limit=30`;
        let res = await fetch(olUrl, { signal: controller.signal });

        if (!res.ok) {
          // Fallback para termo literário alternativo
          res = await fetch('https://openlibrary.org/search.json?q=literatura&sort=new&limit=30', {
            signal: controller.signal,
          });
        }

        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        if (!res.ok) {
          throw new Error(`Open Library Releases HTTP ${res.status}`);
        }

        const data = await res.json();
        const docs = Array.isArray(data?.docs) ? data.docs : [];

        const items: HomeBookItem[] = [];

        for (const d of docs) {
          if (items.length >= 10) break;
          if (!d.title) continue;

          // Validação estrita de data: busca anos nas edições da obra
          const publishYears: number[] = Array.isArray(d.publish_year)
            ? d.publish_year.map((y: any) => parseInt(y, 10)).filter((y: number) => !isNaN(y) && y >= minYear && y <= currentYear + 1)
            : [];

          const verifiedYear = publishYears.length > 0 ? Math.max(...publishYears) : this.extractVerifiedYear(d.first_publish_year);

          // Se não houver data verificável dentro da janela de lançamentos, descarta
          if (!verifiedYear || verifiedYear < minYear) {
            continue;
          }

          const candidateAuthors = Array.isArray(d.author_name) ? d.author_name : [];
          const candidateBook = {
            titulo: d.title,
            autores: candidateAuthors,
            isbn13: Array.isArray(d.isbn) ? d.isbn[0] : undefined,
            isbn10: undefined,
          };

          // Exclui livros já presentes na estante do usuário
          const isDuplicate = (books || []).some((b) => areBooksDuplicate(b, candidateBook));
          if (isDuplicate) continue;

          const coverId = d.cover_i;
          const capaUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

          // Distinção entre Novidade Literária e Edição Recente
          const releaseType = this.classifyRelease(verifiedYear, d.first_publish_year);
          const reason =
            releaseType === 'new-work'
              ? `Novidade literária (${verifiedYear})`
              : `Nova edição lançada em ${verifiedYear}${d.first_publish_year ? ` (obra original de ${d.first_publish_year})` : ''}`;

          items.push({
            id: `release_${d.key || items.length}`,
            isLocal: false,
            searchResult: {
              origem: 'openlibrary',
              idExterno: d.key,
              titulo: d.title,
              autores: candidateAuthors,
              anoPublicacao: verifiedYear,
              editora: Array.isArray(d.publisher) ? d.publisher[0] : undefined,
              capaUrl,
              generos: Array.isArray(d.subject) ? d.subject.slice(0, 3) : [],
              fontes: ['Lançamentos Verificados'],
            },
            titulo: d.title,
            autores: candidateAuthors.length > 0 ? candidateAuthors : ['Autor Desconhecido'],
            capaUrl,
            anoPublicacao: verifiedYear,
            editora: Array.isArray(d.publisher) ? d.publisher[0] : undefined,
            releaseType,
            reason,
          });
        }

        const now = Date.now();
        const section: HomeBookSection = {
          id: 'section_new_releases',
          type: 'new-releases',
          title: 'Lançamentos',
          subtitle: `Publicações e novas edições verificadas (${minYear}–${currentYear})`,
          source: 'Catálogo de Lançamentos Open Library',
          referenceDate: `${currentYear}`,
          books: items,
          state: items.length > 0 ? 'ready' : 'empty',
          canViewAll: items.length > 0,
          lastUpdated: now,
          isCached: false,
        };

        if (items.length > 0) {
          HomeFeedCache.set(this.CACHE_KEY, section, this.CACHE_TTL_MS);
        }

        return section;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        if (cached) {
          return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
        }

        return {
          id: 'section_new_releases',
          type: 'new-releases',
          title: 'Lançamentos',
          subtitle: 'Publicações recentes',
          books: [],
          state: 'empty',
          errorMessage: 'Não foi possível carregar os lançamentos recentes no momento.',
        };
      }
    };

    return HomeFeedCache.setInFlight(this.CACHE_KEY, fetchTask());
  }
}

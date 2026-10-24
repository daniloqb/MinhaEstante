import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection, ReadingPreferences } from './types';
import { HomeFeedCache } from './HomeFeedCache';
import { ReadingPreferencesService } from './ReadingPreferencesService';
import { BookGenreNormalizer } from './BookGenreNormalizer';

interface ScoredCandidate {
  item: HomeBookItem;
  score: number;
  reason: string;
}

export class PersonalRecommendations {
  private static CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

  /**
   * Constrói perfil bibliográfico do usuário a partir dos livros do SQLite
   * com respeito rigoroso às datas reais de leitura (não utiliza dataAtualizacao como substituto)
   */
  static buildUserProfile(books: Book[], preferences?: ReadingPreferences) {
    const prefs = preferences || ReadingPreferencesService.getPreferences();
    const currentYear = new Date().getFullYear();

    const genreWeights: Record<string, number> = {};
    const authorWeights: Record<string, number> = {};

    // 1. Preferências declaradas pelo usuário têm peso base alto
    for (const fg of prefs.favoriteGenres || []) {
      const g = fg.toLowerCase();
      genreWeights[g] = (genreWeights[g] || 0) + 4.0;
    }

    // Gêneros evitados
    const avoidSet = new Set((prefs.avoidGenres || []).map((ag) => ag.toLowerCase()));

    // 2. Histórico real de livros da estante
    for (const b of books || []) {
      const isLido = b.status_leitura === 'lido';
      const rating = typeof b.nota === 'number' ? b.nota : null;

      // Fator de recência real (apenas se houver anoLeitura registrado pelo usuário; sem inventar dados)
      let recencyMultiplier = 1.0;
      if (b.anoLeitura && typeof b.anoLeitura === 'number') {
        const age = currentYear - b.anoLeitura;
        if (age <= 1) recencyMultiplier = 2.0;
        else if (age <= 3) recencyMultiplier = 1.5;
        else if (age > 10) recencyMultiplier = 0.9;
        else recencyMultiplier = 1.1;
      } else {
        // Se a data de leitura estiver ausente, utiliza peso neutro padrão (1.0)
        recencyMultiplier = 1.0;
      }

      // Fator de avaliação (10% do algoritmo)
      let ratingMultiplier = 1.0;
      if (rating !== null) {
        if (rating >= 9) ratingMultiplier = 2.5;
        else if (rating >= 7) ratingMultiplier = 1.8;
        else if (rating <= 4) ratingMultiplier = 0.4; // avaliações baixas reduzem atração do gênero
      } else if (isLido) {
        ratingMultiplier = 1.3;
      }

      const totalBookWeight = recencyMultiplier * ratingMultiplier;

      // Acumula pesos de gêneros
      for (const g of b.generos || []) {
        const norm = g.toLowerCase().trim();
        if (avoidSet.has(norm)) continue;
        genreWeights[norm] = (genreWeights[norm] || 0) + 1.2 * totalBookWeight;
      }

      // Acumula pesos de autores
      for (const a of b.autores || []) {
        const normAuthor = a.trim();
        if (!normAuthor) continue;
        authorWeights[normAuthor] = (authorWeights[normAuthor] || 0) + 1.5 * totalBookWeight;
      }
    }

    // Ordena gêneros e autores com maior afinidade
    const topGenres = Object.entries(genreWeights)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const topAuthors = Object.entries(authorWeights)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    return { topGenres, topAuthors, genreWeights, authorWeights };
  }

  static async getRecommendedSection(
    books: Book[],
    preferences?: ReadingPreferences,
    signal?: AbortSignal
  ): Promise<HomeBookSection> {
    const prefs = preferences || ReadingPreferencesService.getPreferences();

    if (!prefs.enableRecommendations) {
      return {
        id: 'section_recommended',
        type: 'recommended',
        title: 'Recomendados para você',
        subtitle: 'Recomendações desativadas nas preferências de leitura',
        books: [],
        state: 'empty',
      };
    }

    const signature = HomeFeedCache.computeProfileSignature(books, prefs);
    const cacheKey = `personalized_recommended_${signature}`;

    const cached = HomeFeedCache.get(cacheKey, signature);
    if (cached && !cached.isStale) {
      return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
    }

    const profile = this.buildUserProfile(books, prefs);
    const rawTargetGenre = profile.topGenres[0] || 'Literatura Clássica';
    const favoriteAuthor = profile.topAuthors[0];

    // Normalização centralizada do assunto para a Open Library API
    const subjectSlug = BookGenreNormalizer.toOpenLibrarySubject(rawTargetGenre);
    const displayGenreName = BookGenreNormalizer.toDisplayName(rawTargetGenre);

    const fetchTask = async (): Promise<HomeBookSection> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      try {
        const url = `https://openlibrary.org/subjects/${encodeURIComponent(subjectSlug)}.json?limit=30`;
        const res = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        if (!res.ok) {
          throw new Error(`Open Library Subjects HTTP ${res.status}`);
        }

        const data = await res.json();
        const rawWorks = Array.isArray(data?.works) ? data.works : [];

        const scoredCandidates: ScoredCandidate[] = [];

        for (const w of rawWorks) {
          if (!w.title) continue;

          const candidateAuthors = Array.isArray(w.authors) ? w.authors.map((a: any) => a.name).filter(Boolean) : [];
          const candidateBook = {
            titulo: w.title,
            autores: candidateAuthors,
            isbn13: undefined,
            isbn10: undefined,
          };

          // Regra estrita: nunca recomendar livro já presente na biblioteca
          const isDuplicate = (books || []).some((b) => areBooksDuplicate(b, candidateBook));
          if (isDuplicate) continue;

          // Cálculo determinístico de pontuação conforme fórmula (35% gênero, 25% autor, 20% recência, 10% nota, 10% popularidade)
          let score = 0;

          // 35% Gênero
          const genreWeight = profile.genreWeights[rawTargetGenre.toLowerCase()] || 1;
          score += Math.min(35, genreWeight * 4);

          // 25% Autor
          const matchesAuthor = candidateAuthors.some((a: string) => profile.authorWeights[a]);
          if (matchesAuthor) {
            score += 25;
          }

          // 20% Recência / Época
          score += 15;

          // 10% Popularidade (baseada em edições no Open Library)
          const editions = w.edition_count || 1;
          score += Math.min(10, Math.log10(editions + 1) * 5);

          // Explicabilidade honesta sustentada pelos metadados
          let reason = `Porque você gosta de ${displayGenreName}`;
          if (matchesAuthor && favoriteAuthor) {
            reason = `Do mesmo autor favorito: ${favoriteAuthor}`;
          } else if (profile.topGenres.length > 1 && profile.topGenres[1]) {
            reason = `Baseado no seu perfil de leitura em ${displayGenreName}`;
          }

          const coverId = w.cover_id;
          const coverUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : undefined;

          scoredCandidates.push({
            item: {
              id: `rec_${w.key || scoredCandidates.length}`,
              isLocal: false,
              searchResult: {
                origem: 'openlibrary',
                idExterno: w.key,
                titulo: w.title,
                autores: candidateAuthors,
                anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
                capaUrl: coverUrl,
                generos: [displayGenreName],
                fontes: ['Recomendação Algorítmica'],
              },
              titulo: w.title,
              autores: candidateAuthors,
              capaUrl: coverUrl,
              anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
              generos: [displayGenreName],
              reason,
            },
            score,
            reason,
          });
        }

        // Ordena por pontuação determinística e seleciona os 10 melhores
        scoredCandidates.sort((a, b) => b.score - a.score);
        const selected = scoredCandidates.slice(0, 10).map((c) => c.item);

        const now = Date.now();
        const section: HomeBookSection = {
          id: 'section_recommended',
          type: 'recommended',
          title: 'Recomendados para você',
          subtitle: `Descobertas personalizadas com base em seu perfil em ${displayGenreName}`,
          source: 'Algoritmo de Afinidade MinhaEstante',
          books: selected,
          state: selected.length > 0 ? 'ready' : 'empty',
          canViewAll: selected.length > 0,
          genre: displayGenreName,
          lastUpdated: now,
          isCached: false,
        };

        if (selected.length > 0) {
          HomeFeedCache.set(cacheKey, section, this.CACHE_TTL_MS, signature);
        }

        return section;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onGlobalAbort);

        // Se houver dados em cache (mesmo stale), preserva
        if (cached) {
          return { ...cached.section, isCached: true, lastUpdated: cached.timestamp };
        }

        return {
          id: 'section_recommended',
          type: 'recommended',
          title: 'Recomendados para você',
          subtitle: 'Descobertas personalizadas',
          books: [],
          state: 'empty',
          errorMessage: 'Não foi possível calcular as recomendações no momento.',
        };
      }
    };

    // Deduplicação concorrente com HomeFeedCache.setInFlight
    return HomeFeedCache.setInFlight(cacheKey, fetchTask());
  }
}

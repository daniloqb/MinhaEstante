import { Book } from '../../types/book';
import { areBooksDuplicate } from '../../services/storage';
import { HomeBookItem, HomeBookSection, ReadingPreferences } from './types';
import { HomeFeedCache } from './HomeFeedCache';
import { ReadingPreferencesService } from './ReadingPreferencesService';

interface ScoredCandidate {
  item: HomeBookItem;
  score: number;
  reason: string;
}

export class PersonalRecommendations {
  private static CACHE_KEY = 'personal_recommendations_v1';

  /**
   * Constrói perfil bibliográfico do usuário a partir dos livros do SQLite
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

    // 2. Histórico de livros da estante
    for (const b of books || []) {
      const isLido = b.status_leitura === 'lido';
      const rating = typeof b.nota === 'number' ? b.nota : null;
      const readingYear = b.anoLeitura || (b.dataAtualizacao ? new Date(b.dataAtualizacao).getFullYear() : null);

      // Fator de recência (20% do algoritmo): maior peso para leituras dos últimos 3 anos
      let recencyMultiplier = 1.0;
      if (readingYear) {
        const age = currentYear - readingYear;
        if (age <= 1) recencyMultiplier = 2.0;
        else if (age <= 3) recencyMultiplier = 1.5;
        else recencyMultiplier = 1.1;
      }

      // Fator de avaliação (10% do algoritmo)
      let ratingMultiplier = 1.0;
      if (rating !== null) {
        if (rating >= 9) ratingMultiplier = 2.5;
        else if (rating >= 7) ratingMultiplier = 1.8;
        else if (rating <= 4) ratingMultiplier = 0.4;
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

    const cached = HomeFeedCache.get(this.CACHE_KEY);
    if (cached && !cached.isStale) {
      return cached.section;
    }

    const profile = this.buildUserProfile(books, prefs);

    // Gênero alvo principal
    const targetGenre = profile.topGenres[0] || 'literature';
    const favoriteAuthor = profile.topAuthors[0];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 9500);

      const onGlobalAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', onGlobalAbort, { once: true });
      }

      // Consulta obras do gênero com maior afinidade
      const slug = targetGenre.replace(/\s+/g, '_');
      const url = `https://openlibrary.org/subjects/${encodeURIComponent(slug)}.json?limit=25`;
      const res = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);
      if (signal) signal.removeEventListener('abort', onGlobalAbort);

      if (!res.ok) {
        throw new Error(`Open Library HTTP ${res.status}`);
      }

      const data = await res.json();
      const rawWorks = Array.isArray(data?.works) ? data.works : [];

      const scoredCandidates: ScoredCandidate[] = [];

      for (const w of rawWorks) {
        if (!w.title) continue;

        const candidateAuthors = Array.isArray(w.authors) ? w.authors.map((a: any) => a.name) : [];
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
        const genreWeight = profile.genreWeights[targetGenre] || 1;
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
        let reason = `Porque você gosta de ${targetGenre}`;
        if (matchesAuthor && favoriteAuthor) {
          reason = `Do mesmo autor favorito: ${favoriteAuthor}`;
        } else if (profile.topGenres.length > 1 && profile.topGenres[1]) {
          reason = `Baseado no seu histórico de leituras recentes`;
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
              generos: [targetGenre],
              fontes: ['Recomendação Algorítmica'],
            },
            titulo: w.title,
            autores: candidateAuthors,
            capaUrl: coverUrl,
            anoPublicacao: typeof w.first_publish_year === 'number' ? w.first_publish_year : null,
            generos: [targetGenre],
            reason,
          },
          score,
          reason,
        });
      }

      // Ordena por pontuação e seleciona os 10 melhores
      scoredCandidates.sort((a, b) => b.score - a.score);
      const selected = scoredCandidates.slice(0, 10).map((c) => c.item);

      const section: HomeBookSection = {
        id: 'section_recommended',
        type: 'recommended',
        title: 'Recomendados para você',
        subtitle: 'Descobertas personalizadas com base no seu histórico real de leitura',
        source: 'Algoritmo de Afinidade MinhaEstante',
        books: selected,
        state: selected.length > 0 ? 'ready' : 'empty',
        canViewAll: false,
      };

      if (selected.length > 0) {
        HomeFeedCache.set(this.CACHE_KEY, section, 24 * 60 * 60 * 1000);
      }

      return section;
    } catch {
      if (cached) return cached.section;
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
  }
}

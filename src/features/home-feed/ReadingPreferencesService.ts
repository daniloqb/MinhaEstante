import { Book } from '../../types/book';
import { ReadingPreferences, STANDARD_GENRES } from './types';

const PREFERENCES_STORAGE_KEY = 'minhaestante_reading_preferences_v1';

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  favoriteGenres: [],
  preferredLanguages: ['pt', 'en', 'es'],
  fictionPreference: 'all',
  enableRecommendations: true,
  avoidGenres: [],
  hasCompletedOnboarding: false,
  updatedAt: Date.now(),
};

export class ReadingPreferencesService {
  private static cachedPrefs: ReadingPreferences | null = null;

  static getPreferences(): ReadingPreferences {
    if (this.cachedPrefs) {
      return this.cachedPrefs;
    }

    try {
      const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.cachedPrefs = {
          ...DEFAULT_READING_PREFERENCES,
          ...parsed,
        };
        return this.cachedPrefs!;
      }
    } catch (e) {
      console.warn('Erro ao carregar preferências de leitura:', e);
    }

    this.cachedPrefs = { ...DEFAULT_READING_PREFERENCES };
    return this.cachedPrefs;
  }

  static savePreferences(partial: Partial<ReadingPreferences>): ReadingPreferences {
    const current = this.getPreferences();
    const updated: ReadingPreferences = {
      ...current,
      ...partial,
      updatedAt: Date.now(),
    };

    try {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(updated));
      this.cachedPrefs = updated;
    } catch (e) {
      console.warn('Erro ao persistir preferências de leitura:', e);
    }

    return updated;
  }

  /**
   * Sugere até 5 gêneros favoritos analisando os livros da coleção existente.
   * Dá peso maior para livros com boa avaliação (nota >= 7) ou marcados como lido.
   */
  static suggestGenresFromLibrary(books: Book[]): string[] {
    if (!books || books.length === 0) {
      return ['Literatura Clássica', 'Ficção Científica', 'Filosofia', 'História', 'Romance'];
    }

    const genreScores: Record<string, number> = {};

    for (const book of books) {
      const genres = book.generos || [];
      const isLido = book.status_leitura === 'lido';
      const rating = typeof book.nota === 'number' ? book.nota : null;

      let multiplier = 1;
      if (isLido) multiplier += 0.5;
      if (rating !== null) {
        if (rating >= 8) multiplier += 1.5;
        else if (rating >= 6) multiplier += 0.5;
        else if (rating <= 4) multiplier -= 0.5;
      }

      for (const g of genres) {
        const trimmed = g.trim();
        if (!trimmed) continue;
        const matchedStandard = STANDARD_GENRES.find(
          (sg) => sg.toLowerCase() === trimmed.toLowerCase() || trimmed.toLowerCase().includes(sg.toLowerCase())
        ) || trimmed;

        genreScores[matchedStandard] = (genreScores[matchedStandard] || 0) + multiplier;
      }
    }

    const sorted = Object.entries(genreScores)
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    return sorted.slice(0, 5);
  }

  static completeOnboarding(selectedGenres: string[]): ReadingPreferences {
    return this.savePreferences({
      favoriteGenres: selectedGenres.length > 0 ? selectedGenres : ['Literatura Clássica', 'Romance'],
      hasCompletedOnboarding: true,
    });
  }

  static dismissOnboarding(): ReadingPreferences {
    return this.savePreferences({
      hasCompletedOnboarding: true,
    });
  }

  static clear(): void {
    try {
      localStorage.removeItem(PREFERENCES_STORAGE_KEY);
      this.cachedPrefs = null;
    } catch {
      // ignore
    }
  }
}

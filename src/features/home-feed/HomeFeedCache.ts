import { HomeBookSection, ReadingPreferences } from './types';
import { Book } from '../../types/book';

export interface CacheEntry {
  section: HomeBookSection;
  timestamp: number;
  ttlMs: number;
  profileSignature?: string;
}

const CACHE_STORAGE_PREFIX = 'mashelf_home_cache_';
const PROFILE_KEY_PREFIX = 'personalized_';

export class HomeFeedCache {
  private static memoryCache = new Map<string, CacheEntry>();
  private static inFlightRequests = new Map<string, Promise<any>>();

  /**
   * Calcula assinatura determinística normalizada e ordenada do perfil do leitor
   * (qualquer alteração relevante em livros, notas, anos de leitura ou preferências invalida o cache)
   */
  static computeProfileSignature(books: Book[], preferences?: ReadingPreferences): string {
    const sortedBooks = [...(books || [])].sort((a, b) => a.id - b.id);
    const bookTokens = sortedBooks.map((b) => [
      b.id,
      b.status_leitura || 'nenhum',
      b.nota != null ? b.nota : '',
      b.anoLeitura != null ? b.anoLeitura : '',
      b.mesLeitura != null ? b.mesLeitura : '',
      (b.generos || []).slice().sort().join(','),
      (b.autores || []).slice().sort().join(','),
    ].join(':')).join('|');

    const favGenres = (preferences?.favoriteGenres || []).slice().sort().join(',');
    const avoidGenres = (preferences?.avoidGenres || []).slice().sort().join(',');
    const langs = (preferences?.preferredLanguages || []).slice().sort().join(',');
    const ficPref = preferences?.fictionPreference || 'all';

    const raw = `v2_${bookTokens}__${favGenres}__${avoidGenres}__${langs}__${ficPref}`;

    // Hash rápido e determinístico de 32 bits em string hexadecimal
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash << 5) - hash + raw.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Recupera uma promessa em andamento para deduplicação concorrente de requisições idênticas
   */
  static getInFlight<T>(key: string): Promise<T> | undefined {
    return this.inFlightRequests.get(key);
  }

  /**
   * Registra promessa concorrente em andamento com limpeza automática ao finalizar
   */
  static setInFlight<T>(key: string, promise: Promise<T>): Promise<T> {
    this.inFlightRequests.set(key, promise);
    promise
      .finally(() => {
        if (this.inFlightRequests.get(key) === promise) {
          this.inFlightRequests.delete(key);
        }
      })
      .catch(() => {});
    return promise;
  }

  /**
   * Obtém item do cache (memória com fallback para LocalStorage)
   */
  static get(
    key: string,
    currentProfileSignature?: string
  ): { section: HomeBookSection; isStale: boolean; timestamp: number } | null {
    // 1. Memória
    let entry = this.memoryCache.get(key);

    // 2. LocalStorage se ausente da memória
    if (!entry) {
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(`${CACHE_STORAGE_PREFIX}${key}`);
          if (raw) {
            entry = JSON.parse(raw);
            if (entry) {
              this.memoryCache.set(key, entry);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    if (!entry) return null;

    // Se for cache personalizado e houver assinatura fornecida, verifica incompatibilidade
    if (key.startsWith(PROFILE_KEY_PREFIX) && currentProfileSignature) {
      if (entry.profileSignature && entry.profileSignature !== currentProfileSignature) {
        // Invalida imediatamente o cache personalizado se o perfil mudou
        this.delete(key);
        return null;
      }
    }

    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.ttlMs;

    return {
      section: entry.section,
      isStale,
      timestamp: entry.timestamp,
    };
  }

  /**
   * Armazena no cache com TTL e assinatura opcional
   */
  static set(
    key: string,
    section: HomeBookSection,
    ttlMs: number,
    profileSignature?: string
  ): void {
    const entry: CacheEntry = {
      section,
      timestamp: Date.now(),
      ttlMs,
      profileSignature,
    };

    this.memoryCache.set(key, entry);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${CACHE_STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      }
    } catch (e) {
      console.warn('Falha ao persistir cache da Home no LocalStorage:', e);
    }
  }

  /**
   * Remove uma entrada específica do cache
   */
  static delete(key: string): void {
    this.memoryCache.delete(key);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${CACHE_STORAGE_PREFIX}${key}`);
      }
    } catch {}
  }

  /**
   * Invalida apenas o cache personalizado (recomendações e mesmo gênero),
   * preservando intacto o cache compartilhado (Apple Books, NYT, Tendências, etc.)
   */
  static invalidatePersonalizedCache(): void {
    const keysToDelete: string[] = [];
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(PROFILE_KEY_PREFIX)) {
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach((k) => this.memoryCache.delete(k));

    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith(`${CACHE_STORAGE_PREFIX}${PROFILE_KEY_PREFIX}`)) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {}
  }

  /**
   * Limpa todo o cache da Home (usado em testes ou reset manual)
   */
  static clear(): void {
    this.memoryCache.clear();
    this.inFlightRequests.clear();
    try {
      if (typeof localStorage !== 'undefined') {
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(CACHE_STORAGE_PREFIX)) {
            toRemove.push(k);
          }
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      }
    } catch {}
  }
}

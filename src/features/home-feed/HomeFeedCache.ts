import { HomeBookSection } from './types';

interface CacheItem {
  section: HomeBookSection;
  timestamp: number;
  ttlMs: number;
}

const CACHE_STORAGE_PREFIX = 'minhaestante_home_cache_';

export class HomeFeedCache {
  private static memoryCache = new Map<string, CacheItem>();

  static get(key: string): { section: HomeBookSection; isStale: boolean } | null {
    // 1. Memória
    const inMem = this.memoryCache.get(key);
    if (inMem) {
      const isStale = Date.now() - inMem.timestamp > inMem.ttlMs;
      return { section: inMem.section, isStale };
    }

    // 2. LocalStorage
    try {
      const raw = localStorage.getItem(`${CACHE_STORAGE_PREFIX}${key}`);
      if (raw) {
        const item: CacheItem = JSON.parse(raw);
        this.memoryCache.set(key, item);
        const isStale = Date.now() - item.timestamp > item.ttlMs;
        return { section: item.section, isStale };
      }
    } catch {
      // ignore
    }

    return null;
  }

  static set(key: string, section: HomeBookSection, ttlMs: number = 12 * 60 * 60 * 1000): void {
    const item: CacheItem = {
      section,
      timestamp: Date.now(),
      ttlMs,
    };

    this.memoryCache.set(key, item);

    try {
      localStorage.setItem(`${CACHE_STORAGE_PREFIX}${key}`, JSON.stringify(item));
    } catch (e) {
      // LocalStorage pode estar cheio
      console.warn('Falha ao persistir cache da Home no localStorage:', e);
    }
  }

  static clear(): void {
    this.memoryCache.clear();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

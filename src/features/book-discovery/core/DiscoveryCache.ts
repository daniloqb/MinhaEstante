import { DiscoverySearchResponse } from '../models/DiscoveryTypes';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class DiscoveryCache {
  private static searchCache = new Map<string, CacheEntry<DiscoverySearchResponse>>();
  private static inFlightRequests = new Map<string, Promise<DiscoverySearchResponse>>();

  private static DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos
  private static EMPTY_TTL = 60 * 1000; // 1 minuto para resultados vazios

  static makeKey(query: string, cursor?: string): string {
    return `${query.trim().toLowerCase()}_#_${cursor || 'start'}`;
  }

  static get(query: string, cursor?: string): DiscoverySearchResponse | null {
    const key = this.makeKey(query, cursor);
    const entry = this.searchCache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttlMs) {
      this.searchCache.delete(key);
      return null;
    }

    return entry.data;
  }

  static set(query: string, cursor: string | undefined, data: DiscoverySearchResponse): void {
    const key = this.makeKey(query, cursor);
    const ttl = data.books.length === 0 ? this.EMPTY_TTL : this.DEFAULT_TTL;
    this.searchCache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs: ttl,
    });
  }

  static getInFlight(query: string, cursor?: string): Promise<DiscoverySearchResponse> | undefined {
    const key = this.makeKey(query, cursor);
    return this.inFlightRequests.get(key);
  }

  static setInFlight(query: string, cursor: string | undefined, promise: Promise<DiscoverySearchResponse>): void {
    const key = this.makeKey(query, cursor);
    this.inFlightRequests.set(key, promise);
    promise
      .finally(() => {
        this.inFlightRequests.delete(key);
      })
      .catch(() => {});
  }

  static clear(): void {
    this.searchCache.clear();
    this.inFlightRequests.clear();
  }
}

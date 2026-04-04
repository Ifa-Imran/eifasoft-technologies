interface CacheEntry<T> {
    value: T;
    expiresAt: number;
}

/**
 * Simple in-memory TTL cache.
 * Used to avoid excessive RPC / DB calls for frequently-accessed data
 * such as price, supply, and global stats.
 */
class MemoryCache {
    private store = new Map<string, CacheEntry<any>>();
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Periodically evict expired entries every 60 seconds
        this.cleanupInterval = setInterval(() => this.evictExpired(), 60_000);
    }

    /**
     * Get a value from cache. Returns undefined if missing or expired.
     */
    get<T>(key: string): T | undefined {
        const entry = this.store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value as T;
    }

    /**
     * Store a value with a TTL (in milliseconds).
     */
    set<T>(key: string, value: T, ttlMs: number): void {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    /**
     * Delete a specific key.
     */
    del(key: string): void {
        this.store.delete(key);
    }

    /**
     * Evict all expired entries.
     */
    private evictExpired(): void {
        const now = Date.now();
        for (const [key, entry] of this.store) {
            if (now > entry.expiresAt) {
                this.store.delete(key);
            }
        }
    }

    /**
     * Get-or-set helper: returns cached value if present, otherwise calls
     * the factory, caches the result, and returns it.
     */
    async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== undefined) return cached;
        const value = await factory();
        this.set(key, value, ttlMs);
        return value;
    }

    /**
     * Shut down the cleanup timer (for graceful shutdown).
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store.clear();
    }
}

/** Singleton cache instance shared across the backend */
export const cache = new MemoryCache();

/** Common TTL constants */
export const TTL = {
    PRICE: 30_000,          // 30 seconds
    GLOBAL_STATS: 30_000,   // 30 seconds
    SUPPLY: 60_000,         // 1 minute
    USER_DASHBOARD: 10_000, // 10 seconds
} as const;

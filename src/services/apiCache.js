import AsyncStorage from '@react-native-async-storage/async-storage';

// In-memory cache store with background AsyncStorage persistence
const cacheStore = new Map();
const CACHE_PREFIX = '@tenant_cache:';
let isHydrated = false;

export const apiCache = {
  get(key) {
    const entry = cacheStore.get(key);
    if (!entry) return null;
    return entry.data;
  },

  isStale(key, ttlMs = 180000) { // 3 minutes freshness
    const entry = cacheStore.get(key);
    if (!entry) return true;
    return Date.now() - entry.timestamp > ttlMs;
  },

  set(key, data) {
    if (data !== undefined && data !== null) {
      const entry = {
        timestamp: Date.now(),
        data,
      };
      cacheStore.set(key, entry);
      // Asynchronously persist to disk in background
      AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry)).catch(() => {});
    }
  },

  async hydrate() {
    if (isHydrated) return;
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const tenantKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
      if (tenantKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(tenantKeys);
        for (const [k, v] of pairs) {
          if (v) {
            try {
              const parsed = JSON.parse(v);
              const realKey = k.replace(CACHE_PREFIX, '');
              if (!cacheStore.has(realKey)) {
                cacheStore.set(realKey, parsed);
              }
            } catch (_) {}
          }
        }
      }
      isHydrated = true;
    } catch (_) {}
  },

  invalidate(prefix) {
    const toRemove = [];
    if (!prefix) {
      cacheStore.clear();
      AsyncStorage.getAllKeys().then((keys) => {
        const cKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
        if (cKeys.length) AsyncStorage.multiRemove(cKeys).catch(() => {});
      }).catch(() => {});
      return;
    }
    for (const key of cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        cacheStore.delete(key);
        toRemove.push(`${CACHE_PREFIX}${key}`);
      }
    }
    if (toRemove.length) {
      AsyncStorage.multiRemove(toRemove).catch(() => {});
    }
  },

  clear() {
    cacheStore.clear();
    AsyncStorage.getAllKeys().then((keys) => {
      const cKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
      if (cKeys.length) AsyncStorage.multiRemove(cKeys).catch(() => {});
    }).catch(() => {});
  },
};

export default apiCache;

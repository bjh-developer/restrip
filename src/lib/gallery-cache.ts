/**
 * Gallery Image Cache (IndexedDB)
 *
 * Client-side cache for decrypted gallery images using IndexedDB.
 * Dramatically speeds up repeat gallery visits by avoiding re-downloading
 * and re-decrypting images from the server.
 *
 * Storage strategy:
 * - Images stored as Blobs in IndexedDB (efficient, large capacity)
 * - Keyed by snap ID (immutable — an image never changes)
 * - Object URLs created on demand and revoked on cleanup
 * - Max cache size: 200 entries (LRU eviction by lastAccessed timestamp)
 *
 * @module lib/gallery-cache
 */

const DB_NAME = "restrip-gallery-cache";
const DB_VERSION = 1;
const STORE_NAME = "images";
const MAX_CACHE_ENTRIES = 200;

interface CacheEntry {
  id: string;
  blob: Blob;
  lastAccessed: number;
}

/** Open (or create) the IndexedDB database */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("lastAccessed", "lastAccessed", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a cached image blob by snap ID.
 * Returns null if not cached.
 */
export async function getCachedImage(snapId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(snapId);

      getReq.onsuccess = () => {
        const entry = getReq.result as CacheEntry | undefined;
        if (entry) {
          // Update lastAccessed timestamp (LRU tracking)
          entry.lastAccessed = Date.now();
          store.put(entry);
          resolve(entry.blob);
        } else {
          resolve(null);
        }
      };

      getReq.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store an image blob in the cache.
 * Evicts oldest entries if cache exceeds MAX_CACHE_ENTRIES.
 */
export async function setCachedImage(snapId: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB();

    // Store the new entry
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ id: snapId, blob, lastAccessed: Date.now() } satisfies CacheEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Evict old entries if over limit
    await evictOldEntries(db);
  } catch (err) {
    console.warn("[GalleryCache] Failed to cache image:", err);
  }
}

/**
 * Remove a specific image from the cache (e.g. after deletion).
 */
export async function removeCachedImage(snapId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(snapId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // non-critical
    });
  } catch {
    // non-critical
  }
}

/**
 * Check which snap IDs are already cached.
 * Returns a Set of cached IDs for fast lookup.
 */
export async function getCachedIds(): Promise<Set<string>> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();

      req.onsuccess = () => resolve(new Set(req.result as string[]));
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

/**
 * Clear the entire image cache.
 */
export async function clearImageCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // non-critical
  }
}

/** Evict the oldest entries if the cache is over the size limit */
async function evictOldEntries(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const countReq = store.count();

    countReq.onsuccess = () => {
      const count = countReq.result;
      if (count <= MAX_CACHE_ENTRIES) {
        resolve();
        return;
      }

      // Get all entries sorted by lastAccessed (ascending = oldest first)
      const index = store.index("lastAccessed");
      const toEvict = count - MAX_CACHE_ENTRIES;
      let evicted = 0;

      const cursorReq = index.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && evicted < toEvict) {
          cursor.delete();
          evicted++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorReq.onerror = () => resolve();
    };

    countReq.onerror = () => resolve();
  });
}

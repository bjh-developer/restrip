/**
 * Gallery Cache — IndexedDB-backed cache for decrypted gallery images.
 *
 * Stores decrypted image data URLs, captions, and natural dimensions so that
 * subsequent page loads skip the download-and-decrypt pipeline for previously
 * seen snaps.
 *
 * Cache lifecycle:
 * - **Write**: After successful decryption of a snap
 * - **Read**: Before attempting download + decrypt (cache-first strategy)
 * - **Delete**: When a snap is deleted by the user
 * - **Clear**: On sign-out (wipes entire cache)
 *
 * Security note: Decrypted images are stored in IndexedDB. This has the same
 * threat model as the existing sessionStorage key storage — an XSS attacker
 * with DOM access could read IndexedDB. The encryption key in sessionStorage
 * is already the weakest link; caching decrypted output doesn't change the
 * attack surface.
 *
 * @module lib/gallery-cache
 */

const DB_NAME = "rereel-gallery-cache";
const DB_VERSION = 1;
const STORE_NAME = "decrypted-snaps";

/** Shape of a cached snap entry */
export interface CachedSnap {
  id: string;
  decryptedImageUrl: string;
  decryptedCaption: string | null;
  naturalWidth: number;
  naturalHeight: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Open (or create) the IndexedDB database.
 * Returns a promise that resolves with the IDBDatabase instance.
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a single cached snap by ID.
 * Returns `null` if not found or on any error (fail-open — never blocks rendering).
 */
export async function getCachedSnap(id: string): Promise<CachedSnap | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as CachedSnap) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Retrieve multiple cached snaps by their IDs in a single transaction.
 * Returns a Map of id → CachedSnap for snaps that were found.
 */
export async function getCachedSnaps(ids: string[]): Promise<Map<string, CachedSnap>> {
  const result = new Map<string, CachedSnap>();
  if (ids.length === 0) return result;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      let completed = 0;
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          if (req.result) result.set(id, req.result as CachedSnap);
          completed++;
          if (completed === ids.length) resolve(result);
        };
        req.onerror = () => {
          completed++;
          if (completed === ids.length) resolve(result);
        };
      }
    });
  } catch {
    return result;
  }
}

/**
 * Store a decrypted snap in the cache.
 */
export async function setCachedSnap(snap: CachedSnap): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(snap);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Silently fail — cache is best-effort
  }
}

/**
 * Store multiple decrypted snaps in a single transaction.
 */
export async function setCachedSnaps(snaps: CachedSnap[]): Promise<void> {
  if (snaps.length === 0) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const snap of snaps) {
        store.put(snap);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // best-effort
    });
  } catch {
    // Silently fail
  }
}

/**
 * Remove a single snap from the cache (e.g. after deletion).
 */
export async function removeCachedSnap(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

/**
 * Remove multiple snaps from the cache.
 */
export async function removeCachedSnaps(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

/**
 * Purge stale entries — remove cached snaps whose IDs are NOT in the given
 * set of current snap IDs (i.e. they were deleted server-side).
 */
export async function purgeStaleCachedSnaps(currentIds: Set<string>): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();

      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          resolve();
          return;
        }
        if (!currentIds.has(cursor.key as string)) {
          cursor.delete();
        }
        cursor.continue();
      };

      cursorReq.onerror = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

/**
 * Clear the entire gallery cache (called on sign-out).
 */
export async function clearGalleryCache(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Silently fail
  }
}

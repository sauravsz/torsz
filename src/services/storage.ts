const DB_NAME = "torsz_indexed_db";
const STORE_NAME = "sqlite_storage";
const DB_KEY = "current_database_bytes";
const META_KEY = "current_database_meta";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available"));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDatabaseToStorage(bytes: Uint8Array, name: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(bytes, DB_KEY);
    store.put({ name, updatedAt: Date.now() }, META_KEY);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to persist SQLite database to IndexedDB:", err);
  }
}

export async function loadDatabaseFromStorage(): Promise<{ bytes: Uint8Array; name: string } | null> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const bytesReq = store.get(DB_KEY);
    const metaReq = store.get(META_KEY);

    return new Promise((resolve) => {
      tx.oncomplete = () => {
        const bytes = bytesReq.result as Uint8Array | undefined;
        const meta = metaReq.result as { name: string; updatedAt: number } | undefined;
        if (bytes && bytes.length > 0) {
          resolve({ bytes, name: meta?.name || "Persisted Database" });
        } else {
          resolve(null);
        }
      };
      tx.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearDatabaseFromStorage(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(DB_KEY);
    store.delete(META_KEY);
  } catch (err) {
    console.warn("Failed to clear storage:", err);
  }
}

/**
 * Saved keymaps — storage.
 *
 * Same arrangement as version history: IndexedDB is the real store, and an
 * in-memory one stands in when IndexedDB is missing or refuses to open
 * (private browsing, jsdom, an embedded WebView).
 *
 * Unlike version history, this one is NOT a convenience. A version snapshot
 * that goes missing costs the user an undo; a saved keymap that goes missing
 * costs them work they deliberately kept. So the memory fallback is only a way
 * to keep the UI working for the session, and the caller is told the store is
 * not durable rather than being left to assume it saved.
 */
import type { NewSavedKeymap, SavedKeymap, SavedKeymapBackend } from "./types";

export const DB_NAME = "keeb-on-studio-saved-keymaps";
export const DB_VERSION = 1;
export const STORE = "keymaps";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryBackend(): SavedKeymapBackend {
  const rows = new Map<number, SavedKeymap>();
  let nextId = 1;

  return {
    async list() {
      return [...rows.values()].map(clone);
    },
    async add(record) {
      const stored: SavedKeymap = { ...clone(record), id: nextId++ };
      rows.set(stored.id, stored);
      return clone(stored);
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) return null;
      const next = { ...existing, ...clone(patch), updatedAt: Date.now() };
      rows.set(id, next);
      return clone(next);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("IndexedDB upgrade blocked by another tab"));
  });
}

export function createIndexedDbBackend(): SavedKeymapBackend | null {
  if (typeof indexedDB === "undefined") return null;

  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = () => (dbPromise ??= openDatabase());

  async function withStore<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const database = await db();
    const transaction = database.transaction(STORE, mode);
    const result = await promisify(run(transaction.objectStore(STORE)));
    // Waiting for the transaction, not just the request, is what makes a write
    // durable before the caller is told it succeeded.
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  }

  return {
    async list() {
      return withStore<SavedKeymap[]>(
        "readonly",
        (store) => store.getAll() as IDBRequest<SavedKeymap[]>,
      );
    },
    async add(record: NewSavedKeymap) {
      const key = await withStore<IDBValidKey>("readwrite", (store) =>
        store.add(record),
      );
      return { ...clone(record), id: Number(key) };
    },
    async update(id, patch) {
      const database = await db();
      const transaction = database.transaction(STORE, "readwrite");
      const store = transaction.objectStore(STORE);
      const existing = await promisify(
        store.get(id) as IDBRequest<SavedKeymap | undefined>,
      );
      if (!existing) return null;
      const next: SavedKeymap = {
        ...existing,
        ...clone(patch),
        id,
        updatedAt: Date.now(),
      };
      await promisify(store.put(next));
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      return next;
    },
    async remove(id) {
      await withStore("readwrite", (store) => store.delete(id));
    },
  };
}

export interface SavedKeymapStore extends SavedKeymapBackend {
  /** False when records live only in memory and will not survive a reload. */
  isDurable: boolean;
}

export function createSavedKeymapStore(): SavedKeymapStore {
  const indexed = createIndexedDbBackend();
  if (indexed) return { ...indexed, isDurable: true };
  return { ...createMemoryBackend(), isDurable: false };
}

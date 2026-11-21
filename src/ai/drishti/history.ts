import type { DrishtiGenerationResult } from "./client";

export type DrishtiHistoryItem = DrishtiGenerationResult & {
  id: string;
  prompt: string;
  created_at: number;
};

const DATABASE_NAME = "satyaai-drishti";
const DATABASE_VERSION = 1;
const STORE_NAME = "generations";
export const MAX_DRISHTI_HISTORY = 12;

export function sortDrishtiHistory(items: DrishtiHistoryItem[]): DrishtiHistoryItem[] {
  return [...items].sort((a, b) => b.created_at - a.created_at).slice(0, MAX_DRISHTI_HISTORY);
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support persistent image history."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open image history."));
    request.onblocked = () => reject(new Error("Image history is blocked by another browser tab."));
  });
}

export async function loadDrishtiHistory(): Promise<DrishtiHistoryItem[]> {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(sortDrishtiHistory(request.result as DrishtiHistoryItem[]));
      request.onerror = () => reject(request.error ?? new Error("Could not read image history."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image history read was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function saveDrishtiHistoryItem(item: DrishtiHistoryItem): Promise<void> {
  const database = await openHistoryDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(item);
      const all = store.getAll();
      all.onsuccess = () => {
        const sorted = sortDrishtiHistory(all.result as DrishtiHistoryItem[]);
        const keep = new Set(sorted.map((entry) => entry.id));
        for (const entry of all.result as DrishtiHistoryItem[]) {
          if (!keep.has(entry.id)) store.delete(entry.id);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save image history."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Image history save was aborted."));
    });
  } finally {
    database.close();
  }
}

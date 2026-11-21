import type { ChakshuGenerationResult } from "./client";

export type ChakshuHistoryItem = ChakshuGenerationResult & {
  id: string;
  prompt: string;
  blob: Blob;
  created_at: number;
};

const DATABASE_NAME = "satyaai-chakshu";
const DATABASE_VERSION = 1;
const STORE_NAME = "generations";
export const MAX_CHAKSHU_HISTORY = 12;

export function sortChakshuHistory(items: ChakshuHistoryItem[]): ChakshuHistoryItem[] {
  return [...items].sort((left, right) => right.created_at - left.created_at).slice(0, MAX_CHAKSHU_HISTORY);
}

function openHistoryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support persistent video history."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open video history."));
    request.onblocked = () => reject(new Error("Video history is blocked by another browser tab."));
  });
}

export async function loadChakshuHistory(): Promise<ChakshuHistoryItem[]> {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(sortChakshuHistory(request.result as ChakshuHistoryItem[]));
      request.onerror = () => reject(request.error ?? new Error("Could not read video history."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Video history read was aborted."));
    });
  } finally {
    database.close();
  }
}

export async function saveChakshuHistoryItem(item: ChakshuHistoryItem): Promise<void> {
  const database = await openHistoryDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(item);
      const all = store.getAll();
      all.onsuccess = () => {
        const sorted = sortChakshuHistory(all.result as ChakshuHistoryItem[]);
        const keep = new Set(sorted.map((entry) => entry.id));
        for (const entry of all.result as ChakshuHistoryItem[]) {
          if (!keep.has(entry.id)) store.delete(entry.id);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save video history."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Video history save was aborted."));
    });
  } finally {
    database.close();
  }
}

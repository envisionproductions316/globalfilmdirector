export type MediaRecord = {
  id: string;
  projectId: string;
  takeId: string;
  blob: Blob;
  mime: string;
  bytes: number;
  createdAt: string;
};

const DB_NAME = "gfd-media";
const STORE = "recordings";

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("IndexedDB is not available in this browser."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function putMedia(record: MediaRecord) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("The recording could not be stored."));
      tx.onabort = () => reject(tx.error ?? new Error("The recording could not be stored."));
    });
  } finally {
    db.close();
  }
}

export async function getMedia(id: string): Promise<MediaRecord | undefined> {
  const db = await openDb();
  try {
    return await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).get(id));
  } finally {
    db.close();
  }
}

export async function deleteMedia(id: string) {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("The recording could not be deleted."));
    });
  } finally {
    db.close();
  }
}

export async function listMedia(): Promise<{ ids: string[]; bytes: number }> {
  const db = await openDb();
  try {
    const records = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll() as IDBRequest<MediaRecord[]>);
    return {
      ids: records.map((record) => record.id),
      bytes: records.reduce((total, record) => total + (record.bytes || record.blob?.size || 0), 0),
    };
  } finally {
    db.close();
  }
}

export function storageError(error: unknown) {
  if (error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
    return "This device does not have enough space for the recording.";
  }
  return "The recording could not be stored on this device.";
}

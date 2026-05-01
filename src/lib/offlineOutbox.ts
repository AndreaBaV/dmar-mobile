import type { OutboxOperation, SyncStatus } from '../types/SyncContracts';

const DB_NAME = 'dmar-mobile-offline';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox_operations';
const SALES_STORE = 'sales_local';
const PICKUP_STORE = 'pickup_local';

type LocalSaleRecord = {
  id: string;
  createdAt: number;
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
};

type LocalPickupRecord = {
  id: string;
  createdAt: number;
  payload: Record<string, unknown>;
  syncStatus: SyncStatus;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
        outbox.createIndex('status', 'status', { unique: false });
        outbox.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(SALES_STORE)) {
        db.createObjectStore(SALES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PICKUP_STORE)) {
        db.createObjectStore(PICKUP_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const txn = db.transaction(storeName, mode);
    const store = txn.objectStore(storeName);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOperation(op: OutboxOperation): Promise<void> {
  await tx(OUTBOX_STORE, 'readwrite', (store) => store.put(op));
}

export async function listPendingOperations(now = Date.now()): Promise<OutboxOperation[]> {
  const all = await tx(OUTBOX_STORE, 'readonly', (store) => store.getAll());
  return (all as OutboxOperation[])
    .filter((op) => (op.status === 'pending' || op.status === 'failed') && op.nextRetryAt <= now)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateOperation(op: OutboxOperation): Promise<void> {
  await tx(OUTBOX_STORE, 'readwrite', (store) => store.put(op));
}

export async function saveLocalSale(id: string, payload: Record<string, unknown>, syncStatus: SyncStatus): Promise<void> {
  const rec: LocalSaleRecord = { id, payload, syncStatus, createdAt: Date.now() };
  await tx(SALES_STORE, 'readwrite', (store) => store.put(rec));
}

export async function saveLocalPickup(id: string, payload: Record<string, unknown>, syncStatus: SyncStatus): Promise<void> {
  const rec: LocalPickupRecord = { id, payload, syncStatus, createdAt: Date.now() };
  await tx(PICKUP_STORE, 'readwrite', (store) => store.put(rec));
}

export async function markLocalSaleStatus(id: string, syncStatus: SyncStatus): Promise<void> {
  const current = await tx(SALES_STORE, 'readonly', (store) => store.get(id));
  if (!current) return;
  await tx(SALES_STORE, 'readwrite', (store) => store.put({ ...current, syncStatus }));
}

export async function markLocalPickupStatus(id: string, syncStatus: SyncStatus): Promise<void> {
  const current = await tx(PICKUP_STORE, 'readonly', (store) => store.get(id));
  if (!current) return;
  await tx(PICKUP_STORE, 'readwrite', (store) => store.put({ ...current, syncStatus }));
}

export async function getLocalSales(): Promise<LocalSaleRecord[]> {
  const all = await tx(SALES_STORE, 'readonly', (store) => store.getAll());
  return (all as LocalSaleRecord[]).sort((a, b) => b.createdAt - a.createdAt);
}

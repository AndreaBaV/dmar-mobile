import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { OutboxOperation } from '../types/SyncContracts';
import {
  listPendingOperations,
  markLocalPickupStatus,
  markLocalSaleStatus,
  updateOperation,
} from '../lib/offlineOutbox';

class SyncEngine {
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), 5000);
    window.addEventListener('online', this.onlineHandler);
    void this.flush();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    window.removeEventListener('online', this.onlineHandler);
  }

  private onlineHandler = () => {
    void this.flush();
  };

  async flush(): Promise<void> {
    if (this.running || !navigator.onLine) return;
    this.running = true;
    try {
      const ops = await listPendingOperations();
      for (const op of ops) {
        await this.processOperation(op);
      }
    } finally {
      this.running = false;
    }
  }

  private async processOperation(op: OutboxOperation): Promise<void> {
    try {
      op.status = 'syncing';
      op.updatedAt = Date.now();
      await updateOperation(op);

      if (op.type === 'SALE_COMMIT') {
        await setDoc(doc(db, 'sales', op.entityId), op.payload, { merge: true });
        await markLocalSaleStatus(op.entityId, 'synced');
      } else if (op.type === 'PICKUP_CREATE') {
        await setDoc(doc(db, 'onlinePickupOrders', op.entityId), op.payload, { merge: true });
        await markLocalPickupStatus(op.entityId, 'synced');
      } else if (op.type === 'PICKUP_UPDATE_STATUS') {
        const status = (op.payload.status as string) || 'pending';
        await updateDoc(doc(db, 'onlinePickupOrders', op.entityId), { status });
      } else if (op.type === 'SALE_MARK_PRINTED') {
        await updateDoc(doc(db, 'sales', op.entityId), op.payload);
      }

      op.status = 'synced';
      op.lastError = undefined;
      op.updatedAt = Date.now();
      await updateOperation(op);
    } catch (error) {
      op.retryCount += 1;
      op.status = 'failed';
      op.updatedAt = Date.now();
      op.lastError = error instanceof Error ? error.message : String(error);
      const delayMs = Math.min(10 * 60_000, Math.pow(2, Math.min(op.retryCount, 7)) * 1000);
      op.nextRetryAt = Date.now() + delayMs + Math.floor(Math.random() * 1000);
      await updateOperation(op);
    }
  }
}

export const syncEngine = new SyncEngine();

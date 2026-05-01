import type { PaymentMethod } from '../services/saleService';

export type PrintStatus = 'pending' | 'printing' | 'printed' | 'error';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface TicketJob {
  ticketId: string;
  saleId: string;
  storeId: string;
  deviceId: string;
  idempotencyKey: string;
  createdAt: number;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    variant?: { color: string; size: string; sku?: string };
  }>;
  totals: { total: number; cashReceived?: string; change?: number };
  paymentMethod: PaymentMethod;
  userName: string;
  printStatus: PrintStatus;
  syncStatus: SyncStatus;
}

export interface SaleSyncEnvelope {
  saleId: string;
  ticketId: string;
  storeId: string;
  deviceId: string;
  idempotencyKey: string;
  createdAt: number;
  payload: Record<string, unknown>;
  printStatus: PrintStatus;
  syncStatus: SyncStatus;
}

export type OutboxOperationType =
  | 'SALE_COMMIT'
  | 'PICKUP_CREATE'
  | 'PICKUP_UPDATE_STATUS'
  | 'SALE_MARK_PRINTED';

export interface OutboxOperation {
  id: string;
  type: OutboxOperationType;
  entityId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
  status: SyncStatus;
  retryCount: number;
  nextRetryAt: number;
  lastError?: string;
}

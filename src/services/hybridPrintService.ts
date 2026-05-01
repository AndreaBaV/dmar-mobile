import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { enqueueOperation } from '../lib/offlineOutbox';
import type { OutboxOperation, TicketJob } from '../types/SyncContracts';
import type { PaymentMethod } from './saleService';
import type { Variant } from '../types/Product';

type SaleCartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Variant;
};

const HOST_KEY = 'dmar_desktop_host';
const TOKEN_KEY = 'dmar_local_api_token';

function nowIso(): string {
  return new Date().toISOString();
}

function getDesktopEndpoint(): string {
  const host = localStorage.getItem(HOST_KEY) || '127.0.0.1';
  return `http://${host}:8765/print-ticket`;
}

function getApiToken(): string {
  return localStorage.getItem(TOKEN_KEY) || 'dmar-local-token';
}

function opBase(id: string): OutboxOperation {
  return {
    id,
    type: 'SALE_MARK_PRINTED',
    entityId: id,
    payload: {},
    idempotencyKey: id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: 'pending',
    retryCount: 0,
    nextRetryAt: Date.now(),
  };
}

export class HybridPrintService {
  static async printNowOrFallback(args: {
    saleId: string;
    ticketId: string;
    cart: SaleCartItem[];
    total: number;
    cashReceived?: string | null;
    paymentMethod: PaymentMethod;
    userName: string;
    clientName?: string;
  }): Promise<{ printedNow: boolean; channel: 'lan' | 'queued' }> {
    const { saleId, ticketId, cart, total, cashReceived, paymentMethod, userName } = args;
    const date = nowIso();
    const cash = cashReceived ?? total.toFixed(2);
    const cashNumber = Number.parseFloat(cash || '0');

    const lanResult = await this.tryLanPrint({
      ticketId,
      saleId,
      userName,
      paymentMethod,
      cashReceived: Number.isFinite(cashNumber) ? cashNumber : total,
      total,
      date,
      deviceId: 'mobile-app',
      items: cart,
    });

    if (lanResult === 'printed') {
      await this.markPrintedRemote(saleId, 'lan');
      return { printedNow: true, channel: 'lan' };
    }

    if (lanResult === 'queued') {
      await this.enqueuePendingPrintMarker(saleId);
      return { printedNow: false, channel: 'queued' };
    }

    await this.enqueuePendingPrintMarker(saleId);
    return { printedNow: false, channel: 'queued' };
  }

  static buildTicketJob(args: {
    saleId: string;
    ticketId: string;
    cart: SaleCartItem[];
    total: number;
    cashReceived?: string | null;
    paymentMethod: PaymentMethod;
    userName: string;
    idempotencyKey: string;
  }): TicketJob {
    return {
      ticketId: args.ticketId,
      saleId: args.saleId,
      storeId: 'default-store',
      deviceId: 'mobile-app',
      idempotencyKey: args.idempotencyKey,
      createdAt: Date.now(),
      items: args.cart.map((x) => ({
        productId: x.productId,
        name: x.name,
        price: x.price,
        quantity: x.quantity,
        variant: x.variant ? { color: x.variant.color, size: x.variant.size, sku: x.variant.sku } : undefined,
      })),
      totals: {
        total: args.total,
        cashReceived: args.cashReceived ?? args.total.toFixed(2),
        change: Math.max(0, Number(args.cashReceived ?? args.total.toFixed(2)) - args.total),
      },
      paymentMethod: args.paymentMethod,
      userName: args.userName,
      printStatus: 'pending',
      syncStatus: 'pending',
    };
  }

  private static async tryLanPrint(payload: any): Promise<'printed' | 'queued' | 'failed'> {
    const endpoint = getDesktopEndpoint();
    const token = getApiToken();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-dmar-token': token,
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      if (!res.ok) return 'failed';
      const json = await res.json();
      if (json?.status === 'printed' || json?.status === 'already_printed') return 'printed';
      if (json?.status === 'queued') return 'queued';
      return 'failed';
    } catch {
      return 'failed';
    } finally {
      clearTimeout(t);
    }
  }

  private static async markPrintedRemote(saleId: string, channel: 'lan'): Promise<void> {
    const patch = {
      printStatus: 'printed',
      printedAt: nowIso(),
      printedByDeviceId: `mobile-${channel}`,
      printError: null,
    };
    try {
      await updateDoc(doc(db, 'sales', saleId), patch);
    } catch {
      const op = opBase(`sale-print-${saleId}-${Date.now()}`);
      op.entityId = saleId;
      op.payload = patch;
      await enqueueOperation(op);
    }
  }

  private static async enqueuePendingPrintMarker(saleId: string): Promise<void> {
    const op = opBase(`sale-print-pending-${saleId}-${Date.now()}`);
    op.entityId = saleId;
    op.payload = { printStatus: 'pending' };
    await enqueueOperation(op);
  }
}

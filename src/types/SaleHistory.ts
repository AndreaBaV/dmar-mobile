import type { PaymentMethod } from '../services/saleService';

/** Fila de `sales` alineada con el POS web (SalesHistoryPage). */
export interface SaleHistoryRow {
  id: string;
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    variant?: {
      color: string;
      size: string;
      sku?: string;
    };
  }>;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: string;
  change?: number;
  timestamp: unknown;
  status: 'completed' | 'cancelled';
  clientId?: string | null;
  clientName?: string;
  pointsEarned?: number;
  userName?: string;
  emailSent?: boolean;
  emailSentTo?: string;
}

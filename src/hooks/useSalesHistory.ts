import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PaymentMethod } from '../services/saleService';
import type { SaleHistoryRow } from '../types/SaleHistory';
import { getLocalSales } from '../lib/offlineOutbox';

export function useSalesHistory(limitCount = 400) {
  const [data, setData] = useState<SaleHistoryRow[]>([]);
  const [localRows, setLocalRows] = useState<SaleHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const local = await getLocalSales();
      if (!mounted) return;
      const mapped = local.map((rec) => {
        const raw = rec.payload as Partial<SaleHistoryRow> & Record<string, unknown>;
        return {
          id: rec.id,
          items: Array.isArray(raw.items) ? raw.items : [],
          total: typeof raw.total === 'number' ? raw.total : 0,
          paymentMethod: raw.paymentMethod === 'card' || raw.paymentMethod === 'transfer' || raw.paymentMethod === 'cash' ? raw.paymentMethod : 'cash',
          status: raw.status === 'cancelled' ? 'cancelled' : 'completed',
          timestamp: raw.timestamp ?? rec.createdAt,
          cashReceived: typeof raw.cashReceived === 'string' ? raw.cashReceived : undefined,
          clientName: typeof raw.clientName === 'string' ? raw.clientName : undefined,
          userName: typeof raw.userName === 'string' ? raw.userName : undefined,
          syncStatus: rec.syncStatus,
        } as SaleHistoryRow;
      });
      setLocalRows(mapped);
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(limitCount));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const remoteRows = snapshot.docs.map((d) => {
          const raw = d.data() as Partial<Omit<SaleHistoryRow, 'id'>>;
          const pm = raw.paymentMethod as PaymentMethod | undefined;
          return {
            id: d.id,
            ...raw,
            items: Array.isArray(raw.items) ? raw.items : [],
            total: typeof raw.total === 'number' ? raw.total : 0,
            paymentMethod: pm === 'card' || pm === 'transfer' || pm === 'cash' ? pm : 'cash',
            status: raw.status === 'cancelled' ? 'cancelled' : 'completed',
            syncStatus: snapshot.metadata.fromCache
              ? (snapshot.metadata.hasPendingWrites ? 'syncing' : 'pending')
              : 'synced',
          } as SaleHistoryRow;
        });
        const merged = [...remoteRows];
        for (const local of localRows) {
          if (!merged.some((row) => row.id === local.id)) {
            merged.push(local);
          }
        }
        setData(merged);
        setLoading(false);
      },
      (err) => {
        console.error('[useSalesHistory]', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [limitCount, localRows]);

  return { data, loading, error };
}

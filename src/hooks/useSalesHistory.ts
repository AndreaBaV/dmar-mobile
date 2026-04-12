import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { PaymentMethod } from '../services/saleService';
import type { SaleHistoryRow } from '../types/SaleHistory';

export function useSalesHistory(limitCount = 400) {
  const [data, setData] = useState<SaleHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(limitCount));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((d) => {
          const raw = d.data() as Partial<Omit<SaleHistoryRow, 'id'>>;
          const pm = raw.paymentMethod as PaymentMethod | undefined;
          return {
            id: d.id,
            ...raw,
            items: Array.isArray(raw.items) ? raw.items : [],
            total: typeof raw.total === 'number' ? raw.total : 0,
            paymentMethod: pm === 'card' || pm === 'transfer' || pm === 'cash' ? pm : 'cash',
            status: raw.status === 'cancelled' ? 'cancelled' : 'completed',
          } as SaleHistoryRow;
        });
        setData(rows);
        setLoading(false);
      },
      (err) => {
        console.error('[useSalesHistory]', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [limitCount]);

  return { data, loading, error };
}

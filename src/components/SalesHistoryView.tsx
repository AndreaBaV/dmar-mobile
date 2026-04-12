import { useMemo, useState, useCallback } from 'react';
import type { PaymentMethod } from '../services/saleService';
import { useSalesHistory } from '../hooks/useSalesHistory';
import type { SaleHistoryRow } from '../types/SaleHistory';
import { SaleHistoryDetailModal } from './SaleHistoryDetailModal';
import './SalesHistoryView.scss';

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

type Props = {
  isAdmin: boolean;
};

function formatDateShort(timestamp: unknown): string {
  if (timestamp == null) return '—';
  const d =
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number | Date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function SalesHistoryView({ isAdmin }: Props) {
  const { data: allSales, loading, error } = useSalesHistory(400);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<PaymentMethod | 'all'>('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterLastHour, setFilterLastHour] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [selected, setSelected] = useState<SaleHistoryRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = allSales;

    if (!includeCancelled) {
      list = list.filter((s) => s.status === 'completed');
    }

    if (filterPayment !== 'all') {
      list = list.filter((s) => s.paymentMethod === filterPayment);
    }

    if (filterLastHour) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      list = list.filter((s) => {
        const saleDate = toDate(s.timestamp);
        return saleDate >= oneHourAgo;
      });
    } else if (filterDateStart || filterDateEnd) {
      list = list.filter((s) => {
        const saleDate = toDate(s.timestamp);
        const saleDateOnly = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
        let okStart = true;
        let okEnd = true;
        if (filterDateStart) {
          const start = new Date(filterDateStart);
          const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
          okStart = saleDateOnly >= startOnly;
        }
        if (filterDateEnd) {
          const end = new Date(filterDateEnd);
          const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
          okEnd = saleDateOnly <= endDay;
        }
        return okStart && okEnd;
      });
    }

    const q = search.trim().toLowerCase();
    if (q.length >= 2) {
      list = list.filter(
        (s) =>
          s.clientName?.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.items.some((it) => it.name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allSales, search, filterPayment, filterDateStart, filterDateEnd, filterLastHour, includeCancelled]);

  const openDetail = useCallback((sale: SaleHistoryRow) => {
    setSelected(sale);
    setDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    setSelected(null);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterLastHour(false);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  if (error) {
    return (
      <div className="sales-hist glass-card">
        <p className="sales-hist-error">No se pudo cargar el historial. Revise la conexión e intente de nuevo.</p>
      </div>
    );
  }

  return (
    <div className="sales-hist">
      <div className="sales-hist-filters glass-card">
        <label className="sales-hist-label" htmlFor="sales-hist-search">
          Buscar
        </label>
        <input
          id="sales-hist-search"
          type="search"
          className="sales-hist-input"
          placeholder="Cliente, ID o producto…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          enterKeyHint="search"
        />

        <label className="sales-hist-label" htmlFor="sales-hist-pay">
          Pago
        </label>
        <select
          id="sales-hist-pay"
          className="sales-hist-select"
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value as PaymentMethod | 'all')}
        >
          <option value="all">Todos</option>
          <option value="cash">Efectivo</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>

        <div className="sales-hist-dates">
          <div className="sales-hist-date-field">
            <span className="sales-hist-mini-label">Desde</span>
            <input
              type="date"
              className="sales-hist-input sales-hist-input--date"
              value={filterDateStart}
              onChange={(e) => {
                setFilterDateStart(e.target.value);
                setFilterLastHour(false);
              }}
            />
          </div>
          <div className="sales-hist-date-field">
            <span className="sales-hist-mini-label">Hasta</span>
            <input
              type="date"
              className="sales-hist-input sales-hist-input--date"
              value={filterDateEnd}
              onChange={(e) => {
                setFilterDateEnd(e.target.value);
                setFilterLastHour(false);
              }}
            />
          </div>
        </div>

        <div className="sales-hist-chips">
          <button
            type="button"
            className={`sales-hist-chip ${filterDateStart === todayStr && filterDateEnd === todayStr && !filterLastHour ? 'active' : ''}`}
            onClick={() => {
              setFilterDateStart(todayStr);
              setFilterDateEnd(todayStr);
              setFilterLastHour(false);
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            className={`sales-hist-chip ${filterLastHour ? 'active' : ''}`}
            onClick={() => {
              setFilterDateStart('');
              setFilterDateEnd('');
              setFilterLastHour(true);
            }}
          >
            Última hora
          </button>
          <button
            type="button"
            className="sales-hist-chip"
            onClick={() => {
              const t = new Date();
              const start = new Date(t);
              start.setDate(t.getDate() - t.getDay());
              start.setHours(0, 0, 0, 0);
              setFilterDateStart(start.toISOString().split('T')[0]);
              setFilterDateEnd(todayStr);
              setFilterLastHour(false);
            }}
          >
            Esta semana
          </button>
          {(filterDateStart || filterDateEnd || filterLastHour) && (
            <button type="button" className="sales-hist-chip sales-hist-chip--danger" onClick={resetFilters}>
              Limpiar
            </button>
          )}
        </div>

        {isAdmin ? (
          <label className="sales-hist-toggle">
            <input type="checkbox" checked={includeCancelled} onChange={(e) => setIncludeCancelled(e.target.checked)} />
            <span>Incluir ventas anuladas</span>
          </label>
        ) : null}

        <p className="sales-hist-count">
          {loading ? 'Cargando…' : `${filtered.length} venta${filtered.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {loading && filtered.length === 0 ? (
        <div className="sales-hist-loading glass-card">
          <div className="sales-hist-spinner" aria-hidden />
          <p>Cargando ventas…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sales-hist-empty glass-card">
          <p>No hay ventas que coincidan.</p>
        </div>
      ) : (
        <ul className="sales-hist-list">
          {filtered.map((sale) => (
            <li key={sale.id}>
              <button type="button" className="sales-hist-card glass-card" onClick={() => openDetail(sale)}>
                <div className="sales-hist-card-top">
                  <span className="sales-hist-id">#{sale.id.substring(0, 8)}</span>
                  <span className="sales-hist-total">{formatMoney(sale.total)}</span>
                </div>
                <div className="sales-hist-card-mid">
                  <span className="sales-hist-time">{formatDateShort(sale.timestamp)}</span>
                  <span className="sales-hist-pay">{paymentMethodLabels[sale.paymentMethod]}</span>
                </div>
                <div className="sales-hist-card-bottom">
                  <span className="sales-hist-client">{sale.clientName || 'Contado'}</span>
                  {sale.status === 'cancelled' ? <span className="sales-hist-badge">Anulada</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="sales-hist-hint">{isAdmin ? '' : 'Solo lectura. La reimpresión de tickets es solo para administradores.'}</p>

      <SaleHistoryDetailModal open={detailOpen} sale={selected} isAdmin={isAdmin} onClose={closeDetail} />
    </div>
  );
}

function toDate(timestamp: unknown): Date {
  if (
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
  ) {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  return new Date(timestamp as string | number | Date);
}

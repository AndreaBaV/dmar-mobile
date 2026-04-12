import { SaleService } from '../services/saleService';
import type { PaymentMethod } from '../services/saleService';
import { printHtmlInNewWindow } from '../lib/printTicketWindow';
import type { SaleHistoryRow } from '../types/SaleHistory';
import './SaleHistoryDetailModal.scss';

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

type Props = {
  open: boolean;
  sale: SaleHistoryRow | null;
  isAdmin: boolean;
  onClose: () => void;
};

function formatDate(timestamp: unknown): string {
  if (timestamp == null) return 'Fecha desconocida';
  const d =
    typeof timestamp === 'object' &&
    timestamp !== null &&
    'toDate' in timestamp &&
    typeof (timestamp as { toDate: () => Date }).toDate === 'function'
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number | Date);
  if (Number.isNaN(d.getTime())) return 'Fecha desconocida';
  return d.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function baseName(name: string): string {
  const parts = name.split(' - ');
  if (parts.length >= 3) return parts.slice(0, -2).join(' - ');
  return name;
}

export function SaleHistoryDetailModal({ open, sale, isAdmin, onClose }: Props) {
  if (!open || !sale) return null;

  const handleReprint = () => {
    if (sale.status !== 'completed') return;
    const html = SaleService.getPrintableTicketHtmlForSale({
      id: sale.id,
      items: sale.items,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      cashReceived: sale.cashReceived,
      userName: sale.userName,
    });
    printHtmlInNewWindow(html);
  };

  return (
    <div className="sale-hist-detail-backdrop" role="dialog" aria-modal="true" aria-labelledby="sale-hist-detail-title" onClick={onClose}>
      <div className="sale-hist-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sale-hist-detail-header">
          <h2 id="sale-hist-detail-title">Venta #{sale.id.substring(0, 8)}</h2>
          <button type="button" className="sale-hist-detail-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {sale.status === 'cancelled' ? (
          <p className="sale-hist-detail-cancelled">Anulada</p>
        ) : null}

        <div className="sale-hist-detail-meta">
          <div className="sale-hist-detail-row">
            <span>Fecha</span>
            <strong>{formatDate(sale.timestamp)}</strong>
          </div>
          <div className="sale-hist-detail-row">
            <span>Cliente</span>
            <strong>{sale.clientName || 'Contado'}</strong>
          </div>
          <div className="sale-hist-detail-row">
            <span>Pago</span>
            <strong>{paymentMethodLabels[sale.paymentMethod]}</strong>
          </div>
          <div className="sale-hist-detail-row">
            <span>Atendió</span>
            <strong>{sale.userName || '—'}</strong>
          </div>
          {sale.pointsEarned != null && sale.pointsEarned > 0 ? (
            <div className="sale-hist-detail-row">
              <span>Puntos</span>
              <strong>{sale.pointsEarned}</strong>
            </div>
          ) : null}
        </div>

        <h3 className="sale-hist-detail-items-title">Productos</h3>
        <ul className="sale-hist-detail-items">
          {sale.items.map((it, i) => (
            <li key={`${it.productId}-${i}`} className="sale-hist-detail-item">
              <div className="sale-hist-detail-item-main">
                <span className="sale-hist-detail-qty">{it.quantity}×</span>
                <span className="sale-hist-detail-name">{baseName(it.name)}</span>
              </div>
              {it.variant ? (
                <span className="sale-hist-detail-var">
                  {it.variant.color} · {it.variant.size}
                </span>
              ) : null}
              <span className="sale-hist-detail-line-total">{formatMoney(it.price * it.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="sale-hist-detail-totals">
          <div className="sale-hist-detail-total-row">
            <span>Total</span>
            <strong>{formatMoney(sale.total)}</strong>
          </div>
          {sale.paymentMethod === 'cash' && sale.cashReceived ? (
            <>
              <div className="sale-hist-detail-total-row sale-hist-detail-total-row--muted">
                <span>Recibido</span>
                <span>{formatMoney(parseFloat(sale.cashReceived))}</span>
              </div>
              {sale.change != null && sale.change > 0 ? (
                <div className="sale-hist-detail-total-row sale-hist-detail-total-row--muted">
                  <span>Cambio</span>
                  <span>{formatMoney(sale.change)}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="sale-hist-detail-actions">
          {isAdmin && sale.status === 'completed' ? (
            <button type="button" className="sale-hist-detail-btn sale-hist-detail-btn--primary" onClick={() => handleReprint()}>
              Reimprimir ticket
            </button>
          ) : null}
          <button type="button" className="sale-hist-detail-btn sale-hist-detail-btn--secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

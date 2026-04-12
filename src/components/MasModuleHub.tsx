import { useCallback, useEffect, useState } from 'react';
import { clientService } from '../services/clientService';
import { apartadoService } from '../services/apartadoService';
import { PickupOrderService, type PickupOrder, type PickupOrderStatus } from '../services/pickupOrderService';
import type { Client } from '../types/Client';
import type { Apartado } from '../types/Apartado';
import './MasModuleHub.scss';

export type MasStack = 'menu' | 'clientes' | 'apartados' | 'pedidos';

type Props = {
  stack: MasStack;
  onNavigate: (s: MasStack) => void;
  cashierName: string;
};

export function MasModuleHub({ stack, onNavigate, cashierName }: Props) {
  if (stack === 'menu') {
    return (
      <div className="mas-hub">
        <h2 className="mas-hub__title">Más</h2>
        <div className="mas-hub__grid">
          <button type="button" className="mas-hub__card" onClick={() => onNavigate('clientes')}>
            <span className="mas-hub__card-title">Clientes</span>
            <span className="mas-hub__card-desc">Buscar, alta y edición</span>
          </button>
          <button type="button" className="mas-hub__card" onClick={() => onNavigate('apartados')}>
            <span className="mas-hub__card-title">Apartados</span>
            <span className="mas-hub__card-desc">Activos, abonos y liquidar</span>
          </button>
          <button type="button" className="mas-hub__card" onClick={() => onNavigate('pedidos')}>
            <span className="mas-hub__card-title">Pedidos recogida</span>
            <span className="mas-hub__card-desc">Tienda en línea → tienda física</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mas-hub">
      <button type="button" className="mas-hub__back" onClick={() => onNavigate('menu')}>
        ← Volver
      </button>
      {stack === 'clientes' ? <ClientsSubView /> : null}
      {stack === 'apartados' ? <ApartadosSubView cashierName={cashierName} /> : null}
      {stack === 'pedidos' ? <PedidosSubView /> : null}
    </div>
  );
}

function ClientsSubView() {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<Client | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });

  const runSearch = useCallback(async () => {
    if (q.trim().length < 2) {
      setList([]);
      return;
    }
    setLoading(true);
    try {
      const { clients } = await clientService.searchByName(q.trim(), 40);
      setList(clients);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => void runSearch(), 320);
    return () => window.clearTimeout(t);
  }, [q, runSearch]);

  const openNew = () => {
    setForm({ name: '', phone: '', email: '' });
    setModal('new');
  };

  const saveClient = async () => {
    if (!form.name.trim()) return;
    try {
      if (modal === 'new') {
        await clientService.create({ name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() });
      } else if (modal) {
        await clientService.update(modal.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
        });
      }
      setModal(null);
      void runSearch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <h2 className="mas-hub__title">Clientes</h2>
      <div className="mas-hub__toolbar">
        <input
          className="mas-hub__input"
          placeholder="Buscar (nombre o teléfono)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" className="mas-hub__btn mas-hub__btn--primary" onClick={openNew}>
          + Nuevo
        </button>
      </div>
      {loading ? <p className="mas-hub__muted">Buscando…</p> : null}
      <ul className="mas-hub__list">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="mas-hub__row"
              onClick={() => {
                setForm({ name: c.name, phone: c.phone || '', email: c.email || '' });
                setModal(c);
              }}
            >
              <span className="mas-hub__row-name">{c.name}</span>
              <span className="mas-hub__row-meta">
                {c.phone || '—'} · {c.points} pts
              </span>
            </button>
          </li>
        ))}
      </ul>

      {modal ? (
        <div className="mas-hub__modal-back" role="dialog" aria-modal onClick={() => setModal(null)}>
          <div className="mas-hub__modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'new' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
            <label>
              Nombre
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label>
              Teléfono
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <div className="mas-hub__modal-actions">
              <button type="button" className="mas-hub__btn" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button type="button" className="mas-hub__btn mas-hub__btn--primary" onClick={() => void saveClient()}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ApartadosSubView({ cashierName }: { cashierName: string }) {
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [rows, setRows] = useState<Apartado[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Apartado | null>(null);
  const [abono, setAbono] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === 'active' ? await apartadoService.getActive() : await apartadoService.getCompleted();
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const paid = (a: Apartado) => a.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = (a: Apartado) => Math.max(0, a.price - paid(a));

  const doAbono = async () => {
    if (!detail) return;
    const n = parseFloat(abono.replace(',', '.'));
    if (Number.isNaN(n) || n <= 0) {
      setMsg('Monto inválido');
      return;
    }
    setMsg(null);
    try {
      await apartadoService.addPayment(detail.id, n, 'cash');
      setAbono('');
      setDetail(null);
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  };

  const doLiquidar = async () => {
    if (!detail) return;
    setMsg(null);
    try {
      await apartadoService.liquidate(detail.id, 'cash', cashierName);
      setDetail(null);
      void load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <>
      <h2 className="mas-hub__title">Apartados</h2>
      <div className="mas-hub__tabs">
        <button type="button" className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>
          Activos
        </button>
        <button type="button" className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>
          Completados
        </button>
      </div>
      {loading ? <p className="mas-hub__muted">Cargando…</p> : null}
      {msg ? <p className="mas-hub__err">{msg}</p> : null}
      <ul className="mas-hub__list">
        {rows.map((a) => (
          <li key={a.id}>
            <button type="button" className="mas-hub__row" onClick={() => setDetail(a)}>
              <span className="mas-hub__row-name">{a.clientName}</span>
              <span className="mas-hub__row-meta">
                ${a.price.toFixed(2)} · {a.status}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {detail ? (
        <div className="mas-hub__modal-back" role="dialog" aria-modal onClick={() => setDetail(null)}>
          <div className="mas-hub__modal" onClick={(e) => e.stopPropagation()}>
            <h3>{detail.clientName}</h3>
            <p className="mas-hub__muted">{detail.clientPhone}</p>
            <p>Total: ${detail.price.toFixed(2)}</p>
            <p>Pagado: ${paid(detail).toFixed(2)}</p>
            <p>Resta: ${remaining(detail).toFixed(2)}</p>
            <p className="mas-hub__small">{detail.productDescription}</p>
            {detail.status === 'active' && remaining(detail) > 0 ? (
              <>
                <label>
                  Abono ($)
                  <input value={abono} onChange={(e) => setAbono(e.target.value)} inputMode="decimal" />
                </label>
                <div className="mas-hub__modal-actions">
                  <button type="button" className="mas-hub__btn mas-hub__btn--primary" onClick={() => void doAbono()}>
                    Registrar abono
                  </button>
                  <button type="button" className="mas-hub__btn" onClick={() => void doLiquidar()}>
                    Liquidar saldo
                  </button>
                </div>
              </>
            ) : null}
            <button type="button" className="mas-hub__btn" onClick={() => setDetail(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

const statusLabel: Record<PickupOrderStatus, string> = {
  pending: 'Pendiente',
  packed: 'Empacado',
  paid: 'Pagado',
  delivered: 'Entregado',
};

function PedidosSubView() {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setOrders(await PickupOrderService.getAllOrders());
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (id: string, s: PickupOrderStatus) => {
    try {
      await PickupOrderService.updateOrderStatus(id, s);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  };

  const pay = async (id: string) => {
    try {
      await PickupOrderService.markAsPaid(id);
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <>
      <h2 className="mas-hub__title">Pedidos recogida</h2>
      {loading ? <p className="mas-hub__muted">Cargando…</p> : null}
      {err ? <p className="mas-hub__err">{err}</p> : null}
      <ul className="mas-hub__list mas-hub__list--wide">
        {orders.map((o) => (
          <li key={o.id} className="mas-hub__order">
            <div className="mas-hub__order-head">
              <strong>{o.customerName}</strong>
              <span>{statusLabel[o.status]}</span>
            </div>
            <div className="mas-hub__order-meta">
              {o.pickupDate} · {o.pickupTimeSlot} · ${o.total.toFixed(2)}
            </div>
            <div className="mas-hub__order-actions">
              {o.status === 'pending' ? (
                <button type="button" className="mas-hub__btn" onClick={() => void setStatus(o.id, 'packed')}>
                  Empacado
                </button>
              ) : null}
              {o.status === 'packed' && o.paymentStatus === 'pending_in_store' ? (
                <button type="button" className="mas-hub__btn mas-hub__btn--primary" onClick={() => void pay(o.id)}>
                  Cobrar en tienda
                </button>
              ) : null}
              {o.paymentStatus === 'paid' && o.status !== 'delivered' ? (
                <button type="button" className="mas-hub__btn" onClick={() => void setStatus(o.id, 'delivered')}>
                  Entregado
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

import type { CartLine } from '../utils/cartUtils';

export function baseProductName(name: string): string {
  const parts = name.split(' - ');
  if (parts.length >= 3) return parts.slice(0, -2).join(' - ');
  return name;
}

export type TicketTextParams = {
  saleId: string;
  lines: CartLine[];
  total: number;
  cashReceived: string;
  change: number;
  cashierName: string;
  clientName: string;
};

/** Texto plano para compartir o depurar (sin depender del HTML del escritorio). */
export function buildPlainTextTicket(p: TicketTextParams): string {
  const date = new Date().toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  const rows: string[] = [
    "D'MAR TIENDA DE ROPA",
    '-------------------',
    date,
    `Ticket: ${p.saleId.substring(0, 8)}`,
    `Cliente: ${p.clientName}`,
    `Cajero: ${p.cashierName}`,
    '-------------------',
  ];
  for (const it of p.lines) {
    const nm = baseProductName(it.name);
    const varLine = it.variant ? `${it.variant.color} / ${it.variant.size}` : '';
    rows.push(`${it.quantity}x ${nm}`);
    if (varLine) rows.push(`   ${varLine}`);
    rows.push(`   ${(it.price * it.quantity).toFixed(2)} MXN`);
  }
  rows.push('-------------------');
  rows.push(`TOTAL: $${p.total.toFixed(2)}`);
  rows.push(`Efectivo: $${p.cashReceived}`);
  rows.push(`Cambio: $${p.change.toFixed(2)}`);
  rows.push('');
  rows.push('Políticas: cambios 15 días con ticket.');
  rows.push('¡Gracias por su compra!');
  return rows.join('\n');
}

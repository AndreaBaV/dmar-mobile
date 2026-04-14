import { Capacitor } from '@capacitor/core';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';
import type { CartLine } from '../utils/cartUtils';
import { baseProductName } from '../lib/ticketText';

const LS_ADDR = 'dmar_thermal_printer_address';
const LS_NAME = 'dmar_thermal_printer_name';

/**
 * Android: Bluetooth clásico (plugin). iOS: mismo paquete JS, nativo enlazado por SPM local
 * (`ios/App/LocalPackages/CapacitorThermalPrinter` + `scripts/setup-ios-thermal-printer.mjs` tras `cap sync`).
 * En iPhone solo impresoras ESC/POS con BLE (CoreBluetooth); no hay SPP Bluetooth clásico.
 */
export function isThermalPrinterSupported(): boolean {
  if (!Capacitor.isNativePlatform()) return false;
  const p = Capacitor.getPlatform();
  return p === 'android' || p === 'ios';
}

export function getSavedPrinter(): { address: string; name: string } | null {
  try {
    const address = localStorage.getItem(LS_ADDR);
    const name = localStorage.getItem(LS_NAME);
    if (!address) return null;
    return { address, name: name || 'Impresora' };
  } catch {
    return null;
  }
}

export function savePrinter(device: { address: string; name: string }): void {
  try {
    localStorage.setItem(LS_ADDR, device.address);
    localStorage.setItem(LS_NAME, device.name);
  } catch {
    /* */
  }
}

export function clearSavedPrinter(): void {
  try {
    localStorage.removeItem(LS_ADDR);
    localStorage.removeItem(LS_NAME);
  } catch {
    /* */
  }
}

export async function ensurePrinterConnected(): Promise<boolean> {
  if (!isThermalPrinterSupported()) return false;
  const saved = getSavedPrinter();
  if (!saved) return false;
  try {
    if (await CapacitorThermalPrinter.isConnected()) return true;
    const dev = await CapacitorThermalPrinter.connect({ address: saved.address });
    return dev != null;
  } catch {
    return false;
  }
}

export type ThermalTicketParams = {
  saleId: string;
  lines: CartLine[];
  total: number;
  cashReceived: string;
  change: number;
  cashierName: string;
  clientName: string;
};

/**
 * Imprime ticket ESC/POS por Bluetooth (plugin térmico).
 * Requiere impresora emparejada y conexión previa o `ensurePrinterConnected`.
 */
export async function printThermalTicket(p: ThermalTicketParams): Promise<void> {
  if (!isThermalPrinterSupported()) {
    throw new Error('Impresora térmica Bluetooth no disponible en este dispositivo.');
  }
  const date = new Date().toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const b = CapacitorThermalPrinter.begin()
    .align('center')
    .bold(true)
    .text("D'MAR TIENDA DE ROPA\n")
    .clearFormatting()
    .text(`${date}\n`)
    .text(`ID: ${p.saleId.substring(0, 8)}\n`)
    .text('-------------------------\n')
    .align('left')
    .text(`Cliente: ${p.clientName}\n`)
    .text(`Cajero: ${p.cashierName}\n`)
    .text('-------------------------\n');

  for (const it of p.lines) {
    const nm = baseProductName(it.name);
    b.text(`${it.quantity}x ${nm}\n`);
    if (it.variant) {
      b.text(`  ${it.variant.color} / ${it.variant.size}\n`);
    }
    b.text(`  Importe: $${(it.price * it.quantity).toFixed(2)}\n`);
  }

  b.text('-------------------------\n')
    .align('right')
    .bold(true)
    .text(`TOTAL $${p.total.toFixed(2)}\n`)
    .clearFormatting()
    .align('left')
    .text(`Recibido: $${p.cashReceived}\n`)
    .text(`Cambio: $${p.change.toFixed(2)}\n`)
    .text('-------------------------\n')
    .align('center')
    .font('B')
    .text('Cambios 15 dias con ticket.\n')
    .text('Gracias por su compra.\n')
    .clearFormatting()
    .feedCutPaper(false);

  await b.write();
}

/** Tras una venta: conecta si hay guardada, imprime; devuelve si imprimió. */
export async function tryPrintSaleTicket(p: ThermalTicketParams): Promise<boolean> {
  if (!isThermalPrinterSupported()) return false;
  const saved = getSavedPrinter();
  if (!saved) return false;
  const ok = await ensurePrinterConnected();
  if (!ok) return false;
  try {
    await printThermalTicket(p);
    return true;
  } catch (e) {
    console.error('[thermal]', e);
    return false;
  }
}

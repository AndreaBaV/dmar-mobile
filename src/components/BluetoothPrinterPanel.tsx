import { useEffect, useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';
import type { BluetoothDevice } from 'capacitor-thermal-printer';
import {
  getSavedPrinter,
  savePrinter,
  clearSavedPrinter,
  ensurePrinterConnected,
  isThermalPrinterSupported,
} from '../services/bluetoothThermalPrint';
import './BluetoothPrinterPanel.scss';

export function BluetoothPrinterPanel() {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(() => getSavedPrinter());
  const [connected, setConnected] = useState(false);
  const [listenersReady, setListenersReady] = useState(false);
  /** Promesa que resuelve cuando los listeners del plugin están registrados (evita clics antes de tiempo). */
  const listenersInitRef = useRef<Promise<void> | null>(null);
  const listenerHandlesRef = useRef<Array<{ remove: () => Promise<void> }>>([]);

  const refreshConnection = useCallback(async () => {
    if (!isThermalPrinterSupported()) return;
    try {
      setConnected(await CapacitorThermalPrinter.isConnected());
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void refreshConnection();
  }, [refreshConnection, saved]);

  useEffect(() => {
    if (!isThermalPrinterSupported()) return;

    let cancelled = false;
    listenerHandlesRef.current = [];

    listenersInitRef.current = (async () => {
      try {
        const h1 = await CapacitorThermalPrinter.addListener('discoverDevices', (e) => {
          if (!cancelled) setDevices(e.devices ?? []);
        });
        listenerHandlesRef.current.push(h1);
        const h2 = await CapacitorThermalPrinter.addListener('discoveryFinish', () => {
          if (!cancelled) setScanning(false);
        });
        listenerHandlesRef.current.push(h2);
        const h3 = await CapacitorThermalPrinter.addListener('connected', () => {
          if (!cancelled) setConnected(true);
        });
        listenerHandlesRef.current.push(h3);
        const h4 = await CapacitorThermalPrinter.addListener('disconnected', () => {
          if (!cancelled) setConnected(false);
        });
        listenerHandlesRef.current.push(h4);
        if (!cancelled) setListenersReady(true);
      } catch (e) {
        console.error('[BluetoothPrinterPanel] addListener', e);
        if (!cancelled) {
          setMsg(e instanceof Error ? e.message : 'No se pudo iniciar Bluetooth.');
          setListenersReady(false);
        }
        throw e;
      }
    })();

    return () => {
      cancelled = true;
      setListenersReady(false);
      listenersInitRef.current = null;
      const hs = [...listenerHandlesRef.current];
      listenerHandlesRef.current = [];
      void Promise.all(hs.map((h) => h.remove()));
    };
  }, []);

  const startSearch = async () => {
    if (!isThermalPrinterSupported()) return;
    const init = listenersInitRef.current;
    if (!init) {
      setMsg('Espere un momento e intente de nuevo.');
      return;
    }
    try {
      await init;
    } catch {
      return;
    }
    setMsg(null);
    setDevices([]);
    setScanning(true);
    try {
      await CapacitorThermalPrinter.startScan();
      window.setTimeout(() => {
        void CapacitorThermalPrinter.stopScan().catch(() => {});
      }, 15000);
    } catch (e) {
      setScanning(false);
      setMsg(e instanceof Error ? e.message : 'No se pudo buscar.');
    }
  };

  const connectTo = async (d: BluetoothDevice) => {
    setBusy(true);
    setMsg(null);
    try {
      await CapacitorThermalPrinter.stopScan().catch(() => {});
      setScanning(false);
      const res = await CapacitorThermalPrinter.connect({ address: d.address });
      if (res) {
        savePrinter({ address: res.address, name: res.name || d.name });
        setSaved(getSavedPrinter());
        setMsg(`Conectado: ${res.name || d.name}`);
      } else {
        setMsg('No se pudo conectar.');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error de conexión.');
    } finally {
      setBusy(false);
      void refreshConnection();
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await CapacitorThermalPrinter.disconnect();
      clearSavedPrinter();
      setSaved(null);
      setMsg('Impresora desvinculada de la app.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al desconectar.');
    } finally {
      setBusy(false);
      void refreshConnection();
    }
  };

  const testPrint = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const ok = await ensurePrinterConnected();
      if (!ok) {
        setMsg('Conecte una impresora primero.');
        return;
      }
      await CapacitorThermalPrinter.begin()
        .align('center')
        .text("D'MAR — prueba de impresora\n")
        .text('Si lee esto, Bluetooth OK.\n')
        .feedCutPaper(false)
        .write();
      setMsg('Prueba enviada.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error al imprimir.');
    } finally {
      setBusy(false);
    }
  };

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="bt-print-panel">
        <h4 className="bt-print-panel__title">Impresora térmica</h4>
        <p className="bt-print-panel__hint">
          Disponible en la app instalada: Android (Bluetooth clásico) o iPhone (impresora ESC/POS con Bluetooth Low Energy).
        </p>
      </div>
    );
  }

  if (!isThermalPrinterSupported()) {
    return (
      <div className="bt-print-panel">
        <h4 className="bt-print-panel__title">Impresora térmica</h4>
        <p className="bt-print-panel__hint">Impresión térmica no disponible en esta plataforma.</p>
      </div>
    );
  }

  const isIos = Capacitor.getPlatform() === 'ios';

  return (
    <div className="bt-print-panel">
      <h4 className="bt-print-panel__title">Impresora térmica (Bluetooth)</h4>
      <p className="bt-print-panel__intro">
        {isIos
          ? 'En iPhone use una impresora de tickets ESC/POS con Bluetooth Low Energy (BLE). El escaneo puede listar varios dispositivos cercanos: elija su impresora.'
          : 'Vincule una impresora de tickets ESC/POS por Bluetooth (modo clásico).'}{' '}
        Tras cada venta se imprimirá el ticket; si no hay impresora, podrá compartir el texto del ticket.
      </p>

      {saved ? (
        <p className="bt-print-panel__saved">
          Guardada: <strong>{saved.name}</strong>
          <span className="bt-print-panel__status">{connected ? ' · Conectada' : ' · No conectada'}</span>
        </p>
      ) : (
        <p className="bt-print-panel__saved">Ninguna impresora guardada.</p>
      )}

      {msg ? <p className="bt-print-panel__msg">{msg}</p> : null}

      <div className="bt-print-panel__actions">
        <button
          type="button"
          className="bt-print-panel__btn"
          disabled={scanning || busy || !listenersReady}
          onClick={() => void startSearch()}
        >
          {!listenersReady ? 'Preparando Bluetooth…' : scanning ? 'Buscando…' : 'Buscar impresoras'}
        </button>
        {saved ? (
          <>
            <button type="button" className="bt-print-panel__btn bt-print-panel__btn--secondary" disabled={busy} onClick={() => void testPrint()}>
              Prueba de impresión
            </button>
            <button type="button" className="bt-print-panel__btn bt-print-panel__btn--danger" disabled={busy} onClick={() => void disconnect()}>
              Olvidar impresora
            </button>
          </>
        ) : null}
      </div>

      {devices.length > 0 ? (
        <ul className="bt-print-panel__list">
          {devices.map((d) => (
            <li key={d.address}>
              <button type="button" className="bt-print-panel__device" disabled={busy} onClick={() => void connectTo(d)}>
                <span className="bt-print-panel__device-name">{d.name || 'Sin nombre'}</span>
                <span className="bt-print-panel__device-addr">{d.address}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : scanning ? (
        <p className="bt-print-panel__hint">Acérquese a la impresora y active el emparejamiento si hace falta.</p>
      ) : null}
    </div>
  );
}

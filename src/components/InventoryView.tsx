import { useMemo, useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { Product } from '../types/Product';
import { ProductService } from '../services/productService';
import { startNativeSpeechSession, type NativeSpeechSession } from '../lib/nativeSpeechSession';
import './InventoryView.scss';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ length: number; 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const SearchMicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);

const StopSquareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);

type Props = {
  products: Product[];
  catalogoListo: boolean;
};

function variantStockLine(p: Product) {
  if (!p.variants?.length) return [{ key: 'u', label: 'Sin variantes', stock: 0 }];
  return p.variants.map((v, i) => ({
    key: `${p.id}-${i}-${v.size}`,
    label: `${v.color} · ${v.size}`,
    stock: Number(v.stock) || 0,
  }));
}

export function InventoryView({ products, catalogoListo }: Props) {
  const [q, setQ] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const browserRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcripcionRef = useRef('');
  const browserProcesarRef = useRef(false);

  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        void CapacitorSpeechRecognition.stop().catch(() => {});
      }
      try {
        browserRecRef.current?.stop();
      } catch {
        /* */
      }
    };
  }, []);

  const iniciarBusquedaVoz = async () => {
    if (!catalogoListo || escuchando) return;
    setAviso(null);

    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) {
          setAviso('Voz no disponible en este dispositivo.');
          return;
        }
        await CapacitorSpeechRecognition.requestPermissions();
        if (nativeSessionRef.current) {
          try {
            await nativeSessionRef.current.finish();
          } catch {
            /* */
          }
          nativeSessionRef.current = null;
        }
        nativeSessionRef.current = await startNativeSpeechSession('es-MX');
        setEscuchando(true);
      } catch (e) {
        console.error(e);
        nativeSessionRef.current = null;
        setEscuchando(false);
        setAviso('No se pudo iniciar el micrófono.');
      }
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setAviso('Use Chrome para búsqueda por voz.');
      return;
    }
    transcripcionRef.current = '';
    browserProcesarRef.current = false;
    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setEscuchando(true);
    recognition.onresult = (event) => {
      let line = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        line += r[0]?.transcript ?? '';
      }
      transcripcionRef.current = line.trim();
    };
    recognition.onerror = () => {
      setEscuchando(false);
      browserRecRef.current = null;
      browserProcesarRef.current = false;
      setAviso('Error al capturar audio.');
    };
    recognition.onend = () => {
      setEscuchando(false);
      browserRecRef.current = null;
      const debe = browserProcesarRef.current;
      browserProcesarRef.current = false;
      if (debe) {
        const text = transcripcionRef.current.trim();
        if (text) setQ(text);
        else setAviso('No se detectó audio.');
      }
    };
    browserRecRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      browserRecRef.current = null;
      setEscuchando(false);
      setAviso('No se pudo iniciar el micrófono.');
    }
  };

  const detenerBusquedaVoz = async () => {
    if (!escuchando) return;

    if (Capacitor.isNativePlatform()) {
      const session = nativeSessionRef.current;
      nativeSessionRef.current = null;
      setEscuchando(false);
      if (!session) return;
      try {
        const text = await session.finish();
        if (text) setQ(text);
        else setAviso('No se detectó audio.');
      } catch (e) {
        console.error(e);
        setAviso('Error al capturar audio.');
      }
      return;
    }

    const r = browserRecRef.current;
    if (r) {
      browserProcesarRef.current = true;
      try {
        r.stop();
      } catch (e) {
        console.error(e);
        setEscuchando(false);
        browserRecRef.current = null;
        browserProcesarRef.current = false;
        setAviso('Error al capturar audio.');
      }
    } else {
      setEscuchando(false);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = term ? ProductService.filterProducts(products, term) : products;
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [products, q]);

  const availableCount = useMemo(
    () => filtered.filter((p) => ProductService.getTotalStock(p) > 0).length,
    [filtered]
  );

  return (
    <div className="inventory-view">
      {!catalogoListo ? (
        <p className="inventory-hint">Cargando inventario…</p>
      ) : (
        <>
          <div className="inventory-toolbar">
            <div className="inventory-search-row">
              <input
                type="search"
                className="inventory-search"
                placeholder="Buscar producto…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                enterKeyHint="search"
              />
              <div className="inventory-voice-actions">
                <button
                  type="button"
                  className={`inventory-mic-btn ${escuchando ? 'listening' : ''}`}
                  onClick={() => void iniciarBusquedaVoz()}
                  disabled={escuchando}
                  aria-label="Buscar por voz"
                >
                  <SearchMicIcon />
                </button>
                {escuchando ? (
                  <button
                    type="button"
                    className="inventory-stop-btn"
                    onClick={() => void detenerBusquedaVoz()}
                    aria-label="Detener y buscar"
                  >
                    <StopSquareIcon />
                  </button>
                ) : null}
              </div>
            </div>
            {escuchando ? (
              <p className="inventory-voice-hint">Hable y pulse el cuadrado rojo para buscar.</p>
            ) : null}
            {aviso ? <p className="inventory-voice-error">{aviso}</p> : null}
            <p className="inventory-meta">
              {filtered.length} artículo{filtered.length === 1 ? '' : 's'} ·{' '}
              <strong>{availableCount}</strong> con stock
            </p>
          </div>
          <ul className="inventory-list">
            {filtered.map((p) => {
              const total = ProductService.getTotalStock(p);
              const lines = variantStockLine(p);
              return (
                <li key={p.id} className="inventory-item">
                  <div className="inventory-item-head">
                    <span className="inventory-name">{p.name}</span>
                    <span className={`inventory-stock-badge ${total > 0 ? 'ok' : 'empty'}`}>
                      {total > 0 ? `${total} u.` : 'Sin stock'}
                    </span>
                  </div>
                  <div className="inventory-category">{p.category}</div>
                  <ul className="inventory-variants">
                    {lines.map((line) => (
                      <li key={line.key} className={line.stock > 0 ? 'has-stock' : ''}>
                        <span>{line.label}</span>
                        <span className="inventory-variant-stock">{line.stock}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
          {filtered.length === 0 && <p className="inventory-hint">Nada coincide con la búsqueda.</p>}
        </>
      )}
    </div>
  );
}

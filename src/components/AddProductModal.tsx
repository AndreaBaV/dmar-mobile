import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { Product, Variant } from '../types/Product';
import { ProductService } from '../services/productService';
import { startNativeSpeechSession, type NativeSpeechSession } from '../lib/nativeSpeechSession';
import {
  productImageUrl,
  productToCartLineFromVariant,
  productToDefaultCartLine,
  variantsInStock,
  type CartLine,
} from '../utils/cartUtils';
import './AddProductModal.scss';

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

type Props = {
  open: boolean;
  products: Product[];
  catalogoListo: boolean;
  onClose: () => void;
  onAddLine: (line: CartLine) => void;
};

const SearchMicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);

const StopSquareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export function AddProductModal({ open, products, catalogoListo, onClose, onAddLine }: Props) {
  const [query, setQuery] = useState('');
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);
  const [escuchando, setEscuchando] = useState(false);
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);

  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const browserRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcripcionRef = useRef('');
  const browserProcesarRef = useRef(false);

  const detenerVozSinAplicar = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      void CapacitorSpeechRecognition.stop().catch(() => {});
      nativeSessionRef.current = null;
    }
    try {
      browserRecRef.current?.stop();
    } catch {
      /* */
    }
    browserRecRef.current = null;
    browserProcesarRef.current = false;
    transcripcionRef.current = '';
    setEscuchando(false);
  }, []);

  useEffect(() => {
    return () => {
      detenerVozSinAplicar();
    };
  }, [detenerVozSinAplicar]);

  useEffect(() => {
    if (!open) {
      setAvisoVoz(null);
      detenerVozSinAplicar();
    }
  }, [open, detenerVozSinAplicar]);

  const iniciarFiltroVoz = async () => {
    if (!catalogoListo || !open || escuchando || pickerProduct) return;
    setAvisoVoz(null);

    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) {
          setAvisoVoz('Voz no disponible en este dispositivo.');
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
        setAvisoVoz('No se pudo iniciar el micrófono.');
      }
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setAvisoVoz('Use Chrome para filtrar por voz.');
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
      setAvisoVoz('Error al capturar audio.');
    };
    recognition.onend = () => {
      setEscuchando(false);
      browserRecRef.current = null;
      const debe = browserProcesarRef.current;
      browserProcesarRef.current = false;
      if (debe) {
        const text = transcripcionRef.current.trim();
        if (text) setQuery(text);
        else setAvisoVoz('No se detectó audio.');
      }
    };
    browserRecRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      browserRecRef.current = null;
      setEscuchando(false);
      setAvisoVoz('No se pudo iniciar el micrófono.');
    }
  };

  const detenerFiltroVoz = async () => {
    if (!escuchando) return;

    if (Capacitor.isNativePlatform()) {
      const session = nativeSessionRef.current;
      nativeSessionRef.current = null;
      setEscuchando(false);
      if (!session) return;
      try {
        const text = await session.finish();
        if (text) setQuery(text);
        else setAvisoVoz('No se detectó audio.');
      } catch (e) {
        console.error(e);
        setAvisoVoz('Error al capturar audio.');
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
        setAvisoVoz('Error al capturar audio.');
      }
    } else {
      setEscuchando(false);
    }
  };

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    const withStock = products.filter((p) => ProductService.getTotalStock(p) > 0);
    const base = term ? ProductService.filterProducts(withStock, term) : withStock;
    return [...base].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
  }, [products, query]);

  if (!open) return null;

  const addProduct = (p: Product) => {
    const vs = variantsInStock(p);
    if (vs.length > 1) {
      setPickerProduct(p);
      return;
    }
    const line = productToDefaultCartLine(p, 1);
    if (line) {
      onAddLine(line);
      setQuery('');
      setPickerProduct(null);
      onClose();
    }
  };

  const addVariant = (p: Product, v: Variant) => {
    const line = productToCartLineFromVariant(p, v, 1);
    if (line) {
      onAddLine(line);
      setQuery('');
      setPickerProduct(null);
      onClose();
    }
  };

  const closeAll = () => {
    setPickerProduct(null);
    setQuery('');
    onClose();
  };

  return (
    <div className="add-product-backdrop" role="dialog" aria-modal="true" aria-labelledby="add-product-title">
      <div className="add-product-card glass-card">
        {pickerProduct ? (
          <>
            <div className="add-product-header">
              <button type="button" className="add-product-back" onClick={() => setPickerProduct(null)} aria-label="Volver">
                <BackIcon />
              </button>
              <h2 id="add-product-title" className="add-product-title">
                Elegir variante
              </h2>
            </div>
            <p className="add-product-sub">{pickerProduct.name}</p>
            <div className="add-product-detail-img-wrap">
              {productImageUrl(pickerProduct) ? (
                <img
                  src={productImageUrl(pickerProduct)}
                  alt=""
                  className="add-product-detail-img"
                />
              ) : (
                <div className="add-product-placeholder-lg" aria-hidden />
              )}
            </div>
            <ul className="add-product-variant-list">
              {variantsInStock(pickerProduct).map((v, i) => (
                <li key={`${v.color}-${v.size}-${i}`}>
                  <button
                    type="button"
                    className="add-product-variant-btn"
                    onClick={() => addVariant(pickerProduct, v)}
                  >
                    <span
                      className="add-product-swatch"
                      style={{ background: v.colorCode || '#94a3b8' }}
                      title={v.color}
                    />
                    <span className="add-product-variant-text">
                      {v.color} · {v.size}
                    </span>
                    <span className="add-product-variant-stock">{Number(v.stock) || 0} u.</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h2 id="add-product-title" className="add-product-title">
              Agregar al ticket
            </h2>
            <p className="add-product-sub">Toque la foto del producto correcto, o filtre por nombre (teclado o voz).</p>
            <div className="add-product-search-row">
              <input
                type="search"
                className="add-product-search"
                placeholder="Filtrar por nombre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
              <div className="add-product-voice-actions">
                <button
                  type="button"
                  className={`add-product-mic-btn ${escuchando ? 'listening' : ''}`}
                  onClick={() => void iniciarFiltroVoz()}
                  disabled={escuchando || !catalogoListo}
                  aria-label="Filtrar por voz"
                >
                  <SearchMicIcon />
                </button>
                {escuchando ? (
                  <button
                    type="button"
                    className="add-product-stop-btn"
                    onClick={() => void detenerFiltroVoz()}
                    aria-label="Detener y filtrar"
                  >
                    <StopSquareIcon />
                  </button>
                ) : null}
              </div>
            </div>
            {escuchando ? (
              <p className="add-product-voice-hint">Escuchando… Toque el cuadrado rojo al terminar.</p>
            ) : null}
            {avisoVoz ? <p className="add-product-voice-error">{avisoVoz}</p> : null}
            <ul className="add-product-grid">
              {list.map((p) => {
                const img = productImageUrl(p);
                const stock = ProductService.getTotalStock(p);
                return (
                  <li key={p.id}>
                    <button type="button" className="add-product-tile" onClick={() => addProduct(p)} disabled={stock <= 0}>
                      <div className="add-product-tile-img-wrap">
                        {img ? (
                          <img src={img} alt="" className="add-product-tile-img" />
                        ) : (
                          <div className="add-product-placeholder" aria-hidden />
                        )}
                        {stock <= 0 ? <span className="add-product-soldout">Sin stock</span> : null}
                      </div>
                      <span className="add-product-tile-name">{p.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {list.length === 0 ? <p className="add-product-empty">No hay productos con stock que coincidan.</p> : null}
          </>
        )}
        <button type="button" className="add-product-close" onClick={closeAll}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

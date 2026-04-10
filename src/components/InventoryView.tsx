import { useMemo, useState, useCallback } from 'react';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capgo/capacitor-speech-recognition';
import type { Product } from '../types/Product';
import { ProductService } from '../services/productService';
import './InventoryView.scss';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  start: () => void;
  onstart: (() => void) | null;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const SearchMicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
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

  const buscarPorVoz = useCallback(async () => {
    const esMovil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (esMovil) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) return;
        await CapacitorSpeechRecognition.requestPermissions();
        setEscuchando(true);
        const result = await CapacitorSpeechRecognition.start({
          language: 'es-MX',
          partialResults: false,
          popup: false,
        });
        setEscuchando(false);
        if (result?.matches?.[0]) setQ(result.matches[0]);
      } catch {
        setEscuchando(false);
      }
    } else {
      const w = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) return;
      const recognition = new SR();
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.onstart = () => setEscuchando(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) setQ(transcript);
      };
      recognition.onerror = () => setEscuchando(false);
      recognition.onend = () => setEscuchando(false);
      recognition.start();
    }
  }, []);

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
              <button
                type="button"
                className={`inventory-mic-btn ${escuchando ? 'listening' : ''}`}
                onClick={() => void buscarPorVoz()}
                aria-label="Buscar por voz"
              >
                <SearchMicIcon />
              </button>
            </div>
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

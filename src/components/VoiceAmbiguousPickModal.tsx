import { useState, useEffect } from 'react';
import type { Product, Variant } from '../types/Product';
import {
  productImageUrl,
  productToCartLineFromVariant,
  productToDefaultCartLine,
  variantsInStock,
  type CartLine,
} from '../utils/cartUtils';
import './VoiceAmbiguousPickModal.scss';

type Props = {
  open: boolean;
  candidates: Product[];
  quantity: number;
  onPick: (line: CartLine) => void;
  onCancel: () => void;
};

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export function VoiceAmbiguousPickModal({ open, candidates, quantity, onPick, onCancel }: Props) {
  const [stepProduct, setStepProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (open) setStepProduct(null);
  }, [open, candidates]);

  if (!open || candidates.length === 0) return null;

  const close = () => {
    setStepProduct(null);
    onCancel();
  };

  const onProductTap = (p: Product) => {
    const vs = variantsInStock(p);
    if (vs.length <= 1) {
      const line = productToDefaultCartLine(p, quantity);
      if (line) onPick(line);
      setStepProduct(null);
      return;
    }
    setStepProduct(p);
  };

  const onVariantTap = (p: Product, v: Variant) => {
    const line = productToCartLineFromVariant(p, v, quantity);
    if (line) onPick(line);
    setStepProduct(null);
  };

  if (stepProduct) {
    const img = productImageUrl(stepProduct);
    return (
      <div className="voice-amb-backdrop" role="dialog" aria-modal="true" aria-labelledby="voice-amb-v-title">
        <div className="voice-amb-card glass-card">
          <div className="voice-amb-header">
            <button type="button" className="voice-amb-back" onClick={() => setStepProduct(null)} aria-label="Volver">
              <BackIcon />
            </button>
            <h2 id="voice-amb-v-title" className="voice-amb-title">
              Color y talla
            </h2>
          </div>
          <p className="voice-amb-sub">{stepProduct.name}</p>
          <div className="voice-amb-hero">
            {img ? <img src={img} alt="" className="voice-amb-hero-img" /> : <div className="voice-amb-placeholder" aria-hidden />}
          </div>
          <ul className="voice-amb-variant-list">
            {variantsInStock(stepProduct).map((v, i) => (
              <li key={`${v.color}-${v.size}-${i}`}>
                <button type="button" className="voice-amb-variant-btn" onClick={() => onVariantTap(stepProduct, v)}>
                  <span
                    className="voice-amb-swatch"
                    style={{ background: v.colorCode || '#94a3b8' }}
                  />
                  <span className="voice-amb-variant-label">
                    {v.color} · {v.size}
                  </span>
                  <span className="voice-amb-stock">{Number(v.stock) || 0} u.</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="voice-amb-cancel" onClick={close}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-amb-backdrop" role="dialog" aria-modal="true" aria-labelledby="voice-amb-title">
      <div className="voice-amb-card glass-card">
        <h2 id="voice-amb-title" className="voice-amb-title">
          Elija el producto
        </h2>
        <p className="voice-amb-sub">Varias coincidencias. Toque la foto del artículo correcto.</p>
        <ul className="voice-amb-grid">
          {candidates.map((p) => {
            const img = productImageUrl(p);
            return (
              <li key={p.id}>
                <button type="button" className="voice-amb-tile" onClick={() => onProductTap(p)}>
                  <div className="voice-amb-tile-img-wrap">
                    {img ? <img src={img} alt="" className="voice-amb-tile-img" /> : <div className="voice-amb-placeholder" aria-hidden />}
                  </div>
                  <span className="voice-amb-tile-name">{p.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className="voice-amb-cancel" onClick={close}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

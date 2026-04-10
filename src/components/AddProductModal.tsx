import { useMemo, useState } from 'react';
import type { Product, Variant } from '../types/Product';
import { ProductService } from '../services/productService';
import {
  productImageUrl,
  productToCartLineFromVariant,
  productToDefaultCartLine,
  variantsInStock,
  type CartLine,
} from '../utils/cartUtils';
import './AddProductModal.scss';

type Props = {
  open: boolean;
  products: Product[];
  onClose: () => void;
  onAddLine: (line: CartLine) => void;
};

const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

export function AddProductModal({ open, products, onClose, onAddLine }: Props) {
  const [query, setQuery] = useState('');
  const [pickerProduct, setPickerProduct] = useState<Product | null>(null);

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
            <p className="add-product-sub">Toque la foto del producto correcto</p>
            <input
              type="search"
              className="add-product-search"
              placeholder="Filtrar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              enterKeyHint="search"
            />
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

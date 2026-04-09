import { useMemo, useState } from 'react';
import type { Product } from '../types/Product';
import { ProductService } from '../services/productService';
import './InventoryView.scss';

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
            <input
              type="search"
              className="inventory-search"
              placeholder="Buscar producto, categoría, color, talla…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              enterKeyHint="search"
            />
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

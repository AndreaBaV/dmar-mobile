import type { Product, Variant } from '../types/Product';
import { getVariantPrice } from './productPriceUtils';
import { ProductService } from '../services/productService';

export type CartLine = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Variant;
  imageUrl?: string;
};

export function productImageUrl(p: Product): string | undefined {
  const u = p.mainImage ?? p.images?.[0];
  return u && String(u).trim() ? String(u).trim() : undefined;
}

/** Existencias actuales en catálogo para esa variante o el producto completo. */
export function stockAvailableFor(product: Product, variant?: Variant): number {
  if (variant) {
    const match = product.variants?.find(
      (v) => v.color === variant.color && v.size === variant.size
    );
    return match ? Math.max(0, Number(match.stock) || 0) : 0;
  }
  if (!product.variants?.length) {
    return Number.POSITIVE_INFINITY;
  }
  return ProductService.getTotalStock(product);
}

export function cartLineKey(it: CartLine): string {
  return `${it.productId}|${it.variant?.color ?? ''}|${it.variant?.size ?? ''}`;
}

export function mergeCartLines(prev: CartLine[], toAdd: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const it of prev) {
    map.set(cartLineKey(it), { ...it });
  }
  for (const it of toAdd) {
    const k = cartLineKey(it);
    const ex = map.get(k);
    if (ex) {
      map.set(k, { ...ex, quantity: ex.quantity + it.quantity });
    } else {
      map.set(k, { ...it });
    }
  }
  return Array.from(map.values());
}

/**
 * Fusiona carritos y ajusta cantidades a existencias reales; omite líneas sin stock.
 */
export function mergeCartLinesRespectingStock(
  prev: CartLine[],
  toAdd: CartLine[],
  getProduct: (productId: string) => Product | undefined
): { lines: CartLine[]; adjustments: string[] } {
  const raw = mergeCartLines(prev, toAdd);
  const adjustments: string[] = [];
  const out: CartLine[] = [];

  for (const line of raw) {
    const p = getProduct(line.productId);
    if (!p) {
      out.push(line);
      continue;
    }
    const max = stockAvailableFor(p, line.variant);
    if (max <= 0) {
      adjustments.push(`${line.name}: sin existencias, no se agregó.`);
      continue;
    }
    if (line.quantity > max) {
      adjustments.push(`${line.name}: solo hay ${max} unidades disponibles.`);
      out.push({ ...line, quantity: max });
    } else {
      out.push(line);
    }
  }

  return { lines: out, adjustments };
}

export function productToCartLineFromVariant(p: Product, v: Variant, qty = 1): CartLine | null {
  const stock = Math.max(0, Number(v.stock) || 0);
  if (stock < qty || stock <= 0) return null;
  const vp = getVariantPrice(v);
  const price = (vp !== null && vp > 0 ? vp : p.price) || 0;
  if (price <= 0) return null;
  return {
    productId: p.id,
    name: p.name,
    price,
    quantity: qty,
    variant: v,
    imageUrl: productImageUrl(p),
  };
}

/** Solo variantes con stock; no usa variantes en cero. */
export function productToDefaultCartLine(p: Product, qty = 1): CartLine | null {
  const imageUrl = productImageUrl(p);
  if (!p.variants?.length) {
    if (p.price <= 0) return null;
    return { productId: p.id, name: p.name, price: p.price, quantity: qty, imageUrl };
  }
  const withStock = p.variants.filter((v) => (Number(v.stock) || 0) > 0);
  if (withStock.length === 0) return null;
  const v = withStock[0];
  const st = Number(v.stock) || 0;
  const q = Math.min(qty, st);
  return productToCartLineFromVariant(p, v, q);
}

/** Solo variantes con existencias > 0 (para modales de elección). */
export function variantsInStock(p: Product): Variant[] {
  if (!p.variants?.length) return [];
  return p.variants.filter((v) => (Number(v.stock) || 0) > 0);
}

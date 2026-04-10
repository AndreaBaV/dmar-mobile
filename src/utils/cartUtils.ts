import type { Product, Variant } from '../types/Product';
import { getVariantPrice } from './productPriceUtils';

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

export function productToCartLineFromVariant(p: Product, v: Variant, qty = 1): CartLine | null {
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

/** Primera variante con stock, o la primera del producto. */
export function productToDefaultCartLine(p: Product, qty = 1): CartLine | null {
  const imageUrl = productImageUrl(p);
  if (!p.variants?.length) {
    if (p.price <= 0) return null;
    return { productId: p.id, name: p.name, price: p.price, quantity: qty, imageUrl };
  }
  const withStock = p.variants.filter((v) => (Number(v.stock) || 0) > 0);
  const list = withStock.length ? withStock : p.variants;
  const v = list[0];
  return productToCartLineFromVariant(p, v, qty);
}

export function variantsInStock(p: Product): Variant[] {
  if (!p.variants?.length) return [];
  const withStock = p.variants.filter((v) => (Number(v.stock) || 0) > 0);
  return withStock.length ? withStock : p.variants;
}

import { ProductService } from './productService';
import type { Product, Variant } from '../types/Product';
import { stockAvailableFor } from '../utils/cartUtils';
import { getVariantPrice } from '../utils/productPriceUtils';

const normalize = (text: string) => {
  if (!text) return '';
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
};

const SIZE_MAP: Record<string, string[]> = {
  xs: ['extra chica', 'xs', 'xsmall', 'extra small'],
  s: ['chica', 's', 'small', 'ch', 'pequeña'],
  m: ['mediana', 'm', 'medium', 'med'],
  l: ['grande', 'l', 'large', 'g'],
  xl: ['extra grande', 'xl', 'extra large', 'xg'],
  xxl: ['doble extra grande', 'xxl', '2xl'],
};

export type VoiceItemResolution =
  | { status: 'not_found' }
  | { status: 'variant_not_found'; product: Product }
  | { status: 'ok'; product: Product; variant?: Variant; price: number }
  | { status: 'ambiguous'; candidates: Product[] };

export type IaOrderItem = { producto: string; color?: string; talla?: string; cantidad?: number };

function normalizeSearchSize(talla: string | undefined): string | null {
  if (!talla) return null;
  let searchSize = normalize(talla);
  for (const [code, synonyms] of Object.entries(SIZE_MAP)) {
    if (synonyms.includes(searchSize)) {
      return code;
    }
  }
  return searchSize;
}

/**
 * Busca variante por color/talla (misma lógica histórica del POS).
 */
function pickVariantInProduct(
  product: Product,
  searchColor: string | null,
  searchSize: string | null
): { variant: Variant | undefined; price: number; searchedButMissing: boolean } {
  let selectedVariant: Variant | undefined;
  let foundPrice = product.price;

  if (!product.variants?.length) {
    return { variant: undefined, price: Number(foundPrice) || 0, searchedButMissing: false };
  }

  for (const variant of product.variants) {
    const vColor = normalize(variant.color || '');
    const colorMatch = searchColor ? vColor.includes(searchColor) : true;
    if (!colorMatch) continue;

    const vAny = variant as unknown as { sizes?: Array<{ size?: string; salePrice?: number; price?: number }> };
    if (Array.isArray(vAny.sizes)) {
      const sizeFound = searchSize
        ? vAny.sizes.find((s) => normalize(String(s.size || '')) === searchSize)
        : undefined;
      if (sizeFound) {
        selectedVariant = { ...variant, ...sizeFound } as Variant;
        foundPrice = sizeFound.salePrice || sizeFound.price || variant.salePrice || product.price;
        break;
      }
    } else if (searchSize && normalize(variant.size || '') === searchSize) {
      selectedVariant = variant;
      foundPrice = variant.salePrice || product.price;
      break;
    }
  }

  const searchedButMissing = Boolean(searchColor || searchSize) && !selectedVariant;
  return {
    variant: selectedVariant,
    price: Number(foundPrice) || 0,
    searchedButMissing,
  };
}

export class InventoryMatcher {
  private static productsCache: Product[] = [];
  private static lastFetch: number = 0;

  static async loadCatalog() {
    const t0 = performance.now();
    const log = (msg: string, extra?: unknown) =>
      console.log(`[DMAR:init] InventoryMatcher.loadCatalog +${(performance.now() - t0).toFixed(0)}ms`, msg, extra ?? '');

    const now = Date.now();
    if (this.productsCache.length > 0 && now - this.lastFetch < 300000) {
      log('usando caché en memoria', { productos: this.productsCache.length, ageMs: now - this.lastFetch });
      return this.productsCache;
    }

    log('descarga nueva: antes ProductService.loadAllProducts(true)');
    this.productsCache = await ProductService.loadAllProducts(true);
    this.lastFetch = now;
    log('descarga nueva: después ProductService.loadAllProducts', { count: this.productsCache.length });
    return this.productsCache;
  }

  static getCatalogSnapshot(): Product[] {
    return [...this.productsCache];
  }

  /**
   * Resuelve un ítem de voz: único producto, ambigüedad (varios nombres), o error de variante.
   */
  static resolveVoiceItem(iaItem: IaOrderItem): VoiceItemResolution {
    const searchTerms = normalize(iaItem.producto).split(/\s+/).filter(Boolean);
    const searchColor = iaItem.color ? normalize(iaItem.color) : null;
    const searchSize = normalizeSearchSize(iaItem.talla);

    const matches = this.productsCache.filter((p) => {
      const pName = normalize(p.name);
      return searchTerms.every((term) => pName.includes(term));
    });

    if (matches.length === 0) {
      return { status: 'not_found' };
    }

    if (matches.length === 1) {
      const product = matches[0];
      const { variant, price, searchedButMissing } = pickVariantInProduct(product, searchColor, searchSize);
      if (searchedButMissing) {
        return { status: 'variant_not_found', product };
      }
      if (variant) {
        if (stockAvailableFor(product, variant) <= 0) {
          return { status: 'variant_not_found', product };
        }
      } else if (product.variants?.length) {
        if (ProductService.getTotalStock(product) <= 0) {
          return { status: 'variant_not_found', product };
        }
      }
      return { status: 'ok', product, variant, price };
    }

    // Varios productos: si dijo color/talla, intentar dejar uno solo; si no, elegir entre todos
    if (searchColor || searchSize) {
      const fits: Product[] = [];
      for (const p of matches) {
        const r = pickVariantInProduct(p, searchColor, searchSize);
        if (r.searchedButMissing) continue;
        if (r.variant) {
          if (stockAvailableFor(p, r.variant) > 0) fits.push(p);
        } else if (!p.variants?.length || ProductService.getTotalStock(p) > 0) {
          fits.push(p);
        }
      }
      if (fits.length === 1) {
        const product = fits[0];
        const { variant, price } = pickVariantInProduct(product, searchColor, searchSize);
        return { status: 'ok', product, variant, price };
      }
      if (fits.length === 0) {
        return { status: 'variant_not_found', product: matches[0] };
      }
      return { status: 'ambiguous', candidates: fits };
    }

    const inStock = matches.filter((p) => {
      if (!p.variants?.length) return p.price > 0;
      return ProductService.getTotalStock(p) > 0;
    });
    if (inStock.length === 0) {
      return { status: 'not_found' };
    }
    if (inStock.length === 1) {
      const product = inStock[0];
      if (!product.variants?.length) {
        return { status: 'ok', product, variant: undefined, price: Number(product.price) || 0 };
      }
      const v = product.variants.find((x) => (Number(x.stock) || 0) > 0);
      if (!v) {
        return { status: 'not_found' };
      }
      const vp = getVariantPrice(v);
      const price = (vp !== null && vp > 0 ? vp : product.price) || 0;
      return { status: 'ok', product, variant: v, price };
    }
    return { status: 'ambiguous', candidates: inStock };
  }

  /** @deprecated Usar resolveVoiceItem; se mantiene por compatibilidad. */
  static findProduct(iaItem: IaOrderItem): unknown {
    const r = this.resolveVoiceItem(iaItem);
    if (r.status === 'not_found') return null;
    if (r.status === 'variant_not_found') return { error: 'variant_not_found', product: r.product };
    if (r.status === 'ambiguous') return null;
    return {
      product: r.product,
      variant: r.variant,
      price: r.price,
      name: r.product.name,
    };
  }
}

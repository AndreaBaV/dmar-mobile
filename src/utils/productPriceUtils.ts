/**
 * Utilidades para calcular precios de productos desde variantes
 */

import type { Product, Variant } from '../types/Product';
import { calculateSalePrice } from './purchaseUtils';

/**
 * Calcula el precio de venta de una variante
 */
export function getVariantPrice(variant: Variant): number | null {
  if (variant.purchasePrice !== undefined && 
      variant.purchasePrice !== null && 
      variant.purchasePrice > 0 &&
      variant.profitMargin !== undefined && 
      variant.profitMargin !== null && 
      variant.profitMargin >= 0) {
    return calculateSalePrice(variant.purchasePrice, variant.profitMargin);
  }
  
  // Si tiene salePrice calculado, usarlo
  if (variant.salePrice !== undefined && variant.salePrice !== null && variant.salePrice > 0) {
    return variant.salePrice;
  }
  
  return null;
}

/**
 * Obtiene todos los precios únicos de un producto
 */
export function getProductPrices(product: Product): number[] {
  const prices = new Set<number>();
  
  product.variants.forEach(variant => {
    const price = getVariantPrice(variant);
    if (price !== null && price > 0) {
      prices.add(price);
    }
  });
  
  return Array.from(prices).sort((a, b) => a - b);
}

/**
 * Obtiene el precio más bajo de un producto
 */
export function getMinPrice(product: Product): number | null {
  const prices = getProductPrices(product);
  return prices.length > 0 ? prices[0] : null;
}

/**
 * Obtiene el precio más alto de un producto
 */
export function getMaxPrice(product: Product): number | null {
  const prices = getProductPrices(product);
  return prices.length > 0 ? prices[prices.length - 1] : null;
}

/**
 * Verifica si un producto tiene variaciones de precio
 */
export function hasPriceVariation(product: Product): boolean {
  const prices = getProductPrices(product);
  return prices.length > 1;
}

/**
 * Obtiene el precio a mostrar para un producto
 * Retorna el precio más bajo si hay variaciones, o el precio único si no las hay
 */
export function getDisplayPrice(product: Product): number | null {
  return getMinPrice(product);
}

/**
 * Obtiene el texto a mostrar cuando hay variaciones de precio
 */
export function getPriceVariationText(product: Product): string {
  if (!hasPriceVariation(product)) {
    return '';
  }
  
  const minPrice = getMinPrice(product);
  const maxPrice = getMaxPrice(product);
  
  if (minPrice !== null && maxPrice !== null) {
    return `Diferentes precios por color o talla`;
  }
  
  return '';
}


/**
 * Utilidades para cálculos y validaciones de compras
 */

/**
 * Convierte un color hex a RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}
import type { PurchaseItemForm } from '../types/Purchase';

/**
 * Calcula la distancia entre dos colores en RGB
 */
export function getColorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return Infinity;
  
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// Tipo para variantes de compra (definido localmente para evitar problemas de importación circular)
interface PurchaseSizeData {
  size: string;
  quantity: number;
  sku: string;
  barcode: string;
  purchasePrice: number;
  profitMargin: number;
  salePrice: number;
}

interface PurchaseVariantData {
  color: string;
  colorCode: string;
  sizes: PurchaseSizeData[];
}

/**
 * Calcula el total de una compra basado en los items (sistema antiguo)
 */
export function calculatePurchaseTotal(items: PurchaseItemForm[]): number {
  return items.reduce((sum, item) => {
    const selectedSizesArray = Array.from(item.selectedSizes?.values() || []).filter(s => s.selected);
    if (selectedSizesArray.length > 0) {
      return sum + selectedSizesArray.reduce((itemSum, sizeData) => 
        itemSum + (sizeData.purchasePrice * sizeData.quantity), 0
      );
    }
    return sum + (item.purchasePrice * (item.quantity || 0));
  }, 0);
}

/**
 * Calcula el total de una compra considerando las variantes del nuevo sistema
 * Cada variante puede tener su propio precio de compra
 */
export function calculatePurchaseTotalWithVariants(
  items: PurchaseItemForm[],
  itemVariants: Map<string, PurchaseVariantData[]>
): number {
  return items.reduce((sum, item) => {
    // Primero verificar si hay variantes en el nuevo sistema
    const variants = itemVariants.get(item.tempId) || [];
    
    if (variants.length > 0) {
      // Sumar usando el precio individual de cada variante
      const variantTotal = variants.reduce((total, v) => 
        total + v.sizes.reduce((sizeTotal, s) => sizeTotal + (s.purchasePrice * s.quantity), 0), 0
      );
      return sum + variantTotal;
    }
    
    // Fallback al sistema antiguo
    const selectedSizesArray = Array.from(item.selectedSizes?.values() || []).filter(s => s.selected);
    if (selectedSizesArray.length > 0) {
      return sum + selectedSizesArray.reduce((itemSum, sizeData) => 
        itemSum + (sizeData.purchasePrice * sizeData.quantity), 0
      );
    }
    
    return sum + (item.purchasePrice * (item.quantity || 0));
  }, 0);
}

/**
 * Cuenta el total de unidades considerando las variantes del nuevo sistema
 */
export function countTotalUnitsWithVariants(
  items: PurchaseItemForm[],
  itemVariants: Map<string, PurchaseVariantData[]>
): number {
  return items.reduce((sum, item) => {
    // Primero verificar si hay variantes en el nuevo sistema
    const variants = itemVariants.get(item.tempId) || [];
    const variantUnits = variants.reduce((total, v) => 
      total + v.sizes.reduce((sizeTotal, s) => sizeTotal + s.quantity, 0), 0
    );
    
    if (variantUnits > 0) {
      return sum + variantUnits;
    }
    
    // Fallback al sistema antiguo
    const selectedSizesArray = Array.from(item.selectedSizes?.values() || []).filter(s => s.selected);
    if (selectedSizesArray.length > 0) {
      return sum + selectedSizesArray.reduce((itemSum, sizeData) => itemSum + sizeData.quantity, 0);
    }
    
    return sum + (item.quantity || 0);
  }, 0);
}

/**
 * Cuenta el número de variantes (combinaciones color-talla) considerando el nuevo sistema
 */
export function countTotalVariantsWithVariants(
  items: PurchaseItemForm[],
  itemVariants: Map<string, PurchaseVariantData[]>
): number {
  return items.reduce((sum, item) => {
    // Primero verificar si hay variantes en el nuevo sistema
    const variants = itemVariants.get(item.tempId) || [];
    const variantCount = variants.reduce((total, v) => total + v.sizes.length, 0);
    
    if (variantCount > 0) {
      return sum + variantCount;
    }
    
    // Fallback al sistema antiguo
    const selectedSizesArray = Array.from(item.selectedSizes?.values() || []).filter(s => s.selected);
    if (selectedSizesArray.length > 0) {
      return sum + selectedSizesArray.length;
    }
    
    return sum + (item.color && item.size ? 1 : 0);
  }, 0);
}

/**
 * Valida que un item tenga todos los campos requeridos
 */
export function validatePurchaseItem(item: PurchaseItemForm): string | null {
  if (!item.name.trim()) {
    return 'Todos los productos deben tener un nombre';
  }
  if (!item.color.trim()) {
    return 'Todos los productos deben tener color';
  }
  
  const selectedSizesArray = Array.from(item.selectedSizes?.values() || []).filter(s => s.selected);
  if (selectedSizesArray.length === 0) {
    return `El producto "${item.name}" debe tener al menos una talla seleccionada`;
  }
  
  for (const sizeData of selectedSizesArray) {
    if (!sizeData.quantity || sizeData.quantity <= 0) {
      return `La cantidad para la talla ${sizeData.size} debe ser mayor a 0`;
    }
    if (sizeData.purchasePrice <= 0) {
      return `El precio de compra para la talla ${sizeData.size} debe ser mayor a 0`;
    }
    if (sizeData.salePrice <= 0) {
      return `El precio de venta para la talla ${sizeData.size} debe ser mayor a 0`;
    }
  }
  
  return null;
}

/**
 * Calcula el precio de venta basado en precio de compra y porcentaje de utilidad
 */
export function calculateSalePrice(purchasePrice: number, profitPercentage: number): number {
  if (purchasePrice > 0 && profitPercentage >= 0) {
    return purchasePrice * (1 + profitPercentage / 100);
  }
  return purchasePrice;
}

/**
 * Calcula el porcentaje de utilidad basado en precio de compra y venta
 */
export function calculateProfitPercentage(purchasePrice: number, salePrice: number): number {
  if (purchasePrice > 0 && salePrice > 0) {
    return Math.max(0, ((salePrice - purchasePrice) / purchasePrice) * 100);
  }
  return 0;
}


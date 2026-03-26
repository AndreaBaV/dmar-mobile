/**
 * Tipos para el sistema de promociones
 */

export type PromotionType = 'discount' | 'combo';

export interface Discount {
  id?: string;
  productId: string;
  percentage?: number; // Porcentaje de descuento (0-100)
  fixedAmount?: number; // Monto fijo de descuento
  type: 'percentage' | 'fixed';
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  visibleInStore: boolean; // Si se muestra en la tienda en línea
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Combo {
  id?: string;
  name: string;
  description?: string;
  products: Array<{
    productId: string;
    quantity: number;
  }>;
  totalPrice: number; // Precio total del combo (con descuento aplicado)
  originalPrice: number; // Precio original sin descuento
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  visibleInStore: boolean; // Si se muestra en la tienda en línea
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductMovement {
  productId: string;
  productName: string;
  lastSaleDate?: Date;
  daysSinceLastSale: number;
  totalSales: number; // Total de unidades vendidas
  totalRevenue: number; // Ingresos totales
  hasPromotion: boolean;
  promotionType?: PromotionType;
  promotionId?: string;
}


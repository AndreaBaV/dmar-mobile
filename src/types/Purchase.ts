/**
 * Tipos para gestión de compras
 * 
 * @author Andrea Bahena
 * @description Define la estructura de datos para las compras de productos
 */

export interface PurchaseItem {
  // Para productos nuevos
  isNewProduct?: boolean;
  productId?: string; // Si es producto existente
  
  // Información del producto
  name: string;
  category: string;
  description?: string;
  imageUrl?: string;
  
  // Variantes
  color: string;
  colorCode?: string;
  size: string;
  quantity: number;
  
  // Precios
  purchasePrice: number; // Precio de compra
  profitPercentage?: number; // Porcentaje de utilidad usado para calcular precio de venta
  salePrice: number; // Precio de venta
  
  // Códigos
  sku?: string;
  barcode?: string;
  
  // IDs internos (para productos nuevos que se crearán)
  tempId?: string;
}

export interface Purchase {
  id: string;
  partnerId: string;
  partnerName: string;
  supplierId?: string;
  supplierName?: string;
  items: PurchaseItem[];
  totalAmount: number;
  purchaseDate: Date | any;
  notes?: string;
  createdAt: Date | any;
  createdBy?: string;
}

export interface PurchaseCreate {
  partnerId: string;
  supplierId?: string;
  items: PurchaseItem[];
  notes?: string;
}

export interface PurchaseItemView {
  productId?: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  color?: string;
  size?: string;
  sku?: string;
}

export interface PurchaseRecord {
  id: string;
  supplierName?: string;
  supplierId?: string;
  items: PurchaseItemView[];
  totalAmount: number;
  purchaseDate: Date;
  notes?: string;
  createdBy?: string;
}

export interface SizeSelection {
  size: string;
  selected: boolean;
  quantity: number;
  purchasePrice: number;
  profitPercentage: number;
  salePrice: number;
}

export interface ColorSelection {
  color: string;
  colorCode: string;
  sizes: Map<string, SizeSelection>;
}

export interface PurchaseItemForm {
  isNewProduct: boolean;
  productId?: string;
  name: string;
  category: string;
  description: string;
  color: string;
  colorCode: string;
  size: string;
  selectedSizes: Map<string, SizeSelection>;
  selectedColors: Map<string, ColorSelection>; // Para múltiples colores con tallas
  quantity: number;
  purchasePrice: number;
  profitPercentage: number;
  salePrice: number;
  sku: string;
  barcode: string;
  tempId: string;
  imageUrl?: string;
}


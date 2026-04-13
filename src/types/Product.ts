export interface Variant {
  color: string;
  colorCode?: string; // Agregar esto
  size: string;
  stock: number;
  sku?: string;
  barcode?: string; // Código de barras físico del producto
  purchasePrice?: number; // Precio de compra
  profitMargin?: number; // Porcentaje de utilidad (ej: 50 = 50%)
  salePrice?: number; // Precio de venta calculado
  /** Firestore: products/{productId}/variants/{variantId}/sizes/{sizeId} */
  variantId?: string;
  sizeId?: string;
}

export interface SkuVariantDocument {
  size: string;
  stock: number;
  productId: string;
  variantId: string; // ID del documento padre en 'variants' (ej. GXgLY...)
  
  // Campos que pueden o no estar presentes en el documento de Firestore
  barcode?: string;
  priceModifier?: string; 
  sku?: string; // El SKU que vamos a generar y guardar aquí
}

export interface BaseVariant {
  color: string;
  colorCode?: string;
  productId: string;
}

export interface SocialPreview {
  enabled: boolean;
  platform: 'Instagram' | 'Facebook' | 'TikTok' | 'Otra';
  url: string;
}

// Estructura REAL que tienes en Firebase
export interface ProductFromFirebase {
  id: string;
  name: string;
  price: number;
  category: string;
  images: string[];
  mainImage?: string; // Nueva URL de imagen principal (opcional, cae de vuelta a images[0])
  socialPreview?: SocialPreview;
  sold: boolean;
  variants?: {
    sizes?: Variant[];  
  };
}

// Este es el que usamos en toda la app (ya limpio)
export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  images: string[];
  mainImage?: string; // URL de la imagen principal
  socialPreview?: SocialPreview;
  sold: boolean;
  variants: Variant[]; 
  description?: string;
  partnerId?: string; // ID del socio comercial propietario del producto
  partnerName?: string; // Nombre del socio (para facilitar consultas)
  supplierId?: string; // ID del proveedor (marca) del producto
  supplierName?: string; // Nombre del proveedor (para facilitar consultas)
  lowStockThreshold?: number; // Umbral personalizado para notificación de stock bajo
}
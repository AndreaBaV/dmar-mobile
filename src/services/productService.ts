// src/services/productService.ts
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Product, Variant } from '../types/Product';
import { getDisplayPrice } from '../utils/productPriceUtils';
import { normalizeColor, getColorCode } from '../utils/normalizeFilters';


// Interfaz interna para mapeo de Firebase
interface FirebaseProduct {
  id: string;
  name: string;
  description?: string;
  category: string;
  imageUrl?: string;
  images?: string[];
  mainImage?: string;
  socialPreview?: any;
  price: number;
  minPrice?: number;
  hasVariants?: boolean;
  stock?: number;
  active?: boolean;
  sold?: boolean;
  createdAt?: any;
  partnerId?: string;
  partnerName?: string;
  supplierId?: string;
  supplierName?: string;
}

export class ProductService {
  private static productsCache: Product[] | null = null;
  private static cacheTimestamp: number = 0;
  private static CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  static async loadAllProducts(forceRefresh = false): Promise<Product[]> {
    try {
      // Si está offline, no forzar refresh - usar cache o datos offline
      const isOnline = navigator.onLine;
      if (!isOnline && forceRefresh) {
        console.log('Sin conexión, usando cache de productos');
        forceRefresh = false;
      }
      
      if (!forceRefresh && this.productsCache && 
          Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
        console.log('Usando productos desde cache');
        return this.productsCache;
      }

      console.log(isOnline ? 'Cargando productos desde Firebase' : 'Cargando productos desde cache offline');
      const startTime = performance.now();

      const productsCollection = collection(db, 'products');
      const snapshot = await getDocs(productsCollection);

      // Cargar todos los productos con sus variantes EN PARALELO
      const productPromises = snapshot.docs.map(async (doc) => {
        const data = { id: doc.id, ...doc.data() } as FirebaseProduct;
        
        // Cargar variantes desde subcolecciones
        const variants = await this.loadVariantsFromSubcollections(doc.id);
        
        // Calcular precio desde variantes (precio más bajo o único)
        const calculatedPrice = getDisplayPrice({
          id: doc.id,
          name: data.name || 'Sin nombre',
          price: 0, // Temporal, se calculará
          category: data.category || 'Sin Categoría',
          images: data.images || (data.imageUrl ? [data.imageUrl] : []),
          mainImage: data.mainImage || data.imageUrl || (data.images && data.images[0]) || '',
          socialPreview: data.socialPreview,
          sold: data.sold || false,
          variants
        }) || data.price || data.minPrice || 0;
        
        return {
          id: doc.id,
          name: data.name || 'Sin nombre',
          price: calculatedPrice,
          category: data.category || 'Sin Categoría',
          images: data.images || (data.imageUrl ? [data.imageUrl] : []),
          mainImage: data.mainImage || data.imageUrl || (data.images && data.images[0]) || '',
          socialPreview: data.socialPreview,
          sold: data.sold || false,
          description: data.description,
          partnerId: data.partnerId,
          partnerName: data.partnerName,
          variants
        } as Product;
      });

      const allProducts = await Promise.all(productPromises);
      
      this.productsCache = allProducts;
      this.cacheTimestamp = Date.now();

      const loadTime = (performance.now() - startTime).toFixed(2);
      console.log(`${allProducts.length} productos cargados en ${loadTime}ms`);
      
      return allProducts;
      
    } catch (error) {
      console.error('Error cargando productos:', error);
      if (this.productsCache) {
        console.log('Usando cache por error de red');
        return this.productsCache;
      }
      throw new Error('No se pudieron cargar los productos');
    }
  }

  // Cargar variantes desde: products/{id}/variants/{variantId}/sizes/{sizeId}
  private static async loadVariantsFromSubcollections(productId: string): Promise<Variant[]> {
    try {
      const variantsCol = collection(db, 'products', productId, 'variants');
      const variantsSnap = await getDocs(variantsCol);

      // Cargar todas las variantes y sus sizes EN PARALELO
      const variantPromises = variantsSnap.docs.map(async (variantDoc) => {
        const variantData = variantDoc.data();
        const colorName = String(variantData.color || variantData.Color || 'Sin color').trim();
        const colorCode = variantData.colorCode || variantData.hex || variantData.color_hex;

        // Cargar sizes de esta variante
        const sizesCol = collection(db, 'products', productId, 'variants', variantDoc.id, 'sizes');
        const sizesSnap = await getDocs(sizesCol);

        return sizesSnap.docs.map((sizeDoc) => {
          const sizeData = sizeDoc.data();
          // Normalizar el color a su color base simplificado (ej: "Verde Mar Claro" → "verde")
          const normalizedColor = colorName && colorName !== 'Sin color' 
            ? normalizeColor(colorName) 
            : 'Sin color';
          
          // Asegurar que tenemos un colorCode
          const finalColorCode = colorCode || getColorCode(normalizedColor);
          
          return {
            color: normalizedColor,
            colorCode: finalColorCode,
            size: String(sizeData.size || sizeData.talla || sizeData.Talla || 'Única').trim(),
            stock: this.parseStock(sizeData.stock || sizeData.cantidad || sizeData.qty),
            sku: sizeData.sku || undefined,
            barcode: sizeData.barcode || undefined, // Cargar código de barras
            purchasePrice: sizeData.purchasePrice !== undefined ? Number(sizeData.purchasePrice) : undefined,
            profitMargin: sizeData.profitMargin !== undefined ? Number(sizeData.profitMargin) : undefined,
            salePrice: sizeData.salePrice !== undefined ? Number(sizeData.salePrice) : undefined,
            // IMPORTANTE: Inyectamos los IDs necesarios para generar el código de barras después
            // Tendrás que asegurarte de que tu tipo 'Variant' acepte estos campos opcionales
            // o castearlos cuando los uses.
            variantId: variantDoc.id, 
            sizeId: sizeDoc.id,
            productId: productId
          } as unknown as Variant; 
        });
      });

      const variantArrays = await Promise.all(variantPromises);
      const allVariants = variantArrays.flat();

      // Si no hay variantes, crear una por defecto
      return allVariants.length > 0 ? allVariants : [{
        color: 'Único',
        size: 'Única',
        stock: 0,
        sku: productId
      } as Variant];

    } catch (error) {
      console.error(`Error cargando variantes de ${productId}:`, error);
      return [{
        color: 'Único',
        size: 'Única',
        stock: 0,
        sku: productId
      } as Variant];
    }
  }

  private static parseStock(stock: any): number {
    if (stock === null || stock === undefined) return 0;
    const stockNum = Number(stock);
    return Number.isNaN(stockNum) ? 0 : Math.max(0, stockNum);
  }

  static clearCache(): void {
    this.productsCache = null;
    this.cacheTimestamp = 0;
    console.log('Cache de productos limpiado');
  }

  static getTotalStock(product: Product): number {
    if (!product.variants || product.variants.length === 0) return 0;
    return product.variants.reduce((sum, variant) => {
      const stockNum = Number(variant.stock);
      return sum + (Number.isNaN(stockNum) ? 0 : stockNum);
    }, 0);
  }

  static getFirstAvailableVariant(product: Product): Variant | null {
    if (!product.variants || product.variants.length === 0) return null;
    
    const availableVariant = product.variants.find(variant => {
      const stockNum = Number(variant.stock);
      return !Number.isNaN(stockNum) && stockNum > 0;
    });
    
    return availableVariant || product.variants[0];
  }

  static filterProducts(products: Product[], searchTerm: string): Product[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products;

    return products.filter((p) => {
      if (p.name?.toLowerCase().includes(term)) return true;
      if (p.id?.toLowerCase().includes(term)) return true;
      if (p.category?.toLowerCase().includes(term)) return true;
      if (p.description?.toLowerCase().includes(term)) return true;

      if (p.variants && p.variants.length > 0) {
        return p.variants.some(variant => 
          variant.color?.toLowerCase().includes(term) ||
          variant.size?.toLowerCase().includes(term) ||
          (variant.sku && variant.sku.toLowerCase().includes(term))
        );
      }
      
      return false;
    });
  }

  /**
   * Genera un SKU único para una variante de producto
   */
  static generateVariantSku(productId: string, variantId: string, size: string): string {
    // 1. Parte del Producto (ID corto: primeros 4 caracteres)
    const productPart = productId ? productId.substring(0, 4).toUpperCase() : 'PROD';
    
    // 2. Parte de la Talla (Limpiar caracteres especiales)
    const sizePart = size ? size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : 'UNI'; 
    
    // 3. Parte de la Variante (ID corto)
    const variantPart = variantId ? variantId.substring(0, 4).toUpperCase() : 'VAR';

    // 4. Cadena Alfanumérica Corta (Para asegurar unicidad)
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

    // SKU Final: WMGS-L-GXLB-A3B4
    return `${productPart}-${sizePart}-${variantPart}-${randomSuffix}`;
  }

  /**
   * Genera un código de barras numérico único de 8 dígitos
   */
  static generateUniqueBarcode(): string {
    // Generar un número de 8 dígitos único basado en timestamp + random
    const timestamp = Date.now().toString().slice(-6); // Últimos 6 dígitos del timestamp
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2 dígitos aleatorios
    return (timestamp + random).padStart(8, '0').slice(0, 8);
  }

  /**
   * Actualiza el campo 'sku' en el documento de la subcolección 'sizes'.
   */
  static async updateVariantSku(
    productId: string, 
    variantId: string, 
    sizeDocId: string, 
    newSku: string
  ): Promise<void> {
    try {
      if (!productId || !variantId || !sizeDocId) {
        throw new Error("Faltan IDs necesarios para actualizar el SKU");
      }

      // Ruta: /products/{productId}/variants/{variantId}/sizes/{sizeDocId}
      const variantSizeRef = doc(
        db, 
        'products', 
        productId, 
        'variants', 
        variantId, 
        'sizes', 
        sizeDocId
      );
      
      // Actualizamos solo el campo 'sku'
      await updateDoc(variantSizeRef, {
        sku: newSku
      });

      console.log(`[FIREBASE] SKU ${newSku} guardado en la ruta: ${variantSizeRef.path}`);
    } catch (error) {
      console.error("Error al actualizar SKU de variante:", error);
      throw error;
    }
  }

  /**
   * Actualiza el campo 'barcode' en el documento de la subcolección 'sizes'.
   */
  static async updateVariantBarcode(
    productId: string, 
    variantId: string, 
    sizeDocId: string, 
    barcode: string
  ): Promise<void> {
    try {
      if (!productId || !variantId || !sizeDocId) {
        throw new Error("Faltan IDs necesarios para actualizar el código de barras");
      }

      // Ruta: /products/{productId}/variants/{variantId}/sizes/{sizeDocId}
      const variantSizeRef = doc(
        db, 
        'products', 
        productId, 
        'variants', 
        variantId, 
        'sizes', 
        sizeDocId
      );
      
      // Actualizamos el campo 'barcode'
      await updateDoc(variantSizeRef, {
        barcode: barcode
      });

      console.log(`[FIREBASE] Código de barras ${barcode} guardado en la ruta: ${variantSizeRef.path}`);
    } catch (error) {
      console.error("Error al actualizar código de barras de variante:", error);
      throw error;
    }
  }

  /**
   * Actualiza tanto el SKU como el código de barras
   */
  /**
   * Elimina un producto y todas sus variantes y tallas
   */
  static async deleteProduct(productId: string): Promise<void> {
    try {
      console.log(`[ProductService] Iniciando eliminación del producto: ${productId}`);
      
      const batch = writeBatch(db);
      
      // 1. Obtener todas las variantes
      const variantsCol = collection(db, 'products', productId, 'variants');
      const variantsSnap = await getDocs(variantsCol);
      
      for (const variantDoc of variantsSnap.docs) {
        // 2. Obtener todas las tallas de cada variante
        const sizesCol = collection(db, 'products', productId, 'variants', variantDoc.id, 'sizes');
        const sizesSnap = await getDocs(sizesCol);
        
        // Agregar eliminación de cada talla al batch
        for (const sizeDoc of sizesSnap.docs) {
          batch.delete(sizeDoc.ref);
        }
        
        // Agregar eliminación de la variante al batch
        batch.delete(variantDoc.ref);
      }
      
      // 3. Agregar eliminación del producto al batch
      const productRef = doc(db, 'products', productId);
      batch.delete(productRef);
      
      // Ejecutar todas las eliminaciones
      await batch.commit();
      
      console.log(`[ProductService] Producto ${productId} eliminado exitosamente con todas sus variantes`);
      
      // Limpiar cache
      this.clearCache();
      
    } catch (error) {
      console.error('Error eliminando producto:', error);
      throw new Error('No se pudo eliminar el producto por completo');
    }
  }
}
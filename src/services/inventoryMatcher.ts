import { ProductService } from './productService';
import type { Product } from '../types/Product';

// 1. Función para normalizar texto (quita acentos, minúsculas, espacios extra)
const normalize = (text: string) => {
  if (!text) return "";
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

// 2. Diccionario de Tallas (El traductor vital)
const SIZE_MAP: Record<string, string[]> = {
  'xs': ['extra chica', 'xs', 'xsmall', 'extra small'],
  's':  ['chica', 's', 'small', 'ch', 'pequeña'],
  'm':  ['mediana', 'm', 'medium', 'med'],
  'l':  ['grande', 'l', 'large', 'g'],
  'xl': ['extra grande', 'xl', 'extra large', 'xg'],
  'xxl': ['doble extra grande', 'xxl', '2xl']
};

export class InventoryMatcher {
  private static productsCache: Product[] = [];
  private static lastFetch: number = 0;

  // Carga productos reales (caché de 5 minutos)
  static async loadCatalog() {
    const now = Date.now();
    // Si ya tenemos datos y son recientes (menos de 5 min), no descargamos de nuevo
    if (this.productsCache.length > 0 && (now - this.lastFetch) < 300000) {
      console.log("🔄 Mar: Usando catálogo en caché.");
      return this.productsCache;
    }
    
    console.log("🔄 Mar: Descargando catálogo COMPLETO de Firebase...");
    // IMPORTANTE: loadAllProducts debe traer las variantes y sus tallas
    this.productsCache = await ProductService.loadAllProducts(true);
    this.lastFetch = now;
    
    // DEBUG: Ver qué se cargó realmente
    console.log(`✅ Mar: Catálogo cargado (${this.productsCache.length} productos).`);
    if (this.productsCache.length > 0) {
       console.log("🔍 Ejemplo de producto cargado:", this.productsCache[0]);
    }
    
    return this.productsCache;
  }

  // Busca el producto en el array descargado
  static findProduct(iaItem: { producto: string, color?: string, talla?: string }): any {
    console.log(`🔍 BUSCANDO: Producto="${iaItem.producto}", Color="${iaItem.color}", Talla="${iaItem.talla}"`);

    const searchTerms = normalize(iaItem.producto).split(" ");
    const searchColor = iaItem.color ? normalize(iaItem.color) : null;
    
    // Normalizamos la talla buscada (ej: de "mediana" a "m")
    let searchSize = iaItem.talla ? normalize(iaItem.talla) : null;
    
    // Intentamos traducir la talla de voz a código (Mediana -> m)
    if (searchSize) {
      for (const [code, synonyms] of Object.entries(SIZE_MAP)) {
        if (synonyms.includes(searchSize)) {
          searchSize = code; // Ahora buscamos "m" en lugar de "mediana"
          break;
        }
      }
    }
    console.log(`📏 Talla normalizada para búsqueda: "${searchSize}"`);

    // --- PASO 1: Filtrar por nombre ---
    const matches = this.productsCache.filter(p => {
      const pName = normalize(p.name);
      // Verificamos si TODAS las palabras dichas por la IA están en el nombre del producto
      const nameMatch = searchTerms.every(term => pName.includes(term));
      return nameMatch;
    });

    if (matches.length === 0) {
      console.warn("❌ No se encontraron productos con ese nombre.");
      return null;
    }

    console.log(`✅ Encontrados ${matches.length} productos posibles por nombre.`);

    // Tomamos el primer match por defecto, pero idealmente buscaríamos el mejor
    const product = matches[0];
    let selectedVariant = undefined;
    let foundPrice = product.price;

    // --- PASO 2: Buscar Variantes (Color y Talla) ---
    if (product.variants && product.variants.length > 0) {
      console.log(`🔎 Buscando en ${product.variants.length} variantes...`);

      // Estrategia: Buscar profundamente en la estructura
      // A veces la estructura es Variant(Color) -> Sizes(Array de tallas)
      
      for (const variant of product.variants) {
        const vColor = normalize(variant.color || '');
        const colorMatch = searchColor ? vColor.includes(searchColor) : true;

        if (!colorMatch) continue; // Si el color no coincide, siguiente variante

        // Si encontramos el color, buscamos la talla DENTRO de esta variante
        console.log(`   🎨 Color coincide: ${vColor}. Buscando talla ${searchSize}...`);

        // CASO A: La variante tiene un array de 'sizes' (Estructura común en subcolecciones)
        if (Array.isArray((variant as any).sizes)) {
            const sizeFound = (variant as any).sizes.find((s: any) => normalize(s.size) === searchSize);
            
            if (sizeFound) {
                console.log("   ✅ TALLA ENCONTRADA (en sub-array sizes)!");
                selectedVariant = { ...variant, ...sizeFound }; // Combinamos datos
                foundPrice = sizeFound.salePrice || sizeFound.price || variant.salePrice || product.price;
                break; // Terminamos búsqueda
            }
        } 
        // CASO B: La variante es la talla en sí misma (Estructura plana)
        else if (normalize(variant.size || '') === searchSize) {
             console.log("   ✅ TALLA ENCONTRADA (directa en variante)!");
             selectedVariant = variant;
             foundPrice = (variant as any).salePrice || variant.salePrice || product.price;
             break;
        }
      }

      // Si pedimos color/talla y no lo encontramos
      if (!selectedVariant && (searchColor || searchSize)) {
         console.warn("❌ Variante no encontrada (Color o Talla no coinciden).");
         return { error: 'variant_not_found', product };
      }
    }

    // Retornamos estructura compatible
    return {
      product,
      variant: selectedVariant,
      price: Number(foundPrice),
      name: product.name
    };
  }
}
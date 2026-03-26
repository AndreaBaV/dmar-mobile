// src/utils/normalizeFilters.ts

/**
 * Mapeo directo de colores a colores base
 */
const COLOR_BASE_MAP: { [key: string]: string } = {
  // Códigos hexadecimales a colores base
  '#000000': 'negro',
  '#ffffff': 'blanco',
  '#ff0000': 'rojo',
  '#ffc1cc': 'rosa',
  '#ff69b4': 'rosa',
  '#ffc0cb': 'rosa',
  '#000080': 'marino',
  '#191970': 'marino',
  '#4682b4': 'azul',
  '#4a6fa5': 'azul',
  '#4a7c7c': 'azul',
  '#87ceeb': 'azul',
  '#add8e6': 'azul',
  '#90ee90': 'verde',
  '#c8a2c8': 'lila',
  '#f0e68c': 'hueso',
  '#f5f5dc': 'beige',
  '#ffff00': 'amarillo',
  '#ffa500': 'naranja',
  
  // Nombres de colores a colores base (normalizados)
  'rosa': 'rosa',
  'rojo': 'rojo',
  'roja': 'rojo',
  'fiusha': 'rosa',
  'fucsia': 'rosa',
  'verde': 'verde',
  'verdemar': 'verde',
  'verdemarclaro': 'verde',
  'verdemaroscuro': 'verde',
  'verde claro': 'verde',
  'verde oscuro': 'verde',
  'azul': 'azul',
  'azulclaro': 'azul',
  'azulmedio': 'azul',
  'azuloscuro': 'azul',
  'azul verdoso': 'azul',
  'azulverdoso': 'azul',
  'azul claro': 'azul',
  'azul oscuro': 'azul',
  'marino': 'marino',
  'negro': 'negro',
  'negra': 'negro',
  'blanco': 'blanco',
  'blanca': 'blanco',
  'gris': 'gris',
  'grisclaro': 'gris',
  'grisobscuro': 'gris',
  'beige': 'beige',
  'hueso': 'hueso',
  'arena': 'arena',
  'cafe': 'cafe',
  'vino': 'vino',
  'lila': 'lila',
  'melon': 'melon',
  'mostaza': 'mostaza',
  'amarillo': 'amarillo',
  'amarilla': 'amarillo',
  'naranja': 'naranja',
  'salmon': 'salmon',
  'caqui': 'caqui',
  'camel': 'camel',
  'camell': 'camel',
  'ladrillo': 'ladrillo',
  'uva': 'uva',
  'mezclilla': 'mezclilla',
  'morado': 'morado',
};

/**
 * Mapeo de colores base a nombres de visualización
 */
const COLOR_DISPLAY_NAMES: { [key: string]: string } = {
  'rosa': 'Rosa',
  'rojo': 'Rojo',
  'verde': 'Verde',
  'azul': 'Azul',
  'marino': 'Marino',
  'negro': 'Negro',
  'blanco': 'Blanco',
  'gris': 'Gris',
  'beige': 'Beige',
  'hueso': 'Hueso',
  'arena': 'Arena',
  'cafe': 'Café',
  'vino': 'Vino',
  'lila': 'Lila',
  'melon': 'Melón',
  'mostaza': 'Mostaza',
  'amarillo': 'Amarillo',
  'naranja': 'Naranja',
  'salmon': 'Salmón',
  'caqui': 'Caqui',
  'camel': 'Camel',
  'ladrillo': 'Ladrillo',
  'uva': 'Uva',
  'mezclilla': 'Mezclilla',
  'morado': 'Morado',
};

/**
 * Mapeo directo de tallas a tallas base
 */
const SIZE_BASE_MAP: { [key: string]: string } = {
  // Tallas numéricas
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  '10': '10',
  '11': '11',
  '12': '12',
  '13': '13',
  '14': '14',
  '15': '15',
  '16': '16',
  
  // Tallas de dama (normalizar separadores)
  '7/28': '7/28',
  '7-28': '7/28',
  '9/30': '9/30',
  '9-30': '9/30',
  '11/32': '11/32',
  '11-32': '11/32',
  '13/34': '13/34',
  '13-34': '13/34',
  '15/36': '15/36',
  '15-36': '15/36',
  
  // Tallas de letras
  'CH': 'CH',
  'CHICA': 'CH',
  'S': 'CH',
  'SMALL': 'CH',
  'M': 'M',
  'MED': 'M',
  'MEDIANA': 'M',
  'MEDIUM': 'M',
  'G': 'G',
  'GRANDE': 'G',
  'L': 'G',
  'LARGE': 'G',
  'EG': 'EG',
  'EXTRA-GRANDE': 'EG',
  'XL': 'EG',
  'EXTRA-LARGE': 'EG',
  '2EG': '2EG',
  'XXL': '2EG',
  'DOBLE-EXTRA-GRANDE': '2EG',
  
  // Unitalla - todas a "Unitalla"
  'U': 'Unitalla',
  'UNITALLA': 'Unitalla',
  'UNICA': 'Unitalla',
  'UNICO': 'Unitalla',
};

/**
 * Extrae el color base de un nombre de color compuesto
 * Ejemplo: "Verde Mar Claro" → "verde", "Azul Oscuro" → "azul"
 */
function extractBaseColor(color: string): string {
  if (!color) return '';
  
  const cleaned = color.trim().toLowerCase();
  
  // Lista de colores base comunes (en orden de prioridad para coincidencias)
  const baseColors = [
    'rosa', 'rojo', 'verde', 'azul', 'marino', 'negro', 'blanco', 'gris',
    'beige', 'hueso', 'arena', 'cafe', 'vino', 'lila', 'melon', 'mostaza',
    'amarillo', 'naranja', 'salmon', 'caqui', 'camel', 'ladrillo', 'uva',
    'mezclilla', 'morado', 'turquesa', 'coral', 'magenta', 'cian', 'plateado',
    'dorado', 'bronce', 'ocre', 'terracota', 'burdeos', 'granate', 'esmeralda',
    'zafiro', 'rubi', 'topacio', 'ambar', 'champagne', 'champan', 'crema',
    'durazno', 'melocoton', 'lavanda', 'menta', 'lima', 'oliva', 'berenjena',
    'ciruela', 'cereza', 'fresa', 'frambuesa', 'mora', 'arandano'
  ];
  
  // Buscar el primer color base que aparezca en el nombre
  for (const baseColor of baseColors) {
    if (cleaned.includes(baseColor)) {
      return baseColor;
    }
  }
  
  // Si no se encuentra ningún color base, tomar la primera palabra
  const firstWord = cleaned.split(/\s+/)[0];
  return firstWord || cleaned;
}

/**
 * Normaliza un color a su color base simplificado
 * Ejemplo: "Verde Mar Claro" → "verde", "Azul Oscuro" → "azul"
 */
export function normalizeColor(color: string): string {
  if (!color) return '';
  
  // Limpiar el color
  const cleaned = color.trim().toLowerCase();
  
  // Si es código hex, buscar directamente en el mapa
  if (cleaned.startsWith('#')) {
    const mapped = COLOR_BASE_MAP[cleaned];
    return mapped || extractBaseColor(cleaned);
  }
  
  // Extraer el color base del nombre
  const baseColor = extractBaseColor(cleaned);
  
  // Normalizar: quitar acentos y caracteres especiales para búsqueda en mapa
  const normalized = baseColor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  
  // Buscar en el mapa - si está mapeado, usar el mapeo, sino usar el color base extraído
  const mapped = COLOR_BASE_MAP[normalized] || COLOR_BASE_MAP[baseColor];
  return mapped || baseColor;
}

/**
 * Normaliza una talla a su talla base
 */
export function normalizeSize(size: string): string {
  if (!size) return '';
  
  const cleaned = size.trim().toUpperCase();
  
  // Normalizar separadores
  const normalized = cleaned.replace(/[\/\-\s]+/g, '/');
  
  // Buscar en el mapa (primero con separador normalizado, luego original)
  return SIZE_BASE_MAP[normalized] || SIZE_BASE_MAP[cleaned] || cleaned;
}

/**
 * Obtiene el nombre de visualización para un color base
 */
export function getColorDisplayName(colorBase: string): string {
  return COLOR_DISPLAY_NAMES[colorBase] || colorBase.charAt(0).toUpperCase() + colorBase.slice(1);
}

/**
 * Obtiene el nombre de visualización para una talla base
 */
export function getSizeDisplayName(sizeBase: string): string {
  return sizeBase; // Las tallas base ya están en formato correcto
}

/**
 * Obtiene el código hexadecimal para un color base (para mostrar el swatch)
 */
export function getColorCode(colorBase: string): string | undefined {
  const hexMap: { [key: string]: string } = {
    'rosa': '#ffc1cc',
    'rojo': '#ff0000',
    'verde': '#90ee90',
    'azul': '#87ceeb',
    'marino': '#000080',
    'negro': '#000000',
    'blanco': '#ffffff',
    'gris': '#808080',
    'beige': '#f5f5dc',
    'hueso': '#f0e68c',
    'arena': '#c2b280',
    'cafe': '#8b4513',
    'vino': '#722f37',
    'lila': '#c8a2c8',
    'melon': '#ffb347',
    'mostaza': '#ffdb58',
    'amarillo': '#ffff00',
    'naranja': '#ffa500',
    'salmon': '#fa8072',
    'caqui': '#c3b091',
    'camel': '#c19a6b',
    'ladrillo': '#b22222',
    'uva': '#6f2da8',
    'mezclilla': '#4a6fa5',
    'morado': '#800080',
  };
  
  return hexMap[colorBase];
}

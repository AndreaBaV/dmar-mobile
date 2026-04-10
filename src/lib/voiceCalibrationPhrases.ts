export type CalibrationPhrase = {
  id: string;
  /** Texto grande en pantalla (apoyo para quien lee) */
  displayText: string;
  /** Instrucción que la app dice por voz antes de grabar */
  promptToSpeak: string;
  /** Palabras que suelen aparecer si el reconocimiento acertó (normalizadas sin acentos) */
  expectedKeywords: string[];
  minChars: number;
};

export const VOICE_CALIBRATION_PHRASES: CalibrationPhrase[] = [
  {
    id: 'pedido',
    displayText: '“Dos playeras azul talla mediana”',
    promptToSpeak:
      'Vamos a practicar. Cuando escuche el pitido, repita en voz alta: Dos playeras azul talla mediana.',
    expectedKeywords: ['dos', 'playera', 'playeras', 'azul', 'mediana', 'mediano', 'talla'],
    minChars: 12,
  },
  {
    id: 'dinero',
    displayText: '“El total son trescientos pesos”',
    promptToSpeak: 'Ahora diga: El total son trescientos pesos.',
    expectedKeywords: ['total', 'trescientos', '300', 'pesos', 'peso'],
    minChars: 10,
  },
  {
    id: 'despedida',
    displayText: '“Gracias por su compra, vuelva pronto”',
    promptToSpeak: 'Por último, diga: Gracias por su compra, vuelva pronto.',
    expectedKeywords: ['gracias', 'compra', 'vuelva', 'pronto', 'vuelve'],
    minChars: 12,
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Acepta la transcripción si tiene longitud mínima y encaja con parte de las palabras clave
 * (tolerante a errores del reconocedor).
 */
export function transcriptMatchesPhrase(transcript: string, phrase: CalibrationPhrase): boolean {
  const n = normalize(transcript);
  if (n.length < phrase.minChars) return false;
  const hits = phrase.expectedKeywords.filter((kw) => n.includes(normalize(kw))).length;
  const need = Math.max(1, Math.ceil(phrase.expectedKeywords.length / 2));
  return hits >= need;
}

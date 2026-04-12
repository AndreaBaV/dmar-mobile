/** Preferencias de asistente de voz por pantalla / flujo (localStorage). */

export type VoiceModuleId = 'login' | 'ventas' | 'calibracion';

export type VoiceModuleSettings = Record<VoiceModuleId, boolean>;

const STORAGE_KEY = 'dmar_voice_modules_v1';

export const VOICE_MODULE_LABELS: Record<
  VoiceModuleId,
  { title: string; description: string }
> = {
  login: {
    title: 'Inicio de sesión',
    description: 'Mensajes al abrir la pantalla de acceso (p. ej. recordatorios para ingresar correo y contraseña).',
  },
  ventas: {
    title: 'Punto de venta',
    description: 'Avisos del micrófono, ticket, venta confirmada, errores y estado en la pestaña Ventas.',
  },
  calibracion: {
    title: 'Práctica de voz',
    description: 'Locución del asistente durante el modal de calibración y práctica de reconocimiento.',
  },
};

const DEFAULTS: VoiceModuleSettings = {
  login: true,
  ventas: true,
  calibracion: true,
};

function parseStored(raw: string | null): Partial<VoiceModuleSettings> | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== 'object' || o === null) return null;
    return o as Partial<VoiceModuleSettings>;
  } catch {
    return null;
  }
}

export function getVoiceModuleSettings(): VoiceModuleSettings {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const partial = parseStored(window.localStorage.getItem(STORAGE_KEY));
    return {
      ...DEFAULTS,
      ...partial,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setVoiceModuleSettings(partial: Partial<VoiceModuleSettings>): void {
  if (typeof window === 'undefined') return;
  const next = { ...getVoiceModuleSettings(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('dmar-voice-modules-changed'));
  } catch {
    /* */
  }
}

export function isVoiceEnabledFor(module: VoiceModuleId): boolean {
  return getVoiceModuleSettings()[module] === true;
}

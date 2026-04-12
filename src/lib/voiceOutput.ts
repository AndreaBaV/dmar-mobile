/** Volumen y reproducción de mensajes por voz (Web Speech API). */

import type { VoiceModuleId } from './voiceModuleSettings';
import { isVoiceEnabledFor } from './voiceModuleSettings';

const STORAGE_KEY_VOLUME = 'dmar_voice_volume';

export type { VoiceModuleId } from './voiceModuleSettings';

export function getVoiceVolume(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY_VOLUME);
    if (v == null) return 1;
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(1, Math.max(0, n));
  } catch {
    return 1;
  }
}

export function setVoiceVolume(value: number): void {
  if (typeof window === 'undefined') return;
  const n = Math.min(1, Math.max(0, value));
  try {
    window.localStorage.setItem(STORAGE_KEY_VOLUME, String(n));
  } catch {
    /* private mode / quota */
  }
}

/** Detiene la locución inmediatamente (p. ej. antes de abrir el micrófono en calibración). */
export function cancelSpeech(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* */
  }
}

function pickAppVoice(voces: SpeechSynthesisVoice[]) {
  return voces.find(
    (v) =>
      v.name.includes('Sabina') ||
      v.name.includes('Paulina') ||
      (v.name.includes('Google') && v.lang.includes('es')) ||
      ((v.lang === 'es-MX' || v.lang === 'es_MX') && v.name.includes('Female'))
  );
}

function pickCalibrationVoice(voces: SpeechSynthesisVoice[]) {
  return (
    voces.find((v) => v.lang.startsWith('es') && /female|mujer|español/i.test(v.name)) ??
    voces.find((v) => v.lang.startsWith('es'))
  );
}

export type VoiceOutputPreset = 'app' | 'calibration' | 'login';

export type SpeakGuidanceOptions = {
  preset?: VoiceOutputPreset;
  /** Si se indica, no hay locución cuando ese módulo está desactivado en configuración. */
  module?: VoiceModuleId;
  rate?: number;
  pitch?: number;
  lang?: string;
  onEnd?: () => void;
};

/**
 * Lee el texto en voz alta usando el volumen guardado en configuración.
 * Cancela cualquier locución anterior (mismo comportamiento que antes en la app).
 */
export function speakGuidance(text: string, options?: SpeakGuidanceOptions): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !text.trim()) return null;
  if (options?.module != null && !isVoiceEnabledFor(options.module)) {
    return null;
  }
  const synth = window.speechSynthesis;
  if (!synth) return null;

  cancelSpeech();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = options?.lang ?? 'es-MX';
  u.volume = getVoiceVolume();

  const preset = options?.preset ?? 'app';
  const voces = synth.getVoices();

  if (preset === 'app') {
    const vozMujer = pickAppVoice(voces);
    if (vozMujer) u.voice = vozMujer;
    u.rate = options?.rate ?? 1.05;
    u.pitch = options?.pitch ?? 1.0;
  } else if (preset === 'calibration') {
    const voz = pickCalibrationVoice(voces);
    if (voz) u.voice = voz;
    u.rate = options?.rate ?? 0.98;
    u.pitch = options?.pitch ?? 1.0;
  } else {
    u.rate = options?.rate ?? 1.0;
    u.pitch = options?.pitch ?? 1.0;
  }

  if (options?.onEnd) u.onend = options.onEnd;
  synth.speak(u);
  return u;
}

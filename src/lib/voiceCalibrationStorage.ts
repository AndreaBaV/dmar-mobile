const KEY = 'dmar_voice_calibration_v1';

export type VoiceCalibrationRecord = {
  /** ISO timestamp */
  completedAt: string;
  /** Si el usuario eligió omitir el ejercicio */
  skipped?: boolean;
};

export function readVoiceCalibration(): VoiceCalibrationRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as VoiceCalibrationRecord;
    if (!o?.completedAt) return null;
    return o;
  } catch {
    return null;
  }
}

export function shouldShowVoiceCalibrationOnboarding(): boolean {
  return readVoiceCalibration() === null;
}

export function markVoiceCalibrationComplete(): void {
  const rec: VoiceCalibrationRecord = {
    completedAt: new Date().toISOString(),
    skipped: false,
  };
  localStorage.setItem(KEY, JSON.stringify(rec));
}

export function markVoiceCalibrationSkipped(): void {
  const rec: VoiceCalibrationRecord = {
    completedAt: new Date().toISOString(),
    skipped: true,
  };
  localStorage.setItem(KEY, JSON.stringify(rec));
}

/** Vuelve a mostrar el asistente de calibración (p. ej. desde Sesión). */
export function clearVoiceCalibrationRecord(): void {
  localStorage.removeItem(KEY);
}

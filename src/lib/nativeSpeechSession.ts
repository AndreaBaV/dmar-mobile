import type { PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';

export type NativeSpeechSession = {
  finish: () => Promise<string>;
};

/**
 * Inicia reconocimiento en Capacitor con partialResults: true.
 * La promesa de start() sin partials a veces no resuelve; el usuario debe llamar finish() (stop + texto).
 */
export async function startNativeSpeechSession(language = 'es-MX'): Promise<NativeSpeechSession> {
  let latest = '';
  const handle: PluginListenerHandle = await SpeechRecognition.addListener('partialResults', (e) => {
    const piece = e.matches?.[0] ?? e.accumulatedText ?? e.accumulated ?? '';
    if (piece) latest = piece;
  });

  await SpeechRecognition.start({
    language,
    partialResults: true,
    popup: false,
    maxResults: 5,
  });

  return {
    finish: async () => {
      try {
        await SpeechRecognition.stop();
      } catch {
        await SpeechRecognition.forceStop({});
      }
      await handle.remove();
      let text = latest.trim();
      latest = '';
      if (!text) {
        const last = await SpeechRecognition.getLastPartialResult();
        text = (last.text || last.matches?.[0] || '').trim();
      }
      return text;
    },
  };
}

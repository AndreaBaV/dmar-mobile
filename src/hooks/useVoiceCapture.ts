import { useState, useRef, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { startNativeSpeechSession, type NativeSpeechSession } from '../lib/nativeSpeechSession';

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ length: number; 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export type VoiceCaptureStartResult = { ok: true } | { ok: false; message: string };

/**
 * Captura de voz nativa (Capacitor) o Web Speech, con detener manual (stop).
 */
export function useVoiceCapture() {
  const [listening, setListening] = useState(false);
  const nativeSessionRef = useRef<NativeSpeechSession | null>(null);
  const browserRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcripcionRef = useRef('');
  const browserProcesarRef = useRef(false);
  const resolveStopRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        void SpeechRecognition.stop().catch(() => {});
      }
      try {
        browserRecRef.current?.stop();
      } catch {
        /* */
      }
    };
  }, []);

  const startCapture = async (): Promise<VoiceCaptureStartResult> => {
    if (listening) return { ok: false, message: 'Ya está escuchando.' };

    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await SpeechRecognition.available();
        if (!available) return { ok: false, message: 'Voz no disponible en este dispositivo.' };
        await SpeechRecognition.requestPermissions();
        if (nativeSessionRef.current) {
          try {
            await nativeSessionRef.current.finish();
          } catch {
            /* */
          }
          nativeSessionRef.current = null;
        }
        nativeSessionRef.current = await startNativeSpeechSession('es-MX');
        setListening(true);
        return { ok: true };
      } catch (e) {
        console.error(e);
        nativeSessionRef.current = null;
        return { ok: false, message: 'No se pudo iniciar el micrófono.' };
      }
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return { ok: false, message: 'Use Chrome para reconocimiento de voz.' };

    transcripcionRef.current = '';
    browserProcesarRef.current = false;
    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let line = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        line += r[0]?.transcript ?? '';
      }
      transcripcionRef.current = line.trim();
    };
    recognition.onerror = () => {
      setListening(false);
      browserRecRef.current = null;
      browserProcesarRef.current = false;
      const resolve = resolveStopRef.current;
      resolveStopRef.current = null;
      resolve?.('');
    };
    recognition.onend = () => {
      setListening(false);
      browserRecRef.current = null;
      const debe = browserProcesarRef.current;
      browserProcesarRef.current = false;
      const resolve = resolveStopRef.current;
      resolveStopRef.current = null;
      if (debe) {
        resolve?.(transcripcionRef.current.trim());
      } else {
        resolve?.('');
      }
    };
    browserRecRef.current = recognition;
    try {
      recognition.start();
      return { ok: true };
    } catch (e) {
      console.error(e);
      browserRecRef.current = null;
      return { ok: false, message: 'No se pudo iniciar el micrófono.' };
    }
  };

  const stopCapture = useCallback((): Promise<string> => {
    if (Capacitor.isNativePlatform()) {
      const session = nativeSessionRef.current;
      nativeSessionRef.current = null;
      setListening(false);
      if (!session) return Promise.resolve('');
      return session.finish().catch(() => '');
    }

    return new Promise((resolve) => {
      const r = browserRecRef.current;
      if (!r) {
        resolve('');
        return;
      }
      resolveStopRef.current = resolve;
      browserProcesarRef.current = true;
      try {
        r.stop();
      } catch {
        setListening(false);
        browserRecRef.current = null;
        browserProcesarRef.current = false;
        resolveStopRef.current = null;
        resolve('');
      }
    });
  }, []);

  /** Cancela sin devolver texto útil (p. ej. al cerrar el modal). */
  const abortCapture = useCallback(() => {
    if (Capacitor.isNativePlatform()) {
      const session = nativeSessionRef.current;
      nativeSessionRef.current = null;
      setListening(false);
      if (session) void session.finish().catch(() => {});
      void SpeechRecognition.stop().catch(() => {});
      return;
    }
    resolveStopRef.current = null;
    browserProcesarRef.current = false;
    try {
      browserRecRef.current?.stop();
    } catch {
      /* */
    }
    browserRecRef.current = null;
    setListening(false);
  }, []);

  return { listening, startCapture, stopCapture, abortCapture };
}

import { useState, useEffect, useRef } from 'react';
import { VOICE_CALIBRATION_PHRASES, transcriptMatchesPhrase } from '../lib/voiceCalibrationPhrases';
import {
  markVoiceCalibrationComplete,
  markVoiceCalibrationSkipped,
} from '../lib/voiceCalibrationStorage';
import { cancelSpeech, speakGuidance } from '../lib/voiceOutput';
import { useVoiceCapture } from '../hooks/useVoiceCapture';
import './VoiceCalibrationModal.scss';

const MicIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);

const StopSquareIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);

type Props = {
  open: boolean;
  onClose: () => void;
};

export function VoiceCalibrationModal({ open, onClose }: Props) {
  const { listening, startCapture, stopCapture, abortCapture } = useVoiceCapture();
  const [stepIndex, setStepIndex] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState('');
  const spokenForStepRef = useRef(-1);

  const total = VOICE_CALIBRATION_PHRASES.length;
  const phrase = VOICE_CALIBRATION_PHRASES[stepIndex];

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setHint(null);
      setLastTranscript('');
      spokenForStepRef.current = -1;
      cancelSpeech();
      abortCapture();
      return;
    }
    setStepIndex(0);
    setHint(null);
    setLastTranscript('');
    spokenForStepRef.current = -1;
  }, [open, abortCapture]);

  useEffect(() => {
    if (!open || !phrase) return;
    if (spokenForStepRef.current === stepIndex) return;
    spokenForStepRef.current = stepIndex;
    const t = window.setTimeout(() => {
      // Solo el ejemplo de frase por voz; el resto está en pantalla para no mezclar TTS con el micrófono.
      speakGuidance(phrase.promptToSpeak, { preset: 'calibration', module: 'calibracion' });
    }, 500);
    return () => {
      window.clearTimeout(t);
      cancelSpeech();
    };
  }, [open, stepIndex, phrase]);

  if (!open || !phrase) return null;

  const onMic = async () => {
    cancelSpeech();
    setHint(null);
    setLastTranscript('');
    const r = await startCapture();
    if (!r.ok) {
      setHint(r.message);
      speakGuidance(r.message, { preset: 'calibration', module: 'calibracion' });
    }
  };

  const onStop = async () => {
    if (!listening) return;
    const text = await stopCapture();
    setLastTranscript(text);
    if (!text.trim()) {
      const msg = 'No se escuchó bien. Intente otra vez.';
      setHint(msg);
      speakGuidance(msg, { preset: 'calibration', module: 'calibracion' });
      return;
    }
    if (transcriptMatchesPhrase(text, phrase)) {
      speakGuidance('Muy bien.', { preset: 'calibration', module: 'calibracion' });
      if (stepIndex + 1 >= total) {
        markVoiceCalibrationComplete();
        speakGuidance('Calibración lista. Ya puede usar el punto de venta con la voz.', {
          preset: 'calibration',
          module: 'calibracion',
        });
        window.setTimeout(() => onClose(), 2200);
      } else {
        setStepIndex((i) => i + 1);
        setHint(null);
      }
    } else {
      const msg =
        'No coincidió del todo. Escuche otra vez el ejemplo y repita más claro, un poco más despacio.';
      setHint(msg);
      speakGuidance(msg, { preset: 'calibration', module: 'calibracion' });
    }
  };

  const onSkip = () => {
    cancelSpeech();
    abortCapture();
    markVoiceCalibrationSkipped();
    // Cerrar de inmediato: en muchos móviles `utterance.onend` no es fiable tras omitir.
    onClose();
  };

  return (
    <div className="voice-calibration-backdrop" role="dialog" aria-modal="true" aria-labelledby="voice-cal-title">
      <div className="voice-calibration-card glass-card">
        <h2 id="voice-cal-title" className="voice-calibration-title">
          Práctica de voz
        </h2>
        <p className="voice-calibration-sub">
          Escuche el mensaje y repita la frase. Así el micrófono se adapta mejor a su voz.
        </p>

        <div className="voice-calibration-progress" aria-hidden>
          {VOICE_CALIBRATION_PHRASES.map((p, i) => (
            <span
              key={p.id}
              className={`voice-calibration-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}
            />
          ))}
        </div>

        <div className="voice-calibration-phrase">
          <span className="voice-calibration-phrase-label">Repita algo como:</span>
          <p className="voice-calibration-phrase-text">{phrase.displayText}</p>
        </div>

        {lastTranscript ? (
          <p className="voice-calibration-transcript" aria-live="polite">
            Escuchamos: «{lastTranscript}»
          </p>
        ) : null}

        {hint ? (
          <p className="voice-calibration-hint" role="alert">
            {hint}
          </p>
        ) : null}

        <div className="voice-calibration-actions">
          <button
            type="button"
            className="voice-cal-mic"
            onClick={() => void onMic()}
            disabled={listening}
            aria-label="Empezar a grabar"
          >
            <MicIcon />
          </button>
          {listening ? (
            <button
              type="button"
              className="voice-cal-stop"
              onClick={() => void onStop()}
              aria-label="Detener y comprobar"
            >
              <StopSquareIcon />
            </button>
          ) : null}
        </div>
        <p className="voice-calibration-help">
          {listening ? 'Pulse el cuadrado rojo cuando termine de hablar.' : 'Pulse el micrófono para grabar su voz.'}
        </p>

        <button type="button" className="voice-calibration-skip" onClick={onSkip}>
          Omitir por ahora
        </button>
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { isVoiceEnabledFor } from '../lib/voiceModuleSettings';
import { speakGuidance } from '../lib/voiceOutput';
import './LoginView.scss';

const LOGIN_TIMEOUT_MS = 15_000;

const EyeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

type Props = {
  onBeforeSignIn: () => void;
  onSignInFailed?: () => void;
};

export function LoginView({ onBeforeSignIn, onSignInFailed }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isVoiceEnabledFor('login')) return;
      speakGuidance(
        'Pantalla de inicio de sesión. Pida ayuda a alguien para ingresar su correo y contraseña.',
        { preset: 'login', module: 'login' }
      );
    }, 600);
    return () => {
      clearTimeout(timer);
      window.speechSynthesis.cancel();
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const emailTrim = email.trim();
    const emailNorm = emailTrim.toLowerCase();

    let waitUnsub: (() => void) | undefined;
    let waitTimer: ReturnType<typeof window.setTimeout> | undefined;

    const cleanupExtraListener = () => {
      if (waitTimer !== undefined) {
        window.clearTimeout(waitTimer);
        waitTimer = undefined;
      }
      waitUnsub?.();
      waitUnsub = undefined;
    };

    const userAppeared = new Promise<User>((resolve, reject) => {
      waitTimer = window.setTimeout(() => {
        cleanupExtraListener();
        reject(new Error('LOGIN_TIMEOUT'));
      }, LOGIN_TIMEOUT_MS);

      waitUnsub = onAuthStateChanged(auth, (user) => {
        if (!user?.email) return;
        if (user.email.toLowerCase() !== emailNorm) return;
        window.clearTimeout(waitTimer);
        waitTimer = undefined;
        waitUnsub?.();
        waitUnsub = undefined;
        resolve(user);
      });
    });

    onBeforeSignIn();

    try {
      const signInPromise = signInWithEmailAndPassword(auth, emailTrim, password);
      await Promise.race([signInPromise, userAppeared]);
    } catch (err: unknown) {
      cleanupExtraListener();
      onSignInFailed?.();

      if (err instanceof Error && err.message === 'LOGIN_TIMEOUT') {
        setError('La petición tardó demasiado. Revise la red o intente de nuevo.');
      } else {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          setError('Usuario o contraseña incorrectos.');
        } else if (code === 'auth/too-many-requests') {
          setError('Demasiados intentos. Espere un momento.');
        } else if (code === 'auth/network-request-failed') {
          setError('Sin conexión o bloqueo de red.');
        } else {
          setError('No se pudo iniciar sesión.');
        }
      }
    } finally {
      cleanupExtraListener();
      setLoading(false);
    }
  }, [email, password, onBeforeSignIn, onSignInFailed]);

  return (
    <div className="login-view">
      <div className="login-card glass-panel">
        <h1 className="login-title">D&apos;MAR POS</h1>
        <p className="login-sub">Inicie sesión (válido 7 días)</p>
        <form onSubmit={(ev) => void handleSubmit(ev)} className="login-form">
          <label className="login-label">
            Correo
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className="login-input"
              required
            />
          </label>
          <label className="login-label">
            Contraseña
            <div className="login-password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                className="login-input login-input--with-toggle"
                required
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

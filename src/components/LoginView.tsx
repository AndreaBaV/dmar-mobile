import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { openDebugConsole } from '../lib/debugConsole';
import './LoginView.scss';

const LOGIN_TIMEOUT_MS = 28_000;

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
  /** Si el login falla o hace timeout, limpiar flags en el padre (p. ej. pendingLoginRenew). */
  onSignInFailed?: () => void;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error('LOGIN_TIMEOUT'));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}

export function LoginView({ onBeforeSignIn, onSignInFailed }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    onBeforeSignIn();
    try {
      await withTimeout(
        signInWithEmailAndPassword(auth, email.trim(), password),
        LOGIN_TIMEOUT_MS
      );
    } catch (err: unknown) {
      onSignInFailed?.();
      if (err instanceof Error && err.message === 'LOGIN_TIMEOUT') {
        setError('La petición tardó demasiado. Revise la red o intente de nuevo. Use “Ver logs” abajo si sigue fallando.');
        console.error('[DMAR:auth] signIn timeout', LOGIN_TIMEOUT_MS, 'ms');
      } else {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : '';
        if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
          setError('Usuario o contraseña incorrectos.');
        } else if (code === 'auth/too-many-requests') {
          setError('Demasiados intentos. Espere un momento.');
        } else if (code === 'auth/network-request-failed') {
          setError('Sin conexión o bloqueo de red. Compruebe Wi‑Fi/datos.');
        } else {
          setError('No se pudo iniciar sesión. Toque “Ver logs” para detalles.');
        }
        console.error('[DMAR:auth] signIn error', code, msg, err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-card glass-panel">
        <h1 className="login-title">D&apos;MAR POS</h1>
        <p className="login-sub">Inicie sesión (válido 7 días en este dispositivo)</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="login-form">
          <label className="login-label">
            Correo
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
        <button type="button" className="login-logs-link" onClick={() => void openDebugConsole()}>
          Ver logs (depuración)
        </button>
      </div>
    </div>
  );
}

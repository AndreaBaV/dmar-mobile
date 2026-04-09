import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import './LoginView.scss';

type Props = {
  onBeforeSignIn: () => void;
};

export function LoginView({ onBeforeSignIn }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    onBeforeSignIn();
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Usuario o contraseña incorrectos.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Espere un momento.');
      } else {
        setError('No se pudo iniciar sesión. Revise la conexión.');
      }
      console.error('[DMAR:auth]', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-view">
      <div className="login-card glass-panel">
        <h1 className="login-title">D&apos;MAR POS</h1>
        <p className="login-sub">Inicie sesión (válido 7 días en este dispositivo)</p>
        <form onSubmit={handleSubmit} className="login-form">
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
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              required
            />
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

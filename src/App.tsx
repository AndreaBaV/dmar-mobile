import { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';
import { consultarAMar } from './services/marService';
import { InventoryMatcher } from './services/inventoryMatcher';
import { SaleService } from './services/saleService';
import { auth } from './firebase/config';
import type { Product, Variant } from './types/Product';
import {
  renewWeeklySession,
  clearWeeklySession,
  isWeeklySessionValid,
  formatSessionExpiry,
} from './lib/weeklyAuth';
import { openDebugConsole } from './lib/debugConsole';
import { LoginView } from './components/LoginView';
import { InventoryView } from './components/InventoryView';
import './App.scss';

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
const WaveIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v4"/></svg>
);
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const LoaderIcon = () => (
  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);

interface CartItemReal {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Variant;
}

type MainTab = 'ventas' | 'inventario' | 'sesion';

/** API Web Speech del navegador (no confundir con Capacitor). */
type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  start: () => void;
  onstart: (() => void) | null;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function App() {
  const pendingLoginRenew = useRef(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('ventas');

  const [estaEscuchando, setEstaEscuchando] = useState(false);
  const [mensaje, setMensaje] = useState('Inicializando sistema...');
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [productList, setProductList] = useState<Product[]>([]);
  const [carritoReal, setCarritoReal] = useState<CartItemReal[]>([]);
  const [total, setTotal] = useState(0);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAuthUser(null);
        setAuthChecked(true);
        return;
      }
      if (!isWeeklySessionValid()) {
        if (pendingLoginRenew.current) {
          pendingLoginRenew.current = false;
          renewWeeklySession();
          setAuthUser(user);
          setAuthChecked(true);
          return;
        }
        await signOut(auth);
        clearWeeklySession();
        setAuthUser(null);
        setAuthChecked(true);
        return;
      }
      setAuthUser(user);
      setAuthChecked(true);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setCatalogoListo(false);
      setProductList([]);
      setMensaje('Inicializando sistema...');
      return;
    }

    const cargarDatos = async () => {
      const t0 = performance.now();
      const log = (step: string, extra?: Record<string, unknown>) => {
        const ms = (performance.now() - t0).toFixed(0);
        console.log(`[DMAR:init] App.cargarDatos +${ms}ms`, step, extra ?? '');
      };
      log('inicio', { onLine: navigator.onLine, href: typeof window !== 'undefined' ? window.location.href : '' });
      try {
        log('antes InventoryMatcher.loadCatalog()');
        await InventoryMatcher.loadCatalog();
        log('después InventoryMatcher.loadCatalog() OK');
        setProductList(InventoryMatcher.getCatalogSnapshot());
        setCatalogoListo(true);
        setMensaje('Sistema listo. Pulse para iniciar.');
      } catch (error) {
        const err = error as Error;
        console.error('[DMAR:init] cargarDatos ERROR', err?.message, err?.stack, error);
        setMensaje('Error de conexión con el inventario.');
      } finally {
        log('fin cargarDatos', { totalMs: (performance.now() - t0).toFixed(0) });
      }
    };
    void cargarDatos();
  }, [authUser]);

  const hablar = (texto: string) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterThis = new SpeechSynthesisUtterance(texto);
    const voces = synth.getVoices();
    const vozMujer = voces.find(v =>
      (v.name.includes('Sabina') || v.name.includes('Paulina')) ||
      (v.name.includes('Google') && v.lang.includes('es')) ||
      ((v.lang === 'es-MX' || v.lang === 'es_MX') && v.name.includes('Female'))
    );
    if (vozMujer) utterThis.voice = vozMujer;
    utterThis.lang = 'es-MX';
    utterThis.rate = 1.05;
    utterThis.pitch = 1.0;
    synth.speak(utterThis);
  };

  const iniciarEscucha = async () => {
    if (!catalogoListo) return alert('El catálogo aún se está cargando.');
    const esMovil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (esMovil) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) return alert('Reconocimiento de voz no disponible');
        await CapacitorSpeechRecognition.requestPermissions();
        setEstaEscuchando(true);
        CapacitorSpeechRecognition.start({
          language: 'es-MX',
          partialResults: false,
          popup: false,
        }).then((result) => {
          if (result?.matches && result.matches.length > 0) {
            void procesarResultado(result.matches[0]);
          } else {
            setEstaEscuchando(false);
            setMensaje('No se detectó audio.');
          }
        });
      } catch (e) {
        console.error(e);
        setEstaEscuchando(false);
      }
    } else {
      const w = window as unknown as {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      };
      const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) return alert('Navegador no compatible. Use Chrome.');
      const recognition = new SR();
      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.onstart = () => setEstaEscuchando(true);
      recognition.onresult = (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) void procesarResultado(transcript);
      };
      recognition.onerror = () => {
        setEstaEscuchando(false);
        setMensaje('Error al capturar audio.');
      };
      recognition.onend = () => setEstaEscuchando(false);
      recognition.start();
    }
  };

  const procesarResultado = async (texto: string) => {
    setEstaEscuchando(false);
    setMensaje('Procesando solicitud...');
    try {
      const respuestaIA = await consultarAMar(texto);
      if (!respuestaIA || !respuestaIA.items || respuestaIA.items.length === 0) {
        hablar('No pude identificar productos en su orden.');
        setMensaje('Sin productos detectados.');
        return;
      }

      const itemsEncontrados: CartItemReal[] = [];
      let nuevoTotal = 0;
      let advertencias = '';

      for (const itemIA of respuestaIA.items) {
        const match = InventoryMatcher.findProduct(itemIA);
        if (!match) {
          advertencias += `Producto "${itemIA.producto}" no encontrado. `;
          continue;
        }
        if (match.error === 'variant_not_found') {
          advertencias += `Sin stock para ${match.product.name} en ${itemIA.color} talla ${itemIA.talla}. `;
          continue;
        }
        const itemReal: CartItemReal = {
          productId: match.product.id,
          name: match.product.name,
          price: match.price,
          quantity: itemIA.cantidad || 1,
          variant: match.variant,
        };
        itemsEncontrados.push(itemReal);
        nuevoTotal += itemReal.price * itemReal.quantity;
      }

      setCarritoReal(itemsEncontrados);
      setTotal(nuevoTotal);

      if (itemsEncontrados.length > 0) {
        const resumen = `Orden generada. Total: ${nuevoTotal} pesos.`;
        setMensaje(advertencias ? 'Revise las advertencias.' : 'Orden lista para confirmar.');
        hablar(resumen + ' ¿Procedo con la venta?');
      } else {
        setMensaje('No se pudo procesar la orden.');
        hablar(advertencias || 'No entendí la solicitud.');
      }
    } catch (error) {
      console.error(error);
      setMensaje('Error de comunicación.');
      hablar('Error de comunicación con el servidor.');
    }
  };

  const confirmarVenta = async () => {
    if (carritoReal.length === 0) return;
    setProcesandoVenta(true);
    setMensaje('Autorizando transacción...');
    try {
      const ventaId = await SaleService.processSale(
        carritoReal,
        total,
        'cash',
        total.toString(),
        'contado',
        'Cliente Mostrador',
        'Mar Asistente',
        false
      );
      setMensaje(`Venta ${ventaId.substring(0, 6)} exitosa.`);
      hablar('Transacción completada exitosamente.');
      setTimeout(() => {
        window.print();
        setCarritoReal([]);
        setTotal(0);
        setProcesandoVenta(false);
        setMensaje('Sistema listo para nueva operación.');
      }, 1000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(error);
      setMensaje(`Error: ${msg}`);
      hablar('Error al registrar la venta.');
      setProcesandoVenta(false);
    }
  };

  const handleLogout = async () => {
    clearWeeklySession();
    await signOut(auth);
    setMainTab('ventas');
  };

  if (!authChecked) {
    return (
      <div className="layout-container layout-container--centered">
        <div className="bg-gradient" />
        <p className="boot-message">Comprobando sesión…</p>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="layout-container layout-container--centered">
        <div className="bg-gradient" />
        <LoginView onBeforeSignIn={() => { pendingLoginRenew.current = true; }} />
      </div>
    );
  }

  return (
    <div className="layout-container">
      <div className="bg-gradient" />

      <header className="glass-header">
        <div className="brand-container">
          <div className="logo-placeholder">
            <img src="/logo.png" alt="D'Mar" className="logo-img" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="logo-text">D&apos;MAR</span>
          </div>
          <p className="subtitle">POS INTELLIGENCE</p>
        </div>
      </header>

      <div className="main-shell">
        <main className="main-content">
          {mainTab === 'ventas' && (
            <>
              <div className="control-panel glass-card">
                <div className="mic-container">
                  <button
                    type="button"
                    className={`mic-button ${estaEscuchando ? 'listening' : ''}`}
                    onClick={() => void iniciarEscucha()}
                    disabled={!catalogoListo || procesandoVenta}
                  >
                    {estaEscuchando ? <WaveIcon /> : <MicIcon />}
                  </button>
                  <div className="status-indicator">
                    <span className={`dot ${catalogoListo ? 'ready' : 'busy'}`} />
                    <p className="status-text">{mensaje}</p>
                  </div>
                </div>
              </div>

              {carritoReal.length > 0 && (
                <div className="order-panel glass-card fade-in">
                  <div className="panel-header">
                    <h3>Resumen de Operación</h3>
                    <span className="order-date">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div className="items-list">
                    {carritoReal.map((it, i) => (
                      <div key={i} className="item-row">
                        <div className="item-qty-badge">{it.quantity}</div>
                        <div className="item-info">
                          <span className="item-name">{it.name}</span>
                          {it.variant ? (
                            <span className="item-variant">
                              {it.variant.color} • {it.variant.size}
                            </span>
                          ) : null}
                        </div>
                        <div className="item-price">${(it.price * it.quantity).toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="total-section">
                    <span className="total-label">Importe Total</span>
                    <span className="total-amount">${total.toFixed(2)}</span>
                  </div>
                  <button type="button" className="action-button" onClick={() => void confirmarVenta()} disabled={procesandoVenta}>
                    {procesandoVenta ? <LoaderIcon /> : <CheckIcon />}
                    <span>{procesandoVenta ? 'Procesando...' : 'Autorizar Venta'}</span>
                  </button>
                </div>
              )}

              <div className="print-only" />
            </>
          )}

          {mainTab === 'inventario' && (
            <InventoryView products={productList} catalogoListo={catalogoListo} />
          )}

          {mainTab === 'sesion' && (
            <div className="session-panel glass-card">
              <h3 className="session-title">Sesión</h3>
              <p className="session-email">{authUser.email ?? 'Usuario'}</p>
              <p className="session-expiry">
                Volverá a pedir inicio de sesión después del:
                <br />
                <strong>{formatSessionExpiry()}</strong>
              </p>
              <button type="button" className="session-btn session-btn--secondary" onClick={() => void openDebugConsole()}>
                Abrir consola de logs
              </button>
              <button type="button" className="session-btn session-btn--danger" onClick={() => void handleLogout()}>
                Cerrar sesión
              </button>
            </div>
          )}
        </main>
      </div>

      <nav className="tab-bar" aria-label="Secciones">
        <button type="button" className={`tab-bar__btn ${mainTab === 'ventas' ? 'active' : ''}`} onClick={() => setMainTab('ventas')}>
          Ventas
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'inventario' ? 'active' : ''}`} onClick={() => setMainTab('inventario')}>
          Inventario
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'sesion' ? 'active' : ''}`} onClick={() => setMainTab('sesion')}>
          Sesión
        </button>
      </nav>
    </div>
  );
}

export default App;

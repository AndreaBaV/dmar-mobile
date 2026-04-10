import { useState, useEffect, useRef, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { startNativeSpeechSession, type NativeSpeechSession } from './lib/nativeSpeechSession';
import { consultarAMar } from './services/marService';
import { InventoryMatcher } from './services/inventoryMatcher';
import { SaleService } from './services/saleService';
import { auth } from './firebase/config';
import type { Product } from './types/Product';
import {
  renewWeeklySession,
  clearWeeklySession,
  isWeeklySessionValid,
  formatSessionExpiry,
} from './lib/weeklyAuth';
import { openDebugConsole } from './lib/debugConsole';
import { LoginView } from './components/LoginView';
import { InventoryView } from './components/InventoryView';
import { VoiceCalibrationModal } from './components/VoiceCalibrationModal';
import { AddProductModal } from './components/AddProductModal';
import { shouldShowVoiceCalibrationOnboarding } from './lib/voiceCalibrationStorage';
import { mergeCartLines, productImageUrl, type CartLine } from './utils/cartUtils';
import './App.scss';

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
);
const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const LoaderIcon = () => (
  <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
const CartIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
);
const BoxIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);
const UserIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);
const XIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const StopSquareIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
);
const TrashIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const PlusCircleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);
const MinusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

type MainTab = 'ventas' | 'inventario' | 'sesion';

/** API Web Speech del navegador (no confundir con Capacitor). */
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

function App() {
  const pendingLoginRenew = useRef(false);
  const guiaInicialDada = useRef(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mainTab, setMainTab] = useState<MainTab>('ventas');

  const [estaEscuchando, setEstaEscuchando] = useState(false);
  const [mensaje, setMensaje] = useState('Inicializando sistema...');
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [productList, setProductList] = useState<Product[]>([]);
  const [carritoReal, setCarritoReal] = useState<CartLine[]>([]);
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [voiceCalibrationOpen, setVoiceCalibrationOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const totalCarrito = useMemo(
    () => carritoReal.reduce((s, it) => s + it.price * it.quantity, 0),
    [carritoReal]
  );

  const nativeSpeechSessionRef = useRef<NativeSpeechSession | null>(null);
  const browserRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcripcionRef = useRef('');
  const browserProcesarAlDetenerRef = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    let initialAuthHandled = false;

    const bootTimeoutId = window.setTimeout(() => {
      if (cancelled || initialAuthHandled) return;
      initialAuthHandled = true;
      setAuthUser(null);
      setAuthChecked(true);
    }, 4500);

    const finishBoot = () => {
      if (initialAuthHandled) return;
      initialAuthHandled = true;
      window.clearTimeout(bootTimeoutId);
    };

    const safeSignOut = async () => {
      await Promise.race([
        signOut(auth),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 12000);
        }),
      ]);
    };

    void (async () => {
      if (cancelled) return;

      unsub = onAuthStateChanged(auth, async (user) => {
        finishBoot();

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
          await safeSignOut();
          clearWeeklySession();
          setAuthUser(null);
          setAuthChecked(true);
          return;
        }
        setAuthUser(user);
        setAuthChecked(true);
      });
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(bootTimeoutId);
      unsub?.();
    };
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
        const guia = 'Sistema listo. Toque el botón para hablar.';
        setMensaje(guia);
        if (!guiaInicialDada.current) {
          guiaInicialDada.current = true;
          hablar(guia);
        }
      } catch (error) {
        const err = error as Error;
        console.error('[DMAR:init] cargarDatos ERROR', err?.message, err?.stack, error);
        mensajeConVoz('Error de conexión con el inventario.');
      } finally {
        log('fin cargarDatos', { totalMs: (performance.now() - t0).toFixed(0) });
      }
    };
    void cargarDatos();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setVoiceCalibrationOpen(false);
      return;
    }
    if (catalogoListo && shouldShowVoiceCalibrationOnboarding()) {
      setVoiceCalibrationOpen(true);
    }
  }, [authUser, catalogoListo]);

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

  const mensajeConVoz = (texto: string) => {
    setMensaje(texto);
    hablar(texto);
  };

  const procesarResultado = async (texto: string) => {
    setEstaEscuchando(false);
    setMensaje('Procesando solicitud...');
    try {
      const respuestaIA = await consultarAMar(texto);
      if (!respuestaIA || !respuestaIA.items || respuestaIA.items.length === 0) {
        mensajeConVoz('No pude identificar productos en su orden.');
        return;
      }

      const itemsEncontrados: CartLine[] = [];
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
        const itemReal: CartLine = {
          productId: match.product.id,
          name: match.product.name,
          price: match.price,
          quantity: itemIA.cantidad || 1,
          variant: match.variant,
          imageUrl: productImageUrl(match.product),
        };
        itemsEncontrados.push(itemReal);
      }

      if (itemsEncontrados.length > 0) {
        setCarritoReal((prev) => {
          const merged = mergeCartLines(prev, itemsEncontrados);
          const nuevoTotal = merged.reduce((s, i) => s + i.price * i.quantity, 0);
          queueMicrotask(() => {
            const resumen = `Productos agregados al ticket. Total: ${nuevoTotal} pesos. ¿Desea confirmar la venta?`;
            mensajeConVoz(advertencias ? `${resumen} Atención: ${advertencias}` : resumen);
          });
          return merged;
        });
      } else {
        mensajeConVoz(advertencias || 'No entendí la solicitud.');
      }
    } catch (error) {
      console.error(error);
      mensajeConVoz('Error de comunicación con el servidor.');
    }
  };

  const iniciarEscucha = async () => {
    if (!catalogoListo) {
      alert('El catálogo aún se está cargando.');
      return;
    }
    if (estaEscuchando || procesandoVenta) return;

    if (Capacitor.isNativePlatform()) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) {
          alert('Reconocimiento de voz no disponible');
          return;
        }
        await CapacitorSpeechRecognition.requestPermissions();
        if (nativeSpeechSessionRef.current) {
          try {
            await nativeSpeechSessionRef.current.finish();
          } catch {
            /* ignorar sesión colgada */
          }
          nativeSpeechSessionRef.current = null;
        }
        nativeSpeechSessionRef.current = await startNativeSpeechSession('es-MX');
        setEstaEscuchando(true);
        setMensaje('Escuchando… Toque detener cuando termine.');
      } catch (e) {
        console.error(e);
        nativeSpeechSessionRef.current = null;
        setEstaEscuchando(false);
        mensajeConVoz('Error al iniciar el micrófono.');
      }
      return;
    }

    const w = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      alert('Navegador no compatible. Use Chrome.');
      return;
    }
    transcripcionRef.current = '';
    browserProcesarAlDetenerRef.current = false;
    const recognition = new SR();
    recognition.lang = 'es-MX';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = () => setEstaEscuchando(true);
    recognition.onresult = (event) => {
      let line = '';
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        line += r[0]?.transcript ?? '';
      }
      transcripcionRef.current = line.trim();
    };
    recognition.onerror = () => {
      setEstaEscuchando(false);
      browserRecognitionRef.current = null;
      browserProcesarAlDetenerRef.current = false;
      mensajeConVoz('Error al capturar audio.');
    };
    recognition.onend = () => {
      setEstaEscuchando(false);
      browserRecognitionRef.current = null;
      const debe = browserProcesarAlDetenerRef.current;
      browserProcesarAlDetenerRef.current = false;
      if (debe) {
        const text = transcripcionRef.current.trim();
        if (text) void procesarResultado(text);
        else mensajeConVoz('No se detectó audio.');
      }
    };
    browserRecognitionRef.current = recognition;
    try {
      recognition.start();
      setMensaje('Escuchando… Toque detener cuando termine.');
    } catch (e) {
      console.error(e);
      browserRecognitionRef.current = null;
      setEstaEscuchando(false);
      mensajeConVoz('No se pudo iniciar el micrófono.');
    }
  };

  const detenerYProcesarVenta = async () => {
    if (!estaEscuchando) return;
    setMensaje('Procesando solicitud...');

    if (Capacitor.isNativePlatform()) {
      const session = nativeSpeechSessionRef.current;
      nativeSpeechSessionRef.current = null;
      setEstaEscuchando(false);
      if (!session) return;
      try {
        const text = await session.finish();
        if (text) await procesarResultado(text);
        else mensajeConVoz('No se detectó audio.');
      } catch (e) {
        console.error(e);
        mensajeConVoz('Error al capturar audio.');
      }
      return;
    }

    const r = browserRecognitionRef.current;
    if (r) {
      browserProcesarAlDetenerRef.current = true;
      try {
        r.stop();
      } catch (e) {
        console.error(e);
        setEstaEscuchando(false);
        browserRecognitionRef.current = null;
        browserProcesarAlDetenerRef.current = false;
        mensajeConVoz('Error al capturar audio.');
      }
    } else {
      setEstaEscuchando(false);
    }
  };

  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform()) {
        void CapacitorSpeechRecognition.stop().catch(() => {});
      }
      try {
        browserRecognitionRef.current?.stop();
      } catch {
        /* */
      }
    };
  }, []);

  const confirmarVenta = async () => {
    if (carritoReal.length === 0) return;
    setProcesandoVenta(true);
    setMensaje('Autorizando transacción...');
    try {
      await SaleService.processSale(
        carritoReal,
        totalCarrito,
        'cash',
        totalCarrito.toString(),
        'contado',
        'Cliente Mostrador',
        'Mar Asistente',
        false
      );
      mensajeConVoz('Transacción completada exitosamente.');
      setTimeout(() => {
        window.print();
        setCarritoReal([]);
        setProcesandoVenta(false);
        mensajeConVoz('Sistema listo. Toque el botón para hablar.');
      }, 1000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(error);
      mensajeConVoz(`Error al registrar la venta. ${msg}`);
      setProcesandoVenta(false);
    }
  };

  const handleLogout = async () => {
    clearWeeklySession();
    await signOut(auth);
    setMainTab('ventas');
  };

  const cancelarOrden = () => {
    setCarritoReal([]);
    mensajeConVoz('Orden cancelada.');
  };

  const quitarLineaTicket = (index: number) => {
    setCarritoReal((prev) => prev.filter((_, i) => i !== index));
  };

  const cambiarCantidadLinea = (index: number, delta: number) => {
    setCarritoReal((prev) => {
      const next = [...prev];
      const it = next[index];
      if (!it) return prev;
      const q = it.quantity + delta;
      if (q <= 0) return prev.filter((_, i) => i !== index);
      next[index] = { ...it, quantity: q };
      return next;
    });
  };

  const agregarLineaDesdeCatalogo = (line: CartLine) => {
    setCarritoReal((prev) => mergeCartLines(prev, [line]));
    setMensaje('Producto agregado al ticket.');
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
        <LoginView
          onBeforeSignIn={() => { pendingLoginRenew.current = true; }}
          onSignInFailed={() => { pendingLoginRenew.current = false; }}
        />
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
                  <div className="mic-actions-row">
                    <button
                      type="button"
                      className={`mic-button ${estaEscuchando ? 'listening' : ''}`}
                      onClick={() => void iniciarEscucha()}
                      disabled={!catalogoListo || procesandoVenta || estaEscuchando}
                      aria-label="Toque para hablar"
                    >
                      <MicIcon />
                    </button>
                    {estaEscuchando ? (
                      <button
                        type="button"
                        className="mic-stop-btn"
                        onClick={() => void detenerYProcesarVenta()}
                        aria-label="Detener y procesar pedido"
                      >
                        <StopSquareIcon />
                      </button>
                    ) : null}
                  </div>
                  <span className="mic-label">
                    {estaEscuchando ? 'Toque el cuadrado rojo cuando termine de hablar' : 'Toque para hablar'}
                  </span>
                  <div className="status-indicator">
                    <span className={`dot ${catalogoListo ? 'ready' : 'busy'}`} />
                    <p className="status-text">{mensaje}</p>
                  </div>
                </div>
              </div>

              {carritoReal.length === 0 && catalogoListo ? (
                <button
                  type="button"
                  className="order-add-product-btn order-add-product-btn--solo"
                  onClick={() => setAddProductOpen(true)}
                  disabled={procesandoVenta}
                >
                  <PlusCircleIcon />
                  <span>Agregar producto con fotos</span>
                </button>
              ) : null}

              {carritoReal.length > 0 && (
                <div className="order-panel glass-card fade-in">
                  <div className="panel-header">
                    <h3>Ticket</h3>
                    <span className="order-date">{new Date().toLocaleDateString()}</span>
                  </div>
                  <button
                    type="button"
                    className="order-add-product-btn"
                    onClick={() => setAddProductOpen(true)}
                    disabled={!catalogoListo || procesandoVenta}
                  >
                    <PlusCircleIcon />
                    <span>Agregar producto</span>
                  </button>
                  <div className="items-list">
                    {carritoReal.map((it, i) => (
                      <div key={`${it.productId}-${it.variant?.color ?? ''}-${it.variant?.size ?? ''}-${i}`} className="item-row">
                        <div className="item-thumb-wrap">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt="" className="item-thumb" />
                          ) : (
                            <div className="item-thumb-placeholder" aria-hidden />
                          )}
                        </div>
                        <div className="item-body">
                          <div className="item-info">
                            <span className="item-name">{it.name}</span>
                            {it.variant ? (
                              <span className="item-variant">
                                {it.variant.color} • {it.variant.size}
                              </span>
                            ) : null}
                          </div>
                          <div className="item-controls">
                            <div className="item-qty-stepper">
                              <button
                                type="button"
                                className="item-qty-btn"
                                onClick={() => cambiarCantidadLinea(i, -1)}
                                disabled={procesandoVenta}
                                aria-label="Menos uno"
                              >
                                <MinusIcon />
                              </button>
                              <span className="item-qty-value">{it.quantity}</span>
                              <button
                                type="button"
                                className="item-qty-btn"
                                onClick={() => cambiarCantidadLinea(i, 1)}
                                disabled={procesandoVenta}
                                aria-label="Más uno"
                              >
                                <PlusIcon />
                              </button>
                            </div>
                            <button
                              type="button"
                              className="item-remove-btn"
                              onClick={() => quitarLineaTicket(i)}
                              disabled={procesandoVenta}
                              aria-label="Quitar del ticket"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                        <div className="item-price-col">
                          <span className="item-price">${(it.price * it.quantity).toFixed(2)}</span>
                          <span className="item-unit">c/u ${it.price.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="total-section">
                    <span className="total-label">Importe Total</span>
                    <span className="total-amount">${totalCarrito.toFixed(2)}</span>
                  </div>
                  <div className="order-actions">
                    <button type="button" className="action-button action-button--cancel" onClick={cancelarOrden} disabled={procesandoVenta}>
                      <XIcon /><span>Cancelar</span>
                    </button>
                    <button type="button" className="action-button action-button--confirm" onClick={() => void confirmarVenta()} disabled={procesandoVenta}>
                      {procesandoVenta ? <LoaderIcon /> : <CheckIcon />}
                      <span>{procesandoVenta ? 'Procesando...' : 'Confirmar'}</span>
                    </button>
                  </div>
                </div>
              )}

              <AddProductModal
                open={addProductOpen}
                products={productList}
                onClose={() => setAddProductOpen(false)}
                onAddLine={agregarLineaDesdeCatalogo}
              />

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
              <button type="button" className="session-btn session-btn--secondary" onClick={() => setVoiceCalibrationOpen(true)}>
                Práctica de reconocimiento de voz
              </button>
              <button type="button" className="session-btn session-btn--danger" onClick={() => void handleLogout()}>
                Cerrar sesión
              </button>
            </div>
          )}
        </main>
      </div>

      <VoiceCalibrationModal open={voiceCalibrationOpen} onClose={() => setVoiceCalibrationOpen(false)} />

      <nav className="tab-bar" aria-label="Secciones">
        <button type="button" className={`tab-bar__btn ${mainTab === 'ventas' ? 'active' : ''}`} onClick={() => setMainTab('ventas')}>
          <CartIcon /><span>Ventas</span>
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'inventario' ? 'active' : ''}`} onClick={() => setMainTab('inventario')}>
          <BoxIcon /><span>Inventario</span>
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'sesion' ? 'active' : ''}`} onClick={() => setMainTab('sesion')}>
          <UserIcon /><span>Sesión</span>
        </button>
      </nav>
    </div>
  );
}

export default App;

import { useState, useEffect, useRef, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { startNativeSpeechSession, type NativeSpeechSession } from './lib/nativeSpeechSession';
import { consultarAMar } from './services/marService';
import { InventoryMatcher } from './services/inventoryMatcher';
import { SaleService } from './services/saleService';
import { auth } from './firebase/config';
import { loadUserProfile } from './services/userProfileService';
import type { UserRole } from './types/User';
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
import { SalesHistoryView } from './components/SalesHistoryView';
import { VoiceCalibrationModal } from './components/VoiceCalibrationModal';
import { AddProductModal } from './components/AddProductModal';
import { VoiceAmbiguousPickModal } from './components/VoiceAmbiguousPickModal';
import { BluetoothPrinterPanel } from './components/BluetoothPrinterPanel';
import { MasModuleHub, type MasStack } from './components/MasModuleHub';
import { shouldShowVoiceCalibrationOnboarding } from './lib/voiceCalibrationStorage';
import { getVoiceVolume, setVoiceVolume, speakGuidance } from './lib/voiceOutput';
import {
  getVoiceModuleSettings,
  setVoiceModuleSettings,
  VOICE_MODULE_LABELS,
  type VoiceModuleId,
} from './lib/voiceModuleSettings';
import {
  mergeCartLinesRespectingStock,
  productImageUrl,
  stockAvailableFor,
  type CartLine,
} from './utils/cartUtils';
import { buildPlainTextTicket } from './lib/ticketText';
import { tryPrintSaleTicket } from './services/bluetoothThermalPrint';
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
const HistoryIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const GridIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);

type MainTab = 'ventas' | 'inventario' | 'historial' | 'mas' | 'sesion';

type VoiceAmbiguityState = {
  current: { candidates: Product[]; quantity: number };
  pendingAmbiguous: Array<{ candidates: Product[]; quantity: number }>;
  accumulated: CartLine[];
  advertencias: string;
};

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
  const [masStack, setMasStack] = useState<MasStack>('menu');

  const [estaEscuchando, setEstaEscuchando] = useState(false);
  const [mensaje, setMensaje] = useState('Inicializando sistema...');
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [productList, setProductList] = useState<Product[]>([]);
  const [carritoReal, setCarritoReal] = useState<CartLine[]>([]);
  const [procesandoVenta, setProcesandoVenta] = useState(false);
  const [voiceCalibrationOpen, setVoiceCalibrationOpen] = useState(false);
  const [voiceVolume, setVoiceVolumeState] = useState(() => getVoiceVolume());
  const [voiceModules, setVoiceModules] = useState(() => getVoiceModuleSettings());
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [voiceAmbiguity, setVoiceAmbiguity] = useState<VoiceAmbiguityState | null>(null);
  const [ticketImagePreview, setTicketImagePreview] = useState<{ url: string; label: string } | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('cashier');
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  const isAdmin = userRole === 'admin';

  const totalCarrito = useMemo(
    () => carritoReal.reduce((s, it) => s + it.price * it.quantity, 0),
    [carritoReal]
  );

  const getProductById = (id: string) => productList.find((p) => p.id === id);

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
      setProfileChecked(false);
      setUserRole('cashier');
      setUserDisplayName(null);
      return;
    }

    let cancelled = false;
    setProfileChecked(false);

    void (async () => {
      try {
        const result = await loadUserProfile(authUser.uid);
        if (cancelled) return;
        if (!result.ok) {
          clearWeeklySession();
          await signOut(auth);
          return;
        }
        setUserRole(result.role);
        setUserDisplayName(result.name);
        setProfileChecked(true);
      } catch (e) {
        console.error('[App] loadUserProfile', e);
        if (cancelled) return;
        setUserRole('cashier');
        setUserDisplayName(null);
        setProfileChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!isAdmin) {
      setAddProductOpen(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!authUser) {
      setCatalogoListo(false);
      setProductList([]);
      setMensaje('Inicializando sistema...');
      return;
    }
    if (!profileChecked) {
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
  }, [authUser, profileChecked]);

  useEffect(() => {
    if (!authUser) {
      setVoiceCalibrationOpen(false);
      return;
    }
    if (catalogoListo && shouldShowVoiceCalibrationOnboarding()) {
      setVoiceCalibrationOpen(true);
    }
  }, [authUser, catalogoListo]);

  useEffect(() => {
    if (mainTab !== 'sesion') return;
    setVoiceVolumeState(getVoiceVolume());
    setVoiceModules(getVoiceModuleSettings());
  }, [mainTab]);

  useEffect(() => {
    if (mainTab !== 'mas') setMasStack('menu');
  }, [mainTab]);

  useEffect(() => {
    const sync = () => setVoiceModules(getVoiceModuleSettings());
    window.addEventListener('dmar-voice-modules-changed', sync);
    return () => window.removeEventListener('dmar-voice-modules-changed', sync);
  }, []);

  useEffect(() => {
    if (!ticketImagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTicketImagePreview(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [ticketImagePreview]);

  useEffect(() => {
    if (carritoReal.length === 0) setTicketImagePreview(null);
  }, [carritoReal.length]);

  const hablar = (texto: string) => {
    speakGuidance(texto, { preset: 'app', module: 'ventas' });
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

      const definiteLines: CartLine[] = [];
      const ambiguities: Array<{ candidates: Product[]; quantity: number }> = [];
      let advertencias = '';

      for (const itemIA of respuestaIA.items) {
        const r = InventoryMatcher.resolveVoiceItem(itemIA);
        if (r.status === 'not_found') {
          advertencias += `Producto "${itemIA.producto}" no encontrado. `;
          continue;
        }
        if (r.status === 'variant_not_found') {
          advertencias += `Sin variante para ${r.product.name}${itemIA.color ? ` color ${itemIA.color}` : ''}${itemIA.talla ? ` talla ${itemIA.talla}` : ''}. `;
          continue;
        }
        if (r.status === 'ambiguous') {
          ambiguities.push({ candidates: r.candidates, quantity: itemIA.cantidad || 1 });
          continue;
        }
        definiteLines.push({
          productId: r.product.id,
          name: r.product.name,
          price: r.price,
          quantity: itemIA.cantidad || 1,
          variant: r.variant,
          imageUrl: productImageUrl(r.product),
        });
      }

      if (ambiguities.length > 0) {
        const [first, ...rest] = ambiguities;
        setVoiceAmbiguity({
          current: first,
          pendingAmbiguous: rest,
          accumulated: definiteLines,
          advertencias,
        });
        setMensaje('Varias opciones: elija en pantalla.');
        mensajeConVoz(
          'Hay varias opciones de producto. Toque la foto del artículo correcto. Luego elija color y talla si se pide.'
        );
        return;
      }

      if (definiteLines.length > 0) {
        setCarritoReal((prev) => {
          const { lines, adjustments } = mergeCartLinesRespectingStock(
            prev,
            definiteLines,
            getProductById
          );
          const nuevoTotal = lines.reduce((s, i) => s + i.price * i.quantity, 0);
          const stockNote = adjustments.join(' ');
          const fullAdv = [advertencias.trim(), stockNote].filter(Boolean).join(' ');
          queueMicrotask(() => {
            const resumen = `Productos agregados al ticket. Total: ${nuevoTotal} pesos. ¿Desea confirmar la venta?`;
            mensajeConVoz(fullAdv ? `${resumen} Atención: ${fullAdv}` : resumen);
          });
          return lines;
        });
      } else {
        mensajeConVoz(advertencias.trim() || 'No entendí la solicitud.');
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
    if (estaEscuchando || procesandoVenta || voiceAmbiguity) return;

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
    const cashierName =
      userDisplayName?.trim() || authUser?.email?.split('@')[0] || 'Cajero';
    const cashStr = totalCarrito.toFixed(2);
    const change = Math.max(0, parseFloat(cashStr) - totalCarrito);
    try {
      const saleId = await SaleService.processSale(
        carritoReal,
        totalCarrito,
        'cash',
        cashStr,
        'contado',
        'Cliente Mostrador',
        cashierName,
        false
      );
      mensajeConVoz('Transacción completada exitosamente.');

      const ticketParams = {
        saleId,
        lines: [...carritoReal],
        total: totalCarrito,
        cashReceived: cashStr,
        change,
        cashierName,
        clientName: 'Cliente Mostrador',
      };

      const finishUi = () => {
        setCarritoReal([]);
        setProcesandoVenta(false);
        mensajeConVoz('Sistema listo. Toque el botón para hablar.');
      };

      if (Capacitor.isNativePlatform()) {
        setTimeout(async () => {
          const printed = await tryPrintSaleTicket(ticketParams);
          if (!printed) {
            try {
              await Share.share({
                title: "Ticket D'Mar",
                text: buildPlainTextTicket(ticketParams),
                dialogTitle: 'Compartir ticket',
              });
            } catch {
              /* usuario canceló o no hay handler */
            }
          }
          finishUi();
        }, 400);
      } else {
        setTimeout(() => {
          window.print();
          finishUi();
        }, 1000);
      }
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
      const p = getProductById(it.productId);
      if (p) {
        const max = stockAvailableFor(p, it.variant);
        if (Number.isFinite(max) && q > max) {
          if (max <= 0) return prev.filter((_, i) => i !== index);
          next[index] = { ...it, quantity: max };
          queueMicrotask(() =>
            mensajeConVoz(`Solo hay ${max} unidades disponibles de ${it.name}.`)
          );
          return next;
        }
      }
      next[index] = { ...it, quantity: q };
      return next;
    });
  };

  const agregarLineaDesdeCatalogo = (line: CartLine) => {
    setCarritoReal((prev) => {
      const { lines, adjustments } = mergeCartLinesRespectingStock(prev, [line], getProductById);
      const note = adjustments.join(' ');
      queueMicrotask(() => {
        setMensaje(note || 'Producto agregado al ticket.');
        if (note) mensajeConVoz(note);
        else mensajeConVoz('Producto agregado al ticket.');
      });
      return lines;
    });
  };

  const handleVoiceAmbiguityPick = (line: CartLine) => {
    setVoiceAmbiguity((prev) => {
      if (!prev) return null;
      const acc = [...prev.accumulated, line];
      const adv = prev.advertencias;
      if (prev.pendingAmbiguous.length > 0) {
        const [next, ...rest] = prev.pendingAmbiguous;
        queueMicrotask(() => hablar('Elija el siguiente producto.'));
        return {
          current: next,
          pendingAmbiguous: rest,
          accumulated: acc,
          advertencias: adv,
        };
      }
      queueMicrotask(() => {
        setCarritoReal((p0) => {
          const { lines, adjustments } = mergeCartLinesRespectingStock(p0, acc, getProductById);
          const nuevoTotal = lines.reduce((s, i) => s + i.price * i.quantity, 0);
          const resumen = `Productos agregados al ticket. Total: ${nuevoTotal} pesos. ¿Desea confirmar la venta?`;
          const fullAdv = [adv, ...adjustments].filter(Boolean).join(' ');
          mensajeConVoz(fullAdv.trim() ? `${resumen} Atención: ${fullAdv}` : resumen);
          return lines;
        });
      });
      return null;
    });
  };

  const handleVoiceAmbiguityCancel = () => {
    setVoiceAmbiguity((prev) => {
      if (!prev) return null;
      const acc = prev.accumulated;
      const adv = prev.advertencias;
      queueMicrotask(() => {
        if (acc.length > 0) {
          setCarritoReal((p0) => {
            const { lines, adjustments } = mergeCartLinesRespectingStock(p0, acc, getProductById);
            const nuevoTotal = lines.reduce((s, i) => s + i.price * i.quantity, 0);
            const stockNote = adjustments.join(' ');
            const tail = [adv.trim(), stockNote].filter(Boolean).join(' ');
            mensajeConVoz(
              `Se agregaron solo los productos ya identificados. Total: ${nuevoTotal} pesos.${tail ? ` ${tail}` : ''}`
            );
            return lines;
          });
        } else {
          mensajeConVoz(
            'No se agregó ese producto. Diga el nombre más completo, o el color y la talla, o elija con fotos en agregar producto.'
          );
        }
      });
      return null;
    });
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

  if (!profileChecked) {
    return (
      <div className="layout-container layout-container--centered">
        <div className="bg-gradient" />
        <p className="boot-message">Cargando perfil…</p>
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
          <p className="subtitle-role">{isAdmin ? 'Administrador' : 'Cajero'}</p>
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
                      disabled={!catalogoListo || procesandoVenta || estaEscuchando || voiceAmbiguity !== null}
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

              {isAdmin && carritoReal.length === 0 && catalogoListo ? (
                <div className="add-product-hero glass-card">
                  <button
                    type="button"
                    className="add-product-hero__btn"
                    onClick={() => setAddProductOpen(true)}
                    disabled={procesandoVenta}
                    aria-label="Agregar producto con fotos"
                  >
                    <PlusCircleIcon />
                  </button>
                  <span className="add-product-hero__label">Agregar producto con fotos</span>
                </div>
              ) : null}

              {carritoReal.length > 0 && (
                <div className="order-panel glass-card fade-in">
                  <div className="panel-header">
                    <h3>Ticket</h3>
                    <span className="order-date">{new Date().toLocaleDateString()}</span>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      className="order-add-product-btn"
                      onClick={() => setAddProductOpen(true)}
                      disabled={!catalogoListo || procesandoVenta}
                    >
                      <PlusCircleIcon />
                      <span>Agregar producto</span>
                    </button>
                  ) : null}
                  <div className="items-list">
                    {carritoReal.map((it, i) => (
                      <div key={`${it.productId}-${it.variant?.color ?? ''}-${it.variant?.size ?? ''}-${i}`} className="item-row">
                        {it.imageUrl ? (
                          <button
                            type="button"
                            className="item-thumb-wrap item-thumb-wrap--clickable"
                            onClick={() => setTicketImagePreview({ url: it.imageUrl!, label: it.name })}
                            aria-label={`Ampliar imagen: ${it.name}`}
                          >
                            <img src={it.imageUrl} alt="" className="item-thumb" />
                          </button>
                        ) : (
                          <div className="item-thumb-wrap">
                            <div className="item-thumb-placeholder" aria-hidden />
                          </div>
                        )}
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

              {isAdmin ? (
                <AddProductModal
                  open={addProductOpen}
                  products={productList}
                  catalogoListo={catalogoListo}
                  onClose={() => setAddProductOpen(false)}
                  onAddLine={agregarLineaDesdeCatalogo}
                />
              ) : null}

              <VoiceAmbiguousPickModal
                open={voiceAmbiguity !== null}
                candidates={voiceAmbiguity?.current.candidates ?? []}
                quantity={voiceAmbiguity?.current.quantity ?? 1}
                onPick={handleVoiceAmbiguityPick}
                onCancel={handleVoiceAmbiguityCancel}
              />

              <div className="print-only" />
            </>
          )}

          {mainTab === 'inventario' && (
            <InventoryView products={productList} catalogoListo={catalogoListo} />
          )}

          {mainTab === 'historial' && <SalesHistoryView isAdmin={isAdmin} />}

          {mainTab === 'mas' && (
            <MasModuleHub
              stack={masStack}
              onNavigate={setMasStack}
              cashierName={userDisplayName?.trim() || authUser.email?.split('@')[0] || 'Cajero'}
            />
          )}

          {mainTab === 'sesion' && (
            <div className="session-panel glass-card">
              <h3 className="session-title">Sesión</h3>
              <p className="session-role-pill">{isAdmin ? 'Administrador' : 'Cajero'}</p>
              <p className="session-email">{userDisplayName || authUser.email || 'Usuario'}</p>
              <p className="session-expiry">
                Volverá a pedir inicio de sesión después del:
                <br />
                <strong>{formatSessionExpiry()}</strong>
              </p>

              <BluetoothPrinterPanel />

              <div className="session-voice-modules">
                <h4 className="session-subheading">Asistente de voz por módulo</h4>
                <p className="session-voice-module-intro">
                  Desactive los mensajes hablados donde no los necesite. Los avisos en texto en pantalla no cambian.
                </p>
                {(['login', 'ventas', 'calibracion'] as const).map((id: VoiceModuleId) => (
                  <label key={id} className="session-voice-module-row">
                    <input
                      type="checkbox"
                      className="session-voice-module-check"
                      checked={voiceModules[id]}
                      onChange={() => {
                        const cur = getVoiceModuleSettings();
                        setVoiceModuleSettings({ [id]: !cur[id] });
                        setVoiceModules(getVoiceModuleSettings());
                      }}
                    />
                    <span className="session-voice-module-text">
                      <span className="session-voice-module-title">{VOICE_MODULE_LABELS[id].title}</span>
                      <span className="session-voice-module-desc">{VOICE_MODULE_LABELS[id].description}</span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="session-voice-settings">
                <label className="session-voice-label" htmlFor="session-voice-volume">
                  Volumen de mensajes por voz
                </label>
                <input
                  id="session-voice-volume"
                  type="range"
                  className="session-voice-range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(voiceVolume * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setVoiceVolume(v);
                    setVoiceVolumeState(v);
                  }}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(voiceVolume * 100)}
                  aria-valuetext={`${Math.round(voiceVolume * 100)} por ciento`}
                />
                <p className="session-voice-value">{Math.round(voiceVolume * 100)}%</p>
                <p className="session-voice-hint">
                  Ajuste si los avisos se oyen muy bajos o el teléfono envía el audio al auricular de llamadas: suba este control y también el volumen de multimedia del dispositivo.
                </p>
                <button
                  type="button"
                  className="session-btn session-btn--secondary session-btn--compact"
                  disabled={!voiceModules.ventas}
                  title={
                    voiceModules.ventas
                      ? undefined
                      : 'Active «Punto de venta» arriba para poder probar la voz.'
                  }
                  onClick={() => {
                    speakGuidance('Así se oirán los mensajes de voz en el punto de venta.', {
                      preset: 'app',
                      module: 'ventas',
                    });
                  }}
                >
                  Probar voz
                </button>
              </div>
              {isAdmin ? (
                <button type="button" className="session-btn session-btn--secondary" onClick={() => void openDebugConsole()}>
                  Abrir consola de logs
                </button>
              ) : null}
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
        <button type="button" className={`tab-bar__btn ${mainTab === 'historial' ? 'active' : ''}`} onClick={() => setMainTab('historial')}>
          <HistoryIcon /><span>Historial</span>
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'mas' ? 'active' : ''}`} onClick={() => setMainTab('mas')}>
          <GridIcon /><span>Más</span>
        </button>
        <button type="button" className={`tab-bar__btn ${mainTab === 'sesion' ? 'active' : ''}`} onClick={() => setMainTab('sesion')}>
          <UserIcon /><span>Sesión</span>
        </button>
      </nav>

      {ticketImagePreview ? (
        <div
          className="ticket-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada del producto"
          onClick={() => setTicketImagePreview(null)}
        >
          <button
            type="button"
            className="ticket-image-lightbox__close"
            onClick={(e) => {
              e.stopPropagation();
              setTicketImagePreview(null);
            }}
            aria-label="Cerrar vista ampliada"
          >
            <XIcon />
          </button>
          <div className="ticket-image-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <img
              src={ticketImagePreview.url}
              alt={ticketImagePreview.label}
              className="ticket-image-lightbox__img"
              decoding="async"
            />
            <p className="ticket-image-lightbox__caption">{ticketImagePreview.label}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;

import { useState, useEffect } from 'react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { consultarAMar } from './services/marService';
import { InventoryMatcher } from './services/inventoryMatcher';
import { SaleService } from './services/saleService';
import './App.scss'; // Asegúrate de cambiar la extensión a .scss

// --- ICONOS SVG (Inline para evitar dependencias externas) ---
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
  variant?: any;
}

function App() {
  const [estaEscuchando, setEstaEscuchando] = useState(false);
  const [mensaje, setMensaje] = useState("Inicializando sistema...");
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [carritoReal, setCarritoReal] = useState<CartItemReal[]>([]);
  const [total, setTotal] = useState(0);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        await InventoryMatcher.loadCatalog();
        setCatalogoListo(true);
        setMensaje("Sistema listo. Pulse para iniciar.");
      } catch (error) {
        console.error(error);
        setMensaje("Error de conexión con el inventario.");
      }
    };
    cargarDatos();
  }, []);

  // --- LÓGICA DE VOZ NATURAL MEJORADA ---
  const hablar = (texto: string) => {
    const synth = window.speechSynthesis;
    // Cancelar cualquier audio previo para evitar superposiciones
    synth.cancel();

    const utterThis = new SpeechSynthesisUtterance(texto);
    const voces = synth.getVoices();
    
    // Prioridad de voces para sonar más natural y ejecutiva
    const vozMujer = voces.find(v => 
      // Prioridad 1: Voces Microsoft "Neural" o de alta calidad (Windows/Edge)
      (v.name.includes('Sabina') || v.name.includes('Paulina')) ||
      // Prioridad 2: Voces de Google (Android/Chrome)
      (v.name.includes('Google') && v.lang.includes('es')) ||
      // Prioridad 3: Cualquier voz femenina en español
      ((v.lang === 'es-MX' || v.lang === 'es_MX') && v.name.includes('Female'))
    );

    if (vozMujer) {
      utterThis.voice = vozMujer;
    }

    utterThis.lang = 'es-MX';
    utterThis.rate = 1.05; // Ligeramente más rápido para sonar fluido
    utterThis.pitch = 1.0; // Tono natural
    synth.speak(utterThis);
  };

  const iniciarEscucha = async () => {
    if (!catalogoListo) return alert("El catálogo aún se está cargando.");

    const esMovil = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (esMovil) {
      try {
        const { available } = await SpeechRecognition.available();
        if (!available) return alert("Reconocimiento de voz no disponible");
        
        await SpeechRecognition.requestPermissions();
        setEstaEscuchando(true);

        SpeechRecognition.start({
          language: "es-MX",
          partialResults: false,
          popup: false, // Popup nativo desactivado para usar nuestra UI
        }).then((result) => {
          if (result?.matches && result.matches.length > 0) {
            procesarResultado(result.matches[0]);
          } else {
            setEstaEscuchando(false);
            setMensaje("No se detectó audio.");
          }
        });
      } catch (e) {
        console.error(e);
        setEstaEscuchando(false);
      }
    } else {
      const SpeechRecognitionWeb = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionWeb) return alert("Navegador no compatible. Use Chrome.");

      const recognition = new SpeechRecognitionWeb();
      recognition.lang = "es-MX";
      recognition.continuous = false;
      
      recognition.onstart = () => setEstaEscuchando(true);
      recognition.onresult = (event: any) => procesarResultado(event.results[0][0].transcript);
      recognition.onerror = () => {
        setEstaEscuchando(false);
        setMensaje("Error al capturar audio.");
      };
      recognition.onend = () => setEstaEscuchando(false);
      recognition.start();
    }
  };

  const procesarResultado = async (texto: string) => {
    setEstaEscuchando(false);
    setMensaje("Procesando solicitud...");
    
    try {
      const respuestaIA = await consultarAMar(texto);
      
      if (!respuestaIA || !respuestaIA.items || respuestaIA.items.length === 0) {
        hablar("No pude identificar productos en su orden.");
        setMensaje("Sin productos detectados.");
        return;
      }

      const itemsEncontrados: CartItemReal[] = [];
      let nuevoTotal = 0;
      let advertencias = "";

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
          variant: match.variant
        };

        itemsEncontrados.push(itemReal);
        nuevoTotal += (itemReal.price * itemReal.quantity);
      }

      setCarritoReal(itemsEncontrados);
      setTotal(nuevoTotal);

      if (itemsEncontrados.length > 0) {
        const resumen = `Orden generada. Total: ${nuevoTotal} pesos.`;
        setMensaje(advertencias ? "Revise las advertencias." : "Orden lista para confirmar.");
        hablar(resumen + " ¿Procedo con la venta?");
      } else {
        setMensaje("No se pudo procesar la orden.");
        hablar(advertencias || "No entendí la solicitud.");
      }

    } catch (error) {
      console.error(error);
      setMensaje("Error de comunicación.");
      hablar("Error de comunicación con el servidor.");
    }
  };

  const confirmarVenta = async () => {
    if (carritoReal.length === 0) return;
    
    setProcesandoVenta(true);
    setMensaje("Autorizando transacción...");

    try {
      const ventaId = await SaleService.processSale(
        carritoReal,
        total,
        'cash',
        total.toString(),
        "contado",
        "Cliente Mostrador",
        "Mar Asistente",
        false
      );

      setMensaje(`Venta ${ventaId.substring(0,6)} exitosa.`);
      hablar("Transacción completada exitosamente.");

      setTimeout(() => {
        window.print(); 
        setCarritoReal([]);
        setTotal(0);
        setProcesandoVenta(false);
        setMensaje("Sistema listo para nueva operación.");
      }, 1000);

    } catch (error: any) {
      console.error(error);
      setMensaje(`Error: ${error.message}`);
      hablar("Error al registrar la venta.");
      setProcesandoVenta(false);
    }
  };

  return (
    <div className="layout-container">
      {/* Fondo decorativo difuminado */}
      <div className="bg-gradient"></div>

      <header className="glass-header">
        {/* LOGO D'MAR */}
        <div className="brand-container">
          <div className="logo-placeholder">
             {/* Reemplaza src="/logo.png" con tu ruta real */}
             <img src="/logo.png" alt="D'Mar" className="logo-img" onError={(e) => e.currentTarget.style.display='none'} />
             <span className="logo-text">D'MAR</span>
          </div>
          <p className="subtitle">POS INTELLIGENCE</p>
        </div>
      </header>

      <main className="main-content">
        {/* Panel Central de Control */}
        <div className="control-panel glass-card">
          <div className="mic-container">
            <button 
              className={`mic-button ${estaEscuchando ? 'listening' : ''}`} 
              onClick={iniciarEscucha}
              disabled={!catalogoListo || procesandoVenta}
            >
              {estaEscuchando ? <WaveIcon /> : <MicIcon />}
            </button>
            <div className="status-indicator">
              <span className={`dot ${catalogoListo ? 'ready' : 'busy'}`}></span>
              <p className="status-text">{mensaje}</p>
            </div>
          </div>
        </div>

        {/* Vista Previa de Orden (Aparece solo si hay items) */}
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
                    {it.variant && <span className="item-variant">{it.variant.color} • {it.variant.size}</span>}
                  </div>
                  <div className="item-price">${(it.price * it.quantity).toFixed(2)}</div>
                </div>
              ))}
            </div>
            
            <div className="total-section">
              <span className="total-label">Importe Total</span>
              <span className="total-amount">${total.toFixed(2)}</span>
            </div>

            <button 
              className="action-button" 
              onClick={confirmarVenta}
              disabled={procesandoVenta}
            >
              {procesandoVenta ? <LoaderIcon /> : <CheckIcon />}
              <span>{procesandoVenta ? 'Procesando...' : 'Autorizar Venta'}</span>
            </button>
          </div>
        )}

        {/* Ticket Oculto para Impresión */}
        <div className="print-only">
            {/* ... Aquí iría tu estructura de ticket existente ... */}
        </div>
      </main>
    </div>
  );
}

export default App;
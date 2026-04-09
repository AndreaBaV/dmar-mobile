/**
 * Configuración de Firebase - Arquitectura Offline-First
 * 
 * Habilita persistencia offline con soporte multi-tab:
 * - persistentLocalCache: Permite leer/escribir datos sin conexión
 * - persistentMultipleTabManager: Sincroniza cache entre todas las pestañas del navegador
 * 
 * Arquitectura Offline-First:
 * - Todas las operaciones se guardan localmente primero
 * - Los cambios se sincronizan automáticamente cuando hay conexión
 * - El cache local actúa como "espejo" de la base de datos
 * - Las operaciones funcionan instantáneamente sin esperar red
 */
import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import {
  initializeFirestore,
  disableNetwork,
  enableNetwork,
  persistentLocalCache,
  persistentMultipleTabManager,
  waitForPendingWrites,
} from "firebase/firestore";

export const firebaseConfig = {
    apiKey: "AIzaSyAHr_F1ZZP_gEu6dI6ZH5i4aeyjS-bssnQ",
    authDomain: "dmarboutiquedr-bfe78.firebaseapp.com",
    projectId: "dmarboutiquedr-bfe78",
    storageBucket: "dmarboutiquedr-bfe78.firebasestorage.app",
    messagingSenderId: "283712499610",
    appId: "1:283712499610:web:0eb3a0674afb50bf44d423",
    measurementId: "G-KT00QQL7KT"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configurar persistencia local para que la sesión se mantenga después de refrescar
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Error configurando persistencia de auth:', error);
});

// Inicializar Firestore con persistencia offline habilitada para todas las pestañas
// Esta configuración crea un "espejo" local de la base de datos
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
    // Cache size: 40MB por defecto, suficiente para la mayoría de casos
  }),
});

if (typeof console !== 'undefined' && console.log) {
  console.log('[DMAR:init] Firebase listo', {
    projectId: firebaseConfig.projectId,
    onLine: typeof navigator !== 'undefined' ? navigator.onLine : undefined,
  });
}

// Utilidades para gestión de red
export const goOffline = async () => { 
  await disableNetwork(db);
  console.log('Firestore: Modo offline activado');
};

export const goOnline = async () => { 
  await enableNetwork(db);
  console.log('Firestore: Modo online activado');
  
  // Esperar a que se sincronicen los writes pendientes
  try {
    await waitForPendingWrites(db);
    console.log('Firestore: Writes pendientes sincronizados');
  } catch (error) {
    console.warn('Firestore: Algunos writes pendientes no se pudieron sincronizar:', error);
  }
};

// Verificar estado de sincronización
export const waitForSync = async (): Promise<void> => {
  if (navigator.onLine) {
    try {
      await waitForPendingWrites(db);
    } catch (error) {
      console.warn('Error esperando sincronización:', error);
    }
  }
};
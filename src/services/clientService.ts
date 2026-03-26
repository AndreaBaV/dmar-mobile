// services/clientService.ts - VERSIÓN CORREGIDA
import { 
  collection, doc, addDoc, updateDoc, getDoc, getDocs, 
  query, where, orderBy, limit, serverTimestamp, increment, Timestamp, deleteDoc
} from "firebase/firestore";
import { db } from "../firebase/config";
import type { Client, ClientCreate, ClientUpdate } from "../types/Client";

const CLIENTS_COLLECTION = "clients";

function normalizeClientData(data: any, id: string): Client {
  return {
    id,
    name: data.name || "",
    phone: data.phone || "",
    email: data.email || "",
    taxId: data.taxId || "",
    points: typeof data.points === 'number' ? data.points : 0,
    purchaseCount: typeof data.purchaseCount === 'number' ? data.purchaseCount : 0,
    totalSpent: typeof data.totalSpent === 'number' ? data.totalSpent : 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    // Campos opcionales de búsqueda
    searchName: data.searchName,
    searchPhone: data.searchPhone,
  };
}
// Función helper para búsqueda fallback (fuera del objeto)
async function searchFallback(term: string, pageSize: number): Promise<{ clients: Client[] }> {
  try {
    // Obtener todos los clientes y buscar en memoria
    const allQuery = query(
      collection(db, CLIENTS_COLLECTION),
      limit(200)
    );
    
    const snapshot = await getDocs(allQuery);
    const allClients = snapshot.docs.map(doc => {
      const data = doc.data();
      const { searchName, searchPhone, ...rest } = data;
      return { id: doc.id, ...rest } as Client;
    });
    
    const filtered = allClients.filter(client => {
      const nameMatch = client.name.toLowerCase().includes(term);
      const phoneMatch = client.phone?.toLowerCase().includes(term);
      return nameMatch || phoneMatch;
    });
    
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    return { clients: filtered.slice(0, pageSize) };
  } catch (error) {
    console.error("Error en búsqueda fallback:", error);
    return { clients: [] };
  }
}

export const clientService = {
  // Crear cliente
  async create(data: ClientCreate): Promise<string> {
    try {
      // Usar Timestamp.now() si está offline para evitar problemas con serverTimestamp()
      const isOnline = navigator.onLine;
      const now = isOnline ? serverTimestamp() : Timestamp.now();
      
      const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
        ...data,
        points: 0,
        purchaseCount: 0,
        totalSpent: 0,
        createdAt: now,
        updatedAt: now,
        // Campos para búsqueda optimizada
        searchName: data.name.toLowerCase(),
        searchPhone: data.phone ? data.phone.replace(/\D/g, '') : '',
      });
      return docRef.id;
    } catch (error: any) {
      console.error('Error creando cliente:', error);
      // En offline, Firestore puede crear el documento pero tardar en responder
      if (!navigator.onLine && error.message?.includes('timeout')) {
        // Generar ID temporal para que la UI continúe
        return `temp-client-${Date.now()}`;
      }
      throw new Error(error.message || 'No se pudo crear el cliente');
    }
  },

  // Actualizar cliente
  async update(id: string, data: ClientUpdate): Promise<void> {
    try {
      const isOnline = navigator.onLine;
      const updateData: any = {
        ...data,
        updatedAt: isOnline ? serverTimestamp() : Timestamp.now(),
      };
      
      if (data.name !== undefined) {
        updateData.searchName = data.name.toLowerCase();
      }
      
      if (data.phone !== undefined) {
        updateData.searchPhone = data.phone ? data.phone.replace(/\D/g, '') : '';
      }
      
      await updateDoc(doc(db, CLIENTS_COLLECTION, id), updateData);
    } catch (error: any) {
      console.error('Error actualizando cliente:', error);
      // En offline, puede que se haya guardado en cache
      if (!navigator.onLine) {
        console.warn('Modo offline: actualización puede haberse guardado en cache');
        return; // No lanzar error en offline
      }
      throw new Error(error.message || 'No se pudo actualizar el cliente');
    }
  },

    // Eliminar cliente
  async delete(id: string): Promise<void> {
    if (!id) {
      throw new Error("Client ID is required");
    }

    try {
      await deleteDoc(doc(db, CLIENTS_COLLECTION, id));
    } catch (error: any) {
      console.error("Error deleting client:", error);
      throw new Error(error.message || "Failed to delete client");
    }
  },


  async searchByName(term: string, pageSize = 20): Promise<{ clients: Client[] }> {
    if (!term || term.trim().length < 2) {
      return { clients: [] };
    }

    const searchTerm = term.trim().toLowerCase();
    const isPhone = /^\d+$/.test(searchTerm);
    
    try {
      let querySnapshot;
      
      if (isPhone) {
        // Consulta simple sin orderBy para evitar índices compuestos
        const q = query(
          collection(db, CLIENTS_COLLECTION),
          where("searchPhone", ">=", searchTerm),
          where("searchPhone", "<=", searchTerm + "\uf8ff"),
          limit(pageSize * 2) // Obtener más para compensar
        );
        querySnapshot = await getDocs(q);
      } else {
        // Consulta simple sin orderBy para evitar índices compuestos
        const q = query(
          collection(db, CLIENTS_COLLECTION),
          where("searchName", ">=", searchTerm),
          where("searchName", "<=", searchTerm + "\uf8ff"),
          limit(pageSize * 2) // Obtener más para compensar
        );
        querySnapshot = await getDocs(q);
      }
      
      // Normalizar cada cliente
      let clients = querySnapshot.docs.map(doc => 
        normalizeClientData(doc.data(), doc.id)
      );
      
      // Ordenar en memoria (por searchPhone o searchName según corresponda)
      if (isPhone) {
        clients = clients.sort((a, b) => {
          const aPhone = (a.phone || '').toLowerCase();
          const bPhone = (b.phone || '').toLowerCase();
          return aPhone.localeCompare(bPhone);
        });
      } else {
        clients = clients.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          return aName.localeCompare(bName);
        });
      }
      
      // Limitar al tamaño de página solicitado
      return { clients: clients.slice(0, pageSize) };
    } catch (error: any) {
      console.error("Error en búsqueda optimizada:", error);
      return await searchFallback(searchTerm, pageSize);
    }
  },

  // Obtener TODOS los clientes con normalización
  async getAll(): Promise<Client[]> {
    try {
      const q = query(
        collection(db, CLIENTS_COLLECTION),
        orderBy("name"),
        limit(2000)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => 
        normalizeClientData(doc.data(), doc.id)
      );
    } catch (error: any) {
      console.error("Error obteniendo todos los clientes:", error);
      
      if (error.code === 'failed-precondition') {
        const q = query(
          collection(db, CLIENTS_COLLECTION),
          limit(2000)
        );
        
        const snapshot = await getDocs(q);
        const clients = snapshot.docs.map(doc => 
          normalizeClientData(doc.data(), doc.id)
        );
        
        return clients.sort((a, b) => a.name.localeCompare(b.name));
      }
      
      return [];
    }
  },

  // Obtener uno por ID con normalización
  async getById(id: string): Promise<Client | null> {
    const snap = await getDoc(doc(db, CLIENTS_COLLECTION, id));
    if (!snap.exists()) return null;
    
    return normalizeClientData(snap.data(), snap.id);
  },


  // Añadir puntos y gasto
  async addPointsAndSpent(clientId: string | null, amountSpent: number): Promise<void> {
    if (!clientId || clientId === "contado") return;
    
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    
    if (!clientSnap.exists()) return;
    
    const pointsEarned = Math.floor(amountSpent / 100);
    
    await updateDoc(clientRef, {
      points: increment(pointsEarned),
      totalSpent: increment(amountSpent),
      purchaseCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  },

  // Obtener historial de compras del cliente
  async getPurchaseHistory(clientId: string): Promise<Array<{
    id: string;
    items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      variant?: {
        color: string;
        size: string;
        sku?: string;
      };
    }>;
    total: number;
    paymentMethod: 'cash' | 'card' | 'transfer';
    timestamp: Date;
    pointsEarned?: number;
  }>> {
    try {
      const salesCollection = collection(db, 'sales');
      const q = query(
        salesCollection,
        where('clientId', '==', clientId),
        where('status', '==', 'completed'),
        orderBy('timestamp', 'desc'),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        
        return {
          id: doc.id,
          items: data.items || [],
          total: data.total || 0,
          paymentMethod: data.paymentMethod || 'cash',
          timestamp,
          pointsEarned: data.pointsEarned || 0,
        };
      });
    } catch (error) {
      console.error('Error obteniendo historial de compras:', error);
      // Si falla por falta de índice, intentar sin orderBy
      try {
        const salesCollection = collection(db, 'sales');
        const q = query(
          salesCollection,
          where('clientId', '==', clientId),
          where('status', '==', 'completed'),
          limit(100)
        );
        
        const snapshot = await getDocs(q);
        const sales = snapshot.docs.map(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          
          return {
            id: doc.id,
            items: data.items || [],
            total: data.total || 0,
            paymentMethod: data.paymentMethod || 'cash',
            timestamp,
            pointsEarned: data.pointsEarned || 0,
          };
        });
        
        // Ordenar manualmente por fecha
        return sales.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      } catch (fallbackError) {
        console.error('Error en fallback de historial:', fallbackError);
        return [];
      }
    }
  },

  // Crear o actualizar cliente (útil para pedidos online)
  async createOrUpdate(data: { name: string; phone: string; email?: string }): Promise<string> {
    if (!data.name.trim() || !data.phone.trim()) {
      throw new Error('Nombre y teléfono son obligatorios');
    }

    // Buscar cliente existente por teléfono
    const phoneNormalized = data.phone.replace(/\D/g, '');
    const searchResult = await this.searchByName(phoneNormalized, 1);
    
    if (searchResult.clients.length > 0) {
      // Cliente existe, actualizar
      const existing = searchResult.clients[0];
      const updateData: ClientUpdate = {
        name: data.name.trim(),
        phone: data.phone.trim(),
      };
      if (data.email && data.email.trim()) {
        updateData.email = data.email.trim();
      }
      await this.update(existing.id, updateData);
      return existing.id;
    } else {
      // Cliente nuevo, crear
      return await this.create({
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || '',
        taxId: '',
      });
    }
  },
};
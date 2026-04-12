// src/services/apartadoService.ts
import { 
  collection, doc, addDoc, updateDoc, getDoc, getDocs, 
  query, serverTimestamp, Timestamp, where, writeBatch, limit
} from "firebase/firestore";
import { db } from "../firebase/config";
import type { Apartado, ApartadoCreate, Payment } from "../types/Apartado";
import type { PaymentMethod as ApartadoPaymentMethod } from "../types/Apartado";
import type { PaymentMethod } from "../services/saleService";
import { SaleService } from "./saleService";
import { ProductService } from "./productService";
import type { Variant } from "../types/Product";

const APARTADOS_COLLECTION = "apartados";

/** Apartado permite "other"; ventas solo cash|card|transfer. */
function toSalePaymentMethod(m: ApartadoPaymentMethod | undefined): PaymentMethod {
  if (!m || m === "other") return "cash";
  return m;
}

function normalizeApartadoData(data: any, id: string): Apartado {
  return {
    id,
    clientId: data.clientId || null,
    clientName: data.clientName || "",
    clientPhone: data.clientPhone || "",
    productDescription: data.productDescription || "",
    price: typeof data.price === 'number' ? data.price : 0,
    payments: Array.isArray(data.payments) ? data.payments : [],
    dueDate: data.dueDate || null,
    status: data.status || 'active',
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

// Calcular fecha de vencimiento (21 días desde hoy)
function calculateDueDate(): any {
  const date = new Date();
  date.setDate(date.getDate() + 21);
  return Timestamp.fromDate(date);
}

export const apartadoService = {
  // Crear apartado o agregar artículos a apartado existente
  async create(data: ApartadoCreate, existingApartadoId?: string): Promise<string> {
    // Si se pasa un apartado existente, agregar artículos a ese apartado
    if (existingApartadoId) {
      await this.addItemsToApartado(
        existingApartadoId,
        data.productDescription,
        data.price,
        data.initialPayment || 0,
        toSalePaymentMethod(data.initialPaymentMethod),
        data.cartItems || []
      );
      return existingApartadoId;
    }
    
    // Verificar si el cliente ya tiene un apartado activo (solo si no se pasó uno)
    if (data.clientId) {
      try {
        // Agregar timeout para evitar que se quede colgado en offline
        const timeoutPromise = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout verificando apartado existente')), 3000)
        );
        
        const existingApartado = await Promise.race([
          this.getActiveByClientId(data.clientId),
          timeoutPromise
        ]) as Apartado | null;
        
        if (existingApartado) {
          // Si tiene un apartado activo, agregar artículos a ese apartado
          await this.addItemsToApartado(
            existingApartado.id,
            data.productDescription,
            data.price,
            data.initialPayment || 0,
            toSalePaymentMethod(data.initialPaymentMethod),
            data.cartItems || []
          );
          return existingApartado.id;
        }
      } catch (error) {
        // Si falla la verificación (timeout o error), continuar creando nuevo apartado
        console.warn('No se pudo verificar apartado existente, creando nuevo:', error);
      }
    }
    
    // Si no tiene apartado activo, crear uno nuevo
    const isOnline = navigator.onLine;
    const now = isOnline ? serverTimestamp() : Timestamp.now();
    const dueDate = calculateDueDate();
    
    const payments: Payment[] = [];
    if (data.initialPayment && data.initialPayment > 0) {
      // Usar Timestamp.fromDate en lugar de serverTimestamp() para arrays
      const paymentDate = Timestamp.fromDate(new Date());
      payments.push({
        id: `payment-${Date.now()}`,
        amount: data.initialPayment,
        date: paymentDate,
        createdAt: paymentDate,
        paymentMethod: data.initialPaymentMethod || 'cash',
      });
    }
    
    // Disminuir stock de los productos apartados
    if (data.cartItems && data.cartItems.length > 0) {
      try {
        await this.decrementStockForApartado(data.cartItems);
      } catch (error) {
        console.error('Error actualizando stock al crear apartado:', error);
        throw new Error('No se pudo actualizar el stock de los productos');
      }
    }
    
    try {
      const docRef = await addDoc(collection(db, APARTADOS_COLLECTION), {
        clientId: data.clientId || null,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        productDescription: data.productDescription,
        price: data.price,
        payments,
        dueDate,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      return docRef.id;
    } catch (error: any) {
      console.error('Error creando apartado:', error);
      // En offline, puede que se haya guardado en cache
      if (!navigator.onLine && error.message?.includes('Timeout')) {
        // Generar ID temporal para que la UI continúe
        return `temp-apartado-${Date.now()}`;
      }
      throw new Error(error.message || 'No se pudo crear el apartado');
    }
  },

  // Obtener apartado activo por ID de cliente
  async getActiveByClientId(clientId: string): Promise<Apartado | null> {
    try {
      const q = query(
        collection(db, APARTADOS_COLLECTION),
        where("clientId", "==", clientId),
        where("status", "==", "active"),
        limit(1) // Limitar a 1 para ser más rápido
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      
      // Debería haber solo uno, tomar el primero
      const doc = snapshot.docs[0];
      return normalizeApartadoData(doc.data(), doc.id);
    } catch (error) {
      console.error("Error obteniendo apartado activo del cliente:", error);
      // En offline, retornar null en lugar de lanzar error
      return null;
    }
  },

  // Agregar artículos a un apartado existente
  async addItemsToApartado(
    apartadoId: string,
    newProductDescription: string,
    newPrice: number,
    additionalPayment: number,
    paymentMethod: PaymentMethod,
    cartItems: Array<{ productId: string; quantity: number; variant?: { color: string; size: string } }>
  ): Promise<void> {
    const apartadoRef = doc(db, APARTADOS_COLLECTION, apartadoId);
    const apartadoSnap = await getDoc(apartadoRef);
    
    if (!apartadoSnap.exists()) {
      throw new Error("Apartado no encontrado");
    }
    
    const apartado = normalizeApartadoData(apartadoSnap.data(), apartadoSnap.id);
    
    // Actualizar descripción de productos (agregar los nuevos)
    const updatedDescription = apartado.productDescription 
      ? `${apartado.productDescription}, ${newProductDescription}`
      : newProductDescription;
    
    // Actualizar precio total
    const updatedPrice = apartado.price + newPrice;
    
    // Disminuir stock de los nuevos productos
    if (cartItems.length > 0) {
      try {
        await this.decrementStockForApartado(cartItems);
      } catch (error) {
        console.error('Error actualizando stock al agregar artículos:', error);
        throw new Error('No se pudo actualizar el stock de los productos');
      }
    }
    
    // Agregar pago adicional si existe
    const updatedPayments = [...apartado.payments];
    if (additionalPayment > 0) {
      const paymentDate = Timestamp.fromDate(new Date());
      updatedPayments.push({
        id: `payment-${Date.now()}`,
        amount: additionalPayment,
        date: paymentDate,
        createdAt: paymentDate,
        paymentMethod: paymentMethod || 'cash',
      });
    }
    
    // Actualizar el apartado (mantener la fecha de vencimiento original)
    await updateDoc(apartadoRef, {
      productDescription: updatedDescription,
      price: updatedPrice,
      payments: updatedPayments,
      updatedAt: serverTimestamp(),
    });
  },

  // Disminuir stock para apartado
  async decrementStockForApartado(cartItems: Array<{ productId: string; quantity: number; variant?: { color: string; size: string } }>): Promise<void> {
    const updatePromises = cartItems.map(async (item) => {
      if (item.variant) {
        // Crear un objeto Variant mínimo para el método
        const variantForStock = {
          color: item.variant.color,
          size: item.variant.size,
          stock: 0, // No se usa en decrementVariantStock
          sku: undefined,
          colorCode: undefined,
          barcode: undefined,
        } as any;
        
        // Usar el método de SaleService para variantes
        return SaleService.decrementVariantStock(
          item.productId,
          variantForStock,
          item.quantity
        );
      } else {
        // Usar el método de SaleService para productos sin variantes
        return SaleService.decrementProductStock(item.productId, item.quantity);
      }
    });

    await Promise.all(updatePromises);
    console.log('Stock actualizado para apartado');
  },

  // Restaurar stock cuando un apartado expira
  async restoreStockForApartado(cartItems: Array<{ productId: string; quantity: number; variant?: { color: string; size: string } }>): Promise<void> {
    const batch = writeBatch(db);
    
    for (const item of cartItems) {
      if (item.variant) {
        // Restaurar stock de variante
        const variantsRef = collection(db, 'products', item.productId, 'variants');
        const variantsSnap = await getDocs(variantsRef);
        
        for (const variantDoc of variantsSnap.docs) {
          const variantData = variantDoc.data();
          const colorMatch = variantData.color === item.variant.color || variantData.colorCode === item.variant.color;
          
          if (colorMatch) {
            const sizesRef = collection(db, 'products', item.productId, 'variants', variantDoc.id, 'sizes');
            const sizesSnap = await getDocs(sizesRef);
            
            for (const sizeDoc of sizesSnap.docs) {
              const sizeData = sizeDoc.data();
              if (sizeData.size === item.variant.size) {
                const sizeRef = doc(db, 'products', item.productId, 'variants', variantDoc.id, 'sizes', sizeDoc.id);
                const currentStock = Number(sizeData.stock) || 0;
                batch.update(sizeRef, { stock: currentStock + item.quantity });
                break;
              }
            }
            break;
          }
        }
      } else {
        // Restaurar stock de producto sin variantes
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = Number(productSnap.data().stock) || 0;
          batch.update(productRef, { stock: currentStock + item.quantity });
        }
      }
    }
    
    await batch.commit();
    console.log('Stock restaurado para apartado expirado');
  },

  // Verificar y expirar apartados vencidos
  async checkAndExpireApartados(): Promise<void> {
    try {
      const q = query(
        collection(db, APARTADOS_COLLECTION),
        where("status", "==", "active")
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();
      const batch = writeBatch(db);
      let expiredCount = 0;
      
      for (const docSnap of snapshot.docs) {
        const apartado = normalizeApartadoData(docSnap.data(), docSnap.id);
        if (apartado.dueDate) {
          const dueDate = apartado.dueDate.toDate ? apartado.dueDate.toDate() : new Date(apartado.dueDate);
          if (dueDate < now && apartado.status === 'active') {
            const apartadoRef = doc(db, APARTADOS_COLLECTION, docSnap.id);
            batch.update(apartadoRef, {
              status: 'expired',
              updatedAt: serverTimestamp(),
            });
            expiredCount++;
            
            // TODO: Restaurar stock cuando se implemente el almacenamiento de cartItems en apartados
            // Por ahora, el stock se restaura manualmente o se puede implementar después
          }
        }
      }
      
      if (expiredCount > 0) {
        await batch.commit();
        console.log(`${expiredCount} apartado(s) expirado(s)`);
      }
    } catch (error) {
      console.error('Error verificando apartados expirados:', error);
    }
  },

  // Obtener todos los apartados activos (no completados)
  async getAll(): Promise<Apartado[]> {
    // Verificar expiraciones antes de obtener
    await this.checkAndExpireApartados();
    
    try {
      // Consulta simple sin orderBy para evitar índices compuestos
      const q = query(
        collection(db, APARTADOS_COLLECTION),
        where("status", "!=", "completed")
      );
      
      const snapshot = await getDocs(q);
      const apartados = snapshot.docs.map(doc => 
        normalizeApartadoData(doc.data(), doc.id)
      );
      
      // Ordenar en memoria por createdAt descendente
      return apartados.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
    } catch (error: any) {
      console.error("Error obteniendo apartados:", error);
      return [];
    }
  },

  // Obtener apartado por ID
  async getById(id: string): Promise<Apartado | null> {
    const snap = await getDoc(doc(db, APARTADOS_COLLECTION, id));
    if (!snap.exists()) return null;
    
    return normalizeApartadoData(snap.data(), snap.id);
  },

  // Función auxiliar para parsear la descripción de productos y crear items de carrito
  async parseProductDescriptionToCartItems(
    productDescription: string,
    totalPrice: number
  ): Promise<Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    variant?: Variant;
  }>> {
    if (!productDescription) {
      // Si no hay descripción, crear un item genérico
      return [{
        productId: 'apartado-generic',
        name: 'Productos del apartado',
        price: totalPrice,
        quantity: 1
      }];
    }

    // Cargar todos los productos para buscar por nombre
    const allProducts = await ProductService.loadAllProducts(true);
    
    const items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      variant?: Variant;
    }> = [];
    
    // Parsear la descripción: formato "2x Producto - Color - Talla, 1x Otro Producto"
    const parts = productDescription.split(',').map(p => p.trim()).filter(p => p);
    
    // Calcular precio por item (distribuir el total proporcionalmente)
    let totalQuantity = 0;
    const parsedItems: Array<{ quantity: number; name: string; color?: string; size?: string }> = [];
    
    for (const part of parts) {
      const match = part.match(/^(\d+)x\s+(.+)$/);
      if (match) {
        const quantity = parseInt(match[1], 10);
        const productPart = match[2].trim();
        totalQuantity += quantity;
        
        const productParts = productPart.split(' - ').map(p => p.trim());
        if (productParts.length >= 3) {
          // Tiene color y talla
          parsedItems.push({
            quantity,
            name: productParts.slice(0, -2).join(' - '),
            color: productParts[productParts.length - 2],
            size: productParts[productParts.length - 1],
          });
        } else {
          // Solo tiene nombre
          parsedItems.push({
            quantity,
            name: productPart,
          });
        }
      }
    }
    
    // Buscar productos y crear items de carrito
    for (const parsedItem of parsedItems) {
      // Buscar producto por nombre (coincidencia parcial)
      const foundProduct = allProducts.find(p => 
        p.name.toLowerCase().includes(parsedItem.name.toLowerCase()) ||
        parsedItem.name.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (foundProduct) {
        let variant: Variant | undefined;
        
        // Si tiene color y talla, buscar la variante
        if (parsedItem.color && parsedItem.size && foundProduct.variants) {
          variant = foundProduct.variants.find(v => 
            v.color?.toLowerCase() === parsedItem.color?.toLowerCase() &&
            v.size === parsedItem.size
          );
        }
        
        // Calcular precio por item (distribuir proporcionalmente)
        const itemPrice = totalPrice / totalQuantity;
        
        items.push({
          productId: foundProduct.id,
          name: foundProduct.name,
          price: itemPrice * parsedItem.quantity,
          quantity: parsedItem.quantity,
          variant: variant ? {
            color: variant.color,
            size: variant.size,
            stock: variant.stock,
            sku: variant.sku,
            colorCode: variant.colorCode,
            barcode: variant.barcode
          } : undefined
        });
      } else {
        // Si no se encuentra el producto, crear item genérico
        const itemPrice = totalPrice / totalQuantity;
        items.push({
          productId: 'apartado-unknown',
          name: parsedItem.name,
          price: itemPrice * parsedItem.quantity,
          quantity: parsedItem.quantity,
          variant: parsedItem.color && parsedItem.size ? {
            color: parsedItem.color,
            size: parsedItem.size,
            stock: 0,
            sku: undefined,
            colorCode: undefined,
            barcode: undefined
          } : undefined
        });
      }
    }
    
    return items;
  },

  // Liquidar saldo final (completar apartado)
  async liquidate(
    apartadoId: string, 
    paymentMethod?: PaymentMethod,
    userName?: string
  ): Promise<void> {
    const apartadoRef = doc(db, APARTADOS_COLLECTION, apartadoId);
    const apartadoSnap = await getDoc(apartadoRef);
    
    if (!apartadoSnap.exists()) {
      throw new Error("Apartado no encontrado");
    }
    
    const apartado = normalizeApartadoData(apartadoSnap.data(), apartadoSnap.id);
    const totalPaid = apartado.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = apartado.price - totalPaid;
    
    if (remaining <= 0) {
      throw new Error("El apartado ya está completamente pagado");
    }
    
    // Agregar el pago final
    const paymentDate = Timestamp.fromDate(new Date());
    const finalPayment: Payment = {
      id: `payment-${Date.now()}`,
      amount: remaining,
      date: paymentDate,
      createdAt: paymentDate,
      paymentMethod: paymentMethod || 'cash',
    };
    
    const updatedPayments = [...apartado.payments, finalPayment];
    
    // Actualizar el apartado a completado
    await updateDoc(apartadoRef, {
      payments: updatedPayments,
      status: 'completed',
      updatedAt: serverTimestamp(),
    });
    
    // Registrar la venta y generar puntos
    try {
      // Parsear la descripción de productos para crear items de carrito
      const cartItems = await this.parseProductDescriptionToCartItems(
        apartado.productDescription,
        apartado.price
      );
      
      // Registrar la venta sin actualizar stock (ya fue decrementado al crear el apartado)
      await SaleService.processSale(
        cartItems,
        apartado.price,
        paymentMethod || 'cash',
        apartado.price.toFixed(2), // cashReceived = total del apartado
        apartado.clientId || null,
        apartado.clientName,
        userName,
        true // skipStockUpdate = true porque el stock ya fue decrementado
      );
      
      console.log(`Apartado ${apartadoId} liquidado y registrado como venta`);
    } catch (error) {
      console.error('Error registrando venta al liquidar apartado:', error);
      // No fallar la liquidación si falla el registro de venta, solo loguear
    }
  },

  // Verificar si un apartado está completamente pagado y actualizar status
  async checkAndUpdateStatus(apartadoId: string): Promise<void> {
    const apartadoRef = doc(db, APARTADOS_COLLECTION, apartadoId);
    const apartadoSnap = await getDoc(apartadoRef);
    
    if (!apartadoSnap.exists()) return;
    
    const apartado = normalizeApartadoData(apartadoSnap.data(), apartadoSnap.id);
    const totalPaid = apartado.payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Si está completamente pagado, cambiar status a completed
    if (totalPaid >= apartado.price && apartado.status !== 'completed') {
      await updateDoc(apartadoRef, {
        status: 'completed',
        updatedAt: serverTimestamp(),
      });
    }
  },

  // Agregar abono a un apartado
  async addPayment(apartadoId: string, amount: number, paymentMethod?: PaymentMethod): Promise<void> {
    const apartadoRef = doc(db, APARTADOS_COLLECTION, apartadoId);
    const apartadoSnap = await getDoc(apartadoRef);
    
    if (!apartadoSnap.exists()) {
      throw new Error("Apartado no encontrado");
    }
    
    const apartado = normalizeApartadoData(apartadoSnap.data(), apartadoSnap.id);
    const totalPaid = apartado.payments.reduce((sum, p) => sum + p.amount, 0);
    const newTotal = totalPaid + amount;
    
    // Validar que el monto no exceda el restante
    const remaining = apartado.price - totalPaid;
    if (amount > remaining) {
      throw new Error(`El monto del abono ($${amount.toFixed(2)}) no puede exceder el restante ($${remaining.toFixed(2)})`);
    }
    
    // Usar Timestamp.fromDate en lugar de serverTimestamp() para arrays
    const paymentDate = Timestamp.fromDate(new Date());
    const newPayment: Payment = {
      id: `payment-${Date.now()}`,
      amount,
      date: paymentDate,
      createdAt: paymentDate,
      paymentMethod: paymentMethod || 'cash',
    };
    
    const updatedPayments = [...apartado.payments, newPayment];
    const newStatus = newTotal >= apartado.price ? 'completed' : apartado.status;
    
    await updateDoc(apartadoRef, {
      payments: updatedPayments,
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
  },

  // Actualizar apartado
  async update(id: string, data: Partial<ApartadoCreate>): Promise<void> {
    await updateDoc(doc(db, APARTADOS_COLLECTION, id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  },

  // Obtener apartados activos
  async getActive(): Promise<Apartado[]> {
    try {
      // Consulta simple sin orderBy para evitar índices compuestos
      const q = query(
        collection(db, APARTADOS_COLLECTION),
        where("status", "==", "active")
      );
      
      const snapshot = await getDocs(q);
      const apartados = snapshot.docs.map(doc => 
        normalizeApartadoData(doc.data(), doc.id)
      );
      
      // Ordenar en memoria por createdAt descendente
      return apartados.sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(0);
        const bDate = b.createdAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
    } catch (error: any) {
      console.error("Error obteniendo apartados activos:", error);
      return [];
    }
  },

  // Obtener apartados completados (pagados)
  async getCompleted(): Promise<Apartado[]> {
    try {
      // Consulta simple sin orderBy para evitar índices compuestos
      const q = query(
        collection(db, APARTADOS_COLLECTION),
        where("status", "==", "completed")
      );
      
      const snapshot = await getDocs(q);
      const apartados = snapshot.docs.map(doc => 
        normalizeApartadoData(doc.data(), doc.id)
      );
      
      // Ordenar en memoria por updatedAt descendente
      return apartados.sort((a, b) => {
        const aDate = a.updatedAt?.toDate?.() || new Date(0);
        const bDate = b.updatedAt?.toDate?.() || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
    } catch (error: any) {
      console.error("Error obteniendo apartados completados:", error);
      
      // Fallback sin ordenamiento si no hay índice
      if (error.code === 'failed-precondition') {
        const snapshot = await getDocs(collection(db, APARTADOS_COLLECTION));
        const apartados = snapshot.docs
          .map(doc => normalizeApartadoData(doc.data(), doc.id))
          .filter(apartado => apartado.status === 'completed');
        
        return apartados.sort((a, b) => {
          const aDate = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const bDate = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
      }
      
      return [];
    }
  },
};


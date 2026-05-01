// src/services/pickupOrderService.ts
import { collection, getDocs, updateDoc, doc, getDoc, query, orderBy, where, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CartItem } from '../types/Cart';
import { NotificationService } from './notificationService';
import { clientService } from './clientService';
import { enqueueOperation, saveLocalPickup } from '../lib/offlineOutbox';
import type { OutboxOperation } from '../types/SyncContracts';

export type PickupOrderStatus = 'pending' | 'packed' | 'paid' | 'delivered';

export interface PickupOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  notes?: string;
  pickupDate: string;
  pickupTimeSlot: string;
  items: CartItem[];
  total: number;
}

export interface PickupOrder extends PickupOrderInput {
  id: string;
  status: PickupOrderStatus;
  paymentStatus: 'pending_in_store' | 'paid';
  createdAt: unknown;
}

export class PickupOrderService {
  private static collectionRef = collection(db, 'onlinePickupOrders');
  private static createId(prefix: string): string {
    const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    return `${prefix}-${Date.now()}-${random}`;
  }

  private static buildOutboxOperation(
    type: OutboxOperation['type'],
    entityId: string,
    payload: Record<string, unknown>,
    idempotencyKey: string
  ): OutboxOperation {
    const now = Date.now();
    return {
      id: this.createId('op'),
      type,
      entityId,
      payload,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
      status: 'pending',
      retryCount: 0,
      nextRetryAt: now,
    };
  }

  static async createOrder(input: PickupOrderInput): Promise<string> {
    if (!input.customerName.trim()) throw new Error('El nombre del cliente es obligatorio.');
    if (!input.customerPhone.trim()) throw new Error('El teléfono del cliente es obligatorio.');
    if (!input.pickupDate) throw new Error('La fecha de recogida es obligatoria.');
    if (!input.pickupTimeSlot) throw new Error('El horario de recogida es obligatorio.');
    if (!input.items?.length) throw new Error('El carrito está vacío.');

    const orderData: Record<string, unknown> = {
      customerName: input.customerName.trim(),
      customerPhone: input.customerPhone.trim(),
      pickupDate: input.pickupDate,
      pickupTimeSlot: input.pickupTimeSlot,
      items: input.items,
      total: input.total,
      status: 'pending' as PickupOrderStatus,
      paymentStatus: 'pending_in_store',
      createdAt: serverTimestamp(),
    };
    if (input.customerEmail?.trim()) orderData.customerEmail = input.customerEmail.trim();
    if (input.notes?.trim()) orderData.notes = input.notes.trim();

    const orderId = this.createId('pickup');
    await setDoc(doc(db, 'onlinePickupOrders', orderId), orderData, { merge: true });
    const idempotencyKey = this.createId('idem');
    await saveLocalPickup(orderId, orderData, navigator.onLine ? 'syncing' : 'pending');
    await enqueueOperation(
      this.buildOutboxOperation('PICKUP_CREATE', orderId, orderData, idempotencyKey)
    );

    try {
      await clientService.createOrUpdate({
        name: input.customerName.trim(),
        phone: input.customerPhone.trim(),
        email: input.customerEmail?.trim() || '',
      });
    } catch {
      /* */
    }

    let emailNotificationResult: { emailSent: boolean; emailError?: string } | null = null;
    try {
      emailNotificationResult = await NotificationService.notifyOrderReceived(
        input.customerName.trim(),
        input.customerPhone.trim(),
        input.customerEmail?.trim(),
        orderId,
        {
          orderItems: input.items,
          total: input.total,
          pickupDate: input.pickupDate,
          pickupTimeSlot: input.pickupTimeSlot,
        }
      );
    } catch {
      /* */
    }

    if (emailNotificationResult) {
      try {
        await updateDoc(doc(db, 'onlinePickupOrders', orderId), {
          emailSent: emailNotificationResult.emailSent,
          emailError: emailNotificationResult.emailError || null,
          emailSentAt: emailNotificationResult.emailSent ? serverTimestamp() : null,
        });
      } catch {
        /* */
      }
    }
    return orderId;
  }

  static async getAllOrders(): Promise<PickupOrder[]> {
    const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PickupOrder));
  }

  static async getOrdersByStatus(status: PickupOrderStatus): Promise<PickupOrder[]> {
    const q = query(this.collectionRef, where('status', '==', status));
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PickupOrder));
    orders.sort((a, b) => {
      const aDate = (a.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(0);
      const bDate = (b.createdAt as { toDate?: () => Date })?.toDate?.() || new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
    return orders;
  }

  static async updateOrderStatus(orderId: string, status: PickupOrderStatus): Promise<void> {
    const orderRef = doc(db, 'onlinePickupOrders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Pedido no encontrado');
    const orderData = orderSnap.data() as PickupOrder;
    await updateDoc(orderRef, { status, updatedAt: serverTimestamp() });
    await enqueueOperation(
      this.buildOutboxOperation(
        'PICKUP_UPDATE_STATUS',
        orderId,
        { status, updatedAt: Date.now() },
        this.createId('idem')
      )
    );
    try {
      if (status === 'packed') {
        await NotificationService.notifyOrderPacked(orderData.customerName, orderData.customerEmail, orderId, {
          orderItems: orderData.items,
          total: orderData.total,
        });
      } else if (status === 'delivered') {
        await NotificationService.notifyOrderDelivered(orderData.customerName, orderData.customerEmail, orderId, {
          orderItems: orderData.items,
          total: orderData.total,
        });
      }
    } catch {
      /* */
    }
  }

  static async markAsPaid(orderId: string): Promise<void> {
    const orderRef = doc(db, 'onlinePickupOrders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Pedido no encontrado');
    const orderData = orderSnap.data() as PickupOrder;
    await updateDoc(orderRef, { paymentStatus: 'paid', status: 'paid' as PickupOrderStatus });
    try {
      const clientId = await clientService.createOrUpdate({
        name: orderData.customerName,
        phone: orderData.customerPhone,
        email: orderData.customerEmail,
      });
      await clientService.addPointsAndSpent(clientId, orderData.total);
    } catch {
      /* */
    }
  }
}

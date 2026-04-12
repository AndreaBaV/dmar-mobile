// src/services/pickupOrderService.ts
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, query, orderBy, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CartItem } from '../types/Cart';
import { NotificationService } from './notificationService';
import { clientService } from './clientService';

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

    const docRef = await addDoc(this.collectionRef, orderData);
    const orderId = docRef.id;

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

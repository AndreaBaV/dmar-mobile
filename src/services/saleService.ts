/**
 * Servicio para procesamiento de ventas
 * 
 * @author Andrea Bahena
 * @description Maneja el procesamiento de ventas, actualización de stock y puntos de clientes
 */

import { collection, addDoc, doc, getDoc, updateDoc, getDocs, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { clientService } from './clientService';
import { ProductService } from './productService';
import { NotificationService } from './notificationService';
import type { Variant } from '../types/Product';
import { normalizeColor, normalizeSize } from '../utils/normalizeFilters';

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Variant;
}

export type PaymentMethod = 'cash' | 'card' | 'transfer';

interface SaleRecord {
  items: Array<{
    productId: string;
    name: string;
    price: number;
    quantity: number;
    partnerId?: string;
    purchasePrice?: number;
    variant?: {
      color: string;
      size: string;
      sku?: string;
    };
  }>;
  total: number;
  paymentMethod: PaymentMethod;
  cashReceived?: string;
  change?: number;
  timestamp: any;
  status: 'completed' | 'cancelled';
  clientId?: string | null;
  clientName?: string;
  pointsEarned?: number;
  userName?: string;
  printStatus?: 'pending' | 'printing' | 'printed' | 'error';
  printTriggeredBy?: string;
  origin?: 'mobile_app' | 'desktop_app';
}

export class SaleService {
  // Función auxiliar para normalizar texto (sin acentos, minúsculas, sin espacios extra)
  private static normalizeText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  static async processSale(
    cart: CartItem[],
    total: number,
    paymentMethod: PaymentMethod,
    cashReceived?: string | null,
    clientId?: string | null,
    clientName?: string,
    userName?: string,
    skipStockUpdate?: boolean
  ): Promise<string> {
    if (cart.length === 0) {
      throw new Error('El carrito está vacío');
    }

    let change = 0;
    if (paymentMethod === 'cash') {
      if (!cashReceived) {
        throw new Error('El monto recibido es requerido para pagos en efectivo');
      }
      const cash = parseFloat(cashReceived);
      change = cash - total;

      if (isNaN(cash) || cash < total) {
        throw new Error('El monto recibido es insuficiente');
      }
    }

    const pointsEarned = clientId && clientId !== "contado" 
      ? Math.floor(total / 100) 
      : 0;
    
    try {
      const isOnline = navigator.onLine;
      const products = await ProductService.loadAllProducts(isOnline);
      const productMap = new Map(products.map(p => [p.id, p]));
      const timestamp = isOnline ? serverTimestamp() : Timestamp.now();
      
      const saleData: SaleRecord = {
        items: cart.map(item => {
          const product = productMap.get(item.productId);
          const itemData: any = {
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          };
          
          if (product?.partnerId) {
            itemData.partnerId = product.partnerId;
          }
          
          if (item.variant && (item.variant as any).purchasePrice) {
            itemData.purchasePrice = (item.variant as any).purchasePrice;
          }
          
          if (item.variant) {
            itemData.variant = {
              color: item.variant.color,
              size: item.variant.size,
            };
            if (item.variant.sku) {
              itemData.variant.sku = item.variant.sku;
            }
          }
          
          return itemData;
        }),
        total,
        paymentMethod,
        ...(paymentMethod === 'cash' && cashReceived ? {
          cashReceived: parseFloat(cashReceived).toFixed(2),
          change: change
        } : {}),
        timestamp,
        status: 'completed',
        clientId: clientId || null,
        clientName: clientName || "Cliente de Contado",
        pointsEarned,
        userName: userName || 'Usuario',
        printStatus: 'pending', // 'pending', 'printing', 'printed', 'error'
        printTriggeredBy: userName, // Para saber quién lo mandó
        origin: 'mobile_app' // Para distinguir ventas de mostrador vs móviles
            
      };

      const saleDoc = await addDoc(collection(db, 'sales'), saleData);
      console.log('✅ Venta registrada:', saleDoc.id);

      // Actualizar stock
      if (!skipStockUpdate) {
        console.log('🔄 Actualizando stock...');
        
        try {
          for (const item of cart) {
            console.log(`📦 ${item.name} (qty: ${item.quantity})`);
            
            if (item.variant) {
              await this.decrementVariantStock(
                item.productId,
                item.variant,
                item.quantity
              );
            } else {
              await this.decrementProductStock(item.productId, item.quantity);
            }
            console.log(`  ✅ Stock actualizado`);
          }
          
          console.log('✅ Stock actualizado completamente');
        } catch (stockError) {
          console.error('❌ ERROR en stock:', stockError);
          const errorMsg = stockError instanceof Error ? stockError.message : 'Error desconocido';
          throw new Error(`Venta registrada pero ERROR en stock: ${errorMsg}\n\nID Venta: ${saleDoc.id}\n\nVerifica el stock manualmente.`);
        }
      }
      
      // Actualizar puntos
      if (clientId && clientId !== "contado") {
        try {
          await clientService.addPointsAndSpent(clientId, total);
          console.log(`✅ +${pointsEarned} puntos`);
        } catch (pointsError) {
          console.error('⚠️ Error en puntos:', pointsError);
        }
      }

      return saleDoc.id;
    } catch (error) {
      console.error('💥 Error procesando venta:', error);
      throw error;
    }
  }

  static async decrementVariantStock(
    productId: string,
    variant: Variant,
    quantity: number
  ): Promise<void> {
    try {
      if (variant.variantId && variant.sizeId) {
        const sizeRef = doc(db, 'products', productId, 'variants', variant.variantId, 'sizes', variant.sizeId);
        const snap = await getDoc(sizeRef);
        if (snap.exists()) {
          const currentStock = Number(snap.data()?.stock) || 0;
          const newStock = Math.max(0, currentStock - quantity);
          await updateDoc(sizeRef, { stock: newStock });
          return;
        }
      }

      const variantsRef = collection(db, 'products', productId, 'variants');
      const variantsSnap = await getDocs(variantsRef);

      if (variantsSnap.empty) {
        throw new Error(`No hay variantes para el producto ${productId}`);
      }

      /** Misma lógica que ProductService al mostrar variantes (color base + talla canónica). */
      const normalizedSearchColor = this.normalizeText(normalizeColor(variant.color || ''));
      const normalizedSearchSize = this.normalizeText(normalizeSize(variant.size || ''));

      console.log(`  Buscando: "${variant.color}" → "${normalizedSearchColor}" / "${variant.size}" → "${normalizedSearchSize}"`);

      for (const variantDoc of variantsSnap.docs) {
        const variantData = variantDoc.data();

        const normalizedDbColor = this.normalizeText(normalizeColor(String(variantData.color || variantData.Color || '')));
        const codeRaw = variantData.colorCode || variantData.hex || variantData.color_hex;
        const normalizedDbColorCode = codeRaw
          ? this.normalizeText(normalizeColor(String(codeRaw)))
          : '';

        const colorMatch =
          normalizedDbColor === normalizedSearchColor ||
          (normalizedDbColorCode !== '' && normalizedDbColorCode === normalizedSearchColor);

        if (colorMatch) {
          console.log(`  ✓ Color match: DB="${variantData.color}"`);

          const sizesRef = collection(db, 'products', productId, 'variants', variantDoc.id, 'sizes');
          const sizesSnap = await getDocs(sizesRef);

          for (const sizeDoc of sizesSnap.docs) {
            const sizeData = sizeDoc.data();
            const rawSize = sizeData.size || sizeData.talla || sizeData.Talla || '';
            const normalizedDbSize = this.normalizeText(normalizeSize(String(rawSize)));

            if (normalizedDbSize === normalizedSearchSize) {
              console.log(`  ✓ Talla match: DB="${sizeData.size}"`);

              const sizeRef = doc(db, 'products', productId, 'variants', variantDoc.id, 'sizes', sizeDoc.id);
              const currentStock = Number(sizeData.stock) || 0;
              const newStock = Math.max(0, currentStock - quantity);

              await updateDoc(sizeRef, { stock: newStock });

              console.log(`  Stock: ${currentStock} → ${newStock}`);
              return;
            }
          }
        }
      }

      throw new Error(`No se encontró: ${variant.color} / ${variant.size} en producto ${productId}`);
    } catch (error) {
      console.error('Error en decrementVariantStock:', error);
      throw error;
    }
  }

  static async decrementProductStock(
    productId: string,
    quantity: number
  ): Promise<void> {
    try {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);

      if (!productSnap.exists()) {
        throw new Error(`Producto ${productId} no encontrado`);
      }

      const currentStock = Number(productSnap.data().stock) || 0;
      const newStock = Math.max(0, currentStock - quantity);

      await updateDoc(productRef, { stock: newStock });
      
      console.log(`Stock: ${currentStock} → ${newStock}`);
    } catch (error) {
      console.error('Error actualizando stock:', error);
      throw error;
    }
  }

  static async sendTicketByEmail(
    saleId: string,
    clientEmail: string,
    cart: CartItem[],
    total: number,
    cashReceived: string,
    paymentMethod: PaymentMethod,
    userName: string
  ): Promise<void> {
    console.log(`[Email] Enviando ticket ${saleId} a ${clientEmail}`);
    
    try {
      const ticketHtml = this.generateTicketEmailHtml(
        saleId,
        cart,
        total,
        cashReceived,
        paymentMethod,
        userName
      );

      await NotificationService.sendTicketEmail(
        clientEmail,
        `Ticket de Venta #${saleId.substring(0, 8)} - D'Mar Tienda de Ropa`,
        ticketHtml
      );

      const saleRef = doc(db, 'sales', saleId);
      await setDoc(
        saleRef,
        {
          emailSent: true,
          emailSentTo: clientEmail,
          emailSentAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`[Email] Enviado exitosamente`);
    } catch (error) {
      console.error('Error enviando ticket:', error);
      try {
        const saleRef = doc(db, 'sales', saleId);
        await setDoc(
          saleRef,
          {
            emailSent: false,
            emailError: error instanceof Error ? error.message : 'Error desconocido',
            emailSentAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (updateError) {
        console.error('Error guardando info de email:', updateError);
      }
      throw error;
    }
  }

  /**
   * Misma plantilla que el ticket por correo; sirve para reimprimir desde el historial (p. ej. solo admin en móvil).
   */
  static getPrintableTicketHtmlForSale(sale: {
    id: string;
    items: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      variant?: { color: string; size: string; sku?: string };
    }>;
    total: number;
    paymentMethod: PaymentMethod;
    cashReceived?: string;
    userName?: string;
  }): string {
    const cart: CartItem[] = sale.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
      variant: i.variant
        ? {
            color: i.variant.color,
            size: i.variant.size,
            stock: 0,
            sku: i.variant.sku,
          }
        : undefined,
    }));
    return SaleService.generateTicketEmailHtml(
      sale.id,
      cart,
      sale.total,
      sale.cashReceived ?? sale.total.toFixed(2),
      sale.paymentMethod,
      sale.userName ?? 'Usuario'
    );
  }

  private static generateTicketEmailHtml(
    saleId: string,
    cart: CartItem[],
    total: number,
    cashReceived: string,
    paymentMethod: PaymentMethod,
    userName: string
  ): string {
    const date = new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const change = (parseFloat(cashReceived || '0') - total).toFixed(2);
    const paymentMethodLabels: Record<PaymentMethod, string> = {
      cash: 'EFECTIVO',
      card: 'TARJETA',
      transfer: 'TRANSFERENCIA'
    };

    const getBaseProductName = (name: string): string => {
      const parts = name.split(' - ');
      if (parts.length >= 3) {
        return parts.slice(0, -2).join(' - ');
      }
      return name;
    };

    let itemsHTML = '';
    cart.forEach((item) => {
      const unitPrice = item.price.toFixed(2);
      const subtotal = (item.price * item.quantity).toFixed(2);
      const baseName = getBaseProductName(item.name);
      const color = item.variant?.color || '-';
      const size = item.variant?.size || '-';
      itemsHTML += `
        <tr>
          <td style="text-align: center; padding: 5px; border-bottom: 1px solid #ddd;">${item.quantity}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd;">${baseName}</td>
          <td style="padding: 5px; border-bottom: 1px solid #ddd; font-size: 12px;">${color}</td>
          <td style="text-align: center; padding: 5px; border-bottom: 1px solid #ddd; font-size: 12px;">${size}</td>
          <td style="text-align: right; padding: 5px; border-bottom: 1px solid #ddd; font-size: 12px;">$ ${unitPrice}</td>
          <td style="text-align: right; padding: 5px; border-bottom: 1px solid #ddd; font-weight: bold;">$ ${subtotal}</td>
        </tr>
      `;
    });

    let paymentInfoHTML = '';
    if (paymentMethod === 'cash') {
      paymentInfoHTML = `
        <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px; border: 1px solid #000;">
          <div style="font-weight: bold; margin-bottom: 5px; font-size: 14px;">Método: ${paymentMethodLabels[paymentMethod]}</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
            <span>Recibido:</span>
            <span>$ ${cashReceived || '0.00'}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Cambio:</span>
            <span>$ ${change}</span>
          </div>
        </div>
      `;
    } else {
      paymentInfoHTML = `
        <div style="margin-top: 15px; padding: 10px; background: #f0f0f0; border-radius: 5px; border: 1px solid #000;">
          <div style="font-weight: bold; font-size: 14px;">Método: ${paymentMethodLabels[paymentMethod]}</div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .ticket-container {
            background: #fff;
            border: 2px solid #000;
            border-radius: 8px;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          .business-name {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 1px;
          }
          .business-info {
            font-size: 14px;
            color: #666;
          }
          .sale-id {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th {
            background: #f0f0f0;
            padding: 8px;
            text-align: left;
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            border-bottom: 2px solid #000;
          }
          .total-row {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #000;
            font-size: 18px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
          }
          .cashier-info {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .footer {
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="ticket-container">
          <div class="header">
            <div class="business-name">D'MAR TIENDA DE ROPA</div>
            <div class="business-info">${date}</div>
            <div class="sale-id">ID Venta: ${saleId.substring(0, 8)}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="text-align: center;">CANT</th>
                <th>PRODUCTO</th>
                <th>COLOR</th>
                <th style="text-align: center;">TALLA</th>
                <th style="text-align: right;">UNITARIO</th>
                <th style="text-align: right;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
          
          <div class="total-row">
            <span>TOTAL:</span>
            <span>$ ${total.toFixed(2)}</span>
          </div>
          
          ${paymentInfoHTML}
          
          <div class="cashier-info">
            Atendido por: ${userName}
          </div>
          
          <div class="footer">
            <p><strong>POLÍTICAS DE CAMBIOS</strong></p>
            <p>• Cambios dentro de 15 días naturales con ticket.</p>
            <p>• Producto con etiquetas, sin daños ni signos de uso.</p>
            <p>• Cambio por talla, color u otro producto. No hay devoluciones en efectivo.</p>
            <p>• No hay cambios en productos de oferta.</p>
            <p style="margin-top: 15px;"><strong>¡Gracias por tu compra!</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

}
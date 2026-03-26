/**
 * Servicio para enviar notificaciones SMS y Email.
 * La API key de Brevo se toma desde variables de entorno.
 */

const BREVO_API_KEY = import.meta.env.VITE_BREVO_API_KEY as string | undefined;
const BREVO_SENDER_EMAIL = 'pedidos@dmartiendaderopa.com';

export class NotificationService {
  /**
   * Envía notificación SMS (placeholder - requiere integración con servicio SMS)
   */
  static async sendSMS(phone: string, message: string): Promise<void> {
    // TODO: Integrar con servicio SMS (Twilio, AWS SNS, etc.)
    console.log(`[SMS] Enviando a ${phone}: ${message}`);
  }

  /**
   * Envía notificación por Email usando la API de Brevo directamente desde el frontend
   */
  static async sendEmail(
    to: string,
    subject: string,
    _htmlBody: string, // No se usa, el HTML se genera dentro de la función
    orderData?: {
      customerName?: string;
      orderId?: string;
      orderItems?: any[];
      total?: number;
      pickupDate?: string;
      pickupTimeSlot?: string;
    }
  ): Promise<void> {
    if (!BREVO_API_KEY) {
      throw new Error('Falta configurar VITE_BREVO_API_KEY en el entorno');
    }

    try {
      // Generar resumen del pedido si hay items
      const orderSummary = orderData?.orderItems
        ? orderData.orderItems.map((item: any) => {
            let variantInfo = '';
            if (item.variant) {
              const variant = item.variant;
              const color = variant.color || '';
              const size = variant.size || '';
              if (color && size) {
                variantInfo = ` - ${color} - ${size}`;
              } else if (color) {
                variantInfo = ` - ${color}`;
              } else if (size) {
                variantInfo = ` - ${size}`;
              }
            }
            return `- ${item.name}${variantInfo} x${item.quantity}`;
          }).join('<br>')
        : 'Productos del pedido';

      const orderRef = orderData?.orderId ? ` (Pedido #${orderData.orderId.substring(0, 8)})` : '';
      const formattedTotal = orderData?.total ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(orderData.total) : 'Pendiente';
      const customerName = orderData?.customerName || 'Cliente';

      // Determinar el mensaje principal basado en el asunto
      let statusMessage = `Tu pedido${orderRef} fue recibido exitosamente.`;
      let actionMessage = `Te esperamos en tienda para realizar el pago y recoger tus productos.`;

      if (subject.toLowerCase().includes('empacado') || subject.toLowerCase().includes('listo')) {
        statusMessage = `¡Excelentes noticias! Tu pedido${orderRef} ya ha sido empacado y está listo para ser entregado.`;
        actionMessage = `Ya puedes pasar por él a nuestra tienda.`;
      } else if (subject.toLowerCase().includes('entregado')) {
        statusMessage = `Tu pedido${orderRef} ha sido marcado como entregado.`;
        actionMessage = `¡Esperamos que disfrutes tus nuevos productos! Gracias por tu compra.`;
      }

      // Crear el HTML completo del correo
      const emailHtml = `
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
            }
            .header {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #ffffff;
              padding: 30px;
              border: 1px solid #e0e0e0;
              border-top: none;
            }
            .order-info {
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 4px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>D'Mar Tienda de Ropa</h1>
          </div>
          <div class="content">
            <h2>¡Hola ${customerName}!</h2>
            <p>${statusMessage}</p>
            
            <div class="order-info">
              <h3>Detalles del pedido:</h3>
              ${orderSummary}
              <p><strong>Total: ${formattedTotal}</strong></p>
              ${orderData?.pickupDate ? (() => {
                const date = new Date(orderData.pickupDate + 'T00:00:00');
                const formattedDate = date.toLocaleDateString('es-MX', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
                return `<p><strong>Fecha de recogida:</strong> ${formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1)}</p>`;
              })() : ''}
              ${orderData?.pickupTimeSlot ? (() => {
                const timeSlot = orderData.pickupTimeSlot;
                // Formatear horario de "09:00-11:00" a "09:00 - 11:00"
                const formattedTime = timeSlot.replace('-', ' - ');
                return `<p><strong>Horario:</strong> ${formattedTime}</p>`;
              })() : ''}
            </div>
            
            <p><strong>${actionMessage}</strong></p>
            <p>Gracias por elegir D'Mar Tienda de Ropa.</p>
          </div>
          <div class="footer">
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
              <p style="margin: 0 0 10px 0; font-weight: 600; color: #0f172a;">📍 Ubicación de la Tienda:</p>
              <p style="margin: 0 0 10px 0; color: #475569;">
                Central de Abasto Toluca<br>
                José López Portillo Km 4.5 - Puerta 6 Local 67<br>
                San Mateo Otzacatipan, 50220 Toluca de Lerdo, Méx.
              </p>
              <p style="margin: 10px 0 0 0;">
                <a href="https://maps.app.goo.gl/N9MQajGF26iTtFoE9" 
                   style="color: #26c6da; text-decoration: none; font-weight: 600;">
                  Ver en Google Maps →
                </a>
              </p>
            </div>
            
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-weight: 600; color: #0f172a;">Síguenos en nuestras redes sociales:</p>
              <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                <a href="#" style="color: #E4405F; text-decoration: none; font-weight: 500;">Instagram</a>
                <a href="#" style="color: #000000; text-decoration: none; font-weight: 500;">TikTok</a>
                <a href="#" style="color: #1877F2; text-decoration: none; font-weight: 500;">Facebook</a>
              </div>
            </div>
            
            <p style="margin: 10px 0; font-size: 12px; color: #666;">Este es un correo automático, por favor no respondas.</p>
            <p style="margin: 0; font-size: 12px; color: #666;">&copy; ${new Date().getFullYear()} D'Mar Tienda de Ropa. Todos los derechos reservados.</p>
          </div>
        </body>
        </html>
      `;

      // Preparar el payload para Brevo API
      const brevoPayload = {
        sender: {
          name: "D'Mar Tienda de Ropa",
          email: BREVO_SENDER_EMAIL,
        },
        to: [
          {
            email: to,
            name: customerName,
          },
        ],
        subject: subject || `Pedido recibido${orderRef} - D'Mar Tienda de Ropa`,
        htmlContent: emailHtml,
      };

      // Enviar correo usando Brevo Transactional Emails API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brevoPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        const errorMessage = errorData.message || errorData.error || response.statusText;
        
        // Mensajes de error más descriptivos
        if (response.status === 401) {
          throw new Error(`API Key no válida o no habilitada. Verifica en Brevo → SMTP & API → API Keys que la key esté habilitada y tenga permisos de SMTP API. Error: ${errorMessage}`);
        } else if (response.status === 403) {
          throw new Error(`Acceso denegado. Verifica que la API Key tenga permisos de SMTP API y que el remitente esté verificado. Error: ${errorMessage}`);
        } else if (response.status === 400) {
          throw new Error(`Solicitud inválida. Verifica el formato del email y los datos del remitente. Error: ${errorMessage}`);
        }
        
        throw new Error(`Error enviando correo (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      console.log(`[Email] Correo enviado exitosamente a ${to}`, result);
    } catch (error: any) {
      console.error(`[Email] Error enviando correo a ${to}:`, error);
      // Re-lanzar el error para que el llamador pueda manejarlo
      throw error;
    }
  }

  /**
   * Envía un ticket de venta por email con HTML personalizado
   */
  static async sendTicketEmail(
    to: string,
    subject: string,
    htmlContent: string
  ): Promise<void> {
    if (!BREVO_API_KEY) {
      throw new Error('Falta configurar VITE_BREVO_API_KEY en el entorno');
    }

    // Validar que el email sea válido
    if (!to || !to.trim()) {
      throw new Error('El email del destinatario está vacío');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to.trim())) {
      throw new Error(`El email "${to}" no es válido`);
    }
    
    try {
      // Preparar el payload para Brevo API
      const brevoPayload = {
        sender: {
          name: "D'Mar Tienda de Ropa",
          email: BREVO_SENDER_EMAIL,
        },
        to: [
          {
            email: to.trim(),
            name: 'Cliente',
          },
        ],
        subject: subject,
        htmlContent: htmlContent,
      };
      
      console.log(`[Email] Enviando ticket a: ${to.trim()}`);

      // Enviar correo usando Brevo Transactional Emails API
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brevoPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        const errorMessage = errorData.message || errorData.error || response.statusText;
        console.error(`[Email] Error de Brevo API:`, {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(`Error enviando correo (${response.status}): ${errorMessage}`);
      }

      const result = await response.json();
      console.log(`[Email] Ticket enviado exitosamente a ${to}`, result);
      
      // Verificar si hay un mensaje de advertencia en la respuesta
      if (result.messageId) {
        console.log(`[Email] ID del mensaje: ${result.messageId}`);
      }
    } catch (error: any) {
      console.error(`[Email] Error enviando ticket a ${to}:`, error);
      // Si es un error de red, agregar más información
      if (error.message?.includes('fetch')) {
        throw new Error('Error de conexión al enviar el email. Verifica tu conexión a internet.');
      }
      throw error;
    }
  }

  /**
   * Notifica al cliente que su pedido fue recibido
   */
  static async notifyOrderReceived(
    customerName: string,
    _customerPhone: string,
    customerEmail?: string,
    orderId?: string,
    orderData?: {
      orderItems?: any[];
      total?: number;
      pickupDate?: string;
      pickupTimeSlot?: string;
    }
  ): Promise<{ emailSent: boolean; emailError?: string }> {
    // SMS deshabilitado por ahora - solo correos electrónicos
    // const orderRef = orderId ? ` (Pedido #${orderId.substring(0, 8)})` : '';
    // const smsMessage = `Hola ${customerName}! Tu pedido${orderRef} fue recibido en D'Mar Boutique. Te esperamos en tienda para pagar y recoger. Gracias!`;
    
    // Enviar SMS si hay teléfono (deshabilitado por ahora)
    // if (customerPhone) {
    //   try {
    //     await this.sendSMS(customerPhone, smsMessage);
    //   } catch (error) {
    //     console.error('Error enviando SMS:', error);
    //   }
    // }

    // Enviar Email si hay correo
    if (customerEmail && customerEmail.trim()) {
      // Validar email antes de intentar enviarlo
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(customerEmail.trim())) {
        const errorMsg = `El email "${customerEmail}" no es válido`;
        console.warn(`[NotificationService] ${errorMsg}`);
        return { emailSent: false, emailError: errorMsg };
      }

      try {
        const orderRef = orderId ? ` (Pedido #${orderId.substring(0, 8)})` : '';
        const emailSubject = `Pedido recibido${orderRef} - D'Mar Tienda de Ropa`;
        console.log(`[NotificationService] Intentando enviar correo a: ${customerEmail.trim()}`);
        await this.sendEmail(customerEmail.trim(), emailSubject, '', {
          customerName,
          orderId,
          ...orderData,
        });
        console.log(`[NotificationService] Correo enviado exitosamente a: ${customerEmail.trim()}`);
        return { emailSent: true };
      } catch (error: any) {
        const errorMsg = error.message || 'Error desconocido al enviar el correo';
        console.error(`[NotificationService] Error enviando Email a ${customerEmail}:`, error);
        return { emailSent: false, emailError: errorMsg };
      }
    } else {
      console.log(`[NotificationService] No se proporcionó email, omitiendo envío de correo`);
      return { emailSent: false, emailError: 'No se proporcionó email del cliente' };
    }
  }

  /**
   * Notifica al cliente que su pedido ha sido empacado
   */
  static async notifyOrderPacked(
    customerName: string,
    customerEmail?: string,
    orderId?: string,
    orderData?: {
      orderItems?: any[];
      total?: number;
    }
  ): Promise<{ emailSent: boolean; emailError?: string }> {
    if (customerEmail && customerEmail.trim()) {
      try {
        const orderRef = orderId ? ` (Pedido #${orderId.substring(0, 8)})` : '';
        const emailSubject = `¡Tu pedido ya está listo!${orderRef} - D'Mar Tienda de Ropa`;
        
        await this.sendEmail(customerEmail.trim(), emailSubject, '', {
          customerName,
          orderId,
          ...orderData,
        });
        return { emailSent: true };
      } catch (error: any) {
        return { emailSent: false, emailError: error.message || 'Error al enviar correo' };
      }
    }
    return { emailSent: false, emailError: 'No se proporcionó email' };
  }

  /**
   * Notifica al cliente que su pedido ha sido entregado
   */
  static async notifyOrderDelivered(
    customerName: string,
    customerEmail?: string,
    orderId?: string,
    orderData?: {
      orderItems?: any[];
      total?: number;
    }
  ): Promise<{ emailSent: boolean; emailError?: string }> {
    if (customerEmail && customerEmail.trim()) {
      try {
        const orderRef = orderId ? ` (Pedido #${orderId.substring(0, 8)})` : '';
        const emailSubject = `Pedido entregado${orderRef} - D'Mar Tienda de Ropa`;
        
        await this.sendEmail(customerEmail.trim(), emailSubject, '', {
          customerName,
          orderId,
          ...orderData,
        });
        return { emailSent: true };
      } catch (error: any) {
        return { emailSent: false, emailError: error.message || 'Error al enviar correo' };
      }
    }
    return { emailSent: false, emailError: 'No se proporcionó email' };
  }
}


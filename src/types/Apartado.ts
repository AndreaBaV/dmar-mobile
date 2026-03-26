// src/types/Apartado.ts
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface Payment {
  id: string;
  amount: number;
  date: any; // Firestore Timestamp
  createdAt: any; // Firestore Timestamp
  paymentMethod?: PaymentMethod; // Método de pago usado para este abono
}

export interface Apartado {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone: string;
  productDescription: string;
  price: number;
  payments: Payment[];
  dueDate: any; // Firestore Timestamp (21 días desde creación)
  status: 'active' | 'completed' | 'expired';
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export type ApartadoCreate = Omit<Apartado, 
  'id' | 'payments' | 'status' | 'createdAt' | 'updatedAt' | 'dueDate'> & {
  initialPayment?: number;
  initialPaymentMethod?: PaymentMethod; // Método de pago del abono inicial
  cartItems?: Array<{ // Items del carrito para actualizar stock
    productId: string;
    quantity: number;
    variant?: {
      color: string;
      size: string;
    };
  }>;
};

export type ApartadoUpdate = Partial<Omit<ApartadoCreate, 'clientName' | 'clientPhone' | 'productDescription' | 'price'>>;


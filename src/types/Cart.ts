// src/types/Cart.ts
import type { Variant } from './Product';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  variant?: Variant;
}


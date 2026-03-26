/**
 * Tipos para gestión de proveedores
 * 
 * @author Andrea Bahena
 * @description Define la estructura de datos para los proveedores (marcas) de productos
 */

export interface Supplier {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface SupplierCreate {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}


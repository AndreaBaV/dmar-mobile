/**
 * Tipos para gestión de socios comerciales
 * 
 * @author Andrea Bahena
 * @description Define la estructura de datos para los socios comerciales de la tienda
 */

export interface Partner {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
  active: boolean;
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface PartnerCreate {
  name: string;
  address?: string;
  phone?: string;
  notes?: string;
}


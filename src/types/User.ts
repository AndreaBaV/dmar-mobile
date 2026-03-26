// src/types/User.ts

export type UserRole = 'admin' | 'cashier';

export interface User {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // ID del usuario que lo creó
}

export interface UserFormData {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
}

export interface UserUpdate {
  name?: string;
  role?: UserRole;
  phone?: string;
  isActive?: boolean;
}
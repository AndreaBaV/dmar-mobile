// src/types/Client.ts
export interface Client {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    taxId?: string;
    points: number;
    purchaseCount: number;
    totalSpent: number;
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    searchName?: string;
    searchPhone?: string;
  }
  
  export type ClientCreate = Omit<Client, 
    'id' | 'points' | 'purchaseCount' | 'totalSpent' | 
    'createdAt' | 'updatedAt' | 'searchName' | 'searchPhone'> & {
    phone?: string;
    email?: string;
    taxId?: string;
  };
  
  export type ClientUpdate = Partial<Omit<ClientCreate, 'name'>> & {
    name?: string;
  };
// src/types/Task.ts

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo: string; // User ID
  assignedToName: string; // Nombre del usuario asignado
  createdBy: string; // User ID del creador
  createdByName: string; // Nombre del creador
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date; // Fecha en que se completó la tarea
}

export interface TaskCreate {
  title: string;
  description?: string;
  assignedTo: string;
  assignedToName: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

export interface TaskUpdate {
  title?: string;
  description?: string;
  status?: TaskStatus;
  assignedTo?: string;
  assignedToName?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Date;
}

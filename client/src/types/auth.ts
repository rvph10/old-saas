export interface User {
    id: string;
    email: string;
    username: string;
    firstName?: string;
    lastName?: string;
    role?: {
      id: string;
      name: RoleType;
      permissions?: string[];
    };
  }
  
  export type RoleType = 'admin' | 'user' | 'manager';
  
  export interface LoginCredentials {
    username: string;
    password: string;
  }
  
  export interface RegisterData {
    email: string;
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }
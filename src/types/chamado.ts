export type ChamadoStatus = 
  | 'idle'
  | 'searching'
  | 'accepted'
  | 'negotiating'
  | 'confirmed'
  | 'in_service'
  | 'finished'
  | 'canceled';

export type UserProfile = 'client' | 'provider';

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface Chamado {
  id: string;
  status: ChamadoStatus;
  clienteId: string;
  prestadorId: string | null;
  origem: Location;
  destino: Location;
  valor: number | null;
  valorProposto: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Provider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalServices: number;
  online: boolean;
  location: Location;
  radarRange: number; // km
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  activeProfile: UserProfile;
  providerData?: {
    online: boolean;
    radarRange: number;
    rating: number;
    totalServices: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: UserProfile;
  message: string;
  timestamp: Date;
}

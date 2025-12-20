export type ChamadoStatus = 
  | 'idle'
  | 'searching'
  | 'accepted'
  | 'negotiating'
  | 'awaiting_payment'
  | 'confirmed'
  | 'in_service'
  | 'finished'
  | 'canceled';

export type UserProfile = 'client' | 'provider';

// Service types for automotive services
export type ServiceType = 
  | 'guincho'      // Tow truck - requires origin AND destination
  | 'borracharia'  // Mobile tire service - origin only
  | 'mecanica'     // Mobile mechanic - origin only
  | 'chaveiro';    // Locksmith - origin only

export const SERVICE_CONFIG: Record<ServiceType, {
  label: string;
  description: string;
  icon: string;
  requiresDestination: boolean;
  estimatedTime: string;
}> = {
  guincho: {
    label: 'Guincho',
    description: 'Reboque do veículo para oficina ou destino',
    icon: '🚛',
    requiresDestination: true,
    estimatedTime: '30-45 min',
  },
  borracharia: {
    label: 'Borracharia Móvel',
    description: 'Troca de pneu, calibragem, reparo no local',
    icon: '🔧',
    requiresDestination: false,
    estimatedTime: '20-30 min',
  },
  mecanica: {
    label: 'Mecânica Móvel',
    description: 'Diagnóstico e reparo no local',
    icon: '🔩',
    requiresDestination: false,
    estimatedTime: '30-60 min',
  },
  chaveiro: {
    label: 'Chaveiro Automotivo',
    description: 'Abertura de veículo, cópia de chave',
    icon: '🔑',
    requiresDestination: false,
    estimatedTime: '15-25 min',
  },
};

// Helper to check if service requires destination
export function serviceRequiresDestination(serviceType: ServiceType): boolean {
  return SERVICE_CONFIG[serviceType].requiresDestination;
}

export type PaymentStatus = 
  | 'pending'
  | 'paid_mock'
  | 'paid_stripe'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'stripe';

export type PaymentProvider = 
  | 'mock'
  | 'stripe'
  | 'mercadopago';

export interface Location {
  lat: number;
  lng: number;
  address: string;
  placeId?: string;
}

export interface Payment {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  paidAt?: Date;
  metadata?: Record<string, string>;
}

export interface Chamado {
  id: string;
  status: ChamadoStatus;
  tipoServico: ServiceType;
  clienteId: string;
  prestadorId: string | null;
  origem: Location;
  destino: Location | null; // NULL for non-guincho services
  valor: number | null;
  valorProposto: number | null;
  payment: Payment | null;
  vehicleType: string | null; // Vehicle type selected by client
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
  radarRange: number;
  services: ServiceType[]; // Services this provider offers
  vehiclePlate?: string; // Vehicle plate (optional)
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
    services: ServiceType[];
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: UserProfile;
  message: string;
  timestamp: Date;
}

export function createMockPayment(amount: number, method: PaymentMethod = 'pix'): Payment {
  return {
    id: `payment-${Date.now()}`,
    status: 'pending',
    method,
    amount,
    currency: 'BRL',
    provider: 'mock',
    createdAt: new Date(),
  };
}

export function approveMockPayment(payment: Payment): Payment {
  return {
    ...payment,
    status: 'paid_mock',
    paidAt: new Date(),
  };
}
